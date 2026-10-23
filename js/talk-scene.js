/* Legram — live conversation scene.
 * One camera holds the room, the character and Le. The camera drifts slowly
 * the whole time (handheld feel), turns toward whoever speaks, and the room
 * moves less than the people in it, so the shot reads as depth, not a photo.
 * Le has four acting poses from the casual sheet: idle (notebook), happy
 * (clap), wave, think (eyes closed).
 */
(function (global) {
  'use strict';

  const POSES = { idle: 0, happy: 1, wave: 2, think: 3 };
  /* Places with a generated live shot: the whole room, the character and Le
     move together in one looping video, so the painted layers step aside. */
  const LIVE = { home: { src: 'assets/scenes/talk-home.mp4', poster: 'assets/scenes/talk-home.jpg' } };

  class TalkScene {
    constructor({ stage, cam, le, npcBox, dust }) {
      Object.assign(this, { stage, cam, le, npcBox, dust });
      this.g = global.gsap || null;
      this.reduced = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
      this.bg = cam.querySelector('.scene-backdrop');
      this.light = cam.querySelector('.tk-light');
      this.leArt = le.querySelector('i');
      this.loops = [];
      this.running = false;
      this.particles = [];
      this.raf = null;
      this.poseTimer = null;
    }

    /* ---------- life ---------- */
    mountLive(placeId) {
      const live = LIVE[placeId];
      this.stage.classList.toggle('has-live', Boolean(live));
      if (!live) { this.video?.pause(); return false; }
      if (!this.video) {
        const fill = document.createElement('div');
        fill.className = 'tk-live-fill'; fill.setAttribute('aria-hidden', 'true');
        const v = document.createElement('video');
        v.className = 'tk-live'; v.muted = true; v.loop = true; v.autoplay = true;
        v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
        v.preload = 'auto';
        this.cam.insertBefore(fill, this.cam.firstChild);
        this.cam.insertBefore(v, fill.nextSibling);
        this.video = v; this.fill = fill;
      }
      if (!this.video.src.endsWith(live.src)) { this.video.poster = live.poster; this.video.src = live.src; }
      this.fill.style.backgroundImage = `url('${live.poster}')`;
      if (this.reduced) { this.video.pause(); return true; }
      const p = this.video.play(); if (p && p.catch) p.catch(() => {});
      return true;
    }

    start(accent = '#23cdb5', placeId) {
      this.stop();
      this.running = true;
      this.live = this.mountLive(placeId);
      if (this.live && this.g && !this.reduced) {
        this.loops.push(this.g.to(this.video, { scale: 1.04, duration: 10, ease: 'sine.inOut', yoyo: true, repeat: -1, transformOrigin: '50% 60%' }));
      }
      this.stage.style.setProperty('--scene-accent', accent);
      this.pose('wave');
      this.poseTimer = setTimeout(() => this.pose('idle'), 1600);
      if (this.g && !this.reduced) {
        const g = this.g;
        g.set([this.bg, this.npcBox, this.le], { clearProps: 'transform' });
        // handheld camera: slow, uneven drift on the room
        this.loops.push(
          g.to(this.bg, { x: 14, y: -6, scale: 1.075, duration: 9, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
          g.to(this.bg, { rotation: .35, duration: 13, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
          // people breathe at their own tempo
          g.to(this.npcBox, { y: -3, scaleY: 1.012, duration: 2.1, ease: 'sine.inOut', yoyo: true, repeat: -1, transformOrigin: '50% 100%' }),
          g.to(this.leArt, { y: -2.5, scaleY: 1.015, duration: 1.7, ease: 'sine.inOut', yoyo: true, repeat: -1, transformOrigin: '50% 100%' }),
          // window light breathes
          g.to(this.light, { opacity: .55, x: -18, duration: 6.5, ease: 'sine.inOut', yoyo: true, repeat: -1 })
        );
        g.fromTo(this.cam, { scale: 1.12, y: 18 }, { scale: 1, y: 0, duration: 1.4, ease: 'power3.out' });
        g.fromTo(this.le, { xPercent: 30, opacity: 0 }, { xPercent: 0, opacity: 1, duration: .9, ease: 'power3.out', delay: .15 });
      }
      this.startDust();
    }

    stop() {
      this.running = false;
      clearTimeout(this.poseTimer);
      this.loops.forEach(t => t.kill());
      this.loops = [];
      if (this.g) this.g.killTweensOf([this.cam, this.bg, this.npcBox, this.le, this.leArt, this.light, this.video].filter(Boolean));
      this.video?.pause();
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }

    /* ---------- camera ---------- */
    focus(who) {
      if (!this.g || this.reduced) return;
      const narrow = this.stage.clientWidth < 700;
      const shots = {
        npc: { x: narrow ? 26 : 40, y: 6, scale: 1.07 },
        le: { x: narrow ? -22 : -34, y: 4, scale: 1.05 },
        both: { x: 0, y: 0, scale: 1 }
      };
      this.g.to(this.cam, { ...(shots[who] || shots.both), duration: 1.1, ease: 'power2.inOut', overwrite: 'auto' });
    }

    /* ---------- Le acting ---------- */
    pose(name) {
      const i = POSES[name] ?? 0;
      this.le.dataset.pose = name;
      this.leArt.style.backgroundPosition = `${i * (100 / 3)}% 0`;
    }

    leTalking(on) {
      this.le.classList.toggle('talking', Boolean(on));
      if (!this.g || this.reduced) return;
      if (on) {
        this.talkTween?.kill();
        this.talkTween = this.g.to(this.le, { y: -4, rotation: -1.2, duration: .22, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      } else {
        this.talkTween?.kill(); this.talkTween = null;
        this.g.to(this.le, { y: 0, rotation: 0, duration: .25, ease: 'power2.out' });
      }
    }

    react(kind) {
      clearTimeout(this.poseTimer);
      this.leTalking(false);
      if (kind === 'good') {
        this.pose('happy');
        if (this.g && !this.reduced) this.g.fromTo(this.le, { y: 0 }, { y: -16, duration: .18, ease: 'power2.out', yoyo: true, repeat: 3 });
        this.poseTimer = setTimeout(() => this.pose('idle'), 2200);
      } else if (kind === 'bad') {
        this.pose('think');
        if (this.g && !this.reduced) this.g.fromTo(this.le, { rotation: 0 }, { keyframes: [{ rotation: -3 }, { rotation: 2 }, { rotation: 0 }], duration: .5, ease: 'sine.inOut' });
      } else this.pose('idle');
    }

    /* ---------- floating dust in the window light ---------- */
    startDust() {
      const c = this.dust; if (!c || this.reduced) return;
      const ctx = c.getContext('2d');
      const resize = () => {
        const r = c.getBoundingClientRect(), dpr = Math.min(2, global.devicePixelRatio || 1);
        c.width = Math.max(1, r.width * dpr); c.height = Math.max(1, r.height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.w = r.width; this.h = r.height;
      };
      resize();
      this.particles = Array.from({ length: Math.round(Math.min(46, (this.w * this.h) / 9000)) }, () => this.spawn(true));
      let last = performance.now();
      const step = now => {
        if (!this.running) return;
        if (Math.abs(c.getBoundingClientRect().width - this.w) > 2) resize();
        const dt = Math.min(50, now - last) / 1000; last = now;
        ctx.clearRect(0, 0, this.w, this.h);
        for (const p of this.particles) {
          p.x += (p.vx + Math.sin(now / 1000 * p.f + p.ph) * 4) * dt;
          p.y += p.vy * dt;
          p.life += dt;
          if (p.y < -10 || p.x < -10 || p.x > this.w + 10 || p.life > p.max) Object.assign(p, this.spawn(false));
          const a = Math.sin(Math.min(1, p.life / p.max) * Math.PI) * p.a;
          ctx.beginPath(); ctx.fillStyle = `rgba(255,244,220,${a.toFixed(3)})`; ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        }
        this.raf = requestAnimationFrame(step);
      };
      this.raf = requestAnimationFrame(step);
    }

    spawn(anywhere) {
      const w = this.w || 300, h = this.h || 300;
      return { x: Math.random() * w, y: anywhere ? Math.random() * h : h * (.4 + Math.random() * .6), vx: (Math.random() - .5) * 6, vy: -(3 + Math.random() * 9), r: .6 + Math.random() * 1.6, a: .25 + Math.random() * .45, f: .3 + Math.random() * .8, ph: Math.random() * 6, life: anywhere ? Math.random() * 6 : 0, max: 6 + Math.random() * 8 };
    }
  }

  global.LegramTalkScene = TalkScene;
})(window);
