const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { followUpsHarness, ids, id } = require('./helpers/follow-ups-harness.cjs');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');
const { manilaDate } = require('../lib/inactivity/calculate.ts');
const { getDueStatus, filterFollowUps } = require('../app/portal/follow-ups/types.ts');
const link = { __esModule: true, default: (props) => React.createElement('a', props) };
const withLinks = { 'next/link': link };

async function contentHtml(Page, props) {
  const element = Page(props);
  assert.equal(element.type, React.Suspense, 'Runtime reads must stay within Suspense');
  const content = element.props.children;
  return renderToStaticMarkup(await content.type(content.props));
}

test('due filters use Manila date boundaries, null dates and dates independently of outcome', () => {
  const sunday = manilaDate(new Date('2026-10-25T15:59:59Z'));
  const monday = manilaDate(new Date('2026-10-25T16:00:00Z'));
  assert.equal(getDueStatus('2026-10-25', sunday), 'today');
  assert.equal(getDueStatus('2026-10-25', monday), 'overdue');
  assert.equal(getDueStatus('2026-10-26', monday), 'today');
  assert.equal(getDueStatus('2026-10-27', monday), 'upcoming');
  assert.equal(getDueStatus(null, monday), null);
  const rows = [null, '2026-10-25', '2026-10-26', '2026-10-27'].map((nextFollowUpDate, i) => ({
    id: String(i), memberName: 'Juan Cruz', branchId: ids.a, method: 'call', outcome: 'resolved', followUpDate: '2026-10-01', nextFollowUpDate,
  }));
  const filters = { search: 'juan', branch: ids.a, method: 'call', outcome: 'resolved', dateFrom: '2026-10-01', dateTo: '2026-10-31' };
  for (const due of ['overdue', 'today', 'upcoming']) assert.equal(filterFollowUps(rows, { ...filters, due }, monday).length, 1);
  assert.equal(filterFollowUps(rows, { ...filters, search: 'Maria', due: 'all' }, monday).length, 0);
});

test('list renders joined history, useful filters and permission-gated edit actions without delete', async () => {
  for (const permissionKeys of [['follow_ups.view'], ['follow_ups.view', 'follow_ups.update', 'follow_ups.create']]) {
    const h = followUpsHarness({ permissions: permissionKeys });
    const Page = h.load('app/portal/follow-ups/page.tsx', withLinks).default;
    const html = await contentHtml(Page);
    for (const text of ['Juan Cruz', 'Main Church', 'Staff Performer', 'No Response', 'Overdue', 'Due Today', 'Upcoming', 'History']) assert.ok(html.includes(text), text);
    assert.equal(html.includes('Record Follow-up'), permissionKeys.includes('follow_ups.create'));
    assert.equal(html.includes('>Edit<'), permissionKeys.includes('follow_ups.update'));
    assert.ok(!/>Delete</.test(html));
  }
});

test('create page validates query preselection and defaults performer only when current account qualifies', async () => {
  const h = followUpsHarness();
  h.tables.profiles.push({ id: ids.actor, display_name: 'Current Staff', archived_at: null });
  h.tables.user_roles.push({ user_id: ids.actor, role_id: id(40), roles: { is_staff: true, is_active: true } });
  const Page = h.load('app/portal/follow-ups/new/page.tsx', withLinks).default;
  const html = await contentHtml(Page, { searchParams: Promise.resolve({ memberId: ids.member, branchId: ids.a }) });
  assert.ok(html.includes(`value="${ids.member}" selected=""`));
  assert.ok(html.includes(`value="${ids.a}" selected=""`));
  assert.ok(html.includes(`value="${ids.actor}" selected=""`));
  assert.ok(html.includes('Staff and Member'));
  await assert.rejects(contentHtml(Page, { searchParams: Promise.resolve({ memberId: ids.member, branchId: ids.b }) }), /not-found/);
  await assert.rejects(contentHtml(Page, { searchParams: Promise.resolve({ memberId: id(999) }) }), /not-found/);
});

test('edit renders immutable historical identity after a transfer', async () => {
  const h = followUpsHarness({ transferred: true, permissions: ['follow_ups.update'] });
  const Page = h.load('app/portal/follow-ups/[followUpId]/edit/page.tsx', withLinks).default;
  const html = await contentHtml(Page, { params: Promise.resolve({ followUpId: ids.record }), searchParams: Promise.resolve({}) });
  assert.ok(html.includes('Juan Cruz'));
  assert.ok(html.includes('Main Church'));
  assert.ok(html.includes('Historical member and branch cannot be changed'));
  assert.ok(html.includes(`name="church_branch_id" value="${ids.a}"`));
  assert.ok(!html.includes('>Delete<'));
});

