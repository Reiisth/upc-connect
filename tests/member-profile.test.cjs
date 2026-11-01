/* eslint-disable @typescript-eslint/no-require-imports -- Node test harness uses CommonJS. */
const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');

const denied = /redirect:\/access-denied/;
function definition(id, field_key, field_type = 'text', extra = {}) {
  return { id, field_key, label: field_key, field_type, field_group: 'additional', is_builtin: false,
    is_visible: true, is_required: false, options_source: null, options: null, sort_order: 1, placeholder: null, ...extra };
}
function harness({ permissions = ['members.view', 'members.create', 'members.update', 'members.archive', 'members.link_account', 'profile.view', 'profile.update', 'administration.view'],
  branchIds = ['a'], isSystemAdmin = false, failWrite, beforeWrite } = {}) {
  const base = { first_name: 'Registered', last_name: 'Person', middle_name: null, nickname: null,
    church_branch_id: 'a', first_attendance_date: null, member_status: 'active', is_archived: false,
    archived_at: null, profile_status: 'incomplete', profile_completed_at: null, account_status: 'connected',
    email: 'owner@example.test', phone_number: null, country: null, region: null, province: null,
    city: null, barangay: null, civil_status: null, birth_date: null, department_id: null, position: null, zone: null };
  const db = { members: [{ id: 'owned', ...base }, { id: 'foreign', ...base, church_branch_id: 'b' }],
    church_branches: [{ id: 'a', name: 'Branch A', is_active: true }, { id: 'b', name: 'Branch B', is_active: true }],
    departments: [{ id: 'dept', name: 'Ministry' }], profiles: [{ id: 'actor', archived_at: null }, { id: 'foreign-account', archived_at: null }],
    account_members: [{ id: 'link', user_id: 'actor', member_id: 'owned', relationship: 'member' }, { id: 'foreign-link', user_id: 'foreign-account', member_id: 'foreign', relationship: 'member' }],
    user_roles: [{ user_id: 'actor', role_id: 'custom', roles: { key: 'custom_steward', is_staff: true, is_active: true } }],
    user_branch_access: [{ user_id: 'actor', church_branch_id: 'a' }],
    member_field_definitions: [], member_custom_field_values: [],
    services: [{ id: 'service', church_branch_id: 'a', status: 'completed', service_date: '2000-01-01' }],
    attendance_records: [{ id: 'attendance', service_id: 'service', member_id: 'owned', attendance_status: 'present', check_in_time: '2000-01-01T01:00:00Z', recorded_by: null }],
    member_follow_ups: [{ id: 'followup', church_branch_id: 'a', member_id: 'owned' }],
  };
  const writes = [], events = [];
  function related(table, row) {
    if (table === 'account_members') return { ...row, members: db.members.find((member) => member.id === row.member_id) };
    return row;
  }
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.payload = null; this.operation = null; this.bounds = null; }
    select() { return this; }
    eq(key, value) { this.filters.push((row) => key.split('.').reduce((o, part) => o?.[part], related(this.table, row)) === value); return this; }
    is(key, value) { return this.eq(key, value); }
    in(key, values) { this.filters.push((row) => values.includes(key.split('.').reduce((o, part) => o?.[part], related(this.table, row)))); return this; }
    order() { return this; }
    limit() { return this; }
    range(from, to) { this.bounds = [from, to]; return this; }
    update(payload) { this.operation = 'update'; this.payload = payload; return this; }
    insert(payload) { this.operation = 'insert'; this.payload = payload; return this; }
    upsert(payload) { this.operation = 'upsert'; this.payload = payload; return this; }
    delete() { this.operation = 'delete'; return this; }
    result(single = false) {
      const table = db[this.table]; assert.ok(table, `Unexpected table ${this.table}`);
      if (this.operation) beforeWrite?.(db, this.table);
      let rows = table.filter((row) => this.filters.every((filter) => filter(row)));
      events.push({ table: this.table, operation: this.operation ?? 'read' });
      if (this.operation) {
        if (failWrite === this.table) return { data: null, error: { message: 'write failed' } };
        writes.push({ table: this.table, payload: this.payload, operation: this.operation });
        if (this.operation === 'update') rows.forEach((row) => Object.assign(row, this.payload));
        if (this.operation === 'insert') { const row = { id: 'created', ...base, account_status: 'no_account', ...this.payload }; table.push(row); rows = [row]; }
        if (this.operation === 'upsert') {
          for (const value of Array.isArray(this.payload) ? this.payload : [this.payload]) {
            const existing = table.find((row) => row.member_id === value.member_id && row.field_definition_id === value.field_definition_id);
            if (existing) Object.assign(existing, value); else table.push({ ...value });
          }
        }
      }
      if (this.bounds) rows = rows.slice(this.bounds[0], this.bounds[1] + 1);
      const data = rows.map((row) => ({ ...related(this.table, row) }));
      return { data: single ? data[0] ?? null : data, error: null };
    }
    maybeSingle() { return Promise.resolve(this.result(true)); }
    single() { return Promise.resolve(this.result(true)); }
    then(resolve, reject) { return Promise.resolve(this.result()).then(resolve, reject); }
  }
  const client = { from: (table) => new Query(table),
    auth: { admin: {
      listUsers: async () => ({ data: { users: [{ id: 'actor', email: 'owner@example.test' }, { id: 'foreign-account', email: 'foreign@example.test' }] }, error: null }),
      getUserById: async (id) => ({ data: { user: { id, email: id === 'actor' ? 'owner@example.test' : 'foreign@example.test' } }, error: null }),
      inviteUserByEmail: async () => { events.push({ invite: true }); return { data: { user: { id: 'new-account' } }, error: null }; },
    } },
    rpc: async () => ({ error: null }),
  };
  function redirect(url) { throw new Error(`redirect:${url}`); }
  const stubs = { 'server-only': {},
    'next/navigation': { redirect, notFound: () => redirect('/not-found'), useRouter: () => ({ refresh() {} }) },
    'next/cache': { revalidatePath: (path) => events.push({ revalidate: path }) },
    'next/image': { __esModule: true, default: () => null },
    'next/link': { __esModule: true, default: (props) => React.createElement('a', props) },
    '@/lib/permissions-server': { requirePermission: async (permission) => { if (!permissions.includes(permission)) redirect('/access-denied'); return { user: { id: 'actor', email: 'owner@example.test' }, permissions }; } },
    '@/lib/branch-access': { getUserBranchScope: async () => ({ branchIds, isSystemAdmin }) },
    '@/lib/supabase/admin': { createAdminClient: () => client }, '@/lib/supabase/server': { createClient: async () => client },
  };
  const load = (file) => loadTypeScript(file, stubs);
  const form = (extra = {}) => { const result = new FormData(); for (const [key, value] of Object.entries(extra)) result.set(key, value); return result; };
  const staffForm = (extra = {}) => form({ first_name: 'Registered', last_name: 'Person', church_branch_id: 'a', member_status: 'active', ...extra });
  const selfForm = (extra = {}) => form({ first_name: 'Updated', last_name: 'Person', ...extra });
  async function content(file, memberId = 'owned') {
    const wrapper = await load(file).default({ params: Promise.resolve({ memberId }), searchParams: Promise.resolve({ memberId }) });
    return wrapper.props.children.type(wrapper.props.children.props);
  }
  return { db, load, form, selfForm, staffForm, content, writes, events, client };
}

