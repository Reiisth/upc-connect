/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner uses CommonJS. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');

function identityHarness({ systemAdmin = false } = {}) {
  const reads = [];
  const rows = {
    profiles: [{ id: 'actor', display_name: 'Jaspher' }],
    user_roles: [{ roles: { key: 'pastor', display_name: 'Pastor', is_active: true } },
      { roles: { key: 'custom', display_name: 'Care Coordinator', is_active: true } },
      { roles: { key: 'inactive', display_name: 'Inactive Role', is_active: false } },
      ...(systemAdmin ? [{ roles: { key: 'system_admin', display_name: 'System Administrator', is_active: true } }] : [])],
    user_branch_access: [{ church_branch: { name: 'Branch A', is_active: true } },
      { church_branch: { name: 'Old Branch', is_active: false } }],
  };
  const admin = { from(table) {
    reads.push(table);
    const query = { filters: [], select() { return this; }, eq(key, value) { this.filters.push([key, value]); return this; },
      maybeSingle() { return Promise.resolve({ data: rows[table][0] ?? null, error: null }); },
      then(resolve, reject) {
        let result = rows[table] ?? [];
        for (const [key, value] of this.filters) {
          if (key === 'id' || key === 'user_id') result = result.filter((row) => row[key] === value || table === 'user_roles' || table === 'user_branch_access');
          if (key === 'church_branch.is_active' && value) result = result.filter((row) => row.church_branch?.is_active);
        }
        return Promise.resolve({ data: result, error: null }).then(resolve, reject);
      },
    };
    return query;
  } };
  const api = loadTypeScript('lib/portal-user-context.ts', {
    'server-only': {}, react: { cache: (fn) => fn }, '@/lib/supabase/admin': { createAdminClient: () => admin },
  });
  return { api, reads };
}

test('portal identity shows active display-name roles and only assigned active branches', async () => {
  const h = identityHarness();
  const context = await h.api.getPortalUserContext('actor', 'actor@example.test');
  assert.equal(context.displayName, 'Jaspher');
  assert.equal(JSON.stringify(context.roles.map((role) => role.displayName)), JSON.stringify(['Pastor', 'Care Coordinator']));
  assert.equal(JSON.stringify(context.branches), JSON.stringify(['Branch A']));
  assert.equal(context.hasAllBranches, false);
  const Summary = loadTypeScript('app/portal/PortalIdentitySummary.tsx').PortalIdentitySummary;
  const html = renderToStaticMarkup(React.createElement(Summary, { context }));
  for (const value of ['Jaspher', 'Pastor', 'Care Coordinator', 'Branch A']) assert.ok(html.includes(value));
  assert.ok(!html.includes('Inactive Role'));
  assert.ok(!html.includes('Old Branch'));
});

test('system administrators see All Branches without enumerating assigned branches', async () => {
  const h = identityHarness({ systemAdmin: true });
  const context = await h.api.getPortalUserContext('actor', 'actor@example.test');
  assert.equal(context.hasAllBranches, true);
  assert.equal(JSON.stringify(context.branches), JSON.stringify([]));
  assert.ok(!h.reads.includes('user_branch_access'));
  const Summary = loadTypeScript('app/portal/PortalIdentitySummary.tsx').PortalIdentitySummary;
  const html = renderToStaticMarkup(React.createElement(Summary, { context }));
  assert.ok(html.includes('All Branches'));
});

