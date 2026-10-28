const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const calculation = require('../lib/inactivity/calculate.ts');
const permissions = require('../lib/permissions.ts');

// Execute the real loader with its imports stubbed, without Next.js or live data.
const serverCode = ts.transpileModule(
  readFileSync(join(__dirname, '../lib/inactivity/server.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } },
).outputText;

function member(id, overrides = {}) {
  return {
    id, church_branch_id: 'a', is_archived: false,
    member_status: 'inactive', first_attendance_date: '2026-01-05',
    ...overrides,
  };
}

function inactivityServer(members, { threshold = 3, attendance = [], branchIds = ['a'], permissionKeys = ['inactivity.view'] } = {}) {
  const services = ['2026-10-05', '2026-10-12', '2026-10-19'].map((date, i) => ({
    id: `s${i}`, church_branch_id: 'a', service_date: date, status: 'completed',
  }));
  const tables = {
    church_branches: [{ id: 'a', name: 'Main Church', code: 'MAIN', is_active: true, inactivity_threshold_weeks: threshold }],
    members, services,
    attendance_records: attendance.map((row, i) => ({
      id: `r${i}`, ...row, services: services.find((s) => s.id === row.service_id),
    })),
  };

  class Query {
    constructor(rows) { this.rows = rows; }
    value(row, key) { return key.split('.').reduce((value, part) => value?.[part], row); }
    select() { return this; }
    eq(key, value) { this.rows = this.rows.filter((row) => this.value(row, key) === value); return this; }
    lte(key, value) { this.rows = this.rows.filter((row) => this.value(row, key) <= value); return this; }
    in(key, values) { this.rows = this.rows.filter((row) => values.includes(this.value(row, key))); return this; }
    order(key) { this.rows = [...this.rows].sort((a, b) => String(a[key]).localeCompare(String(b[key]))); return this; }
    range(from, to) { this.rows = this.rows.slice(from, to + 1); return this; }
    maybeSingle() { return Promise.resolve({ data: this.rows[0] ?? null, error: null }); }
    then(resolve, reject) { return Promise.resolve({ data: this.rows, error: null }).then(resolve, reject); }
  }

  const imports = {
    'server-only': {},
    '@/lib/branch-access': { getUserBranchScope: async () => ({ branchIds, isSystemAdmin: false }) },
    '@/lib/permissions-server': {
      requirePermission: async (permission) => {
        assert.equal(permission, 'inactivity.view');
        if (!permissionKeys.includes(permission)) throw new Error('Access denied');
        return { user: { id: 'viewer' }, permissions: permissionKeys };
      },
    },
    '@/lib/permissions': permissions,
    '@/lib/supabase/admin': { createAdminClient: () => ({ from: (table) => new Query(tables[table]) }) },
    './calculate': calculation,
  };
  const module = { exports: {} };
  vm.runInNewContext(serverCode, {
    module, exports: module.exports,
    require: (name) => {
      assert.ok(Object.hasOwn(imports, name), `Unexpected import ${name}`);
      return imports[name];
    },
    Date: class extends Date { constructor() { super('2026-10-27T04:00:00Z'); } },
  });
  return module.exports;
}

function loader(members, options) {
  return inactivityServer(members, options).getBranchMemberInactivity;
}

test('loader includes non-archived members with stored inactive status', async () => {
  const result = await loader([member('inactive')])('a');
  assert.equal(result.length, 1);
  assert.equal(result[0].memberId, 'inactive');
  assert.equal(result[0].calculationStatus, 'evaluated');
  assert.equal(result[0].consecutiveAbsentWeeks, 3);
  assert.equal(result[0].isInactive, true);
});

test('loader excludes archived and other-branch members', async () => {
  const result = await loader([
    member('included'), member('archived', { is_archived: true }),
    member('other-branch', { church_branch_id: 'b' }),
  ])('a');
  assert.deepEqual(Array.from(result, (summary) => summary.memberId), ['included']);
});

test('loader retains missing/invalid first attendance dates as unknown without a created_at fallback', async () => {
  const result = await loader([
    member('missing', { first_attendance_date: null, created_at: '2026-01-01T00:00:00Z' }),
    member('invalid', { first_attendance_date: '2026-02-30' }),
  ])('a');
  assert.equal(result.length, 2);
  for (const summary of result) {
    assert.equal(summary.calculationStatus, 'eligibility_unknown');
    assert.equal(summary.consecutiveAbsentWeeks, null);
    assert.equal(summary.isInactive, null);
    assert.equal(summary.remainingWeeksBeforeInactive, null);
  }
});

test('derived inactivity depends on weekly absence streak and threshold, not stored status', async () => {
  const members = [member('inactive'), member('active', { member_status: 'active' })];
  const result = await loader(members)('a');
  assert.ok(result.every((summary) => summary.consecutiveAbsentWeeks === 3 && summary.isInactive));
  const higherThreshold = await loader(members, { threshold: 4 })('a');
  assert.ok(higherThreshold.every((summary) => summary.consecutiveAbsentWeeks === 3 && !summary.isInactive));
  const attended = await loader(members, {
    attendance: [{ member_id: 'inactive', service_id: 's2', attendance_status: 'present' }],
  })('a');
  const inactive = attended.find((summary) => summary.memberId === 'inactive');
  assert.equal(inactive.consecutiveAbsentWeeks, 0);
  assert.equal(inactive.isInactive, false);
});

test('loader still rejects branches outside the authenticated scope', async () => {
  await assert.rejects(loader([member('inactive')], { branchIds: [] })('a'), /accessible active branches/);
});

test('member names accompany calculated summaries without a separate member query', async () => {
  const [row] = await loader([member('named', { first_name: 'Juan', middle_name: null, last_name: 'Dela Cruz' })])('a');
  assert.equal(row.memberName, 'Juan Dela Cruz');
});

test('branch options respect scope and explicit permission capabilities', async () => {
  const readOnly = await inactivityServer([]).getInactivityBranchOptions();
  assert.equal(readOnly.branches.length, 1);
  assert.equal(readOnly.branches[0].name, 'Main Church');
  assert.equal(readOnly.canManageSettings, false);
  const customPermissions = await inactivityServer([], {
    permissionKeys: ['inactivity.view', 'inactivity.manage_settings'],
  }).getInactivityBranchOptions();
  assert.equal(customPermissions.canManageSettings, true);
  const noAccess = await inactivityServer([], { branchIds: ['b'] }).getInactivityBranchOptions();
  assert.equal(noAccess.branches.length, 0);
  await assert.rejects(inactivityServer([], { permissionKeys: [] }).getInactivityBranchOptions(), /Access denied/);
});
