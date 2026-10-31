/* eslint-disable @typescript-eslint/no-require-imports -- Node test harness uses CommonJS. */
const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');

// Execute the real auth, permission, ownership, page and action modules. Only
// framework boundaries and Supabase transport are replaced by mutable fixtures.
function harness(options = {}) {
  const user = { id: 'current', email: 'owner@example.test' };
  const db = {
    profiles: [{ id: user.id, archived_at: null }],
    user_roles: [{ user_id: user.id, role_id: 'custom', roles: { name: 'custom_care', key: 'custom_care', is_active: true } }],
    role_permissions: (options.permissions ?? ['members.view', 'profile.view', 'profile.update'])
      .map((key) => ({ role_id: 'custom', permissions: { key, is_active: true } })),
    account_members: [{ user_id: user.id, member_id: 'owned', relationship: 'member' }],
    members: [{ id: 'owned', first_name: 'Linked', last_name: 'Person', profile_status: 'completed', is_archived: false }],
    church_branches: [], departments: [], member_custom_field_values: [],
  };
  const calls = { writes: [], reads: [], passwords: [], signIns: [] };
  let authenticated = true;
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.payload = null; }
    select() { return this; }
    eq(key, value) { this.filters.push((row) => key.includes('.') || row[key] === value); return this; }
    in(key, values) { this.filters.push((row) => values.includes(row[key])); return this; }
    order() { return this; }
    update(payload) { this.payload = payload; return this; }
    upsert(payload) { this.payload = payload; return this; }
    result(single = false) {
      calls.reads.push(this.table);
      if (options.profileFailure && this.table === 'profiles') return { data: null, error: { message: 'private database failure' } };
      const rows = (db[this.table] ?? []).filter((row) => this.filters.every((filter) => filter(row)));
      if (this.payload) { calls.writes.push({ table: this.table, payload: this.payload }); rows.forEach((row) => Object.assign(row, this.payload)); }
      return { data: single ? rows[0] ?? null : rows, error: null };
    }
    maybeSingle() { return Promise.resolve(this.result(true)); }
    single() { return Promise.resolve(this.result(true)); }
    then(resolve, reject) { return Promise.resolve(this.result()).then(resolve, reject); }
  }
  const client = {
    from: (table) => new Query(table),
    auth: {
      getUser: async () => ({ data: { user: authenticated ? user : null }, error: null }),
      verifyOtp: async () => ({ error: null }),
      updateUser: async (payload) => { calls.passwords.push(payload); return { error: null }; },
      signInWithPassword: async (payload) => {
        calls.signIns.push(payload);
        return { data: { user }, error: payload.password === 'wrong' ? { message: 'invalid' } : null };
      },
      admin: { getUserById: async () => ({ data: { user }, error: null }) },
    },
  };
  const stubs = {
    'server-only': {},
    // No cross-request cache in this harness: each call observes current state.
    react: { ...React, cache: (fn) => fn },
    'next/navigation': { redirect: (path) => { throw new Error(`REDIRECT:${path}`); } },
    'next/cache': { revalidatePath() {} },
    'next/image': { __esModule: true, default: () => null },
    'next/link': { __esModule: true, default: () => null },
    '@/lib/supabase/server': { createClient: async () => client },
    '@/lib/supabase/admin': { createAdminClient: () => client },
    '@/lib/member-fields': { getMemberFieldDefinitions: async () => [] },
    '../../../components/MemberProfileForm': { __esModule: true, default: () => null },
    '../../components/MemberProfileForm': { __esModule: true, default: () => null },
    '../../components/MemberCard': { __esModule: true, default: () => null },
    './EditProfileButton': { __esModule: true, default: () => null },
    './ChangePasswordForm': { __esModule: true, default: () => null },
    './PortalNavigation': { __esModule: true, default: () => null },
  };
  const load = (file) => loadTypeScript(file, stubs);
  async function content(file, props = {}) {
    const shell = await load(file).default(props);
    return shell.props.children.type(shell.props.children.props);
  }
  return { db, calls, load, content, user, logout: () => { authenticated = false; } };
}

const denied = /REDIRECT:\/access-denied/;

test('real permission resolver authorizes active custom roles and excludes inactive roles/permissions and unknown keys', async () => {
  const h = harness(); const api = h.load('lib/permissions-server.ts');
  assert.equal((await api.requirePermission('members.view')).user.id, 'current');
  h.db.role_permissions.push({ role_id: 'custom', permissions: { key: 'reports.view', is_active: false } });
  h.db.role_permissions.push({ role_id: 'custom', permissions: { key: 'invented.key', is_active: true } });
  assert.deepEqual(Array.from(await api.getCurrentUserPermissions()), ['members.view', 'profile.update', 'profile.view']);
  h.db.user_roles[0].roles.is_active = false;
  assert.equal((await api.getCurrentUserPermissions()).length, 0);
  await assert.rejects(api.requirePermission('members.view'), denied);
});

