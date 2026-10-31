/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner uses CommonJS. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');

const allPermissions = ['accounts.view', 'accounts.invite', 'accounts.manage_roles', 'accounts.manage_branch_access',
  'accounts.archive', 'accounts.restore', 'accounts.update_display_name', 'members.link_account'];
const denied = /redirect:\/access-denied/;

function harness({ permissions = allPermissions, isSystemAdmin = false, branchIds = ['a'], failWrite } = {}) {
  const roles = [
    { id: 'custom', key: 'custom_staff', name: 'custom_staff', display_name: 'Custom staff', is_staff: true, is_active: true, is_system: false },
    { id: 'other', key: 'other_custom', display_name: 'Other staff', is_staff: true, is_active: true, is_system: false },
    { id: 'admin', key: 'system_admin', display_name: 'System administrator', is_staff: true, is_active: true, is_system: true },
    { id: 'member', key: 'member', display_name: 'Member', is_staff: false, is_active: true, is_system: true },
    { id: 'inactive', key: 'inactive_custom', is_staff: true, is_active: false, is_system: false },
  ];
  const db = { roles, profiles: [], user_roles: [], user_branch_access: [], account_members: [], members: [],
    church_branches: ['a', 'b', 'c'].map((id) => ({ id, name: `Branch ${id}`, code: id, is_active: true })) };
  const authUsers = [];
  const events = [];
  const access = { user: { id: 'actor' }, permissions, isSystemAdmin, branchIds };
  function account(id, { branches = [], members = [], roleIds = [], archived = false } = {}) {
    db.profiles.push({ id, display_name: `${id} display`, archived_at: archived ? 'archived' : null });
    authUsers.push({ id, email: `${id}@example.test`, created_at: '2026-01-01', email_confirmed_at: '2026-01-01' });
    db.user_roles.push(...roleIds.map((role_id) => ({ user_id: id, role_id })));
    db.user_branch_access.push(...branches.map((church_branch_id) => ({ user_id: id, church_branch_id })));
    for (const [index, branch] of members.entries()) {
      const member = { id: `${id}-member-${index}`, church_branch_id: branch, first_name: `${id}-${branch}`, last_name: 'Person', is_archived: false, account_status: 'connected', profile_status: 'completed' };
      db.members.push(member); db.account_members.push({ id: `link-${member.id}`, user_id: id, member_id: member.id, relationship: 'member' });
    }
  }
  account('local-member', { members: ['a'], roleIds: ['member'] });
  account('foreign-member', { members: ['b'], roleIds: ['member'] });
  account('local-staff', { branches: ['a'], roleIds: ['custom'] });
  account('foreign-staff', { branches: ['b'], roleIds: ['custom'] });
  account('partial', { branches: ['a', 'b'], members: ['a', 'b'], roleIds: ['custom', 'member'] });
  account('mixed', { branches: ['a'], members: ['a'], roleIds: ['custom', 'member'] });
  account('branchless', { members: ['a'], roleIds: ['custom', 'member'] });
  account('protected', { branches: ['a'], members: ['a'], roleIds: ['admin', 'member'] });

  function relation(table, row) {
    if (table === 'user_roles') return { ...row, roles: roles.find((role) => role.id === row.role_id) ?? null };
    if (table === 'account_members') return { ...row, members: db.members.find((member) => member.id === row.member_id) ?? null };
    if (table === 'profiles') return { ...row, user_roles: db.user_roles.filter((link) => link.user_id === row.id).map((link) => ({ role: roles.find((role) => role.id === link.role_id) })) };
    return row;
  }
  function value(row, key) { return key.split('.').reduce((item, part) => item?.[part], row); }
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.write = null; this.bounds = null; }
    select() { return this; }
    eq(key, expected) { this.filters.push((row) => value(relation(this.table, row), key) === expected); return this; }
    in(key, values) { this.filters.push((row) => values.includes(value(relation(this.table, row), key))); return this; }
    order() { return this; }
    range(from, to) { this.bounds = [from, to]; return this; }
    update(payload) { this.write = ['update', payload]; return this; }
    upsert(payload) { this.write = ['upsert', payload]; return this; }
    insert(payload) { this.write = ['insert', payload]; return this; }
    delete() { this.write = ['delete', null]; return this; }
    result(single = false) {
      const source = db[this.table]; assert.ok(source, `Unexpected table ${this.table}`);
      let selected = source.filter((row) => this.filters.every((filter) => filter(row)));
      events.push({ type: this.write ? this.write[0] : 'read', table: this.table, ids: selected.map((row) => row.id ?? row.user_id), payload: this.write?.[1] });
      if (this.write) {
        if (failWrite === this.table) return { data: null, error: { message: 'write failure' } };
        const [kind, payload] = this.write;
        if (kind === 'delete') db[this.table] = source.filter((row) => !selected.includes(row));
        if (kind === 'update') selected.forEach((row) => Object.assign(row, payload));
        if (kind === 'upsert' || kind === 'insert') {
          for (const item of Array.isArray(payload) ? payload : [payload]) {
            const existing = source.find((row) => this.table === 'profiles' ? row.id === item.id :
              row.user_id === item.user_id && (this.table === 'user_roles' ? row.role_id === item.role_id : row.church_branch_id === item.church_branch_id));
            if (existing) Object.assign(existing, item);
            else source.push({ ...(this.table === 'profiles' ? { archived_at: null } : {}), ...item });
          }
        }
      }
      if (this.bounds) selected = selected.slice(this.bounds[0], this.bounds[1] + 1);
      const data = selected.map((row) => relation(this.table, row));
      return { data: single ? data[0] ?? null : data, error: null };
    }
    maybeSingle() { return Promise.resolve(this.result(true)); }
    single() { return Promise.resolve(this.result(true)); }
    then(resolve, reject) { return Promise.resolve(this.result()).then(resolve, reject); }
  }
  const admin = { from: (table) => new Query(table), auth: { admin: {
    getUserById: async (id) => { events.push({ type: 'auth-read', id }); return { data: { user: authUsers.find((user) => user.id === id) }, error: null }; },
    listUsers: async () => { events.push({ type: 'auth-lookup' }); return { data: { users: authUsers }, error: null }; },
    inviteUserByEmail: async (email) => { events.push({ type: 'invite', email }); const user = { id: 'new-user', email }; authUsers.push(user); return { data: { user }, error: null }; },
  } } };
  function redirect(url) { const error = new Error(`redirect:${url}`); error.redirect = true; throw error; }
  const stubs = {
    'server-only': {}, 'next/navigation': { redirect, notFound: () => redirect('/not-found'), unstable_rethrow: (error) => { if (error.redirect) throw error; } },
    'next/cache': { revalidatePath() {} },
    'next/link': { __esModule: true, default: () => null },
    '@/lib/permissions-server': { requirePermission: async (permission) => { if (!permissions.includes(permission)) redirect('/access-denied'); return { user: access.user, permissions }; } },
    '@/lib/branch-access': { getUserBranchScope: async () => ({ branchIds, isSystemAdmin }) },
    '@/lib/supabase/admin': { createAdminClient: () => admin },
  };
  const load = (file) => loadTypeScript(file, stubs);
  async function content(file, userId) {
    const shell = await load(file).default({ params: Promise.resolve({ userId }) });
    return shell.props.children.type(shell.props.children.props);
  }
  function invitation({ email = 'new@example.test', roleIds = ['custom'], branches = ['a'] } = {}) {
    const data = new FormData(); data.set('display_name', 'Invited name'); data.set('email', email);
    roleIds.forEach((id) => data.append('role_ids', id)); branches.forEach((id) => data.append('branch_ids', id)); return data;
  }
  return { db, access, admin, events, load, content, invitation, account };
}

