/* eslint-disable @typescript-eslint/no-require-imports -- Node regression suite. */
const test = require('node:test');
const React=require('react');
const assert = require('node:assert/strict');
const { renderToStaticMarkup } = require('react-dom/server');
const { historicalHarness } = require('./helpers/historical-records-harness.cjs');

const route = 'app/portal/baptisms/actions.ts';
const redirected = /redirect:\/portal\/baptisms$/;
const denied = /redirect:\/access-denied/;
const states = { transferred: { church_branch_id: 'b' }, archived: { is_archived: true }, inactive: { member_status: 'inactive' } };

for (const baptism_type of ['water', 'holy_ghost']) {
  test(`new ${baptism_type} baptism accepts a currently active same-branch member with the matching custom-role permission`, async () => {
    const h = historicalHarness({ permissions: [`baptisms.${baptism_type}.create`] });
    await assert.rejects(h.load(route).createBaptism(null, h.baptismForm({ member_id: 'current', baptism_type })), redirected);
    assert.equal(h.db.baptism_records.at(-1).recorded_by, 'actor');
  });
  test(`historical ${baptism_type} correction uses its own type update permission after a transfer`, async () => {
    const h = historicalHarness({ permissions: [`baptisms.${baptism_type}.update`] }); h.db.members[0].church_branch_id = 'b';
    const id = baptism_type === 'water' ? 'water' : 'holy-ghost';
    await assert.rejects(h.load(route).updateBaptism(id, null, h.baptismForm({ baptism_type })), redirected);
    assert.equal(h.db.baptism_records.find((row) => row.id === id).notes, 'Corrected');
    assert.equal(h.events.some((event) => event.table === 'members'), false);
  });
}

test('new baptisms reject transferred, archived, inactive and missing members', async () => {
  for (const member_id of ['foreign', 'archived', 'inactive', 'missing']) {
    const h = historicalHarness();
    assert.ok((await h.load(route).createBaptism(null, h.baptismForm({ member_id }))).error);
    assert.equal(h.writes.length, 0);
  }
  const transfer = historicalHarness(); transfer.db.members[0].church_branch_id = 'b';
  assert.match((await transfer.load(route).createBaptism(null, transfer.baptismForm())).error, /does not belong/);
});

test('new baptism requires an authorized active selected branch', async () => {
  for (const options of [{ branchIds: ['b'] }, { branchActive: false }]) {
    const h = historicalHarness(options);
    assert.ok((await h.load(route).createBaptism(null, h.baptismForm({ member_id: 'current' }))).error);
    assert.equal(h.writes.length, 0);
  }
});

for (const [state, change] of Object.entries(states)) {
  test(`${state} member's baptisms retain recorded-branch visibility, counts and nullable dates`, async () => {
    const h = historicalHarness(); const branches = await h.branches(); const api = h.load('app/portal/baptisms/data.ts');
    const before = await api.loadBaptismRecords(h.admin, branches);
    Object.assign(h.db.members[0], change);
    const after = await api.loadBaptismRecords(h.admin, branches);
    assert.deepEqual(after.map((row) => [row.id, row.churchBranchId, row.baptismDate]), before.map((row) => [row.id, row.churchBranchId, row.baptismDate]));
    assert.equal(after.length, 2); assert.ok(after.every((row) => row.memberName === 'Historical Member'));
    assert.equal(h.load('app/portal/baptisms/types.ts').getBaptismSummary(after).count, 2);
  });
  test(`existing baptism metadata can be corrected after member becomes ${state}`, async () => {
    const h = historicalHarness(); Object.assign(h.db.members[0], change);
    await assert.rejects(h.load(route).updateBaptism('water', null, h.baptismForm()), redirected);
    assert.equal(h.db.baptism_records[0].location, 'River'); assert.equal(h.db.baptism_records[0].recorded_by, 'original');
    assert.equal(h.db.baptism_records[0].member_id, 'historical'); assert.equal(h.db.baptism_records[0].church_branch_id, 'a');
    assert.ok(h.events.some((event) => event.revalidate === '/portal/reports'));
  });
}

