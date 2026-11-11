/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');

test('load-test auth fails closed and only delegates dedicated credentials to SSR helper', async () => {
  const names = ['ENABLE_LOAD_TEST_AUTH', 'LOAD_TEST_SECRET', 'LOAD_TEST_EMAIL'];
  const previous = names.map((name) => process.env[name]);
  let calls = 0;
  let authError = null;
  const { POST, GET } = loadTypeScript('app/api/load-test/login/route.ts', {
    '@/lib/supabase/server': { createClient: async () => ({ auth: {
      signInWithPassword: async (credentials) => {
        calls++;
        assert.deepEqual(JSON.parse(JSON.stringify(credentials)), { email: 'load@example.test', password: 'fixture' });
        return { error: authError, data: { session: { access_token: 'never-return' } } };
      },
    } }) },
  }, { Response });
  const request = (secret = 'fixture-secret', email = 'load@example.test', password = 'fixture') =>
    new Request('http://localhost/api/load-test/login', { method: 'POST', headers: { 'x-load-test-secret': secret }, body: JSON.stringify({ email, password }) });
  try {
    process.env.LOAD_TEST_SECRET = 'fixture-secret';
    process.env.LOAD_TEST_EMAIL = 'load@example.test';
    for (const flag of ['', 'false', 'TRUE']) {
      process.env.ENABLE_LOAD_TEST_AUTH = flag;
      assert.equal((await POST(request())).status, 404);
    }
    process.env.ENABLE_LOAD_TEST_AUTH = 'true';
    assert.equal(GET, undefined);
    assert.equal((await POST(request(''))).status, 404);
    assert.equal((await POST(request('wrong'))).status, 404);
    assert.equal((await POST(request('fixture-secret', 'other@example.test'))).status, 401);
    assert.equal((await POST(request('fixture-secret', 'load@example.test', ''))).status, 401);
    assert.equal(calls, 0);
    const response = await POST(request());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true });
    assert.match(response.headers.get('cache-control'), /no-store/);
    authError = { message: 'invalid credentials' };
    assert.equal((await POST(request())).status, 401);
    process.env.LOAD_TEST_EMAIL = '';
    assert.equal((await POST(request())).status, 404);
    process.env.LOAD_TEST_EMAIL = 'load@example.test';
    process.env.LOAD_TEST_SECRET = '';
    assert.equal((await POST(request())).status, 404);
  } finally {
    names.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    });
  }
});
