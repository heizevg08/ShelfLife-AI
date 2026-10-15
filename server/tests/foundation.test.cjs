const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { connect } = require('node:net');
const { once, EventEmitter } = require('node:events');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { readConfig } = require('../dist/config/env');
const { createDatabase } = require('../dist/config/database');
const { createApp } = require('../dist/app');
const { startServer, registerShutdown, startupDiagnostic } = require('../dist/server');

test('startup diagnostics allowlist metadata and reject secret-bearing fields', () => {
  const error = Object.assign(new Error('mongodb://private:password@host secret-token hash-value'), { code: 'ECONNREFUSED' });
  assert.deepEqual(startupDiagnostic('database-connection', error), { stage: 'database-connection', name: 'Error', code: 'ECONNREFUSED' });
  error.name = 'private-name'; error.code = 'private-code';
  assert.deepEqual(startupDiagnostic('application-composition', error), { stage: 'application-composition', name: 'UnknownError' });
  assert.deepEqual(startupDiagnostic('configuration', new Error('Invalid configuration: JWT_SECRET')), { stage: 'configuration', name: 'Error', message: 'Invalid configuration: JWT_SECRET' });
  assert.equal(startupDiagnostic('configuration', new Error('Invalid configuration: JWT_SECRET=private-value')).message, undefined);
  assert.equal(startupDiagnostic('configuration', 'private-value').name, 'UnknownError');
  assert.deepEqual(startupDiagnostic('shutdown-registration', new TypeError('private-value')), { stage: 'shutdown-registration', name: 'TypeError' });
});

const config = { ...readConfig({ MONGO_URI: 'mongodb://test.invalid/foundation', NODE_ENV: 'test' }), port: 0 };
async function serve(t, app) {
  const server = createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return `http://127.0.0.1:${server.address().port}`;
}

test('environment defaults, overrides, validation, and value redaction', () => {
  const defaults = readConfig({ MONGO_URI: config.mongoUri });
  assert.equal(defaults.host, '127.0.0.1'); assert.equal(defaults.port, 5000);
  const overridden = readConfig({ MONGO_URI: config.mongoUri, NODE_ENV: 'production', HOST: '0.0.0.0', PORT: '8123', CORS_ORIGINS: 'https://example.test' });
  assert.equal(overridden.port, 8123); assert.equal(overridden.host, '0.0.0.0');
  for (const key of ['MONGO_URI', 'NODE_ENV', 'HOST', 'PORT', 'CORS_ORIGINS']) {
    assert.throws(() => readConfig({ MONGO_URI: config.mongoUri, [key]: 'private invalid value' }), e => e.message.includes(key) && !e.message.includes('private invalid value'));
  }
  assert.throws(() => readConfig({}), /MONGO_URI/);
  for (const port of ['', '0', '65536', '2.5', '5e3']) assert.throws(() => readConfig({ MONGO_URI: config.mongoUri, PORT: port }), /PORT/);
});

test('missing URI exits safely before any database connection', () => {
  // Intentionally do not inherit the developer/deployment environment.
  const result = spawnSync(process.execPath, [path.resolve(__dirname, '../dist/server.js')], { env: { NODE_ENV: 'test' }, encoding: 'utf8' });
  assert.equal(result.status, 1); assert.match(result.stderr, /Invalid configuration: MONGO_URI/);
  assert.equal(result.stdout, '');
});

test('health readiness follows controlled state; errors and legacy endpoints are safe', async t => {
  let ready = false;
  const origin = await serve(t, createApp(['https://allowed.test'], () => ready));
  let r = await fetch(origin + '/api/health/live'); assert.equal(r.status, 200); assert.deepEqual(await r.json(), { status: 'alive' });
  assert.equal(r.headers.get('x-powered-by'), null);
  r = await fetch(origin + '/api/health/ready'); assert.equal(r.status, 503);
  ready = true;
  r = await fetch(origin + '/api/health/ready'); assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'no-store');
  ready = false;
  assert.equal((await fetch(origin + '/api/health/ready')).status, 503);
  r = await fetch(origin + '/api/health/live', { headers: { Origin: 'https://allowed.test' } });
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://allowed.test');
  assert.equal(r.headers.get('access-control-allow-credentials'), 'true');
  r = await fetch(origin + '/api/health/live', { method: 'OPTIONS', headers: { Origin: 'https://allowed.test', 'Access-Control-Request-Method': 'GET' } }); assert.equal(r.status, 204);
  r = await fetch(origin + '/api/health/live', { headers: { Origin: 'https://denied.test' } });
  assert.equal(r.status, 403); assert.equal(r.headers.get('access-control-allow-origin'), null);
  for (const url of ['/missing', '/api/auth/login', '/api/accounts', '/api/roles']) {
    r = await fetch(origin + url); assert.equal(r.status, 404); assert.deepEqual(await r.json(), { error: { message: 'Not found' } });
  }
  r = await fetch(origin + '/missing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"private-value":' });
  assert.equal(r.status, 400); assert.deepEqual(await r.json(), { error: { message: 'Invalid JSON' } });
  r = await fetch(origin + '/missing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: 'x'.repeat(110000) }) });
  assert.equal(r.status, 413);
});

test('unexpected errors never expose raw messages or stacks', async t => {
  const origin = await serve(t, createApp([], () => { throw new Error('private-database-value'); }));
  const r = await fetch(origin + '/api/health/ready'); assert.equal(r.status, 500);
  assert.deepEqual(await r.json(), { error: { message: 'Internal server error' } });
});

