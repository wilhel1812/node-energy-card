class BatteryTelemetryCard extends HTMLElement {
  static getStubConfig(hass) {
    return {
      entity: pickDefaultEntity(hass),
      title: 'Battery Telemetry',
      show_power: true,
      show_sun: true,
      show_clear: true,
    };
  }

  static getConfigElement() {
    return document.createElement('battery-telemetry-card-editor');
  }

  setConfig(config) {
    this._config = {
      entity: '',
      title: 'Battery Telemetry',
      show_power: true,
      show_sun: true,
      show_clear: true,
      ...config,
    };
    this._ensureRoot();
    this._renderState();
    this._syncInnerConfig();
  }

  set hass(hass) {
    this._hass = hass;
    this._ensureRoot();
    this._renderState();
    this._syncInnerConfig();
    if (this._inner) {
      this._inner.hass = hass;
    }
  }

  getCardSize() {
    return 10;
  }

  _ensureRoot() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { display: block; }
        .wrap { display: block; }
      </style>
      <div class="wrap" id="wrap"></div>
    `;
  }

  _renderState() {
    const wrap = this.shadowRoot?.querySelector('#wrap');
    if (!wrap) return;

    if (!this._config) {
      wrap.innerHTML = '';
      return;
    }

    const valid = getValidEntities(this._hass);
    const entity = this._config.entity;
    if (!entity || !valid.includes(entity)) {
      if (this._inner && this._inner.parentElement) {
        this._inner.parentElement.removeChild(this._inner);
      }
      this._inner = null;
      wrap.innerHTML = `
        <ha-card header="${escapeHtml(this._config.title || 'Battery Telemetry')}">
          <div class="card-content">
            ${valid.length
              ? 'Select a valid sensor in card settings.'
              : 'No valid Battery Telemetry entities found. Configure the integration first.'}
          </div>
        </ha-card>
      `;
      return;
    }

    if (wrap.children.length === 0 || !this._inner) {
      wrap.innerHTML = '';
      this._inner = document.createElement('div');
      wrap.appendChild(this._inner);
    }
  }

  async _syncInnerConfig() {
    if (!this._hass || !this._config || !this._inner) return;
    const valid = getValidEntities(this._hass);
    if (!valid.includes(this._config.entity)) return;

    const innerConfig = buildApexCardConfig(this._config);
    try {
      const canReconfigure = typeof this._inner.setConfig === 'function';
      if (canReconfigure) {
        this._inner.setConfig(innerConfig);
      } else {
        const replacement = await createCardElement(this._hass, innerConfig);
        const wrap = this.shadowRoot?.querySelector('#wrap');
        if (!wrap) return;
        if (this._inner && this._inner.parentElement === wrap) {
          wrap.replaceChild(replacement, this._inner);
        } else {
          wrap.appendChild(replacement);
        }
        this._inner = replacement;
      }
      this._inner.hass = this._hass;
    } catch (err) {
      const wrap = this.shadowRoot?.querySelector('#wrap');
      if (wrap) {
        wrap.innerHTML = `<ha-card><div class="card-content">Failed to render chart card: ${escapeHtml(String(err))}</div></ha-card>`;
      }
    }
  }
}

class BatteryTelemetryCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = {
      entity: '',
      title: 'Battery Telemetry',
      show_power: true,
      show_sun: true,
      show_clear: true,
      ...config,
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _render() {
    if (!this._config || !this._hass) return;
    const valid = getValidEntities(this._hass);
    if (this._config.entity && !valid.includes(this._config.entity)) {
      this._config.entity = '';
    }
    if (!this._config.entity && valid[0]) {
      this._config.entity = valid[0];
    }

    this.innerHTML = `
      <style>
        .editor { display: grid; gap: 10px; padding: 8px 0; }
        .row { display: grid; gap: 6px; }
        label { font-weight: 600; color: var(--primary-text-color); }
        input, select {
          width: 100%;
          min-height: 38px;
          border: 1px solid var(--divider-color);
          border-radius: 8px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          padding: 0 10px;
          font: inherit;
          box-sizing: border-box;
        }
        .checks { display: grid; gap: 8px; }
        .check { display: flex; align-items: center; gap: 8px; }
      </style>
      <div class="editor">
        <div class="row">
          <label>Title</label>
          <input id="title" type="text" value="${escapeHtml(this._config.title || 'Battery Telemetry')}" />
        </div>
        <div class="row">
          <label>Battery Telemetry sensor</label>
          <select id="entity">
            ${valid.map((eid) => `<option value="${escapeHtml(eid)}" ${eid === this._config.entity ? 'selected' : ''}>${escapeHtml(eid)}</option>`).join('')}
          </select>
        </div>
        <div class="checks">
          <label class="check"><input id="show_power" type="checkbox" ${this._config.show_power ? 'checked' : ''}/>Show power series</label>
          <label class="check"><input id="show_sun" type="checkbox" ${this._config.show_sun ? 'checked' : ''}/>Show sun elevation series</label>
          <label class="check"><input id="show_clear" type="checkbox" ${this._config.show_clear ? 'checked' : ''}/>Show clear-sky projection</label>
        </div>
      </div>
    `;

    this.querySelector('#title')?.addEventListener('change', (ev) => {
      this._config = { ...this._config, title: ev.target.value };
      this._notify();
    });
    this.querySelector('#entity')?.addEventListener('change', (ev) => {
      this._config = { ...this._config, entity: ev.target.value };
      this._notify();
    });
    this.querySelector('#show_power')?.addEventListener('change', (ev) => {
      this._config = { ...this._config, show_power: !!ev.target.checked };
      this._notify();
    });
    this.querySelector('#show_sun')?.addEventListener('change', (ev) => {
      this._config = { ...this._config, show_sun: !!ev.target.checked };
      this._notify();
    });
    this.querySelector('#show_clear')?.addEventListener('change', (ev) => {
      this._config = { ...this._config, show_clear: !!ev.target.checked };
      this._notify();
    });
  }

  _notify() {
    this.dispatchEvent(new CustomEvent('config-changed', {
      bubbles: true,
      composed: true,
      detail: { config: this._config },
    }));
  }
}

function buildApexCardConfig(cfg) {
  const entity = cfg.entity;
  const showPower = !!cfg.show_power;
  const showSun = !!cfg.show_sun;
  const showClear = !!cfg.show_clear;

  const series = [
    {
      entity,
      name: 'SOC (history)',
      yaxis_id: 'soc',
      data_generator: 'return (entity.attributes.apex_series?.soc_actual || []).map(p => [new Date(p.x).getTime(), p.y]);',
    },
    {
      entity,
      name: 'SOC (projection weather)',
      yaxis_id: 'soc',
      data_generator: 'return (entity.attributes.apex_series?.soc_projection_weather || []).map(p => [new Date(p.x).getTime(), p.y]);',
    },
  ];

  if (showClear) {
    series.push({
      entity,
      name: 'SOC (projection clear sky)',
      yaxis_id: 'soc',
      stroke_dash: 6,
      data_generator: 'return (entity.attributes.apex_series?.soc_projection_clear || []).map(p => [new Date(p.x).getTime(), p.y]);',
    });
  }

  if (showPower) {
    series.push(
      {
        entity,
        name: 'Net W (observed)',
        yaxis_id: 'power',
        data_generator: 'return (entity.attributes.apex_series?.power_observed || []).map(p => [new Date(p.x).getTime(), p.y]);',
      },
      {
        entity,
        name: 'Net W (modeled)',
        yaxis_id: 'power',
        data_generator: 'return (entity.attributes.apex_series?.power_modeled || []).map(p => [new Date(p.x).getTime(), p.y]);',
      },
      {
        entity,
        name: 'Load W',
        yaxis_id: 'power',
        data_generator: 'return (entity.attributes.apex_series?.power_consumption || []).map(p => [new Date(p.x).getTime(), p.y]);',
      },
    );
  }

  if (showSun) {
    series.push(
      {
        entity,
        name: 'Sun elevation (history)',
        yaxis_id: 'sun',
        data_generator: 'return (entity.attributes.apex_series?.sun_history || []).map(p => [new Date(p.x).getTime(), p.y]);',
      },
      {
        entity,
        name: 'Sun elevation (forecast)',
        yaxis_id: 'sun',
        stroke_dash: 6,
        data_generator: 'return (entity.attributes.apex_series?.sun_forecast || []).map(p => [new Date(p.x).getTime(), p.y]);',
      },
    );
  }

  return {
    type: 'custom:apexcharts-card',
    header: {
      show: true,
      title: cfg.title || 'Battery Telemetry',
    },
    update_interval: '5min',
    now: {
      show: true,
      label: 'Now',
    },
    apex_config: {
      chart: {
        height: '82vh',
        toolbar: { show: true },
      },
      legend: {
        show: true,
        position: 'bottom',
      },
      dataLabels: { enabled: false },
      tooltip: {
        shared: true,
        intersect: false,
      },
      xaxis: {
        type: 'datetime',
        labels: {
          datetimeUTC: false,
          format: 'dd MMM HH:mm',
        },
      },
      stroke: {
        curve: 'smooth',
      },
      yaxis: [
        {
          id: 'soc',
          min: 0,
          max: 100,
          decimalsInFloat: 0,
          title: { text: 'SOC %' },
        },
        {
          id: 'power',
          opposite: true,
          decimalsInFloat: 1,
          title: { text: 'Power W' },
        },
        {
          id: 'sun',
          opposite: true,
          min: -90,
          max: 90,
          decimalsInFloat: 0,
          title: { text: 'Sun elev °' },
        },
      ],
    },
    series,
  };
}

async function createCardElement(hass, config) {
  if (hass?.helpers?.createCardElement) {
    return hass.helpers.createCardElement(config);
  }
  if (window.loadCardHelpers) {
    const helpers = await window.loadCardHelpers();
    return helpers.createCardElement(config);
  }
  const fallback = document.createElement('apexcharts-card');
  if (typeof fallback.setConfig !== 'function') {
    throw new Error('ApexCharts card not loaded. Install/refresh ApexCharts card.');
  }
  fallback.setConfig(config);
  return fallback;
}

function getValidEntities(hass) {
  return Object.entries((hass && hass.states) || {})
    .filter(([eid, st]) => {
      if (!eid.startsWith('sensor.')) return false;
      return !!(st && st.attributes && st.attributes.apex_series);
    })
    .map(([eid]) => eid)
    .sort();
}

function pickDefaultEntity(hass) {
  const valid = getValidEntities(hass);
  return valid[0] || '';
}

function escapeHtml(v) {
  return String(v || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

if (!customElements.get('battery-telemetry-card')) {
  customElements.define('battery-telemetry-card', BatteryTelemetryCard);
}
if (!customElements.get('battery-telemetry-card-editor')) {
  customElements.define('battery-telemetry-card-editor', BatteryTelemetryCardEditor);
}

// Backward-compatible aliases.
if (!customElements.get('node-energy-card')) {
  customElements.define('node-energy-card', BatteryTelemetryCard);
}
if (!customElements.get('node-energy-card-editor')) {
  customElements.define('node-energy-card-editor', BatteryTelemetryCardEditor);
}
if (!customElements.get('battery-telemetry-setup-card')) {
  customElements.define('battery-telemetry-setup-card', BatteryTelemetryCard);
}
if (!customElements.get('battery-telemetry-setup-card-editor')) {
  customElements.define('battery-telemetry-setup-card-editor', BatteryTelemetryCardEditor);
}
if (!customElements.get('node-energy-setup-card')) {
  customElements.define('node-energy-setup-card', BatteryTelemetryCard);
}
if (!customElements.get('node-energy-setup-card-editor')) {
  customElements.define('node-energy-setup-card-editor', BatteryTelemetryCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'battery-telemetry-card',
  name: 'Battery Telemetry',
  preview: true,
  description: 'Chart card for battery telemetry history + forecast powered by the Battery Telemetry Forecast integration.',
});
