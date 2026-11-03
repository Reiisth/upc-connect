/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner uses CommonJS. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');

function actionHarness({ permissions = ['departments.manage'], insertError = null, updateResult = { id: 'dept-1' } } = {}) {
  const calls = { required: [], inserts: [], updates: [], revalidated: [] };
  const query = {
    update(values) { calls.updates.push(values); return this; },
    eq() { return this; },
    select() { return this; },
    maybeSingle: async () => ({ data: updateResult, error: null }),
  };
  const loadedActions = loadTypeScript('app/portal/administration/departments/actions.ts', {
    '../access': { requireAdministrationPermission: async (key) => {
      calls.required.push(key);
      if (!permissions.includes(key)) throw new Error('denied');
    } },
    '@/lib/supabase/admin': { createAdminClient: () => ({ from: (table) => {
      assert.equal(table, 'departments');
      return { insert: async (row) => { calls.inserts.push(row); return { error: insertError }; }, ...query };
    } }) },
    'next/cache': { revalidatePath: (route) => calls.revalidated.push(route) },
    'next/navigation': { redirect: (route) => { throw new Error(`redirect:${route}`); } },
  });
  return { ...loadedActions, calls };
}

test('department actions require departments.manage and normalize new names', async () => {
  const unauthorized = actionHarness({ permissions: ['departments.view'] });
  await assert.rejects(unauthorized.createDepartment(new FormData()), /denied/);
  assert.equal(unauthorized.calls.inserts.length, 0);

  const authorized = actionHarness();
  const form = new FormData();
  form.set('name', '  Youth   Ministry  ');
  await assert.rejects(authorized.createDepartment(form), /redirect:\/portal\/administration\/departments/);
  assert.equal(authorized.calls.inserts[0].name, 'Youth Ministry');
  assert.equal(authorized.calls.inserts[0].is_active, true);
  assert.deepEqual(authorized.calls.required, ['departments.manage']);
});

test('department create rejects blank, overlong and duplicate normalized names', async () => {
  const blank = actionHarness();
  await assert.rejects(blank.createDepartment(new FormData()), /Department name is required/);
  const long = actionHarness();
  const longForm = new FormData(); longForm.set('name', 'x'.repeat(121));
  await assert.rejects(long.createDepartment(longForm), /120 characters/);
  const duplicate = actionHarness({ insertError: { code: '23505' } });
  const form = new FormData(); form.set('name', 'YOUTH');
  await assert.rejects(duplicate.createDepartment(form), /already exists/);
});

test('department rename and lifecycle update are permission-gated and preserve linked members', async () => {
  const h = actionHarness();
  const form = new FormData(); form.set('name', '  Music  ');
  await assert.rejects(h.updateDepartment('dept-1', form), /redirect:\/portal\/administration\/departments/);
  assert.equal(h.calls.updates[0].name, 'Music');
  assert.equal(typeof h.calls.updates[0].updated_at, 'string');
  await h.setDepartmentActive('dept-1', false);
  assert.equal(h.calls.updates[1].is_active, false);
  assert.ok(!('department_id' in h.calls.updates[1]));
  await h.setDepartmentActive('dept-1', true);
  assert.equal(h.calls.updates[2].is_active, true);
  assert.ok(h.calls.revalidated.includes('/portal/members'));
});

test('department access, global scope, deactivation semantics and managed Member options are explicit', () => {
  const page = fs.readFileSync('app/portal/administration/departments/page.tsx', 'utf8');
  assert.match(page, /requireActiveAccount/);
  assert.match(page, /hasAnyPermission\(permissions, \["departments\.view", "departments\.manage"\]\)/);
  assert.match(page, /from\("departments"\)/);
  assert.match(page, /departments\.manage/);
  assert.match(page, /global department options/);
  const lifecycle = fs.readFileSync('app/portal/administration/departments/DepartmentLifecycleAction.tsx', 'utf8');
  assert.match(lifecycle, /Existing Member records will keep this department/);
  const newMember = fs.readFileSync('app/portal/members/new/page.tsx', 'utf8');
  assert.match(newMember, /\.eq\("is_active", true\)/);
  const editMember = fs.readFileSync('app/portal/members/[memberId]/edit/page.tsx', 'utf8');
  assert.match(editMember, /department\.is_active \|\| department\.id === member\.department_id/);
  assert.match(editMember, /departmentOptions/);
  assert.match(fs.readFileSync('app/portal/members/actions.ts', 'utf8'), /!data\.is_active && !allowCurrentInactive/);
  const memberDetail = fs.readFileSync('app/portal/members/[memberId]/page.tsx', 'utf8');
  assert.match(memberDetail, /from\("departments"\)/);
  const fieldPolicy = fs.readFileSync('lib/member-field-policy.ts', 'utf8');
  assert.match(fieldPolicy, /CHURCH_MANAGED_FIELDS[\s\S]*"department_id"/);
  assert.doesNotMatch(fieldPolicy.slice(fieldPolicy.indexOf('SELF_SERVICE_FIELDS'), fieldPolicy.indexOf('] as const')), /"department_id"/);
});

test('department permissions use the catalog and role seeding stays limited to system_admin and pastor', () => {
  const catalog = fs.readFileSync('lib/permissions.ts', 'utf8');
  assert.match(catalog, /"departments\.view"/);
  assert.match(catalog, /"departments\.manage"/);
  const migration = fs.readFileSync('supabase/migrations/20261103100000_departments_and_permission_cleanup.sql', 'utf8');
  assert.match(migration, /role_record\.key IN \('system_admin', 'pastor'\)/);
  assert.match(migration, /ON CONFLICT \(key\) DO UPDATE/);
});