test('portal shell loads and exposes identity context on desktop and from the mobile header', () => {
  const layout = fs.readFileSync('app/portal/layout.tsx', 'utf8');
  const navigation = fs.readFileSync('app/portal/PortalNavigation.tsx', 'utf8');
  assert.match(layout, /getPortalUserContext\(/);
  assert.match(layout, /user\.id,/);
  assert.match(layout, /<PortalIdentitySummary context=\{identity\}/);
  assert.match(layout, /<MobileProfileInfo><PortalIdentitySummary context=\{identity\}/);
  assert.doesNotMatch(navigation, /PortalIdentitySummary/);
});

test('Members list defaults to active records and offers archived and all filters', () => {
  const page = fs.readFileSync('app/portal/members/page.tsx', 'utf8');
  const table = fs.readFileSync('app/portal/members/MembersTable.tsx', 'utf8');
  assert.match(page, /is_archived,/);
  assert.doesNotMatch(page, /\.eq\("is_archived", false\)/);
  assert.match(table, /useState\("active"\)/);
  assert.match(table, /value="archived">Archived Members/);
  assert.match(table, /value="all">All Members/);
  assert.match(table, /<StatusBadge variant="muted">Archived<\/StatusBadge>/);
  assert.match(table, /archived=\{member\.is_archived\}/);
});

test('New Member form omits initial status, retains attendance and church fields, and server ignores submitted status', () => {
  const formSource = fs.readFileSync('app/portal/members/MemberChurchForm.tsx', 'utf8');
  assert.match(formSource, /editing && <FormField label="Member Status"/);
  const newPage = fs.readFileSync('app/portal/members/new/page.tsx', 'utf8');
  assert.match(newPage, /departments=\{departmentsResult\.data/);
  const validation = loadTypeScript('app/portal/members/validation.ts', {
    '@/lib/member-validation': {
      formText: (form, name) => String(form.get(name) ?? '').trim(),
      memberDate: (value) => value || null,
    },
  });
  const form = new FormData();
  for (const [key, value] of Object.entries({ first_name: 'A', last_name: 'B', church_branch_id: 'branch', member_status: 'inactive' })) form.set(key, value);
  assert.equal(validation.validateChurchMember(form, { creating: true }).member_status, 'active');
  assert.equal(validation.validateChurchMember(form).member_status, 'inactive');
  assert.match(formSource, /name="first_attendance_date"/);
  for (const field of ['department_id', 'position', 'zone']) assert.ok(formSource.includes(`name="${field}"`));
  assert.doesNotMatch(formSource, /suffix/i);
});

test('Member detail prioritizes church information and gates secondary actions by permission', () => {
  const detail = fs.readFileSync('app/portal/members/[memberId]/page.tsx', 'utf8');
  const church = detail.indexOf('Church Information');
  const account = detail.indexOf('>Account</h2>');
  const personal = detail.indexOf('Personal Information');
  const care = detail.indexOf('Care and Activity');
  const archive = detail.indexOf('Member Record Actions');
  assert.ok(church >= 0 && church < account && account < personal && personal < care && care < archive);
  assert.match(detail, /Member Status:/);
  assert.match(detail, /View Attendance History/);
  assert.match(detail, /can\("members\.update"\)/);
  assert.match(detail, /can\("members\.link_account"\)/);
  assert.match(detail, /can\("members\.archive"\)/);
  assert.match(detail, /can\("attendance\.view"\)/);
  assert.match(detail, /can\("follow_ups\.view"\)/);
  assert.match(detail, /can\("follow_ups\.create"\)/);
  assert.match(detail, /grid gap-x-8 gap-y-4 sm:grid-cols-2/);
  assert.match(detail, /break-words/);
});

test('account lists expose archived status and gate restore by permission plus target scope', () => {
  const members = fs.readFileSync('app/portal/accounts/members/MemberAccountsTable.tsx', 'utf8');
  const staff = fs.readFileSync('app/portal/accounts/staff/StaffAccountsTable.tsx', 'utf8');
  assert.match(members, /useState\("active"\)/);
  assert.match(members, /TableColumnFilter label="Account Status"/);
  assert.match(members, /value: "archived", label: "Archived"/);
  assert.match(members, /account\.archivedAt && canRestore && account\.canChangeAccount/);
  assert.match(staff, /"archived"/);
  assert.match(staff, /account\.status === "archived" && canRestore && account\.canChangeAccount/);
});
