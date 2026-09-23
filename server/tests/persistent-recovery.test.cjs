const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const { createServer } = require('node:http');
const { createAuth } = require('../dist/services/auth');
const { createPersistentSessions, tokenHash } = require('../dist/services/persistent-session');
const { createPasswordRecovery } = require('../dist/services/password-recovery');
const { createResetEmail } = require('../dist/services/reset-email');
const { hashPassword, verifyPassword } = require('../dist/services/password');
const { createApp } = require('../dist/app');

async function fixture() {
  let row = { _id:'0123456789abcdef01234567', email:'test@shelflife.com', firstName:'Test', lastName:'User', role:'Super Admin', isActive:true, authVersion:0, passwordHash:await hashPassword('test-password-only') };
  const users = { byId:async id=>row?._id===id?row:null, byEmail:async email=>row?.email===email?row:null };
  const auth = createAuth(users, randomBytes(48).toString('hex'));
  const records = new Map(); let clock = new Date();
  const store = {
    create:async r=>records.set(r.tokenHash,r),
    rotate:async (hash,next,now)=>{const r=records.get(hash);if(!r||r.expiresAt<=now)return null;records.delete(hash);records.set(next,{...r,tokenHash:next});return r;},
    revoke:async hash=>records.delete(hash),
  };
  return { row, users, auth, records, sessions:createPersistentSessions(store,users,auth,()=>clock), expire:()=>{clock=new Date(clock.getTime()+31*86400000)} };
}

test('persistent sessions store hashes, rotate atomically, preserve expiry and load current user', async()=>{
  const f=await fixture(), first=await f.sessions.create(f.row._id);
  assert(!f.records.has(first.token));assert(f.records.has(tokenHash(first.token)));
  f.row.role='Inventory Manager';const renewed=await f.sessions.refresh(first.token);
  assert.equal(renewed.user.role,'Inventory Manager');assert.equal(+renewed.expiresAt,+first.expiresAt);
  assert.notEqual(renewed.token,first.token);await assert.rejects(f.sessions.refresh(first.token));
  const results=await Promise.allSettled([f.sessions.refresh(renewed.token),f.sessions.refresh(renewed.token)]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  for(const bad of [null,'',{},'x'.repeat(64)])await assert.rejects(f.sessions.refresh(bad));
});

test('persistent expiration, logout revocation, inactive users and password version fail closed', async()=>{
  const f=await fixture();let session=await f.sessions.create(f.row._id);
  await f.sessions.revoke(session.token);await assert.rejects(f.sessions.refresh(session.token));
  session=await f.sessions.create(f.row._id);f.row.isActive=false;await assert.rejects(f.sessions.refresh(session.token));
  f.row.isActive=true;session=await f.sessions.create(f.row._id);const access=f.auth.issue(f.row).accessToken;
  f.row.authVersion++;await assert.rejects(f.sessions.refresh(session.token));await assert.rejects(f.auth.authenticate('Bearer '+access));
  session=await f.sessions.create(f.row._id);f.expire();await assert.rejects(f.sessions.refresh(session.token));
});

test('real HTTP cookie contract is HttpOnly, CSRF guarded, rotating and revocable; normal login stays cookie-free', async t=>{
  const f=await fixture();const server=createServer(createApp(['http://localhost:8081'],()=>true,f.auth,{sessions:f.sessions,secureCookies:true}));
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.close();server.closeAllConnections()});
  const base=`http://127.0.0.1:${server.address().port}/api/auth`;
  const post=(path,body,cookie,origin='http://localhost:8081')=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
  const body={email:f.row.email,password:'test-password-only'};
  let r=await post('/login',body);assert.equal(r.status,200);assert.equal(r.headers.get('set-cookie'),null);
  r=await post('/login',{...body,rememberMe:true});assert.equal(r.status,200);
  let cookie=r.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Lax/);assert.match(cookie,/Expires=/);
  assert(!JSON.stringify(await r.json()).includes('tokenHash'));const first=cookie.split(';')[0];
  assert.equal((await post('/refresh',{},first,'https://evil.example')).status,403);
  r=await post('/refresh',{},first);assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0];assert.notEqual(cookie,first);
  assert.equal((await post('/refresh',{},first)).status,401);
  assert.equal((await post('/logout',{},cookie)).status,204);
  assert.equal((await post('/refresh',{},cookie)).status,401);
});

