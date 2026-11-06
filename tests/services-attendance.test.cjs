/* eslint-disable @typescript-eslint/no-require-imports -- Existing Node test harness uses CommonJS. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');

const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const serviceId = id(1), branch = id(2), otherBranch = id(3);
const denied = /redirect:\/access-denied/;

function harness({ permissions = ['services.update', 'services.create', 'attendance.view', 'attendance.record', 'attendance.correct'],
  status = 'ongoing', branchIds = [branch, otherBranch], archivedAccount = false, anonymous = false,
  raceInsert = false, failTable, concurrentStatus, startsDuringSubmit = false } = {}) {
  let clock = '2026-10-25T02:00:00Z';
  const Clock = class extends Date { constructor(...args) { super(...(args.length ? args : [clock])); } static now() { return new Date(clock).getTime(); } };
  const db = {
    church_branches: [branch, otherBranch].map((key) => ({ id: key, name: key === branch ? 'Service branch' : 'Other branch', code: null, is_active: true })),
    services: [{ id: serviceId, name: 'Worship', service_type: 'sunday_morning', church_branch_id: branch,
      service_date: status === 'scheduled' ? '2026-10-26' : '2026-10-25', start_time: '09:00:00', status, notes: null }],
    service_types: [{ key: 'sunday_morning', name: 'Sunday Morning', is_active: true }],
    members: [
      { id: id(11), first_name: 'Current', last_name: 'Member', church_branch_id: branch, is_archived: false, member_status: 'active' },
      { id: id(12), first_name: 'Transferred', last_name: 'Member', church_branch_id: otherBranch, is_archived: false, member_status: 'active' },
      { id: id(13), first_name: 'Archived', last_name: 'Member', church_branch_id: branch, is_archived: true, member_status: 'active' },
      { id: id(14), first_name: 'Inactive', last_name: 'Member', church_branch_id: branch, is_archived: false, member_status: 'inactive' },
    ],
    attendance_records: [], financial_contributions: [], profiles: [{ id: id(50), display_name: 'Recorder' }],
  };
  const events = [];
  let raced = false;
  function record(memberId, attendanceStatus = 'present') {
    const row = { id: id(100 + db.attendance_records.length), service_id: serviceId, member_id: memberId,
      attendance_status: attendanceStatus, check_in_time: '2026-10-25T01:12:34.567Z', method: 'qr', recorded_by: id(50) };
    db.attendance_records.push(row); return row;
  }
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.write = null; this.bounds = null; this.maximum = null; }
    select(columns, options) { this.columns = columns; this.options=options; return this; }
    eq(key, value) { this.filters.push((row) => row[key] === value); return this; }
    in(key, values) { this.filters.push((row) => values.includes(row[key])); return this; }
    or(filter) {
      if (!filter.includes('.ilike.')) {const [key,op,value] = filter.split('.'); this.filters.push(row => op === 'is' ? row[key] === null : row[key] === value); return this;}
      const clauses = filter.split(',').map(part => part.split('.ilike.%'));
      this.filters.push(row => clauses.some(([key,pattern]) => String(row[key] ?? '').toLowerCase().includes(pattern.slice(0,-1).toLowerCase()))); return this;
    }
    gte(key,value) {this.filters.push(row=>row[key]>=value);return this;}
    lte(key,value) {this.filters.push(row=>row[key]<=value);return this;}
    order() { return this; }
    limit(count, options) { if(!options)this.maximum = count; return this; }
    range(from, to) { this.bounds = [from, to]; return this; }
    update(payload) { this.write = ['update', payload]; return this; }
    insert(payload) { this.write = ['insert', payload]; return this; }
    result(single = false) {
      events.push({ table: this.table, operation: this.write?.[0] ?? 'read', columns: this.columns });
      if (startsDuringSubmit && this.table === 'attendance_records' && !this.write) clock='2026-10-27T02:00:00Z';
      if (failTable === this.table) return { data: null, error: { message: 'query failed' } };
      const source = db[this.table]; assert.ok(source, `Unexpected table ${this.table}`);
      let selected = source.filter((row) => this.filters.every((filter) => filter(row)));
      if(this.columns?.includes("attendance_records!inner"))selected=selected.filter(row=>db.attendance_records.some(record=>record.service_id===row.id));
      const count=this.options?.count?selected.length:undefined;
      if (this.write?.[0] === 'insert') {
        const payload = this.write[1];
        if (this.table === 'attendance_records') {
          if (raceInsert && !raced) {
            raced = true; record(payload.member_id, 'excused');
            if (concurrentStatus) db.services[0].status = concurrentStatus;
          }
          if (source.some((row) => row.service_id === payload.service_id && row.member_id === payload.member_id)) {
            return { data: null, error: { code: '23505', message: 'duplicate' } };
          }
        }
        const inserted = { id: id(999), ...payload }; source.push(inserted); selected = [inserted];
      }
      if (this.write?.[0] === 'update') selected.forEach((row) => Object.assign(row, this.write[1]));
      if (this.maximum !== null) selected = selected.slice(0, this.maximum);
      if (this.bounds) selected = selected.slice(this.bounds[0], this.bounds[1] + 1);
      const output = selected.map((row) => ({ ...row }));
      return { data: this.options?.head ? null : single ? output[0] ?? null : output, error: null, count };
    }
    maybeSingle() { return Promise.resolve(this.result(true)); }
    single() { return Promise.resolve(this.result(true)); }
    then(resolve, reject) { return Promise.resolve(this.result()).then(resolve, reject); }
  }
  function redirect(url) { throw new Error(`redirect:${url}`); }
  async function active() {
    if (anonymous) redirect('/login');
    if (archivedAccount) redirect('/access-denied');
    return { user: { id: id(50) } };
  }
  const admin = { from: (table) => new Query(table), rpc: async () => ({data:{totals:[],trend:[],breakdown:[]},error:null}) };
  const stubs = {
    'server-only': {},
    'next/navigation': { unstable_rethrow: error => {if(String(error?.message).startsWith('redirect:')) throw error;}, redirect, notFound: () => redirect('/not-found'), useRouter: () => ({ refresh() {} }) },
    'next/cache': { revalidatePath: (url) => events.push({ revalidate: url }) },
    'next/link': { __esModule: true, default: (props) => React.createElement('a', props) },
    '@/lib/auth': { requireActiveAccount: active },
    '@/lib/permissions-server': { requirePermission: async (permission) => {
      const { user } = await active(); if (!permissions.includes(permission)) redirect('/access-denied'); return { user, permissions };
    } },
    '@/lib/branch-access': { getUserBranchScope: async () => ({ branchIds, isSystemAdmin: false }) },
    '@/lib/supabase/admin': { createAdminClient: () => admin },
  };
  const load = (file) => loadTypeScript(file, stubs, {Date:Clock});
  const actions = () => load('app/portal/attendance/actions.ts');
  const serviceForm = (overrides = {}) => {
    const data = new FormData(); const row = { ...db.services[0], ...overrides };
    if (!Object.hasOwn(overrides, 'status')) delete row.status;
    for (const [key, value] of Object.entries(row)) if (value !== null) data.set(key, String(value));
    return data;
  };
  const attendanceForm = (memberId, overrides = {}) => {
    const data = new FormData();
    for (const [key, value] of Object.entries({ member_id: memberId, attendance_status: 'present', check_in_time: '2026-10-25T09:30', ...overrides })) data.set(key, value);
    return data;
  };
  const service = () => ({ id: serviceId, churchBranchId: branch });
  const rows = () => load('app/portal/attendance/data.ts').loadAttendanceRows(admin, service());
  async function page() {
    const wrapper = load('app/portal/attendance/[serviceId]/page.tsx').default({ params: Promise.resolve({ serviceId }) });
    return wrapper.props.children.type(wrapper.props.children.props);
  }
  return { db, events, load, admin, record, actions, serviceForm, attendanceForm, rows, page, setNow: value => {clock=value;} };
}

test('scheduled service branch/date remain editable without dependents and old/new branch authorization still applies', async () => {
  const h = harness({status:'scheduled'});
  await assert.rejects(h.load('app/portal/services/actions.ts').updateService(serviceId,
    h.serviceForm({ church_branch_id: otherBranch, service_date: '2026-10-26' })), /redirect:\/portal\/services/);
  assert.equal(h.db.services[0].church_branch_id, otherBranch); assert.equal(h.db.services[0].service_date, '2026-10-26');
  const scoped = harness({status:'scheduled', branchIds: [branch] });
  await assert.rejects(scoped.load('app/portal/services/actions.ts').updateService(serviceId,
    scoped.serviceForm({ church_branch_id: otherBranch })), /branches assigned/);
});

test('attendance locks service branch and calendar date; metadata changes do not rewrite attendance timestamps', async () => {
  const h = harness({status:'scheduled'}); const attendance = h.record(id(11)); const before = attendance.check_in_time;
  const action = h.load('app/portal/services/actions.ts').updateService;
  await assert.rejects(action(serviceId, h.serviceForm({ church_branch_id: otherBranch })), /branch cannot change/);
  await assert.rejects(action(serviceId, h.serviceForm({ service_date: '2026-10-27' })), /date cannot change/);
  await assert.rejects(action(serviceId, h.serviceForm({ name: 'Corrected name', start_time: '10:00' })), /redirect:/);
  assert.equal(attendance.check_in_time, before); assert.equal(h.db.services[0].name, 'Corrected name');
});

test('linked contributions lock branch; their own contribution_date is not rewritten by service date editing', async () => {
  const h = harness({status:'scheduled'}); h.db.financial_contributions.push({ id: id(500), service_id: serviceId, church_branch_id: branch, contribution_date: '2026-10-25' });
  const action = h.load('app/portal/services/actions.ts').updateService;
  await assert.rejects(action(serviceId, h.serviceForm({ church_branch_id: otherBranch })), /branch cannot change/);
  await assert.rejects(action(serviceId, h.serviceForm({ service_date: '2026-10-26' })), /redirect:/);
  assert.equal(h.db.financial_contributions[0].contribution_date, '2026-10-25');
});

test('explicit lifecycle actions are forward-only; terminal Services cannot reopen', async () => {
 for(const [from,to,allowed] of [['scheduled','completed',false],['scheduled','cancelled',true],['ongoing','completed',true],['ongoing','cancelled',true],['completed','cancelled',false],['cancelled','completed',false]]) {
  const h=harness({status:from});const work=h.load('app/portal/services/actions.ts').finishService(serviceId,to);
  if(allowed) await work; else await assert.rejects(work,/cannot return/);
  assert.equal(h.db.services[0].status,allowed?to:from);
 }
});

test('inactive managed types remain preservable on edit but cannot be selected for new or changed services', async () => {
  const h = harness({status:'scheduled'});
  h.db.service_types.push({ key: 'retired_service', name: 'Retired Service', is_active: false });
  h.db.services[0].service_type = 'retired_service';
  await assert.rejects(h.load('app/portal/services/actions.ts').updateService(serviceId,
    h.serviceForm({ name: 'Metadata correction' })), /redirect:\/portal\/services/);
  assert.equal(h.db.services[0].service_type, 'retired_service');
  await assert.rejects(h.load('app/portal/services/actions.ts').updateService(serviceId,
    h.serviceForm({ service_type: 'retired_service', name: 'Metadata correction 2' })), /redirect:\/portal\/services/);
  await assert.rejects(h.load('app/portal/services/actions.ts').updateService(serviceId,
    h.serviceForm({ service_type: 'missing_type' })), /active service type/);
  await assert.rejects(h.load('app/portal/services/actions.ts').createService(
    h.serviceForm({ service_type: 'retired_service' })), /active service type/);
});

test('historical archived/inactive/transferred attendees remain visible without duplicate roster rows', async () => {
  const h = harness(); for (const member of h.db.members) h.record(member.id);
  const rows = await h.rows(); assert.equal(rows.length, 4);
  assert.equal(rows.filter((row) => row.isCurrentlyEligible).length, 2);
  assert.equal(rows.filter((row) => row.attendance).length, 4);
  assert.ok(rows.some((row) => row.member.firstName === 'Transferred'));
  assert.ok(rows.some((row) => row.member.isArchived));
  const html = renderToStaticMarkup(await h.page());
  assert.ok(html.includes('Historical attendee')); assert.ok(html.includes('Archived'));
});

test('historical counts remain unchanged after every current-member change, while eligibility changes separately', async () => {
  const h = harness(); h.record(id(11), 'present'); h.record(id(12), 'present'); h.record(id(13), 'excused');
  const summary = h.load('app/portal/attendance/types.ts').getAttendanceSummary;
  const before = summary(await h.rows());
  h.db.members[0].is_archived = true; h.db.members[1].church_branch_id = branch; h.db.members[2].member_status = 'inactive';
  const after = summary(await h.rows());
  for (const key of ['present', 'absent', 'excused', 'totalRecorded', 'totalCheckIns']) assert.equal(after[key], before[key]);
  assert.equal(after.totalCheckIns, 2); assert.equal(after.totalRecorded, 3);
});

test('member identification fallback preserves a recorded fact if its member row is missing', async () => {
  const h = harness(); h.record(id(90));
  const row = (await h.rows()).find((row) => row.member.id === id(90));
  assert.ok(row.attendance); assert.equal(row.isCurrentlyEligible, false);
  assert.match(h.load('app/portal/attendance/types.ts').formatMemberName(row.member), /000000000090/);
});

test('ongoing corrections work after transfer, archive or stored inactivity without current-branch access', async () => {
  for (const memberId of [id(13), id(14)]) {
    const h = harness({ status: 'ongoing', branchIds: [branch], permissions: ['attendance.correct'] });
    const record = h.record(memberId);
    await h.actions().saveAttendanceRecord(serviceId, h.attendanceForm(memberId, { attendance_record_id: record.id }));
    assert.equal(record.attendance_status, 'present'); assert.equal(h.db.attendance_records.length, 1);
  }
});

test('new QR and manual attendance reject archived members', async () => {
  for (const memberId of [id(13)]) {
    const h = harness();
    await assert.rejects(h.actions().saveAttendanceRecord(serviceId, h.attendanceForm(memberId)), /non-archived/);
    await assert.rejects(h.actions().recordQrAttendance(serviceId, memberId), /not eligible/);
    assert.equal(h.db.attendance_records.length, 0);
  }
});

test('QR and manual allow only ongoing recording, with all other lifecycle states blocked', async () => {
  for (const status of ['scheduled', 'ongoing', 'completed', 'cancelled']) {
    for (const mode of ['manual', 'qr']) {
      const h = harness({ status });
      const work = mode === 'manual' ? h.actions().saveAttendanceRecord(serviceId, h.attendanceForm(id(11))) : h.actions().recordQrAttendance(serviceId, id(11));
      if (status === 'ongoing') { await work; assert.equal(h.db.attendance_records.length, 1); }
      else { await assert.rejects(work, /Scheduled|Completed|Cancelled/); assert.equal(h.db.attendance_records.length, 0); }
    }
  }
});

test('cancelled history is preserved, explicitly labelled, and cannot be corrected', async () => {
  const h = harness({ status: 'cancelled' }); const row = h.record(id(12));
  await assert.rejects(h.actions().saveAttendanceRecord(serviceId, h.attendanceForm(id(12))), /Cancelled/);
  assert.equal(row.attendance_status, 'present');
  const html = renderToStaticMarkup(await h.page());
  assert.ok(html.includes('This cancelled service has recorded attendance'));
  assert.ok(html.includes('Transferred')); assert.ok(!html.includes('>Correct<'));
});

test('correction requires its permission and a service inside actor scope; archived/anonymous actors are rejected', async () => {
  const noCorrect = harness({ permissions: ['attendance.record'] }); noCorrect.record(id(12));
  await assert.rejects(noCorrect.actions().saveAttendanceRecord(serviceId, noCorrect.attendanceForm(id(12))), denied);
  const foreign = harness({ branchIds: [otherBranch] }); foreign.record(id(12));
  await assert.rejects(foreign.actions().saveAttendanceRecord(serviceId, foreign.attendanceForm(id(12))), /outside your branch/);
  for (const options of [{ archivedAccount: true }, { anonymous: true }]) {
    const h = harness(options);
    await assert.rejects(h.actions().saveAttendanceRecord(serviceId, h.attendanceForm(id(11))), /redirect:/);
    await assert.rejects(h.actions().recordQrAttendance(serviceId, id(11)), /redirect:/);
    assert.equal(h.events.filter((event) => event.operation === 'insert').length, 0);
  }
});

test('stale/tampered correction record ID never falls back to a new attendance insert', async () => {
  const h = harness();
  await assert.rejects(h.actions().saveAttendanceRecord(serviceId, h.attendanceForm(id(11), { attendance_record_id: id(900) })), /no longer available/);
  assert.equal(h.db.attendance_records.length, 0);
});

test('QR duplicates including unique-insert races report the existing fact without overwrite', async () => {
  for (const raceInsert of [false, true]) {
    const h = harness({ raceInsert }); if (!raceInsert) h.record(id(11), 'excused');
    const result = await h.actions().recordQrAttendance(serviceId, id(11));
    assert.equal(result.outcome, 'duplicate'); assert.equal(result.attendanceStatus, 'excused');
    assert.equal(h.db.attendance_records.length, 1); assert.equal(h.db.attendance_records[0].method, 'qr');
  }
});

test('manual duplicate corrections preserve uniqueness; concurrent inserts still require correction authority and lifecycle', async () => {
  const h = harness(); const row = h.record(id(11));
  await h.actions().saveAttendanceRecord(serviceId, h.attendanceForm(id(11)));
  assert.equal(h.db.attendance_records.length, 1); assert.equal(row.attendance_status, 'present');
  for (const canCorrect of [false, true]) {
    const racing = harness({ raceInsert: true, permissions: canCorrect ? ['attendance.record', 'attendance.correct'] : ['attendance.record'] });
    const work = racing.actions().saveAttendanceRecord(serviceId, racing.attendanceForm(id(11)));
    if (canCorrect) await work; else await assert.rejects(work, denied);
    assert.equal(racing.db.attendance_records.length, 1);
    assert.equal(racing.db.attendance_records[0].attendance_status, canCorrect ? 'present' : 'excused');
  }
  const cancelled = harness({ raceInsert: true, concurrentStatus: 'cancelled' });
  await assert.rejects(cancelled.actions().saveAttendanceRecord(serviceId, cancelled.attendanceForm(id(11))), /Cancelled/);
  assert.equal(cancelled.db.attendance_records[0].attendance_status, 'excused');
});

test('Manila datetime-local input produces deterministic UTC and rejects normalized invalid dates', async () => {
  const h = harness(); await h.actions().saveAttendanceRecord(serviceId, h.attendanceForm(id(11)));
  assert.equal(h.db.attendance_records[0].check_in_time, '2026-10-25T01:30:00.000Z');
  const api = h.load('lib/manila-time.ts');
  assert.equal(api.toManilaDateTimeValue('2026-10-24T16:00:00Z'), '2026-10-25T00:00:00');
  for (const value of ['2026-02-30T09:00', '2026-13-01T09:00', '2026-10-25T24:00', '2026-10-25T09:60', '2026-10-25T09:00Z']) {
    assert.throws(() => api.parseManilaDateTime(value), /valid Manila/);
  }
});

test('host timezone cannot change manual interpretation, edit values or service sorting instants', () => {
  const source = `const api=require('./tests/helpers/load-typescript.cjs').loadTypeScript('lib/manila-time.ts');
    process.stdout.write(JSON.stringify([api.parseManilaDateTime('2026-10-25T09:30'),api.toManilaDateTimeValue('2026-10-25T01:30:00Z'),api.serviceTimestamp('2026-10-25','09:30')]));`;
  const results = ['UTC', 'America/Los_Angeles', 'Asia/Manila'].map((TZ) => {
    const child = spawnSync(process.execPath, ['-e', source], { cwd: process.cwd(), env: { ...process.env, TZ }, encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr); return child.stdout;
  });
  assert.equal(results[0], results[1]); assert.equal(results[1], results[2]);
});

test('unchanged correction time preserves subsecond timestamp rather than shifting or rounding it', async () => {
  const h = harness({ status: 'ongoing' }); const row = h.record(id(12)); const before = row.check_in_time;
  await h.actions().saveAttendanceRecord(serviceId, h.attendanceForm(id(12), { check_in_time: '2026-10-25T09:12:34' }));
  assert.equal(row.check_in_time, before);
});

test('history loading reads beyond API result pages and never labels current unrecorded people as historical absences', async () => {
  const h = harness();
  for (let index = 0; index < 505; index++) h.record(id(1000 + index), 'present');
  const rows = await h.rows(); assert.equal(rows.length, 507);
  const summary = h.load('app/portal/attendance/types.ts').getAttendanceSummary(rows);
  assert.equal(summary.present, 505); assert.equal(summary.unrecorded, 2); assert.equal(summary.totalEligible, 2);
});

test('dependency lookup failures fail closed and invalid source attendance never becomes inferred absence', async () => {
  const h = harness({status:'scheduled', failTable: 'financial_contributions' });
  await assert.rejects(h.load('app/portal/services/actions.ts').updateService(serviceId, h.serviceForm({ church_branch_id: otherBranch })), /Unable to verify/);
  assert.equal(h.db.services[0].church_branch_id, branch);
  const corrupt = harness(); corrupt.record(id(11), 'unsupported');
  await assert.rejects(corrupt.rows(), /unsupported status/);
});

test('host-only recorder records cross-branch manual and QR attendance without changing membership', async () => {
  for (const method of ['manual', 'qr']) {
    const h = harness({ branchIds: [branch], permissions: ['attendance.record'] });
    h.db.members[1].phone_number = 'PRIVATE';
    const before = JSON.stringify(h.db.members);
    if (method === 'manual') await h.actions().saveAttendanceRecord(serviceId, h.attendanceForm(id(12)));
    else await h.actions().recordQrAttendance(serviceId, id(12));
    assert.equal(h.db.attendance_records[0].service_id, serviceId);
    assert.equal(h.db.attendance_records[0].member_id, id(12));
    assert.equal(JSON.stringify(h.db.members), before);
    assert.equal(h.db.attendance_records.length, 1);
    const duplicate = await h.actions().recordQrAttendance(serviceId, id(12));
    assert.equal(duplicate.outcome, 'duplicate');
  }
});

test('cross-branch identity lookup is host-authorized, minimal and includes inactive and excludes archived people', async () => {
  const h = harness({ branchIds: [branch], permissions: ['attendance.record'] });
  Object.assign(h.db.members[1], { email: 'PRIVATE', phone_number: 'PRIVATE', church_branches: { name: 'Other branch' } });
  const matches = await h.actions().searchAttendanceMembers(serviceId, 'Transferred');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].homeBranchName, 'Other branch');
  assert.ok(!JSON.stringify(matches).includes('PRIVATE'));
  const selection = h.events.find(event => event.table === 'members').columns;
  assert.ok(!/email|phone|address|birth|account/.test(selection));
  assert.equal((await h.actions().searchAttendanceMembers(serviceId, 'Archived')).length, 0);
  const returning = await h.actions().searchAttendanceMembers(serviceId, 'Inactive');
  assert.equal(returning.length, 1); assert.equal(returning[0].memberStatus, 'inactive');
  const foreign = harness({ branchIds: [otherBranch], permissions: ['attendance.record'] });
  await assert.rejects(foreign.actions().searchAttendanceMembers(serviceId, 'Current'), /outside your branch/);
  await assert.rejects(foreign.actions().recordQrAttendance(serviceId, id(11)), /outside your branch/);
  assert.equal(foreign.events.some(e => e.table === 'members'), false);
  const labels = h.load('app/portal/attendance/types.ts');
  assert.equal(labels.isVisitingMember(otherBranch, branch), true);
  assert.equal(labels.isVisitingMember(branch, branch), false);
});


test('inactive returners can receive home/cross-branch manual and QR attendance without membership changes', async () => {
  for (const method of ['manual', 'qr']) for (const home of [branch, otherBranch]) {
    const h = harness({ branchIds: [branch], permissions: ['attendance.record'] });
    const member = h.db.members.find(m => m.id === id(14)); member.church_branch_id = home;
    const before = JSON.stringify(h.db.members);
    if (method === 'manual') await h.actions().saveAttendanceRecord(serviceId, h.attendanceForm(member.id));
    else {
      const result = await h.actions().recordQrAttendance(serviceId, member.id);
      assert.equal(result.memberStatus, 'inactive'); assert.equal(result.visitingMember, home !== branch);
    }
    assert.equal(JSON.stringify(h.db.members), before);
    assert.equal(h.db.attendance_records[0].service_id, serviceId);
    assert.equal(h.db.attendance_records[0].member_id, member.id);
    const row = (await h.rows()).find(r => r.member.id === member.id);
    assert.ok(row.attendance); assert.equal(row.member.memberStatus, 'inactive');
    assert.equal(h.events.some(e => e.table === 'members' && e.operation !== 'read'), false);
  }
  for (const method of ['manual', 'qr']) {
    const h = harness({ branchIds: [otherBranch], permissions: ['attendance.record'] });
    await assert.rejects(method === 'manual' ? h.actions().saveAttendanceRecord(serviceId, h.attendanceForm(id(14))) : h.actions().recordQrAttendance(serviceId, id(14)), /outside your branch/);
    assert.equal(h.db.attendance_records.length, 0);
  }
});

test('inactive returning members are selectable and clearly identified without offering archived new attendance', async () => {
  const h = harness(); const rows = await h.rows();
  assert.equal(rows.find(r => r.member.id === id(14)).isCurrentlyEligible, true);
  assert.equal(rows.some(r => r.member.id === id(13)), false);
  const html = renderToStaticMarkup(await h.page());
  assert.match(html, /Inactive Member/);
  assert.match(html, /non-archived Active or Inactive member/);
});


test('effective status follows the Manila start boundary and terminal states are authoritative', () => {
 const api=harness().load('app/portal/services/lifecycle.ts');
 const service={status:'scheduled',serviceDate:'2026-11-08',startTime:'09:00:00'};
 assert.equal(api.effectiveServiceStatus(service,new Date('2026-11-08T00:59:59Z')),'scheduled');
 assert.equal(api.effectiveServiceStatus(service,new Date('2026-11-08T01:00:00Z')),'ongoing');
 assert.equal(api.effectiveServiceStatus({...service,status:'ongoing'},new Date('2026-11-08T00:59:59Z')),'scheduled');
 for(const status of ['completed','cancelled']) assert.equal(api.effectiveServiceStatus({...service,status},new Date('2026-01-01T00:00:00Z')),status);
 assert.equal(api.effectiveServiceStatus({...service,startTime:null},new Date('2026-11-07T16:00:00Z')),'ongoing');
});
test('creation derives Scheduled/Ongoing and rejects every supplied manual lifecycle state',async()=>{
 for(const [date,status] of [['2026-10-26','scheduled'],['2026-10-25','ongoing']]){
  const h=harness();await assert.rejects(h.load('app/portal/services/actions.ts').createService(h.serviceForm({service_date:date})),/redirect:/);
  assert.equal(h.db.services.at(-1).status,status);
 }
 for(const status of ['scheduled','ongoing','completed','cancelled']){
  const h=harness();await assert.rejects(h.load('app/portal/services/actions.ts').createService(h.serviceForm({status})),/state is automatic/);assert.equal(h.db.services.length,1);
 }
});
test('only future scheduling edits are allowed; rescheduling may immediately start; submit rechecks elapsed time',async()=>{
 for(const status of ['ongoing','completed','cancelled']){
  const h=harness({status});await assert.rejects(h.load('app/portal/services/actions.ts').updateService(serviceId,h.serviceForm({name:'tamper'})),/already started|terminal/);
 }
 for(const [date,expected] of [['2026-10-27','scheduled'],['2026-10-25','ongoing']]){
  const h=harness({status:'scheduled'});await assert.rejects(h.load('app/portal/services/actions.ts').updateService(serviceId,h.serviceForm({service_date:date})),/redirect:/);assert.equal(h.db.services[0].status,expected);
 }
 const race=harness({status:'scheduled',startsDuringSubmit:true});await assert.rejects(race.load('app/portal/services/actions.ts').updateService(serviceId,race.serviceForm({church_branch_id:otherBranch})),/already started/);assert.equal(race.events.some(e=>e.operation==='update'),false);
 const noPermission=harness({status:'scheduled',permissions:[]});await assert.rejects(noPermission.load('app/portal/services/actions.ts').updateService(serviceId,noPermission.serviceForm()),/access-denied/);
});
test('all final Attendance statuses work only while Ongoing; removed status is rejected and missing rows are not Absent',async()=>{
 for(const status of ['present','excused','absent']){
  const h=harness();await h.actions().saveAttendanceRecord(serviceId,h.attendanceForm(id(11),{attendance_status:status,check_in_time:''}));
  assert.equal(h.db.attendance_records[0].attendance_status,status);assert.equal(h.db.attendance_records[0].check_in_time===null,status!=='present');
 }
 const invalid=harness();await assert.rejects(invalid.actions().saveAttendanceRecord(serviceId,invalid.attendanceForm(id(11),{attendance_status:['la','te'].join('')})),/valid attendance status/);
 const h=harness();h.record(id(11),'absent');const summary=h.load('app/portal/attendance/types.ts').getAttendanceSummary(await h.rows());assert.equal(summary.absent,1);assert.equal(summary.unrecorded,1);assert.equal(summary.totalCheckIns,0);
 for(const status of ['scheduled','completed','cancelled']){
  const closed=harness({status});const row=closed.record(id(11));await assert.rejects(closed.actions().saveAttendanceRecord(serviceId,closed.attendanceForm(id(11))),/read-only/);assert.equal(row.attendance_status,'present');
 }
});
test('Attendance landing groups ongoing first, keeps upcoming read-only and omits terminal Services',async()=>{
 const h=harness();
 for(const [n,status,date] of [[2,'scheduled','2026-10-26'],[3,'completed','2026-10-24'],[4,'cancelled','2026-10-24']]) h.db.services.push({...h.db.services[0],id:id(n+100),status,service_date:date,name:status+' fixture'});
 const wrapper=h.load('app/portal/attendance/page.tsx').default();const content=await wrapper.props.children.type(wrapper.props.children.props);const html=renderToStaticMarkup(content);
 assert.ok(html.indexOf('Ongoing Services')<html.indexOf('Upcoming Services'));
 assert.ok(html.includes('Open Attendance')&&html.includes('Edit Service')&&html.includes('Starts'));
 assert.equal(html.includes('completed fixture'),false);assert.equal(html.includes('cancelled fixture'),false);
 const form=renderToStaticMarkup(React.createElement(h.load('app/portal/services/ServiceForm.tsx').ServiceForm,{branches:[],serviceTypes:[],action(){},submitLabel:'Save'}));
 assert.equal(form.includes('name="status"'),false);
});

test('scheduled-edit form action returns a clean expected error after start, without mutating the Service',async()=>{
 const h=harness({status:'scheduled'});h.setNow('2026-10-27T02:00:00Z');
 const result=await h.load('app/portal/services/actions.ts').updateServiceFormAction(serviceId,h.serviceForm());assert.match(result.error,/already started/);assert.equal(h.events.some(e=>e.operation==='update'),false);
});
