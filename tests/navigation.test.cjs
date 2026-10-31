/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner uses CommonJS. */
const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');

const link = { __esModule: true, default: (props) => React.createElement('a', props, props.children) };
function nav(pathname, permissions, variant = 'desktop') {
  const Navigation = loadTypeScript('app/portal/PortalNavigation.tsx', {
    'next/link': link,
    'next/navigation': { usePathname: () => pathname },
    '@/lib/permissions': {
      PERMISSION_KEYS: ['reports.view', 'members.view', 'services.view', 'attendance.view', 'inactivity.view',
        'follow_ups.view', 'baptisms.view', 'contributions.view', 'accounts.view', 'accounts.manage_branch_access',
        'administration.view', 'branches.view', 'roles.view', 'profile.view'],
      hasPermission: (values, key) => values.includes(key),
      hasAnyPermission: (values, keys) => keys.some((key) => values.includes(key)),
    },
  }).default;
  return renderToStaticMarkup(React.createElement(Navigation, { permissions, variant }));
}

function portal(permissions) {
  const Page = loadTypeScript('app/portal/page.tsx', {
    'next/navigation': { redirect: (url) => { throw new Error(`redirect:${url}`); } },
    '@/lib/auth': { requireActiveAccount: async () => ({ user: { id: 'u1' } }) },
    '@/lib/permissions': {
      hasPermission: (values, key) => values.includes(key),
      hasAnyPermission: (values, keys) => keys.some((key) => values.includes(key)),
    },
    '@/lib/permissions-server': { getCurrentUserPermissions: async () => permissions },
  }).default;
  return Page();
}

test('portal landing prioritizes Reports, then the first workspace, then profile-only access', async () => {
  await assert.rejects(portal(['reports.view', 'members.view']), /redirect:\/portal\/reports/);
  await assert.rejects(portal(['services.view', 'members.view']), /redirect:\/portal\/members/);
  await assert.rejects(portal(['profile.view']), /redirect:\/portal\/profile/);
  await assert.rejects(portal([]), /redirect:\/access-denied/);
  await assert.rejects(portal(['accounts.manage_branch_access']), /redirect:\/portal\/accounts\/staff/);
  await assert.rejects(portal(['roles.view']), /redirect:\/portal\/administration/);
});

test('landing and navigation use permissions and no role-name/dashboard route', async () => {
  const source = require('node:fs').readFileSync('app/portal/page.tsx', 'utf8');
  assert.doesNotMatch(source, /system_admin|pastor|accounting_officer|dashboard\.view/);
  const desktop = nav('/portal/reports', ['dashboard.view', 'reports.view']);
  assert.ok(desktop.includes('Reports &amp; Analytics'));
  assert.ok(!desktop.includes('Dashboard'));
  assert.ok(!desktop.includes('Field Management'));
});

test('desktop navigation groups workspaces and personal destinations', () => {
  const html = nav('/portal', ['reports.view', 'members.view', 'inactivity.view', 'follow_ups.view',
    'services.view', 'attendance.view', 'baptisms.view', 'contributions.view', 'accounts.view', 'administration.view', 'profile.view']);
  for (const group of ['Overview', 'People & Care', 'Services & Attendance', 'Church Records', 'Management', 'Personal']) {
    assert.ok(html.includes(`aria-label="${group.replaceAll('&', '&amp;')}"`), group);
  }
  for (const label of ['Reports &amp; Analytics', 'Members', 'Inactivity Monitoring', 'Follow-ups', 'Services', 'Attendance',
    'Baptisms', 'Contributions', 'Accounts', 'Administration', 'My Profiles', 'My Account']) assert.ok(html.includes(label), label);
});

test('mobile navigation uses a compact bar and More contains permission-filtered grouped destinations', () => {
  const html = nav('/portal/members', ['members.view', 'services.view', 'attendance.view', 'profile.view'], 'mobile');
  assert.ok(html.includes('More'));
  assert.ok(!html.includes('overflow-x-auto'));
  assert.ok(html.includes('Services &amp; Attendance'));
  assert.ok(html.includes('My Profiles'));
  assert.ok(!html.includes('Reports &amp; Analytics'));
  assert.ok(!html.includes('Administration'));
});

test('segment-safe active matching distinguishes account from accounts', () => {
  const onAccounts = nav('/portal/accounts', ['accounts.view']);
  assert.match(onAccounts, /href="\/portal\/accounts" aria-current="page"/);
  assert.doesNotMatch(onAccounts, /href="\/portal\/account" aria-current="page"/);
  const onAccount = nav('/portal/account', ['accounts.view']);
  assert.match(onAccount, /href="\/portal\/account" aria-current="page"/);
  assert.doesNotMatch(onAccount, /href="\/portal\/accounts" aria-current="page"/);
});

