import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';
import { loadLocalEnv, assertLoopback } from './local-env.mjs';
import { accounts } from './setup-local-auth.mjs';

loadLocalEnv();
const url = assertLoopback(process.env.NEXT_PUBLIC_SUPABASE_URL || '');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, options);
const snapshot = JSON.parse(readFileSync(new URL('../supabase/captures/current-reference.json', import.meta.url)));
const require = createRequire(import.meta.url);
const { calculateWeeklyInactivity, manilaDate, manilaDateFromTimestamp } = require('../lib/inactivity/calculate.ts');
const checked = result => { if (result.error) throw new Error(result.error.message); return result.data; };
const all = table => admin.from(table).select('*').then(checked);
function sql(source) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^PG/.test(key)) delete env[key];
  env.PGPASSWORD = process.env.UPC_LOCAL_DB_PASSWORD || 'postgres';
  const run = spawnSync('psql', ['-X', '-w', '-qAt', '-h', '127.0.0.1', '-p', '54322', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: source, encoding: 'utf8', env });
  if (run.error) throw run.error;
  if (run.status) throw new Error(run.stderr);
  return run.stdout.replace(/\r\n/g, '\n').trim();
}
const schema = JSON.parse(sql(`SELECT json_build_object(
 'tables',(SELECT count(*) FROM pg_tables WHERE schemaname='public'),
 'rls',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity),
 'policies',(SELECT count(*) FROM pg_policies WHERE schemaname='public'),
 'functions',(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'),
 'triggers',(SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND (n.nspname='public' OR (n.nspname='auth' AND t.tgname='on_auth_user_created'))),
 'uuid',to_regprocedure('pg_catalog.gen_random_uuid()') IS NOT NULL);`));
