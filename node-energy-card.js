class BatteryTelemetryCard extends HTMLElement {
  static getStubConfig(hass) {
    return {
      entity: pickDefaultEntity(hass),
      title: 'Battery Telemetry',
      show_power: false,
      show_sun: false,
      show_clear: false,
      scale_mode: 'history_focus',
    };
  }

  static getConfigElement() {
    return document.createElement('battery-telemetry-card-editor');
  }

  setConfig(config) {
    this._config = normalizeConfig(config);
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 8;
  }

  async _render() {
    if (!this._config || !this._hass) return;
    const valid = getValidEntities(this._hass);
    const entity = this._config.entity;

    if (!entity || !valid.includes(entity)) {
      this.innerHTML = `
        <ha-card header="${escapeHtml(this._config.title)}">
          <div class="card-content">
            ${valid.length
              ? 'Select a valid Battery Telemetry entity in card settings.'
              : 'No valid Battery Telemetry entities found. Configure the integration first.'}
          </div>
        </ha-card>
      `;
      return;
    }

    const st = this._hass.states[entity];
    const apex = (st && st.attributes && st.attributes.apex_series) || {};
    const apexConfig = buildApexCardConfig(this._config, apex);

    try {
      if (!this._inner || typeof this._inner.setConfig !== 'function') {
        this._inner = await createCardElement(this._hass, apexConfig);
        this.innerHTML = '';
        this.appendChild(this._inner);
      } else {
        this._inner.setConfig(apexConfig);
      }
      this._inner.hass = this._hass;
    } catch (err) {
      this.innerHTML = `
        <ha-card header="${escapeHtml(this._config.title)}">
          <div class="card-content">Failed to render chart card: ${escapeHtml(String(err))}</div>
        </ha-card>
      `;
      this._inner = null;
    }
  }
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
    throw new Error('ApexCharts card not loaded. Install/refresh ApexCharts Card.');
  }
  fallback.setConfig(config);
  return fallback;
}

class BatteryTelemetryCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = normalizeConfig(config);
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _render() {
    if (!this._hass || !this._config) return;
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
          <input id="title" type="text" value="${escapeHtml(this._config.title)}" />
        </div>
        <div class="row">
          <label>Battery Telemetry sensor</label>
          <select id="entity">
            ${valid.map((eid) => `<option value="${escapeHtml(eid)}" ${eid === this._config.entity ? 'selected' : ''}>${escapeHtml(eid)}</option>`).join('')}
          </select>
        </div>
        <div class="row">
          <label>Scale mode</label>
          <select id="scale_mode">
            <option value="history_focus" ${this._config.scale_mode === 'history_focus' ? 'selected' : ''}>History focus</option>
            <option value="absolute" ${this._config.scale_mode === 'absolute' ? 'selected' : ''}>Absolute SOC (0-100)</option>
          </select>
        </div>
        <div class="checks">
          <label class="check"><input id="show_power" type="checkbox" ${this._config.show_power ? 'checked' : ''}/>Show power series</label>
          <label class="check"><input id="show_sun" type="checkbox" ${this._config.show_sun ? 'checked' : ''}/>Show sun elevation series</label>
          <label class="check"><input id="show_clear" type="checkbox" ${this._config.show_clear ? 'checked' : ''}/>Show clear-sky SOC projection</label>
        </div>
      </div>
    `;

    this.querySelector('#title')?.addEventListener('change', (ev) => this._set({ title: ev.target.value }));
    this.querySelector('#entity')?.addEventListener('change', (ev) => this._set({ entity: ev.target.value }));
    this.querySelector('#scale_mode')?.addEventListener('change', (ev) => this._set({ scale_mode: ev.target.value }));
    this.querySelector('#show_power')?.addEventListener('change', (ev) => this._set({ show_power: !!ev.target.checked }));
    this.querySelector('#show_sun')?.addEventListener('change', (ev) => this._set({ show_sun: !!ev.target.checked }));
    this.querySelector('#show_clear')?.addEventListener('change', (ev) => this._set({ show_clear: !!ev.target.checked }));
  }

  _set(patch) {
    this._config = normalizeConfig({ ...this._config, ...patch });
    this.dispatchEvent(new CustomEvent('config-changed', {
      bubbles: true,
      composed: true,
      detail: { config: this._config },
    }));
  }
}

function normalizeConfig(config) {
  return {
    entity: '',
    title: 'Battery Telemetry',
    show_power: false,
    show_sun: false,
    show_clear: false,
    scale_mode: 'history_focus',
    ...(config || {}),
  };
}

function buildApexCardConfig(cfg, apex) {
  const vals = (arr) => (arr || []).map((p) => Number(p.y)).filter(Number.isFinite);
  const range = (arr, fallbackMin, fallbackMax, pad = 0.1) => {
    const ys = vals(arr);
    if (!ys.length) return [fallbackMin, fallbackMax];
    let mn = Math.min(...ys);
    let mx = Math.max(...ys);
    if (mn === mx) {
      mn -= 1;
      mx += 1;
    }
    const span = mx - mn;
    return [mn - span * pad, mx + span * pad];
  };

  const history = apex.soc_actual || [];
  const socRangeSource = cfg.scale_mode === 'absolute' ? [] : history;

  const [socMinRaw, socMaxRaw] = cfg.scale_mode === 'absolute'
    ? [0, 100]
    : range(socRangeSource, 0, 100, 0.08);
  const socMin = Math.max(0, socMinRaw);
  const socMax = Math.min(100, socMaxRaw);

  const powerSource = (apex.power_observed || []).concat(apex.power_modeled || [], apex.power_consumption || []);
  const sunSource = (apex.sun_history || []).concat(apex.sun_forecast || []);
  const [powMin, powMax] = range(powerSource, -1, 1, 0.14);
  const [sunMin, sunMax] = range(sunSource, -90, 90, 0.08);

  const yaxis = [
    {
      id: 'soc',
      min: socMin,
      max: socMax,
      decimalsInFloat: 1,
      title: { text: 'SOC %' },
    },
  ];
  if (cfg.show_power) {
    yaxis.push({
      id: 'power',
      opposite: true,
      min: powMin,
      max: powMax,
      decimalsInFloat: 1,
      title: { text: 'Power W' },
    });
  }
  if (cfg.show_sun) {
    yaxis.push({
      id: 'sun',
      opposite: true,
      min: sunMin,
      max: sunMax,
      decimalsInFloat: 0,
      title: { text: 'Sun elev °' },
    });
  }

  const series = [
    {
      entity: cfg.entity,
      name: 'SOC (history)',
      yaxis_id: 'soc',
      data_generator: 'return (entity.attributes.apex_series?.soc_actual || []).map(p => [new Date(p.x).getTime(), p.y]);',
    },
    {
      entity: cfg.entity,
      name: 'SOC (projection weather)',
      yaxis_id: 'soc',
      data_generator: 'return (entity.attributes.apex_series?.soc_projection_weather || []).map(p => [new Date(p.x).getTime(), p.y]);',
    },
  ];

  if (cfg.show_clear) {
    series.push({
      entity: cfg.entity,
      name: 'SOC (projection clear sky)',
      yaxis_id: 'soc',
      stroke_dash: 6,
      data_generator: 'return (entity.attributes.apex_series?.soc_projection_clear || []).map(p => [new Date(p.x).getTime(), p.y]);',
    });
  }
  if (cfg.show_power) {
    series.push(
      {
        entity: cfg.entity,
        name: 'Net W (observed)',
        yaxis_id: 'power',
        data_generator: 'return (entity.attributes.apex_series?.power_observed || []).map(p => [new Date(p.x).getTime(), p.y]);',
      },
      {
        entity: cfg.entity,
        name: 'Net W (modeled)',
        yaxis_id: 'power',
        data_generator: 'return (entity.attributes.apex_series?.power_modeled || []).map(p => [new Date(p.x).getTime(), p.y]);',
      },
      {
        entity: cfg.entity,
        name: 'Load W',
        yaxis_id: 'power',
        data_generator: 'return (entity.attributes.apex_series?.power_consumption || []).map(p => [new Date(p.x).getTime(), p.y]);',
      },
    );
  }
  if (cfg.show_sun) {
    series.push(
      {
        entity: cfg.entity,
        name: 'Sun elevation (history)',
        yaxis_id: 'sun',
        data_generator: 'return (entity.attributes.apex_series?.sun_history || []).map(p => [new Date(p.x).getTime(), p.y]);',
      },
      {
        entity: cfg.entity,
        name: 'Sun elevation (forecast)',
        yaxis_id: 'sun',
        stroke_dash: 6,
        data_generator: 'return (entity.attributes.apex_series?.sun_forecast || []).map(p => [new Date(p.x).getTime(), p.y]);',
      },
    );
  }

  return {
    type: 'custom:apexcharts-card',
    header: { show: true, title: cfg.title },
    update_interval: '5min',
    now: { show: true, label: 'Now' },
    apex_config: {
      chart: {
        height: '520px',
        toolbar: { show: true },
      },
      legend: {
        show: true,
        position: 'top',
      },
      dataLabels: { enabled: false },
      tooltip: { shared: true, intersect: false },
      xaxis: {
        type: 'datetime',
        labels: { datetimeUTC: false, format: 'dd MMM HH:mm' },
      },
      stroke: { curve: 'smooth' },
      yaxis,
    },
    series,
  };
}

function getValidEntities(hass) {
  return Object.entries((hass && hass.states) || {})
    .filter(([eid, st]) => eid.startsWith('sensor.') && !!(st && st.attributes && st.attributes.apex_series))
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
if (!customElements.get('node-energy-card')) {
  customElements.define('node-energy-card', BatteryTelemetryCard);
}
if (!customElements.get('node-energy-card-editor')) {
  customElements.define('node-energy-card-editor', BatteryTelemetryCardEditor);
}

(function registerCustomCardMeta() {
  const metas = [
    {
      type: 'battery-telemetry-card',
      name: 'Battery Telemetry',
      preview: true,
      description: 'Chart card for battery telemetry history + forecast.',
    },
    {
      type: 'node-energy-card',
      name: 'Battery Telemetry (Legacy Alias)',
      preview: false,
      description: 'Legacy alias for Battery Telemetry card.',
    },
  ];

  const upsert = () => {
    window.customCards = Array.isArray(window.customCards) ? window.customCards : [];
    for (const m of metas) {
      if (!window.customCards.some((c) => c && c.type === m.type)) {
        window.customCards.push(m);
      }
    }
  };

  upsert();
  window.addEventListener('ll-rebuild', upsert);
  window.addEventListener('location-changed', upsert);
})();
