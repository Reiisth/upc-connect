/* eslint-disable @typescript-eslint/no-require-imports -- PostgreSQL integration uses CommonJS and psql. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const enabled = Boolean(process.env.UPC_AUTHZ_TEST_PG_PORT);
test('departments and obsolete permission migration against disposable PostgreSQL', { skip: !enabled }, async (t) => {
  const database = `upc_departments_test_${randomUUID().replaceAll('-', '')}`;
  function sql(source, { db = database, fail = false } = {}) {
    const result = spawnSync(process.env.UPC_AUTHZ_PSQL || 'psql', [
      '-X', '-w', '-qAt', '-h', process.env.UPC_AUTHZ_TEST_PG_HOST || '127.0.0.1',
      '-p', process.env.UPC_AUTHZ_TEST_PG_PORT, '-U', process.env.UPC_AUTHZ_TEST_PG_USER || 'postgres',
      '-d', db, '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose',
    ], { input: source, encoding: 'utf8' });
    if (result.error) throw result.error;
    if (fail) { assert.notEqual(result.status, 0, 'Expected SQL to fail'); return result.stderr; }
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.replace(/\r\n/g, '\n').trim();
  }
  const fixture = readFileSync(path.join(__dirname, 'fixtures/departments.sql'), 'utf8');
  const migration = readFileSync(path.join(__dirname, '../supabase/migrations/20261103100000_departments_and_permission_cleanup.sql'), 'utf8');
  sql(`CREATE DATABASE ${database};`, { db: 'postgres' });
  try {
    sql(fixture);
    sql(migration);
    await t.test('migration reuses department rows, adds lifecycle metadata and seeds only intended roles', () => {
      assert.equal(sql(`SELECT count(*) FROM public.departments;`), '2');
      assert.equal(sql(`SELECT bool_and(is_active) AND count(*)=2 FROM public.departments;`), 't');
      assert.equal(sql(`SELECT count(*) FROM public.role_permissions rp JOIN public.permissions p ON p.id=rp.permission_id WHERE p.key LIKE 'departments.%';`), '4');
      assert.equal(sql(`SELECT count(*) FROM public.role_permissions rp JOIN public.permissions p ON p.id=rp.permission_id JOIN public.roles r ON r.id=rp.role_id WHERE p.key LIKE 'departments.%' AND r.key='evangelism_officer';`), '0');
    });
    await t.test('dashboard permission is removed while Reports grants and department assignments remain', () => {
      assert.equal(sql(`SELECT count(*) FROM public.permissions WHERE key='dashboard.view';`), '0');
      assert.equal(sql(`SELECT count(*) FROM public.role_permissions rp JOIN public.permissions p ON p.id=rp.permission_id WHERE p.key='dashboard.view';`), '0');
      assert.equal(sql(`SELECT count(*) FROM public.role_permissions rp JOIN public.permissions p ON p.id=rp.permission_id WHERE p.key='reports.view';`), '1');
      assert.equal(sql(`SELECT count(*) FROM public.departments WHERE name IN ('Youth','Worship');`), '2');
    });
    await t.test('case and outer-space normalized duplicates are rejected and migration is repeatable', () => {
      assert.match(sql(`INSERT INTO public.departments (id,name) VALUES ('00000000-0000-0000-0000-000000000023',' YOUTH ');`, { fail: true }), /departments_normalized_name_uidx/);
      sql(migration);
      assert.equal(sql(`SELECT count(*) FROM public.departments;`), '2');
    });
  } finally {
    sql(`DROP DATABASE IF EXISTS ${database} WITH (FORCE);`, { db: 'postgres' });
  }
});