test('historical baptism branch controls correction access, even if the member now belongs to an actor branch', async () => {
  const h = historicalHarness({ branchIds: ['b'] }); h.db.members[0].church_branch_id = 'b';
  assert.match((await h.load(route).updateBaptism('water', null, h.baptismForm())).error, /assigned/);
  assert.equal(h.writes.length, 0);
});

test('type-specific permissions remain distinct for creation and historical corrections', async () => {
  const h = historicalHarness({ permissions: ['baptisms.water.create', 'baptisms.water.update'] });
  assert.match((await h.load(route).createBaptism(null, h.baptismForm({ member_id: 'current', baptism_type: 'holy_ghost' }))).error, /permission/);
  assert.match((await h.load(route).updateBaptism('holy-ghost', null, h.baptismForm({ baptism_type: 'holy_ghost' }))).error, /permission/);
  assert.equal(h.writes.length, 0);
  const view = historicalHarness({ permissions: ['baptisms.view'] });
  await assert.rejects(view.load(route).updateBaptism('water', null, view.baptismForm()), denied);
  const global = historicalHarness({ isSystemAdmin: true, permissions: [] });
  await assert.rejects(global.load(route).createBaptism(null, global.baptismForm()), denied);
});

test('baptism member, branch and type cannot be reassigned, including by a fully scoped administrator', async () => {
  for (const change of [{ member_id: 'replacement' }, { church_branch_id: 'b' }, { baptism_type: 'holy_ghost' }]) {
    const h = historicalHarness({ isSystemAdmin: true });
    assert.match((await h.load(route).updateBaptism('water', null, h.baptismForm(change))).error, /cannot be changed/);
    assert.equal(h.writes.length, 0);
  }
});

test('unknown baptism dates stay NULL and corrections may add or clear dates without inventing one', async () => {
  const h = historicalHarness(); const api = h.load(route);
  await assert.rejects(api.createBaptism(null, h.baptismForm({ member_id: 'current', baptism_date: '' })), redirected);
  assert.equal(h.db.baptism_records.at(-1).baptism_date, null);
  await assert.rejects(api.updateBaptism('holy-ghost', null, h.baptismForm({ baptism_type: 'holy_ghost', baptism_date: '2000-02-29' })), redirected);
  assert.equal(h.db.baptism_records[1].baptism_date, '2000-02-29');
  await assert.rejects(api.updateBaptism('holy-ghost', null, h.baptismForm({ baptism_type: 'holy_ghost', baptism_date: '' })), redirected);
  assert.equal(h.db.baptism_records[1].baptism_date, null);
  assert.ok((await api.updateBaptism('water', null, h.baptismForm({ baptism_date: '2000-02-30' }))).error);
});

test('unique member/type guard and database unique-race handling remain enforced for creation', async () => {
  for(const baptism_type of ['water','holy_ghost']){
    const h = historicalHarness();
    assert.match((await h.load(route).createBaptism(null, h.baptismForm({baptism_type}))).error, /already has/);
    assert.equal(h.writes.length, 0);
  }
  const race = historicalHarness({ uniqueRace: true });
  assert.match((await race.load(route).createBaptism(null, race.baptismForm({ member_id: 'current' }))).error, /already has/);
});

test('edit page fixes historical member/type/branch and resolves only the recorded identity after scope/type checks', async () => {
  const h = historicalHarness({ permissions: ['baptisms.water.update'] }); Object.assign(h.db.members[0], { church_branch_id: 'b', is_archived: true });
  const html = renderToStaticMarkup(await h.content('app/portal/baptisms/[baptismId]/edit/page.tsx', { baptismId: 'water' }));
  assert.ok(html.includes('Historical Member'));
  for (const [field, value] of [['church_branch_id', 'a'], ['member_id', 'historical'], ['baptism_type', 'water']]) {
    assert.ok(html.includes(`type="hidden" name="${field}" value="${value}"`));
  }
  assert.ok(!html.includes('Foreign Private') && !html.includes('Other Church'));
  for (const options of [{ permissions: ['baptisms.holy_ghost.update'] }, { branchIds: ['b'] }]) {
    const denied = historicalHarness(options);
    await assert.rejects(denied.content('app/portal/baptisms/[baptismId]/edit/page.tsx', { baptismId: 'water' }), /not-found/);
    assert.equal(denied.events.some((event) => event.table === 'members'), false);
  }
});

