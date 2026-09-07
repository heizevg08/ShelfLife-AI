const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadSession(window) {
  const source = fs.readFileSync(path.resolve(__dirname, '../../client/src/services/session.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  const context = { exports: {}, window }; vm.runInNewContext(outputText, context);return context.exports;
}
test('client session persists only token across module reload and clears inherited storage on logout', () => {
  const values = new Map();const legacy = new Map([['userToken','old']]);
  const storage = map => ({getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)});
  const window={sessionStorage:storage(values),localStorage:storage(legacy)};
  const session=loadSession(window);assert.equal(session.getAccessToken(),null);
  session.setAccessToken('signed-test-token');assert.equal(values.size,1);assert.equal(loadSession(window).getAccessToken(),'signed-test-token');
  session.clearSession();assert.equal(session.getAccessToken(),null);assert.equal(values.size,0);assert.equal(legacy.size,0);
});
test('client session works without browser storage and clears in-memory token', () => {
  for(const window of [undefined,Object.defineProperty({},'sessionStorage',{get(){throw new Error('blocked')}})]) {
    const session=loadSession(window);session.setAccessToken('memory-token');assert.equal(session.getAccessToken(),'memory-token');session.clearSession();assert.equal(session.getAccessToken(),null);
  }
});
