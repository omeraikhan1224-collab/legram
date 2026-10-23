/* Legram — backend adapter for the Claude-hosted version.
 * The original app talked to a server at /api/progress. Here the same
 * request/response contract is served from the artifact's private database,
 * one document per signed-in learner: data/users/<id>/progress.
 */
(function (global) {
  'use strict';

  let ready = null;
  function connect() {
    if (ready) return ready;
    ready = (async () => {
      const claude = global.claude;
      if (!claude || typeof claude.use !== 'function') return null;
      const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
      if (!db || !user || typeof user.id !== 'function') return null;
      const id = await user.id();
      if (!id) return null;
      return db.collection(`data/users/${id}`).doc('progress');
    })().catch(() => null);
    return ready;
  }

  const respond = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  });

  async function progressFetch(url, options = {}) {
    if (!String(url).includes('/api/progress')) return respond(404, { error: 'not_found' });
    const ref = await connect();
    if (!ref) return respond(503, { error: 'cloud_unavailable' });
    const method = String(options.method || 'GET').toUpperCase();
    try {
      const snap = await ref.get();
      const current = snap.exists ? (snap.data() || {}) : null;
      const revision = Number(current?.revision) || 0;
      if (method === 'GET') {
        return respond(200, current ? { found: true, state: current.state || {}, revision } : { found: false, revision: 0 });
      }
      const body = JSON.parse(options.body || '{}');
      if (current && Number(body.baseRevision) !== revision) {
        return respond(409, { error: 'conflict', state: current.state || {}, revision });
      }
      const next = revision + 1;
      await ref.set({ state: body.state || {}, revision: next, updatedAt: Date.now() });
      return respond(200, { ok: true, revision: next });
    } catch (error) {
      return respond(503, { error: error?.code || 'cloud_error' });
    }
  }

  global.LegramBackend = Object.freeze({ progressFetch });
})(window);
