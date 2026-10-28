const { test } = require('node:test');
const assert = require('node:assert/strict');
const { followUpsHarness, ids, id } = require('./helpers/follow-ups-harness.cjs');
const initial = { error: null };
const succeeds = (promise) => assert.rejects(promise, /redirect:/);

test('authorized create accepts both active and inactive members; only a follow-up row is written', async () => {
  for (const memberStatus of ['active', 'inactive']) {
    const h = followUpsHarness({ memberStatus });
    const snapshot = JSON.stringify(h.tables.members);
    await succeeds(h.actions().createFollowUp(initial, h.form({ created_by: id(999), is_inactive: 'false', member_status: 'active' })));
    assert.equal(h.writes.length, 1);
    assert.equal(h.writes[0].table, 'member_follow_ups');
    assert.equal(h.writes[0].payload.created_by, ids.actor);
    assert.equal(h.writes[0].payload.outcome, 'resolved');
    assert.equal(JSON.stringify(h.tables.members), snapshot);
    assert.ok(!Object.hasOwn(h.writes[0].payload, 'is_inactive'));
    assert.ok(h.revalidated.includes('/portal/inactivity'));
  }
});

test('view-only users including system administrators cannot create or update', async () => {
  for (const isSystemAdmin of [false, true]) {
    const h = followUpsHarness({ permissions: ['follow_ups.view'], isSystemAdmin });
    await assert.rejects(h.actions().createFollowUp(initial, h.form()), /Access denied/);
    await assert.rejects(h.actions().updateFollowUp(ids.record, initial, h.form()), /Access denied/);
    assert.equal(h.writes.length, 0);
  }
  const unauthenticated = followUpsHarness({ authenticated: false });
  await assert.rejects(unauthenticated.actions().createFollowUp(initial, unauthenticated.form()), /Login required/);
});

test('create rejects inaccessible/inactive branches, missing members and member/branch mismatch', async () => {
  for (const options of [{ branchIds: [] }, { branchActive: false }, { transferred: true }]) {
    const h = followUpsHarness(options);
    assert.ok((await h.actions().createFollowUp(initial, h.form())).error);
    assert.equal(h.writes.length, 0);
  }
  const h = followUpsHarness();
  assert.ok((await h.actions().createFollowUp(initial, h.form({ church_branch_id: 'invalid' }))).error);
  assert.ok((await h.actions().createFollowUp(initial, h.form({ member_id: id(999) }))).error);
  assert.equal(h.writes.length, 0);
});

test('performer must exist, be non-archived and have an active staff role', async () => {
  const h = followUpsHarness();
  for (const performer of [ids.archived, ids.inactiveRole, ids.nonstaff, id(999), 'invalid']) {
    const result = await h.actions().createFollowUp(initial, h.form({ followed_up_by: performer }));
    assert.ok(result.error, performer);
  }
  assert.equal(h.writes.length, 0);
  await succeeds(h.actions().createFollowUp(initial, h.form({ followed_up_by: ids.overlap })));
  assert.equal(h.writes[0].payload.followed_up_by, ids.overlap);
  // Performer has no follow_ups.create account capability in this fixture.
  await succeeds(h.actions().createFollowUp(initial, h.form({ followed_up_by: '' })));
  assert.equal(h.writes[1].payload.followed_up_by, null);
});

test('date, method and outcome validation rejects bad values without leaking database details', async () => {
  const h = followUpsHarness();
  for (const patch of [{ follow_up_date: '2026-02-30' }, { follow_up_date: '' }, { method: 'email' },
    { outcome: 'pending' }, { next_follow_up_date: '2026-10-26' }, { next_follow_up_date: 'invalid' }, { notes: 'x'.repeat(5001) }]) {
    assert.ok((await h.actions().createFollowUp(initial, h.form(patch))).error);
  }
  assert.equal(h.writes.length, 0);
  await succeeds(h.actions().createFollowUp(initial, h.form({ outcome: 'resolved', next_follow_up_date: '2026-10-27' })));
  const broken = followUpsHarness({ databaseError: true });
  const result = await broken.actions().createFollowUp(initial, broken.form());
  assert.ok(result.error && !result.error.includes('INTERNAL_DATABASE_DETAIL'));
});

test('editing preserves original member, branch and recorder after member transfer', async () => {
  const h = followUpsHarness({ transferred: true });
  await succeeds(h.actions().updateFollowUp(ids.record, initial, h.form({ created_by: ids.actor })));
  const record = h.tables.member_follow_ups[0];
  assert.equal(record.member_id, ids.member);
  assert.equal(record.church_branch_id, ids.a);
  assert.equal(record.created_by, ids.creator);
  assert.equal(record.outcome, 'resolved');
  assert.ok(record.updated_at !== '2026-10-25T00:00:00Z');
  for (const key of ['member_id', 'church_branch_id', 'created_by']) assert.ok(!Object.hasOwn(h.writes[0].payload, key));
  assert.equal(h.tables.members[0].church_branch_id, ids.b);
});

test('edit rejects tampered member/branch and inaccessible historical records', async () => {
  const h = followUpsHarness();
  for (const patch of [{ member_id: id(999) }, { church_branch_id: ids.b }]) {
    const result = await h.actions().updateFollowUp(ids.record, initial, h.form(patch));
    assert.match(result.error, /cannot be changed/);
  }
  const outside = followUpsHarness({ branchIds: [ids.b] });
  assert.ok((await outside.actions().updateFollowUp(ids.record, initial, outside.form())).error);
  const inactive = followUpsHarness({ branchActive: false });
  assert.ok((await inactive.actions().updateFollowUp(ids.record, initial, inactive.form())).error);
  assert.equal(h.writes.length + outside.writes.length + inactive.writes.length, 0);
});

test('create-only and update-only custom permissions work without requiring list permission', async () => {
  const create = followUpsHarness({ permissions: ['follow_ups.create'] });
  await assert.rejects(create.actions().createFollowUp(initial, create.form()), /redirect:\/portal\/follow-ups\/new\?saved=1/);
  const edit = followUpsHarness({ permissions: ['follow_ups.update'] });
  await assert.rejects(edit.actions().updateFollowUp(ids.record, initial, edit.form()), /\/edit\?saved=1/);
  assert.ok(!Object.keys(create.actions()).some((key) => /delete/i.test(key)));
});
