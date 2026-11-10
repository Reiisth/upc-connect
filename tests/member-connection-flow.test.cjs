const test = require('node:test'), assert = require('node:assert/strict');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');
const { finishMemberConnection } = loadTypeScript('lib/member-connection.ts');
const { accountConnectionNavigation } = loadTypeScript('lib/account-connection-navigation.ts');
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
test('fast results and failures wait for the full animation; slow operations keep waiting after animation', async () => {
  for (const fails of [false, true]) {
    const animation = deferred(); let settled = false, started = false;
    const operation = finishMemberConnection(async () => { started = true; if (fails) throw new Error('failed'); return 'destination'; }, animation.promise);
    operation.then(() => { settled = true; }, () => { settled = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(started, true); assert.equal(settled, false);
    animation.resolve();
    if (fails) await assert.rejects(operation, /failed/); else assert.equal(await operation, 'destination');
  }
  const server = deferred(); let settled = false;
  const result = finishMemberConnection(() => server.promise, Promise.resolve()).then(value => { settled = true; return value; });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(settled, false);
  server.resolve('saved'); assert.equal(await result, 'saved');
});
test('connection Back links support each entry route and member table filters, with safe fallbacks', () => {
  for (const [path, label] of [['/portal/members?page=2&search=Ana','Back to Members'],['/portal/members/member-id','Back to Member'],['/portal/accounts/members','Back to Member Accounts'],['/portal/accounts/account-id','Back to Account']]) {
    const result = accountConnectionNavigation(path); assert.equal(result.backHref, path); assert.equal(result.backLabel, label);
  }
  for (const path of ['https://evil.test', '//evil.test', '/portal/members/invite', '/portal/../../login', '/portal/members\\evil', undefined, ['/portal/members']]) {
    assert.equal(accountConnectionNavigation(path).backHref, '/portal/members');
  }
});
