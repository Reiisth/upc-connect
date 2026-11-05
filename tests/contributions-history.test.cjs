/* eslint-disable @typescript-eslint/no-require-imports -- Node regression suite. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderToStaticMarkup } = require('react-dom/server');
const { historicalHarness } = require('./helpers/historical-records-harness.cjs');

const route = 'app/portal/contributions/actions.ts';
const redirected = /redirect:\/portal\/contributions$/;
const denied = /redirect:\/access-denied/;
const states = { transferred: { church_branch_id: 'b' }, archived: { is_archived: true }, inactive: { member_status: 'inactive' } };

test('new contribution accepts a current same-branch member with a custom permission role', async () => {
  const h = historicalHarness({ permissions: ['contributions.create'] });
  await assert.rejects(h.load(route).createContribution(null, h.contributionForm({ member_id: 'current' })), redirected);
  assert.equal(h.db.financial_contributions.at(-1).amount, '123.45');
  assert.equal(h.db.financial_contributions.at(-1).recorded_by, 'actor');
});

test('new contribution rejects archived/unknown members, inactive branches and out-of-scope selected branches', async () => {
  for (const member of ['archived', 'missing']) {
    const h = historicalHarness();
    assert.ok((await h.load(route).createContribution(null, h.contributionForm({ member_id: member }))).error);
    assert.equal(h.writes.length, 0);
  }
  for (const options of [{ branchActive: false }, { branchIds: ['b'] }]) {
    const h = historicalHarness(options);
    assert.ok((await h.load(route).createContribution(null, h.contributionForm())).error);
    assert.equal(h.writes.length, 0);
  }
});

test('anonymous contributions and stored-inactive non-archived members retain their existing creation eligibility', async () => {
  for (const member_id of ['', 'inactive']) {
    const h = historicalHarness();
    await assert.rejects(h.load(route).createContribution(null, h.contributionForm({ member_id, service_id: '' })), redirected);
    assert.equal(h.db.financial_contributions.at(-1).member_id, member_id || null);
  }
});

test('new service links must use a same-branch non-cancelled service', async () => {
  for (const service_id of ['foreign-service', 'cancelled-service', 'missing']) {
    const h = historicalHarness();
    assert.ok((await h.load(route).createContribution(null, h.contributionForm({ service_id }))).error);
    assert.equal(h.writes.length, 0);
  }
});

for (const [state, change] of Object.entries(states)) {
  test(`${state} contributor remains visible under the contribution's recorded branch and summary`, async () => {
    const h = historicalHarness(); const api = h.load('app/portal/contributions/data.ts'); const branches = await h.branches();
    const before = await api.loadContributionRecords(h.admin, branches);
    Object.assign(h.db.members[0], change);
    const after = await api.loadContributionRecords(h.admin, branches);
    assert.deepEqual(JSON.parse(JSON.stringify(after)), JSON.parse(JSON.stringify(before)));
    assert.equal(after.find((row) => row.id === 'contribution').memberName, 'Historical Member');
    assert.equal(after.some((row) => row.id === 'foreign-contribution'), false);
    assert.equal(h.load('app/portal/contributions/types.ts').getContributionSummary(after).totalAmountCents, 30);
  });
  test(`existing contribution can be corrected for the unchanged ${state} member without a current-roster lookup`, async () => {
    const h = historicalHarness({ permissions: ['contributions.update'] }); Object.assign(h.db.members[0], change);
    await assert.rejects(h.load(route).updateContribution('contribution', null, h.contributionForm()), redirected);
    assert.equal(h.db.financial_contributions[0].notes, 'Corrected');
    assert.equal(h.db.financial_contributions[0].church_branch_id, 'a');
    assert.equal(h.db.financial_contributions[0].member_id, 'historical');
    assert.equal(h.db.financial_contributions[0].recorded_by, 'original');
    assert.equal(h.events.some((event) => event.table === 'members'), false);
    assert.ok(h.events.some((event) => event.revalidate === '/portal/reports'));
  });
}

test('correction uses stored-branch scope, with explicit permission still required for a global administrator', async () => {
  const h = historicalHarness({ branchIds: ['b'] }); h.db.members[0].church_branch_id = 'b';
  assert.match((await h.load(route).updateContribution('contribution', null, h.contributionForm())).error, /assigned/);
  assert.equal(h.writes.length, 0);
  const global = historicalHarness({ isSystemAdmin: true, permissions: [] });
  await assert.rejects(global.load(route).updateContribution('contribution', null, global.contributionForm()), denied);
  const allowed = historicalHarness({ isSystemAdmin: true, permissions: ['contributions.update'] });
  await assert.rejects(allowed.load(route).updateContribution('foreign-contribution', null, allowed.contributionForm({ church_branch_id: 'b', member_id: 'foreign', service_id: '' })), redirected);
});

test('contribution historical branch is immutable even when the actor can manage both branches', async () => {
  const h = historicalHarness({ branchIds: ['a', 'b'] });
  assert.match((await h.load(route).updateContribution('contribution', null, h.contributionForm({ church_branch_id: 'b' }))).error, /branch cannot be changed/);
  assert.equal(h.writes.length, 0);
});

test('replacement contributor must satisfy current non-archived rules; removing an optional member link is explicit', async () => {
  for (const member_id of ['archived', 'missing']) {
    const h = historicalHarness(); h.db.members[0].church_branch_id = 'b';
    assert.ok((await h.load(route).updateContribution('contribution', null, h.contributionForm({ member_id }))).error);
    assert.equal(h.writes.length, 0);
  }
  for (const member_id of ['foreign', 'replacement', 'inactive', '']) {
    const h = historicalHarness(); h.db.members[0].is_archived = true;
    await assert.rejects(h.load(route).updateContribution('contribution', null, h.contributionForm({ member_id })), redirected);
    assert.equal(h.db.financial_contributions[0].member_id, member_id || null);
  }
});

test('unchanged service survives cancellation/current relationship drift without changing the accounting date', async () => {
  const h = historicalHarness(); h.db.services[0].status = 'cancelled'; h.db.services[0].church_branch_id = 'b'; h.db.members[0].church_branch_id = 'b';
  await assert.rejects(h.load(route).updateContribution('contribution', null, h.contributionForm({ contribution_date: '2026-10-20' })), redirected);
  assert.equal(h.db.financial_contributions[0].contribution_date, '2026-10-20');
  assert.equal(h.db.financial_contributions[0].service_id, 'service');
  assert.equal(h.events.some((event) => event.table === 'services'), false);
});

test('changed service requires a valid same-branch relationship and never copies the service date', async () => {
  for (const service_id of ['foreign-service', 'cancelled-service', 'missing']) {
    const h = historicalHarness();
    assert.ok((await h.load(route).updateContribution('contribution', null, h.contributionForm({ service_id }))).error);
    assert.equal(h.writes.length, 0);
  }
  for (const service_id of ['new-service', '']) {
    const h = historicalHarness();
    await assert.rejects(h.load(route).updateContribution('contribution', null, h.contributionForm({ service_id })), redirected);
    assert.equal(h.db.financial_contributions[0].service_id, service_id || null);
    assert.equal(h.db.financial_contributions[0].contribution_date, '2026-10-21');
  }
});

test('exact decimal strings and existing amount limits are preserved in create/update', async () => {
  for (const [amount, expected] of [['0.10', '0.10'], ['000.2', '0.20'], ['9999999999.99', '9999999999.99']]) {
    const h = historicalHarness();
    await assert.rejects(h.load(route).updateContribution('contribution', null, h.contributionForm({ amount })), redirected);
    assert.equal(h.writes[0].payload.amount, expected); assert.equal(typeof h.writes[0].payload.amount, 'string');
  }
  for (const amount of ['0', '-1', '1.001', 'NaN', '1e2', '10000000000.00']) {
    const h = historicalHarness();
    assert.ok((await h.load(route).createContribution(null, h.contributionForm({ amount }))).error);
    assert.equal(h.writes.length, 0);
  }
});

test('edit form retains transferred/archived identity and submits the fixed branch instead of silently anonymizing', async () => {
  const h = historicalHarness(); Object.assign(h.db.members[0], { church_branch_id: 'b', is_archived: true });
  const html = renderToStaticMarkup(await h.content('app/portal/contributions/[contributionId]/edit/page.tsx', { contributionId: 'contribution' }));
  assert.ok(html.includes('Historical Member') && html.includes('Archived (historical)'));
  assert.ok(/value="historical" selected=""/.test(html));
  assert.ok(html.includes('type="hidden" name="church_branch_id" value="a"'));
  assert.ok(html.includes('Foreign Private'), 'focused cross-branch identities are available for replacements');
  const foreign = historicalHarness({ branchIds: ['b'] });
  await assert.rejects(foreign.content('app/portal/contributions/[contributionId]/edit/page.tsx', { contributionId: 'contribution' }), /not-found/);
  assert.equal(foreign.events.some((event) => event.table === 'members'), false);
});

test('historical inactive-branch records remain visible/correctable while new records stay blocked', async () => {
  const h = historicalHarness({ branchActive: false }); h.db.members[0].church_branch_id = 'b';
  const branches = await h.branches(); assert.equal(branches[0].isActive, false);
  assert.equal((await h.load('app/portal/contributions/data.ts').loadContributionRecords(h.admin, branches)).length, 2);
  await assert.rejects(h.load(route).updateContribution('contribution', null, h.contributionForm()), redirected);
  assert.ok((await h.load(route).createContribution(null, h.contributionForm())).error);
  assert.ok((await h.load(route).updateContribution('contribution', null, h.contributionForm({ member_id: 'replacement' }))).error);
  await assert.rejects(h.load(route).updateContribution('contribution', null, h.contributionForm({ member_id: '', service_id: '' })), redirected);
  assert.equal(h.db.financial_contributions[0].member_id, null);
});

test('concurrent relationship changes and failed lookups cannot report a successful correction', async () => {
  const h = historicalHarness({ beforeWrite: (db, table) => { if (table === 'financial_contributions') db.financial_contributions[0].member_id = 'replacement'; } });
  assert.match((await h.load(route).updateContribution('contribution', null, h.contributionForm())).error, /changed while/);
  assert.equal(h.db.financial_contributions[0].notes, 'Original');
  const failure = historicalHarness({ failRead: 'financial_contributions' });
  const result = await failure.load(route).updateContribution('contribution', null, failure.contributionForm());
  assert.ok(result.error && !result.error.includes('PRIVATE')); assert.equal(failure.writes.length, 0);
});

test('actual list uses stored record branches and view permission, without requiring create/update', async () => {
  const h = historicalHarness({ permissions: ['contributions.view'] }); h.db.members[0].church_branch_id = 'b';
  const html = renderToStaticMarkup(await h.content('app/portal/contributions/page.tsx'));
  assert.ok(html.includes('Historical Member') && html.includes('Historical Church'));
  assert.ok(!html.includes('Foreign Private') && !html.includes('New Contribution') && !html.includes('>Edit<'));
});

test('receiving-only recorder selects cross-branch identity without members.view or home branch access', async () => {
  const h = historicalHarness({ permissions: ['contributions.create'] });
  const before = JSON.stringify(h.db.members);
  await assert.rejects(h.load(route).createContribution(null, h.contributionForm({ member_id: 'foreign' })), redirected);
  const gift = h.db.financial_contributions.at(-1);
  assert.equal(gift.church_branch_id, 'a');
  assert.equal(gift.member_id, 'foreign');
  assert.equal(gift.service_id, 'service');
  assert.equal(gift.contributor_type, 'member');
  assert.equal(JSON.stringify(h.db.members), before);
  const options = await h.load('app/portal/contributions/data.ts').loadContributionOptions({ branchIds: ['a'], isSystemAdmin: false }, h.admin);
  assert.ok(options.members.some(m => m.id === 'foreign'));
  assert.ok(options.members.every(m => Object.keys(m).every(k => ['id','fullName','churchBranchId','homeBranchName','isArchived'].includes(k))));
});

test('Visitor name is trimmed and retained, Anonymous remains distinct, impossible identities reject', async () => {
  const h = historicalHarness();
  const before = JSON.stringify(h.db.members);
  await assert.rejects(h.load(route).createContribution(null, h.contributionForm({ contributor_type: 'visitor', member_id: '', visitor_name: '  Maria Santos  ' })), redirected);
  assert.equal(h.db.financial_contributions.at(-1).visitor_name, 'Maria Santos');
  assert.equal(h.db.financial_contributions.at(-1).member_id, null);
  assert.equal(JSON.stringify(h.db.members), before);
  const record = h.load('app/portal/contributions/types.ts').contributorName({ contributorType: 'visitor', visitorName: 'Maria Santos', memberName: null });
  assert.equal(record, 'Maria Santos');
  for (const input of [
    { contributor_type: 'visitor', member_id: '', visitor_name: '   ' },
    { contributor_type: 'visitor', visitor_name: 'Maria' },
    { contributor_type: 'member', member_id: '' },
    { contributor_type: 'member', visitor_name: 'Maria' },
    { contributor_type: 'anonymous' },
    { contributor_type: 'anonymous', member_id: '', visitor_name: 'Maria' },
    { contributor_type: 'visitor', member_id: '', visitor_name: 'x'.repeat(161) },
    { contributor_type: 'unknown' },
  ]) {
    const invalid = historicalHarness();
    assert.ok((await invalid.load(route).createContribution(null, invalid.contributionForm(input))).error);
    assert.equal(invalid.writes.length, 0);
  }
});

test('contributor categories may be corrected while branch and recorder stay immutable', async () => {
  const h = historicalHarness();
  await assert.rejects(h.load(route).updateContribution('contribution', null, h.contributionForm({ contributor_type: 'visitor', member_id: '', visitor_name: 'Maria Santos' })), redirected);
  assert.equal(h.db.financial_contributions[0].visitor_name, 'Maria Santos');
  h.db.members[0].church_branch_id = 'b';
  assert.equal(h.db.financial_contributions[0].visitor_name, 'Maria Santos');
  await assert.rejects(h.load(route).updateContribution('contribution', null, h.contributionForm({ contributor_type: 'member', member_id: 'foreign' })), redirected);
  assert.equal(h.db.financial_contributions[0].church_branch_id, 'a');
  assert.equal(h.db.financial_contributions[0].recorded_by, 'original');
});