test('history uses the existing derived inactivity loader; a resolved outcome does not imply activity', async () => {
  const h = followUpsHarness({ permissions: ['follow_ups.view', 'inactivity.view'] });
  h.tables.member_follow_ups[0].outcome = 'resolved';
  h.tables.member_follow_ups[0].notes = '<script>unsafe</script>\nPastoral notes';
  let calculations = 0;
  const Page = h.load('app/portal/follow-ups/member/[memberId]/page.tsx', {
    ...withLinks,
    '@/lib/inactivity/server': { getBranchMemberInactivity: async (branchId) => {
      assert.equal(branchId, ids.a); calculations++;
      return [{ memberId: ids.member, calculationStatus: 'evaluated', isInactive: true, consecutiveAbsentWeeks: 3,
        inactivityThresholdWeeks: 3, recentAttendanceRate: 0, recentEligibleWeeks: 3, recentAttendedWeeks: 0 }];
    } },
  }).default;
  const html = await contentHtml(Page, { params: Promise.resolve({ memberId: ids.member }), searchParams: Promise.resolve({}) });
  assert.equal(calculations, 1);
  assert.ok(html.includes('Inactive') && html.includes('Resolved'));
  assert.ok(html.includes('&lt;script&gt;unsafe&lt;/script&gt;'));
  assert.ok(!html.includes('Record Follow-up') && !html.includes('>Edit<'));
});

test('transferred-member history remains accessible without revealing the inaccessible current branch context', async () => {
  const h = followUpsHarness({ transferred: true });
  const Page = h.load('app/portal/follow-ups/member/[memberId]/page.tsx', {
    ...withLinks, '@/lib/inactivity/server': { getBranchMemberInactivity: () => { throw new Error('Must not read outside scope'); } },
  }).default;
  const html = await contentHtml(Page, { params: Promise.resolve({ memberId: ids.member }), searchParams: Promise.resolve({}) });
  assert.ok(html.includes('Original notes'));
  assert.ok(html.includes('Outside your branch access'));
  assert.ok(!html.includes('Second Church'));
  assert.ok(!html.includes('Record Follow-up'));
});

test('inactivity table offers follow-up actions for inactive, active and unknown members according to permissions', () => {
  const Table = loadTypeScript('app/portal/inactivity/InactivityTable.tsx', withLinks).default;
  const rows = [true, false, null].map((inactive, i) => ({ memberId: id(50 + i), branchId: ids.a, memberName: `Member ${i}`,
    calculationStatus: inactive === null ? 'eligibility_unknown' : 'evaluated', isInactive: inactive,
    consecutiveAbsentWeeks: inactive === null ? null : inactive ? 3 : 0, inactivityThresholdWeeks: 3,
    recentEligibleWeeks: 0, recentAttendedWeeks: 0, recentAttendanceRate: null, lastAttendedDate: null }));
  const html = renderToStaticMarkup(React.createElement(Table, { rows, canCreateFollowUps: true, canViewFollowUps: true }));
  assert.equal((html.match(/Record Follow-up/g) || []).length, 3);
  for (const row of rows) assert.ok(html.includes(`/portal/follow-ups/new?memberId=${row.memberId}&amp;branchId=${ids.a}`));
  const readOnly = renderToStaticMarkup(React.createElement(Table, { rows, canViewFollowUps: true }));
  assert.ok(!readOnly.includes('Record Follow-up'));
  assert.ok(readOnly.includes('View Follow-ups'));
});

test('navigation and default routing use follow_ups.view rather than role names', async () => {
  const h = followUpsHarness({ permissions: ['follow_ups.view'] });
  const Navigation = h.load('app/portal/PortalNavigation.tsx', { ...withLinks,
    'next/navigation': { usePathname: () => '/portal/follow-ups' },
  }).default;
  for (const variant of ['desktop', 'mobile']) {
    assert.ok(renderToStaticMarkup(React.createElement(Navigation, { permissions: ['follow_ups.view'], variant })).includes('Follow-ups'));
    assert.ok(!renderToStaticMarkup(React.createElement(Navigation, { permissions: ['follow_ups.create'], variant })).includes('Follow-ups'));
  }
  const Page = h.load('app/portal/page.tsx', {
    '@/lib/auth': { getCurrentUser: async () => h.access.user },
    '@/lib/permissions-server': { getCurrentUserPermissions: async () => ['follow_ups.view'] },
  }).default;
  await assert.rejects(Page(), /redirect:\/portal\/follow-ups/);
});
