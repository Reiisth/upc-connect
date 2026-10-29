const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');
const { calculateWeeklyInactivity } = require('../lib/inactivity/calculate.ts');
const { resolveAnalyticsDateRange, analyticsToday, validateAnalyticsGrouping } = loadTypeScript('lib/analytics/date-range.ts');
const { assembleAnalytics, emptyAnalyticsAggregates, summarizeInactivity } = loadTypeScript('lib/analytics/assemble.ts');
const today = '2026-10-29';

test('reporting presets and custom ranges use inclusive Manila dates', () => {
  const first = (preset) => resolveAnalyticsDateRange({ preset }, today).from;
  assert.equal(first('last_7_days'), '2026-10-23');
  assert.equal(first('last_30_days'), '2026-09-30');
  assert.equal(first('last_90_days'), '2026-08-01');
  assert.equal(first('year_to_date'), '2026-01-01');
  assert.equal(analyticsToday(new Date('2026-10-28T15:59:59Z')), '2026-10-28');
  assert.equal(analyticsToday(new Date('2026-10-28T16:00:00Z')), today);
  const range = resolveAnalyticsDateRange({ preset: 'custom', from: '2024-02-29', to: '2024-03-01' }, today);
  assert.equal(range.from, '2024-02-29');
  assert.equal(range.timeZone, 'Asia/Manila');
  for (const [from, to] of [['2026-02-30', today], [today, '2026-01-01'], ['0000-01-01', today]]) {
    assert.throws(() => resolveAnalyticsDateRange({ preset: 'custom', from, to }, today), /valid reporting/);
  }
  assert.throws(() => validateAnalyticsGrouping('invalid'), /grouping/);
});

function branch(id, inactivityThresholdWeeks = 3, isActive = true) {
  return { id, name: id, code: null, isActive, inactivityThresholdWeeks };
}
function assemble(aggregates = emptyAnalyticsAggregates(), inactivity = [], branches = []) {
  return assembleAnalytics({ aggregates, inactivity, branches, range: resolveAnalyticsDateRange(undefined, today), grouping: 'week', asOfDate: today });
}
test('empty analytics produces zero counts, null denominators and empty series', () => {
  const result = assemble();
  assert.equal(result.membership.nonArchivedMembers, 0);
  assert.equal(result.attendance.averagePerService, null);
  assert.equal(result.inactivity.inactivePercent, null);
  assert.equal(result.inactivity.averageConsecutiveAbsentWeeks, null);
  assert.equal(result.contributions.totalAmount, '0.00');
  assert.equal(result.contributions.averageAmount, null);
  assert.equal(result.baptisms.total, 0);
  assert.equal(result.followUps.total, 0);
  assert.equal(result.branches.length, 0);
  assert.equal(result.attendance.weekly.length, 0);
});

test('inactivity summaries use existing calculation rules, own branch thresholds and unknown population', () => {
  const summaries = calculateWeeklyInactivity({
    members: [{ id: 'one', branchId: 'a', eligibilityDate: '2026-01-01' }, { id: 'two', branchId: 'b', eligibilityDate: '2026-01-01' }, { id: 'unknown', branchId: 'a', eligibilityDate: null }],
    services: ['2026-10-05', '2026-10-12', '2026-10-19'].flatMap((serviceDate, i) => ['a', 'b'].map((branchId) => ({ id: branchId + i, branchId, serviceDate, status: 'completed' }))),
    attendance: [], thresholds: new Map([['a', 3], ['b', 4]]), today,
  });
  const result = assemble(undefined, summaries, [branch('a'), branch('b', 4), branch('archivedBranch', 3, false)]);
  assert.equal(result.inactivity.monitoredMembers, 3);
  assert.equal(result.inactivity.derivedInactiveMembers, 1);
  assert.equal(result.inactivity.derivedActiveMembers, 1);
  assert.equal(result.inactivity.unknownMembers, 1);
  assert.equal(result.inactivity.inactivePercent, 50);
  assert.equal(result.inactivity.averageConsecutiveAbsentWeeks, 3);
  assert.equal(result.inactivity.oneWeekAwayMembers, 1);
  assert.equal(result.branches[0].inactivity.derivedInactiveMembers, 1);
  assert.equal(result.branches[1].inactivity.derivedInactiveMembers, 0);
  assert.equal(result.branches[2].inactivity, null);
  assert.equal(summarizeInactivity([summaries[2]]).inactivePercent, null);
});

