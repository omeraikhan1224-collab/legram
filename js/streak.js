/* Legram — نظام السلسلة اليومية (Streak).
 * يحسب الأيام المتتالية التي تعلّم فيها المستخدم، ويحفظ هدفًا يوميًا بالـ XP،
 * ويمنح "تجميدة" تحمي السلسلة من يوم غياب واحد. كل شيء بالتوقيت المحلي للجهاز.
 */
(function (global) {
  'use strict';

  const DAY_MS = 86400000;
  const MAX_FREEZES = 2;
  const FREEZE_EVERY = 5;        // تُمنح تجميدة كل 5 أيام من السلسلة
  const HISTORY_DAYS = 70;       // نحتفظ بسجل آخر 70 يومًا فقط
  const DEFAULT_GOAL = 30;

  const WEEKDAYS_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

  const pad = n => String(n).padStart(2, '0');

  /* مفتاح اليوم بالتقويم المحلي — لا نستخدم toISOString لأنه يحوّل إلى UTC. */
  function dayKey(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function dayDate(key) {
    const [y, m, d] = String(key).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }

  /* فرق الأيام بين مفتاحين — يتجاهل الساعات وفروق التوقيت الصيفي. */
  function daysBetween(fromKey, toKey) {
    if (!fromKey || !toKey) return Infinity;
    const a = dayDate(fromKey), b = dayDate(toKey);
    return Math.round((b - a) / DAY_MS);
  }

  function shiftKey(key, offset) {
    const d = dayDate(key);
    d.setDate(d.getDate() + offset);
    return dayKey(d);
  }

  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;

  function normalize(value) {
    const source = value && typeof value === 'object' ? value : {};
    const days = {};
    for (const [key, xp] of Object.entries(source.days || {})) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(key)) days[key] = Math.max(0, Math.round(number(xp)));
    }
    return {
      current: Math.max(0, Math.round(number(source.current))),
      best: Math.max(0, Math.round(number(source.best))),
      lastDay: /^\d{4}-\d{2}-\d{2}$/.test(source.lastDay || '') ? source.lastDay : null,
      /* تجميدة واحدة هدية للمستخدم الجديد؛ الصفر الصريح يبقى صفرًا (أُنفقت). */
      freezes: Math.min(MAX_FREEZES, Math.max(0, Math.round(
        Number.isFinite(Number(source.freezes)) ? Number(source.freezes) : 1
      ))),
      goal: Math.max(10, Math.round(number(source.goal)) || DEFAULT_GOAL),
      days,
      frozen: Array.isArray(source.frozen) ? source.frozen.filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)) : []
    };
  }

  function prune(streak, today = dayKey()) {
    const limit = shiftKey(today, -HISTORY_DAYS);
    for (const key of Object.keys(streak.days)) if (key < limit) delete streak.days[key];
    streak.frozen = streak.frozen.filter(key => key >= limit);
    return streak;
  }

  /* السلسلة تسقط وحدها إذا مرّ يومان دون نشاط — نحسبها عند العرض، لا عند الحفظ فقط. */
  function liveCurrent(streak, today = dayKey()) {
    if (!streak.lastDay) return 0;
    const gap = daysBetween(streak.lastDay, today);
    if (gap <= 0) return streak.current;
    if (gap === 1) return streak.current;          // أمس — ما زالت حيّة حتى نهاية اليوم
    if (gap === 2 && streak.freezes > 0) return streak.current; // تجميدة ستُستهلك عند أول نشاط
    return 0;
  }

  function create(options = {}) {
    const read = options.read;                      // () => state
    const persist = options.persist || (() => {});  // () => void

    const streakOf = () => {
      const state = read();
      state.streak = normalize(state.streak);
      return state.streak;
    };

    return {
      DEFAULT_GOAL, MAX_FREEZES, WEEKDAYS_AR, dayKey, shiftKey, daysBetween,

      get() { return streakOf(); },

      /* ملخّص جاهز للعرض دون أي تعديل على الحالة. */
      summary(today = dayKey()) {
        const streak = streakOf();
        const current = liveCurrent(streak, today);
        const todayXp = number(streak.days[today]);
        return {
          current,
          best: Math.max(streak.best, current),
          freezes: streak.freezes,
          goal: streak.goal,
          todayXp,
          goalMet: todayXp >= streak.goal,
          activeToday: Boolean(streak.days[today]),
          atRisk: current > 0 && !streak.days[today],
          lastDay: streak.lastDay
        };
      },

      /* آخر سبعة أيام منتهية باليوم الحالي — للشريط الأسبوعي. */
      week(today = dayKey()) {
        const streak = streakOf();
        return Array.from({ length: 7 }, (_, i) => {
          const key = shiftKey(today, i - 6);
          const xp = number(streak.days[key]);
          return {
            key,
            xp,
            label: WEEKDAYS_AR[dayDate(key).getDay()],
            done: xp > 0,
            frozen: streak.frozen.includes(key),
            isToday: key === today,
            future: false
          };
        });
      },

      setGoal(value) {
        const streak = streakOf();
        streak.goal = Math.max(10, Math.round(number(value)) || DEFAULT_GOAL);
        persist();
        return streak.goal;
      },

      /* تُستدعى عند إنهاء أي نشاط تعليمي. تُرجع ما تغيّر لتقرر الواجهة ماذا تحتفل به. */
      register(xp = 0, when = new Date()) {
        const streak = streakOf();
        const today = dayKey(when);
        const gain = Math.max(0, Math.round(number(xp)));

        const xpBefore = number(streak.days[today]);
        const previous = streak.current;
        const alreadyToday = Boolean(streak.lastDay === today);

        streak.days[today] = xpBefore + gain;

        let usedFreeze = false;
        if (!alreadyToday) {
          const gap = daysBetween(streak.lastDay, today);
          if (!streak.lastDay || gap > 2 || (gap === 2 && streak.freezes <= 0)) {
            streak.current = 1;
          } else if (gap === 2) {
            streak.freezes -= 1;
            streak.frozen.push(shiftKey(today, -1));
            usedFreeze = true;
            streak.current += 1;
          } else {
            streak.current += 1;   // gap === 1، أو تاريخ أقدم من المتوقع (ساعة الجهاز تغيّرت)
          }
          streak.lastDay = today;
        }

        let earnedFreeze = false;
        if (!alreadyToday && streak.current > 0 && streak.current % FREEZE_EVERY === 0 && streak.freezes < MAX_FREEZES) {
          streak.freezes += 1;
          earnedFreeze = true;
        }

        const newRecord = streak.current > streak.best && streak.current > 1;
        streak.best = Math.max(streak.best, streak.current);

        prune(streak, today);
        persist();

        const xpAfter = streak.days[today];
        return {
          current: streak.current,
          previous,
          best: streak.best,
          increased: !alreadyToday,
          firstEver: !alreadyToday && previous === 0 && streak.current === 1,
          usedFreeze,
          earnedFreeze,
          newRecord,
          freezes: streak.freezes,
          goal: streak.goal,
          todayXp: xpAfter,
          gained: gain,
          goalJustReached: xpBefore < streak.goal && xpAfter >= streak.goal
        };
      }
    };
  }

  /* دمج سلسلتين من جهازين — نأخذ الأفضل دائمًا حتى لا يخسر المستخدم تقدّمه. */
  function merge(left, right) {
    const a = normalize(left), b = normalize(right);
    const days = { ...a.days };
    for (const [key, xp] of Object.entries(b.days)) days[key] = Math.max(number(days[key]), number(xp));
    const lastDay = [a.lastDay, b.lastDay].filter(Boolean).sort().pop() || null;
    return prune({
      current: Math.max(a.current, b.current),
      best: Math.max(a.best, b.best),
      lastDay,
      freezes: Math.min(MAX_FREEZES, Math.max(a.freezes, b.freezes)),
      goal: Math.max(a.goal, b.goal),
      days,
      frozen: [...new Set([...a.frozen, ...b.frozen])]
    }, lastDay || dayKey());
  }

  global.LegramStreak = Object.freeze({
    create, merge, normalize, dayKey, shiftKey, daysBetween,
    DEFAULT_GOAL, MAX_FREEZES, WEEKDAYS_AR
  });
})(window);
