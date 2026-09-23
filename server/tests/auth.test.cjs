const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createServer } = require('node:http');
const { Mongoose } = require('mongoose');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('node:crypto');
const { createApp } = require('../dist/app');
const { createAuth } = require('../dist/services/auth');
const { hashPassword, verifyPassword } = require('../dist/services/password');
const { seedAdmin } = require('../dist/services/seed-admin');
const { userModel } = require('../dist/models/user');
const { normalizeEmail } = require('../dist/validators/auth');
const { readJwtSecret, readDevAdmin } = require('../dist/config/auth');
const secret = randomBytes(48).toString('hex');
const seedInput = { email: 'admin@shelflife.com', firstName: 'Test', lastName: 'Admin', password: 'isolated-test-password' };

test('organization domain and server-only configuration fail closed', () => {
  assert.equal(normalizeEmail(' ADMIN@SHELFLIFE.COM '), 'admin@shelflife.com');
  for (const email of ['a@example.com', 'a@sub.shelflife.com', 'a@shelflife.com.evil', 'a@@shelflife.com', '.a@shelflife.com', 'a..b@shelflife.com', 'a@shelflife.com\n.evil', {}, null]) assert.equal(normalizeEmail(email), null);
  assert.throws(() => readJwtSecret({ JWT_SECRET: 'short' }), /JWT_SECRET/);
  assert.equal(readJwtSecret({ JWT_SECRET: secret }), secret);
  const env = { DEV_ADMIN_EMAIL: seedInput.email, DEV_ADMIN_FIRST_NAME: 'Test', DEV_ADMIN_LAST_NAME: 'Admin', DEV_ADMIN_PASSWORD: seedInput.password };
  assert.deepEqual(readDevAdmin(env), seedInput);
  assert.throws(() => readDevAdmin({ ...env, NODE_ENV: 'production' }));
  assert.throws(() => readDevAdmin({ ...env, DEV_ADMIN_EMAIL: 'admin@example.com' }), /DEV_ADMIN_EMAIL/);
  assert.throws(() => readDevAdmin({ ...env, DEV_ADMIN_PASSWORD: 'short' }), /DEV_ADMIN_PASSWORD/);
});

test('secure hashes use unique salts, reject plaintext and preserve password bytes', async () => {
  const password = '  isolated-test-password  ';
  const first = await hashPassword(password), second = await hashPassword(password);
  assert.notEqual(first, second); assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword(password.trim(), first), false);
  assert.equal(await verifyPassword(password, password), false);
});

test('canonical model validates organization, approved roles, and hash-only fields', async () => {
  const users = userModel(new Mongoose());
  const hash = await hashPassword(seedInput.password);
  const input = { email: ' ADMIN@SHELFLIFE.COM ', firstName: 'Test', lastName: 'Admin', passwordHash: hash, role: 'Super Admin', isActive: true };
  const user = new users(input); await user.validate(); assert.equal(user.email, seedInput.email);
  for (const override of [{email:'a@example.com'}, {role:'Staff'}, {passwordHash:'plaintext'}]) await assert.rejects(new users({...input,...override}).validate());
  assert.throws(() => new users({...input,password:'plaintext'}));
  assert.equal(users.schema.path('passwordHash').options.select, false);
});

test('seed creates once, hashes password, preserves existing inactive accounts and handles races', async () => {
  let row; let writes = 0; let indexes = 0;
  const users = { exists: async()=>row ? {_id:'existing'} : null, createIndexes:async()=>{indexes++}, create:async value=>{row=value;writes++} };
  assert.equal(await seedAdmin(users, seedInput), 'created');
  assert.equal(row.role, 'Super Admin'); assert.equal(row.isActive, true); assert.equal('password' in row,false);
  assert.equal(await verifyPassword(seedInput.password,row.passwordHash),true);
  const original = structuredClone(row);
  assert.equal(await seedAdmin(users,{...seedInput,password:'different-password'}),'unchanged');
  assert.deepEqual(row,original);row.isActive=false;
  assert.equal(await seedAdmin(users,seedInput),'unchanged'); assert.equal(row.isActive,false);assert.equal(writes,1);assert.equal(indexes,1);
  assert.equal(await seedAdmin({...users,exists:async()=>null,create:async()=>{throw {code:11000}}},seedInput),'unchanged');
});

test('HTTP login/me verify tokens and current user state, with safe responses', async t => {
  let row = { _id:'0123456789abcdef01234567', email:seedInput.email, firstName:'Test', lastName:'Admin', role:'Super Admin', isActive:true, passwordHash:await hashPassword(seedInput.password) };
  const auth=createAuth({byEmail:async email=>row?.email===email?row:null,byId:async id=>row?._id===id?row:null},secret);
  const server=createServer(createApp(['http://localhost:8081'],()=>true,auth));
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections()}));
  const base=`http://127.0.0.1:${server.address().port}/api/auth`;
  async function login(body){return fetch(base+'/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}
  const valid=await login({email:' ADMIN@SHELFLIFE.COM ',password:seedInput.password});assert.equal(valid.status,200);
  assert.equal(valid.headers.get('cache-control'),'no-store');
  const result=await valid.json();assert.equal(result.message,'Login successful');assert.deepEqual(Object.keys(result.user).sort(),['email','id','isActive','name','role']);
  assert.equal(JSON.stringify(result).includes('password'),false);assert.equal(JSON.stringify(result).includes(row.passwordHash),false);
  const claims=jwt.verify(result.accessToken,secret,{algorithms:['HS256'],issuer:'shelflifeai',audience:'shelflifeai-client'});
  assert.equal(claims.exp-claims.iat,900);assert.equal(claims.sub,row._id);assert.equal(claims.role,undefined);
  // Operator-bearing objects are now rejected by the request guard before login.
  assert.equal((await login({email:{$ne:null},password:seedInput.password})).status,400);
  for(const body of [{email:seedInput.email,password:'wrong'},{email:'missing@shelflife.com',password:seedInput.password},{email:'admin@example.com',password:seedInput.password},{}]){
    const r=await login(body);assert.equal(r.status,401);assert.deepEqual(await r.json(),{error:{message:'Invalid email or password'}});
  }
  async function me(token){return fetch(base+'/me',{headers:token?{Authorization:'Bearer '+token}:{}})}
  assert.equal((await me(result.accessToken)).status,200);
  for(const token of [null,'malformed',jwt.sign({},'wrong-secret',{subject:row._id}),jwt.sign({},secret,{algorithm:'HS256',issuer:'shelflifeai',audience:'shelflifeai-client',subject:row._id,expiresIn:-1}),jwt.sign({},secret,{algorithm:'HS384',issuer:'shelflifeai',audience:'shelflifeai-client',subject:row._id,expiresIn:900})]) assert.equal((await me(token)).status,401);
  row.role='Inventory Manager';assert.equal((await (await me(result.accessToken)).json()).user.role,'Inventory Manager');
  row.isActive=false;assert.equal((await me(result.accessToken)).status,401);assert.equal((await login({email:seedInput.email,password:seedInput.password})).status,401);
  row=null;assert.equal((await me(result.accessToken)).status,401);
});
