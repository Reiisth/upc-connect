/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');

const env = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public-test-value',
  SUPABASE_SECRET_KEY: 'private-test-value',
};

test('LAN mode exposes only a validated private host and retains loopback for privileged server', async () => {
  const { localDevConfig, assertLanHost } = await import('../scripts/local-dev-config.mjs');
  for (const host of ['10.0.0.1', '172.16.0.1', '172.31.255.254', '192.168.1.13', '127.0.0.1', 'localhost']) {
    assert.equal(assertLanHost(host), host);
    const input = { ...env, UPC_LOCAL_LAN_HOST: host };
    const config = localDevConfig(input, true);
    assert.equal(config.env.NEXT_PUBLIC_SUPABASE_URL, `http://${host}:54321`);
    assert.equal(config.env.UPC_LOCAL_INTERNAL_SUPABASE_URL, 'http://127.0.0.1:54321/');
    assert.equal(config.args.at(-1), '0.0.0.0');
    assert.equal(config.env.SUPABASE_SECRET_KEY, env.SUPABASE_SECRET_KEY);
    assert.equal(Object.entries(config.env).some(([k, v]) => k.startsWith('NEXT_PUBLIC_') && v === env.SUPABASE_SECRET_KEY), false);
    assert.equal(input.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_URL);
  }
  for (const host of ['', '8.8.8.8', '172.15.0.1', '172.32.0.1', '192.169.0.1', 'example.supabase.co', 'example.com', '0.0.0.0', '169.254.1.1', '192.168.1.13.evil.test', 'http://192.168.1.13', 'https://192.168.1.13', 'user@192.168.1.13', '192.168.1.13/path', '192.168.1.13:54321', '192.168.001.013']) {
    assert.throws(() => assertLanHost(host), undefined, host);
  }
});

test('normal local mode ignores LAN option; neither mode permits a non-loopback internal endpoint', async () => {
  const { localDevConfig } = await import('../scripts/local-dev-config.mjs');
  const config = localDevConfig({ ...env, UPC_LOCAL_LAN_HOST: '192.168.1.13' });
  assert.equal(config.env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_URL);
  assert.equal(config.env.UPC_LOCAL_LAN_HOST, undefined);
  assert.equal(config.args.at(-1), '127.0.0.1');
  for (const target of ['http://192.168.1.13:54321', 'https://example.supabase.co']) {
    for (const lan of [true, false]) assert.throws(() => localDevConfig({ ...env, NEXT_PUBLIC_SUPABASE_URL: target, UPC_LOCAL_LAN_HOST: '192.168.1.13' }, lan), /loopback/);
    const run = spawnSync(process.execPath, ['scripts/setup-local-auth.mjs'], {
      env: { ...process.env, ...env, NEXT_PUBLIC_SUPABASE_URL: target, UPC_LOCAL_LAN_HOST: '192.168.1.13' }, encoding: 'utf8',
    });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /loopback/);
  }
  const { assertLoopback } = await import('../scripts/local-env.mjs');
  assert.equal(assertLoopback(env.NEXT_PUBLIC_SUPABASE_URL), 'http://127.0.0.1:54321/');
});

test('privileged application client stays internal in LAN development; production behavior unchanged', () => {
  const saved = { ...process.env };
  let connection;
  try {
    const { createAdminClient } = loadTypeScript('lib/supabase/admin.ts', {
      'server-only': {}, '@supabase/supabase-js': { createClient: (url, key) => { connection = { url, key }; return connection; } },
    });
    process.env.NODE_ENV = 'development';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://192.168.1.13:54321';
    process.env.SUPABASE_SECRET_KEY = env.SUPABASE_SECRET_KEY;
    process.env.UPC_LOCAL_INTERNAL_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
    createAdminClient();
    assert.deepEqual(connection, { url: env.NEXT_PUBLIC_SUPABASE_URL, key: env.SUPABASE_SECRET_KEY });
    process.env.UPC_LOCAL_INTERNAL_SUPABASE_URL = 'http://192.168.1.13:54321';
    assert.throws(createAdminClient, /loopback/);
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    createAdminClient();
    assert.equal(connection.url, 'https://example.supabase.co');
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});