test('custom-role staff can update church fields for a scoped target without profile authority', async () => {
  const h = harness({ permissions: ['members.view', 'members.update'] });
  await assert.rejects(h.load('app/portal/members/actions.ts').updateMember('owned', h.staffForm({ first_attendance_date: '2000-01-01', member_status: 'inactive', zone: '3', department_id: 'dept' })), /redirect:\/portal\/members\/owned/);
  assert.equal(h.db.members[0].first_attendance_date, '2000-01-01'); assert.equal(h.db.members[0].zone, 3);
  assert.ok(h.events.some((event) => event.revalidate === '/portal/inactivity'));
});

test('staff edit/view enforce permission and old/new branch scope; system-admin still requires the permission', async () => {
  const h = harness(); const api = h.load('app/portal/members/actions.ts');
  await assert.rejects(api.updateMember('foreign', h.staffForm()), denied);
  await assert.rejects(api.updateMember('owned', h.staffForm({ church_branch_id: 'b' })), /branches assigned/);
  await assert.rejects(h.content('app/portal/members/[memberId]/page.tsx', 'foreign'), denied);
  const admin = harness({ isSystemAdmin: true });
  await assert.rejects(admin.load('app/portal/members/actions.ts').updateMember('foreign', admin.staffForm()), /redirect:\/portal\/members\/foreign/);
  assert.equal(admin.db.members[1].church_branch_id, 'a');
  const missing = harness({ isSystemAdmin: true, permissions: [] });
  await assert.rejects(missing.load('app/portal/members/actions.ts').updateMember('foreign', missing.staffForm()), denied);
});

