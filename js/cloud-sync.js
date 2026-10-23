(function (global) {
  'use strict';

  const DEVICE_TOKEN_KEY = 'legram-device-token';
  const SYNC_META_KEY = 'legram-cloud-meta';

  const clone = value => JSON.parse(JSON.stringify(value));
  const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const maxMap = (left, right) => {
    const merged = { ...object(left) };
    for (const [key, value] of Object.entries(object(right))) merged[key] = Math.max(number(merged[key]), number(value));
    return merged;
  };
  const orMap = (left, right) => {
    const merged = {}, keys = new Set([...Object.keys(object(left)), ...Object.keys(object(right))]);
    for (const key of keys) merged[key] = Boolean(object(left)[key] || object(right)[key]);
    return merged;
  };

  function strongerRecord(left, right) {
    const a = object(left), b = object(right);
    const rank = record => [
      record.completed ? 1 : 0,
      number(record.stars),
      number(record.progress),
      number(record.correct),
      number(record.accuracyTotal),
      number(record.vocabularyTotal)
    ];
    const ar = rank(a), br = rank(b);
    for (let index = 0; index < ar.length; index++) {
      if (ar[index] !== br[index]) return clone(ar[index] > br[index] ? a : b);
    }
    return clone(Object.keys(b).length ? b : a);
  }

  function mergeRecords(left, right) {
    const merged = {}, keys = new Set([...Object.keys(object(left)), ...Object.keys(object(right))]);
    for (const key of keys) merged[key] = strongerRecord(object(left)[key], object(right)[key]);
    return merged;
  }

  function mergeProgress(localState, cloudState) {
    const local = object(localState), cloud = object(cloudState);
    const localPhrases = object(local.phrases), cloudPhrases = object(cloud.phrases);
    const localInventory = object(local.inventory), cloudInventory = object(cloud.inventory);
    return {
      ...cloud,
      ...local,
      version: Math.max(1, number(local.version) || number(cloud.version) || 1),
      unlocked: Math.max(1, number(local.unlocked), number(cloud.unlocked)),
      stars: maxMap(cloud.stars, local.stars),
      mistakes: Object.prototype.hasOwnProperty.call(local, 'mistakes') ? clone(object(local.mistakes)) : clone(object(cloud.mistakes)),
      sound: local.sound !== false,
      stats: {
        sessions: Math.max(number(cloud.stats?.sessions), number(local.stats?.sessions)),
        levelsStarted: Math.max(number(cloud.stats?.levelsStarted), number(local.stats?.levelsStarted)),
        levelsCompleted: Math.max(number(cloud.stats?.levelsCompleted), number(local.stats?.levelsCompleted))
      },
      wallet: { wordShards: Math.max(number(cloud.wallet?.wordShards), number(local.wallet?.wordShards)) },
      inventory: {
        ...cloudInventory,
        ...localInventory,
        selectedHero: localInventory.selectedHero || cloudInventory.selectedHero || 'le',
        unlockedHeroes: [...new Set([...(cloudInventory.unlockedHeroes || []), ...(localInventory.unlockedHeroes || []), 'le'])]
      },
      phrases: {
        ...cloudPhrases,
        ...localPhrases,
        level: localPhrases.level || cloudPhrases.level || null,
        records: mergeRecords(cloudPhrases.records, localPhrases.records),
        progress: maxMap(cloudPhrases.progress, localPhrases.progress),
        scores: maxMap(cloudPhrases.scores, localPhrases.scores),
        stars: maxMap(cloudPhrases.stars, localPhrases.stars),
        completed: orMap(cloudPhrases.completed, localPhrases.completed)
      }
    };
  }

  function exportProgress(state) {
    const source = clone(object(state));
    delete source.sound;
    return source;
  }

  function hasMeaningfulProgress(state) {
    const value = object(state), phrases = object(value.phrases);
    return number(value.unlocked) > 1 ||
      Object.keys(object(value.stars)).length > 0 ||
      Object.keys(object(value.mistakes)).length > 0 ||
      number(value.stats?.levelsStarted) > 0 ||
      number(value.stats?.levelsCompleted) > 0 ||
      number(value.wallet?.wordShards) > 0 ||
      Object.keys(object(phrases.records)).length > 0;
  }

  function safeRead(storage, key, fallback) {
    try { return JSON.parse(storage.getItem(key) || 'null') || fallback; }
    catch { return fallback; }
  }

  function deviceToken(storage, cryptoApi = global.crypto) {
    try {
      const existing = storage.getItem(DEVICE_TOKEN_KEY);
      if (/^[A-Za-z0-9_-]{32,128}$/.test(existing || '')) return existing;
      const bytes = new Uint8Array(32);
      cryptoApi.getRandomValues(bytes);
      const token = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
      storage.setItem(DEVICE_TOKEN_KEY, token);
      return token;
    } catch {
      return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`.padEnd(32, 'x').slice(0, 64);
    }
  }

  function create(options) {
    const store = options.store;
    const storage = options.storage || global.localStorage;
    const request = options.fetch || global.fetch?.bind(global);
    const onApplied = options.onApplied || (() => {});
    const onStatus = options.onStatus || (() => {});
    const token = deviceToken(storage, options.crypto || global.crypto);
    let meta = safeRead(storage, SYNC_META_KEY, { revision: 0, dirty: false, lastSyncedAt: 0, localUpdatedAt: 0 });
    let revision = Math.max(0, number(meta.revision));
    let ready = false, timer = null, pushing = null;

    const writeMeta = patch => {
      meta = { ...meta, ...patch };
      try { storage.setItem(SYNC_META_KEY, JSON.stringify(meta)); } catch {}
    };
    const headers = extra => ({ 'x-legram-device-token': token, ...extra });
    const apply = value => {
      const next = store.replace(value);
      onApplied(next);
      return next;
    };

    async function push(retryConflict = true) {
      if (!request) throw new Error('fetch_unavailable');
      if (pushing) return pushing;
      clearTimeout(timer);timer = null;
      const attempt = async () => {
        onStatus('syncing');
        const clientUpdatedAt = Math.max(Date.now(), number(meta.localUpdatedAt));
        const response = await request('/api/progress', {
          method: 'PUT',
          credentials: 'same-origin',
          headers: headers({ 'content-type': 'application/json' }),
          body: JSON.stringify({ state: exportProgress(store.get()), baseRevision: revision, clientUpdatedAt })
        });
        const payload = await response.json().catch(() => ({}));
        if (response.status === 409 && retryConflict && payload.state) {
          revision = Math.max(0, number(payload.revision));
          apply(mergeProgress(store.get(), payload.state));
          pushing = null;
          return push(false);
        }
        if (!response.ok) throw new Error(payload.error || `sync_${response.status}`);
        revision = Math.max(0, number(payload.revision));
        writeMeta({ revision, dirty: false, lastSyncedAt: Date.now(), localUpdatedAt: clientUpdatedAt });
        onStatus('synced', payload);
        return payload;
      };
      pushing = attempt().catch(error => {
        writeMeta({ dirty: true });
        onStatus('local', { error: error.message });
        throw error;
      }).finally(() => { pushing = null; });
      return pushing;
    }

    function schedule() {
      writeMeta({ dirty: true, localUpdatedAt: Date.now() });
      if (!ready) return;
      clearTimeout(timer);
      timer = global.setTimeout(() => push().catch(() => {}), options.debounce ?? 850);
    }

    async function start() {
      if (!request) { ready = true;onStatus('local');return; }
      onStatus('syncing');
      try {
        const response = await request('/api/progress', { credentials: 'same-origin', headers: headers() });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `sync_${response.status}`);
        revision = Math.max(0, number(payload.revision));
        const local = store.get();
        if (!payload.found) {
          ready = true;
          writeMeta({ revision: 0, dirty: true });
          await push();
          return;
        }
        const localChanged = Boolean(meta.dirty) || number(meta.localUpdatedAt) > number(meta.lastSyncedAt);
        const firstMerge = !number(meta.revision) && hasMeaningfulProgress(local);
        const next = localChanged || firstMerge ? mergeProgress(local, payload.state) : mergeProgress({ sound: local.sound }, payload.state);
        apply(next);
        ready = true;
        writeMeta({ revision, dirty: localChanged || firstMerge, lastSyncedAt: Date.now() });
        if (localChanged || firstMerge) await push();
        else onStatus('synced', payload);
      } catch (error) {
        ready = true;
        writeMeta({ dirty: true });
        onStatus('local', { error: error.message });
      }
    }

    global.addEventListener?.('online', () => { if (ready && meta.dirty) push().catch(() => {}); });
    return { start, schedule, push, mergeProgress, exportProgress, status: () => ({ ready, revision, ...meta }) };
  }

  const deviceHeaders = (storage = global.localStorage) => ({
    'x-legram-device-token': deviceToken(storage, global.crypto)
  });

  global.LegramCloudSync = Object.freeze({ create, mergeProgress, exportProgress, hasMeaningfulProgress, deviceHeaders });
})(window);