test('assembly preserves aggregate decimal strings, global distinct counts and separate stored membership values', () => {
  const data = emptyAnalyticsAggregates();
  data.contributions.push({ branchId: null, count: 10001, totalAmount: '99999999999900.01', averageAmount: '9999000099.98' });
  data.attendance.push({ branchId: null, completedServices: 2, physicalCheckIns: 2, uniqueMembers: 1, averagePerService: 1 });
  data.membership.push({ branchId: null, nonArchivedMembers: 4, storedActiveMembers: 1, archivedMembers: 2, recordsAddedInRange: 2, firstAttendancesInRange: 1, missingFirstAttendanceDate: 2 });
  data.weeklyAttendance.push(...[false, true].map((partial, i) => ({ branchId: null, weekStart: `2026-10-${i ? '12' : '05'}`, isFinished: true, isPartialRange: partial,
    completedServices: 1, physicalCheckIns: 1, uniqueMembers: 1, averagePerService: 1, eligibleMemberCount: null, participationRatePercent: null })));
  const result = assemble(data);
  assert.equal(result.contributions.totalAmount, '99999999999900.01');
  assert.equal(result.attendance.uniqueMembers, 1);
  assert.equal(result.attendance.eligibleCompletedServiceWeeks, 1);
  assert.equal(result.membership.storedActiveMembers, 1);
  assert.equal(result.inactivity.derivedActiveMembers, 0);
  assert.ok(!Object.hasOwn(result.attendance, 'branchId'));
});

function serverHarness({ permissions = ['reports.view'], branchIds = ['a', 'b'], rpcError = false, inactiveBranch = false, memberCount = 3 } = {}) {
  const calls = [], reads = [];
  const tables = {
    church_branches: [
      { id: 'a', name: 'Main', code: null, is_active: !inactiveBranch, inactivity_threshold_weeks: 3 },
      { id: 'b', name: 'Second', code: null, is_active: true, inactivity_threshold_weeks: 4 },
      { id: 'outside', name: 'Not permitted', code: null, is_active: true, inactivity_threshold_weeks: 3 },
    ],
    members: [
      { id: 'one', church_branch_id: 'a', first_attendance_date: '2026-01-01', member_status: 'inactive', is_archived: false },
      { id: 'two', church_branch_id: 'b', first_attendance_date: '2026-01-01', member_status: 'active', is_archived: false },
      { id: 'unknown', church_branch_id: 'a', first_attendance_date: null, member_status: 'inactive', is_archived: false },
      { id: 'archived', church_branch_id: 'a', first_attendance_date: '2026-01-01', member_status: 'active', is_archived: true },
      { id: 'foreign', church_branch_id: 'outside', first_attendance_date: '2026-01-01', member_status: 'active', is_archived: false },
    ],
    services: ['2026-10-05', '2026-10-12', '2026-10-19'].flatMap((service_date, i) => ['a','b','outside'].map((church_branch_id) => ({ id: church_branch_id + i, church_branch_id, service_date, status: 'completed' }))),
    attendance_records: [],
  };
  if (memberCount > 3) for (let i = 0; i < memberCount - 3; i++) tables.members.push({ ...tables.members[0], id: `extra${String(i).padStart(4, '0')}` });
  class Query {
    constructor(table) { this.table = table; this.rows = [...tables[table]]; }
    value(row, key) { return key.split('.').reduce((value, part) => value?.[part], row); }
    select() { return this; }
    eq(key, value) { this.rows = this.rows.filter((row) => this.value(row, key) === value); return this; }
    in(key, values) { this.rows = this.rows.filter((row) => values.includes(this.value(row, key))); return this; }
    gte(key, value) { this.rows = this.rows.filter((row) => this.value(row, key) >= value); return this; }
    lte(key, value) { this.rows = this.rows.filter((row) => this.value(row, key) <= value); return this; }
    order(key) { this.rows.sort((a, b) => String(a[key]).localeCompare(String(b[key]))); return this; }
    range(from, to) { this.rows = this.rows.slice(from, to + 1); return this; }
    then(resolve, reject) { reads.push(this.table); return Promise.resolve({ data: this.rows, error: null }).then(resolve, reject); }
  }
  const admin = {
    from: (table) => { assert.ok(Object.hasOwn(tables, table), `Analytics must not fetch ${table} raw`); return new Query(table); },
    rpc: async (name, args) => { calls.push({ name, args }); return { data: emptyAnalyticsAggregates(), error: rpcError ? { message: 'INTERNAL DATABASE ERROR' } : null }; },
  };
  const api = loadTypeScript('lib/analytics/server.ts', {
    'server-only': {},
    '@/lib/permissions-server': { requirePermission: async (permission) => { assert.equal(permission, 'reports.view'); if (!permissions.includes(permission)) throw new Error('Access denied'); return { user: { id: 'reporter' }, permissions }; } },
    '@/lib/branch-access': { getUserBranchScope: async () => ({ branchIds, isSystemAdmin: false }) },
    '@/lib/supabase/admin': { createAdminClient: () => admin },
    './date-range': { resolveAnalyticsDateRange, validateAnalyticsGrouping, validAnalyticsDate: loadTypeScript('lib/analytics/date-range.ts').validAnalyticsDate, analyticsToday: () => today },
  });
  return { ...api, tables, calls, reads };
}

