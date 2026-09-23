const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { once } = require('node:events');
const { createApp } = require('../dist/app');
const { HttpError } = require('../dist/middleware/error.middleware');

async function serve(t, app) {
  const server = createServer(app);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return `http://127.0.0.1:${server.address().port}`;
}

test('Helmet protects success, error, not-found and CORS preflight responses', async t => {
  const base = await serve(t, createApp(['https://client.test'], () => true));
  for (const [path, options] of [
    ['/api/health/live', {}], ['/missing', {}],
    ['/missing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }],
    ['/api/health/live', { method: 'OPTIONS', headers: { Origin: 'https://client.test', 'Access-Control-Request-Method': 'GET' } }],
  ]) {
    const response = await fetch(base + path, options);
    assert.equal(response.headers.get('strict-transport-security'), 'max-age=31536000; includeSubDomains');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
    assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-powered-by'), null);
  }
});

test('Mongo key guard covers all business writes and reads without bypassing write authorization', async t => {
  const id = '1'.repeat(24);
  let calls = 0;
  const auth = { authenticate: async header => {
    if (!header) throw new HttpError(401, 'Authentication required');
    return { id, role: header.slice(7) };
  } };
  const service = new Proxy({}, { get: () => async () => { calls++; return {}; } });
  const base = await serve(t, createApp([], () => true, auth, undefined, service, service, service, service));
  const writes = [
    ['POST', '/api/users', 'Super Admin'], ['PATCH', `/api/users/${id}`, 'Super Admin'],
    ['POST', `/api/users/${id}/deactivate`, 'Super Admin'], ['POST', `/api/users/${id}/reactivate`, 'Super Admin'],
    ['POST', '/api/ingredients', 'Inventory Staff'], ['PATCH', `/api/ingredients/${id}`, 'Inventory Manager'],
    ['DELETE', `/api/ingredients/${id}`, 'Inventory Manager'],
    ['POST', '/api/inventory-batches', 'Inventory Manager'], ['PATCH', `/api/inventory-batches/${id}`, 'Inventory Manager'],
    ['DELETE', `/api/inventory-batches/${id}`, 'Inventory Manager'],
    ['POST', `/api/inventory-batches/${id}/quantity-corrections`, 'Inventory Manager'],
    ['PATCH', '/api/system-config', 'Super Admin'],
  ];
  for (const [method, path, role] of writes) {
    for (const body of [{ $set: { role: 'Super Admin' } }, { nested: [{ 'a.b': 1 }] }]) {
      const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${role}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      assert.equal(response.status, 400, `${method} ${path}`);
      assert.match((await response.json()).error.message, /operator and dotted keys/);
    }
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(response.status, 401, path);
  }
  for (const path of ['/api/users', '/api/audit-records', '/api/dashboard/summary', '/api/ingredients', '/api/inventory-batches', `/api/inventory-batches/${id}`, '/api/system-config']) {
    const response = await fetch(base + path + '?%24where=x', { headers: { Authorization: 'Bearer Super Admin' } });
    assert.equal(response.status, 400, path);
  }
  const denied = await fetch(base + '/api/ingredients', { method: 'POST', headers: { Authorization: 'Bearer Super Admin', 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(denied.status, 403);
  assert.equal(calls, 0);
});

test('Express 5 query getter stays intact and ordinary dotted strings/passwords are unchanged', async t => {
  let received;
  const auth = { login: async body => { received = body; return { user: { id: '1' }, accessToken: 'test' }; } };
  const base = await serve(t, createApp([], () => true, auth));
  const body = { email: 'a.b@shelflife.com', password: 'literal.$password.unchanged' };
  let response = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(response.status, 200); assert.deepEqual(received, body);
  response = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: { $ne: null }, password: 'x' }) });
  assert.equal(response.status, 400);
  response = await fetch(base + '/api/health/live?ordinary=value.with.dots');
  assert.equal(response.status, 200);
});
