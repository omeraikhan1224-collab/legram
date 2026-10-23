/* Legram — Combat Director (duel edition)
 * GSAP choreography for the boss duel. The 2D engine owns world positions on
 * .combat-entity; this director owns the acting layers (.entity-motion,
 * .entity-visual, shadows), the camera (arena transform) and the FX overlay.
 * Every beat follows: anticipation -> action -> hit-stop -> reaction -> settle.
 */
(function (global) {
  'use strict';

  const FRAME = { idle: 0, coil: 1, roar: 2, swipe: 3, recoil: 4 };
  const rand = (min, max) => min + Math.random() * (max - min);
  const esc = value => String(value ?? '').replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

  class CombatDirector {
    constructor({ arena, hero, monster, engine, sfx }) {
      this.gsap = global.gsap || null;
      this.enabled = Boolean(this.gsap && arena && hero && monster);
      Object.assign(this, { arena, hero, monster, engine, sfx });
      this.timelines = new Set();
      this.loops = [];
      this.warned = false;
      if (!this.enabled) return;
      this.reduced = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
      this.heroMotion = hero.querySelector('.entity-motion');
      this.heroVisual = hero.querySelector('.entity-visual');
      this.heroShadow = hero.querySelector('.entity-shadow');
      this.monsterMotion = monster.querySelector('.entity-motion');
      this.monsterVisual = monster.querySelector('.entity-visual');
      this.monsterShadow = monster.querySelector('.entity-shadow');
      const layer = document.createElement('div');
      layer.className = 'combat-overlay';
      layer.setAttribute('aria-hidden', 'true');
      layer.innerHTML = '<i class="fx-flash"></i><i class="fx-vignette"></i><i class="fx-speedlines"></i><i class="fx-callout"></i>';
      arena.appendChild(layer);
      this.layer = layer;
      this.flash = layer.querySelector('.fx-flash');
      this.vignette = layer.querySelector('.fx-vignette');
      this.speedlines = layer.querySelector('.fx-speedlines');
      this.callout = layer.querySelector('.fx-callout');
      arena.classList.add('fx-pro');
    }

    get amp() { return this.reduced.matches ? 0.25 : 1; }
    get g() { return this.gsap; }

    track(tl) {
      this.timelines.add(tl);
      tl.eventCallback('onComplete', () => this.timelines.delete(tl));
      return tl;
    }

    frame(index) { this.g.set(this.monsterVisual, { backgroundPosition: `${index * 20}% 0` }); }
    pose(name) {
      this.hero.classList.remove('idle', 'running', 'attack', 'hurt', 'defeated', 'victory');
      if (name) this.hero.classList.add(name);
    }

    rect(el) {
      const a = this.arena.getBoundingClientRect(), r = el.getBoundingClientRect();
      return { x: r.left - a.left, y: r.top - a.top, w: r.width, h: r.height, cx: r.left - a.left + r.width / 2, cy: r.top - a.top + r.height / 2 };
    }

    gap() {
      const h = this.heroMotion.getBoundingClientRect(), m = this.monsterMotion.getBoundingClientRect();
      return Math.max(0, (m.left + m.width * 0.22) - (h.left + h.width * 0.62));
    }

    killLoops() { this.loops.forEach(t => t.kill()); this.loops = []; }

    stopAll() {
      if (!this.enabled) return;
      this.timelines.forEach(tl => tl.kill());
      this.timelines.clear();
      this.killLoops();
      const g = this.g;
      const all = [this.heroMotion, this.heroVisual, this.heroShadow, this.monsterMotion, this.monsterVisual, this.monsterShadow, this.arena, this.flash, this.vignette, this.speedlines, this.callout];
      g.killTweensOf(all);
      g.set([this.heroMotion, this.heroVisual, this.heroShadow, this.monsterMotion, this.monsterVisual, this.monsterShadow, this.arena], { clearProps: 'transform,filter,opacity,backgroundPosition' });
      g.set([this.flash, this.vignette, this.speedlines, this.callout], { opacity: 0 });
      this.layer.querySelectorAll('.fx-temp').forEach(n => n.remove());
      this.hero.querySelectorAll('.fx-ghost').forEach(n => n.remove());
      this.warned = false;
    }

    // ---------- shared FX ----------
    shake(strength = 8, duration = 0.32, focus = null, zoom = 1.05) {
      const g = this.g, s = strength * this.amp, steps = 8, keyframes = [];
      for (let i = 0; i < steps; i++) {
        const k = Math.pow(1 - i / steps, 1.6);
        keyframes.push({ x: rand(-s, s) * k, y: rand(-s * .6, s * .6) * k, rotation: rand(-.6, .6) * k * this.amp, duration: duration / (steps + 1) });
      }
      keyframes.push({ x: 0, y: 0, rotation: 0, duration: duration / (steps + 1) });
      const tl = g.timeline();
      tl.to(this.arena, { keyframes, ease: 'none' }, 0);
      if (focus && !this.reduced.matches) {
        tl.fromTo(this.arena, { scale: 1 }, { scale: zoom, duration: .05, ease: 'power2.out', transformOrigin: `${focus.cx}px ${focus.cy}px`, immediateRender: false }, 0)
          .to(this.arena, { scale: 1, duration: .5, ease: 'expo.out' }, .05);
      }
      return tl;
    }

    flashScreen(color, peak = .55, duration = .22) {
      return this.g.fromTo(this.flash, { opacity: peak * (this.reduced.matches ? .35 : 1), background: color }, { opacity: 0, duration, ease: 'power2.out', immediateRender: false });
    }

    spawn(className, x, y, html = '') {
      const node = document.createElement('i');
      node.className = `fx-temp ${className}`;
      node.style.left = `${x}px`; node.style.top = `${y}px`;
      if (html) node.innerHTML = html;
      this.layer.appendChild(node);
      return node;
    }

    sparks(x, y, { count = 14, color = '#f5d0fe', spread = 120, dir = 1 } = {}) {
      const g = this.g;
      for (let i = 0; i < count; i++) {
        const p = this.spawn('fx-spark', x, y);
        p.style.setProperty('--c', color);
        const ang = rand(-.9, .9) + (dir > 0 ? 0 : Math.PI), dist = rand(.35, 1) * spread * Math.max(.4, this.amp);
        g.fromTo(p, { x: 0, y: 0, scaleX: rand(1.4, 2.6), rotation: ang * 57.3, opacity: 1 },
          { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist + rand(10, 40), opacity: 0, duration: rand(.3, .6), ease: 'power3.out', onComplete: () => p.remove() });
      }
    }

    dust(x, y, count = 8, dir = 0) {
      const g = this.g;
      for (let i = 0; i < count; i++) {
        const p = this.spawn('fx-dust', x + rand(-20, 20), y);
        g.fromTo(p, { scale: rand(.4, .8), opacity: .7 }, { x: (dir || rand(-1, 1)) * rand(20, 70), y: -rand(6, 26), scale: rand(1.4, 2.4), opacity: 0, duration: rand(.5, .9), ease: 'power2.out', onComplete: () => p.remove() });
      }
    }

    say(text, kind = 'crit') {
      const g = this.g, c = this.callout;
      c.className = `fx-callout ${kind}`;
      c.textContent = text;
      g.killTweensOf(c);
      g.fromTo(c, { opacity: 0, scale: 2.2, rotation: -6, y: 0 }, { opacity: 1, scale: 1, rotation: -3, duration: .22, ease: 'back.out(2.5)' });
      g.to(c, { opacity: 0, y: -18, duration: .3, delay: .8, ease: 'power1.in' });
    }

    ghostTrail(count = 5) {
      const ghosts = [];
      for (let i = 0; i < count; i++) {
        const ghost = this.heroVisual.cloneNode(false);
        ghost.classList.add('fx-ghost');
        ghost.removeAttribute('style');
        this.hero.insertBefore(ghost, this.heroMotion);
        ghosts.push(ghost);
      }
      return (tl, at, travel) => ghosts.forEach((ghost, i) => {
        const p = (i + 1) / (count + 1);
        tl.fromTo(ghost, { xPercent: -50, x: travel * p, opacity: 0 }, { opacity: .5 - i * .07, duration: .02, immediateRender: false }, at + i * .016)
          .to(ghost, { opacity: 0, duration: .28, ease: 'power1.out', onComplete: () => ghost.remove() }, at + .04 + i * .028);
      });
    }

    // ---------- idle & tension ----------
    idle() {
      if (!this.enabled) return;
      this.killLoops();
      const g = this.g;
      this.pose('idle');
      g.set([this.heroMotion, this.monsterMotion], { transformOrigin: '50% 96%' });
      g.to([this.monsterMotion, this.monsterShadow], { x: 0, duration: .35, ease: 'power2.out', overwrite: 'auto' });
      g.to(this.heroMotion, { x: 0, y: 0, rotation: 0, duration: .25, ease: 'power2.out' });
      this.loops.push(
        g.to(this.heroMotion, { scaleY: 1.025, scaleX: .99, duration: .9, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
        g.to(this.monsterMotion, { scaleY: 1.03, scaleX: .985, y: -2, duration: 1.1, ease: 'sine.inOut', yoyo: true, repeat: -1 })
      );
      this.frame(FRAME.idle);
    }

    /* Hero runs in, boss crashes down and roars, name card slams in. */
    intro({ name = '', hp = 5, onLand } = {}) {
      if (!this.enabled) return null;
      this.stopAll();
      const g = this.g, tl = this.track(g.timeline());
      this.pose('running');
      g.set(this.monsterMotion, { opacity: 0 });
      g.set(this.monsterShadow, { opacity: 0 });
      tl.addLabel('drop', 1.0)
        .add(() => { this.engine?.stageDuel(); this.pose('idle'); this.sfx?.whoosh(.6); }, 'drop-=.02')
        .set(this.monsterMotion, { transformOrigin: '50% 96%' }, 'drop')
        .fromTo(this.monsterMotion, { y: -260, opacity: 1, scaleY: 1.18, scaleX: .86 }, { y: 0, duration: .32, ease: 'power3.in', immediateRender: false }, 'drop')
        .fromTo(this.monsterShadow, { scale: .2, opacity: 0 }, { scale: 1, opacity: 1, duration: .32, ease: 'power3.in', immediateRender: false }, 'drop')
        .addLabel('land', 'drop+=.32')
        .add(() => {
          this.sfx?.land();
          const r = this.rect(this.monster);
          this.dust(r.cx, r.y + r.h * .95, 14);
          onLand?.();
        }, 'land')
        .to(this.monsterMotion, { scaleY: .74, scaleX: 1.2, duration: .07, ease: 'power2.out' }, 'land')
        .add(this.shake(9, .36), 'land')
        .to(this.heroMotion, { y: -14, duration: .12, ease: 'power2.out', yoyo: true, repeat: 1 }, 'land+=.04')
        .to(this.monsterMotion, { scaleY: 1, scaleX: 1, duration: .55, ease: 'elastic.out(1, .4)' }, 'land+=.07')
        .add(() => { this.frame(FRAME.roar); this.sfx?.roar(1); }, 'land+=.3')
        .to(this.monsterMotion, { scaleY: 1.1, scaleX: .95, y: -8, duration: .2, ease: 'power2.out' }, 'land+=.3')
        .add(this.shake(4, .6), 'land+=.32')
        .to(this.monsterMotion, { scaleY: 1, scaleX: 1, y: 0, duration: .35, ease: 'power2.inOut' }, 'land+=.9')
        .add(() => this.frame(FRAME.idle), 'land+=1.0');
      if (name) {
        const banner = this.spawn('fx-banner', 0, 0, `<small>الزعيم</small><b>${esc(name)}</b><em>${hp} ضربات للفوز</em>`);
        g.set(banner, { opacity: 0 });
        tl.fromTo(banner, { x: 260, opacity: 0, skewX: -12 }, { x: 0, opacity: 1, skewX: 0, duration: .32, ease: 'power3.out', immediateRender: false }, 'land+=.15')
          .to(banner, { x: -260, opacity: 0, duration: .3, ease: 'power3.in', onComplete: () => banner.remove() }, 'land+=1.35');
      }
      tl.add(() => this.idle(), 'land+=1.1');
      return tl;
    }

    /* Countdown pressure: the boss stalks closer as time drains. */
    countdown(ms) {
      if (!this.enabled) return;
      this.warned = false;
      const g = this.g, creep = Math.min(this.gap() * .45, 70), duration = ms / 1000;
      this.loops.push(
        g.to(this.monsterMotion, { x: -creep, duration, ease: 'power1.in' }),
        g.to(this.monsterShadow, { x: -creep, duration, ease: 'power1.in' })
      );
    }

    warn() {
      if (!this.enabled || this.warned) return;
      this.warned = true;
      const g = this.g;
      this.frame(FRAME.coil);
      this.loops.push(
        g.to(this.monsterVisual, { filter: 'drop-shadow(0 0 16px rgba(255,40,80,.95)) brightness(1.15)', duration: .2, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
        g.fromTo(this.vignette, { opacity: 0 }, { opacity: .5 * Math.max(.5, this.amp), duration: .25, yoyo: true, repeat: -1, ease: 'sine.inOut' })
      );
      g.to(this.heroMotion, { scaleY: .94, scaleX: 1.04, duration: .3, ease: 'power2.out' });
    }

    calm() {
      this.killLoops();
      if (!this.enabled) return;
      this.g.to(this.vignette, { opacity: 0, duration: .15 });
      this.g.set(this.monsterVisual, { filter: 'none' });
    }

    // ---------- Le attacks ----------
    heroStrike({ word = '', crit = false, lethal = false, combo = 1, onImpact, onDeath, onSettled } = {}) {
      if (!this.enabled) return null;
      this.calm();
      const g = this.g, tl = this.track(g.timeline({ defaults: { overwrite: 'auto' } }));
      const travel = Math.min(this.gap() + 26, 260), target = this.rect(this.monsterMotion);
      const hit = { cx: target.cx, cy: target.y + target.h * .5 };
      const trail = this.ghostTrail(crit ? 6 : 4);
      g.set([this.heroMotion, this.monsterMotion], { transformOrigin: '50% 96%' });

      // anticipation
      tl.to(this.heroMotion, { x: -14, scaleX: 1.1, scaleY: .86, rotation: -5, duration: .1, ease: 'power2.out' })
        .add(() => { this.pose('attack'); this.sfx?.whoosh(crit ? 1.3 : 1); }, '>-0.01')
      // dash
        .addLabel('dash')
        .to(this.heroMotion, { x: travel, scaleX: 1.16, scaleY: .9, rotation: crit ? 6 : 3, duration: .1, ease: 'power4.in' }, 'dash')
        .to(this.heroShadow, { x: travel, scaleX: .7, opacity: .55, duration: .1, ease: 'power4.in' }, 'dash')
        .fromTo(this.speedlines, { opacity: 0 }, { opacity: .85 * this.amp, duration: .05, immediateRender: false }, 'dash')
        .to(this.speedlines, { opacity: 0, duration: .3 }, 'dash+=.12');
      trail(tl, tl.labels.dash, travel);

      // impact
      tl.addLabel('impact', 'dash+=.1')
        .add(() => {
          onImpact?.();
          this.sfx?.slash(crit); this.sfx?.impact(crit || lethal ? 1.25 : 1);
          this.frame(FRAME.recoil);
          const arc = this.spawn(`fx-arc${crit ? ' crit' : ''}`, hit.cx, hit.cy);
          g.fromTo(arc, { scale: .3, rotation: -50, opacity: 1 }, { scale: crit ? 1.7 : 1.35, rotation: 30, opacity: 0, duration: .36, ease: 'expo.out', onComplete: () => arc.remove() });
          if (crit) {
            const arc2 = this.spawn('fx-arc crit', hit.cx, hit.cy);
            g.fromTo(arc2, { scale: .3, rotation: 140, opacity: 1 }, { scale: 1.5, rotation: 210, opacity: 0, duration: .4, delay: .05, ease: 'expo.out', onComplete: () => arc2.remove() });
          }
          const ring = this.spawn('fx-ring', hit.cx, hit.cy);
          g.fromTo(ring, { scale: .2, opacity: .95 }, { scale: crit ? 3 : 2.2, opacity: 0, duration: .45, ease: 'expo.out', onComplete: () => ring.remove() });
          this.sparks(hit.cx, hit.cy, { count: crit ? 22 : 14, color: crit ? '#fde68a' : '#f5d0fe', spread: crit ? 150 : 110 });
          if (crit) { this.say('ضربة حاسمة!', 'crit'); this.sfx?.critCallout(); }
        }, 'impact')
        .add(this.flashScreen('#ffffff', crit || lethal ? .8 : .5, .22), 'impact')
        .set(this.monsterVisual, { filter: 'brightness(3.4) saturate(0)' }, 'impact')
        .add(this.shake(crit || lethal ? 14 : 9 + Math.min(combo, 4), .38, hit, crit || lethal ? 1.08 : 1.05), 'impact')
        .addLabel('react', `impact+=${lethal ? .22 : crit ? .12 : .07}`);   // hit-stop

      // reaction
      tl.set(this.monsterVisual, { filter: 'brightness(1.7)' }, 'react')
        .to(this.monsterVisual, { filter: 'brightness(1)', duration: .25 }, 'react+=.05')
        .to(this.monsterMotion, { x: '+=' + (crit ? 52 : 36), y: -12, rotation: 14, scaleX: .9, duration: .16, ease: 'power3.out' }, 'react')
        .to(this.monsterMotion, { y: 0, rotation: 5, duration: .22, ease: 'bounce.out' }, 'react+=.16')
        .to(this.heroMotion, { x: travel + 16, scaleX: 1, scaleY: 1, rotation: 0, duration: .14, ease: 'power2.out' }, 'react')
        .add(() => {
          const pop = this.spawn('fx-pop', hit.cx, target.y + 6, `<b lang="de" dir="ltr">${esc(word)}</b>${combo > 1 ? `<em>كومبو ×${combo}</em>` : ''}`);
          g.fromTo(pop, { y: 12, scale: .4, opacity: 0 }, { y: -22, scale: 1, opacity: 1, duration: .3, ease: 'back.out(3)' });
          g.to(pop, { y: -52, opacity: 0, duration: .4, ease: 'power1.in', delay: .65, onComplete: () => pop.remove() });
        }, 'react');

      if (lethal) {
        tl.addLabel('death', 'react+=.3')
          .add(() => { tl.timeScale(.45); onDeath?.(); this.sfx?.shatter(); }, 'death')
          .to(this.monsterVisual, { filter: 'brightness(4) saturate(0)', duration: .08, yoyo: true, repeat: 5 }, 'death')
          .to(this.monsterMotion, { rotation: -8, x: '+=10', duration: .5, ease: 'power1.inOut' }, 'death')
          .add(() => {
            tl.timeScale(1);
            const r = this.rect(this.monsterMotion);
            this.sparks(r.cx, r.cy, { count: 36, color: '#ffffff', spread: 220 });
            this.sparks(r.cx, r.cy, { count: 20, color: '#c084fc', spread: 160 });
            this.dust(r.cx, r.y + r.h * .9, 16);
          }, 'death+=.55')
          .add(this.flashScreen('#ffffff', .9, .5), 'death+=.55')
          .add(this.shake(16, .6, this.rect(this.monsterMotion), 1.1), 'death+=.55')
          .to(this.monsterMotion, { scaleX: 1.3, scaleY: .2, y: 30, opacity: 0, duration: .32, ease: 'power3.in' }, 'death+=.58')
          .to(this.monsterShadow, { scale: .1, opacity: 0, duration: .4, ease: 'power2.in' }, 'death+=.58')
          .to(this.heroMotion, { x: travel * .4, duration: .3, ease: 'power2.out' }, 'death+=.7')
          .add(() => { this.pose('victory'); this.say('انتصار!', 'win'); }, 'death+=.95')
          .to(this.heroMotion, { y: -46, duration: .26, ease: 'power2.out', yoyo: true, repeat: 1 }, 'death+=.95')
          .to(this.heroShadow, { x: travel * .4, scale: .7, duration: .26, yoyo: true, repeat: 1 }, 'death+=.95')
          .add(() => onSettled?.(), 'death+=1.6');
        return tl;
      }

      // follow-through: flip back home
      tl.addLabel('home', 'react+=.24')
        .add(() => this.pose('running'), 'home')
        .to(this.heroMotion, { keyframes: [{ x: travel * .5, y: -38, rotation: crit ? -180 : -20, duration: .22, ease: 'power2.out' }, { x: 0, y: 0, rotation: crit ? -360 : 0, duration: .2, ease: 'power2.in' }] }, 'home')
        .to(this.heroShadow, { x: 0, scaleX: 1, opacity: 1, duration: .42, ease: 'power2.inOut' }, 'home')
        .set(this.heroMotion, { rotation: 0 }, 'home+=.43')
        .add(() => { this.pose('idle'); this.sfx?.footstep(); const r = this.rect(this.heroMotion); this.dust(r.cx, r.y + r.h * .95, 4, -1); }, 'home+=.42')
        .to(this.monsterMotion, { x: 0, rotation: 0, scaleX: 1, duration: .45, ease: 'power2.inOut' }, 'home+=.05')
        .to(this.monsterShadow, { x: 0, duration: .45, ease: 'power2.inOut' }, 'home+=.05')
        .add(() => { this.frame(FRAME.roar); this.sfx?.roar(.45, 1.15); }, 'home+=.25')
        .add(() => this.frame(FRAME.idle), 'home+=.6')
        .add(() => { this.idle(); onSettled?.(); }, 'home+=.65');
      return tl;
    }

    // ---------- the boss attacks ----------
    monsterStrike({ timedOut = false, lethal = false, onImpact, onSettled } = {}) {
      if (!this.enabled) return null;
      this.calm();
      const g = this.g, tl = this.track(g.timeline({ defaults: { overwrite: 'auto' } }));
      const cur = Number(g.getProperty(this.monsterMotion, 'x')) || 0, reach = Math.min(this.gap() + 34, 280), lunge = reach - cur, victim = this.rect(this.heroMotion);
      g.set([this.heroMotion, this.monsterMotion], { transformOrigin: '50% 96%' });

      tl.add(() => { this.frame(FRAME.roar); this.sfx?.roar(.7, .9); }, 0)
        .to(this.monsterMotion, { x: '+=22', scaleX: .86, scaleY: 1.08, rotation: 6, duration: timedOut ? .18 : .24, ease: 'power2.out' }, 0)
        .to(this.heroMotion, { scaleY: .92, scaleX: 1.05, duration: .2 }, 0)
        .add(() => this.frame(FRAME.coil), timedOut ? .16 : .22)
        .addLabel('lunge', timedOut ? .24 : .3)
        .add(() => { this.frame(FRAME.swipe); this.sfx?.whoosh(.9); }, 'lunge')
        .to(this.monsterMotion, { x: -lunge, y: -10, scaleX: 1.14, scaleY: .93, rotation: -7, duration: .11, ease: 'power4.in' }, 'lunge')
        .to(this.monsterShadow, { x: -lunge, scaleX: .8, duration: .11, ease: 'power4.in' }, 'lunge')
        .addLabel('impact', 'lunge+=.11')
        .add(() => {
          onImpact?.();
          this.pose('hurt');
          this.sfx?.claw(); this.sfx?.hurt();
          for (let i = 0; i < 3; i++) {
            const claw = this.spawn('fx-claw', victim.cx + (i - 1) * 16, victim.cy);
            g.fromTo(claw, { scaleY: 0, opacity: 1, rotation: 30 }, { scaleY: 1, duration: .08, delay: i * .025, ease: 'power3.out' });
            g.to(claw, { opacity: 0, duration: .3, delay: .18 + i * .025, onComplete: () => claw.remove() });
          }
          this.sparks(victim.cx, victim.cy, { count: 14, color: '#ff5a7a', spread: 110, dir: -1 });
        }, 'impact')
        .add(this.flashScreen('#ff2d55', .45, .32), 'impact')
        .set(this.heroVisual, { filter: 'brightness(2.2) sepia(1) saturate(7) hue-rotate(-45deg)' }, 'impact')
        .add(this.shake(13, .45, victim, 1.06), 'impact')
        .fromTo(this.vignette, { opacity: .9 * Math.max(.5, this.amp) }, { opacity: 0, duration: .8, ease: 'power2.out', immediateRender: false }, 'impact')
        .addLabel('react', `impact+=${lethal ? .2 : .08}`);   // hit-stop

      if (lethal) {
        tl.set(this.heroVisual, { filter: 'brightness(1.3)' }, 'react')
          .to(this.heroMotion, { x: -70, y: -30, rotation: -25, duration: .22, ease: 'power3.out' }, 'react')
          .to(this.heroMotion, { y: 6, rotation: -82, duration: .3, ease: 'bounce.out' }, 'react+=.22')
          .add(() => { const r = this.rect(this.heroMotion); this.dust(r.cx, r.y + r.h, 12, -1); this.sfx?.impact(.6); }, 'react+=.4')
          .to(this.heroVisual, { filter: 'grayscale(1) brightness(.6)', duration: .6 }, 'react+=.3')
          .to(this.monsterMotion, { x: -lunge * .55, y: 0, rotation: 0, scaleX: 1, scaleY: 1, duration: .3, ease: 'power2.out' }, 'react+=.1')
          .add(() => { this.frame(FRAME.roar); this.sfx?.roar(1.2, .85); this.say('هُزمت', 'lose'); }, 'react+=.5')
          .to(this.monsterMotion, { scaleY: 1.12, y: -10, duration: .25, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 'react+=.5')
          .add(() => onSettled?.(), 'react+=1.7');
        return tl;
      }

      tl.set(this.heroVisual, { filter: 'brightness(1.35)' }, 'react')
        .to(this.heroMotion, { x: -54, y: -18, rotation: -16, scaleX: 1, scaleY: 1, duration: .18, ease: 'power3.out' }, 'react')
        .to(this.heroMotion, { y: 0, rotation: -6, duration: .2, ease: 'bounce.out' }, 'react+=.18')
        .add(() => { const r = this.rect(this.heroMotion); this.dust(r.cx, r.y + r.h * .95, 6, -1); }, 'react+=.2')
        .to(this.heroVisual, { filter: 'brightness(1)', duration: .35 }, 'react+=.1')
        .to(this.monsterMotion, { x: -lunge * .6, y: 0, scaleX: 1, scaleY: 1, rotation: 0, duration: .16, ease: 'power2.out' }, 'react')
        .add(() => { this.frame(FRAME.roar); this.sfx?.roar(.5, 1.05); }, 'react+=.22')
        .to(this.monsterMotion, { scaleY: 1.08, y: -6, duration: .14, yoyo: true, repeat: 1, ease: 'power2.out' }, 'react+=.24')
        .add(() => this.pose('running'), 'react+=.5')
        .to(this.heroMotion, { x: 0, rotation: 0, duration: .35, ease: 'power2.inOut' }, 'react+=.5')
        .add(() => this.frame(FRAME.idle), 'react+=.58')
        .to(this.monsterMotion, { x: 0, duration: .4, ease: 'power2.inOut' }, 'react+=.5')
        .to(this.monsterShadow, { x: 0, scaleX: 1, duration: .4, ease: 'power2.inOut' }, 'react+=.5')
        .add(() => { this.idle(); onSettled?.(); }, 'react+=.92');
      return tl;
    }

    pulse(el) {
      if (!this.enabled || !el) return;
      this.g.timeline()
        .fromTo(el, { scale: 1 }, { scale: 1.5, duration: .1, ease: 'power2.out' })
        .to(el, { scale: .8, rotation: -16, y: 5, duration: .32, ease: 'back.in(2)' })
        .to(el, { scale: 1, rotation: 0, y: 0, duration: .3, ease: 'power2.out' });
    }

    bar(el) {
      if (!this.enabled || !el) return;
      this.g.fromTo(el, { xPercent: -50, x: 0 }, { keyframes: [{ x: -6 }, { x: 6 }, { x: -3 }, { x: 0 }], duration: .3, ease: 'none' });
    }
  }

  global.LegramCombatDirector = CombatDirector;
})(window);
