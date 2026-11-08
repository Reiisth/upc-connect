import { resolve, relative } from 'node:path';
import { randomBytes } from 'node:crypto';
import { context, ROOT, OPERATIONS, literal, insert, query, snapshot, assertPreserved, authUsers, backup, privateWrite } from './hosted-demo-env.mjs';
import { ACCOUNTS, generateDemo, todayManila } from './hosted-demo-data.mjs';

async function main() {
  const ctx = context();
  const before = snapshot(ctx, 'before');
  const departments = query(ctx, 'SELECT id,name FROM public.departments ORDER BY name;', 'departments');
  const roles = query(ctx, 'SELECT id,key FROM public.roles WHERE is_active ORDER BY key;', 'roles');
  if (ACCOUNTS.some(a => !roles.some(r => r.key === a.role))) throw new Error('Required active roles missing; seed never changes RBAC.');
  const data = generateDemo(todayManila(), departments);
  // Names (including full surname-style middle names) come from the shared curated
  // generator also used by the guarded in-place hosted rename; IDs never change.
  const requiredColumns = query(ctx, `SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND is_nullable='NO' AND column_default IS NULL AND is_generated='NEVER' AND is_identity='NO' ORDER BY table_name,ordinal_position;`, 'required-columns');
  const fixtureTables = { church_branches: data.branches, members: data.members, services: data.services, attendance_records: data.attendance, financial_contributions: data.contributions, baptism_records: data.baptisms, member_follow_ups: data.followUps };
  for (const { table_name: table, column_name: column } of requiredColumns) {
    if (fixtureTables[table]?.some(row => row[column] === null || row[column] === undefined)) throw new Error(`Fixture lacks required current-schema value: ${table}.${column}. No writes performed.`);
  }
  privateWrite(resolve(ctx.dir, 'dataset.json'), data);
  console.log(JSON.stringify({ replaceBranchesWith: data.branches.map(b => b.name), history: [data.start, data.anchor], expected: data.counts, accounts: ACCOUNTS.map(a => ({ email: a.email, role: a.role })) }, null, 2));
  const users = await authUsers(ctx.client);
  if ([...OPERATIONS, 'profiles'].some(t => before.counts[t] !== 0) || users.length) throw new Error('Seed requires a fully scrubbed environment. Run guarded scrub first; no upserts over existing data.');
  if (!ctx.execute) return;
  backup(ctx, before);
  const accounts = ACCOUNTS.map(a => ({ ...a, password: randomBytes(24).toString('base64url'), id: null }));
  const accountFile = resolve(ROOT, '.env.hosted-demo-accounts.local');
  const saveAccounts = () => privateWrite(accountFile, `# PRIVATE hosted QA/demo credentials. Never commit. ${ctx.url}\n# Seed run: ${relative(ROOT, ctx.dir)}\n${accounts.map(a => `\n# ${a.role}; branches ${a.branches.join(',') || 'linked member only'}\nDEMO_${a.name.toUpperCase()}_EMAIL=${a.email}\nDEMO_${a.name.toUpperCase()}_PASSWORD=${a.password}\nDEMO_${a.name.toUpperCase()}_USER_ID=${a.id ?? ''}`).join('\n')}\n`);
  saveAccounts();
  for (const account of accounts) {
    const { data: result, error } = await ctx.client.auth.admin.createUser({ email: account.email, password: account.password, email_confirm: true, user_metadata: { display_name: `Demo ${account.name}` } });
    if (error || !result.user) throw new Error(`Demo Auth creation failed (${error?.status ?? 'unknown'}). Credentials/partial progress saved privately; scrub before retry.`);
    account.id = result.user.id; saveAccounts();
    const { data: profile, error: profileError } = await ctx.client.from('profiles').select('id').eq('id', account.id).single();
    if (profileError || !profile) throw new Error('Auth profile trigger did not create a profile. Aborting.');
  }
  const accountId = name => accounts.find(a => a.name === name).id;
  data.members[0].account_status = 'connected';
  // All member rows share the same insert columns; link ownership is stored separately below.
  const statements = [
    `DELETE FROM public.church_branches;`, insert('church_branches', data.branches),
    insert('user_roles', accounts.map(a => ({ user_id: a.id, role_id: roles.find(r => r.key === a.role).id }))),
    insert('user_branch_access', accounts.flatMap(a => a.branches.map(b => ({ user_id: a.id, church_branch_id: data.branches[b - 1].id })))),
    insert('members', data.members),
    insert('account_members', [{ user_id: accountId('member'), member_id: data.members[0].id, relationship: 'member', can_view: true, can_edit: true }]),
    insert('services', data.services),
    insert('attendance_records', data.attendance.map(a => ({ ...a, recorded_by: accountId(data.services.find(s => s.id === a.service_id).church_branch_id === data.branches[0].id ? 'usher' : 'pastor') }))),
    // Historical imports may have no known recorder; never attribute them to an out-of-scope demo actor.
    insert('financial_contributions', data.contributions.map(c => ({ ...c, recorded_by: c.church_branch_id === data.branches[0].id ? accountId('accounting') : null }))),
    insert('baptism_records', data.baptisms.map(b => ({ ...b, recorded_by: b.baptism_type === 'water' ? accountId('evangelism') : b.church_branch_id === data.branches[1].id ? accountId('ministry') : null }))),
    insert('member_follow_ups', data.followUps.map(f => ({ ...f, followed_up_by: 'Demo Pastor', created_by: accountId('pastor') }))),
  ];
  // Owner SQL import is the existing migration's explicit historical-import path.
  // Triggers remain enabled; no REST service_role bypass or schema changes.
  query(ctx, `BEGIN; LOCK TABLE ${[...OPERATIONS, 'church_branches'].map(t => `public.${t}`).join(',')} IN ACCESS EXCLUSIVE MODE;
    DO $$ BEGIN IF (SELECT count(*) FROM auth.users) <> 7 OR EXISTS (SELECT 1 FROM auth.users WHERE id NOT IN (${accounts.map(a => literal(a.id)).join(',')})) OR ${OPERATIONS.map(t => `(SELECT count(*) FROM public.${t}) <> 0`).join(' OR ')} THEN RAISE EXCEPTION 'Environment changed during seed'; END IF; END $$;
    ${statements.join('\n')} COMMIT; SELECT 'seeded' AS result;`, 'seed-data', true);
  const after = snapshot(ctx, 'after'); assertPreserved(before, after);
  for (const [table, count] of Object.entries(data.counts)) if (after.counts[table] !== count) throw new Error(`Unexpected ${table} count after seed.`);
  if (after.counts.profiles !== 7 || after.counts.church_branches !== 2 || (await authUsers(ctx.client)).length !== 7) throw new Error('Account or branch count mismatch.');
  privateWrite(resolve(ROOT, 'supabase/.temp/hosted-demo/latest-seed.json'), { dir: relative(ROOT, ctx.dir), anchor: data.anchor, start: data.start, counts: data.counts, qr: data.qr, preservation: after });
  console.log(JSON.stringify({ verified: data.counts, qr: data.qr, credentialsFile: relative(ROOT, accountFile), receipt: relative(ROOT, ctx.dir) }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
