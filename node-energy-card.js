class BatteryTelemetryCard extends HTMLElement {
  static getStubConfig(hass) {
    return {
      entity: pickDefaultEntity(hass),
      title: 'Battery Telemetry',
      show_power: false,
      show_sun: false,
      show_clear: false,
    };
  }

  static getConfigElement() {
    return document.createElement('battery-telemetry-card-editor');
  }

  setConfig(config) {
    this._config = normalizeConfig(config);
    this._configKey = JSON.stringify(this._config);
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    const entity = this._config?.entity;
    const st = entity ? hass.states[entity] : null;
    const stamp = st ? `${st.last_updated}|${st.state}` : 'none';
    if (this._inner && stamp === this._lastStamp && this._lastConfigKey === this._configKey) {
      this._inner.hass = hass;
      return;
    }
    this._lastStamp = stamp;
    this._lastConfigKey = this._configKey;
    this._render();
  }

  getCardSize() {
    return this._config?.show_power ? 12 : 8;
  }

  async _render() {
    if (!this._config || !this._hass) return;
    const valid = getValidEntities(this._hass);
    const entity = this._config.entity;
    const hasEntityState = !!(entity && this._hass.states[entity]);
    const stateObj = hasEntityState ? this._hass.states[entity] : null;
    const hasApex = !!(stateObj && stateObj.attributes && stateObj.attributes.apex_series);
    const isUnavailable = !!(stateObj && (stateObj.state === 'unavailable' || stateObj.state === 'unknown'));

    if (!entity || (!valid.includes(entity) && !hasEntityState)) {
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

    if (hasEntityState && !hasApex && isUnavailable) {
      this.innerHTML = `
        <ha-card header="${escapeHtml(this._config.title)}">
          <div class="card-content">
            Entity <code>${escapeHtml(entity)}</code> is currently <b>${escapeHtml(stateObj.state)}</b>.
            Waiting for integration data (<code>apex_series</code>) to become available.
          </div>
        </ha-card>
      `;
      return;
    }

    if (hasEntityState && !hasApex) {
      this.innerHTML = `
        <ha-card header="${escapeHtml(this._config.title)}">
          <div class="card-content">
            Selected entity <code>${escapeHtml(entity)}</code> exists but does not expose <code>apex_series</code>.
            Select the integration output sensor (Battery Telemetry Forecast), not the raw battery sensor.
          </div>
        </ha-card>
      `;
      return;
    }

    const st = stateObj;
    const apex = (st && st.attributes && st.attributes.apex_series) || {};
    const cardConfig = buildCardConfig(this._config, apex);
    const noSunLabel = buildNoSunRuntimeLabel(st);
    const fullChargeLabel = buildFullChargeLabel(st);

    try {
      if (!this._inner || typeof this._inner.setConfig !== 'function') {
        this._inner = await createCardElement(this._hass, cardConfig);
        this.innerHTML = `
          <style>
            .bt-wrap { display: grid; gap: 8px; }
            .bt-metric {
              padding: 0 8px;
              color: var(--secondary-text-color);
              font-size: 0.92rem;
              line-height: 1.2;
            }
            .bt-metric b {
              color: var(--primary-text-color);
              font-weight: 600;
            }
          </style>
          <div class="bt-wrap">
            <div class="bt-metric" id="bt-no-sun"></div>
            <div class="bt-metric" id="bt-full-charge"></div>
            <div id="bt-chart"></div>
          </div>
        `;
        const chartHost = this.querySelector('#bt-chart');
        if (chartHost) {
          chartHost.appendChild(this._inner);
        }
      } else {
        this._inner.setConfig(cardConfig);
      }
      const metric = this.querySelector('#bt-no-sun');
      if (metric) {
        metric.innerHTML = noSunLabel;
      }
      const metricFull = this.querySelector('#bt-full-charge');
      if (metricFull) {
        metricFull.innerHTML = fullChargeLabel;
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

function buildNoSunRuntimeLabel(st) {
  const attrs = (st && st.attributes) || {};
  const ap = attrs.apex_series || {};
  const meta = attrs.meta || {};
  const model = attrs.model || {};

  const cells = Number(meta.cells_current || 0);
  const cellMah = Number(meta.cell_mah || 0);
  const cellV = Number(meta.cell_v || 0);
  const loadW = Number(model.load_w || 0);
  const capWh = cells > 0 && cellMah > 0 && cellV > 0 ? cells * (cellMah / 1000) * cellV : 0;

  let soc = Number(st && st.state);
  const socNowArr = ap.soc_projection_weather || [];
  if (Number.isFinite(Number(socNowArr[0] && socNowArr[0].y))) {
    soc = Number(socNowArr[0].y);
  }

  if (!(capWh > 0) || !(loadW > 0) || !Number.isFinite(soc)) {
    return '<b>No-sun runtime:</b> n/a';
  }

  const remainWh = Math.max(0, Math.min(100, soc)) / 100 * capWh;
  const days = remainWh / loadW / 24;
  if (!Number.isFinite(days)) {
    return '<b>No-sun runtime:</b> n/a';
  }
  const daysTxt = days >= 10 ? days.toFixed(0) : days.toFixed(1);
  return `<b>No-sun runtime:</b> ${daysTxt} days`;
}

function buildFullChargeLabel(st) {
  const attrs = (st && st.attributes) || {};
  const etaH = Number(attrs.full_charge_eta_hours);
  const atRaw = attrs.full_charge_at;
  if (!Number.isFinite(etaH) && !atRaw) {
    return '<b>Full charge ETA:</b> not within horizon';
  }
  const etaTxt = Number.isFinite(etaH) ? (etaH >= 48 ? `${(etaH / 24).toFixed(1)} days` : `${etaH.toFixed(1)} h`) : 'n/a';
  const at = atRaw ? new Date(atRaw) : null;
  const atTxt = at && Number.isFinite(at.getTime()) ? at.toLocaleString() : 'n/a';
  return `<b>Full charge ETA:</b> ${etaTxt} (${atTxt})`;
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
    const options = valid.length ? valid : getCandidateTelemetryEntities(this._hass, this._config.entity);

    if (this._config.entity && !options.includes(this._config.entity)) {
      this._config.entity = '';
    }
    if (!this._config.entity && options[0]) {
      this._config.entity = options[0];
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
            ${options.map((eid) => `<option value="${escapeHtml(eid)}" ${eid === this._config.entity ? 'selected' : ''}>${escapeHtml(eid)}</option>`).join('')}
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
    ...(config || {}),
  };
}

function buildCardConfig(cfg, apex) {
  const main = buildMainApexCardConfig(cfg, apex);
  if (!cfg.show_power) {
    return main;
  }
  return {
    type: 'vertical-stack',
    cards: [
      main,
      buildPowerApexCardConfig(cfg, apex),
    ],
  };
}

function buildMainApexCardConfig(cfg, apex) {
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

  const socSource = (apex.soc_actual || []).concat(
    apex.soc_projection_weather || [],
    apex.soc_projection_clear || [],
    apex.soc_projection_no_sun || [],
  );
  const [socMinRaw, socMaxRaw] = range(socSource, 0, 100, 0.08);
  const socMin = Math.max(0, socMinRaw);
  const socMax = Math.min(100, socMaxRaw);

  const sunSource = (apex.sun_history || []).concat(apex.sun_forecast || []);
  const [sunMin, sunMax] = range(sunSource, -90, 90, 0.08);
  const nowTs = Number.isFinite(Date.parse(apex.now || '')) ? Date.parse(apex.now) : null;
  const spanWindow = computeSpanWindow(apex, nowTs);

  const yaxis = [
    {
      id: 'soc',
      min: socMin,
      max: socMax,
      decimalsInFloat: 1,
      title: { text: 'SOC %' },
    },
  ];
  const cardYaxis = [
    {
      id: 'soc',
      min: socMin,
      max: socMax,
      decimals: 0,
      opposite: false,
    },
  ];
  if (cfg.show_sun) {
    yaxis.push({
      id: 'sun',
      opposite: true,
      min: sunMin,
      max: sunMax,
      decimalsInFloat: 0,
      title: { text: 'Sun elev °' },
    });
    cardYaxis.push({
      id: 'sun',
      min: sunMin,
      max: sunMax,
      decimals: 0,
      opposite: true,
    });
  }

  const series = [
    {
      entity: cfg.entity,
      name: 'SOC',
      yaxis_id: 'soc',
      color: 'var(--primary-color)',
      extend_to: false,
      data_generator: `
        const a = entity.attributes.apex_series || {};
        const pts = (a.soc_actual || []).concat(a.soc_projection_weather || []);
        const out = [];
        const seen = new Set();
        for (const p of pts) {
          const t = new Date(p.x).getTime();
          if (!Number.isFinite(t) || seen.has(t)) continue;
          seen.add(t);
          out.push([t, p.y]);
        }
        out.sort((x, y) => x[0] - y[0]);
        return out;
      `,
    },
    {
      entity: cfg.entity,
      name: 'SOC (no sun)',
      yaxis_id: 'soc',
      color: 'var(--error-color)',
      stroke_dash: 4,
      extend_to: false,
      data_generator: `
        const a = entity.attributes || {};
        const ap = a.apex_series || {};
        if (Array.isArray(ap.soc_projection_no_sun) && ap.soc_projection_no_sun.length) {
          return ap.soc_projection_no_sun.map(p => [new Date(p.x).getTime(), p.y]);
        }
        const fc = a.forecast || {};
        const m = a.meta || {};
        const model = a.model || {};
        const times = fc.times || [];
        if (!times.length) return [];

        const cells = Number(m.cells_current || 0);
        const mah = Number(m.cell_mah || 0);
        const cv = Number(m.cell_v || 0);
        const capWh = cells > 0 && mah > 0 && cv > 0 ? cells * (mah / 1000) * cv : 0;
        if (!(capWh > 0)) return [];

        const load = Number(model.load_w || 0);
        const base = ap.soc_projection_weather || [];
        let soc = base.length ? Number(base[0].y) : Number((fc.latest_soc ?? 0));
        if (!Number.isFinite(soc)) soc = 0;

        const out = [];
        let prevT = null;
        for (const x of times) {
          const t = new Date(x).getTime();
          if (!Number.isFinite(t)) continue;
          if (prevT !== null) {
            const dtH = Math.max(0, (t - prevT) / 3600000);
            soc += ((-load) * dtH / capWh) * 100;
            soc = Math.max(0, Math.min(100, soc));
          }
          out.push([t, soc]);
          prevT = t;
        }
        return out;
      `,
    },
  ];

  if (cfg.show_clear) {
    series.push({
      entity: cfg.entity,
      name: 'SOC (projection clear sky)',
      yaxis_id: 'soc',
      stroke_dash: 6,
      extend_to: false,
      data_generator: `
        const a = entity.attributes.apex_series || {};
        const pts = (a.soc_actual || []).concat(a.soc_projection_clear || []);
        const out = [];
        const seen = new Set();
        for (const p of pts) {
          const t = new Date(p.x).getTime();
          if (!Number.isFinite(t) || seen.has(t)) continue;
          seen.add(t);
          out.push([t, p.y]);
        }
        out.sort((x, y) => x[0] - y[0]);
        return out;
      `,
    });
  }
  if (cfg.show_sun) {
    series.push({
      entity: cfg.entity,
      name: 'Sun elevation',
      yaxis_id: 'sun',
      color: 'var(--warning-color)',
      stroke_width: 1.5,
      opacity: 0.35,
      extend_to: false,
      data_generator: `
        const a = entity.attributes.apex_series || {};
        const pts = (a.sun_history || []).concat(a.sun_forecast || []);
        const out = [];
        const seen = new Set();
        for (const p of pts) {
          const t = new Date(p.x).getTime();
          if (!Number.isFinite(t) || seen.has(t)) continue;
          seen.add(t);
          out.push([t, p.y]);
        }
        out.sort((x, y) => x[0] - y[0]);
        return out;
      `,
    });
  }

  return {
    type: 'custom:apexcharts-card',
    header: { show: true, title: cfg.title },
    update_interval: '5min',
    ...(spanWindow || {}),
    yaxis: cardYaxis,
    now: { show: true, label: 'Now' },
    apex_config: {
      chart: {
        height: cfg.show_power ? '420px' : '560px',
        toolbar: { show: true },
      },
      annotations: {
        xaxis: nowTs
          ? [
              {
                x: nowTs,
                borderColor: '#00BCD4',
                strokeDashArray: 4,
                label: {
                  text: 'Now',
                  style: { color: '#fff', background: '#00BCD4' },
                },
              },
            ]
          : [],
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

function buildPowerApexCardConfig(cfg, apex) {
  const vals = (arr) => (arr || []).map((p) => Number(p.y)).filter(Number.isFinite);
  const range = (arr, fallbackMin, fallbackMax, pad = 0.12) => {
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

  const nowTs = Number.isFinite(Date.parse(apex.now || '')) ? Date.parse(apex.now) : null;
  const spanWindow = computeSpanWindow(apex, nowTs);
  const source = (apex.power_observed || []).concat(apex.power_modeled || [], apex.power_consumption || []);
  const [powMin, powMax] = range(source, -1, 1);

  return {
    type: 'custom:apexcharts-card',
    header: { show: false },
    update_interval: '5min',
    ...(spanWindow || {}),
    yaxis: [
      {
        id: 'power',
        min: powMin,
        max: powMax,
        decimals: 1,
        opposite: false,
      },
    ],
    now: { show: true, label: 'Now' },
    apex_config: {
      chart: {
        height: '280px',
        toolbar: { show: false },
      },
      annotations: {
        xaxis: nowTs
          ? [
              {
                x: nowTs,
                borderColor: '#00BCD4',
                strokeDashArray: 4,
              },
            ]
          : [],
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
      yaxis: [
        {
          id: 'power',
          min: powMin,
          max: powMax,
          decimalsInFloat: 1,
          title: { text: 'Power W' },
        },
      ],
    },
    series: [
      {
        entity: cfg.entity,
        name: 'Net W (weather)',
        yaxis_id: 'power',
        extend_to: false,
        data_generator: `
          const a = entity.attributes || {};
          const ap = a.apex_series || {};
          const model = a.model || {};
          const fc = a.forecast || {};
          const load = Number(model.load_w || 0);
          const peak = Number(model.solar_peak_w || 0);
          const out = [];
          const seen = new Set();

          for (const p of (ap.power_observed || [])) {
            const t = new Date(p.x).getTime();
            if (!Number.isFinite(t) || seen.has(t)) continue;
            seen.add(t);
            out.push([t, p.y]);
          }

          const ts = fc.times || [];
          const sp = fc.solar_proxy || [];
          const wf = fc.weather_factor || [];
          for (let i = 0; i < ts.length; i++) {
            const t = new Date(ts[i]).getTime();
            if (!Number.isFinite(t) || seen.has(t)) continue;
            seen.add(t);
            const net = -load + peak * Number(sp[i] || 0) * Number(wf[i] ?? 1);
            out.push([t, net]);
          }

          out.sort((x, y) => x[0] - y[0]);
          return out;
        `,
      },
      ...(cfg.show_clear ? [{
        entity: cfg.entity,
        name: 'Net W (clear)',
        yaxis_id: 'power',
        stroke_dash: 6,
        extend_to: false,
        data_generator: `
          const a = entity.attributes || {};
          const model = a.model || {};
          const fc = a.forecast || {};
          const load = Number(model.load_w || 0);
          const peak = Number(model.solar_peak_w || 0);
          const ts = fc.times || [];
          const sp = fc.solar_proxy || [];
          const out = [];
          for (let i = 0; i < ts.length; i++) {
            const t = new Date(ts[i]).getTime();
            if (!Number.isFinite(t)) continue;
            out.push([t, -load + peak * Number(sp[i] || 0)]);
          }
          out.sort((x, y) => x[0] - y[0]);
          return out;
        `,
      }] : []),
      {
        entity: cfg.entity,
        name: 'Load W',
        yaxis_id: 'power',
        extend_to: false,
        data_generator: `
          const a = entity.attributes || {};
          const ap = a.apex_series || {};
          const model = a.model || {};
          const fc = a.forecast || {};
          const load = Number(model.load_w || 0);
          const out = [];
          const seen = new Set();

          for (const p of (ap.power_consumption || [])) {
            const t = new Date(p.x).getTime();
            if (!Number.isFinite(t) || seen.has(t)) continue;
            seen.add(t);
            out.push([t, p.y]);
          }

          for (const x of (fc.times || [])) {
            const t = new Date(x).getTime();
            if (!Number.isFinite(t) || seen.has(t)) continue;
            seen.add(t);
            out.push([t, load]);
          }

          out.sort((x, y) => x[0] - y[0]);
          return out;
        `,
      },
    ],
  };
}

function computeXWindow(apex) {
  const keys = [
    'soc_actual',
    'soc_projection_weather',
    'soc_projection_clear',
    'sun_history',
    'sun_forecast',
    'power_observed',
    'power_modeled',
    'power_consumption',
  ];
  const ts = [];
  for (const k of keys) {
    const arr = apex && apex[k];
    if (!Array.isArray(arr)) continue;
    for (const p of arr) {
      const t = Date.parse((p && p.x) || '');
      if (Number.isFinite(t)) ts.push(t);
    }
  }
  if (!ts.length) return null;
  return { min: Math.min(...ts), max: Math.max(...ts) };
}

function computeSpanWindow(apex, nowTs) {
  const xw = computeXWindow(apex);
  if (!xw) return null;
  const min = Number(xw.min);
  const max = Number(xw.max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null;

  const spanHours = Math.max(1, Math.ceil((max - min) / 3600000));
  const out = { graph_span: `${spanHours}h` };

  const ref = Number.isFinite(nowTs) ? nowTs : Date.now();
  const futureHours = Math.ceil((max - ref) / 3600000);
  if (futureHours > 0) {
    out.span = { end: 'hour', offset: `+${futureHours}h` };
  }
  return out;
}

function getValidEntities(hass) {
  return Object.entries((hass && hass.states) || {})
    .filter(([eid, st]) => {
      if (!eid.startsWith('sensor.') || !st || !st.attributes) return false;
      const a = st.attributes;
      return !!(a.apex_series || a.history_soc || a.forecast || a.model || a.meta);
    })
    .map(([eid]) => eid)
    .sort();
}

function getAllSensorEntities(hass) {
  return Object.keys((hass && hass.states) || {})
    .filter((eid) => eid.startsWith('sensor.'))
    .sort();
}

function getCandidateTelemetryEntities(hass, selectedEntity = '') {
  const states = (hass && hass.states) || {};
  const out = new Set();
  if (selectedEntity && states[selectedEntity]) {
    out.add(selectedEntity);
  }
  for (const [eid, st] of Object.entries(states)) {
    if (!eid.startsWith('sensor.') || !st || !st.attributes) continue;
    const fn = String(st.attributes.friendly_name || '').toLowerCase();
    const hasTelemetryName = fn.includes('battery telemetry forecast') || fn.includes('battery telemetry');
    const hasDomainHint = eid.includes('battery_telemetry') || eid.includes('node_energy');
    if (hasTelemetryName || hasDomainHint) {
      out.add(eid);
    }
  }
  return Array.from(out).sort();
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
      icon: 'mdi:battery-heart-variant',
      preview: true,
      description: 'Chart card for battery telemetry history + forecast.',
    },
    {
      type: 'node-energy-card',
      name: 'Battery Telemetry (Legacy Alias)',
      icon: 'mdi:battery-heart-variant',
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
  setTimeout(upsert, 1000);
  setTimeout(upsert, 3000);
  window.addEventListener('ll-rebuild', upsert);
  window.addEventListener('location-changed', upsert);
})();
