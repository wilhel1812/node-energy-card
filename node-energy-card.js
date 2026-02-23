class NodeEnergySetupCard extends HTMLElement {
  static getStubConfig(hass) {
    const entity = pickDefaultEntity(hass);
    return {
      title: 'Node Energy Setup',
      entity,
    };
  }

  static getConfigElement() {
    return document.createElement('node-energy-setup-card-editor');
  }

  setConfig(config) {
    this._config = {
      title: 'Node Energy Setup',
      entity: '',
      ...config,
    };
    this._selectedEntity = this._config.entity || '';
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    const valid = getValidEntities(hass);
    if (!this._selectedEntity || !valid.includes(this._selectedEntity)) {
      this._selectedEntity = this._config?.entity && valid.includes(this._config.entity)
        ? this._config.entity
        : (valid[0] || '');
    }
    this._render();
  }

  getCardSize() {
    return 5;
  }

  _render() {
    if (!this._config || !this._hass) return;

    const valid = getValidEntities(this._hass);
    const current = valid.includes(this._selectedEntity) ? this._selectedEntity : (valid[0] || '');
    this._selectedEntity = current;

    const hint = valid.length
      ? 'Choose your Node Energy sensor and copy ready-to-paste dashboard YAML.'
      : 'No valid Node Energy sensors found yet. Configure the integration first.';

    this.innerHTML = `
      <ha-card header="${escapeHtml(this._config.title || 'Node Energy Setup')}">
        <div class="card-content root">
          <p class="hint">${escapeHtml(hint)}</p>
          <label class="field-label" for="entity-select">Node Energy sensor</label>
          <select id="entity-select" class="entity-select" ${valid.length ? '' : 'disabled'}>
            ${valid.map((eid) => `<option value="${escapeHtml(eid)}" ${eid === current ? 'selected' : ''}>${escapeHtml(eid)}</option>`).join('')}
          </select>
          <button id="copy-btn" class="copy-btn" ${current ? '' : 'disabled'}>
            Copy Dashboard Config
          </button>
          <div id="status" class="status"></div>
          <p class="steps">
            Next: Dashboard -> Edit -> Raw configuration editor -> Paste -> Save.
          </p>
        </div>
      </ha-card>
      <style>
        .root { display: grid; gap: 12px; }
        .hint { margin: 0; color: var(--secondary-text-color); }
        .field-label { font-weight: 600; }
        .entity-select {
          width: 100%;
          min-height: 44px;
          border: 1px solid var(--divider-color);
          border-radius: 10px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          padding: 0 12px;
          font: inherit;
        }
        .copy-btn {
          width: 100%;
          min-height: 64px;
          border: none;
          border-radius: 12px;
          background: var(--primary-color);
          color: var(--text-primary-color, #fff);
          font-size: 1.05rem;
          font-weight: 700;
          cursor: pointer;
          transition: filter 120ms ease;
        }
        .copy-btn:hover { filter: brightness(0.96); }
        .copy-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .status {
          min-height: 1.2em;
          color: var(--secondary-text-color);
          font-size: 0.95rem;
        }
        .status.ok { color: var(--success-color, #2e7d32); }
        .status.err { color: var(--error-color, #b00020); }
        .steps {
          margin: 0;
          color: var(--secondary-text-color);
          font-size: 0.92rem;
        }
      </style>
    `;

    const select = this.querySelector('#entity-select');
    const copyBtn = this.querySelector('#copy-btn');
    const statusEl = this.querySelector('#status');

    if (select) {
      select.addEventListener('change', (ev) => {
        this._selectedEntity = ev.target.value;
        if (statusEl) {
          statusEl.textContent = '';
          statusEl.className = 'status';
        }
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const entity = this._selectedEntity;
        if (!entity) return;
        const payload = buildDashboardYaml(entity);
        try {
          await copyText(payload);
          if (statusEl) {
            statusEl.textContent = `Copied config for ${entity}.`;
            statusEl.className = 'status ok';
          }
        } catch (err) {
          if (statusEl) {
            statusEl.textContent = 'Clipboard failed. Use HTTPS/app context or grant clipboard permission.';
            statusEl.className = 'status err';
          }
        }
      });
    }
  }
}

class NodeEnergySetupCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = {
      title: 'Node Energy Setup',
      entity: '',
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
      <div class="editor">
        <label>Title</label>
        <input id="title" type="text" value="${escapeHtml(this._config.title || 'Node Energy Setup')}" />
        <label>Default Node Energy sensor</label>
        <select id="entity">
          ${valid.map((eid) => `<option value="${escapeHtml(eid)}" ${eid === this._config.entity ? 'selected' : ''}>${escapeHtml(eid)}</option>`).join('')}
        </select>
      </div>
      <style>
        .editor { display: grid; gap: 8px; padding: 8px 0; }
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
        }
      </style>
    `;

    const title = this.querySelector('#title');
    const entity = this.querySelector('#entity');

    if (title) {
      title.addEventListener('change', (ev) => {
        this._config = { ...this._config, title: ev.target.value };
        this._notify();
      });
    }

    if (entity) {
      entity.addEventListener('change', (ev) => {
        this._config = { ...this._config, entity: ev.target.value };
        this._notify();
      });
    }
  }

  _notify() {
    this.dispatchEvent(
      new CustomEvent('config-changed', {
        bubbles: true,
        composed: true,
        detail: { config: this._config },
      })
    );
  }
}

function getValidEntities(hass) {
  return Object.entries((hass && hass.states) || {})
    .filter(([eid, st]) => {
      if (!eid.startsWith('sensor.')) return false;
      const as = st && st.attributes && st.attributes.apex_series;
      return !!as;
    })
    .map(([eid]) => eid)
    .sort();
}

function pickDefaultEntity(hass) {
  const valid = getValidEntities(hass);
  return valid[0] || '';
}

async function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  if (!ok) {
    throw new Error('Clipboard copy failed');
  }
}

function escapeHtml(v) {
  return String(v || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildDashboardYaml(entity) {
  return `title: Node Energy
views:
  - title: Overview
    path: overview
    panel: true
    cards:
      - type: custom:apexcharts-card
        header:
          show: true
          title: Node Energy
        update_interval: 5min
        now:
          show: true
          label: Now
        apex_config:
          chart:
            height: "82vh"
            toolbar:
              show: true
          legend:
            show: true
            position: bottom
          dataLabels:
            enabled: false
          tooltip:
            shared: true
            intersect: false
          xaxis:
            type: datetime
            labels:
              datetimeUTC: false
              format: "dd MMM HH:mm"
          stroke:
            curve: smooth
            width: [3, 3, 2, 2, 2, 2]
          yaxis:
            - id: soc
              min: 0
              max: 100
              decimalsInFloat: 0
              title: { text: "SOC %" }
            - id: power
              opposite: true
              decimalsInFloat: 1
              title: { text: "Power W" }
            - id: sun
              opposite: true
              min: -90
              max: 90
              decimalsInFloat: 0
              title: { text: "Sun elev °" }
        series:
          - entity: ${entity}
            name: SOC (history)
            yaxis_id: soc
            data_generator: return (entity.attributes.apex_series?.soc_actual || []).map(p => [new Date(p.x).getTime(), p.y]);
          - entity: ${entity}
            name: SOC (projection weather)
            yaxis_id: soc
            data_generator: return (entity.attributes.apex_series?.soc_projection_weather || []).map(p => [new Date(p.x).getTime(), p.y]);
          - entity: ${entity}
            name: SOC (projection clear sky)
            yaxis_id: soc
            stroke_dash: 6
            data_generator: return (entity.attributes.apex_series?.soc_projection_clear || []).map(p => [new Date(p.x).getTime(), p.y]);
          - entity: ${entity}
            name: Net W (observed)
            yaxis_id: power
            data_generator: return (entity.attributes.apex_series?.power_observed || []).map(p => [new Date(p.x).getTime(), p.y]);
          - entity: ${entity}
            name: Net W (modeled)
            yaxis_id: power
            data_generator: return (entity.attributes.apex_series?.power_modeled || []).map(p => [new Date(p.x).getTime(), p.y]);
          - entity: ${entity}
            name: Load W
            yaxis_id: power
            data_generator: return (entity.attributes.apex_series?.power_consumption || []).map(p => [new Date(p.x).getTime(), p.y]);
          - entity: ${entity}
            name: Sun elevation (history)
            yaxis_id: sun
            data_generator: return (entity.attributes.apex_series?.sun_history || []).map(p => [new Date(p.x).getTime(), p.y]);
          - entity: ${entity}
            name: Sun elevation (forecast)
            yaxis_id: sun
            stroke_dash: 6
            data_generator: return (entity.attributes.apex_series?.sun_forecast || []).map(p => [new Date(p.x).getTime(), p.y]);
`;
}

if (!customElements.get('node-energy-setup-card')) {
  customElements.define('node-energy-setup-card', NodeEnergySetupCard);
}
if (!customElements.get('node-energy-setup-card-editor')) {
  customElements.define('node-energy-setup-card-editor', NodeEnergySetupCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'node-energy-setup-card',
  name: 'Node Energy Setup',
  preview: true,
  description: 'UI helper that copies ready-to-paste dashboard YAML for Node Energy + ApexCharts.',
});
