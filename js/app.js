/* Multiband Compression — app glue
 * Tab switching, widget rendering, playground wiring, visualizations.
 */
(function () {
  'use strict';

  // =========================================================
  // Tabs
  // =========================================================
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.panel');
  let quizRendered = false;
  let challengeRendered = false;

  function activateTab(name) {
    tabs.forEach(t => {
      const active = t.dataset.tab === name;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    panels.forEach(p => p.classList.toggle('active', p.id === name));
    if (name === 'quiz' && !quizRendered) {
      window.Quiz.render(document.getElementById('quiz-root'));
      quizRendered = true;
    }
    if (name === 'challenge' && !challengeRendered) {
      window.Challenge.render(document.getElementById('challenge-root'));
      challengeRendered = true;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  tabs.forEach(t => t.addEventListener('click', () => activateTab(t.dataset.tab)));
  document.querySelectorAll('[data-go]').forEach(el => {
    el.addEventListener('click', () => activateTab(el.dataset.go));
  });

  // =========================================================
  // Helpers
  // =========================================================
  function bindNumber(input, formatter) {
    const numEl = document.querySelector(`.num[data-for="${input.id}"]`);
    const update = () => { if (numEl) numEl.textContent = formatter(parseFloat(input.value)); };
    input.addEventListener('input', update);
    update();
  }
  const fmtDb = v => `${v >= 0 ? '+' : ''}${v.toFixed(1)} dB`;
  const fmtRatio = v => `${v.toFixed(1)}:1`;
  const fmtHz = v => v >= 1000 ? `${(v / 1000).toFixed(2)} kHz` : `${Math.round(v)} Hz`;
  const fmtMs = v => `${(v * 1000).toFixed(0)} ms`;

  // =========================================================
  // Refresher: threshold/ratio transfer curve
  // =========================================================
  (function refresher() {
    const thr = document.getElementById('ref-thresh');
    const rat = document.getElementById('ref-ratio');
    const canvas = document.getElementById('refresher-canvas');
    if (!thr || !rat || !canvas) return;
    const ctx = canvas.getContext('2d');

    // Tune numeric display
    bindNumber(thr, v => `${v.toFixed(1)} dB`);
    bindNumber(rat, fmtRatio);

    function draw() {
      const W = canvas.width, H = canvas.height;
      ctx.fillStyle = '#0b0f14';
      ctx.fillRect(0, 0, W, H);

      const pad = 28;
      const x0 = pad, y0 = H - pad, x1 = W - pad, y1 = pad;
      // dB range
      const dbMin = -60, dbMax = 0;
      const xOf = db => x0 + (db - dbMin) / (dbMax - dbMin) * (x1 - x0);
      const yOf = db => y0 - (db - dbMin) / (dbMax - dbMin) * (y0 - y1);

      // Grid
      ctx.strokeStyle = '#232a33';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let db = -60; db <= 0; db += 10) {
        const x = xOf(db); ctx.moveTo(x, y0); ctx.lineTo(x, y1);
        const y = yOf(db); ctx.moveTo(x0, y); ctx.lineTo(x1, y);
      }
      ctx.stroke();

      // Axes labels
      ctx.fillStyle = '#8b949e';
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillText('Input (dB)', x1 - 60, y0 + 16);
      ctx.save();
      ctx.translate(x0 - 10, y1 + 60);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('Output (dB)', 0, 0);
      ctx.restore();
      for (let db = -60; db <= 0; db += 20) {
        ctx.fillText(`${db}`, xOf(db) - 8, y0 + 14);
        ctx.fillText(`${db}`, x0 - 22, yOf(db) + 3);
      }

      // Identity line (no compression)
      ctx.strokeStyle = '#444';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.setLineDash([]);

      // Transfer curve
      const T = parseFloat(thr.value);
      const R = parseFloat(rat.value);
      ctx.strokeStyle = '#f78166';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let db = dbMin; db <= dbMax; db += 0.5) {
        const out = db <= T ? db : T + (db - T) / R;
        const px = xOf(db), py = yOf(out);
        if (db === dbMin) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Threshold marker
      const tx = xOf(T);
      ctx.strokeStyle = '#58a6ff';
      ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(tx, y0); ctx.lineTo(tx, y1); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#58a6ff';
      ctx.fillText(`Threshold ${T.toFixed(0)} dB`, tx + 4, y1 + 12);
    }

    thr.addEventListener('input', draw);
    rat.addEventListener('input', draw);
    draw();
  })();

  // =========================================================
  // Crossover widget (guided tab)
  // =========================================================
  (function crossover() {
    const low = document.getElementById('xo-low');
    const high = document.getElementById('xo-high');
    const canvas = document.getElementById('crossover-canvas');
    if (!low || !high || !canvas) return;
    const ctx = canvas.getContext('2d');

    bindNumber(low, fmtHz);
    bindNumber(high, fmtHz);

    const F_MIN = 20, F_MAX = 20000;
    const xOf = f => {
      const lo = Math.log10(F_MIN), hi = Math.log10(F_MAX);
      return 28 + (Math.log10(f) - lo) / (hi - lo) * (canvas.width - 56);
    };

    function draw() {
      const W = canvas.width, H = canvas.height;
      ctx.fillStyle = '#0b0f14';
      ctx.fillRect(0, 0, W, H);

      const xl = parseFloat(low.value);
      const xh = parseFloat(high.value);

      // Shaded band regions
      const top = 10, bot = H - 28;
      const regions = [
        { color: 'rgba(248,81,73,0.18)', x1: xOf(F_MIN), x2: xOf(xl) },
        { color: 'rgba(63,185,80,0.18)', x1: xOf(xl),    x2: xOf(xh) },
        { color: 'rgba(88,166,255,0.18)', x1: xOf(xh),   x2: xOf(F_MAX) },
      ];
      regions.forEach(r => { ctx.fillStyle = r.color; ctx.fillRect(r.x1, top, r.x2 - r.x1, bot - top); });

      // Frequency ticks
      ctx.strokeStyle = '#232a33';
      ctx.fillStyle = '#8b949e';
      ctx.font = '11px ui-monospace, monospace';
      ctx.lineWidth = 1;
      const ticks = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
      ticks.forEach(f => {
        const x = xOf(f);
        ctx.beginPath(); ctx.moveTo(x, bot); ctx.lineTo(x, bot + 4); ctx.stroke();
        const label = f >= 1000 ? `${f/1000}k` : `${f}`;
        ctx.fillText(label, x - 9, bot + 16);
      });

      // Decorative "spectrum" curve
      ctx.strokeStyle = 'rgba(230,237,243,0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let f = F_MIN; f <= F_MAX; f *= 1.03) {
        // Faux spectrum: bump at 80, dip at 400, bump at 3k, slope off
        const y = bot - (
          22 * Math.exp(-Math.pow(Math.log(f/80), 2) / 0.6) +
          18 * Math.exp(-Math.pow(Math.log(f/2500), 2) / 1.1) +
          12 * Math.exp(-Math.pow(Math.log(f/10000), 2) / 1.5)
        );
        const x = xOf(f);
        if (f === F_MIN) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Crossover lines + labels
      [['LOW/MID', xl, '#f85149'], ['MID/HIGH', xh, '#58a6ff']].forEach(([label, f, color]) => {
        const x = xOf(f);
        ctx.strokeStyle = color;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bot); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        ctx.fillText(`${label}  ${fmtHz(f)}`, x + 4, top + 12);
      });

      // Band names
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.fillStyle = '#f85149'; ctx.fillText('LOW',  (xOf(F_MIN) + xOf(xl)) / 2 - 14, bot - 8);
      ctx.fillStyle = '#3fb950'; ctx.fillText('MID',  (xOf(xl) + xOf(xh)) / 2 - 14, bot - 8);
      ctx.fillStyle = '#58a6ff'; ctx.fillText('HIGH', (xOf(xh) + xOf(F_MAX)) / 2 - 16, bot - 8);
    }

    low.addEventListener('input', () => {
      if (parseFloat(low.value) >= parseFloat(high.value)) low.value = parseFloat(high.value) - 50;
      draw();
    });
    high.addEventListener('input', () => {
      if (parseFloat(high.value) <= parseFloat(low.value)) high.value = parseFloat(low.value) + 50;
      draw();
    });
    draw();
  })();

  // =========================================================
  // Playground — band strips
  // =========================================================
  const BANDS = [
    { name: 'low',  label: 'Low Band',  color: 'var(--low)'  },
    { name: 'mid',  label: 'Mid Band',  color: 'var(--mid)'  },
    { name: 'high', label: 'High Band', color: 'var(--high)' },
  ];

  const BAND_CONTROLS = [
    { key: 'threshold', label: 'Threshold', min: -60, max: 0,   step: 0.5, def: -24, fmt: v => `${v.toFixed(1)} dB` },
    { key: 'ratio',     label: 'Ratio',     min: 1,   max: 20,  step: 0.1, def: 2,   fmt: fmtRatio },
    { key: 'attack',    label: 'Attack',    min: 0.0005, max: 0.3, step: 0.0005, def: 0.01, fmt: fmtMs },
    { key: 'release',   label: 'Release',   min: 0.02, max: 1.5,  step: 0.01, def: 0.15, fmt: fmtMs },
    { key: 'makeup',    label: 'Makeup',    min: -12, max: 24,  step: 0.1, def: 0,   fmt: fmtDb },
  ];

  const bandEls = {}; // { low: { sliders, grFill, grValue, soloBtn, muteBtn }, ... }

  function buildBandStrips() {
    const container = document.getElementById('bands');
    container.innerHTML = '';
    BANDS.forEach(({ name, label }) => {
      const strip = document.createElement('div');
      strip.className = 'band-strip';
      strip.dataset.band = name;

      const h = document.createElement('h3');
      h.textContent = label;
      strip.appendChild(h);

      const range = document.createElement('div');
      range.className = 'range';
      range.dataset.bandRange = name;
      strip.appendChild(range);

      const controls = document.createElement('div');
      controls.className = 'band-controls';
      const sliders = {};
      BAND_CONTROLS.forEach(cfg => {
        const lab = document.createElement('label');
        lab.innerHTML = `${cfg.label} <span class="num">${cfg.fmt(cfg.def)}</span>`;
        const input = document.createElement('input');
        input.type = 'range';
        input.min = cfg.min; input.max = cfg.max; input.step = cfg.step; input.value = cfg.def;
        lab.appendChild(input);
        controls.appendChild(lab);
        const numEl = lab.querySelector('.num');
        input.addEventListener('input', () => {
          const v = parseFloat(input.value);
          numEl.textContent = cfg.fmt(v);
          const mbc = window.Engine.getMBC();
          if (mbc) mbc.setBand(name, cfg.key, v);
        });
        sliders[cfg.key] = input;
      });
      strip.appendChild(controls);

      const meta = document.createElement('div');
      meta.className = 'band-meta';
      const toggles = document.createElement('div');
      toggles.className = 'band-toggles';
      const soloBtn = document.createElement('button');
      soloBtn.textContent = 'S';
      soloBtn.title = 'Solo this band';
      soloBtn.addEventListener('click', () => {
        const mbc = window.Engine.getMBC();
        if (!mbc) return;
        const newSolo = mbc.toggleSolo(name);
        Object.keys(bandEls).forEach(k => {
          bandEls[k].soloBtn.classList.toggle('on', newSolo === k);
        });
      });
      const muteBtn = document.createElement('button');
      muteBtn.textContent = 'M';
      muteBtn.title = 'Mute this band';
      muteBtn.addEventListener('click', () => {
        const mbc = window.Engine.getMBC();
        if (!mbc) return;
        const on = !muteBtn.classList.contains('on');
        muteBtn.classList.toggle('on', on);
        mbc.setMute(name, on);
      });
      toggles.appendChild(soloBtn); toggles.appendChild(muteBtn);
      meta.appendChild(toggles);

      const grWrap = document.createElement('div');
      grWrap.style.display = 'flex'; grWrap.style.alignItems = 'center'; grWrap.style.flex = '1';
      const grLabel = document.createElement('span');
      grLabel.style.fontSize = '11px';
      grLabel.style.color = 'var(--muted)';
      grLabel.style.fontFamily = 'var(--mono)';
      grLabel.textContent = 'GR';
      grLabel.style.marginLeft = '10px';
      const meter = document.createElement('div');
      meter.className = 'gr-meter';
      const grFill = document.createElement('div');
      grFill.className = 'gr-fill';
      meter.appendChild(grFill);
      const grValue = document.createElement('span');
      grValue.className = 'gr-value';
      grValue.textContent = '0.0 dB';
      grWrap.appendChild(grLabel);
      grWrap.appendChild(meter);
      grWrap.appendChild(grValue);
      meta.appendChild(grWrap);
      strip.appendChild(meta);

      container.appendChild(strip);
      bandEls[name] = { sliders, grFill, grValue, soloBtn, muteBtn, rangeEl: range };
    });
  }
  buildBandStrips();

  // =========================================================
  // Transport wiring
  // =========================================================
  const demoSelect = document.getElementById('demo-select');
  const playBtn    = document.getElementById('play-btn');
  const stopBtn    = document.getElementById('stop-btn');
  const loopChk    = document.getElementById('loop-chk');
  const bypassChk  = document.getElementById('bypass-chk');
  const outGain    = document.getElementById('out-gain');
  const fileBtn    = document.getElementById('file-btn');
  const fileInput  = document.getElementById('file-input');

  bindNumber(outGain, fmtDb);

  let isPlaying = false;
  async function handlePlay() {
    const src = demoSelect.value;
    const res = await window.Engine.play(src);
    if (!res.ok) {
      if (res.err === 'no-file') {
        alert('No file loaded yet — click Upload first.');
      }
      return;
    }
    isPlaying = true;
    playBtn.textContent = '⏸ Pause';
  }
  function handleStop() {
    window.Engine.stop();
    isPlaying = false;
    playBtn.textContent = '▶ Play';
  }
  playBtn.addEventListener('click', () => {
    if (isPlaying) handleStop(); else handlePlay();
  });
  stopBtn.addEventListener('click', handleStop);
  loopChk.addEventListener('change', () => window.Engine.setLoop(loopChk.checked));
  bypassChk.addEventListener('change', () => {
    const mbc = window.Engine.getMBC();
    if (mbc) mbc.setBypass(bypassChk.checked);
  });
  outGain.addEventListener('input', () => window.Engine.setOutputGainDb(parseFloat(outGain.value)));
  demoSelect.addEventListener('change', () => {
    if (isPlaying) handlePlay(); // switch source while playing
  });
  fileBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await window.Engine.loadFile(file);
      demoSelect.value = 'file';
      alert(`Loaded "${file.name}". Hit Play.`);
    } catch (err) {
      alert('Could not decode that file. Try a WAV or MP3.');
      console.error(err);
    }
  });

  // =========================================================
  // Playground crossovers
  // =========================================================
  const pgXoLow  = document.getElementById('pg-xo-low');
  const pgXoHigh = document.getElementById('pg-xo-high');
  bindNumber(pgXoLow, fmtHz);
  bindNumber(pgXoHigh, fmtHz);

  function applyCrossovers() {
    let lo = parseFloat(pgXoLow.value);
    let hi = parseFloat(pgXoHigh.value);
    if (hi <= lo) { hi = lo + 50; pgXoHigh.value = hi; }
    const mbc = window.Engine.getMBC();
    if (mbc) mbc.setCrossovers(lo, hi);
    bandEls.low.rangeEl.textContent  = `< ${fmtHz(lo)}`;
    bandEls.mid.rangeEl.textContent  = `${fmtHz(lo)} – ${fmtHz(hi)}`;
    bandEls.high.rangeEl.textContent = `> ${fmtHz(hi)}`;
  }
  pgXoLow.addEventListener('input', applyCrossovers);
  pgXoHigh.addEventListener('input', applyCrossovers);

  // =========================================================
  // Presets
  // =========================================================
  const PRESETS = {
    reset: {
      xo: [150, 3000],
      bands: {
        low:  { threshold: -24, ratio: 1, attack: 0.01, release: 0.15, makeup: 0 },
        mid:  { threshold: -24, ratio: 1, attack: 0.01, release: 0.15, makeup: 0 },
        high: { threshold: -24, ratio: 1, attack: 0.01, release: 0.15, makeup: 0 },
      },
    },
    subtle: {
      xo: [180, 2500],
      bands: {
        low:  { threshold: -20, ratio: 1.8, attack: 0.03,  release: 0.25, makeup: 0.5 },
        mid:  { threshold: -20, ratio: 1.6, attack: 0.025, release: 0.2,  makeup: 0.5 },
        high: { threshold: -22, ratio: 1.8, attack: 0.015, release: 0.15, makeup: 0.8 },
      },
    },
    bass: {
      xo: [150, 3000],
      bands: {
        low:  { threshold: -22, ratio: 4,   attack: 0.01,  release: 0.12, makeup: 0 },
        mid:  { threshold: -24, ratio: 1,   attack: 0.02,  release: 0.15, makeup: 0 },
        high: { threshold: -24, ratio: 1,   attack: 0.02,  release: 0.15, makeup: 0 },
      },
    },
    deess: {
      xo: [200, 5500],
      bands: {
        low:  { threshold: -24, ratio: 1,   attack: 0.02,  release: 0.15, makeup: 0 },
        mid:  { threshold: -24, ratio: 1,   attack: 0.02,  release: 0.15, makeup: 0 },
        high: { threshold: -28, ratio: 8,   attack: 0.001, release: 0.08, makeup: 0 },
      },
    },
    aggro: {
      xo: [180, 3500],
      bands: {
        low:  { threshold: -28, ratio: 6, attack: 0.003, release: 0.08, makeup: 2 },
        mid:  { threshold: -26, ratio: 5, attack: 0.004, release: 0.1,  makeup: 1.5 },
        high: { threshold: -28, ratio: 6, attack: 0.002, release: 0.07, makeup: 2 },
      },
    },
  };

  function applyPreset(name) {
    const p = PRESETS[name];
    if (!p) return;
    pgXoLow.value = p.xo[0];
    pgXoHigh.value = p.xo[1];
    pgXoLow.dispatchEvent(new Event('input'));
    pgXoHigh.dispatchEvent(new Event('input'));
    applyCrossovers();
    BANDS.forEach(({ name: bn }) => {
      const cfg = p.bands[bn];
      Object.entries(cfg).forEach(([k, v]) => {
        const slider = bandEls[bn].sliders[k];
        slider.value = v;
        slider.dispatchEvent(new Event('input'));
      });
    });
  }
  document.querySelectorAll('.btn.preset').forEach(btn => {
    btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
  });

  // Initialize band range labels
  applyCrossovers();

  // =========================================================
  // Spectrum drawing + GR meter polling
  // =========================================================
  const specCanvas = document.getElementById('spectrum');
  const specCtx = specCanvas.getContext('2d');

  function drawLoop() {
    requestAnimationFrame(drawLoop);
    const analyser = window.Engine.getAnalyser();
    const W = specCanvas.width, H = specCanvas.height;
    specCtx.fillStyle = '#0b0f14';
    specCtx.fillRect(0, 0, W, H);

    // Crossover shading
    const lo = parseFloat(pgXoLow.value), hi = parseFloat(pgXoHigh.value);
    const F_MIN = 20, F_MAX = 20000;
    const lx = v => {
      const vlo = Math.log10(F_MIN), vhi = Math.log10(F_MAX);
      return (Math.log10(v) - vlo) / (vhi - vlo) * W;
    };
    specCtx.fillStyle = 'rgba(248,81,73,0.09)';
    specCtx.fillRect(0, 0, lx(lo), H);
    specCtx.fillStyle = 'rgba(63,185,80,0.09)';
    specCtx.fillRect(lx(lo), 0, lx(hi) - lx(lo), H);
    specCtx.fillStyle = 'rgba(88,166,255,0.09)';
    specCtx.fillRect(lx(hi), 0, W - lx(hi), H);

    // Grid
    specCtx.strokeStyle = '#1f262e';
    specCtx.lineWidth = 1;
    const ticks = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
    specCtx.fillStyle = '#8b949e';
    specCtx.font = '10px ui-monospace, monospace';
    ticks.forEach(f => {
      const x = lx(f);
      specCtx.beginPath(); specCtx.moveTo(x, 0); specCtx.lineTo(x, H); specCtx.stroke();
      const lbl = f >= 1000 ? `${f/1000}k` : `${f}`;
      specCtx.fillText(lbl, x + 2, H - 3);
    });

    // Crossover lines
    [[lo, '#f85149'], [hi, '#58a6ff']].forEach(([f, color]) => {
      const x = lx(f);
      specCtx.strokeStyle = color;
      specCtx.setLineDash([4, 4]);
      specCtx.beginPath(); specCtx.moveTo(x, 0); specCtx.lineTo(x, H); specCtx.stroke();
      specCtx.setLineDash([]);
    });

    // Spectrum trace
    if (analyser) {
      const N = analyser.frequencyBinCount;
      const data = new Uint8Array(N);
      analyser.getByteFrequencyData(data);
      const sr = window.Engine.getContext().sampleRate;
      const binHz = sr / 2 / N;
      specCtx.strokeStyle = '#e6edf3';
      specCtx.lineWidth = 1.5;
      specCtx.beginPath();
      let first = true;
      for (let i = 1; i < N; i++) {
        const f = i * binHz;
        if (f < F_MIN || f > F_MAX) continue;
        const x = lx(f);
        const y = H - (data[i] / 255) * H * 0.95;
        if (first) { specCtx.moveTo(x, y); first = false; }
        else specCtx.lineTo(x, y);
      }
      specCtx.stroke();
    }

    // GR meters
    const mbc = window.Engine.getMBC();
    if (mbc) {
      for (const name of ['low', 'mid', 'high']) {
        const gr = mbc.getReduction(name); // negative dB, or 0
        const mag = Math.min(20, -gr);     // 0..20
        const pct = (mag / 20) * 100;
        bandEls[name].grFill.style.width = pct + '%';
        bandEls[name].grValue.textContent = `${gr.toFixed(1)} dB`;
      }
    }
  }
  // Kick off once engine may or may not be initialized; analyser-null is handled.
  requestAnimationFrame(drawLoop);

  // Resize canvases for crispness (DPR-aware) on load + resize
  function dprFix(c) {
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    if (rect.width > 0) {
      c.width = Math.floor(rect.width * ratio);
      c.height = Math.floor(parseInt(c.getAttribute('height') || rect.height, 10) * ratio);
      const cctx = c.getContext('2d');
      cctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
  }
  // Keep it simple: rely on CSS width: 100%; explicit canvas width/height in HTML attributes.
})();