test('database boundary uses bounded options and no models or writes', async () => {
  const calls = [];
  const driver = { connection: { readyState: 0 }, connect: async (...args) => calls.push(args), disconnect: async () => calls.push('disconnect') };
  const db = createDatabase(driver);
  await db.connect(config.mongoUri);
  assert.deepEqual(calls[0], [config.mongoUri, { dbName: 'shelflifeai', serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000, autoIndex: false, autoCreate: false }]);
  for (const state of [0, 1, 2, 3]) { driver.connection.readyState = state; assert.equal(db.isConnected(), state === 1); }
  await db.disconnect(); assert.equal(calls[1], 'disconnect');
});

test('connection failure is sanitized and disconnects without listening', async () => {
  let disconnected = 0;
  const stages = [];
  await assert.rejects(startServer(config, { connect: async () => { throw new Error('private-driver-details'); }, disconnect: async () => { disconnected++; }, isConnected: () => false }, 5000, undefined, stage => stages.push(stage)), error => {
    assert.equal(error.message, 'Backend startup failed');
    assert.deepEqual(error.diagnostic, { stage: 'database-connection', name: 'Error' });
    assert.equal(error.cause, undefined);
    return true;
  });
  assert.deepEqual(stages, ['application-composition', 'database-connection']);
  assert.equal(disconnected, 1);
});

test('listen failure disconnects the database and exposes no raw socket error', async t => {
  const origin = await serve(t, createApp([], () => false));
  let disconnected = 0;
  await assert.rejects(startServer({ ...config, port: Number(new URL(origin).port) }, {
    connect: async () => {}, disconnect: async () => { disconnected++; }, isConnected: () => true,
  }), error => {
    assert.equal(error.message, 'Backend startup failed');
    assert.deepEqual(error.diagnostic, { stage: 'http-listen', name: 'Error', code: 'EADDRINUSE' });
    return true;
  });
  assert.equal(disconnected, 1);
});

test('development TypeScript loader validates configuration without legacy imports', () => {
  const result = spawnSync(process.execPath, ['--env-file-if-exists=.env', '--import', 'tsx', 'src/server.ts'], {
    cwd: path.resolve(__dirname, '..'), env: { NODE_ENV: 'test', MONGO_URI: '' }, encoding: 'utf8', timeout: 15000,
  });
  assert.equal(result.status, 1); assert.match(result.stderr, /Invalid configuration: MONGO_URI/);
  assert.equal(result.stdout, '');
});

test('single startup, database loss, idempotent shutdown, and signal wiring', async t => {
  const calls = []; let connected = false;
  const runtime = await startServer(config, { connect: async () => { calls.push('connect'); connected = true; }, disconnect: async () => { assert.equal(runtime.http.listening, false); calls.push('disconnect'); }, isConnected: () => connected });
  t.after(() => runtime.stop());
  const origin = `http://127.0.0.1:${runtime.http.address().port}`;
  assert.equal((await fetch(origin + '/api/health/ready')).status, 200);
  connected = false; assert.equal((await fetch(origin + '/api/health/ready')).status, 503);
  const signals = new EventEmitter(); let exits = 0;
  const exited = new Promise(resolve => {
    const cleanup = registerShutdown(signals, runtime.stop, code => { assert.equal(code, 0); exits++; cleanup(); resolve(); });
  });
  signals.emit('SIGTERM'); signals.emit('SIGINT'); await exited;
  assert.equal(exits, 1); assert.equal(await runtime.stop(), 0); assert.deepEqual(calls, ['connect', 'disconnect']);
});

test('shutdown forces stalled HTTP connections closed within the deadline', async () => {
  let disconnected = false;
  const runtime = await startServer(config, { connect: async () => {}, disconnect: async () => { disconnected = true; }, isConnected: () => true }, 50);
  const socket = connect(runtime.http.address().port, '127.0.0.1');
  socket.on('error', () => {}); await once(socket, 'connect');
  socket.write('POST /missing HTTP/1.1\r\nHost: localhost\r\nContent-Length: 100\r\nContent-Type: application/json\r\n\r\n{');
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(await runtime.stop(), 1); assert.equal(disconnected, true); socket.destroy();
});

test('in-flight readiness reports unavailable while HTTP drains before database disconnect', async () => {
  let disconnected = false;
  const runtime = await startServer(config, { connect: async () => {}, disconnect: async () => { disconnected = true; }, isConnected: () => true });
  const socket = connect(runtime.http.address().port, '127.0.0.1');
  socket.on('error', () => {}); await once(socket, 'connect');
  let response = '';
  socket.on('data', chunk => { response += chunk.toString(); });
  const closed = once(socket, 'close');
  socket.write('GET /api/health/ready HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\nContent-Length: 2\r\nContent-Type: application/json\r\n\r\n{');
  await new Promise(resolve => setTimeout(resolve, 20));
  const stopped = runtime.stop();
  assert.equal(disconnected, false);
  socket.write('}');
  await closed;
  assert.match(response, /HTTP\/1.1 503/);
  assert.equal(await stopped, 0); assert.equal(disconnected, true);
});

test('stalled database shutdown is bounded', async () => {
  const runtime = await startServer(config, { connect: async () => {}, disconnect: () => new Promise(() => {}), isConnected: () => true }, 30);
  assert.equal(await runtime.stop(), 1);
});