test('Administration hub admits specific child permissions and shows only permitted cards', async () => {
  async function renderHub(permissions) {
    const ReactPage = loadTypeScript('app/portal/administration/page.tsx', {
      'react': React,
      'lucide-react': new Proxy({}, { get: () => () => null }),
      '@/lib/permissions': { hasPermission: (values, key) => values.includes(key) },
      './access': { getAdministrationHubPermissions: async () => permissions },
      '@/components/ui/clickable-card': { ClickableCard: (props) => React.createElement('a', { href: props.href }, props.children) },
      '@/components/ui/page-container': { PageContainer: (props) => React.createElement('main', null, props.children) },
      '@/components/ui/page-header': { PageHeader: (props) => React.createElement('h1', null, props.title) },
      '@/components/ui/skeleton': { Skeleton: () => React.createElement('div') },
    }).default;
    const wrapped = ReactPage();
    const content = wrapped.props.children;
    return renderToStaticMarkup(await content.type(content.props));
  }
  const branches = await renderHub(['branches.view']);
  assert.ok(branches.includes('Church Branches'));
  assert.ok(!branches.includes('Roles &amp; Permissions'));
  assert.ok(!branches.includes('Staff Branch Access'));
  assert.ok(!branches.includes('Profile Fields'));
  const roles = await renderHub(['roles.view']);
  assert.ok(roles.includes('Roles &amp; Permissions'));
  assert.ok(!roles.includes('Church Branches'));
  const branchManager = await renderHub(['accounts.manage_branch_access']);
  assert.match(branchManager, /href="\/portal\/accounts\/staff"/);
  assert.ok(branchManager.includes('Staff Branch Access'));
  assert.ok(!branchManager.includes('Profile Fields'));
  const admin = await renderHub(['administration.view']);
  assert.ok(admin.includes('Profile Fields'));

  const source = require('node:fs').readFileSync('app/portal/administration/access.ts', 'utf8');
  assert.ok(source.includes('getAdministrationHubPermissions'));
  assert.ok(source.includes('branches.view') && source.includes('roles.view'));
});

test('Profile Fields is linked only from Administration and legacy branch URLs redirect to Accounts', async () => {
  const field = require('node:fs').readFileSync('app/portal/PortalNavigation.tsx', 'utf8');
  assert.ok(!field.includes('Field Management'));
  const hub = require('node:fs').readFileSync('app/portal/administration/page.tsx', 'utf8');
  assert.ok(hub.includes('Profile Fields'));

  const redirect = (url) => { throw new Error(`redirect:${url}`); };
  const index = loadTypeScript('app/portal/administration/staff-branch-access/page.tsx', {
    'next/navigation': { redirect },
  }).default;
  assert.throws(() => index(), /redirect:\/portal\/accounts\/staff/);
  const detail = loadTypeScript('app/portal/administration/staff-branch-access/[userId]/page.tsx', {
    'next/navigation': { redirect },
  }).default;
  const wrapped = detail({ params: Promise.resolve({ userId: 'abc-123' }) });
  await assert.rejects(wrapped.props.children.type(wrapped.props.children.props), /redirect:\/portal\/accounts\/staff\/abc-123/);
});

test('service attendance action is explicit and gated by attendance.view', () => {
  const table = require('node:fs').readFileSync('app/portal/services/ServicesTable.tsx', 'utf8');
  const page = require('node:fs').readFileSync('app/portal/services/page.tsx', 'utf8');
  assert.ok(table.includes('canManageAttendance &&'));
  assert.ok(table.includes('Manage Attendance'));
  assert.ok(table.includes('/portal/attendance/${service.id}'));
  assert.ok(page.includes('"attendance.view"'));

  const ServicesTable = loadTypeScript('app/portal/services/ServicesTable.tsx', { 'next/link': link }).default;
  const service = { id: 'service-1', name: 'Sunday Service', serviceType: 'sunday_morning', serviceDate: '2026-10-31',
    startTime: '09:00:00', status: 'scheduled', churchBranchId: 'branch-1', notes: null,
    branch: { id: 'branch-1', name: 'Main', code: 'MAIN', isActive: true } };
  const branches = [service.branch];
  const allowed = renderToStaticMarkup(React.createElement(ServicesTable, { services: [service], branches, canEdit: false, canManageAttendance: true }));
  const denied = renderToStaticMarkup(React.createElement(ServicesTable, { services: [service], branches, canEdit: false, canManageAttendance: false }));
  assert.ok(allowed.includes('Manage Attendance') && allowed.includes('/portal/attendance/service-1'));
  assert.ok(!denied.includes('Manage Attendance') && denied.includes('View only'));
});

test('member and follow-up contextual account/member actions are permission-gated', () => {
  const member = require('node:fs').readFileSync('app/portal/members/[memberId]/page.tsx', 'utf8');
  const account = require('node:fs').readFileSync('app/portal/accounts/[userId]/page.tsx', 'utf8');
  const followUp = require('node:fs').readFileSync('app/portal/follow-ups/member/[memberId]/page.tsx', 'utf8');
  assert.ok(member.includes('can("accounts.view")') && member.includes('Manage Account'));
  assert.ok(account.includes('hasPermission(access.permissions, "members.view")') && account.includes('/portal/members/${member.id}'));
  assert.ok(followUp.includes('hasPermission(access.permissions, "members.view")') && followUp.includes('Open Member'));
  assert.ok(followUp.includes('canCreate ?'));
});