test('sole server entry requires reports.view, honors selected scope, and does not need operational module permissions', async () => {
  const h = serverHarness();
  const result = await h.getAnalyticsOverview({ branchId: 'a' });
  assert.equal(result.branches.length, 1);
  assert.equal(result.branches[0].branch.id, 'a');
  assert.equal(result.inactivity.derivedInactiveMembers, 1);
  assert.equal(result.inactivity.unknownMembers, 1);
  assert.equal(result.inactivity.monitoredMembers, 2, 'Archived, other-branch members are excluded; stored inactive member remains');
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].name, 'get_reports_analytics');
  assert.deepEqual(Array.from(h.calls[0].args.p_branch_ids), ['a']);
  assert.equal(h.calls[0].args.p_as_of, today);
  assert.ok(!h.reads.includes('financial_contributions'));
  await assert.rejects(h.getAnalyticsOverview({ branchId: 'outside' }), /outside your access/);
  const denied = serverHarness({ permissions: ['inactivity.view', 'follow_ups.view'] });
  await assert.rejects(denied.getAnalyticsOverview(), /Access denied/);
  assert.equal(denied.reads.length, 0);
  assert.equal(denied.calls.length, 0);
});

test('all accessible branches keep differing thresholds and never expand to foreign branches', async () => {
  const h = serverHarness();
  const result = await h.getAnalyticsOverview();
  assert.equal(result.branches.length, 2);
  assert.equal(result.inactivity.derivedInactiveMembers, 1);
  assert.equal(result.inactivity.derivedActiveMembers, 1);
  assert.equal(result.inactivity.oneWeekAwayMembers, 1);
  assert.equal(result.asOfDate, today);
  assert.equal(h.calls[0].args.p_branch_ids.length, 2);
  assert.equal(h.reads.filter((table) => table === 'services').length, 1, 'No per-branch source query loop');
});

test('empty access is safe, inactive branches retain historical aggregates but no current inactivity, failures hide database details', async () => {
  const empty = serverHarness({ branchIds: [] });
  assert.equal((await empty.getAnalyticsOverview()).membership.nonArchivedMembers, 0);
  assert.equal(empty.calls.length, 0);
  const historical = await serverHarness({ inactiveBranch: true }).getAnalyticsOverview({ branchId: 'a' });
  assert.equal(historical.branches[0].inactivity, null);
  const broken = serverHarness({ rpcError: true });
  await assert.rejects(broken.getAnalyticsOverview(), (error) => !error.message.includes('INTERNAL DATABASE ERROR') && /Unable to load reporting/.test(error.message));
});

test('minimal inactivity input streams paginate beyond API row caps and never query per member', async () => {
  const h = serverHarness({ memberCount: 507 });
  const result = await h.getAnalyticsOverview();
  assert.equal(result.inactivity.monitoredMembers, 507);
  assert.equal(h.reads.filter((table) => table === 'members').length, 2);
  assert.equal(h.reads.filter((table) => table === 'services').length, 1);
  assert.equal(h.calls.length, 1);
});