test('archived session has no effective permissions; restore reuses preserved grants', async () => {
  const h = harness(); const api = h.load('lib/permissions-server.ts');
  h.db.profiles[0].archived_at = '2026-10-31';
  assert.equal((await api.getCurrentUserPermissions()).length, 0);
  await assert.rejects(api.requirePermission('members.view'), denied);
  h.db.profiles[0].archived_at = null;
  assert.ok((await api.getCurrentUserPermissions()).includes('members.view'));
  assert.equal(h.db.user_roles.length, 1); assert.equal(h.db.account_members.length, 1);
});

test('missing profiles and profile lookup errors fail closed; unauthenticated guards use login', async () => {
  for (const options of [{}, { profileFailure: true }]) {
    const h = harness(options); if (!options.profileFailure) h.db.profiles = [];
    await assert.rejects(h.load('lib/auth.ts').requireActiveAccount(), denied);
    assert.equal((await h.load('lib/permissions-server.ts').getCurrentUserPermissions()).length, 0);
  }
  const h = harness(); h.logout();
  await assert.rejects(h.load('lib/permissions-server.ts').requirePermission('members.view'), /REDIRECT:\/login/);
});

test('legacy role loader excludes inactive roles and archived accounts', async () => {
  const h = harness(); const auth = h.load('lib/auth.ts');
  assert.deepEqual(Array.from(await auth.getCurrentUserRoles()), ['custom_care']);
  h.db.user_roles[0].roles.is_active = false;
  assert.equal((await auth.getCurrentUserRoles()).length, 0);
  h.db.user_roles[0].roles.is_active = true; h.db.profiles[0].archived_at = 'archived';
  assert.equal((await auth.getCurrentUserRoles()).length, 0);
});

test('active custom-role account enters portal and My Account without built-in role names', async () => {
  const h = harness();
  await assert.rejects(h.load('app/portal/page.tsx').default(), /REDIRECT:\/portal\/members/);
  assert.ok(await h.content('app/portal/account/page.tsx'));
  const noGrants = harness({ permissions: [] });
  assert.ok(await noGrants.content('app/portal/account/page.tsx'));
  await assert.rejects(noGrants.load('app/portal/page.tsx').default(), denied);
});

test('archived accounts including system_admin cannot render portal shell, entry, Profile or My Account', async () => {
  for (const role of ['custom_care', 'system_admin']) {
    const h = harness(); h.db.user_roles[0].roles.key = role; h.db.profiles[0].archived_at = 'archived';
    await assert.rejects(h.load('app/portal/page.tsx').default(), denied);
    for (const file of ['app/portal/layout.tsx', 'app/portal/profile/page.tsx', 'app/portal/account/page.tsx']) {
      await assert.rejects(h.content(file), denied);
    }
  }
});

test('profile permission and linked ownership are both required before member reads', async () => {
  const h = harness(); const access = h.load('app/portal/profile/access.ts');
  assert.equal((await access.requireOwnedProfile('owned', 'profile.view')).user.id, 'current');
  assert.ok(await access.requireOwnedProfile('owned', 'profile.update'));
  await assert.rejects(access.requireOwnedProfile('other', 'profile.view'), denied);
  for (const permission of ['profile.view', 'profile.update']) {
    const noGrant = harness({ permissions: [] });
    await assert.rejects(noGrant.load('app/portal/profile/access.ts').requireOwnedProfile('owned', permission), denied);
    assert.ok(!noGrant.calls.reads.includes('members'));
  }
});

test('actual profile detail/edit pages enforce view/update independently and reject unrelated profiles', async () => {
  const view = 'app/portal/profile/[memberId]/page.tsx';
  const edit = 'app/portal/profile/[memberId]/edit/page.tsx';
  for (const [file, permission] of [[view, 'profile.view'], [edit, 'profile.update']]) {
    const h = harness({ permissions: [permission] });
    assert.ok(await h.content(file, { params: Promise.resolve({ memberId: 'owned' }) }));
    await assert.rejects(h.content(file, { params: Promise.resolve({ memberId: 'other' }) }), denied);
    const noGrant = harness({ permissions: [] });
    await assert.rejects(noGrant.content(file, { params: Promise.resolve({ memberId: 'owned' }) }), denied);
  }
});

function findAction(element) {
  if (!element || typeof element !== 'object') return null;
  if (typeof element.props?.action === 'function') return element.props.action;
  const children = React.Children.toArray(element.props?.children);
  for (const child of children) { const action = findAction(child); if (action) return action; }
  return null;
}

test('completion and edit actions reauthorize after rendering, including ownership removal, permission revocation and archive', async () => {
  for (const file of ['app/portal/profile/[memberId]/page.tsx', 'app/portal/profile/[memberId]/edit/page.tsx']) {
    for (const revoke of ['archive', 'permission', 'ownership']) {
      const h = harness(); h.db.members[0].profile_status = 'incomplete';
      const tree = await h.content(file, { params: Promise.resolve({ memberId: 'owned' }) });
      const action = findAction(tree); assert.equal(typeof action, 'function');
      if (revoke === 'archive') h.db.profiles[0].archived_at = 'archived';
      if (revoke === 'permission') h.db.role_permissions = h.db.role_permissions.filter((row) => row.permissions.key !== 'profile.update');
      if (revoke === 'ownership') h.db.account_members = [];
      await assert.rejects(action(new FormData()), denied);
      assert.equal(h.calls.writes.length, 0);
    }
  }
});

