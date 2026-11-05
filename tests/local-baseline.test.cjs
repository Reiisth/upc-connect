/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');
const manifest = JSON.parse(read('supabase/captures/manifest.json'));
const data = JSON.parse(read('supabase/captures/current-reference.json'));

test('one baseline, original archived bytes and immutable capture hashes', () => {
  assert.deepEqual(fs.readdirSync(path.join(root, 'supabase/migrations')).filter(name => name.endsWith('_current_state_baseline.sql')), ['20261104060000_current_state_baseline.sql']);
  assert.equal(Object.keys(manifest.archived_migration_sha256).length, 9);
  for (const [name, hash] of Object.entries(manifest.archived_migration_sha256)) {
    assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root, 'supabase/archive/pre_baseline', name))).digest('hex'), hash);
  }
  assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root, 'remote_schema.sql'))).digest('hex'), manifest.schema_dump.sha256);
  for (const [file, hash] of Object.entries(manifest.sha256)) assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex'), hash);
});

test('captured current RBAC/configuration, including deliberately limited roles', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])), {
    roles: 7, permissions: 48, role_permissions: 70, service_types: 5, departments: 4, member_field_definitions: 22,
  });
  const permissions = new Map(data.permissions.map(p => [p.id, p.key]));
  const grants = key => data.role_permissions.filter(r => r.role_id === data.roles.find(r => r.key === key).id).map(r => permissions.get(r.permission_id)).sort();
  assert.equal(grants('system_admin').length, 33);
  assert.equal(grants('pastor').length, 18);
  assert.deepEqual(grants('evangelism_officer'), ['baptisms.view', 'baptisms.water.create', 'baptisms.water.update', 'members.view', 'services.view']);
  assert.deepEqual(grants('spiritual_ministry_officer'), ['baptisms.holy_ghost.create', 'baptisms.holy_ghost.update', 'baptisms.view', 'members.view', 'services.view']);
  assert.deepEqual(data.service_types.map(r => r.key), ['other', 'prayer_meeting', 'special_service', 'sunday_evening', 'sunday_morning']);
  assert.deepEqual(data.departments.map(r => r.name), ['Faith Kid', 'Ladies Ministries', 'Men Department', 'Youth Ministries']);
  const bootstrap = read('supabase/bootstrap/current_reference.sql');
  for (const [table, rows] of Object.entries(data)) {
    assert.ok(bootstrap.includes(`INSERT INTO public.${table}`));
    const block = bootstrap.split(`INSERT INTO public.${table} (`)[1].split(';')[0];
    assert.equal((block.match(/^\(/gm) || []).length, rows.length, `${table} SQL row count`);
    for (const row of rows) assert.ok(bootstrap.includes(row.id || row.role_id || row.key));
  }
  assert.doesNotMatch(bootstrap, /INSERT INTO public\.(members|profiles|user_roles|account_members)\b/);
});

test('baseline reproduces full object definitions without platform dump machinery', () => {
  const baseline = read('supabase/migrations/20261104060000_current_state_baseline.sql');
  const remote = read('remote_schema.sql');
  assert.equal((baseline.match(/CREATE TABLE/g) || []).length, 18);
  assert.equal((baseline.match(/CREATE OR REPLACE FUNCTION/g) || []).length, 11);
  assert.equal((baseline.match(/CREATE POLICY/g) || []).length, 37);
  assert.equal((baseline.match(/ENABLE ROW LEVEL SECURITY/g) || []).length, 18);
  for (const body of remote.matchAll(/AS \$\$([\s\S]*?)\$\$;/g)) assert.ok(baseline.includes(body[0]), 'function body preserved');
  for (const policy of remote.matchAll(/CREATE POLICY[\s\S]*?;\n/g)) assert.ok(baseline.includes(policy[0].trim()), 'policy expression preserved');
  for (const index of remote.matchAll(/CREATE (?:UNIQUE )?INDEX[^\n]+;/g)) assert.ok(baseline.includes(index[0]), 'index definition preserved');
  assert.ok(baseline.includes(read('supabase/captures/auth-user-triggers.sql').trim()));
  assert.doesNotMatch(baseline, /OWNER TO|ALTER DEFAULT PRIVILEGES|CREATE EXTENSION|ALTER PUBLICATION|check_function_bodies|row_security = off|wedding_records/);
  assert.match(read('supabase/config.toml'), /sql_paths = \["\.\/bootstrap\/current_reference.sql", "\.\/seed.sql"\]/);
});

test('local Auth rejects hosted and deceptive URL targets before network or credentials', async () => {
  const localEnv = await import(pathToFileURL(path.join(root, 'scripts/local-env.mjs')).href);
  for (const url of ['https://example.supabase.co', 'http://127.0.0.1.evil.test', 'http://localhost@evil.test', 'http://localhost/path', 'file:///tmp/local', 'http://localhost/?redirect=evil']) assert.throws(() => localEnv.assertLoopback(url));
  for (const url of ['http://127.0.0.1:54321', 'http://localhost:54321', 'http://[::1]:54321']) assert.ok(localEnv.assertLoopback(url));
  const run = spawnSync(process.execPath, ['scripts/setup-local-auth.mjs'], { cwd: root, env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }, encoding: 'utf8' });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /loopback/);
  assert.match(read('scripts/setup-local-auth.mjs'), /redirect: 'error'/);
});

test('local commands reject target overrides; fixtures preserve linked lifecycle', () => {
  const run = spawnSync(process.execPath, ['scripts/local-db.mjs', 'reset', '--remote'], { cwd: root, encoding: 'utf8' });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /without extra arguments/);
  const seed = read('supabase/seed.sql');
  assert.match(seed, /Required service types are missing/);
  assert.match(seed, /THEN members.account_status ELSE EXCLUDED.account_status END/);
  assert.match(read('scripts/reseed-local.mjs'), /'127.0.0.1'/);
  for (const file of ['supabase/config.toml', 'scripts/setup-local-auth.mjs', 'supabase/captures/current-reference.json', 'supabase/captures/manifest.json']) {
    assert.doesNotMatch(read(file), /sb_secret_[A-Za-z0-9_-]{20,}|sb_publishable_[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  }
});
