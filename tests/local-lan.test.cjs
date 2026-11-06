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
  for (const host of ['10.0.0.1', '172.16.0.1', '172.31.255.254', '192.168.50.25']) {
    assert.equal(assertLanHost(host), host);
    const input = { ...env, UPC_LOCAL_LAN_HOST: host };
    const config = await localDevConfig(input, true);
    assert.equal(config.env.NEXT_PUBLIC_SUPABASE_URL, `http://${host}:54321`);
    assert.equal(config.env.UPC_LOCAL_INTERNAL_SUPABASE_URL, 'http://127.0.0.1:54321/');
    assert.equal(config.args.at(-1), '0.0.0.0');
    assert.equal(config.env.SUPABASE_SECRET_KEY, env.SUPABASE_SECRET_KEY);
    assert.equal(Object.entries(config.env).some(([k, v]) => k.startsWith('NEXT_PUBLIC_') && v === env.SUPABASE_SECRET_KEY), false);
    assert.equal(input.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_URL);
  }
  for (const host of ['127.0.0.1', 'localhost', '', '8.8.8.8', '172.15.0.1', '172.32.0.1', '192.169.0.1', 'example.supabase.co', 'example.com', '0.0.0.0', '169.254.1.1', '192.168.50.25.evil.test', 'http://192.168.50.25', 'https://192.168.50.25', 'user@192.168.50.25', '192.168.50.25/path', '192.168.50.25:54321', '192.168.001.013']) {
    assert.throws(() => assertLanHost(host), undefined, host);
  }
});