test('target scope separates member/staff views, protects branchless/admin targets and requires full mixed coverage for whole-account changes', async () => {
  const h = harness(); const api = h.load('app/portal/accounts/target-scope.ts');
  const scopes = await api.getAccountTargetScopes(h.access, h.admin);
  assert.equal(scopes.get('local-member').canViewMembers, true);
  assert.equal(scopes.has('foreign-member'), false);
  assert.equal(scopes.has('foreign-staff'), false);
  assert.equal(scopes.get('local-staff').canViewStaff, true);
  assert.equal(scopes.get('partial').canViewStaff, true);
  assert.equal(scopes.get('partial').canChangeAccount, false);
  assert.equal(scopes.get('mixed').canChangeAccount, true);
  assert.equal(scopes.get('branchless').canViewStaff, false);
  assert.equal(scopes.get('branchless').canChangeAccount, false);
  assert.equal(scopes.get('protected').canViewMembers, false);
});

test('member and staff details reject out-of-scope IDs before reading Auth identities', async () => {
  const h = harness({ permissions: ['accounts.view'] });
  await assert.rejects(h.content('app/portal/accounts/[userId]/page.tsx', 'foreign-member'), denied);
  await assert.rejects(h.content('app/portal/accounts/staff/[userId]/page.tsx', 'foreign-staff'), denied);
  assert.equal(h.events.some((event) => event.type === 'auth-read'), false);
});

