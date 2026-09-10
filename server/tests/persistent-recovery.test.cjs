const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const { createServer } = require('node:http');
const { createAuth } = require('../dist/services/auth');
const { createPersistentSessions, tokenHash } = require('../dist/services/persistent-session');
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
  f.row.role='Manager';const renewed=await f.sessions.refresh(first.token);
  assert.equal(renewed.user.role,'Manager');assert.equal(+renewed.expiresAt,+first.expiresAt);
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
