import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';
import { context, ROOT, query, snapshot, assertPreserved, authUsers, privateWrite } from './hosted-demo-env.mjs';
import { ACCOUNTS, fixtureId, generateDemo } from './hosted-demo-data.mjs';
const require = createRequire(import.meta.url);
const { calculateWeeklyInactivity, manilaDateFromTimestamp } = require('../lib/inactivity/calculate.ts');

async function main() {
  const ctx = context();
  const receipt = JSON.parse(readFileSync(resolve(ROOT, 'supabase/.temp/hosted-demo/latest-seed.json'), 'utf8'));
  const actual = snapshot(ctx, 'verification'); assertPreserved(receipt.preservation, actual);
  for (const [table, count] of Object.entries(receipt.counts)) assert.equal(actual.counts[table], count, table);
  const branches = query(ctx, 'SELECT id,name FROM public.church_branches ORDER BY name;', 'branches');
  assert.deepEqual(branches.map(b => b.name).sort(), ['Batangas City', 'Bauan']);
  const [integrity] = query(ctx, `SELECT
    (SELECT count(*) FROM public.attendance_records a JOIN public.members m ON m.id=a.member_id JOIN public.services s ON s.id=a.service_id WHERE s.status <> 'completed' OR s.service_date < (m.created_at AT TIME ZONE 'Asia/Manila')::date OR (m.archived_at IS NOT NULL AND s.service_date >= (m.archived_at AT TIME ZONE 'Asia/Manila')::date)) bad_attendance,
    (SELECT count(*) FROM public.attendance_records a JOIN public.members m ON m.id=a.member_id JOIN public.services s ON s.id=a.service_id WHERE a.attendance_status='present' AND m.church_branch_id<>s.church_branch_id) visiting,
    (SELECT count(*) FROM public.services s JOIN public.members m ON m.church_branch_id=s.church_branch_id AND s.service_date >= (m.created_at AT TIME ZONE 'Asia/Manila')::date AND (m.archived_at IS NULL OR s.service_date < (m.archived_at AT TIME ZONE 'Asia/Manila')::date) WHERE s.status='completed' AND NOT EXISTS (SELECT 1 FROM public.attendance_records a WHERE a.service_id=s.id AND a.member_id=m.id)) missing_finalized_rows;`, 'integrity');
  assert.equal(integrity.bad_attendance, 0); assert.equal(integrity.missing_finalized_rows, 0); assert.ok(integrity.visiting > 0);
  const departments = query(ctx, 'SELECT id,name FROM public.departments ORDER BY name;', 'departments');
  const expected = generateDemo(receipt.anchor, departments);
  const load = async table => {
    const rows = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await ctx.client.from(table).select('*').order('id').range(offset, offset + 999);
      if (error) throw new Error(`Verification read failed: ${table}.`);
      rows.push(...data); if (data.length < 1000) return rows;
    }
  };
  const [members, services, attendance] = await Promise.all(['members', 'services', 'attendance_records'].map(load));
  const summaries = calculateWeeklyInactivity({ today: receipt.anchor, members: members.filter(m => !m.is_archived).map(m => ({ id: m.id, branchId: m.church_branch_id, registrationDate: manilaDateFromTimestamp(m.created_at) })), services: services.map(s => ({ id: s.id, branchId: s.church_branch_id, serviceDate: s.service_date, status: s.status })), attendance: attendance.map(a => ({ memberId: a.member_id, serviceId: a.service_id, status: a.attendance_status })), thresholds: new Map(branches.map(b => [b.id, 3])) });
  for (const offset of [0, 90]) {
    const get = n => summaries.find(s => s.memberId === fixtureId(1, offset + n));
    assert.equal(get(5).needsFollowUp, true); assert.equal(get(7).consecutiveAbsentWeeks, 2); assert.equal(get(9).consecutiveAbsentWeeks, 1); assert.equal(get(10).consecutiveAbsentWeeks, 0);
  }
  const report = await ctx.client.rpc('get_reports_analytics', { p_branch_ids: branches.map(b => b.id), p_from: receipt.start, p_to: receipt.anchor, p_grouping: 'month', p_as_of: receipt.anchor });
  if (report.error) throw new Error('Hosted analytics RPC failed.');
  const totalCents = expected.contributions.reduce((sum, c) => sum + BigInt(c.amount.replace('.', '')), 0n);
  assert.equal(report.data.contributions.find(r => r.branchId === null).totalAmount, `${totalCents / 100n}.${String(totalCents % 100n).padStart(2, '0')}`);
  for (const branch of branches) {
    const single = await ctx.client.rpc('get_reports_analytics', { p_branch_ids: [branch.id], p_from: receipt.start, p_to: receipt.anchor, p_grouping: 'month', p_as_of: receipt.anchor });
    assert.ifError(single.error); assert.equal(single.data.membership.find(r => r.branchId === null).nonArchivedMembers, 86);
  }
  const permissionRows = query(ctx, `SELECT r.key role,p.key permission FROM public.roles r JOIN public.role_permissions rp ON rp.role_id=r.id JOIN public.permissions p ON p.id=rp.permission_id WHERE r.is_active AND p.is_active ORDER BY r.key,p.key;`, 'permission-matrix');
  const credentials = Object.fromEntries(readFileSync(resolve(ROOT, '.env.hosted-demo-accounts.local'), 'utf8').split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]; }));
  if (!ctx.publicKey) throw new Error('Public key required for real demo login/RLS verification.');
  const accountResults = [];
  for (const account of ACCOUNTS) {
    const browser = createClient(ctx.url, ctx.publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const login = await browser.auth.signInWithPassword({ email: account.email, password: credentials[`DEMO_${account.name.toUpperCase()}_PASSWORD`] });
    assert.ifError(login.error); assert.ok(login.data.user);
    for (const permission of [...new Set(permissionRows.map(p => p.permission))]) {
      const check = await browser.rpc('has_permission', { permission_key: permission });
      assert.ifError(check.error); assert.equal(check.data, permissionRows.some(p => p.role === account.role && p.permission === permission), `${account.role}: ${permission}`);
    }
    for (let i = 1; i <= 2; i++) {
      const check = await browser.rpc('has_branch_access', { branch_id: fixtureId(0, i) });
      assert.ifError(check.error); assert.equal(check.data, account.branches.includes(i));
    }
    const forbidden = await browser.rpc('get_reports_analytics', { p_branch_ids: branches.map(b => b.id), p_from: receipt.start, p_to: receipt.anchor, p_grouping: 'month', p_as_of: receipt.anchor });
    assert.equal(forbidden.error?.code, '42501', 'Browser must not execute privileged analytics RPC');
    const forbiddenWrite = await browser.from('user_roles').insert({ user_id: login.data.user.id, role_id: fixtureId(9, 1) });
    assert.equal(forbiddenWrite.error?.code, '42501', 'Role write must fail specifically at authorization, not a foreign key');
    await browser.auth.signOut();
    accountResults.push({ email: account.email, role: account.role, login: true, permissionAndBranchMatrix: true, privilegedRpcAndRoleWritesDenied: true });
    console.log(`Verified login, permission matrix and branch scope: ${account.role}`);
  }
  assert.equal((await authUsers(ctx.client)).length, 7);
  const results = { counts: actual.counts, integrity, inactivityScenarios: true, exactContributionCents: String(totalCents), branchAnalytics: true, accounts: accountResults, preserved: true };
  privateWrite(resolve(ctx.dir, 'verification-results.json'), results);
  console.log(JSON.stringify(results, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