test('server lists and partial details return no unrelated names or hidden branches', async () => {
  const h = harness({ permissions: ['accounts.view'] });
  for (const file of ['app/portal/accounts/members/page.tsx', 'app/portal/accounts/staff/page.tsx']) {
    const tree = JSON.stringify(await h.content(file));
    assert.ok(!tree.includes('foreign-member')); assert.ok(!tree.includes('foreign-staff'));
    assert.ok(!tree.includes('Branch b')); assert.ok(!tree.includes('partial-b'));
  }
  const detail = JSON.stringify(await h.content('app/portal/accounts/[userId]/page.tsx', 'partial'));
  assert.ok(detail.includes('partial-a')); assert.ok(!detail.includes('partial-b'));
  const staff = JSON.stringify(await h.content('app/portal/accounts/staff/[userId]/page.tsx', 'partial'));
  assert.ok(!staff.includes('Branch b')); assert.ok(staff.includes('"canManageRoles":false'));
  assert.ok(!h.events.some((event) => event.type === 'auth-read' && event.id.startsWith('foreign')));
});

test('global admin scope permits global targets without bypassing operation permissions', async () => {
  const h = harness({ isSystemAdmin: true });
  assert.ok(await h.content('app/portal/accounts/[userId]/page.tsx', 'foreign-member'));
  await h.load('app/portal/accounts/staff/actions.ts').updateStaffDisplayName('foreign-staff', 'Renamed');
  assert.equal(h.db.profiles.find((row) => row.id === 'foreign-staff').display_name, 'Renamed');
  const noPermission = harness({ isSystemAdmin: true, permissions: [] });
  await assert.rejects(noPermission.load('app/portal/accounts/staff/actions.ts').archiveStaffAccount('foreign-staff'), denied);
});

test('invite-only rejects posted role and branch grants before any Auth invite or mutation', async () => {
  for (const intent of [{ roleIds: ['custom'], branches: [] }, { roleIds: [], branches: ['a'] }]) {
    const h = harness({ permissions: ['accounts.invite'] });
    const result = await h.load('app/portal/accounts/staff/actions.ts').createStaffAccount(h.invitation(intent));
    assert.equal(result.success, false); assert.match(result.error, /requires accounts.manage/);
    assert.equal(h.events.some((event) => event.type === 'invite' || ['upsert', 'insert', 'update'].includes(event.type)), false);
  }
});

test('invite plus role permission promotes an in-scope existing account without overwriting its name/member role', async () => {
  const h = harness({ permissions: ['accounts.invite', 'accounts.manage_roles'] });
  const result = await h.load('app/portal/accounts/staff/actions.ts').createStaffAccount(h.invitation({ email: 'mixed@example.test', roleIds: ['other'], branches: [] }));
  assert.equal(result.success, true);
  assert.ok(h.db.user_roles.some((row) => row.user_id === 'mixed' && row.role_id === 'other'));
  assert.ok(h.db.user_roles.some((row) => row.user_id === 'mixed' && row.role_id === 'member'));
  assert.equal(h.db.profiles.find((row) => row.id === 'mixed').display_name, 'mixed display');
  assert.equal(h.events.some((event) => event.type === 'invite'), false);
});

test('invite plus branch permission adds only an actor branch to an existing staff target', async () => {
  const h = harness({ permissions: ['accounts.invite', 'accounts.manage_branch_access'], branchIds: ['a', 'c'] });
  const result = await h.load('app/portal/accounts/staff/actions.ts').createStaffAccount(h.invitation({ email: 'partial@example.test', roleIds: [], branches: ['c'] }));
  assert.equal(result.success, true);
  assert.deepEqual(h.db.user_branch_access.filter((row) => row.user_id === 'partial').map((row) => row.church_branch_id).sort(), ['a', 'b', 'c']);
});

