/* eslint-disable @typescript-eslint/no-require-imports, @next/next/no-assign-module-variable -- CommonJS regression harness. */
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
    member_status: 'inactive', first_attendance_date: '2022-05-10', created_at: '2026-01-05T00:00:00Z',
    ...overrides,
  };
}

function inactivityServer(members, { threshold = 3, attendance = [], branchIds = ['a'], permissionKeys = ['inactivity.view'], extraServices = [] } = {}) {
  const services = ['2026-10-05', '2026-10-12', '2026-10-19'].map((date, i) => ({
    id: `s${i}`, church_branch_id: 'a', service_date: date, status: 'completed',
  })).concat(extraServices);
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
    gte(key, value) { this.rows = this.rows.filter((row) => this.value(row, key) >= value); return this; }
    lte(key, value) { this.rows = this.rows.filter((row) => this.value(row, key) <= value); return this; }
    in(key, values) { this.rows = this.rows.filter((row) => values.includes(this.value(row, key))); return this; }
    order(key) { this.rows = [...this.rows].sort((a, b) => String(a[key]).localeCompare(String(b[key]))); return this; }
    range(from, to) { this.rows = this.rows.slice(from, to + 1); return this; }
    maybeSingle() { return Promise.resolve({ data: this.rows[0] ?? null, error: null }); }
    then(resolve, reject) { return Promise.resolve({ data: this.rows, error: null }).then(resolve, reject); }
  }

  const imports = {
    'server-only': {},
    '@/lib/inactivity/participation': require('./helpers/load-typescript.cjs').loadTypeScript('lib/inactivity/participation.ts', { 'server-only': {} }),
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
  assert.equal(result[0].needsFollowUp, true);
  assert.equal(result[0].memberStatus, 'inactive');
});

test('created_at controls eligibility and first_attendance_date changes cannot move monitoring start', async () => {
  const registeredWednesday = member('registered-wednesday', {
    created_at: '2026-10-14T00:00:00Z', first_attendance_date: '2022-05-10',
  });
  const first = await loader([registeredWednesday], { attendance: [{ member_id: registeredWednesday.id, service_id: 's1', attendance_status: 'present' }] })('a');
  const afterHistoricalDateEdit = await loader([{ ...registeredWednesday, first_attendance_date: '2026-10-20' }], {
    attendance: [{ member_id: registeredWednesday.id, service_id: 's1', attendance_status: 'present' }],
  })('a');
  assert.equal(first[0].monitoringStartDate, '2026-10-14');
  assert.equal(first[0].consecutiveAbsentWeeks, 1, 'Only the full week beginning Monday October 19 is eligible');
  assert.equal(first[0].recentEligibleWeeks, 1);
  assert.equal(afterHistoricalDateEdit[0].consecutiveAbsentWeeks, first[0].consecutiveAbsentWeeks);
  assert.equal(afterHistoricalDateEdit[0].needsFollowUp, first[0].needsFollowUp);
});

test('loader excludes archived and other-branch members', async () => {
  const result = await loader([
    member('included'), member('archived', { is_archived: true }),
    member('other-branch', { church_branch_id: 'b' }),
  ])('a');
  assert.deepEqual(Array.from(result, (summary) => summary.memberId), ['included']);
});

test('first attendance reference does not affect monitoring; missing or invalid created_at is unknown', async () => {
  const result = await loader([
    member('missing-first-attendance', { first_attendance_date: null }),
    member('old-first-attendance', { first_attendance_date: '2022-05-10' }),
    member('missing-created-at', { created_at: null }),
    member('invalid-created-at', { created_at: 'invalid' }),
  ])('a');
  assert.equal(result.length, 4);
  for (const summary of result.filter((row) => row.memberId.includes('created-at'))) {
    assert.equal(summary.calculationStatus, 'eligibility_unknown');
    assert.equal(summary.consecutiveAbsentWeeks, null);
    assert.equal(summary.needsFollowUp, null);
    assert.equal(summary.remainingWeeksBeforeFollowUp, null);
  }
  assert.equal(result.find((row) => row.memberId === 'missing-first-attendance').calculationStatus, 'evaluated');
  assert.equal(result.find((row) => row.memberId === 'old-first-attendance').calculationStatus, 'evaluated');
});

test('derived inactivity depends on weekly absence streak and threshold, not stored status', async () => {
  const members = [member('inactive'), member('active', { member_status: 'active' })];
  const result = await loader(members)('a');
  assert.ok(result.every((summary) => summary.consecutiveAbsentWeeks === 3 && summary.needsFollowUp));
  const higherThreshold = await loader(members, { threshold: 4 })('a');
  assert.ok(higherThreshold.every((summary) => summary.consecutiveAbsentWeeks === 3 && !summary.needsFollowUp));
  for (const status of ['present']) {
    const attended = await loader(members, {
      attendance: [{ member_id: 'inactive', service_id: 's2', attendance_status: status }],
    })('a');
    const inactive = attended.find((summary) => summary.memberId === 'inactive');
    assert.equal(inactive.consecutiveAbsentWeeks, 0);
    assert.equal(inactive.needsFollowUp, false);
    assert.equal(members[0].member_status, 'inactive');
  }
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

test('home-only inactivity viewer counts foreign physical participation without reading a foreign roster', async () => {
  const members = [member('home'), member('foreign-person', { church_branch_id: 'b' })];
  const api = loader(members, {
    branchIds: ['a'],
    extraServices: [{ id: 'away', church_branch_id: 'b', service_date: '2026-10-20', status: 'completed' }],
    attendance: [
      { member_id:'home', service_id:'away', attendance_status:'present' },
      { member_id:'foreign-person', service_id:'away', attendance_status:'present' },
    ],
  });
  const results = await api('a');
  assert.equal(results.length, 1);
  assert.equal(results[0].memberId, 'home');
  assert.equal(results[0].consecutiveAbsentWeeks, 0);
  assert.equal(results[0].recentEligibleWeeks, 3);
  assert.equal(results[0].recentAttendedWeeks, 1);
});

test('server loads home-branch excuses so missing physical attendance cannot flag an excused week', async () => {
  const result = await loader([{ id: 'home', first_name: 'Home', last_name: 'Member', church_branch_id: 'a', created_at: '2026-01-05T00:00:00Z', member_status: 'active', is_archived: false }], { attendance: [{ member_id: 'home', service_id: 's1', attendance_status: 'excused' }] })('a');
  assert.equal(result[0].consecutiveAbsentWeeks, 2);
  assert.equal(result[0].recentEligibleWeeks, 2);
  assert.equal(result[0].lastAttendedDate, null);
});
