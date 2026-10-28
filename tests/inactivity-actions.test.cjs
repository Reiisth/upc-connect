const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { calculateWeeklyInactivity } = require('../lib/inactivity/calculate.ts');

const actionCode = ts.transpileModule(
  readFileSync(join(__dirname, '../app/portal/inactivity/actions.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } },
).outputText;

function harness({ permissionKeys = ['inactivity.manage_settings'], branchIds = ['a'],
  isSystemAdmin = false, active = true, authenticated = true, databaseError = null } = {}) {
  const branch = { id: 'a', is_active: active, inactivity_threshold_weeks: 3, name: 'Unchanged branch name' };
  const writes = [], revalidated = [];
  let adminCalls = 0;
  const admin = {
    from(table) {
      assert.equal(table, 'church_branches', 'No other table may be written');
      const filters = [];
      let patch;
      return {
        update(value) { patch = value; return this; },
        eq(key, value) { filters.push([key, value]); return this; },
        select() { return this; },
        async maybeSingle() {
          if (databaseError) return { data: null, error: databaseError };
          if (!filters.every(([key, value]) => branch[key] === value)) return { data: null, error: null };
          writes.push(patch);
          Object.assign(branch, patch);
          return { data: { id: branch.id }, error: null };
        },
      };
    },
  };
  const imports = {
    'next/cache': { revalidatePath: (path) => revalidated.push(path) },
    '@/lib/branch-access': { getUserBranchScope: async () => ({ branchIds, isSystemAdmin }) },
    '@/lib/permissions-server': {
      requirePermission: async (permission) => {
        assert.equal(permission, 'inactivity.manage_settings');
        if (!authenticated) throw new Error('Login required');
        if (!permissionKeys.includes(permission)) throw new Error('Access denied');
        return { user: { id: 'current-user' }, permissions: permissionKeys };
      },
    },
    '@/lib/supabase/admin': { createAdminClient: () => { adminCalls++; return admin; } },
  };
  const module = { exports: {} };
  vm.runInNewContext(actionCode, {
    module, exports: module.exports, console: { error() {} },
    require(name) { assert.ok(Object.hasOwn(imports, name)); return imports[name]; },
  });
  return {
    branch, writes, revalidated, adminCalls: () => adminCalls,
    save(value, branchId = 'a', extra = {}) {
      const form = new FormData();
      if (value !== undefined) form.set('inactivity_threshold_weeks', value);
      for (const [key, content] of Object.entries(extra)) form.set(key, content);
      return module.exports.updateInactivityThreshold(branchId, { status: 'idle', message: '' }, form);
    },
  };
}

test('view-only users and system administrators cannot manage settings without explicit permission', async () => {
  for (const isSystemAdmin of [false, true]) {
    const h = harness({ permissionKeys: ['inactivity.view'], isSystemAdmin });
    await assert.rejects(h.save('4'), /Access denied/);
    assert.equal(h.adminCalls(), 0);
    assert.equal(h.writes.length, 0);
  }
  await assert.rejects(harness({ authenticated: false }).save('4'), /Login required/);
});

test('custom-role capability can update only its accessible branch', async () => {
  const h = harness(); // No operational role names are supplied to the action.
  assert.equal((await h.save('4', 'b')).status, 'error');
  assert.equal(h.adminCalls(), 0);
  assert.equal((await h.save('4')).status, 'success');
  assert.equal(h.branch.inactivity_threshold_weeks, 4);
  assert.equal(h.revalidated[0], '/portal/inactivity');
});

test('threshold action rejects non-integers, missing values and out-of-range values', async () => {
  for (const value of [undefined, '', '0', '53', '-1', '1.5', '3.0', 'abc', '1e1', 'Infinity']) {
    const h = harness();
    assert.equal((await h.save(value)).status, 'error', String(value));
    assert.equal(h.adminCalls(), 0);
  }
  for (const value of ['1', '52']) assert.equal((await harness().save(value)).status, 'success');
});

test('only threshold is written; injected branch fields are ignored', async () => {
  const h = harness();
  await h.save('4', 'a', { name: 'Injected name', is_active: 'false', member_status: 'inactive' });
  assert.deepEqual(Object.keys(h.writes[0]), ['inactivity_threshold_weeks']);
  assert.equal(h.branch.name, 'Unchanged branch name');
  assert.equal(h.branch.is_active, true);
});

test('inactive branch or failed update cannot report success or revalidate results', async () => {
  for (const options of [{ active: false }, { databaseError: { message: 'Database unavailable' } }]) {
    const h = harness(options);
    assert.equal((await h.save('4')).status, 'error');
    assert.equal(h.writes.length, 0);
    assert.equal(h.revalidated.length, 0);
  }
});

test('changing the rule immediately changes derived status with no member or attendance writes', async () => {
  const h = harness();
  function calculate() {
    return calculateWeeklyInactivity({
      today: '2026-10-27', thresholds: new Map([['a', h.branch.inactivity_threshold_weeks]]),
      members: [{ id: 'm', branchId: 'a', eligibilityDate: '2026-01-05' }], attendance: [],
      services: ['2026-10-05', '2026-10-12', '2026-10-19'].map((serviceDate, i) => ({
        id: String(i), serviceDate, branchId: 'a', status: 'completed',
      })),
    })[0];
  }
  assert.equal(calculate().isInactive, true);
  await h.save('4');
  assert.equal(calculate().isInactive, false);
  assert.equal(calculate().consecutiveAbsentWeeks, 3);
  assert.equal(calculate().inactivityThresholdWeeks, 4);
  assert.equal(h.writes.length, 1);
});
