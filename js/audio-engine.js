/* Multiband Compression — audio engine
 * Uses raw Web Audio API for the compressor (educational) and Tone.js for demo synthesis.
 */

(function () {
  'use strict';

  // =========================================================
  // MultibandCompressor: 3-band LR4 crossover + per-band comp
  // =========================================================
  class MultibandCompressor {
    constructor(ctx) {
      this.ctx = ctx;
      this.input = ctx.createGain();
      this.output = ctx.createGain();

      // Dry / wet routing so bypass is a clean A/B
      this.dry = ctx.createGain();
      this.wet = ctx.createGain();
      this.dry.gain.value = 0;
      this.wet.gain.value = 1;
      this.input.connect(this.dry);
      this.dry.connect(this.output);
      this.wet.connect(this.output);

      this.soloBand = null;
      this.bands = {
        low:  this._buildBand('low'),
        mid:  this._buildBand('mid'),
        high: this._buildBand('high'),
      };

      for (const name of ['low', 'mid', 'high']) {
        const b = this.bands[name];
        this.input.connect(b.filters[0]);
        b.soloGain.connect(this.wet);
      }

      this.setCrossovers(150, 3000);
    }

    _biquad(type, freq) {
      const f = this.ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = 0.7071; // Butterworth; two cascaded = Linkwitz-Riley 4th order
      return f;
    }

    _buildBand(name) {
      const ctx = this.ctx;
      const filters = [];
      if (name === 'low') {
        filters.push(this._biquad('lowpass', 150));
        filters.push(this._biquad('lowpass', 150));
      } else if (name === 'mid') {
        filters.push(this._biquad('highpass', 150));
        filters.push(this._biquad('highpass', 150));
        filters.push(this._biquad('lowpass', 3000));
        filters.push(this._biquad('lowpass', 3000));
      } else {
        filters.push(this._biquad('highpass', 3000));
        filters.push(this._biquad('highpass', 3000));
      }
      for (let i = 0; i < filters.length - 1; i++) filters[i].connect(filters[i + 1]);

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -24;
      comp.ratio.value = 2;
      comp.attack.value = 0.01;
      comp.release.value = 0.15;
      comp.knee.value = 12;

      const makeup = ctx.createGain();
      makeup.gain.value = 1;

      const soloGain = ctx.createGain();
      soloGain.gain.value = 1;

      filters[filters.length - 1].connect(comp);
      comp.connect(makeup);
      makeup.connect(soloGain);

      // LR4 mid-band is inverted relative to lo+hi sum. Correct with a -1 gain
      // on the mid band so bypassed MBC sums flat. (Implemented in caller.)
      if (name === 'mid') {
        const inv = ctx.createGain();
        inv.gain.value = -1;
        makeup.disconnect();
        makeup.connect(inv);
        inv.connect(soloGain);
      }

      return { filters, comp, makeup, soloGain, muted: false };
    }

    setCrossovers(low, high) {
      if (high <= low) high = low + 50;
      this._xoLow = low;
      this._xoHigh = high;
      this.bands.low.filters.forEach(f => f.frequency.setTargetAtTime(low, this.ctx.currentTime, 0.01));
      this.bands.mid.filters[0].frequency.setTargetAtTime(low, this.ctx.currentTime, 0.01);
      this.bands.mid.filters[1].frequency.setTargetAtTime(low, this.ctx.currentTime, 0.01);
      this.bands.mid.filters[2].frequency.setTargetAtTime(high, this.ctx.currentTime, 0.01);
      this.bands.mid.filters[3].frequency.setTargetAtTime(high, this.ctx.currentTime, 0.01);
      this.bands.high.filters.forEach(f => f.frequency.setTargetAtTime(high, this.ctx.currentTime, 0.01));
    }

    setBand(name, param, value) {
      const b = this.bands[name];
      if (!b) return;
      const t = this.ctx.currentTime;
      switch (param) {
        case 'threshold': b.comp.threshold.setTargetAtTime(value, t, 0.01); break;
        case 'ratio':     b.comp.ratio.setTargetAtTime(value, t, 0.01); break;
        case 'attack':    b.comp.attack.setTargetAtTime(value, t, 0.01); break;
        case 'release':   b.comp.release.setTargetAtTime(value, t, 0.01); break;
        case 'makeup':    b.makeup.gain.setTargetAtTime(Math.pow(10, value / 20), t, 0.01); break;
      }
    }

    setBypass(on) {
      const t = this.ctx.currentTime;
      this.wet.gain.setTargetAtTime(on ? 0 : 1, t, 0.01);
      this.dry.gain.setTargetAtTime(on ? 1 : 0, t, 0.01);
    }

    setMute(name, muted) {
      this.bands[name].muted = muted;
      this._applyMuteSolo();
    }

    toggleSolo(name) {
      this.soloBand = (this.soloBand === name) ? null : name;
      this._applyMuteSolo();
      return this.soloBand;
    }

    _applyMuteSolo() {
      const t = this.ctx.currentTime;
      for (const name of ['low', 'mid', 'high']) {
        const b = this.bands[name];
        let on;
        if (this.soloBand) on = (this.soloBand === name);
        else on = !b.muted;
        b.soloGain.gain.setTargetAtTime(on ? 1 : 0, t, 0.005);
      }
    }

    getReduction(name) {
      const c = this.bands[name].comp;
      // .reduction is a number in the current spec; older browsers exposed an AudioParam
      return typeof c.reduction === 'number' ? c.reduction : c.reduction.value;
    }
  }

  // =========================================================
  // Engine: context, routing, demo playback
  // =========================================================
  let ctx = null;
  let inputBus = null;
  let mbc = null;
  let outputGain = null;
  let analyser = null;
  let fileBuffer = null;
  let currentSource = null; // for file buffer playback
  let currentDemoKey = null;
  let currentDemoInst = null;
  let loopEnabled = true;
  let initialized = false;

  async function init() {
    if (initialized) return;
    await Tone.start();
    ctx = Tone.getContext().rawContext;
    inputBus = ctx.createGain();
    mbc = new MultibandCompressor(ctx);
    outputGain = ctx.createGain();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.7;

    inputBus.connect(mbc.input);
    mbc.output.connect(outputGain);
    outputGain.connect(analyser);
    analyser.connect(ctx.destination);

    initialized = true;
  }

  // ---------- Demo factories ----------
  function makeDrumsDemo() {
    let kick, snare, hat, kickPart, snarePart, hatSeq;
    return {
      start() {
        Tone.Transport.bpm.value = 100;
        kick = new Tone.MembraneSynth({
          octaves: 6, pitchDecay: 0.05,
          envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.4 }
        });
        kick.volume.value = -4;
        snare = new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: { attack: 0.001, decay: 0.18, sustain: 0 }
        });
        snare.volume.value = -10;
        hat = new Tone.MetalSynth({
          envelope: { attack: 0.001, decay: 0.04, release: 0.01 },
          harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5
        });
        hat.volume.value = -26;

        const destNative = inputBus;
        kick.connect(destNative);
        snare.connect(destNative);
        hat.connect(destNative);

        kickPart = new Tone.Part((t) => kick.triggerAttackRelease('C1', '8n', t),
          [0, '0:2', '0:2:2']).start(0);
        kickPart.loop = true; kickPart.loopEnd = '1m';

        snarePart = new Tone.Part((t) => snare.triggerAttackRelease('16n', t),
          ['0:1', '0:3']).start(0);
        snarePart.loop = true; snarePart.loopEnd = '1m';

        hatSeq = new Tone.Sequence((t) => hat.triggerAttackRelease('32n', t),
          [null, 'x', null, 'x', null, 'x', null, 'x'], '8n').start(0);

        Tone.Transport.start();
      },
      stop() {
        try { kickPart?.dispose(); snarePart?.dispose(); hatSeq?.dispose(); } catch (e) {}
        try { kick?.dispose(); snare?.dispose(); hat?.dispose(); } catch (e) {}
      }
    };
  }

  function makeMixDemo() {
    let drums, bass, pad, parts = [];
    return {
      start() {
        Tone.Transport.bpm.value = 92;
        drums = makeDrumsDemo();
        drums.start();

        bass = new Tone.MonoSynth({
          oscillator: { type: 'sawtooth' },
          filter: { Q: 2, rolloff: -24 },
          envelope: { attack: 0.02, decay: 0.2, sustain: 0.6, release: 0.2 },
          filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.4, baseFrequency: 120, octaves: 2.2 }
        });
        bass.volume.value = -8;
        bass.connect(inputBus);
        const bassLine = ['C2', 'C2', 'G1', 'A#1', 'F1', 'F1', 'G1', 'C2'];
        const bassPart = new Tone.Sequence((t, n) => bass.triggerAttackRelease(n, '8n', t), bassLine, '4n').start(0);
        parts.push(bassPart);

        pad = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'sawtooth' },
          envelope: { attack: 0.5, decay: 0.3, sustain: 0.5, release: 1.2 }
        });
        pad.volume.value = -18;
        const padFilter = new Tone.Filter(1200, 'lowpass');
        pad.connect(padFilter);
        padFilter.connect(inputBus);
        const chord = ['C3', 'Eb3', 'G3'];
        const padPart = new Tone.Sequence((t) => pad.triggerAttackRelease(chord, '1m', t), [0], '1m').start(0);
        parts.push(padPart);

        Tone.Transport.start();
      },
      stop() {
        try { drums?.stop(); } catch(e){}
        parts.forEach(p => { try { p.dispose(); } catch(e){} });
        parts = [];
        try { bass?.dispose(); pad?.dispose(); } catch(e){}
      }
    };
  }

  function makeBassDemo() {
    let sub, pad, parts = [];
    return {
      start() {
        Tone.Transport.bpm.value = 86;
        sub = new Tone.MonoSynth({
          oscillator: { type: 'sine' },
          envelope: { attack: 0.02, decay: 0.3, sustain: 0.7, release: 0.3 },
          filter: { Q: 1, frequency: 400 }
        });
        sub.volume.value = -2;
        sub.connect(inputBus);

        // Intentionally uneven bass line so some notes poke out louder
        const line = [
          { note: 'C1', vel: 0.6 },
          { note: 'C1', vel: 1.0 },
          { note: 'G1', vel: 0.5 },
          { note: 'C2', vel: 0.4 },
          { note: 'F1', vel: 1.0 },
          { note: 'F1', vel: 0.6 },
          { note: 'G1', vel: 0.9 },
          { note: 'C1', vel: 0.5 },
        ];
        const bassPart = new Tone.Sequence((t, ev) => {
          sub.triggerAttackRelease(ev.note, '4n', t, ev.vel);
        }, line, '4n').start(0);
        parts.push(bassPart);

        pad = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.3, decay: 0.4, sustain: 0.4, release: 1.0 }
        });
        pad.volume.value = -22;
        const lp = new Tone.Filter(1800, 'lowpass');
        pad.connect(lp); lp.connect(inputBus);
        const padPart = new Tone.Sequence((t) => pad.triggerAttackRelease(['C4','Eb4','G4'], '2n', t), [0, '0:2'], '2n').start(0);
        parts.push(padPart);

        Tone.Transport.start();
      },
      stop() {
        parts.forEach(p => { try { p.dispose(); } catch(e){} });
        parts = [];
        try { sub?.dispose(); pad?.dispose(); } catch(e){}
      }
    };
  }

  function makeVocalDemo() {
    let voice, siss, hatLite, parts = [];
    return {
      start() {
        Tone.Transport.bpm.value = 96;

        // Pseudo-vocal: slightly bright saw through LP filter w/ formant-ish wobble
        voice = new Tone.MonoSynth({
          oscillator: { type: 'sawtooth' },
          envelope: { attack: 0.03, decay: 0.15, sustain: 0.6, release: 0.25 },
          filter: { Q: 4, rolloff: -12 },
          filterEnvelope: { attack: 0.05, decay: 0.15, sustain: 0.7, release: 0.3, baseFrequency: 700, octaves: 1.6 }
        });
        voice.volume.value = -8;
        voice.connect(inputBus);
        const vibrato = new Tone.LFO(5, 690, 730).start();
        vibrato.connect(voice.filter.frequency);

        const melody = ['E4', 'G4', 'A4', 'G4', 'E4', 'D4', 'E4', 'G4', 'A4', 'B4', 'A4', 'G4'];
        const melPart = new Tone.Sequence((t, n) => voice.triggerAttackRelease(n, '8n', t), melody, '8n').start(0);
        parts.push(melPart);

        // Sibilance — noise burst filtered high. Intentionally HARSH.
        siss = new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: { attack: 0.002, decay: 0.08, sustain: 0 }
        });
        siss.volume.value = -3;
        const hp = new Tone.Filter(6000, 'highpass');
        hp.Q.value = 1;
        siss.connect(hp); hp.connect(inputBus);
        const sissPart = new Tone.Sequence((t, hit) => {
          if (hit) siss.triggerAttackRelease('16n', t);
        }, [null, 'x', null, null, 'x', null, 'x', null], '8n').start(0);
        parts.push(sissPart);

        Tone.Transport.start();
      },
      stop() {
        parts.forEach(p => { try { p.dispose(); } catch(e){} });
        parts = [];
        try { voice?.dispose(); siss?.dispose(); } catch(e){}
      }
    };
  }

  const DEMO_FACTORIES = {
    drums: makeDrumsDemo,
    mix:   makeMixDemo,
    bass:  makeBassDemo,
    vocal: makeVocalDemo,
  };

  function stopCurrent() {
    if (currentDemoInst) {
      try { currentDemoInst.stop(); } catch (e) {}
      currentDemoInst = null;
    }
    try { Tone.Transport.stop(); } catch (e) {}
    try { Tone.Transport.cancel(0); } catch (e) {}
    Tone.Transport.position = 0;

    if (currentSource) {
      try { currentSource.stop(); } catch (e) {}
      try { currentSource.disconnect(); } catch (e) {}
      currentSource = null;
    }
    currentDemoKey = null;
  }

  async function play(sourceKey) {
    await init();
    stopCurrent();
    if (sourceKey === 'file') {
      if (!fileBuffer) return { ok: false, err: 'no-file' };
      currentSource = ctx.createBufferSource();
      currentSource.buffer = fileBuffer;
      currentSource.loop = loopEnabled;
      currentSource.connect(inputBus);
      currentSource.start();
      currentDemoKey = 'file';
      return { ok: true };
    }
    const f = DEMO_FACTORIES[sourceKey];
    if (!f) return { ok: false, err: 'unknown-demo' };
    currentDemoInst = f();
    currentDemoInst.start();
    currentDemoKey = sourceKey;
    return { ok: true };
  }

  function stop() { stopCurrent(); }

  function setLoop(on) {
    loopEnabled = !!on;
    if (currentSource) currentSource.loop = loopEnabled;
    // Tone Transport loops via its own Parts which we set up with loop=true already.
  }

  async function loadFile(file) {
    await init();
    const ab = await file.arrayBuffer();
    fileBuffer = await ctx.decodeAudioData(ab);
    return { duration: fileBuffer.duration };
  }

  function setOutputGainDb(db) {
    if (!outputGain) return;
    outputGain.gain.setTargetAtTime(Math.pow(10, db / 20), ctx.currentTime, 0.01);
  }

  function getAnalyser() { return analyser; }
  function getContext() { return ctx; }
  function getMBC() { return mbc; }
  function isInitialized() { return initialized; }

  window.Engine = {
    init, play, stop, setLoop, loadFile,
    setOutputGainDb, getAnalyser, getContext, getMBC, isInitialized,
  };
})();
