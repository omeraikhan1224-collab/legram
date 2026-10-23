/* Legram — human word pronunciation.
 * Recordings by native speakers from Wikimedia Commons (credited in the app,
 * CC BY-SA). Clips are packed into one audio sprite per level and played with
 * Web Audio, so a word starts instantly. Nouns play the article clip, then the
 * word, from the same speaker. A missing clip falls back to the browser voice.
 */
(function (global) {
  'use strict';

  class WordVoice {
    constructor({ base = 'voices/', fallback, getContext, onStart, onEnd } = {}) {
      this.base = base;
      this.fallback = fallback || (() => {});
      this.getContext = getContext || null;
      this.onStart = onStart || (() => {});
      this.onEnd = onEnd || (() => {});
      this.playing = false;
      this.map = null;
      this.ctx = null;
      this.buffers = new Map();   // sprite name -> Promise<AudioBuffer>
      this.sources = [];
      this.token = 0;
      this.ready = this.load();
    }

    async load() {
      try {
        const res = await fetch(`${this.base}words.json`);
        if (!res.ok) throw new Error(String(res.status));
        this.map = await res.json();
      } catch { this.map = { sprites: {}, words: {}, articles: {}, credits: [] }; }
      return this.map;
    }

    audioCtx() {
      if (this.getContext) { const shared = this.getContext(); if (shared) { this.ctx = shared; return shared; } return null; }
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      if (!this.ctx) this.ctx = new AC();
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ctx;
    }

    sprite(name) {
      if (!name || !this.map?.sprites?.[name]) return Promise.resolve(null);
      if (!this.buffers.has(name)) {
        const p = fetch(`${this.base}${this.map.sprites[name].file}`)
          .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); })
          .then(data => new Promise((resolve, reject) => {
            const ctx = this.audioCtx();
            if (!ctx) return reject(new Error('no-audio'));
            const out = ctx.decodeAudioData(data, resolve, reject);
            if (out && out.then) out.then(resolve, reject);
          }))
          .catch(() => { this.buffers.delete(name); return null; });
        this.buffers.set(name, p);
      }
      return this.buffers.get(name);
    }

    has(word) { return Boolean(this.map?.words?.[word]); }

    /* Warm the sprites a level will need. */
    async warm(levelId) {
      await this.ready;
      this.sprite('articles');
      if (levelId) this.sprite(levelId);
    }

    async preload(item) {
      await this.ready;
      const w = this.map.words[item?.word];
      if (w) this.sprite(w.s);
      if (item?.article) this.sprite('articles');
    }

    stop() {
      this.token++;
      this.sources.forEach(s => { try { s.stop(); } catch {} });
      this.sources = [];
    }

    playSegment(seg, token) {
      return new Promise(async resolve => {
        const buffer = await this.sprite(seg.s);
        const ctx = this.ctx;
        if (!buffer || !ctx || token !== this.token) return resolve(Boolean(buffer && token === this.token));
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.value = 1;
        src.connect(gain); gain.connect(ctx.destination);
        const start = Math.max(0, seg.t - 0.01), dur = seg.d + 0.05;
        src.onended = () => { this.sources = this.sources.filter(s => s !== src); resolve(true); };
        this.sources.push(src);
        try { src.start(0, start, dur); } catch { resolve(false); }
      });
    }

    /* item: { word, article, display } */
    async play(item, opts) {
      this.playing = true; this.onStart();
      try { return await this.playInner(item, opts); }
      finally { this.playing = false; this.onEnd(); }
    }

    async playInner(item, { withArticle = true } = {}) {
      await this.ready;
      this.stop();
      const token = this.token;
      const w = this.map.words[item?.word];
      if (!w || !this.audioCtx()) { this.fallback(item?.display || item?.word || ''); return false; }
      const art = withArticle && item.article ? this.map.articles[item.article] : null;
      if (art) {
        const ok = await this.playSegment(art, token);
        if (token !== this.token) return false;
        if (!ok) { this.fallback(item.display); return false; }
        await new Promise(r => setTimeout(r, 12));
        if (token !== this.token) return false;
      }
      const ok = await this.playSegment(w, token);
      if (!ok && token === this.token) this.fallback(item.display);
      return ok;
    }

    credits() { return this.map?.credits || []; }
  }

  global.LegramWordVoice = WordVoice;
})(window);
