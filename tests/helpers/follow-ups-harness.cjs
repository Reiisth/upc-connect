const assert = require('node:assert/strict');
const { loadTypeScript } = require('./load-typescript.cjs');

const id = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const ids = { a: id(1), b: id(2), actor: id(3), member: id(4), staff: id(10), overlap: id(11), archived: id(12), inactiveRole: id(13), nonstaff: id(14), record: id(20), creator: id(30) };

function followUpsHarness(options = {}) {
  const permissionKeys = options.permissions ?? ['follow_ups.view', 'follow_ups.create', 'follow_ups.update'];
  const branchIds = options.branchIds ?? [ids.a];
  const writes = [], reads = [], revalidated = [];
  const tables = {
    church_branches: [
      { id: ids.a, name: 'Main Church', code: 'MAIN', is_active: options.branchActive ?? true },
      { id: ids.b, name: 'Second Church', code: 'SECOND', is_active: true },
    ],
    members: [{ id: ids.member, first_name: 'Juan', middle_name: null, last_name: 'Cruz',
      church_branch_id: options.transferred ? ids.b : ids.a, member_status: options.memberStatus ?? 'inactive', is_archived: false, first_attendance_date: '2026-01-05' }],
    profiles: [
      { id: ids.staff, display_name: 'Staff Performer', archived_at: null },
      { id: ids.overlap, display_name: 'Staff and Member', archived_at: null },
      { id: ids.archived, display_name: 'Archived Staff', archived_at: '2026-01-01' },
      { id: ids.inactiveRole, display_name: 'Inactive Role', archived_at: null },
      { id: ids.nonstaff, display_name: 'Member Only', archived_at: null },
    ],
    user_roles: [
      { user_id: ids.staff, role_id: id(40), roles: { is_staff: true, is_active: true } },
      { user_id: ids.overlap, role_id: id(40), roles: { is_staff: true, is_active: true } },
      { user_id: ids.overlap, role_id: id(41), roles: { is_staff: false, is_active: true } },
      { user_id: ids.archived, role_id: id(40), roles: { is_staff: true, is_active: true } },
      { user_id: ids.inactiveRole, role_id: id(42), roles: { is_staff: true, is_active: false } },
      { user_id: ids.nonstaff, role_id: id(41), roles: { is_staff: false, is_active: true } },
    ],
    member_follow_ups: [{ id: ids.record, member_id: ids.member, church_branch_id: ids.a, follow_up_date: '2026-10-25',
      method: 'call', outcome: 'no_response', followed_up_by: ids.staff, notes: 'Original notes', next_follow_up_date: '2026-10-27',
      created_by: ids.creator, created_at: '2026-10-25T00:00:00Z', updated_at: '2026-10-25T00:00:00Z' }],
  };

  class Query {
    constructor(table) { this.table = table; this.predicates = []; this.orders = []; this.start = 0; this.end = Infinity; }
    value(row, key) { return key.split('.').reduce((value, part) => value?.[part], row); }
    select() { return this; }
    eq(key, value) { this.predicates.push((row) => this.value(row, key) === value); return this; }
    in(key, values) { this.predicates.push((row) => values.includes(this.value(row, key))); return this; }
    is(key, value) { return this.eq(key, value); }
    order(key, options = {}) { this.orders.push([key, options.ascending !== false]); return this; }
    range(from, to) { this.start = from; this.end = to; return this; }
    limit(value) { this.end = value - 1; return this; }
    insert(payload) { this.operation = 'insert'; this.payload = payload; return this; }
    update(payload) { this.operation = 'update'; this.payload = payload; return this; }
    result(single = false) {
      if (options.databaseError) return { data: null, error: { message: 'INTERNAL_DATABASE_DETAIL', code: '23503' } };
      let rows = tables[this.table].filter((row) => this.predicates.every((predicate) => predicate(row)));
      if (this.operation) {
        assert.equal(this.table, 'member_follow_ups', 'Follow-up workflows must never write other tables');
        if (this.operation === 'insert') {
          const row = { ...this.payload, id: id(100 + writes.length), created_at: '2026-10-27T00:00:00Z' };
          tables[this.table].push(row); rows = [row];
        } else for (const row of rows) Object.assign(row, this.payload);
        writes.push({ table: this.table, operation: this.operation, payload: this.payload });
      } else reads.push(this.table);
      rows = [...rows].sort((a, b) => {
        for (const [key, ascending] of this.orders) {
          const result = String(a[key]).localeCompare(String(b[key]));
          if (result) return ascending ? result : -result;
        }
        return 0;
      }).slice(this.start, this.end + 1);
      if (this.table === 'member_follow_ups') rows = rows.map((row) => ({ ...row,
        member: tables.members.find((m) => m.id === row.member_id) ?? null,
        branch: tables.church_branches.find((b) => b.id === row.church_branch_id) ?? null,
        performer: tables.profiles.find((p) => p.id === row.followed_up_by) ?? null,
      }));
      return { data: single ? rows[0] ?? null : rows, error: null };
    }
    maybeSingle() { return Promise.resolve(this.result(true)); }
    single() { return this.maybeSingle(); }
    then(resolve, reject) { return Promise.resolve().then(() => this.result()).then(resolve, reject); }
  }
  const admin = { from: (table) => { assert.ok(Object.hasOwn(tables, table), `Unexpected table ${table}`); return new Query(table); } };
  const access = { user: { id: ids.actor }, permissions: permissionKeys, branchIds, isSystemAdmin: options.isSystemAdmin ?? false };
  const stubs = {
    'server-only': {},
    'next/cache': { revalidatePath: (path) => revalidated.push(path) },
    'next/navigation': {
      redirect: (url) => { throw new Error(`redirect:${url}`); },
      notFound: () => { throw new Error('not-found'); },
    },
    '@/lib/permissions-server': { requirePermission: async (permission) => {
      if (options.authenticated === false) throw new Error('Login required');
      if (!permissionKeys.includes(permission)) throw new Error('Access denied');
      return { user: access.user, permissions: permissionKeys };
    } },
    '@/lib/branch-access': { getUserBranchScope: async () => ({ branchIds, isSystemAdmin: access.isSystemAdmin }) },
    '@/lib/supabase/admin': { createAdminClient: () => admin },
  };
  function form(overrides = {}) {
    const data = new FormData();
    for (const [key, value] of Object.entries({ church_branch_id: ids.a, member_id: ids.member, follow_up_date: '2026-10-27',
      method: 'visit', outcome: 'resolved', followed_up_by: ids.staff, notes: 'Contact made', next_follow_up_date: '2026-11-01', ...overrides })) data.set(key, value);
    return data;
  }
  return { access, admin, tables, writes, reads, revalidated, form, stubs,
    load: (entry, extra = {}) => loadTypeScript(entry, { ...stubs, ...extra }),
    actions: () => loadTypeScript('app/portal/follow-ups/actions.ts', stubs),
    data: () => loadTypeScript('app/portal/follow-ups/data.ts', stubs),
  };
}
module.exports = { followUpsHarness, ids, id };