test('self-service rejects church branch, eligibility, administrative status, archive and linkage tampering before writes', async () => {
  for (const key of ['church_branch_id', 'first_attendance_date', 'member_status', 'is_archived', 'archived_at', 'department_id', 'position', 'zone', 'account_status', 'profile_status']) {
    const h = harness(); const result = await h.load('app/portal/profile/actions.ts').saveMemberProfile('owned', h.selfForm({ [key]: 'tampered' }));
    assert.match(result.error, /Church and system/); assert.equal(h.writes.length, 0);
  }
});

test('creation captures first attendance or unknown and returns the new detail without an automatic invitation', async () => {
  for (const date of ['', '2000-01-01']) {
    const h = harness(); await assert.rejects(h.load('app/portal/members/actions.ts').createMember(h.staffForm({ first_attendance_date: date })), /redirect:\/portal\/members\/created/);
    assert.equal(h.db.members.at(-1).first_attendance_date, date || null);
    assert.equal(h.db.members.at(-1).member_status, 'active');
    assert.equal(h.events.some((event) => event.invite), false);
  }
  const tampered = harness();
  await assert.rejects(tampered.load('app/portal/members/actions.ts').createMember(tampered.staffForm({ member_status: 'inactive' })), /redirect:\/portal\/members\/created/);
  assert.equal(tampered.db.members.at(-1).member_status, 'active');
});

