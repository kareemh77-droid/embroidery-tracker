// Runs the Worker against a real SQLite database (node:sqlite) wrapped to look like D1.
import { DatabaseSync } from 'node:sqlite';
import worker from './worker.js';
const sql = new DatabaseSync(':memory:');
const db = { prepare(q){ const st = sql.prepare(q.replace(/\?(\d+)/g,'?')); let args=[];
  const api={ bind(...a){ args=a; return api; },
    async run(){ st.run(...args); return {success:true}; },
    async first(){ return st.get(...args) || null; },
    async all(){ return {results: st.all(...args)}; } }; return api; } };
const env = { DB: db, TEAM_CODE: 'K7QM-X2PD' };
const call = (method, path, {code='K7QM-X2PD', body, inm}={}) => worker.fetch(new Request('https://x'+path, {method, headers: {...(code!==null?{'X-Team-Code':code}:{}), ...(inm?{'If-None-Match':inm}:{}), 'Content-Type':'application/json'}, body: body?JSON.stringify(body):undefined}), env);
let fails = 0; const ok = (n, c) => { console.log((c?'PASS ':'FAIL ')+n); if(!c) fails++; };
let r = await call('GET','/api/orders',{code:null}); ok('no code -> 401', r.status===401);
r = await call('GET','/api/orders',{code:'WRONG-CODE'}); ok('wrong code -> 401', r.status===401);
r = await call('GET','/api/orders',{code:'k7qm x2pd'}); ok('code is case/space tolerant -> 200', r.status===200);
let j = await r.json(); let etag = r.headers.get('ETag'); ok('empty list', j.orders.length===0);
r = await call('PUT','/api/orders/ORD01828',{body:{status:'embroidery',customer:'Regina Public',d:{embroidery:'2026-11-01'}}}); ok('PUT ok', r.status===200);
r = await call('GET','/api/orders',{inm:etag}); ok('etag changed after write -> 200', r.status===200);
j = await r.json(); etag = r.headers.get('ETag'); ok('order returned with id', j.orders.length===1 && j.orders[0].id==='ORD01828' && j.orders[0].d.embroidery==='2026-11-01');
r = await call('GET','/api/orders',{inm:etag}); ok('same etag -> 304', r.status===304);
r = await call('GET','/api/orders',{inm:'W/'+etag}); ok('weak etag -> 304', r.status===304);
r = await call('PUT','/api/orders/ORD01828',{body:{status:'done',customer:'Regina Public',d:{embroidery:'2026-11-01',done:'2026-11-20'}}});
r = await call('GET','/api/orders',{inm:etag}); ok('update changes etag', r.status===200);
j = await r.json(); ok('upsert replaced', j.orders.length===1 && j.orders[0].status==='done');
r = await call('PUT','/api/orders/ORD01829',{body:{status:'nope'}}); ok('bad status -> 400', r.status===400);
r = await call('PUT','/api/orders/bad%20id',{body:{status:'ready'}}); ok('bad id -> 404', r.status===404);
r = await call('PUT','/api/orders/ORD01830',{body:{status:'ready',note:'x'.repeat(25000)}}); ok('huge body -> 413', r.status===413);
r = await call('OPTIONS','/api/orders'); ok('CORS preflight 204', r.status===204 && r.headers.get('Access-Control-Allow-Headers').includes('X-Team-Code'));
r = await call('DELETE','/api/orders/ORD01828'); ok('DELETE ok', r.status===200);
r = await call('GET','/api/orders'); j = await r.json(); ok('deleted gone', j.orders.length===0);
r = await call('GET','/api/ping',{code:null}); ok('ping open', r.status===200);
console.log(fails ? fails+' FAILED' : 'ALL PASSED'); process.exit(fails?1:0);
