/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS regression transport. */
const assert = require('node:assert/strict');
const React = require('react');
const { loadTypeScript } = require('./load-typescript.cjs');

const permissions = ['contributions.view', 'contributions.create', 'contributions.update', 'baptisms.view',
  'baptisms.water.create', 'baptisms.water.update', 'baptisms.holy_ghost.create', 'baptisms.holy_ghost.update'];

exports.historicalHarness = function historicalHarness(options = {}) {
  const user = { id: 'actor', email: 'staff@example.test' };
  const db = {
    profiles: [{ id: 'actor', archived_at: options.archivedAccount ? '2026-10-31' : null, display_name: 'Custom Staff' }, { id: 'original', archived_at: null, display_name: 'Original Recorder' }],
    user_roles: [{ user_id: user.id, role_id: 'custom', roles: { key: options.isSystemAdmin ? 'system_admin' : 'custom_records_clerk', is_active: options.inactiveRole !== true } }],
    role_permissions: (options.permissions ?? permissions).map((key) => ({ role_id: 'custom', permissions: { key, is_active: true } })),
    user_branch_access: (options.branchIds ?? ['a']).map((church_branch_id) => ({ user_id: user.id, church_branch_id })),
    church_branches: [{ id: 'a', name: 'Historical Church', code: 'A', is_active: options.branchActive !== false }, { id: 'b', name: 'Other Church', code: 'B', is_active: true }],
    members: [
      { id: 'historical', first_name: 'Historical', last_name: 'Member', church_branch_id: 'a', member_status: 'active', is_archived: false, first_attendance_date: null },
      { id: 'current', first_name: 'Current', last_name: 'Member', church_branch_id: 'a', member_status: 'active', is_archived: false },
      { id: 'replacement', first_name: 'Replacement', last_name: 'Member', church_branch_id: 'a', member_status: 'active', is_archived: false },
      { id: 'foreign', first_name: 'Foreign', last_name: 'Private', church_branch_id: 'b', member_status: 'active', is_archived: false },
      { id: 'archived', first_name: 'Archived', last_name: 'Member', church_branch_id: 'a', member_status: 'active', is_archived: true },
      { id: 'inactive', first_name: 'Inactive', last_name: 'Member', church_branch_id: 'a', member_status: 'inactive', is_archived: false },
    ],
    services: [
      { id: 'service', name: 'Original Service', service_date: '2026-10-25', church_branch_id: 'a', status: 'completed' },
      { id: 'new-service', name: 'Another Service', service_date: '2026-10-24', church_branch_id: 'a', status: 'ongoing' },
      { id: 'foreign-service', name: 'Foreign Service', service_date: '2026-10-25', church_branch_id: 'b', status: 'completed' },
      { id: 'cancelled-service', name: 'Cancelled Service', service_date: '2026-10-25', church_branch_id: 'a', status: 'cancelled' },
    ],
    financial_contributions: [
      { id: 'contribution', church_branch_id: 'a', member_id: 'historical', service_id: 'service', recorded_by: 'original', contribution_type: 'tithe', amount: '0.10', contribution_date: '2026-10-20', payment_method: 'cash', notes: 'Original' },
      { id: 'anonymous', church_branch_id: 'a', member_id: null, service_id: null, recorded_by: 'original', contribution_type: 'love_offering', amount: '0.20', contribution_date: '2026-10-20', payment_method: 'cash', notes: null },
      { id: 'foreign-contribution', church_branch_id: 'b', member_id: 'foreign', service_id: null, recorded_by: null, contribution_type: 'other', amount: '99.99', contribution_date: '2026-10-20', payment_method: 'cash', notes: null },
    ],
    baptism_records: [
      { id: 'water', church_branch_id: 'a', member_id: 'historical', baptism_type: 'water', baptism_date: '2026-10-20', officiated_by: 'Original Pastor', location: null, recorded_by: 'original', notes: 'Original' },
      { id: 'holy-ghost', church_branch_id: 'a', member_id: 'historical', baptism_type: 'holy_ghost', baptism_date: null, officiated_by: null, location: null, recorded_by: 'original', notes: null },
      { id: 'foreign-baptism', church_branch_id: 'b', member_id: 'foreign', baptism_type: 'water', baptism_date: null, officiated_by: null, location: null, recorded_by: null, notes: null },
    ],
    attendance_records: [{ id: 'attendance', service_id: 'service', member_id: 'historical', attendance_status: 'present', recorded_by: 'original', check_in_time: '2026-10-25T01:00:00Z' }],
    member_follow_ups: [{ id: 'follow-up', member_id: 'historical', church_branch_id: 'a', follow_up_date: '2026-10-20', followed_up_by: 'original', method: 'call', outcome: 'resolved' }],
  };
  const events = [], writes = [];
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.bounds = null; this.operation = null; }
    select() { return this; }
    value(row, key) { return key.split('.').reduce((value, part) => value?.[part], row); }
    eq(key, value) { this.filters.push((row) => this.value(row, key) === value); return this; }
    neq(key, value) { this.filters.push((row) => this.value(row, key) !== value); return this; }
    in(key, values) { this.filters.push((row) => values.includes(this.value(row, key))); return this; }
    is(key, value) { return this.eq(key, value); }
    order() { return this; }
    range(from, to) { this.bounds = [from, to]; return this; }
    limit(count) { this.bounds = [0, count - 1]; return this; }
    insert(payload) { this.operation = 'insert'; this.payload = payload; return this; }
    update(payload) { this.operation = 'update'; this.payload = payload; return this; }
    result(single = false) {
      assert.ok(db[this.table], `Unexpected table ${this.table}`);
      events.push({ table: this.table, operation: this.operation ?? 'read' });
      if (options.failRead === this.table || this.operation && options.failWrite === this.table) return { data: null, error: { message: 'PRIVATE_DATABASE_FAILURE' } };
      if (this.operation) options.beforeWrite?.(db, this.table);
      let rows = db[this.table].filter((row) => this.filters.every((filter) => filter(row)));
      if (this.operation === 'insert') {
        if (this.table === 'baptism_records' && (options.uniqueRace || db.baptism_records.some((row) => row.member_id === this.payload.member_id && row.baptism_type === this.payload.baptism_type))) {
          return { data: null, error: { code: '23505', message: 'PRIVATE_UNIQUE_VIOLATION' } };
        }
        rows = [{ id: `created-${db[this.table].length}`, ...this.payload }]; db[this.table].push(...rows);
      }
      if (this.operation === 'update') rows.forEach((row) => Object.assign(row, this.payload));
      if (this.operation) writes.push({ table: this.table, payload: this.payload, affected: rows.length });
      if (this.bounds) rows = rows.slice(this.bounds[0], this.bounds[1] + 1);
      const data = rows.map((row) => ({ ...row }));
      return { data: single ? data[0] ?? null : data, error: null };
    }
    maybeSingle() { return Promise.resolve(this.result(true)); }
    single() { return this.maybeSingle(); }
    then(resolve, reject) { return Promise.resolve(this.result()).then(resolve, reject); }
  }
  const admin = { from: (table) => new Query(table), auth: { getUser: async () => ({ data: { user: options.anonymous ? null : user }, error: null }) } };
  const stubs = {
    'server-only': {},
    react: { ...React, cache: (fn) => fn, useActionState: (_action, state) => [state, () => {}] },
    'react-dom': { ...require('react-dom'), useFormStatus: () => ({ pending: false }) },
    'next/navigation': { redirect: (url) => { throw new Error(`redirect:${url}`); }, notFound: () => { throw new Error('not-found'); } },
    'next/cache': { revalidatePath: (url) => events.push({ revalidate: url }) },
    'next/link': { __esModule: true, default: (props) => React.createElement('a', props) },
    '@/lib/supabase/admin': { createAdminClient: () => admin },
    '@/lib/supabase/server': { createClient: async () => admin },
  };
  const load = (file) => loadTypeScript(file, stubs);
  const form = (values) => { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value ?? ''); return data; };
  const contributionForm = (overrides = {}) => form({ church_branch_id: 'a', member_id: 'historical', service_id: 'service', contribution_type: 'tithe', amount: '123.45', contribution_date: '2026-10-21', payment_method: 'gcash', notes: 'Corrected', ...overrides });
  const baptismForm = (overrides = {}) => form({ church_branch_id: 'a', member_id: 'historical', baptism_type: 'water', baptism_date: '2026-10-21', officiated_by: 'Corrected Pastor', location: 'River', notes: 'Corrected', ...overrides });
  async function branches() {
    const access = await load('app/portal/contributions/access.ts').requireContributionsPermission('contributions.view');
    return load('lib/historical-records.ts').getHistoricalRecordBranches(access, admin);
  }
  async function content(file, params = {}) {
    const shell = await load(file).default({ params: Promise.resolve(params) });
    assert.equal(shell.type, React.Suspense, 'Runtime reads must remain below Suspense');
    return shell.props.children.type(shell.props.children.props);
  }
  return { db, admin, events, writes, load, branches, content, contributionForm, baptismForm };
};