test('grantable staff roles use metadata: custom active allowed; system_admin, inactive and member rejected for delegated actor', async () => {
  for (const roleId of ['admin', 'inactive', 'member']) {
    const h = harness(); const api = h.load('app/portal/accounts/staff/actions.ts');
    await assert.rejects(api.updateStaffRoles('local-staff', [roleId]), /invalid|not staff/);
    const result = await api.createStaffAccount(h.invitation({ roleIds: [roleId] }));
    assert.equal(result.success, false); assert.equal(h.events.some((event) => event.type === 'invite'), false);
  }
  const h = harness(); await h.load('app/portal/accounts/staff/actions.ts').updateStaffRoles('mixed', ['custom', 'other']);
  assert.ok(h.db.user_roles.some((row) => row.user_id === 'mixed' && row.role_id === 'member'));
});

test('active system administrator may grant system_admin through invitation and role editor', async () => {
  const h = harness({ isSystemAdmin: true }); const api = h.load('app/portal/accounts/staff/actions.ts');
  await api.updateStaffRoles('foreign-staff', ['custom', 'admin']);
  assert.ok(h.db.user_roles.some((row) => row.user_id === 'foreign-staff' && row.role_id === 'admin'));
  const result = await api.createStaffAccount(h.invitation({ roleIds: ['admin'], branches: [] }));
  assert.equal(result.success, true);
});

test('branch editing preserves omitted hidden assignments and rejects new foreign assignments or targets', async () => {
  const h = harness(); const api = h.load('app/portal/accounts/staff/actions.ts');
  await api.updateStaffBranchAccessFromAccount('partial', []);
  assert.deepEqual(h.db.user_branch_access.filter((row) => row.user_id === 'partial').map((row) => row.church_branch_id), ['b']);
  await assert.rejects(api.updateStaffBranchAccessFromAccount('local-staff', ['a', 'b']), /scope/);
  await assert.rejects(api.updateStaffBranchAccessFromAccount('foreign-staff', ['a']), denied);
});

test('archive, restore, display-name and role edits reject foreign and partially covered mixed accounts', async () => {
  const h = harness(); const staff = h.load('app/portal/accounts/staff/actions.ts'); const member = h.load('app/portal/accounts/members/actions.ts');
  for (const id of ['foreign-staff', 'partial', 'protected']) {
    await assert.rejects(staff.archiveStaffAccount(id), denied);
    await assert.rejects(staff.restoreStaffAccount(id), denied);
    await assert.rejects(staff.updateStaffDisplayName(id, 'Tampered'), denied);
    await assert.rejects(staff.updateStaffRoles(id, ['other']), denied);
    await assert.rejects(member.archiveMemberAccount(id), denied);
    await assert.rejects(member.restoreMemberAccount(id), denied);
  }
  assert.equal(h.events.some((event) => ['upsert', 'insert', 'update', 'delete'].includes(event.type)), false);
});

test('scoped archive/restore remains reversible and final-admin protections remain enforced', async () => {
  const h = harness(); const api = h.load('app/portal/accounts/staff/actions.ts');
  await api.archiveStaffAccount('mixed'); await api.restoreStaffAccount('mixed');
  assert.equal(h.db.profiles.find((row) => row.id === 'mixed').archived_at, null);
  assert.equal(h.db.user_roles.filter((row) => row.user_id === 'mixed').length, 2);
  const global = harness({ isSystemAdmin: true }); const adminApi = global.load('app/portal/accounts/staff/actions.ts');
  await assert.rejects(adminApi.archiveStaffAccount('protected'), /last active system administrator/);
  await assert.rejects(adminApi.updateStaffRoles('protected', ['custom']), /last active system administrator/);
});

test('all target/role/branch prevalidation precedes invitations; new staff requires complete authorized provisioning', async () => {
  for (const intent of [{ branches: ['b'] }, { roleIds: ['inactive'] }, { roleIds: [] }, { branches: [] }]) {
    const h = harness(); const result = await h.load('app/portal/accounts/staff/actions.ts').createStaffAccount(h.invitation(intent));
    assert.equal(result.success, false); assert.equal(h.events.some((event) => event.type === 'invite'), false);
  }
  const h = harness();
  await assert.rejects(h.load('app/portal/accounts/staff/actions.ts').createStaffAccount(h.invitation({ email: 'foreign-staff@example.test' })), denied);
  assert.equal(h.events.some((event) => event.type === 'invite'), false);
  const promotion = harness({ permissions: ['accounts.invite', 'accounts.manage_roles'] });
  const result = await promotion.load('app/portal/accounts/staff/actions.ts').createStaffAccount(
    promotion.invitation({ email: 'local-member@example.test', roleIds: ['custom'], branches: [] }));
  assert.equal(result.success, false); assert.match(result.error, /active branch/);
  assert.equal(promotion.db.user_roles.some((row) => row.user_id === 'local-member' && row.role_id === 'custom'), false);
});

