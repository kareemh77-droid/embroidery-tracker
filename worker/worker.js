// Embroidery Tracker API: Cloudflare Worker + D1.
// Everything requires the team code in the X-Team-Code header (stored as the TEAM_CODE secret).

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Team-Code, If-None-Match',
  'Access-Control-Expose-Headers': 'ETag',
  'Access-Control-Max-Age': '86400'
};
const STATUSES = ['ready', 'embroidery', 'done', 'back', 'shipped'];
const MAX_BODY = 20000;

const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS, ...extra } });

function same(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
const clean = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

let ready = false;
async function ensureSchema(db) {
  if (ready) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, data TEXT NOT NULL, rev INTEGER NOT NULL)').run();
  ready = true;
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);

    if (url.pathname === '/api/ping') return json({ ok: true });

    const m = url.pathname.match(/^\/api\/orders(?:\/([A-Za-z0-9_-]{1,40}))?$/);
    if (!m) return json({ error: 'not found' }, 404);

    const code = clean(req.headers.get('X-Team-Code'));
    if (!env.TEAM_CODE || !code || !same(code, clean(env.TEAM_CODE))) return json({ error: 'unauthorized' }, 401);

    await ensureSchema(env.DB);
    const id = m[1];

    if (req.method === 'GET' && !id) {
      const meta = await env.DB.prepare('SELECT COUNT(*) AS c, COALESCE(MAX(rev), 0) AS m FROM orders').first();
      const etag = `"${meta.c}-${meta.m}"`;
      if ((req.headers.get('If-None-Match') || '').replace(/^W\//, '') === etag) return new Response(null, { status: 304, headers: { ETag: etag, ...CORS } });
      const { results } = await env.DB.prepare('SELECT id, data FROM orders').all();
      const orders = results.map(r => ({ ...JSON.parse(r.data), id: r.id }));
      return json({ orders }, 200, { ETag: etag });
    }

    if (req.method === 'PUT' && id) {
      const text = await req.text();
      if (text.length > MAX_BODY) return json({ error: 'too large' }, 413);
      let body;
      try { body = JSON.parse(text); } catch (e) { return json({ error: 'bad json' }, 400); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'bad body' }, 400);
      if (!STATUSES.includes(body.status)) return json({ error: 'bad status' }, 400);
      delete body.id;
      await env.DB.prepare(
        'INSERT INTO orders (id, data, rev) VALUES (?1, ?2, (SELECT COALESCE(MAX(rev), 0) + 1 FROM orders)) ' +
        'ON CONFLICT(id) DO UPDATE SET data = excluded.data, rev = excluded.rev'
      ).bind(id, JSON.stringify(body)).run();
      return json({ ok: true });
    }

    if (req.method === 'DELETE' && id) {
      await env.DB.prepare('DELETE FROM orders WHERE id = ?1').bind(id).run();
      return json({ ok: true });
    }

    return json({ error: 'method not allowed' }, 405);
  }
};
