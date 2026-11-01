/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner uses CommonJS. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');

test('readAllPages returns every row in page order and uses explicit 500-row ranges', async () => {
  const { readAllPages } = loadTypeScript('lib/supabase/read-all-pages.ts', { 'server-only': {} });
  const source = Array.from({ length: 1207 }, (_, index) => index);
  const ranges = [];
  const rows = await readAllPages(async (from, to) => {
    ranges.push([from, to]);
    return { data: source.slice(from, to + 1), error: null };
  });

  assert.deepEqual(ranges, [[0, 499], [500, 999], [1000, 1499]]);
  assert.equal(rows.length, 1207);
  assert.deepEqual(Array.from(rows), source);
});

test('readAllPages propagates database errors instead of presenting partial data', async () => {
  const { readAllPages } = loadTypeScript('lib/supabase/read-all-pages.ts', { 'server-only': {} });
  await assert.rejects(
    readAllPages(async () => ({ data: null, error: { message: 'query failed' } })),
    /query failed/,
  );
});

test('all four list pages wire their scoped, ordered queries through explicit paging', () => {
  const files = [
    'app/portal/members/page.tsx',
    'app/portal/contributions/data.ts',
    'app/portal/baptisms/data.ts',
    'app/portal/services/page.tsx',
  ];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /readAllPages/);
    assert.match(source, /\.range\(from, to\)/);
    assert.match(source, /\.order\(/);
  }
  const members = readFileSync(files[0], 'utf8');
  assert.match(members, /membersQuery = membersQuery\.in\(\s*"church_branch_id",\s*branchIds,?\s*\)/);
  assert.match(members, /const activeMemberRows = members\?\.filter\(\(member\) => !member\.is_archived\) \?\? \[\]/);
  assert.match(members, /const totalMembers = activeMemberRows\.length/);
  for (const file of files.slice(1)) {
    assert.match(readFileSync(file, 'utf8'), /\.in\("church_branch_id", branchIds\)/);
  }
});

test('Auth user lookup pages through the directory and returns only requested IDs', async () => {
  const { getAuthUsersByIds } = loadTypeScript('app/portal/accounts/auth-users.ts', { 'server-only': {} });
  const allUsers = Array.from({ length: 503 }, (_, index) => ({
    id: `user-${index}`,
    email: `user-${index}@example.test`,
    created_at: '2026-01-01T00:00:00Z',
  }));
  const calls = [];
  const admin = { auth: { admin: { listUsers: async ({ page, perPage }) => {
    calls.push({ page, perPage });
    const start = (page - 1) * perPage;
    return { data: { users: allUsers.slice(start, start + perPage) }, error: null };
  } } } };

  const found = await getAuthUsersByIds(admin, ['user-1', 'user-502']);
  assert.deepEqual(calls, [{ page: 1, perPage: 500 }, { page: 2, perPage: 500 }]);
  assert.deepEqual([...found.keys()].sort(), ['user-1', 'user-502']);
  assert.equal(found.get('user-502').email, 'user-502@example.test');
});

test('account list pages use bulk Auth lookup and one scoped profile query', () => {
  const memberSource = readFileSync('app/portal/accounts/members/page.tsx', 'utf8');
  const staffSource = readFileSync('app/portal/accounts/staff/page.tsx', 'utf8');
  assert.match(memberSource, /getAuthUsersByIds\(admin, accountIds\)/);
  assert.match(memberSource, /select\("id, archived_at"\)\.in\("id", accountIds\)/);
  assert.match(memberSource, /email: user\.email/);
  assert.match(memberSource, /archivedAt: profile\.archived_at/);
  assert.match(memberSource, /targets\.get\(account\.userId\)\?\.canChangeAccount/);
  assert.doesNotMatch(memberSource, /getUserById|for\s*\([^)]*accountMap/);
  assert.match(staffSource, /getAuthUsersByIds\(admin, visibleIds\)/);
  assert.match(staffSource, /canViewStaff/);
  assert.doesNotMatch(staffSource, /getUserById/);
});