test('new-record options exclude archived/inactive members, while list renders historical records for view-only custom roles', async () => {
  const h = historicalHarness({ permissions: ['baptisms.view'] }); Object.assign(h.db.members[0], { church_branch_id: 'b', is_archived: true });
  const access = await h.load('app/portal/baptisms/access.ts').requireBaptismPermission('baptisms.view');
  const options = await h.load('app/portal/baptisms/data.ts').loadBaptismOptions(access, h.admin);
  assert.deepEqual(Array.from(options.members, (member) => member.id), ['current', 'replacement']);
  const html = renderToStaticMarkup(await h.content('app/portal/baptisms/page.tsx'));
  assert.ok(html.includes('Historical Member') && html.includes('Date range'));
  const branches=await h.load('lib/historical-records.ts').getHistoricalRecordBranches(access,h.admin);
  const records=await h.load('app/portal/baptisms/data.ts').loadBaptismRecords(h.admin,branches);
  const Table=h.load('app/portal/baptisms/BaptismsTable.tsx').default;
  const unfiltered=renderToStaticMarkup(React.createElement(Table,{records,branches,canUpdateWater:false,canUpdateHolyGhost:false}));
  assert.ok(unfiltered.includes('Date unknown'),'undated historical records remain available outside dated filtering');
  assert.ok(!html.includes('New Baptism Record') && !html.includes('>Edit<') && !html.includes('Foreign Private'));
});

test('inactive historical branch remains correctable without reopening current baptism creation', async () => {
  const h = historicalHarness({ branchActive: false }); h.db.members[0].is_archived = true;
  await assert.rejects(h.load(route).updateBaptism('water', null, h.baptismForm()), redirected);
  assert.ok((await h.load(route).createBaptism(null, h.baptismForm({ member_id: 'current' }))).error);
});

test('concurrent record identity changes fail closed instead of acknowledging a lost correction', async () => {
  const h = historicalHarness({ beforeWrite: (db, table) => { if (table === 'baptism_records') db.baptism_records[0].member_id = 'replacement'; } });
  assert.match((await h.load(route).updateBaptism('water', null, h.baptismForm())).error, /changed while/);
  assert.equal(h.db.baptism_records[0].notes, 'Original');
});

test('archived/anonymous accounts and inactive custom roles are blocked before historical record access', async () => {
  for (const options of [{ archivedAccount: true }, { anonymous: true }, { inactiveRole: true }]) {
    const h = historicalHarness(options);
    await assert.rejects(h.load(route).updateBaptism('water', null, h.baptismForm()), /redirect:\/(access-denied|login)/);
    await assert.rejects(h.load('app/portal/contributions/actions.ts').updateContribution('contribution', null, h.contributionForm()), /redirect:\/(access-denied|login)/);
    assert.equal(h.events.some((event) => ['baptism_records', 'financial_contributions'].includes(event.table)), false);
    assert.equal(h.writes.length, 0);
  }
});

test('real staff transfer/archive leaves all four historical record domains and service-based attendance intact', async () => {
  const h = historicalHarness({ branchIds: ['a', 'b'], permissions: ['members.view', 'members.update', 'members.archive'] });
  const history = () => JSON.stringify([h.db.financial_contributions, h.db.baptism_records, h.db.attendance_records, h.db.member_follow_ups]);
  const before = history(); const api = h.load('app/portal/members/actions.ts');
  const form = new FormData();
  for (const [key, value] of Object.entries({ first_name: 'Historical', last_name: 'Member', church_branch_id: 'b', member_status: 'inactive' })) form.set(key, value);
  await assert.rejects(api.updateMember('historical', form), /redirect:\/portal\/members\/historical$/);
  await api.archiveMember('historical');
  assert.equal(history(), before);
  const rows = await h.load('app/portal/attendance/data.ts').loadAttendanceRows(h.admin, { id: 'service', churchBranchId: 'a' });
  assert.ok(rows.some((row) => row.member.id === 'historical' && row.attendance));
  assert.equal(h.db.profiles[0].archived_at, null);
});
