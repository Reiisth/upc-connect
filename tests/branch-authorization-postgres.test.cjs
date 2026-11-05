/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner uses CommonJS. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const enabled = Boolean(process.env.UPC_AUTHZ_TEST_PG_PORT);
test('branch authorization migration against disposable PostgreSQL', { skip: !enabled }, async (t) => {
  const database = `upc_authz_test_${randomUUID().replaceAll('-', '')}`;
  const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
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
  const fixture = readFileSync(path.join(__dirname, 'fixtures/branch-authorization.sql'), 'utf8');
  const migration = readFileSync(path.join(__dirname, '../supabase/archive/pre_baseline/20261031090000_harden_branch_authorization.sql'), 'utf8');
  const runAs = (user, query, setup = '', fail = false) => sql(`BEGIN; ${setup}
    SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '${user ?? ''}'; ${query} ROLLBACK;`, { fail });
  const role = (key) => `public.has_role('${key}')`;
  const scope = (branch) => `public.has_branch_access('${branch}')`;
  const snapshot = () => sql(`SELECT jsonb_build_object(
    'branches',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.church_branches x),
    'assignments',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.user_branch_access x),
    'profiles',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.profiles x),
    'roles',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.roles x),
    'links',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.user_roles x));`);
  const ownPolicy = () => sql(`SELECT to_jsonb(p) FROM pg_policy p WHERE polrelid='public.user_branch_access'::regclass AND polname='Users can view their own branch access';`);
  const helperIdentity = () => sql(`SELECT jsonb_agg(jsonb_build_object('oid',oid,'owner',proowner,'args',proargnames) ORDER BY oid) FROM pg_proc
    WHERE oid IN ('public.has_role(text)'::regprocedure,'public.has_any_role(text[])'::regprocedure,'public.has_branch_access(uuid)'::regprocedure);`);
  sql(`CREATE DATABASE ${database};`, { db: 'postgres' });
  try {
    sql(fixture);
    await t.test('fixture reproduces verified legacy inactive/archived administrator bypass', () => {
      assert.equal(runAs(id(1), `SELECT count(*) FROM public.user_branch_access;`,
        `UPDATE public.roles SET is_active=false WHERE key='system_admin';`), '3');
      assert.equal(runAs(id(1), `SELECT ${role('system_admin')};`,
        `UPDATE public.profiles SET archived_at=now() WHERE id='${id(1)}';`), 't');
    });
    const before = snapshot(), ownBefore = ownPolicy(), identityBefore = helperIdentity();
    sql(migration);

    await t.test('migration preserves all data, own SELECT policy, function identity and ownership', () => {
      assert.equal(snapshot(), before); assert.equal(ownPolicy(), ownBefore); assert.equal(helperIdentity(), identityBefore);
      assert.equal(sql(`SELECT count(*) FROM pg_policy WHERE polrelid='public.user_branch_access'::regclass;`), '4');
    });
    await t.test('active non-archived administrator has global branch scope and global SELECT', () => {
      assert.equal(runAs(id(1), `SELECT ${scope(id(201))}, ${scope(id(202))}, ${role('system_admin')};`), 't|t|t');
      assert.equal(runAs(id(1), 'SELECT count(*) FROM public.user_branch_access;'), '3');
      // Branch activity stays a source-module policy concern, just as before.
      assert.equal(runAs(id(1), `SELECT ${scope(id(999))};`), 't');
    });
    await t.test('inactive administrator loses global scope but retains explicitly assigned scope and own SELECT', () => {
      const setup = `UPDATE public.roles SET is_active=false WHERE key='system_admin';`;
      assert.equal(runAs(id(1), `SELECT ${role('system_admin')}, public.has_any_role(ARRAY['system_admin']), ${scope(id(201))}, ${scope(id(202))};`, setup), 'f|f|t|f');
      assert.equal(runAs(id(1), 'SELECT count(*) FROM public.user_branch_access;', setup), '1');
    });
    await t.test('archived administrator has no role or branch capability even when assigned; own SELECT policy remains', () => {
      const setup = `UPDATE public.profiles SET archived_at=now() WHERE id='${id(1)}';`;
      assert.equal(runAs(id(1), `SELECT ${role('system_admin')}, public.has_any_role(ARRAY['system_admin']), ${scope(id(201))}, ${scope(id(202))};`, setup), 'f|f|f|f');
      assert.equal(runAs(id(1), 'SELECT count(*) FROM public.user_branch_access;', setup), '1');
    });
    await t.test('ordinary custom role sees only own assignments and cannot gain administrator scope', () => {
      assert.equal(runAs(id(2), `SELECT ${role('custom_staff')}, ${role('system_admin')}, ${scope(id(201))}, ${scope(id(202))};`), 't|f|t|f');
      assert.equal(runAs(id(2), 'SELECT count(*) FROM public.user_branch_access;'), '1');
      assert.equal(runAs(id(2), 'SELECT count(*) FROM public.profiles;'), '0', 'SECURITY DEFINER must work despite no profile SELECT policy');
    });
    await t.test('role key is authoritative despite name/display changes; a name impostor is not an admin', () => {
      assert.equal(runAs(id(1), `SELECT ${role('system_admin')}, ${scope(id(202))};`,
        `UPDATE public.roles SET name='Renamed role',display_name='Changed display' WHERE key='system_admin';`), 't|t');
      assert.equal(runAs(id(2), `SELECT ${role('system_admin')}, ${scope(id(202))};`,
        `UPDATE public.roles SET name='system_admin',display_name='System administrator' WHERE key='custom_staff';`), 'f|f');
      assert.equal(runAs(id(1), `SELECT ${role('system_admin')}, ${scope(id(202))};`,
        `UPDATE public.roles SET key='former_admin' WHERE key='system_admin';`), 'f|f');
    });
    await t.test('has_role and has_any_role ignore inactive roles and handle empty/null input', () => {
      assert.equal(runAs(id(2), `SELECT ${role('inactive_staff')}, public.has_any_role(ARRAY['inactive_staff']),
        public.has_any_role(ARRAY['inactive_staff','custom_staff']), public.has_any_role(ARRAY[]::text[]),
        public.has_any_role(NULL::text[]), public.has_role(NULL::text);`), 'f|f|t|f|f|f');
    });
    await t.test('missing account profile and missing authenticated subject fail closed', () => {
      assert.equal(runAs(id(1), `SELECT ${role('system_admin')}, ${scope(id(201))};`,
        `DELETE FROM public.profiles WHERE id='${id(1)}';`), 'f|f');
      assert.equal(runAs(null, `SELECT ${role('system_admin')}, ${scope(id(201))};`), 'f|f');
    });
    await t.test('only active administrator can INSERT branch assignments; no ordinary/custom broad write policy added', () => {
      const insert = `INSERT INTO public.user_branch_access(user_id,church_branch_id) VALUES ('${id(2)}','${id(202)}');`;
      assert.equal(runAs(id(1), `${insert} SELECT count(*) FROM public.user_branch_access;`), '4');
      for (const [user, setup] of [[id(2), ''], [id(1), `UPDATE public.roles SET is_active=false WHERE key='system_admin';`],
        [id(1), `UPDATE public.profiles SET archived_at=now() WHERE id='${id(1)}';`]]) {
        assert.match(runAs(user, insert, setup, true), /42501/);
      }
    });
    await t.test('only active administrator can DELETE branch assignments; ordinary own SELECT does not imply DELETE', () => {
      const deletion = `DELETE FROM public.user_branch_access WHERE user_id='${id(2)}';`;
      assert.equal(runAs(id(1), `${deletion} SELECT count(*) FROM public.user_branch_access;`), '2');
      for (const [user, setup] of [[id(2), ''], [id(1), `UPDATE public.roles SET is_active=false WHERE key='system_admin';`],
        [id(1), `UPDATE public.profiles SET archived_at=now() WHERE id='${id(1)}';`]]) {
        assert.equal(runAs(user, `DELETE FROM public.user_branch_access WHERE user_id='${user}';
          SELECT count(*) FROM public.user_branch_access WHERE user_id='${user}';`, setup), '1');
      }
      assert.equal(snapshot(), before, 'rolled-back policy tests cannot change source rows');
    });
    await t.test('restoring a profile or reactivating its role reuses preserved grants on the next statement', () => {
      assert.equal(sql(`BEGIN; UPDATE public.profiles SET archived_at=now() WHERE id='${id(1)}';
        SET LOCAL request.jwt.claim.sub='${id(1)}'; SELECT ${role('system_admin')};
        UPDATE public.profiles SET archived_at=NULL WHERE id='${id(1)}'; SELECT ${role('system_admin')};
        UPDATE public.roles SET is_active=false WHERE key='system_admin'; SELECT ${role('system_admin')};
        UPDATE public.roles SET is_active=true WHERE key='system_admin'; SELECT ${role('system_admin')}; ROLLBACK;`), 'f\nt\nf\nt');
    });
    await t.test('SECURITY DEFINER search_path is pinned; temp tables cannot spoof authorization', () => {
      assert.equal(sql(`SELECT count(*) FROM pg_proc WHERE oid IN ('public.has_role(text)'::regprocedure,
        'public.has_any_role(text[])'::regprocedure,'public.has_branch_access(uuid)'::regprocedure)
        AND prosecdef AND provolatile='s' AND proconfig @> ARRAY['search_path=public, pg_temp'];`), '3');
      assert.equal(runAs(id(2), `CREATE TEMP TABLE roles(key text,is_active boolean);
        INSERT INTO pg_temp.roles VALUES('system_admin',true); SELECT ${role('system_admin')}, ${scope(id(202))};`), 'f|f');
    });
    await t.test('anonymous/PUBLIC execution revoked; authenticated and service_role grants retained', () => {
      for (const signature of ['has_role(text)', 'has_any_role(text[])', 'has_branch_access(uuid)']) {
        assert.equal(sql(`SELECT has_function_privilege('anon','public.${signature}','EXECUTE'),
          has_function_privilege('authenticated','public.${signature}','EXECUTE'),
          has_function_privilege('service_role','public.${signature}','EXECUTE');`), 'f|t|t');
        assert.equal(sql(`SELECT count(*) FROM pg_proc p, LATERAL aclexplode(p.proacl) a
          WHERE p.oid='public.${signature}'::regprocedure AND a.grantee=0;`), '0');
      }
      assert.match(sql(`SET ROLE anon; SELECT public.has_role('system_admin');`, { fail: true }), /42501/);
      assert.equal(sql(`SET ROLE service_role; SELECT public.has_role('system_admin');`), 'f', 'service_role without a subject does not invent admin scope');
    });
    await t.test('unchanged operational AND policy still requires permission independently of branch scope', () => {
      assert.equal(runAs(id(1), `SELECT count(*) FROM public.scope_probe;`), '0');
      assert.equal(runAs(id(1), `SET LOCAL test.permission='services.view'; SELECT count(*) FROM public.scope_probe;`), '2');
      assert.equal(runAs(id(2), `SET LOCAL test.permission='services.view'; SELECT count(*) FROM public.scope_probe;`), '1');
      assert.equal(runAs(id(1), `SET LOCAL test.permission='services.view'; SELECT count(*) FROM public.scope_probe;`,
        `UPDATE public.profiles SET archived_at=now() WHERE id='${id(1)}';`), '0');
    });
    await t.test('migration is repeatable without changing data or own-access policy', () => {
      sql(migration); assert.equal(snapshot(), before); assert.equal(ownPolicy(), ownBefore);
    });
    await t.test('unexpected policy drift fails preflight without partially replacing helpers', () => {
      sql(`ALTER POLICY "System admins can insert branch access" ON public.user_branch_access RENAME TO unexpected_insert;`);
      const definition = sql(`SELECT pg_get_functiondef('public.has_role(text)'::regprocedure);`);
      assert.match(sql(migration, { fail: true }), /Expected user_branch_access policies differ/);
      assert.equal(sql(`SELECT pg_get_functiondef('public.has_role(text)'::regprocedure);`), definition);
    });
  } finally {
    assert.match(database, /^upc_authz_test_[a-f0-9]+$/);
    sql(`DROP DATABASE ${database};`, { db: 'postgres' });
  }
});