test('first-attendance date rejects impossible/future dates and administrative statuses honor the live constraint intersection', async () => {
  const h = harness(); const validation = h.load('lib/member-validation.ts');
  const tomorrow = new Date(Date.parse(`${validation.memberToday()}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  for (const date of ['2000-02-30', 'malformed', tomorrow]) {
    await assert.rejects(h.load('app/portal/members/actions.ts').createMember(h.staffForm({ first_attendance_date: date })), /valid calendar|future/);
  }
  await assert.rejects(h.load('app/portal/members/actions.ts').updateMember('owned', h.staffForm({ member_status: 'pending' })), /administrative/);
  assert.equal(h.writes.length, 0);
});

test('completion and edit pages bind the same save action; visible personal fields share normalization', async () => {
  for (const route of ['app/portal/profile/[memberId]/page.tsx', 'app/portal/profile/[memberId]/edit/page.tsx']) {
    const h = harness(); const tree = await h.content(route);
    function findAction(element) {
      if (!React.isValidElement(element)) return null;
      if (typeof element.props.action === 'function') return element.props.action;
      for (const child of React.Children.toArray(element.props.children)) { const action = findAction(child); if (action) return action; }
      return null;
    }
    const action = findAction(tree); assert.ok(action);
    await assert.rejects(action(h.selfForm({ first_name: ' Trimmed ', middle_name: '  ' })), /redirect:\/portal\/profile\/owned/);
    assert.equal(h.db.members[0].first_name, 'Trimmed'); assert.equal(h.db.members[0].middle_name, null);
    assert.equal(h.db.members[0].profile_status, 'completed');
  }
});

test('server enforces required custom fields, permitted options and unknown/hidden custom IDs before any mutation', async () => {
  for (const [extra, pattern] of [[{}, /required/], [{ custom_field_choice: 'other' }, /valid/], [{ custom_field_fake: 'x', custom_field_choice: 'yes' }, /Unknown/]]) {
    const h = harness(); h.db.member_field_definitions.push(definition('choice', 'personal_choice', 'select', { is_required: true, options_source: 'custom', options: ['yes', 'no'] }));
    const result = await h.load('app/portal/profile/actions.ts').saveMemberProfile('owned', h.selfForm(extra));
    assert.match(result.error, pattern); assert.equal(h.writes.length, 0);
  }
  const hidden = harness(); hidden.db.member_field_definitions.push(definition('hidden', 'hidden_field', 'text', { is_visible: false }));
  assert.match((await hidden.load('app/portal/profile/actions.ts').saveMemberProfile('owned', hidden.selfForm({ custom_field_hidden: 'bad' }))).error, /Unknown/);
});

test('required built-ins, dates, numbers, email, phone and configured selections are validated on the server', async () => {
  const cases = [
    ['birth_date', 'date', '2000-02-30'], ['gender', 'select', 'invented'],
    ['phone_number', 'phone', 'invalid'], ['custom_field_num', 'number', 'NaN'], ['custom_field_email', 'email', 'invalid'],
  ];
  for (const [key, type, value] of cases) {
    const h = harness();
    if (key.startsWith('custom_')) h.db.member_field_definitions.push(definition(key.slice(13), key, type));
    else h.db.member_field_definitions.push(definition(key, key, type, { is_builtin: true, options: ['Male', 'Female'], options_source: 'custom' }));
    assert.ok((await h.load('app/portal/profile/actions.ts').saveMemberProfile('owned', h.selfForm({ [key]: value }))).error);
    assert.equal(h.writes.length, 0);
  }
  const required = harness(); required.db.member_field_definitions.push(definition('birthday', 'birth_date', 'date', { is_builtin: true, is_required: true }));
  assert.match((await required.load('app/portal/profile/actions.ts').saveMemberProfile('owned', required.selfForm())).error, /required/);
});

test('supplemental values save before completion; failed validation/custom writes cannot partially mark a profile complete', async () => {
  const h = harness(); h.db.member_field_definitions.push(definition('num', 'supplemental_number', 'number'));
  await assert.rejects(h.load('app/portal/profile/actions.ts').saveMemberProfile('owned', h.selfForm({ custom_field_num: '12.5' })), /redirect:/);
  assert.deepEqual(h.writes.map((write) => write.table), ['member_custom_field_values', 'members']);
  assert.equal(h.db.member_custom_field_values[0].value, 12.5);
  const failure = harness({ failWrite: 'member_custom_field_values' }); failure.db.member_field_definitions.push(definition('num', 'supplemental_number', 'number'));
  assert.match((await failure.load('app/portal/profile/actions.ts').saveMemberProfile('owned', failure.selfForm({ custom_field_num: '12' }))).error, /base profile was not changed/);
  assert.equal(failure.db.members[0].profile_status, 'incomplete'); assert.equal(failure.writes.length, 0);
  const baseFailure = harness({ failWrite: 'members' }); baseFailure.db.member_field_definitions.push(definition('num', 'supplemental_number', 'number'));
  assert.match((await baseFailure.load('app/portal/profile/actions.ts').saveMemberProfile('owned', baseFailure.selfForm({ custom_field_num: '12' }))).error, /may have saved/);
  assert.equal(baseFailure.db.members[0].profile_status, 'incomplete');
});

test('ownership and profile permissions remain independent of staff member permission', async () => {
  const h = harness();
  await assert.rejects(h.load('app/portal/profile/actions.ts').saveMemberProfile('foreign', h.selfForm()), denied);
  await assert.rejects(h.content('app/portal/profile/[memberId]/page.tsx', 'foreign'), denied);
  const staff = harness({ permissions: ['members.update'] });
  await assert.rejects(staff.load('app/portal/profile/actions.ts').saveMemberProfile('owned', staff.selfForm()), denied);
  const view = harness({ permissions: ['profile.view'] });
  await assert.rejects(view.load('app/portal/profile/actions.ts').saveMemberProfile('owned', view.selfForm()), denied);
});

test('member transfer/archive never rewrites attendance, follow-up branch, Auth archive, or account relationships', async () => {
  const h = harness({ branchIds: ['a', 'b'] }); const history = JSON.stringify([h.db.attendance_records, h.db.member_follow_ups, h.db.account_members, h.db.profiles]);
  const api = h.load('app/portal/members/actions.ts');
  await assert.rejects(api.updateMember('owned', h.staffForm({ church_branch_id: 'b' })), /redirect:/);
  await api.archiveMember('owned');
  assert.equal(JSON.stringify([h.db.attendance_records, h.db.member_follow_ups, h.db.account_members, h.db.profiles]), history);
  const attendance = await h.load('app/portal/attendance/data.ts').loadAttendanceRows(h.client, { id: 'service', churchBranchId: 'a' });
  assert.ok(attendance.some((row) => row.member.id === 'owned' && row.attendance));
  const preserved = ['account_status', 'church_branch_id', 'first_attendance_date', 'member_status'];
  const beforeRestore = Object.fromEntries(preserved.map((key) => [key, h.db.members[0][key]]));
  await api.restoreMember('owned');
  assert.equal(h.db.members[0].is_archived, false); assert.equal(h.db.members[0].archived_at, null);
  assert.deepEqual(Object.fromEntries(preserved.map((key) => [key, h.db.members[0][key]])), beforeRestore);
  assert.equal(JSON.stringify([h.db.attendance_records, h.db.member_follow_ups, h.db.account_members, h.db.profiles]), history);
});

test('member restore requires members.archive and target branch scope', async () => {
  const unauthorized = harness({ permissions: ['members.view'] });
  await assert.rejects(unauthorized.load('app/portal/members/actions.ts').restoreMember('owned'), denied);
  const outOfScope = harness(); outOfScope.db.members[1].is_archived = true;
  await assert.rejects(outOfScope.load('app/portal/members/actions.ts').restoreMember('foreign'), denied);
  assert.equal(outOfScope.db.members[1].is_archived, true);
  assert.equal(outOfScope.writes.length, 0);
});

test('inactivity keeps missing first attendance unknown and uses updated date independently of stored status', async () => {
  const h = harness(); const calculate = h.load('lib/inactivity/calculate.ts').calculateWeeklyInactivity;
  const run = () => calculate({ today: '2026-10-27', thresholds: new Map([['a', 1]]),
    members: [{ id: 'owned', branchId: h.db.members[0].church_branch_id, eligibilityDate: h.db.members[0].first_attendance_date }],
    services: [{ id: 'service', branchId: 'a', serviceDate: '2026-10-19', status: 'completed' }], attendance: [] })[0];
  assert.equal(run().calculationStatus, 'eligibility_unknown');
  await assert.rejects(h.load('app/portal/members/actions.ts').updateMember('owned', h.staffForm({ first_attendance_date: '2000-01-01', member_status: 'inactive' })), /redirect:/);
  assert.equal(run().isInactive, true);
});

test('staff detail links reuse canonical account/follow-up workflows and the Members list retains a detail destination', async () => {
  const h = harness({ permissions: ['members.view', 'members.update', 'members.link_account', 'follow_ups.view'] }); h.db.members[0].account_status = 'no_account';
  const html = renderToStaticMarkup(await h.content('app/portal/members/[memberId]/page.tsx'));
  assert.ok(html.includes('/portal/members/owned/edit')); assert.ok(html.includes('/portal/members/invite?memberId=owned'));
  assert.ok(html.includes('/portal/follow-ups/member/owned')); assert.ok(html.includes('Unknown'));
});

test('Field Management cannot mutate operational definitions or create reserved-key custom fields', async () => {
  const h = harness(); h.db.member_field_definitions.push(definition('branch', 'church_branch_id', 'select', { is_builtin: true }));
  const api = h.load('app/portal/field-management/actions.ts');
  const payload = { ...definition('branch', 'church_branch_id', 'select'), is_required: true };
  await assert.rejects(api.saveFieldConfiguration([payload]), /not a configurable/);
  await assert.rejects(api.saveFieldConfiguration([{ ...payload, id: 'new-branch' }]), /Church and system/);
  assert.equal(h.writes.length, 0);
});

test('concurrent transfer or archive cannot turn a previously scoped staff edit into an authorized write', async () => {
  for (const change of [{ church_branch_id: 'b' }, { is_archived: true }]) {
    const h = harness({ beforeWrite: (db, table) => { if (table === 'members') Object.assign(db.members[0], change); } });
    await assert.rejects(h.load('app/portal/members/actions.ts').updateMember('owned', h.staffForm({ first_attendance_date: '2000-01-01' })), /Reload/);
    assert.equal(h.db.members[0].first_attendance_date, null);
  }
});

test('archived member is readable by its owner but cannot be edited by owner or staff until restored', async () => {
  const h = harness(); h.db.members[0].is_archived = true;
  await h.content('app/portal/profile/[memberId]/page.tsx');
  await assert.rejects(h.content('app/portal/profile/[memberId]/edit/page.tsx'), denied);
  await assert.rejects(h.load('app/portal/profile/actions.ts').saveMemberProfile('owned', h.selfForm()), /unavailable/);
  await assert.rejects(h.load('app/portal/members/actions.ts').updateMember('owned', h.staffForm()), /Restore/);
  assert.equal(h.writes.length, 0);
});

test('canonical linking requires its own permission, scoped members and a visible existing account', async () => {
  const missing = harness({ permissions: ['members.update'] });
  await assert.rejects(missing.load('app/portal/members/actions.ts').inviteMembers(['owned'], 'owner@example.test'), denied);
  const foreign = harness();
  await assert.rejects(foreign.load('app/portal/members/actions.ts').inviteMembers(['foreign'], 'new@example.test'), /branches assigned/);
  await assert.rejects(foreign.load('app/portal/members/actions.ts').inviteMembers(['owned'], 'foreign@example.test'), denied);
  assert.equal(foreign.events.some((event) => event.invite), false);
  const local = harness();
  await assert.rejects(local.load('app/portal/members/actions.ts').inviteMembers(['owned'], 'owner@example.test', 'owned'), /redirect:\/portal\/members\/owned$/);
});

test('invitation suggestions expose only accounts allowed by the shared account target scope', async () => {
  const h = harness(); h.db.members[0].account_status = 'no_account';
  const tree = await h.load('app/portal/members/invite/page.tsx').default({ searchParams: Promise.resolve({ memberId: 'owned' }) });
  const json = JSON.stringify(tree);
  assert.ok(json.includes('owner@example.test')); assert.ok(!json.includes('foreign@example.test'));
});

test('self-service preserves hidden values and normalizes optional blanks, configured choices and checkbox values', async () => {
  const h = harness(); h.db.members[0].nickname = 'Preserved';
  h.db.member_field_definitions.push(definition('nick', 'nickname', 'text', { is_builtin: true, is_visible: false }),
    definition('gender', 'gender', 'select', { is_builtin: true, options_source: 'custom', options: ['Male', 'Female'] }),
    definition('check', 'personal_consent', 'checkbox'));
  await assert.rejects(h.load('app/portal/profile/actions.ts').saveMemberProfile('owned', h.selfForm({ gender: 'Female', phone_number: '', custom_field_check: 'true' })), /redirect:/);
  assert.equal(h.db.members[0].nickname, 'Preserved'); assert.equal(h.db.members[0].gender, 'female');
  assert.equal(h.db.members[0].phone_number, null); assert.equal(h.db.member_custom_field_values[0].value, true);
});

test('required Philippine region options and NCR province exception are verified against the server catalog', () => {
  const h = harness(); const validate = h.load('lib/member-validation.ts').validateSelfServiceProfile;
  const definitions = [definition('region', 'region', 'select', { is_builtin: true, is_required: true, options_source: 'psgc_regions' }),
    definition('province', 'province', 'text', { is_builtin: true, is_required: true })];
  const catalog = { branches: [], departments: [], regions: [{ name: 'NCR', regionNumber: 13 }] };
  const valid = h.selfForm({ country: 'Philippines', region: 'NCR', province: '' });
  assert.equal(validate(valid, definitions, h.db.members[0], catalog, '').patch.region, 'NCR');
  valid.set('region', 'invented');
  assert.throws(() => validate(valid, definitions, h.db.members[0], catalog, ''), /valid region/);
});
