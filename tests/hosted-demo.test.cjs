/* eslint-disable @typescript-eslint/no-require-imports -- Node's existing CJS test runner. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ready = Promise.all([import('../scripts/hosted-demo-data.mjs'), import('../scripts/hosted-demo-env.mjs')]);
test('hosted demo refuses local, other projects, URL tricks and missing opt-in', async () => {
  const [, { assertTarget, TARGET }] = await ready;
  assert.doesNotThrow(() => assertTarget(TARGET, 'true'));
  for (const url of ['http://127.0.0.1:54321', `${TARGET}/`, `${TARGET}.evil.test`, `https://other.supabase.co`, `${TARGET}/auth/v1`]) assert.throws(() => assertTarget(url, 'true'));
  for (const flag of [undefined, 'false', 'TRUE']) assert.throws(() => assertTarget(TARGET, flag));
});
test('repeatable fixtures have exactly the requested branches and coherent historical attendance', async () => {
  const [{ generateDemo }] = await ready;
  const departments = [1, 2, 3, 4].map(id => ({ id: String(id) }));
  const data = generateDemo('2026-11-08', departments);
  assert.deepEqual(data, generateDemo('2026-11-08', departments));
  assert.deepEqual(data.branches.map(b => b.name), ['Batangas City', 'Bauan']);
  assert.equal(data.members.length, 180);
  const members = new Map(data.members.map(m => [m.id, m]));
  const services = new Map(data.services.map(s => [s.id, s]));
  const pairs = new Set(); const statuses = new Set();
  for (const a of data.attendance) {
    const m = members.get(a.member_id); const s = services.get(a.service_id);
    assert.equal(s.status, 'completed'); assert.ok(s.service_date >= m.created_at.slice(0, 10));
    assert.ok(!m.archived_at || s.service_date < m.archived_at.slice(0, 10));
    const pair = `${a.service_id}/${a.member_id}`; assert.ok(!pairs.has(pair)); pairs.add(pair); statuses.add(a.attendance_status);
  }
  assert.deepEqual([...statuses].sort(), ['absent', 'excused', 'present']);
  assert.equal(data.services.filter(s => s.status === 'ongoing').length, 2);
  assert.equal(new Set(data.baptisms.map(b => `${b.member_id}/${b.baptism_type}`)).size, data.baptisms.length);
  assert.ok(data.contributions.every(c => /^\d+\.\d{2}$/.test(c.amount)));
  assert.deepEqual([...new Set(data.contributions.map(c => c.contributor_type))].sort(), ['anonymous', 'member', 'visitor']);
  for (const c of data.contributions) {
    assert.equal(Boolean(c.member_id), c.contributor_type === 'member');
    assert.equal(Boolean(c.visitor_name), c.contributor_type === 'visitor');
  }
});
test('demo inactivity scenarios use the real weekly calculator and Excused does not add absence', async () => {
  const [{ generateDemo, fixtureId }] = await ready;
  const { calculateWeeklyInactivity } = require('../lib/inactivity/calculate.ts');
  const data = generateDemo('2026-11-08', [1, 2, 3, 4].map(id => ({ id: String(id) })));
  const result = calculateWeeklyInactivity({ today: data.anchor, members: data.members.map(m => ({ id: m.id, branchId: m.church_branch_id, registrationDate: m.created_at.slice(0, 10) })), services: data.services.map(s => ({ id: s.id, branchId: s.church_branch_id, serviceDate: s.service_date, status: s.status })), attendance: data.attendance.map(a => ({ memberId: a.member_id, serviceId: a.service_id, status: a.attendance_status })), thresholds: new Map(data.branches.map(b => [b.id, 3])) });
  const get = n => result.find(r => r.memberId === fixtureId(1, n));
  for (const offset of [0, 90]) {
    assert.ok(get(offset + 5).needsFollowUp); assert.ok(get(offset + 6).needsFollowUp);
    assert.equal(get(offset + 7).consecutiveAbsentWeeks, 2);
    assert.equal(get(offset + 9).consecutiveAbsentWeeks, 1);
    assert.equal(get(offset + 10).consecutiveAbsentWeeks, 0);
    assert.equal(get(offset + 90).recentEligibleWeeks, 0);
  }
});
test('180 curated Filipino full names are deterministic, unique, gender-consistent and use full middle surnames', async () => {
  const [{ generateDemo, fixtureId }] = await ready;
  const { MALE_FIRST_NAMES, FEMALE_FIRST_NAMES, FILIPINO_SURNAMES, demoMemberName } = await import('../scripts/hosted-demo-names.mjs');
  const { nameMapping, EXPECTED_COUNTS } = await import('../scripts/rename-hosted-demo-members.mjs');
  const data = generateDemo('2026-11-08', [1, 2, 3, 4].map(id => ({ id: String(id) })));
  assert.equal(data.members.length, 180);
  const fullNames = new Set();
  for (const [i, member] of data.members.entries()) {
    for (const field of ['first_name', 'middle_name', 'last_name']) assert.ok(member[field]?.trim().length > 1);
    assert.ok(!/^[A-Za-z]\.?$/.test(member.middle_name));
    assert.ok(FILIPINO_SURNAMES.includes(member.middle_name));
    assert.ok(FILIPINO_SURNAMES.includes(member.last_name));
    assert.notEqual(member.middle_name, member.last_name);
    assert.ok((member.gender === 'male' ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES).includes(member.first_name));
    assert.deepEqual(demoMemberName(i, member.gender), demoMemberName(i, member.gender));
    fullNames.add([member.first_name, member.middle_name, member.last_name].join(' '));
    assert.equal(member.id, fixtureId(1, i + 1));
    assert.equal(member.department_id, String(i % 4 + 1));
  }
  assert.equal(fullNames.size, 180);
  assert.equal(FILIPINO_SURNAMES.length, 64);
  assert.ok(new Set(data.members.map(m => m.last_name)).size >= 60);
  assert.ok(data.members.some(m => !m.first_name.includes(' ')) && data.members.some(m => m.first_name.includes(' ')));
  assert.deepEqual(nameMapping(data.members), data.members.map(({ id, first_name, middle_name, last_name }) => ({ id, first_name, middle_name, last_name })));
  assert.throws(() => nameMapping(data.members.slice(1)));
  assert.throws(() => nameMapping(data.members.map((m, i) => i ? m : { ...m, last_name: 'Unexpected edit' })));
  assert.throws(() => demoMemberName(0, 'unknown'));
  assert.equal(data.qr.homeMember, fixtureId(1, 1));
  assert.equal(data.qr.visitingMember, fixtureId(1, 91));
  assert.equal(data.qr.inactiveMember, fixtureId(1, 3));
  assert.equal(data.qr.service, fixtureId(2, 175));
  for (const [table, count] of Object.entries(data.counts)) assert.equal(count, EXPECTED_COUNTS[table]);
  // No household tables exist: names do not invent or change household/account links.
  assert.equal(data.members[0].first_name, 'Jose Miguel');
});