assert.deepEqual(schema, { tables: 18, rls: 18, policies: 37, functions: 12, triggers: 3, uuid: true });
assert.equal(sql("SELECT tgenabled FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND tgname='on_auth_user_created';"), 'O');
console.log('PASS schema:', schema);
const normalize = row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, /_at$/.test(k) && v ? new Date(v).toISOString() : v]));
for (const [table, expected] of Object.entries(snapshot)) {
  const actual = await all(table);
  const key = row => row.id || (row.role_id ? `${row.role_id}:${row.permission_id}` : row.key);
  for (const row of expected) assert.deepEqual(normalize(actual.find(r => key(r) === key(row))), normalize(row));
  if (!['departments', 'service_types'].includes(table)) assert.equal(actual.length, expected.length);
}
console.log('PASS all captured reference rows, timestamps and exact 70-assignment matrix');
const counts = { church_branches: 2, members: 30, services: 19, attendance_records: 47, member_follow_ups: 10, financial_contributions: 23, baptism_records: 10, departments: 12, service_types: 6 };
const rows = {};
for (const [table, count] of Object.entries(counts)) { rows[table] = await all(table); assert.equal(rows[table].length, count, table); }
console.log('PASS fixture counts:', counts);
const summaries = calculateWeeklyInactivity({
  today: manilaDate(new Date()),
  thresholds: new Map(rows.church_branches.map(r => [r.id, r.inactivity_threshold_weeks])),
  members: rows.members.filter(r => !r.is_archived).map(r => ({ id: r.id, branchId: r.church_branch_id, registrationDate: manilaDateFromTimestamp(r.created_at) })),
  services: rows.services.map(r => ({ id: r.id, branchId: r.church_branch_id, serviceDate: r.service_date, status: r.status })),
  attendance: rows.attendance_records.map(r => ({ memberId: r.member_id, serviceId: r.service_id, status: r.attendance_status })),
});
const summary = name => summaries.find(s => s.memberId === rows.members.find(m => m.first_name === name).id);
assert.equal(summary('Mila').needsFollowUp, false);
assert.equal(summary('Lino').consecutiveAbsentWeeks, 0);
assert.equal(summary('Nena').consecutiveAbsentWeeks, 3);
assert.equal(summary('Nena').needsFollowUp, true);
assert.equal(summary('Amihan').consecutiveAbsentWeeks, 4);
assert.equal(summary('Amihan').needsFollowUp, true);
assert.equal(summary('Noel').recentEligibleWeeks, 3);
assert.equal(summary('Luz').recentEligibleWeeks, 2);
assert.equal(summary('Pio').recentEligibleWeeks, 2);
assert.equal(summary('Sinta').calculationStatus, 'eligibility_unknown');
assert.equal(summary('Dario').consecutiveAbsentWeeks, 0);
assert.equal(summary('Elena').needsFollowUp, true);
assert.equal(rows.departments.find(d => d.id === rows.members.find(m => m.first_name === 'Belen').department_id).is_active, false);
assert.equal(rows.service_types.find(t => t.key === 'demo_legacy_gathering').is_active, false);
console.log('PASS live seeded inactivity, registration boundaries, thresholds and inactive reference scenarios');
const rpc = checked(await admin.rpc('get_reports_analytics', { p_branch_ids: rows.church_branches.map(b => b.id), p_from: '2020-01-01', p_to: '2030-12-31', p_grouping: 'week', p_as_of: manilaDate(new Date()) }));
assert.equal(rpc.version, 1);
assert.equal(rpc.followUps.find(r => r.branchId === null).total, 10);
assert.equal(rpc.contributions.find(r => r.branchId === null).count, 23);
for (const branch of rows.church_branches) {
  const exactTotal = sql(`SELECT round(sum(amount),2)::text FROM public.financial_contributions WHERE church_branch_id='${branch.id}';`);
  assert.equal(rpc.contributions.find(r => r.branchId === branch.id).totalAmount, exactTotal);
  const physical = Number(sql(`SELECT count(*) FROM public.attendance_records a JOIN public.services s ON s.id=a.service_id WHERE s.church_branch_id='${branch.id}' AND s.status='completed' AND a.attendance_status = 'present';`));
  assert.equal(rpc.attendance.find(r => r.branchId === branch.id).physicalCheckIns, physical);
}
assert.deepEqual(Object.fromEntries(['member','visitor','anonymous'].map(type => [type, rows.financial_contributions.filter(r => r.contributor_type === type).length])), { member:21, visitor:1, anonymous:1 });
const visitingGift = rows.financial_contributions.find(r => r.id === 'c3000000-0000-4000-8000-000000000001');
assert.notEqual(visitingGift.church_branch_id, rows.members.find(m => m.id === visitingGift.member_id).church_branch_id);
assert.equal(summary('Benjie').consecutiveAbsentWeeks, 0);
console.log('PASS Reports totals use receiving/service branches, all contributor categories distinct, cross-branch inactivity reset');
const users = {};
for (const [label, role, branches] of accounts) {
  const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options);
  const session = checked(await client.auth.signInWithPassword({ email: `demo.${label}@example.com`, password: process.env.UPC_LOCAL_TEST_PASSWORD }));
  users[label] = session.user.id;
  assert.equal(checked(await client.rpc('has_role', { role_name: role })), true);
  for (const b of rows.church_branches) {
    const expected = role === 'system_admin' || branches.includes(b.id.endsWith('1') ? 1 : 2);
    assert.equal(checked(await client.rpc('has_branch_access', { branch_id: b.id })), expected);
  }
  const denied = await client.rpc('get_reports_analytics', { p_branch_ids: [], p_from: '2026-01-01', p_to: '2026-12-31', p_grouping: 'day', p_as_of: '2026-11-04' });
  assert.ok(denied.error, 'Reports must remain service-only');
  await client.auth.signOut();
}
assert.equal(sql(`BEGIN; UPDATE public.profiles SET archived_at=now() WHERE id='${users.admin}'; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${users.admin}',true) IS NOT NULL; SELECT public.has_role('system_admin'),public.has_branch_access('${rows.church_branches[0].id}'); ROLLBACK;`).split('\n').at(-1), 'f|f');
console.log('PASS seven real Auth logins, profile triggers, branch scope, RPC ACLs and archived administrator denial');
const nena = rows.members.find(m => m.first_name === 'Nena');
assert.equal(sql(`BEGIN; INSERT INTO public.member_follow_ups(church_branch_id,member_id,follow_up_date,method,outcome) VALUES ('${nena.church_branch_id}','${nena.id}',CURRENT_DATE,'call','contacted'); SELECT member_status FROM public.members WHERE id='${nena.id}'; UPDATE public.members SET member_status='inactive' WHERE id='${nena.id}'; SELECT member_status FROM public.members WHERE id='${nena.id}'; ROLLBACK;`), 'active\ninactive');
const linked = rows.members.find(m => m.first_name === 'Bagong');
assert.equal(linked.account_status, 'connected');
assert.ok(rows.member_follow_ups.some(f => f.member_id === rows.members.find(m => m.first_name === 'Isko').id));
console.log('PASS follow-up does not change member status; human review and archived history preserved (test writes rolled back)');
