(function (global) {
  'use strict';

  const SAVE_KEY = 'legram-state';
  const SAVE_VERSION = 5;
  const DEFAULT_STREAK = Object.freeze({
    current: 0, best: 0, lastDay: null, freezes: 1, goal: 30, days: {}, frozen: []
  });
  const DEFAULT_STATE = Object.freeze({
    version: SAVE_VERSION,
    unlocked: 1,
    stars: {},
    mistakes: {},
    sound: true,
    streak: DEFAULT_STREAK,
    stats: { sessions: 0, levelsStarted: 0, levelsCompleted: 0 },
    wallet: { wordShards: 0 },
    inventory: { selectedHero: 'le', unlockedHeroes: ['le'] },
    phrases: { level: null, records: {}, progress: {}, scores: {}, stars: {}, completed: {} }
  });

  const clone = value => JSON.parse(JSON.stringify(value));

  function migrateState(value) {
    const source = value && typeof value === 'object' ? value : {};
    const legacyPhrases = source.phrases && typeof source.phrases === 'object' ? source.phrases : {};
    const records = { ...(legacyPhrases.records || {}) };
    ['home', 'work', 'market'].forEach(placeId => {
      const key = `A1:${placeId}`;
      if (records[key]) return;
      const progress = Number(legacyPhrases.progress?.[placeId]) || 0;
      const correct = Number(legacyPhrases.scores?.[placeId]) || 0;
      const stars = Number(legacyPhrases.stars?.[placeId]) || 0;
      const completed = Boolean(legacyPhrases.completed?.[placeId]);
      if (progress || correct || stars || completed) {
        records[key] = { progress, correct, stars, completed, attempts: 0, accuracyTotal: 0, vocabularyTotal: 0 };
      }
    });
    return {
      ...clone(DEFAULT_STATE),
      ...source,
      version: SAVE_VERSION,
      stars: source.stars && typeof source.stars === 'object' ? source.stars : {},
      mistakes: source.mistakes && typeof source.mistakes === 'object' ? source.mistakes : {},
      streak: {
        ...clone(DEFAULT_STREAK),
        ...(source.streak && typeof source.streak === 'object' ? source.streak : {}),
        days: { ...((source.streak || {}).days || {}) },
        frozen: Array.isArray((source.streak || {}).frozen) ? [...source.streak.frozen] : []
      },
      stats: { ...DEFAULT_STATE.stats, ...(source.stats || {}) },
      wallet: { ...DEFAULT_STATE.wallet, ...(source.wallet || {}) },
      inventory: { ...DEFAULT_STATE.inventory, ...(source.inventory || {}) },
      phrases: {
        ...DEFAULT_STATE.phrases,
        ...legacyPhrases,
        level: ['A1', 'A2', 'B1', 'B2', 'C1'].includes(legacyPhrases.level) ? legacyPhrases.level : null,
        records,
        progress: { ...(legacyPhrases.progress || {}) },
        scores: { ...(legacyPhrases.scores || {}) },
        stars: { ...(legacyPhrases.stars || {}) },
        completed: { ...(legacyPhrases.completed || {}) }
      }
    };
  }

  function createStore(storage = global.localStorage, key = SAVE_KEY) {
    let state;
    try { state = migrateState(JSON.parse(storage.getItem(key) || 'null')); }
    catch { state = migrateState(null); }

    const persist = () => {
      try { storage.setItem(key, JSON.stringify(state)); } catch {}
      return state;
    };

    return {
      get: () => state,
      save: () => persist(),
      update(mutator) {
        const next = mutator(state);
        if (next && typeof next === 'object') state = migrateState(next);
        return persist();
      },
      replace: value => { state = migrateState(value); return persist(); },
      reset: () => { state = migrateState(null); return persist(); },
      key,
      version: SAVE_VERSION
    };
  }

  function normalizeGerman(value) {
    return String(value || '')
      .toLocaleLowerCase('de-DE').trim()
      .replace(/[ä]/g, 'a').replace(/[ö]/g, 'o').replace(/[ü]/g, 'u').replace(/ß/g, 'ss')
      .replace(/[^a-z\s-]/g, '').replace(/\s+/g, ' ')
      .replace(/^(der|die|das|den|dem|ein|eine|einen)\s+/, '');
  }

  function editDistance(a, b) {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let previous = row[0]; row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const old = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
        previous = old;
      }
    }
    return row[b.length];
  }

  function isCorrectAnswer(spoken, target) {
    const answer = normalizeGerman(spoken), expected = normalizeGerman(target);
    if (!answer || !expected) return false;
    if (answer === expected) return true;
    if (answer.includes(' ') || expected.includes(' ')) return false;
    return expected.length >= 7 && answer.length >= 7 && editDistance(answer, expected) === 1;
  }

  function createCatalog(worlds, options = {}) {
    const wordsPerLevel = options.wordsPerLevel || 10;
    const levelsPerWorld = options.levelsPerWorld || 10;
    const normalized = worlds.map((world, worldIndex) => {
      const words = world.words.slice(0, wordsPerLevel * levelsPerWorld);
      if (!world.id || words.length < wordsPerLevel) throw new Error(`Invalid world content at index ${worldIndex}`);
      return { ...world, words };
    });
    return Object.freeze({
      worlds: normalized,
      wordsPerLevel,
      levelsPerWorld,
      totalLevels: normalized.length * levelsPerWorld,
      world: index => normalized[index],
      globalLevel: (worldIndex, levelIndex) => worldIndex * levelsPerWorld + levelIndex + 1,
      levelWords(worldIndex, levelIndex) {
        return normalized[worldIndex].words
          .slice(levelIndex * wordsPerLevel, (levelIndex + 1) * wordsPerLevel)
          .map(entry => { const [pic, word] = entry.split('|'); return { pic, word }; });
      }
    });
  }

  global.LegramCore = Object.freeze({
    SAVE_KEY, SAVE_VERSION, DEFAULT_STREAK, createStore, createCatalog, migrateState,
    normalizeGerman, editDistance, isCorrectAnswer
  });
})(window);
