/* Legram — طبقة الاحتفال: كونفيتي، عدّادات متصاعدة، ونبضات على عناصر الواجهة.
 * كل شيء يرسم على كانفس واحد فوق الشاشة، ويتوقف تلقائيًا حين تفرغ الجسيمات
 * حتى لا تظل حلقة رسم تدور في الخلفية.
 */
(function (global) {
  'use strict';

  const COLORS = ['#f6c453', '#45dda5', '#8b5cf6', '#2e91ef', '#f04474', '#f58236', '#87f3df'];
  const reduceMotion = () => global.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  class Confetti {
    constructor() {
      this.canvas = null;
      this.ctx = null;
      this.pieces = [];
      this.raf = null;
      this.last = 0;
    }

    mount() {
      if (this.canvas) return this.canvas;
      const canvas = document.createElement('canvas');
      canvas.className = 'confetti-layer';
      canvas.setAttribute('aria-hidden', 'true');
      document.body.appendChild(canvas);
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.resize();
      global.addEventListener('resize', () => this.resize(), { passive: true });
      return canvas;
    }

    resize() {
      if (!this.canvas) return;
      const dpr = Math.min(2, global.devicePixelRatio || 1);
      this.canvas.width = Math.floor(innerWidth * dpr);
      this.canvas.height = Math.floor(innerHeight * dpr);
      this.canvas.style.width = `${innerWidth}px`;
      this.canvas.style.height = `${innerHeight}px`;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* دفعة واحدة من نقطة. spread بالدرجات، power يتحكم بالسرعة الابتدائية. */
    burst({ x = innerWidth / 2, y = innerHeight * 0.4, count = 70, power = 13, spread = 360, colors = COLORS, gravity = 0.32 } = {}) {
      if (reduceMotion()) return;
      this.mount();
      const half = (spread * Math.PI) / 360;
      const base = -Math.PI / 2;
      for (let i = 0; i < count; i++) {
        const angle = base + (Math.random() * 2 - 1) * half;
        const speed = power * (0.45 + Math.random() * 0.75);
        this.pieces.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 5 + Math.random() * 7,
          ratio: 0.4 + Math.random() * 0.6,
          color: colors[(Math.random() * colors.length) | 0],
          spin: (Math.random() * 2 - 1) * 0.3,
          rotation: Math.random() * Math.PI,
          drag: 0.985 + Math.random() * 0.01,
          gravity,
          life: 0,
          ttl: 1700 + Math.random() * 1400
        });
      }
      this.start();
    }

    /* دفعتان من أسفل الحافتين — شكل "المدفعين" الكلاسيكي في شاشات الفوز. */
    cannons(options = {}) {
      const y = innerHeight * 0.92;
      this.burst({ ...options, x: innerWidth * 0.08, y, spread: 70, power: 17, count: options.count || 55 });
      this.burst({ ...options, x: innerWidth * 0.92, y, spread: 70, power: 17, count: options.count || 55 });
    }

    /* كونفيتي ينهمر من الأعلى لفترة — للحظات الكبيرة مثل زيادة السلسلة. */
    rain(duration = 1400, perTick = 7) {
      if (reduceMotion()) return;
      const until = performance.now() + duration;
      const drop = () => {
        if (performance.now() > until) return;
        this.mount();
        for (let i = 0; i < perTick; i++) {
          this.pieces.push({
            x: Math.random() * innerWidth,
            y: -20,
            vx: (Math.random() * 2 - 1) * 1.6,
            vy: 2 + Math.random() * 3,
            size: 5 + Math.random() * 6,
            ratio: 0.4 + Math.random() * 0.6,
            color: COLORS[(Math.random() * COLORS.length) | 0],
            spin: (Math.random() * 2 - 1) * 0.25,
            rotation: Math.random() * Math.PI,
            drag: 0.995,
            gravity: 0.06,
            life: 0,
            ttl: 3200
          });
        }
        this.start();
        setTimeout(drop, 60);
      };
      drop();
    }

    /* دفعة متمركزة على عنصر في الصفحة. */
    fromElement(element, options = {}) {
      if (!element) return;
      const rect = element.getBoundingClientRect();
      this.burst({ ...options, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    }

    start() {
      if (this.raf) return;
      this.last = performance.now();
      const frame = now => {
        const dt = Math.min(34, now - this.last) / 16.67;
        this.last = now;
        this.step(dt, now - this.last);
        this.draw();
        if (this.pieces.length) this.raf = requestAnimationFrame(frame);
        else { this.raf = null; this.ctx?.clearRect(0, 0, innerWidth, innerHeight); }
      };
      this.raf = requestAnimationFrame(frame);
    }

    step(dt) {
      const alive = [];
      for (const p of this.pieces) {
        p.life += dt * 16.67;
        if (p.life > p.ttl || p.y > innerHeight + 40) continue;
        p.vx *= p.drag;
        p.vy = p.vy * p.drag + p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rotation += p.spin * dt;
        alive.push(p);
      }
      this.pieces = alive;
    }

    draw() {
      const ctx = this.ctx;
      if (!ctx) return;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of this.pieces) {
        const fade = p.life > p.ttl - 420 ? Math.max(0, (p.ttl - p.life) / 420) : 1;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -(p.size * p.ratio) / 2, p.size, p.size * p.ratio);
        ctx.restore();
      }
    }

    clear() {
      this.pieces = [];
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
      this.ctx?.clearRect(0, 0, innerWidth, innerHeight);
    }
  }

  const confetti = new Confetti();

  /* عدّاد يتصاعد إلى الرقم النهائي — يحترم إعداد تقليل الحركة. */
  function countUp(element, to, { duration = 900, suffix = '', from = 0 } = {}) {
    if (!element) return;
    const target = Math.round(Number(to) || 0);
    if (reduceMotion() || duration <= 0) { element.textContent = `${target}${suffix}`; return; }
    const start = performance.now();
    const span = target - from;
    const frame = now => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      element.textContent = `${Math.round(from + span * eased)}${suffix}`;
      if (t < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /* نبضة قصيرة على عنصر: تُستخدم لرقم السلسلة حين يزيد. */
  function pulse(element, className = 'celebrate-pop') {
    if (!element) return;
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
    setTimeout(() => element.classList.remove(className), 900);
  }

  /* رقم يطير من عنصر إلى أعلى ويتلاشى — لعرض الـ XP المكتسب. */
  function floatText(element, text, { color = 'var(--amber-400)' } = {}) {
    if (!element || reduceMotion()) return;
    const rect = element.getBoundingClientRect();
    const node = document.createElement('b');
    node.className = 'float-gain';
    node.textContent = text;
    node.style.color = color;
    node.style.left = `${rect.left + rect.width / 2}px`;
    node.style.top = `${rect.top}px`;
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 1400);
  }

  global.LegramCelebrate = Object.freeze({ confetti, countUp, pulse, floatText, COLORS });
})(window);
