const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateWeeklyInactivity, manilaDate } = require('../lib/inactivity/calculate.ts');

const service = (id, serviceDate, branchId = 'a', status = 'completed') =>
  ({ id, serviceDate, branchId, status });
const record = (serviceId, status = 'present', memberId = 'm') =>
  ({ serviceId, status, memberId });
function run(services, attendance = [], options = {}) {
  return calculateWeeklyInactivity({
    today: '2026-10-27', thresholds: new Map([['a', 3], ['b', 4]]),
    members: [{ id: 'm', branchId: 'a', eligibilityDate: '2026-01-05' }],
    services, attendance, ...options,
  });
}

test('one of several services yields one present week; method is irrelevant', () => {
  const services = [service('1', '2026-10-19'), service('2', '2026-10-21'), service('3', '2026-10-25')];
  const result = run(services, [{ ...record('2'), method: 'manual' }, { ...record('3'), method: 'qr' }])[0];
  assert.equal(result.consecutiveAbsentWeeks, 0);
  assert.equal(result.recentEligibleWeeks, 1);
  assert.equal(result.recentAttendedWeeks, 1);
  assert.equal(result.recentAttendanceRate, 100);
});

test('missing all three services counts exactly one absent week', () => {
  const result = run([service('1', '2026-10-19'), service('2', '2026-10-21'), service('3', '2026-10-25')])[0];
  assert.equal(result.consecutiveAbsentWeeks, 1);
  assert.equal(result.remainingWeeksBeforeInactive, 2);
});

test('no-service weeks are skipped and present week stops the streak', () => {
  const result = run([service('1', '2026-09-28'), service('2', '2026-10-05'), service('3', '2026-10-19')], [record('1')])[0];
  assert.equal(result.consecutiveAbsentWeeks, 2);
  assert.equal(result.recentEligibleWeeks, 3);
});

test('thresholds and branch calendars independently determine inactivity', () => {
  const services = ['2026-10-05', '2026-10-12', '2026-10-19'].flatMap((date, i) =>
    [service(`a${i}`, date), service(`b${i}`, date, 'b')]);
  const members = [
    { id: 'm', branchId: 'a', eligibilityDate: '2026-01-05' },
    { id: 'n', branchId: 'b', eligibilityDate: '2026-01-05' },
  ];
  const [a, b] = run(services, [], { members });
  assert.equal(a.consecutiveAbsentWeeks, 3);
  assert.equal(a.isInactive, true);
  assert.equal(a.remainingWeeksBeforeInactive, 0);
  assert.equal(b.isInactive, false);
  assert.equal(b.remainingWeeksBeforeInactive, 1);
  const [, changed] = run(services.filter((s) => s.id !== 'b1'), [], { members });
  assert.equal(changed.consecutiveAbsentWeeks, 2);
});

test('threshold four is reached after four consecutive absent eligible weeks', () => {
  const services = ['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19']
    .map((date, index) => service(String(index), date));
  const [result] = run(services, [], { thresholds: new Map([['a', 4]]) });
  assert.equal(result.consecutiveAbsentWeeks, 4);
  assert.equal(result.isInactive, true);
  assert.equal(result.remainingWeeksBeforeInactive, 0);
});

test('current week does not create absence or reset completed-week streak; latest attendance can include it', () => {
  const services = [service('old', '2026-10-19'), service('now', '2026-10-26')];
  assert.equal(run(services)[0].consecutiveAbsentWeeks, 1);
  const result = run(services, [record('now')])[0];
  assert.equal(result.consecutiveAbsentWeeks, 1);
  assert.equal(result.recentEligibleWeeks, 1);
  assert.equal(result.lastAttendedDate, '2026-10-26');
  assert.equal(result.lastAttendedServiceId, 'now');
});

test('late attends, excused does not; corrections immediately change derived status', () => {
  const services = [service('1', '2026-10-05'), service('2', '2026-10-12'), service('3', '2026-10-19')];
  assert.equal(run(services, [record('3', 'excused')])[0].isInactive, true);
  const corrected = run(services, [record('3', 'late')])[0];
  assert.equal(corrected.consecutiveAbsentWeeks, 0);
  assert.equal(corrected.isInactive, false);
});

