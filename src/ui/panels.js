import { SCENARIOS, REAGENTS, SPECIES_LABELS } from '../chem/scenarios.js';
import { createChart } from './chart.js';

const fmt = (n, digits = 3) => n.toFixed(digits);
const snapToGrid = (x) => Math.round(x * 100) / 100;

export function chemHtml(str) {
  if (!str) return '';
  return str
    .replace(/₂/g, '<sub>2</sub>')
    .replace(/₃/g, '<sub>3</sub>')
    .replace(/₄/g, '<sub>4</sub>')
    .replace(/⁻/g, '<sup>−</sup>')
    .replace(/³⁺/g, '<sup>3+</sup>')
    .replace(/⁺/g, '<sup>+</sup>');
}

export function createPanels(left, right, store) {
  left.innerHTML = `
    <div class="brand">PHÒNG THÍ NGHIỆM ẢO · MÔ HÌNH TỈ LỆ</div>
    <h1>Phản ứng<br>theo tỉ lệ mol</h1>
    <p>Kéo lọ thuốc thử tới miệng cốc và giữ để rót. Sản phẩm phụ thuộc vào tỉ lệ T giữa các chất đã thêm.</p>
    <h2>Kịch bản</h2>
    <div class="scenario-list" data-ref="scenarios"></div>
    <h2>Nồng độ (mol/L)</h2>
    <div data-ref="conc"></div>
    <h2>Điều khiển</h2>
    <button data-ref="reset">↺ Làm lại cốc</button>
    <p class="note">Mô hình THPT: phản ứng xảy ra tức thời và hoàn toàn. Nồng độ Ca(OH)₂ mặc định là giả định (nước vôi thực tế ≈ 0,02 M).</p>`;
  right.innerHTML = `
    <h2>Đã thêm vào cốc</h2>
    <div data-ref="meters"></div>
    <div class="t-readout" data-ref="t"></div>
    <div class="brand" data-ref="ratio"></div>
    <div class="region" data-ref="region"></div>
    <h2>Thành phần trong cốc</h2>
    <table class="comp" data-ref="comp"></table>
    <h2>Phương trình</h2>
    <div data-ref="eqs"></div>
    <h2>Đồ thị</h2>
    <canvas id="chart" data-ref="chart"></canvas>`;

  const ref = (root, name) => root.querySelector(`[data-ref="${name}"]`);
  const scenariosEl = ref(left, 'scenarios');
  const concEl = ref(left, 'conc');
  const metersEl = ref(right, 'meters');
  const tEl = ref(right, 't');
  const ratioEl = ref(right, 'ratio');
  const regionEl = ref(right, 'region');
  const compEl = ref(right, 'comp');
  const eqsEl = ref(right, 'eqs');
  const chartCanvas = ref(right, 'chart');
  const chart = createChart(chartCanvas);

  const scenarioButtons = Object.values(SCENARIOS).map((sc) => {
    const btn = document.createElement('button');
    btn.innerHTML = chemHtml(sc.title);
    btn.dataset.id = sc.id;
    btn.addEventListener('click', () => store.setScenario(sc.id));
    scenariosEl.appendChild(btn);
    return btn;
  });
  ref(left, 'reset').addEventListener('click', () => store.reset());

  let meterVals = {};
  let volumeEl = null;
  let lastScenario = null;
  let lastComp = null;
  let lastEqs = null;
  let lastRegion = null;

  function buildScenarioParts(sc, s) {
    concEl.replaceChildren();
    for (const key of sc.reagents.filter((k) => REAGENTS[k].kind === 'liquid')) {
      const row = document.createElement('label');
      row.className = 'row';
      const labelSpan = document.createElement('span');
      labelSpan.innerHTML = chemHtml(REAGENTS[key].label);
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0.01';
      input.step = '0.01';
      input.value = String(s.conc[key]);
      input.setAttribute('aria-label', `Nồng độ ${REAGENTS[key].label}`);
      input.addEventListener('change', () => {
        const v = Number(input.value);
        if (v > 0) store.setConc(key, v);
        else input.value = String(store.get().conc[key]);
      });
      row.append(labelSpan, input);
      concEl.appendChild(row);
    }

    metersEl.replaceChildren();
    meterVals = {};
    for (const key of sc.reagents) {
      const row = document.createElement('div');
      row.className = 'row meter-row';
      const name = document.createElement('span');
      name.innerHTML = chemHtml(REAGENTS[key].label);
      const val = document.createElement('span');
      val.className = 'val';
      const step = (delta) => () => store.set(key, Math.max(0, snapToGrid(store.get().added[key] + delta)));
      const minus = document.createElement('button');
      minus.textContent = '−0.01';
      minus.setAttribute('aria-label', `Giảm ${REAGENTS[key].label} 0.01 mol`);
      minus.addEventListener('click', step(-0.01));
      const plus = document.createElement('button');
      plus.textContent = '+0.01';
      plus.setAttribute('aria-label', `Tăng ${REAGENTS[key].label} 0.01 mol`);
      plus.addEventListener('click', step(0.01));
      row.append(name, minus, val, plus);
      metersEl.appendChild(row);
      meterVals[key] = val;
    }
    volumeEl = document.createElement('div');
    volumeEl.className = 'note';
    metersEl.appendChild(volumeEl);
  }

  function render(s) {
    const sc = SCENARIOS[s.scenarioId];
    if (s.scenarioId !== lastScenario) {
      lastScenario = s.scenarioId;
      buildScenarioParts(sc, s);
      lastComp = lastEqs = null;
    }
    for (const btn of scenarioButtons) btn.classList.toggle('active', btn.dataset.id === s.scenarioId);
    for (const key of sc.reagents) {
      if (meterVals[key]) meterVals[key].textContent = `${fmt(s.added[key])} mol`;
    }
    if (volumeEl) volumeEl.textContent = `Thể tích dung dịch: ${Math.round(s.volumeL * 1000)} mL`;
    tEl.textContent = s.beaker.T === null ? 'T = —' : `T = ${fmt(s.beaker.T, 2)}`;
    ratioEl.innerHTML = chemHtml(sc.ratioLabel);
    const regionHtml = chemHtml(sc.regions[s.beaker.region].label);
    if (regionEl.innerHTML !== regionHtml) regionEl.innerHTML = regionHtml;

    const rows = Object.entries(s.beaker.species).filter(([, n]) => n > 0);
    const compKey = rows.map(([k, n]) => k + fmt(n)).join('|');
    if (compKey !== lastComp) {
      lastComp = compKey;
      compEl.replaceChildren(
        ...(rows.length ? rows : [['—', null]]).map(([k, n]) => {
          const tr = document.createElement('tr');
          const a = document.createElement('td');
          const b = document.createElement('td');
          if (n === null) {
            a.textContent = '—';
            b.textContent = '';
          } else {
            a.innerHTML = chemHtml(SPECIES_LABELS[k] || k);
            b.textContent = `${fmt(n)} mol`;
          }
          tr.append(a, b);
          return tr;
        }),
      );
    }
    const eqKey = s.beaker.equations.join('|');
    if (eqKey !== lastEqs) {
      lastEqs = eqKey;
      eqsEl.replaceChildren(
        ...(s.beaker.equations.length ? s.beaker.equations : ['—']).map((eq) => {
          const div = document.createElement('div');
          div.className = 'eq';
          div.innerHTML = eq === '—' ? '—' : chemHtml(eq);
          return div;
        }),
      );
    }
    if (s.beaker.region !== lastRegion && lastRegion !== null) {
      regionEl.animate([{ backgroundColor: 'rgba(122, 63, 92, 0.22)' }, { backgroundColor: 'rgba(122, 63, 92, 0)' }], { duration: 900, easing: 'ease-out' });
    }
    lastRegion = s.beaker.region;
    chart.draw(s);
  }

  // The store emits every frame while pouring; coalesce DOM updates to ~15 Hz.
  let pending = null;
  let lastRun = 0;
  function schedule(s) {
    if (pending) { pending = s; return; }
    pending = s;
    const wait = Math.max(0, 66 - (performance.now() - lastRun));
    setTimeout(() => {
      lastRun = performance.now();
      const next = pending;
      pending = null;
      render(next);
    }, wait);
  }

  store.subscribe(schedule);
  render(store.get());
}
