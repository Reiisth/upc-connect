/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:net');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');

test('Next internals bypass auth routing while portal routes stay protected', () => {
  const { config } = loadTypeScript('proxy.ts', { '@/lib/supabase/proxy': {}, 'next/server': {} });
  const matcher = new RegExp(`^${config.matcher[0]}$`);
  for (const path of ['/_next/static/chunks/app/portal/layout.js', '/_next/image', '/_next/hmr']) assert.equal(matcher.test(path), false);
  for (const path of ['/portal', '/portal/members', '/portal/account']) assert.equal(matcher.test(path), true);
});

test('LAN dev allows both local origins without changing asset paths or production config', () => {
  const saved = { ...process.env };
  try {
    process.env.NODE_ENV = 'development';
    process.env.UPC_LOCAL_LAN_HOST = '192.168.50.25';
    const config = loadTypeScript('next.config.ts').default;
    assert.deepEqual(Array.from(config.allowedDevOrigins), ['localhost', '127.0.0.1', '192.168.50.25']);
    for (const key of ['assetPrefix', 'basePath', 'webpack', 'rewrites', 'redirects', 'headers', 'crossOrigin', 'deploymentId']) assert.equal(config[key], undefined);
    process.env.NODE_ENV = 'production';
    assert.equal(loadTypeScript('next.config.ts').default.allowedDevOrigins.length, 0);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});

test('local launcher rejects an existing listener rather than mixing runtimes or changing ports', async () => {
  const { assertDevPortAvailable } = await import('../scripts/local-dev-port.mjs');
  const { localDevConfig } = await import('../scripts/local-dev-config.mjs');
  const server = createServer(socket => socket.destroy());
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try { await assert.rejects(assertDevPortAvailable(port), /already has a listener/); }
  finally { await new Promise(resolve => server.close(resolve)); }
  await assertDevPortAvailable(port);
  const config = await localDevConfig({ NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public-test', SUPABASE_SECRET_KEY: 'private-test' });
  assert.ok(config.args.includes('--port'));
  assert.equal(config.port, 3000);
});
test('managed local starts disable persisted public-env chunks while production remains unchanged', () => {
  const saved = { ...process.env };
  try {
    process.env.NODE_ENV = 'development'; process.env.UPC_LOCAL_INTERNAL_SUPABASE_URL = 'http://127.0.0.1:54321';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://10.23.4.5:54321';
    assert.equal(loadTypeScript('next.config.ts').default.experimental.turbopackFileSystemCacheForDev, false);
    process.env.NODE_ENV = 'production';
    assert.equal(loadTypeScript('next.config.ts').default.experimental.turbopackFileSystemCacheForDev, undefined);
    assert.equal(loadTypeScript('next.config.ts').default.experimental.staleTimes.dynamic, 30);
  } finally { for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]; Object.assign(process.env, saved); }
});
test('real Next env loader preserves launcher public URL ahead of .env.local values', async () => {
  const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
  const { tmpdir } = require('node:os'); const { join } = require('node:path'); const { spawnSync } = require('node:child_process');
  const { localDevConfig } = await import('../scripts/local-dev-config.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'upc-next-env-'));
  try {
    writeFileSync(join(dir, '.env.local'), 'NEXT_PUBLIC_SUPABASE_URL=http://10.99.0.1:54321\n');
    for (const lan of [true, false]) {
      const config = await localDevConfig({NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'test-public',SUPABASE_SECRET_KEY:'test-private'},lan,{probe:async()=> '10.23.4.5'});
      const source = 'const {loadEnvConfig}=require("@next/env");loadEnvConfig(process.argv[1],true,{info(){},error(){}});console.log(process.env.NEXT_PUBLIC_SUPABASE_URL);';
      const result = spawnSync(process.execPath,['-e',source,dir],{env:{...config.env,NODE_ENV:'development'},encoding:'utf8'});
      assert.equal(result.status,0,result.stderr);
      assert.equal(result.stdout.trim(), lan ? 'http://10.23.4.5:54321' : 'http://127.0.0.1:54321');
    }
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