test('scheduled, ongoing, cancelled, future and other-branch attendance cannot qualify', () => {
  const services = ['scheduled', 'ongoing', 'cancelled'].map((status) => service(status, '2026-10-19', 'a', status));
  services.push(service('future', '2026-11-02'), service('other', '2026-10-19', 'b'));
  const result = run(services, services.map((s) => record(s.id)))[0];
  assert.equal(result.recentEligibleWeeks, 0);
  assert.equal(result.consecutiveAbsentWeeks, 0);
  assert.equal(result.recentAttendanceRate, null);
  assert.equal(result.lastAttendedDate, null);
});

test('weeks before eligibility and partial starting week are excluded', () => {
  const services = [service('before', '2026-10-05'), service('partial', '2026-10-14'), service('full', '2026-10-19')];
  const result = run(services, [record('before'), record('partial')], {
    members: [{ id: 'm', branchId: 'a', eligibilityDate: '2026-10-14' }],
  })[0];
  assert.equal(result.consecutiveAbsentWeeks, 1);
  assert.equal(result.recentEligibleWeeks, 1);
  assert.equal(result.lastAttendedDate, '2026-10-14');
  const monday = run(services, [], { members: [{ id: 'm', branchId: 'a', eligibilityDate: '2026-10-12' }] })[0];
  assert.equal(monday.recentEligibleWeeks, 2);
});

test('missing/invalid eligibility is explicitly unknown; future start has no eligible weeks', () => {
  for (const eligibilityDate of [null, 'invalid', '2026-02-30']) {
    const result = run([service('1', '2026-10-19')], [], {
      members: [{ id: 'm', branchId: 'a', eligibilityDate }],
    })[0];
    assert.equal(result.calculationStatus, 'eligibility_unknown');
    assert.equal(result.isInactive, null);
    assert.equal(result.consecutiveAbsentWeeks, null);
  }
  assert.equal(run([service('1', '2026-10-19')], [], {
    members: [{ id: 'm', branchId: 'a', eligibilityDate: '2026-11-02' }],
  })[0].recentEligibleWeeks, 0);
});

test('recent rate uses last eight eligible weeks; rate never changes inactivity', () => {
  const dates = ['2026-08-24','2026-08-31','2026-09-07','2026-09-14','2026-09-21','2026-09-28','2026-10-05','2026-10-12','2026-10-19'];
  const services = dates.map((date, i) => service(String(i), date));
  const attendance = [record('0'), record('1'), record('2'), record('3')];
  const result = run(services, attendance)[0];
  assert.equal(result.recentEligibleWeeks, 8);
  assert.equal(result.recentAttendedWeeks, 3);
  assert.equal(result.recentAttendanceRate, 37.5);
  assert.equal(result.consecutiveAbsentWeeks, 5);
  assert.equal(result.isInactive, true);
  const shorter = run(services, attendance, { recentWeekLimit: 2 })[0];
  assert.equal(shorter.recentAttendanceRate, 0);
  assert.equal(shorter.consecutiveAbsentWeeks, result.consecutiveAbsentWeeks);
  assert.equal(shorter.isInactive, result.isInactive);
});

test('Manila Monday boundary and Sunday services stay in the correct week', () => {
  assert.equal(manilaDate(new Date('2026-10-25T15:59:59Z')), '2026-10-25');
  assert.equal(manilaDate(new Date('2026-10-25T16:00:00Z')), '2026-10-26');
  const services = [service('sunday', '2026-10-25')];
  assert.equal(run(services, [], { today: '2026-10-25' })[0].recentEligibleWeeks, 0);
  assert.equal(run(services, [], { today: '2026-10-26' })[0].consecutiveAbsentWeeks, 1);
});

test('invalid configuration fails rather than silently producing an activity status', () => {
  assert.throws(() => run([], [], { thresholds: new Map() }), /threshold/);
  assert.throws(() => run([], [], { today: '2026-02-30' }), /reporting date/);
  assert.throws(() => run([], [], { recentWeekLimit: 0 }), /week limit/);
});
