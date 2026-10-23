/* Legram — living backgrounds for the word adventure.
 * The painting is the stage: its stone plaza is the floor the fighters stand
 * on (the ground line is computed from the painting, not drawn on top).
 * Each world gets its own grade, mist and particle weather, and the camera
 * drifts slowly so the frame never feels like a still image.
 */
(function (global) {
  'use strict';

  const IMG = { w: 1672, h: 941, floor: 0.815, posY: 0.7 };
  const WORLDS = {
    a1: { name: 'dusk',   particle: 'petal',   count: 26, color: [246, 168, 214], mist: '#c4b5fd',
          fauna: [{ kind: 'birds', every: [5, 9], tint: 'rgba(48,22,58,.78)' }, { kind: 'butterfly', every: [3, 6], tint: '#f9a8d4' }] },
    a2: { name: 'forest', particle: 'firefly', count: 34, color: [214, 255, 140], mist: '#a7f3d0',
          fauna: [{ kind: 'birds', every: [4, 8], tint: 'rgba(16,40,30,.8)' }, { kind: 'butterfly', every: [2.5, 5], tint: '#67e8f9' }] },
    b1: { name: 'city',   particle: 'rain',    count: 90, color: [190, 215, 255], mist: '#93c5fd',
          fauna: [{ kind: 'bats', every: [5, 10], tint: 'rgba(10,14,32,.85)' }, { kind: 'crow', every: [7, 12], tint: 'rgba(8,10,22,.88)' }] },
    b2: { name: 'ember',  particle: 'ember',   count: 46, color: [255, 160, 80],  mist: '#fdba74',
          fauna: [{ kind: 'bats', every: [3, 7], tint: 'rgba(40,10,6,.85)' }, { kind: 'dragon', every: [14, 22], tint: 'rgba(36,8,4,.7)' }] },
    c1: { name: 'aurora', particle: 'snow',    count: 70, color: [220, 245, 255], mist: '#a5f3fc',
          fauna: [{ kind: 'owl', every: [9, 15], tint: 'rgba(235,248,255,.9)' }, { kind: 'star', every: [3, 7], tint: '#e0f2fe' }] }
  };

  class WorldFx {
    constructor(arena) {
      this.arena = arena;
      this.art = arena.querySelector('.world-art');
      this.reduced = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
      const canvas = document.createElement('canvas');
      canvas.className = 'world-weather';
      canvas.setAttribute('aria-hidden', 'true');
      arena.insertBefore(canvas, arena.querySelector('.combat-entity'));
      const fauna = document.createElement('canvas');
      fauna.className = 'world-fauna';
      fauna.setAttribute('aria-hidden', 'true');
      arena.insertBefore(fauna, canvas);
      this.faunaCanvas = fauna; this.fctx = fauna.getContext('2d');
      this.critters = []; this.nextSpawn = [];
      this.canvas = canvas; this.ctx = canvas.getContext('2d');
      ['far', 'near'].forEach(k => {
        const m = document.createElement('div');
        m.className = `world-mist world-mist-${k}`;
        m.setAttribute('aria-hidden', 'true');
        arena.insertBefore(m, canvas);
      });
      const fg = document.createElement('div');
      fg.className = 'world-foreground';
      fg.setAttribute('aria-hidden', 'true');
      arena.appendChild(fg);
      this.parts = []; this.raf = null; this.running = false; this.drift = null;
      this.onResize = () => this.layout();
      global.addEventListener('resize', this.onResize);
    }

    /* Put the painting's plaza exactly on the ground line. */
    layout() {
      const W = this.arena.clientWidth, H = this.arena.clientHeight;
      if (!W || !H) return;
      const s = Math.max(W / IMG.w, H / IMG.h), ih = IMG.h * s;
      const top = (H - ih) * IMG.posY;
      const floor = (top + ih * IMG.floor) / H * 100;
      this.arena.style.setProperty('--ground-line', `${Math.max(66, Math.min(88, floor)).toFixed(2)}%`);
      const dpr = Math.min(2, global.devicePixelRatio || 1);
      this.canvas.width = Math.round(W * dpr); this.canvas.height = Math.round(H * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.faunaCanvas.width = this.canvas.width; this.faunaCanvas.height = this.canvas.height;
      this.fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.w = W; this.h = H;
    }

    start(worldId) {
      this.stop();
      this.cfg = WORLDS[worldId] || WORLDS.a1;
      this.arena.dataset.weather = this.cfg.name;
      this.layout();
      this.running = true;
      if (global.gsap && !this.reduced) {
        global.gsap.set(this.art, { clearProps: 'transform' });
        this.drift = global.gsap.timeline({ repeat: -1, yoyo: true })
          .to(this.art, { scale: 1.06, x: -10, duration: 14, ease: 'sine.inOut', transformOrigin: '50% 81%' });
      }
      if (this.reduced) return;
      this.parts = Array.from({ length: Math.round(this.cfg.count * Math.min(1.4, Math.max(.6, this.w / 900))) }, () => this.spawn(true));
      this.critters = [];
      const t0 = performance.now() / 1000;
      this.nextSpawn = (this.cfg.fauna || []).map((f, i) => t0 + .8 + i * 1.6 + Math.random() * 1.5);
      let last = performance.now();
      const step = now => {
        if (!this.running) return;
        const dt = Math.min(50, now - last) / 1000; last = now;
        if (!document.hidden) { this.draw(dt, now / 1000); this.drawFauna(dt, now / 1000); }
        this.raf = requestAnimationFrame(step);
      };
      this.raf = requestAnimationFrame(step);
    }

    stop() {
      this.running = false;
      cancelAnimationFrame(this.raf); this.raf = null;
      this.drift?.kill(); this.drift = null;
      this.ctx?.clearRect(0, 0, this.w || 0, this.h || 0);
      this.fctx?.clearRect(0, 0, this.w || 0, this.h || 0);
      this.critters = [];
    }

    /* ---------- living creatures ---------- */
    spawnFauna(f) {
      const w = this.w, h = this.h, r = Math.random, dir = r() < .5 ? 1 : -1, list = this.critters;
      const startX = dir > 0 ? -60 : w + 60;
      const add = o => list.push(Object.assign({ dir, tint: f.tint, ph: r() * 6.28, life: 0 }, o));
      if (f.kind === 'birds') {
        const n = 3 + Math.floor(r() * 5), z = .55 + r() * .6, y = h * (.08 + r() * .3), v = 70 + r() * 40;
        for (let i = 0; i < n; i++) add({ kind: 'bird', x: startX - dir * i * 18 * z, y: y + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 9 * z + r() * 4, z, vx: v * z, flap: 7 + r() * 2, bob: r() * 6.28 });
      } else if (f.kind === 'crow') {
        const n = 1 + Math.floor(r() * 2), z = .8 + r() * .5;
        for (let i = 0; i < n; i++) add({ kind: 'bird', x: startX - dir * i * 40, y: h * (.12 + r() * .3), z, vx: 85 * z, flap: 5, bob: r() * 6.28 });
      } else if (f.kind === 'bats') {
        const n = 4 + Math.floor(r() * 7), y = h * (.1 + r() * .35);
        for (let i = 0; i < n; i++) { const z = .45 + r() * .6; add({ kind: 'bat', x: startX - dir * r() * 160, y: y + (r() - .5) * 80, z, vx: (110 + r() * 60) * z, flap: 14 + r() * 6, bob: r() * 6.28, wig: 18 + r() * 20 }); }
      } else if (f.kind === 'butterfly') {
        add({ kind: 'butterfly', x: r() * w, y: h * (.55 + r() * .25), z: .8 + r() * .5, vx: 0, ttl: 7 + r() * 5, hx: r() * 6.28, hy: r() * 6.28, fade: 0 });
      } else if (f.kind === 'dragon') {
        add({ kind: 'dragon', x: startX * 1.5, y: h * (.1 + r() * .14), z: .7 + r() * .3, vx: 55, flap: 1.6, bob: 0 });
      } else if (f.kind === 'owl') {
        add({ kind: 'owl', x: startX, y: h * (.15 + r() * .25), z: .9 + r() * .4, vx: 95, flap: 3.2, bob: r() * 6.28 });
      } else if (f.kind === 'star') {
        add({ kind: 'star', x: w * (.1 + r() * .8), y: h * (.04 + r() * .25), z: 1, vx: 0, ttl: .9, ang: (dir > 0 ? .35 : Math.PI - .35) + (r() - .5) * .3, len: 70 + r() * 60 });
      }
    }

    drawFauna(dt, t) {
      const ctx = this.fctx, w = this.w, h = this.h, fauna = this.cfg.fauna || [];
      fauna.forEach((f, i) => {
        if (t >= this.nextSpawn[i]) { if (this.critters.length < 40) this.spawnFauna(f); this.nextSpawn[i] = t + f.every[0] + Math.random() * (f.every[1] - f.every[0]); }
      });
      ctx.clearRect(0, 0, w, h);
      this.critters = this.critters.filter(c => {
        c.life += dt;
        if (c.kind === 'butterfly') {
          c.fade = Math.min(1, c.life / .8, Math.max(0, (c.ttl - c.life) / .8));
          c.x += Math.sin(t * .7 + c.hx) * 22 * dt + Math.cos(t * 1.9 + c.hy) * 14 * dt;
          c.y += Math.cos(t * .9 + c.hy) * 16 * dt + Math.sin(t * 2.6 + c.hx) * 10 * dt;
          this.drawButterfly(ctx, c, t);
          return c.life < c.ttl;
        }
        if (c.kind === 'star') { this.drawStar(ctx, c); return c.life < c.ttl; }
        c.x += c.dir * c.vx * dt;
        const bob = Math.sin(t * (c.kind === 'bat' ? 3.4 : 1.6) + c.bob) * (c.kind === 'bat' ? c.wig * .25 : 4) * c.z;
        const y = c.y + bob;
        const flap = Math.sin(t * c.flap + c.ph);
        ctx.save(); ctx.translate(c.x, y); ctx.scale(c.dir, 1); ctx.fillStyle = c.tint; ctx.strokeStyle = c.tint;
        if (c.kind === 'bird') this.drawBird(ctx, 7 * c.z, flap);
        else if (c.kind === 'bat') this.drawBat(ctx, 6 * c.z, flap);
        else if (c.kind === 'dragon') this.drawDragon(ctx, 26 * c.z, flap, t);
        else if (c.kind === 'owl') this.drawOwl(ctx, 10 * c.z, flap);
        ctx.restore();
        return c.x > -120 && c.x < w + 120;
      });
    }

    drawBird(ctx, s, f) {
      const lift = f * s * .9;
      ctx.lineWidth = Math.max(1.2, s * .28); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-s * 1.3, -lift); ctx.quadraticCurveTo(-s * .55, -lift * .2 - s * .35, 0, 0);
      ctx.quadraticCurveTo(s * .55, -lift * .2 - s * .35, s * 1.3, -lift); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(s * .1, s * .05, s * .32, s * .16, 0, 0, Math.PI * 2); ctx.fill();
    }

    drawBat(ctx, s, f) {
      const up = f * s * .8;
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.lineTo(-s * .6, -up * .6 - s * .2); ctx.lineTo(-s * 1.6, -up); ctx.lineTo(-s * 1.3, s * .1 - up * .3);
      ctx.lineTo(-s * .95, -up * .15 + s * .05); ctx.lineTo(-s * .6, s * .3); ctx.lineTo(0, s * .25);
      ctx.lineTo(s * .6, s * .3); ctx.lineTo(s * .95, -up * .15 + s * .05); ctx.lineTo(s * 1.3, s * .1 - up * .3);
      ctx.lineTo(s * 1.6, -up); ctx.lineTo(s * .6, -up * .6 - s * .2); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -s * .05, s * .28, 0, Math.PI * 2); ctx.fill();
    }

    drawOwl(ctx, s, f) {
      const up = f * s * .55;
      ctx.beginPath(); ctx.ellipse(0, 0, s * .45, s * .3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-s * .2, -s * .1); ctx.quadraticCurveTo(-s * 1.1, -up - s * .5, -s * 2.1, -up * .8);
      ctx.quadraticCurveTo(-s * 1.2, -up * .2 + s * .15, -s * .2, s * .15); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(s * .2, -s * .1); ctx.quadraticCurveTo(s * 1.1, -up - s * .5, s * 2.1, -up * .8);
      ctx.quadraticCurveTo(s * 1.2, -up * .2 + s * .15, s * .2, s * .15); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(s * .5, -s * .12, s * .26, 0, Math.PI * 2); ctx.fill();
    }

    drawDragon(ctx, s, f, t) {
      const up = f * s * .7;
      // body + tail
      ctx.beginPath(); ctx.moveTo(s * 1.4, -s * .05);
      ctx.quadraticCurveTo(s * .6, -s * .22, 0, -s * .1);
      ctx.quadraticCurveTo(-s * .9, 0, -s * 1.6, Math.sin(t * 2) * s * .15 + s * .05);
      ctx.quadraticCurveTo(-s * 2.2, Math.sin(t * 2 + 1) * s * .2, -s * 2.6, s * .02);
      ctx.quadraticCurveTo(-s * 1.8, s * .14, -s * .8, s * .14);
      ctx.quadraticCurveTo(0, s * .16, s * .7, s * .06); ctx.closePath(); ctx.fill();
      // head
      ctx.beginPath(); ctx.moveTo(s * 1.3, -s * .12); ctx.lineTo(s * 1.75, -s * .02); ctx.lineTo(s * 1.3, s * .06); ctx.closePath(); ctx.fill();
      // wing (membrane)
      ctx.beginPath(); ctx.moveTo(s * .35, -s * .1);
      ctx.lineTo(-s * .1, -up - s * .9); ctx.lineTo(-s * .55, -up * .8 - s * .5);
      ctx.lineTo(-s * .8, -up * .6 - s * .25); ctx.lineTo(-s * .45, -s * .05); ctx.closePath(); ctx.fill();
    }

    drawButterfly(ctx, c, t) {
      const s = 4.2 * c.z, open = Math.abs(Math.sin(t * 13 + c.ph));
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(Math.sin(t * 1.3 + c.hx) * .4);
      ctx.globalAlpha = .9 * c.fade; ctx.fillStyle = c.tint; ctx.shadowColor = c.tint; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.ellipse(-s * .7 * open, -s * .3, s * open, s * 1.1, -.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(s * .7 * open, -s * .3, s * open, s * 1.1, .4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-s * .5 * open, s * .6, s * .7 * open, s * .7, -.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(s * .5 * open, s * .6, s * .7 * open, s * .7, .3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    drawStar(ctx, c) {
      const k = c.life / c.ttl, a = Math.sin(k * Math.PI), dx = Math.cos(c.ang), dy = Math.sin(c.ang);
      const hx = c.x + dx * c.len * k * 2, hy = c.y + dy * c.len * k * 2;
      const g = ctx.createLinearGradient(hx, hy, hx - dx * c.len, hy - dy * c.len);
      g.addColorStop(0, `rgba(240,250,255,${a})`); g.addColorStop(1, 'rgba(240,250,255,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - dx * c.len, hy - dy * c.len); ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.arc(hx, hy, 1.6, 0, Math.PI * 2); ctx.fill();
    }

    spawn(anywhere) {
      const w = this.w, h = this.h, t = this.cfg.particle, r = Math.random;
      const p = { x: r() * w, y: anywhere ? r() * h : -10, life: 0, ph: r() * 6.28, z: .4 + r() * .9 };
      if (t === 'petal') Object.assign(p, { vx: -18 - r() * 22, vy: 14 + r() * 18, s: 3 + r() * 3, spin: r() * 6 });
      if (t === 'firefly') Object.assign(p, { y: h * (.35 + r() * .55), vx: (r() - .5) * 10, vy: (r() - .5) * 8, s: 1.2 + r() * 1.6, max: 5 + r() * 6 });
      if (t === 'rain') Object.assign(p, { vx: -60, vy: 520 + r() * 260, s: 10 + r() * 14 });
      if (t === 'ember') Object.assign(p, { y: anywhere ? r() * h : h + 10, vx: (r() - .5) * 14, vy: -(26 + r() * 40), s: 1 + r() * 2.2, max: 3 + r() * 4 });
      if (t === 'snow') Object.assign(p, { vx: -8 + r() * 6, vy: 16 + r() * 22, s: 1 + r() * 2.4 });
      return p;
    }

    draw(dt, t) {
      const { ctx, w, h, cfg } = this, [R, G, B] = cfg.color;
      ctx.clearRect(0, 0, w, h);
      for (const p of this.parts) {
        p.life += dt;
        p.x += p.vx * p.z * dt + (cfg.particle === 'petal' || cfg.particle === 'snow' ? Math.sin(t * 1.3 + p.ph) * 12 * dt : 0);
        p.y += p.vy * p.z * dt;
        if (cfg.particle === 'firefly') { p.vx += (Math.random() - .5) * 20 * dt; p.vy += (Math.random() - .5) * 20 * dt; p.vx *= .98; p.vy *= .98; }
        const out = p.y > h + 20 || p.y < -30 || p.x < -30 || p.x > w + 30 || (p.max && p.life > p.max);
        if (out) { Object.assign(p, this.spawn(false)); if (cfg.particle === 'petal' || cfg.particle === 'rain' || cfg.particle === 'snow') p.x = Math.random() * (w + 120); continue; }
        if (cfg.particle === 'petal') {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(t * p.spin * .3 + p.ph);
          ctx.fillStyle = `rgba(${R},${G},${B},${(.55 * p.z).toFixed(2)})`;
          ctx.beginPath(); ctx.ellipse(0, 0, p.s * p.z * 1.4, p.s * p.z * .7, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        } else if (cfg.particle === 'rain') {
          ctx.strokeStyle = `rgba(${R},${G},${B},${(.22 * p.z).toFixed(2)})`; ctx.lineWidth = p.z;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.vx * .02, p.y + p.s * p.z); ctx.stroke();
        } else {
          const glow = cfg.particle === 'firefly' ? (.35 + .65 * Math.max(0, Math.sin(t * 2.2 + p.ph))) : cfg.particle === 'ember' ? Math.sin(Math.min(1, p.life / p.max) * Math.PI) : .8;
          const a = glow * p.z * (cfg.particle === 'snow' ? .55 : .9), rad = p.s * p.z;
          if (cfg.particle !== 'snow') {
            const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad * 5);
            grd.addColorStop(0, `rgba(${R},${G},${B},${(a * .5).toFixed(3)})`); grd.addColorStop(1, `rgba(${R},${G},${B},0)`);
            ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(p.x, p.y, rad * 5, 0, Math.PI * 2); ctx.fill();
          }
          ctx.fillStyle = `rgba(${R},${G},${B},${a.toFixed(3)})`; ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }

  global.LegramWorldFx = WorldFx;
})(window);