test('new invitation provisions authorized custom staff and reports a post-invite failure without deleting identities', async () => {
  const h = harness(); const result = await h.load('app/portal/accounts/staff/actions.ts').createStaffAccount(h.invitation());
  assert.equal(result.success, true); assert.equal(result.created, true);
  const inviteIndex = h.events.findIndex((event) => event.type === 'invite');
  assert.ok(h.events.slice(0, inviteIndex).some((event) => event.table === 'church_branches'));
  assert.ok(h.db.user_roles.some((row) => row.user_id === 'new-user' && row.role_id === 'custom'));
  const failing = harness({ failWrite: 'user_roles' });
  const failure = await failing.load('app/portal/accounts/staff/actions.ts').createStaffAccount(failing.invitation());
  assert.equal(failure.success, false); assert.match(failure.error, /invitation was created/);
  assert.ok(failing.db.user_branch_access.some((row) => row.user_id === 'new-user'));
  assert.ok(!failing.events.some((event) => event.type === 'delete'));
});

test('canonical member linking still requires its permission and validates target member branch before writes', async () => {
  const noPermission = harness({ permissions: [] });
  await assert.rejects(noPermission.load('app/portal/members/actions.ts').disconnectMember('local-member-member-0'), denied);
  const h = harness();
  await assert.rejects(h.load('app/portal/members/actions.ts').inviteMembers(['foreign-member-member-0'], 'new@example.test'), /branches assigned/);
  assert.equal(h.events.some((event) => event.type === 'invite'), false);
});

test('legacy Administration pages share target restrictions and staff metadata classification', async () => {
  const h = harness();
  await assert.rejects(h.content('app/portal/administration/staff-branch-access/[userId]/page.tsx', 'foreign-staff'), denied);
  const tree = JSON.stringify(await h.content('app/portal/administration/staff-branch-access/page.tsx'));
  assert.ok(!tree.includes('foreign-staff')); assert.ok(!tree.includes('local-member display'));
});

test('missing permission hides invitation editors and filtered roles never expose system_admin to delegated actors', async () => {
  const h = harness({ permissions: ['accounts.invite'] });
  const tree = JSON.stringify(await h.content('app/portal/accounts/staff/new/page.tsx'));
  assert.ok(tree.includes('"canManageRoles":false')); assert.ok(tree.includes('"canManageBranches":false'));
  const manager = harness();
  const allowed = JSON.stringify(await manager.content('app/portal/accounts/staff/new/page.tsx'));
  assert.ok(allowed.includes('custom_staff')); assert.ok(!allowed.includes('"key":"system_admin"'));
});

test('full-coverage authorization reads beyond the first relationship page and fails closed on unknown member branches', async () => {
  const h = harness();
  for (let index = 0; index < 505; index++) {
    const id = `extra-${index}`;
    h.db.members.push({ id, church_branch_id: index === 504 ? 'b' : 'a' });
    h.db.account_members.push({ id: `link-${id}`, user_id: 'local-staff', member_id: id, relationship: 'member' });
  }
  const api = h.load('app/portal/accounts/target-scope.ts');
  assert.equal((await api.getAccountTargetScopes(h.access, h.admin, 'local-staff')).get('local-staff').canChangeAccount, false);
  h.account('unknown-branch', { members: ['a', null], roleIds: ['member'] });
  assert.equal((await api.getAccountTargetScopes(h.access, h.admin, 'unknown-branch')).get('unknown-branch').canChangeAccount, false);
});

test('inactive administrator assignments remain protected and a manager with no branches has no delegated scope', async () => {
  const h = harness(); h.db.roles.find((role) => role.key === 'system_admin').is_active = false;
  await assert.rejects(h.load('app/portal/accounts/staff/actions.ts').updateStaffRoles('protected', ['custom']), denied);
  const empty = harness({ branchIds: [] });
  assert.equal((await empty.load('app/portal/accounts/target-scope.ts').getAccountTargetScopes(empty.access, empty.admin)).size, 0);
});