test('view-only incomplete profile does not expose a completion action', async () => {
  const h = harness({ permissions: ['profile.view'] }); h.db.members[0].profile_status = 'incomplete';
  assert.equal(findAction(await h.content('app/portal/profile/[memberId]/page.tsx', { params: Promise.resolve({ memberId: 'owned' }) })), null);
});

test('authorized completion and edit actions preserve successful owned writes', async () => {
  for (const file of ['app/portal/profile/[memberId]/page.tsx', 'app/portal/profile/[memberId]/edit/page.tsx']) {
    const h = harness(); h.db.members[0].profile_status = 'incomplete';
    const action = findAction(await h.content(file, { params: Promise.resolve({ memberId: 'owned' }) }));
    const form = new FormData(); form.set('first_name', 'Updated'); form.set('last_name', 'Person');
    await assert.rejects(action(form), /REDIRECT:\/portal\/profile/);
    assert.equal(h.calls.writes[0].table, 'members');
    assert.equal(h.db.members[0].first_name, 'Updated');
  }
});

test('profile update does not imply profile view and profile view does not imply edit', async () => {
  for (const [permission, file] of [
    ['profile.update', 'app/portal/profile/[memberId]/page.tsx'],
    ['profile.view', 'app/portal/profile/[memberId]/edit/page.tsx'],
  ]) {
    const h = harness({ permissions: [permission] });
    await assert.rejects(h.content(file, { params: Promise.resolve({ memberId: 'owned' }) }), denied);
  }
});

test('setup routes custom operational, profile-only and multi-role accounts using real effective permissions', async () => {
  for (const [permissions, destination] of [
    [['reports.view'], '/portal'], [['profile.view'], '/portal/profile'],
    [['members.view', 'profile.view'], '/portal'], [[], '/access-denied'],
  ]) {
    const h = harness({ permissions });
    if (permissions.length === 2) h.db.user_roles.push({ user_id: 'current', role_id: 'member', roles: { key: 'member', name: 'member', is_active: true } });
    assert.equal((await h.load('app/set-password/actions.ts').setAccountPassword('password123')).destination, destination);
    assert.equal(h.calls.passwords.length, destination === '/access-denied' ? 0 : 1);
  }
});

test('setup rejects profile-only access without ownership, inactive roles and archived admins before password writes', async () => {
  const unlinked = harness({ permissions: ['profile.view'] }); unlinked.db.account_members = [];
  assert.equal((await unlinked.load('app/set-password/actions.ts').setAccountPassword('password123')).destination, '/access-denied');
  const inactive = harness(); inactive.db.user_roles[0].roles.is_active = false;
  assert.equal((await inactive.load('app/set-password/actions.ts').setAccountPassword('password123')).destination, '/access-denied');
  const archived = harness(); archived.db.user_roles[0].roles.key = 'system_admin'; archived.db.profiles[0].archived_at = 'archived';
  await assert.rejects(archived.load('app/set-password/actions.ts').setAccountPassword('password123'), denied);
  assert.equal(archived.calls.passwords.length, 0);
});

test('invite confirmation checks account state before entering password setup', async () => {
  for (const archived of [false, true]) {
    const h = harness(); if (archived) h.db.profiles[0].archived_at = 'archived';
    await assert.rejects(h.load('app/auth/confirm/route.ts').GET({
      url: 'https://example.test/auth/confirm?token_hash=fixture&type=invite',
    }), archived ? denied : /REDIRECT:\/set-password/);
  }
});

test('permission loader cannot resolve another account through a supplied user ID', async () => {
  const h = harness();
  assert.equal((await h.load('lib/permissions-server.ts').getCurrentUserPermissions('unrelated')).length, 0);
});

test('server password change retains reauthentication and blocks an already-open archived account form', async () => {
  const h = harness({ permissions: [] }); const api = h.load('app/portal/account/actions.ts');
  assert.ok((await api.changeOwnPassword('wrong', 'newpassword123')).error);
  assert.equal(h.calls.passwords.length, 0);
  assert.equal((await api.changeOwnPassword('oldpassword123', 'newpassword123')).success, true);
  assert.equal(h.calls.signIns[1].email, h.user.email);
  h.db.profiles[0].archived_at = 'archived';
  await assert.rejects(api.changeOwnPassword('oldpassword123', 'newpassword123'), denied);
  assert.equal(h.calls.passwords.length, 1);
});

test('existing last-active-admin safeguard still refuses archiving the final admin', async () => {
  const h = harness();
  h.db.user_roles[0].roles = { key: 'system_admin', is_active: true };
  const api = h.load('app/portal/accounts/access.ts');
  await assert.rejects(api.assertSystemAdminChangeSafe({ from: (table) => ({
    select() { return this; }, eq() { return this; }, in() { return this; },
    then(resolve) { return Promise.resolve({ data: table === 'user_roles' ? [{ user_id: 'current' }] : h.db.profiles, error: null }).then(resolve); },
  }) }, 'current', 'current', 'archive'), /last active system administrator/);
});
