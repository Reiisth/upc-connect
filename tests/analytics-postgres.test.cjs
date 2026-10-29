const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const enabled = Boolean(process.env.UPC_ANALYTICS_TEST_PG_PORT);
test('analytics RPC against disposable PostgreSQL', { skip: !enabled }, async (t) => {
  const database = `upc_analytics_test_${randomUUID().replaceAll('-', '')}`;
  const a = '00000000-0000-0000-0000-000000000001', b = '00000000-0000-0000-0000-000000000002';
  function sql(source, { db = database, fail = false } = {}) {
    const result = spawnSync(process.env.UPC_ANALYTICS_PSQL || 'psql', [
      '-X', '-w', '-qAt', '-h', process.env.UPC_ANALYTICS_TEST_PG_HOST || '127.0.0.1', '-p', process.env.UPC_ANALYTICS_TEST_PG_PORT,
      '-U', process.env.UPC_ANALYTICS_TEST_PG_USER || 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose',
    ], { input: source, encoding: 'utf8' });
    if (result.error) throw result.error;
    if (fail) { assert.notEqual(result.status, 0); return result.stderr; }
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  }
  const report = (ids = [a], from = '2026-10-01', to = '2026-10-25', grouping = 'week') => JSON.parse(sql(
    `SELECT get_reports_analytics(ARRAY[${ids.map((id) => `'${id}'::uuid`).join(',')}]::uuid[], '${from}', '${to}', '${grouping}', '2026-10-29');`,
  ));
  const overall = (rows) => rows.find((row) => row.branchId === null);
  sql(`CREATE DATABASE ${database};`, { db: 'postgres' });
  try {
    sql(readFileSync(path.join(__dirname, 'fixtures/analytics.sql'), 'utf8'));
    sql(readFileSync(path.join(__dirname, '../supabase/migrations/20261029090000_add_reports_analytics.sql'), 'utf8'));
    await t.test('physical attendance deduplicates member/service, includes late, excludes excused and unfinished services', () => {
      const data = report();
      assert.deepEqual(overall(data.attendance), { branchId: null, completedServices: 4, physicalCheckIns: 3, uniqueMembers: 2, averagePerService: 0.75 });
      assert.equal(overall(data.attendanceByType.filter((row) => row.serviceType === 'prayer_meeting')).physicalCheckIns, 1);
      assert.equal(data.weeklyAttendance.filter((row) => row.branchId === null).length, 3);
      assert.equal(overall(data.weeklyAttendance.filter((row) => row.weekStart === '2026-10-05')).uniqueMembers, 1);
      assert.ok(data.weeklyAttendance.every((row) => row.participationRatePercent === null && row.eligibleMemberCount === null));
    });
    await t.test('branch-scoped totals and cross-branch unique-member rollups do not double count', () => {
      const data = report([a, b]);
      assert.equal(overall(data.attendance).completedServices, 7);
      assert.equal(overall(data.attendance).physicalCheckIns, 4);
      assert.equal(overall(data.attendance).uniqueMembers, 2);
      assert.equal(data.attendance.filter((row) => row.branchId).reduce((sum, row) => sum + row.uniqueMembers, 0), 3);
      assert.equal(overall(data.contributions).totalAmount, '0.35');
    });
    await t.test('membership distinguishes archived/stored status, record creation and first attendance', () => {
      const data = report();
      assert.deepEqual(overall(data.membership), { branchId: null, nonArchivedMembers: 3, storedActiveMembers: 2, archivedMembers: 1,
        recordsAddedInRange: 3, firstAttendancesInRange: 1, missingFirstAttendanceDate: 1 });
      const day = report([a], '2026-10-05', '2026-10-05', 'day');
      assert.equal(overall(day.membership).recordsAddedInRange, 1, 'UTC 16:00 is the next Manila calendar date');
      assert.equal(overall(day.membershipTrend).periodStart, '2026-10-05');
    });
    await t.test('latest follow-up supersedes old needs-follow-up even outside the selected range', () => {
      const data = report([a], '2026-10-01', '2026-10-12');
      assert.equal(overall(data.followUps).total, 2);
      assert.equal(overall(data.followUpLatest).latestMembers, 3);
      assert.equal(overall(data.followUpLatest).latestNeedsFollowUpMembers, 1);
      assert.equal(overall(data.followUpLatest).overdueLatestNextFollowUps, 2);
      assert.equal(overall(data.followUpLatestByOutcome.filter((row) => row.outcome === 'resolved')).count, 1);
    });
    await t.test('money totals include anonymous contributions and remain decimal strings', () => {
      const money = overall(report().contributions);
      assert.equal(money.count, 2);
      assert.equal(money.totalAmount, '0.30');
      assert.equal(money.averageAmount, '0.15');
    });
    await t.test('water and Holy Ghost dates are separated; undated records are reported separately', () => {
      assert.deepEqual(overall(report().baptisms), { branchId: null, total: 2, water: 1, holyGhost: 1, undatedRecords: 1 });
      assert.equal(report().baptismTrend.filter((row) => row.branchId === null).reduce((sum, row) => sum + row.total, 0), 2);
    });
    await t.test('daily/weekly/monthly buckets and finished/partial weeks preserve calendar meaning', () => {
      assert.equal(overall(report([a], '2026-10-01', '2026-10-25', 'month').attendanceTrend).periodStart, '2026-10-01');
      const data = report([a], '2026-10-07', '2026-10-31');
      assert.ok(data.weeklyAttendance.some((row) => row.weekStart === '2026-10-05' && row.isPartialRange));
      assert.ok(data.weeklyAttendance.some((row) => row.weekStart === '2026-10-26' && !row.isFinished));
    });
    await t.test('no authorized branches or no ranged activity yields safe zeros and empty series', () => {
      const none = report([]);
      assert.equal(overall(none.membership).nonArchivedMembers, 0);
      assert.equal(overall(none.attendance).averagePerService, null);
      assert.equal(overall(none.contributions).totalAmount, '0.00');
      assert.equal(overall(none.contributions).averageAmount, null);
      assert.deepEqual(none.attendanceTrend, []);
      const old = report([a], '2000-01-01', '2000-01-02');
      assert.equal(overall(old.followUps).total, 0);
      assert.equal(overall(old.baptisms).total, 0);
    });
    await t.test('latest-follow-up ties are deterministic; a later resolved record clears the older overdue next date', () => {
      sql(`INSERT INTO member_follow_ups(id,church_branch_id,member_id,follow_up_date,method,outcome,next_follow_up_date,created_at) VALUES
        ('00000000-0000-0000-0000-000000009902','${a}','00000000-0000-0000-0000-000000000011','2026-10-19','call','resolved',NULL,'2026-10-19T12:00:00Z'),
        ('00000000-0000-0000-0000-000000009901','${a}','00000000-0000-0000-0000-000000000011','2026-10-19','call','needs_follow_up','2026-10-20','2026-10-19T12:00:00Z');`);
      assert.equal(overall(report().followUpLatest).overdueLatestNextFollowUps, 1);
      assert.equal(overall(report().followUpLatestByOutcome.filter((row) => row.outcome === 'resolved')).count, 2);
    });
    await t.test('money averages round exactly to a cent without binary rounding artifacts', () => {
      sql(`INSERT INTO financial_contributions(church_branch_id,contribution_date,amount,contribution_type,payment_method) VALUES
        ('${a}','2026-10-27',0.10,'other','cash'), ('${a}','2026-10-27',0.21,'other','cash');`);
      const money = overall(report([a], '2026-10-27', '2026-10-27').contributions);
      assert.equal(money.totalAmount, '0.31');
      assert.equal(money.averageAmount, '0.16');
    });
    await t.test('direct browser RPC roles cannot supply arbitrary branch arrays', () => {
      for (const role of ['anon', 'authenticated']) assert.match(sql(`SET ROLE ${role}; SELECT get_reports_analytics(ARRAY['${a}'::uuid], '2026-10-01','2026-10-25','day','2026-10-29');`, { fail: true }), /42501/);
      assert.equal(JSON.parse(sql(`SET ROLE service_role; SELECT get_reports_analytics(ARRAY['${a}'::uuid], '2026-10-01','2026-10-25','day','2026-10-29');`)).version, 1);
      assert.match(sql(`SELECT get_reports_analytics(ARRAY['${a}'::uuid], '2026-10-25','2026-10-01','day','2026-10-29');`, { fail: true }), /Invalid reporting/);
      assert.match(sql(`SELECT get_reports_analytics(ARRAY['${a}'::uuid], '2026-10-01','2026-10-25','invalid','2026-10-29');`, { fail: true }), /Invalid reporting/);
    });
    await t.test('large money sums exceed JavaScript safe-cent limits without losing a cent', () => {
      sql(`INSERT INTO financial_contributions(church_branch_id,contribution_date,amount,contribution_type,payment_method)
        SELECT '${b}', '2026-10-12', 9999999999.99, 'other','cash' FROM generate_series(1,10000);
        INSERT INTO financial_contributions(church_branch_id,contribution_date,amount,contribution_type,payment_method)
        VALUES ('${b}','2026-10-12',0.01,'other','cash');`);
      assert.equal(overall(report([b]).contributions).totalAmount, '99999999999900.06');
    });
  } finally {
    assert.match(database, /^upc_analytics_test_[a-f0-9]+$/);
    sql(`DROP DATABASE ${database};`, { db: 'postgres' });
  }
});
