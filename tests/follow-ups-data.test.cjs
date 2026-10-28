const { test } = require('node:test');
const assert = require('node:assert/strict');
const { followUpsHarness, ids, id } = require('./helpers/follow-ups-harness.cjs');

test('list/history joins resolve names in scoped paginated queries, without per-record lookups', async () => {
  const h = followUpsHarness();
  for (let i = 0; i < 505; i++) h.tables.member_follow_ups.push({ ...h.tables.member_follow_ups[0], id: id(1000 + i) });
  h.tables.member_follow_ups.push({ ...h.tables.member_follow_ups[0], id: id(999), church_branch_id: ids.b });
  const rows = await h.data().loadFollowUpRecords(h.access, h.admin);
  assert.equal(rows.length, 506);
  assert.ok(rows.every((row) => row.branchId === ids.a && row.memberName === 'Juan Cruz' && row.performerName === 'Staff Performer'));
  assert.equal(h.reads.length, 2, 'Only two record pages, with joined names');
});

test('performer choices include staff/member overlap and exclude inactive staff metadata or archived profiles', async () => {
  const h = followUpsHarness();
  const people = await h.data().loadFollowUpPerformers(h.admin);
  assert.equal(people.length, 2);
  assert.ok(people.some((person) => person.id === ids.overlap));
  assert.ok(people.some((person) => person.id === ids.staff));
});

test('create options do not filter on stored member status and only include accessible active branches', async () => {
  const h = followUpsHarness();
  const options = await h.data().loadFollowUpFormOptions(h.access, h.admin);
  assert.equal(options.members[0].id, ids.member);
  assert.equal(options.branches.length, 1);
  assert.equal(options.branches[0].id, ids.a);
  const inactive = followUpsHarness({ branchActive: false });
  assert.equal((await inactive.data().loadFollowUpFormOptions(inactive.access, inactive.admin)).branches.length, 0);
});

test('history remains readable after transfer through original record scope; outside users get no member context', async () => {
  const h = followUpsHarness({ transferred: true });
  const records = await h.data().loadFollowUpRecords(h.access, h.admin, ids.member);
  assert.equal(records.length, 1);
  assert.ok(await h.data().loadFollowUpMember(h.access, h.admin, ids.member, records));
  assert.equal(await h.data().loadFollowUpMember(h.access, h.admin, ids.member, []), null);
  assert.ok(await h.data().loadFollowUpForEdit(h.access, h.admin, ids.record));
  const outside = followUpsHarness({ branchIds: [] });
  assert.equal((await outside.data().loadFollowUpRecords(outside.access, outside.admin)).length, 0);
  assert.equal(await outside.data().loadFollowUpForEdit(outside.access, outside.admin, ids.record), null);
});