function permissionHarness({ activeAccount = { user: { id: 'user-a' } }, userRoles = [], rolePermissions = [] } = {}) {
  const reads = [];
  const cacheStore = new Map();
  const cache = (fn) => (...args) => {
    const key = JSON.stringify(args);
    if (!cacheStore.has(key)) cacheStore.set(key, fn(...args));
    return cacheStore.get(key);
  };
  const admin = { from(table) {
    let userId;
    let roleIds;
    const query = {
      select() { return query; },
      eq(column, value) { if (column === 'user_id') userId = value; return query; },
      in(column, value) { if (column === 'role_id') roleIds = value; return query; },
      then(resolve, reject) {
        reads.push(table);
        const rows = table === 'user_roles'
          ? userRoles.filter((row) => row.user_id === userId)
          : rolePermissions.filter((row) => roleIds?.includes(row.role_id));
        return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
      },
    };
    return query;
  } };
  const stubs = {
    'server-only': {},
    react: { cache },
    'next/navigation': { redirect: (path) => { throw new Error(`redirect:${path}`); } },
    '@/lib/auth': { getActiveAccount: async () => activeAccount, getCurrentUser: async () => activeAccount?.user ?? null, requireActiveAccount: async () => activeAccount },
    '@/lib/permissions': {
      PERMISSION_KEYS: ['members.view', 'reports.view'],
      isPermissionKey: (key) => ['members.view', 'reports.view'].includes(key),
      hasPermission: (permissions, key) => permissions.includes(key),
    },
    '@/lib/supabase/admin': { createAdminClient: () => admin },
  };
  return { module: loadTypeScript('lib/permissions-server.ts', stubs), reads };
}

test('permission resolution reuses same-user results and keeps users isolated', async () => {
  let activeAccount = { user: { id: 'user-a' } };
  const reads = [];
  const cacheStore = new Map();
  const cache = (fn) => (...args) => {
    const key = JSON.stringify(args);
    if (!cacheStore.has(key)) cacheStore.set(key, fn(...args));
    return cacheStore.get(key);
  };
  const roleLinks = [
    { user_id: 'user-a', role_id: 'role-a', roles: { key: 'custom_a', is_active: true } },
    { user_id: 'user-b', role_id: 'role-b', roles: { key: 'custom_b', is_active: true } },
  ];
  const permissionLinks = [
    { role_id: 'role-a', permissions: { key: 'members.view', is_active: true } },
    { role_id: 'role-b', permissions: { key: 'reports.view', is_active: true } },
  ];
  const admin = { from(table) {
    let userId;
    let roleIds;
    const query = {
      select() { return query; },
      eq(_column, value) { userId = value; return query; },
      in(_column, value) { roleIds = value; return query; },
      then(resolve, reject) {
        reads.push(table);
        const rows = table === 'user_roles'
          ? roleLinks.filter((row) => row.user_id === userId)
          : permissionLinks.filter((row) => roleIds.includes(row.role_id));
        return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
      },
    };
    return query;
  } };
  const permissionsModule = loadTypeScript('lib/permissions-server.ts', {
    'server-only': {}, react: { cache },
    'next/navigation': { redirect: (path) => { throw new Error(`redirect:${path}`); } },
    '@/lib/auth': { getActiveAccount: async () => activeAccount },
    '@/lib/permissions': {
      PERMISSION_KEYS: ['members.view', 'reports.view'],
      isPermissionKey: (key) => ['members.view', 'reports.view'].includes(key),
      hasPermission: (permissions, key) => permissions.includes(key),
    },
    '@/lib/supabase/admin': { createAdminClient: () => admin },
  });

  assert.deepEqual(await permissionsModule.getCurrentUserPermissions(), ['members.view']);
  assert.deepEqual(await permissionsModule.getCurrentUserPermissions(), ['members.view']);
  assert.equal(reads.filter((table) => table === 'user_roles').length, 1);
  assert.equal(reads.filter((table) => table === 'role_permissions').length, 1);

  activeAccount = { user: { id: 'user-b' } };
  assert.deepEqual(await permissionsModule.getCurrentUserPermissions(), ['reports.view']);
  assert.equal(reads.filter((table) => table === 'user_roles').length, 2);
  assert.equal(reads.filter((table) => table === 'role_permissions').length, 2);
});

test('archived accounts and inactive roles still receive no permissions', async () => {
  const archived = permissionHarness({ activeAccount: null });
  assert.deepEqual(Array.from(await archived.module.getCurrentUserPermissions()), []);
  assert.deepEqual(archived.reads, []);

  const inactive = permissionHarness({
    userRoles: [{ user_id: 'user-a', role_id: 'inactive-role', roles: { key: 'custom', is_active: false } }],
    rolePermissions: [{ role_id: 'inactive-role', permissions: { key: 'members.view', is_active: true } }],
  });
  assert.deepEqual(Array.from(await inactive.module.getCurrentUserPermissions()), []);
  assert.deepEqual(inactive.reads, ['user_roles']);
});