test('normal local mode ignores LAN option; neither mode permits a non-loopback internal endpoint', async () => {
  const { localDevConfig } = await import('../scripts/local-dev-config.mjs');
  const config = await localDevConfig({ ...env, UPC_LOCAL_LAN_HOST: '192.168.50.25' });
  assert.equal(config.env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_URL);
  assert.equal(config.env.UPC_LOCAL_LAN_HOST, undefined);
  assert.equal(config.args.at(-1), '127.0.0.1');
  for (const target of ['http://192.168.50.25:54321', 'https://example.supabase.co']) {
    for (const lan of [true, false]) await assert.rejects(() => localDevConfig({ ...env, NEXT_PUBLIC_SUPABASE_URL: target, UPC_LOCAL_LAN_HOST: '192.168.50.25' }, lan), /loopback/);
    const run = spawnSync(process.execPath, ['scripts/setup-local-auth.mjs'], {
      env: { ...process.env, ...env, NEXT_PUBLIC_SUPABASE_URL: target, UPC_LOCAL_LAN_HOST: '192.168.50.25' }, encoding: 'utf8',
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
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://192.168.50.25:54321';
    process.env.SUPABASE_SECRET_KEY = env.SUPABASE_SECRET_KEY;
    process.env.UPC_LOCAL_INTERNAL_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
    createAdminClient();
    assert.deepEqual(connection, { url: env.NEXT_PUBLIC_SUPABASE_URL, key: env.SUPABASE_SECRET_KEY });
    process.env.UPC_LOCAL_INTERNAL_SUPABASE_URL = 'http://192.168.50.25:54321';
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

const adapter = (address, family = 'IPv4', internal = false) => ({ address, family, internal });
const offline = async () => { throw Error('no route'); };
test('route address wins over stale physical adapters across all private ranges', async () => {
  const { resolveLanHost } = await import('../scripts/local-lan-host.mjs');
  const { localDevConfig } = await import('../scripts/local-dev-config.mjs');
  const old = ['192', '168', '1', '13'].join('.');
  for (const host of ['192.168.18.42', '10.23.4.5', '172.16.2.3', '172.31.254.2']) {
    const discovery = { probe: async () => host, interfaces: () => ({ 'Ethernet 2': [adapter(old)], 'Wi-Fi': [adapter(host)] }) };
    assert.equal(await resolveLanHost(undefined, discovery), host);
    const config = await localDevConfig(env, true, discovery);
    assert.equal(config.env.NEXT_PUBLIC_SUPABASE_URL, `http://${host}:54321`);
    assert.equal(config.env.UPC_LOCAL_LAN_HOST, host);
    assert.equal(config.env.UPC_LOCAL_INTERNAL_SUPABASE_URL, 'http://127.0.0.1:54321/');
    const saved = { ...process.env };
    try {
      process.env.NODE_ENV = 'development'; process.env.UPC_LOCAL_LAN_HOST = config.env.UPC_LOCAL_LAN_HOST;
      assert.ok(Array.from(loadTypeScript('next.config.ts').default.allowedDevOrigins).includes(host));
    } finally { for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]; Object.assign(process.env, saved); }
  }
});
test('override is highest priority and invalid/public/loopback routes cannot become LAN hosts', async () => {
  const { resolveLanHost } = await import('../scripts/local-lan-host.mjs');
  const never = () => { throw Error('must not discover'); };
  assert.equal(await resolveLanHost('10.9.8.7', { probe: never, interfaces: never }), '10.9.8.7');
  await assert.rejects(resolveLanHost('8.8.8.8', { probe: never }), /private IPv4/);
  for (const route of ['8.8.8.8', '127.0.0.1', '169.254.2.1', '::1']) {
    await assert.rejects(resolveLanHost(undefined, { probe: async () => route, interfaces: () => ({}) }), /private IPv4/);
  }
});
test('offline fallback prefers physical adapters, rejects ambiguity and excludes virtual/public/loopback', async () => {
  const { resolveLanHost } = await import('../scripts/local-lan-host.mjs');
  const interfaces = () => ({ 'vEthernet (WSL)': [adapter('172.20.1.1')], Docker: [adapter('10.0.0.2')], VPN: [adapter('10.1.1.1')], 'Wi-Fi': [adapter('10.2.3.4')], Other: [adapter('10.3.4.5')] });
  assert.equal(await resolveLanHost(undefined, { probe: offline, interfaces }), '10.2.3.4');
  await assert.rejects(resolveLanHost(undefined, { probe: offline, interfaces: () => ({ Ethernet: [adapter('10.2.3.4')], 'Wi-Fi': [adapter('192.168.50.25')] }) }), /Ethernet: 10\.2\.3\.4.*Wi-Fi: 192\.168\.50\.25/);
  await assert.rejects(resolveLanHost(undefined, { probe: offline, interfaces: () => ({ Loopback: [adapter('127.0.0.1', 'IPv4', true)], Ethernet: [adapter('8.8.8.8'), adapter('fe80::1', 'IPv6')], Docker: [adapter('172.17.0.1')] }) }), /Candidates: none/);
});
test('UDP probe closes on success/error/timeout, never sends data, and handles synchronous failure', async () => {
  const { EventEmitter } = require('node:events');
  const { probeRouteAddress } = await import('../scripts/local-lan-host.mjs');
  for (const mode of ['success', 'error', 'timeout', 'throw']) {
    const socket = new EventEmitter(); let closed = 0;
    socket.close = () => closed++;
    socket.address = () => ({ address:'10.2.3.4' });
    socket.connect = (port, host, callback) => {
      assert.equal(port, 53); assert.equal(host, '8.8.8.8');
      if (mode === 'success') callback();
      if (mode === 'error') socket.emit('error', Error('offline'));
      if (mode === 'throw') throw Error('connect failed');
    };
    socket.send = () => assert.fail('must not send application data');
    const result = probeRouteAddress(() => socket, 5);
    if (mode === 'success') assert.equal(await result, '10.2.3.4'); else await assert.rejects(result);
    assert.equal(closed, 1);
  }
});
test('local mode never discovers and active runtime config contains no old machine address', async () => {
  const { localDevConfig } = await import('../scripts/local-dev-config.mjs');
  const { readFileSync, readdirSync } = require('node:fs');
  const never = () => { throw Error('must not discover'); };
  const config = await localDevConfig(env, false, { probe: never, interfaces: never });
  assert.equal(config.env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_URL);
  const oldHost = ['192', '168', '1', '13'].join('.');
  for (const file of [...readdirSync('scripts').filter(f => f.endsWith('.mjs')).map(f => 'scripts/' + f), 'next.config.ts', 'supabase/config.toml', 'package.json']) assert.equal(readFileSync(file, 'utf8').includes(oldHost), false, file);
});
