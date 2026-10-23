/* Legram — procedural sound design for combat.
 * Every effect is layered like a game SFX: a transient (attack click/crack),
 * a body (tone or filtered noise), a tail (reverb send). All of it runs
 * through one bus: compressor -> limiter-ish gain, with a shared plate reverb.
 */
(function (global) {
  'use strict';

  class LegramSfx {
    constructor() {
      this.ctx = null;
      this.enabled = true;
      this.noiseBuffer = null;
    }

    setEnabled(on) { this.enabled = Boolean(on); }

    ensure() {
      if (this.isEnabled ? !this.isEnabled() : !this.enabled) return null;
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      try {
        if (!this.ctx) this.build(new AC());
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return this.ctx;
      } catch { return null; }
    }

    build(ctx) {
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.002; comp.release.value = 0.18;
      const master = ctx.createGain(); master.gain.value = 0.9; this.master = master;
      comp.connect(master); master.connect(ctx.destination);
      this.bus = comp;

      // Plate-like reverb from a generated impulse response.
      const len = Math.floor(ctx.sampleRate * 1.6), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = ir.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
      }
      const verb = ctx.createConvolver(); verb.buffer = ir;
      const verbIn = ctx.createGain(); verbIn.gain.value = 0.28;
      const verbHp = ctx.createBiquadFilter(); verbHp.type = 'highpass'; verbHp.frequency.value = 280;
      verbIn.connect(verbHp); verbHp.connect(verb); verb.connect(comp);
      this.verb = verbIn;

      const nlen = ctx.sampleRate * 2, nb = ctx.createBuffer(1, nlen, ctx.sampleRate), nd = nb.getChannelData(0);
      for (let i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;
      this.noiseBuffer = nb;
    }

    /* Lower combat effects while a pronunciation plays, so the word stays clear. */
    duck(on) {
      if (!this.ctx || !this.master) return;
      const g = this.master.gain, t = this.ctx.currentTime;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(on ? 0.28 : 0.9, t + (on ? 0.06 : 0.35));
    }

    unlock() { const ctx = this.ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); }

    // ---------- building blocks ----------
    out(node, wet = 0) {
      node.connect(this.bus);
      if (wet > 0) { const s = this.ctx.createGain(); s.gain.value = wet; node.connect(s); s.connect(this.verb); }
    }

    env(gainNode, t, attack, peak, decay, curve = 'exp') {
      const g = gainNode.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(0.0001, t);
      g.linearRampToValueAtTime(peak, t + attack);
      if (curve === 'exp') g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
      else g.linearRampToValueAtTime(0.0001, t + attack + decay);
    }

    noise(t, dur, { type = 'bandpass', freq = 1000, freqEnd, q = 1, peak = 0.3, attack = 0.004, wet = 0.1, pan = 0 } = {}) {
      const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.noiseBuffer;
      src.playbackRate.value = 0.8 + Math.random() * 0.4;
      const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t);
      if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
      const g = ctx.createGain(); this.env(g, t, attack, peak, dur);
      const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      src.connect(f); f.connect(g);
      if (p) { p.pan.value = pan; g.connect(p); this.out(p, wet); } else this.out(g, wet);
      src.start(t, Math.random()); src.stop(t + dur + attack + 0.05);
    }

    tone(t, dur, { type = 'sine', freq = 220, freqEnd, peak = 0.2, attack = 0.003, wet = 0.05, detune = 0 } = {}) {
      const ctx = this.ctx, o = ctx.createOscillator(); o.type = type; o.detune.value = detune;
      o.frequency.setValueAtTime(freq, t);
      if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
      const g = ctx.createGain(); this.env(g, t, attack, peak, dur);
      o.connect(g); this.out(g, wet);
      o.start(t); o.stop(t + dur + attack + 0.05);
      return o;
    }

    // ---------- effects ----------
    whoosh(strength = 1) {
      const ctx = this.ensure(); if (!ctx) return; const t = ctx.currentTime;
      this.noise(t, 0.2, { freq: 600, freqEnd: 3800, q: 1.4, peak: 0.16 * strength, attack: 0.05, wet: 0.08, pan: -0.3 });
      this.noise(t + 0.03, 0.16, { freq: 1800, freqEnd: 6000, q: 3, peak: 0.06 * strength, attack: 0.04, wet: 0.05, pan: 0.2 });
    }

    slash(crit = false) {
      const ctx = this.ensure(); if (!ctx) return; const t = ctx.currentTime;
      // blade cut: bright noise sweep down
      this.noise(t, 0.14, { type: 'highpass', freq: 5200, freqEnd: 1600, q: 0.7, peak: 0.24, attack: 0.002, wet: 0.12 });
      // metallic ring: inharmonic partials
      [1, 2.76, 5.4, 8.93].forEach((m, i) => this.tone(t + 0.005, 0.5 - i * 0.08, { type: 'sine', freq: 620 * m * (crit ? 1.12 : 1), peak: 0.05 / (i + 1), wet: 0.35 }));
      if (crit) {
        [1318.5, 1975.5, 2637].forEach((f, i) => this.tone(t + 0.06 + i * 0.045, 0.35, { type: 'triangle', freq: f, peak: 0.04, wet: 0.5 }));
      }
    }

    impact(power = 1) {
      const ctx = this.ensure(); if (!ctx) return; const t = ctx.currentTime;
      // sub thump
      this.tone(t, 0.32, { type: 'sine', freq: 130 * power, freqEnd: 38, peak: 0.55 * power, attack: 0.001, wet: 0 });
      // body crack
      this.noise(t, 0.12, { type: 'lowpass', freq: 2400, freqEnd: 300, q: 0.8, peak: 0.42 * power, attack: 0.001, wet: 0.2 });
      // crunch
      this.noise(t + 0.01, 0.07, { type: 'bandpass', freq: 3200, q: 2, peak: 0.18 * power, attack: 0.001, wet: 0.1 });
    }

    roar(intensity = 1, pitch = 1) {
      const ctx = this.ensure(); if (!ctx) return; const t = ctx.currentTime, dur = 0.75 * intensity;
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(95 * pitch, t); o.frequency.linearRampToValueAtTime(140 * pitch, t + dur * 0.3); o.frequency.exponentialRampToValueAtTime(60 * pitch, t + dur);
      const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 23; lfoG.gain.value = 14; lfo.connect(lfoG); lfoG.connect(o.frequency);
      const mix = ctx.createGain(); mix.gain.value = 1;
      // vocal formants
      [[600, 6, 0.9], [1050, 8, 0.6], [2400, 10, 0.25]].forEach(([f, q, a]) => {
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * pitch; bp.Q.value = q;
        const g = ctx.createGain(); g.gain.value = a; o.connect(bp); bp.connect(g); g.connect(mix);
      });
      const shaper = ctx.createWaveShaper(); const curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 3); }
      shaper.curve = curve;
      const g = ctx.createGain(); this.env(g, t, 0.06, 0.32 * intensity, dur);
      mix.connect(shaper); shaper.connect(g); this.out(g, 0.3);
      o.start(t); lfo.start(t); o.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
      // breath/growl texture
      this.noise(t, dur, { type: 'bandpass', freq: 420 * pitch, q: 1.5, peak: 0.12 * intensity, attack: 0.05, wet: 0.2 });
    }

    claw() {
      const ctx = this.ensure(); if (!ctx) return; const t = ctx.currentTime;
      for (let i = 0; i < 3; i++) this.noise(t + i * 0.035, 0.09, { type: 'bandpass', freq: 2600 - i * 300, freqEnd: 900, q: 2.2, peak: 0.2, attack: 0.002, wet: 0.12, pan: -0.4 + i * 0.4 });
    }

    hurt() {
      const ctx = this.ensure(); if (!ctx) return; const t = ctx.currentTime;
      this.impact(0.9);
      // short vocal "oof": formant-filtered pulse dropping in pitch
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(330, t + 0.02); o.frequency.exponentialRampToValueAtTime(170, t + 0.24);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 750; bp.Q.value = 4;
      const g = ctx.createGain(); this.env(g, t + 0.02, 0.015, 0.16, 0.22);
      o.connect(bp); bp.connect(g); this.out(g, 0.15); o.start(t + 0.02); o.stop(t + 0.3);
    }

    heartBreak() {
      const ctx = this.ensure(); if (!ctx) return; const t = ctx.currentTime + 0.05;
      [1760, 2349, 1568, 2093].forEach((f, i) => this.tone(t + i * 0.05, 0.18, { type: 'triangle', freq: f, freqEnd: f * 0.92, peak: 0.05, wet: 0.4 }));
      this.noise(t, 0.12, { type: 'highpass', freq: 6000, peak: 0.08, wet: 0.3 });
    }

    land() {
      const ctx = this.ensure(); if (!ctx) return; const t = ctx.currentTime;
      this.tone(t, 0.45, { type: 'sine', freq: 90, freqEnd: 30, peak: 0.6, attack: 0.001 });
      this.noise(t, 0.35, { type: 'lowpass', freq: 900, freqEnd: 120, peak: 0.35, attack: 0.002, wet: 0.25 });
    }

    tick(urgent = false) {
      const ctx = this.ensure(); if (!ctx) return; const t = ctx.currentTime;
      this.tone(t, 0.05, { type: 'square', freq: urgent ? 1320 : 990, peak: urgent ? 0.07 : 0.035, attack: 0.001, wet: 0.05 });
      if (urgent) this.tone(t, 0.12, { type: 'sine', freq: 62, freqEnd: 45, peak: 0.35, attack: 0.002 });
    }

    shatter() {
      const ctx = this.ensure(); if (!ctx) return; const t = ctx.currentTime;
      this.impact(1.2);
      this.roar(0.9, 0.75);
      for (let i = 0; i < 14; i++) {
        const tt = t + 0.08 + Math.random() * 0.45;
        this.tone(tt, 0.12 + Math.random() * 0.2, { type: 'triangle', freq: 1800 + Math.random() * 3200, peak: 0.025, wet: 0.5 });
      }
      this.noise(t + 0.1, 0.8, { type: 'highpass', freq: 3000, freqEnd: 9000, peak: 0.07, attack: 0.1, wet: 0.5 });
    }

    hpDrain() {
      const ctx = this.ensure(); if (!ctx) return; const t = ctx.currentTime + 0.05;
      this.tone(t, 0.25, { type: 'square', freq: 520, freqEnd: 260, peak: 0.03, wet: 0.1 });
    }

    critCallout() {
      const ctx = this.ensure(); if (!ctx) return; const t = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(t + i * 0.055, 0.3, { type: 'triangle', freq: f, peak: 0.06, wet: 0.45 }));
    }

    fanfare() {
      const ctx = this.ensure(); if (!ctx) return; const t = ctx.currentTime;
      const notes = [[392, 0], [523.25, 0.14], [659.25, 0.28], [783.99, 0.42], [1046.5, 0.62]];
      notes.forEach(([f, d], i) => {
        this.tone(t + d, i === notes.length - 1 ? 1.1 : 0.32, { type: 'sawtooth', freq: f, peak: 0.05, attack: 0.01, wet: 0.4 });
        this.tone(t + d, i === notes.length - 1 ? 1.1 : 0.32, { type: 'triangle', freq: f * 2, peak: 0.03, attack: 0.01, wet: 0.4 });
      });
      this.tone(t + 0.62, 1.2, { type: 'sine', freq: 130.8, peak: 0.25, attack: 0.01 });
    }

    defeat() {
      const ctx = this.ensure(); if (!ctx) return; const t = ctx.currentTime;
      [[392, 0], [369.99, 0.3], [349.23, 0.6], [329.63, 0.9]].forEach(([f, d], i) => this.tone(t + d, i === 3 ? 1.2 : 0.34, { type: 'triangle', freq: f, peak: 0.08, attack: 0.02, wet: 0.45 }));
      this.tone(t + 0.9, 1.3, { type: 'sine', freq: 82.4, peak: 0.25, attack: 0.02 });
    }

    footstep() {
      const ctx = this.ensure(); if (!ctx) return; const t = ctx.currentTime;
      this.noise(t, 0.08, { type: 'lowpass', freq: 520, peak: 0.07, attack: 0.002, wet: 0 });
      this.tone(t, 0.08, { type: 'sine', freq: 110, freqEnd: 55, peak: 0.05, attack: 0.002 });
    }
  }

  global.LegramSfx = LegramSfx;
})(window);