test('recovery is generic, hashed, expiring, single-use and invalidates prior access tokens',async()=>{
  const f=await fixture();let saved, delivered;let now=new Date();
  const store={...f.users,setReset:async(id,hash,expires)=>{saved={hash,expires}},clearReset:async hash=>{if(saved?.hash===hash)saved=undefined},
    consumeReset:async(hash,date,passwordHash)=>{if(!saved||saved.hash!==hash||saved.expires<=date||!f.row.isActive)return false;saved=undefined;f.row.passwordHash=passwordHash;f.row.authVersion++;return true;}};
  const recovery=createPasswordRecovery(store,{send:async(email,token)=>{delivered=token}},()=>now);
  const known=await recovery.request({email:f.row.email});assert.deepEqual(await recovery.request({email:'missing@shelflife.com'}),known);
  assert.equal(saved.hash,tokenHash(delivered));assert(!JSON.stringify(known).includes(delivered));
  const old=f.auth.issue(f.row).accessToken;await recovery.complete({token:delivered,password:'changed-password-only'});
  assert(await verifyPassword('changed-password-only',f.row.passwordHash));await assert.rejects(f.auth.authenticate('Bearer '+old));
  await assert.rejects(recovery.complete({token:delivered,password:'changed-password-only'}));
  await recovery.request({email:f.row.email});now=new Date(now.getTime()+900001);await assert.rejects(recovery.complete({token:delivered,password:'changed-password-only'}));
  const disabled=createPasswordRecovery(store);await assert.rejects(disabled.request({email:f.row.email}),e=>e.status===503);
  const failed=createPasswordRecovery(store,{send:async()=>{throw Error('private provider details')}});
  assert.deepEqual(await failed.request({email:f.row.email}),known);assert.equal(saved,undefined);
});

test('Resend boundary is disabled without configuration and requires provider acceptance',async()=>{
  assert.equal(createResetEmail({}),undefined);
  assert.equal(createResetEmail({RESEND_API_KEY:'test',RESEND_FROM:'test@example.com',PASSWORD_RESET_URL:'http://untrusted.example',NODE_ENV:'production'}),undefined);
  const env={RESEND_API_KEY:'isolated-key',RESEND_FROM:'test@example.com',PASSWORD_RESET_URL:'https://example.com/ShelfLifeAILogin'};
  let sent;
  await createResetEmail(env,async(url,options)=>{sent=JSON.parse(options.body);return new Response(JSON.stringify({id:'provider-accepted'}),{status:200})}).send('recipient@example.com','a'.repeat(64));
  assert(sent.text.includes('#reset='));assert(!sent.text.includes('?reset='));
  await assert.rejects(createResetEmail(env,async()=>new Response('{}',{status:500})).send('recipient@example.com','a'.repeat(64)));
});

test('reset completion rejects whitespace-only passwords without consuming the token and preserves edge spaces', async () => {
  let consumed = 0, stored;
  const recovery = createPasswordRecovery({ consumeReset: async (_token, _date, hash) => { consumed++; stored = hash; return true; } });
  const token = 'a'.repeat(64), password = '  valid-password-only  ';
  for (const blank of ['', ' '.repeat(12), '\t\n '.repeat(12)]) {
    await assert.rejects(recovery.complete({ token, password: blank }), error => error.status === 400);
  }
  assert.equal(consumed, 0);
  await recovery.complete({ token, password });
  assert.equal(consumed, 1);
  assert.equal(await verifyPassword(password, stored), true);
  assert.equal(await verifyPassword(password.trim(), stored), false);
});
