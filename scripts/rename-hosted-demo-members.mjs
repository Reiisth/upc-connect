import { readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { context, ROOT, REFERENCES, OPERATIONS, literal, query, snapshot, assertPreserved, privateWrite, hash } from './hosted-demo-env.mjs';
import { ACCOUNTS, fixtureId } from './hosted-demo-data.mjs';
import { demoMemberName, FILIPINO_SURNAMES } from './hosted-demo-names.mjs';

export const EXPECTED_COUNTS = Object.freeze({ members: 180, services: 182, attendance_records: 11588, financial_contributions: 700, baptism_records: 80, member_follow_ups: 90, profiles: 7, account_members: 1, user_roles: 7, user_branch_access: 9, church_branches: 2 });
const oldFirstNames = ['Amihan', 'Bituin', 'Dalisay', 'Hiraya', 'Isagani', 'Lakan', 'Ligaya', 'Mayumi', 'Mutya', 'Sinag', 'Tala', 'Alon', 'Araw', 'Diwa', 'Habagat', 'Luningning', 'Malaya', 'Siklab'];
export function nameMapping(members) {
  if (members.length !== 180) throw new Error('Expected exactly 180 demo members.');
  const byId = new Map(members.map(m => [m.id, m]));
  return Array.from({ length: 180 }, (_, i) => {
    const member = byId.get(fixtureId(1, i + 1));
    if (!member || member.gender !== (i % 2 ? 'female' : 'male')) throw new Error('Unexpected deterministic demo identity/demographics.');
    const name = demoMemberName(i, member.gender);
    const old = member.first_name === oldFirstNames[i % oldFirstNames.length] && member.last_name === `Demo ${String(i + 1).padStart(3, '0')}` && !member.middle_name;
    const renamed = Object.entries(name).every(([key, value]) => member[key] === value);
    if (!old && !renamed) throw new Error('Unrecognized member name: environment may contain non-demo edits. Refusing update.');
    return { id: member.id, ...name };
  });
}
const tables = [...REFERENCES, ...OPERATIONS, 'profiles', 'church_branches'];
const fingerprints = `jsonb_build_object(${tables.map(table => `${literal(table)},(SELECT md5(coalesce(string_agg(${table === 'members' ? "(to_jsonb(t)-ARRAY['first_name','middle_name','last_name','updated_at'])::text" : 'to_jsonb(t)::text'},'' ORDER BY ${table === 'members' ? "(to_jsonb(t)-ARRAY['first_name','middle_name','last_name','updated_at'])::text" : 'to_jsonb(t)::text'}),'')) FROM public.${table} t)`).join(',')},'auth.users',(SELECT md5(coalesce(string_agg(to_jsonb(t)::text,'' ORDER BY id),'')) FROM auth.users t),'auth.identities',(SELECT md5(coalesce(string_agg(to_jsonb(t)::text,'' ORDER BY id),'')) FROM auth.identities t))`;

export async function renameHostedMembers() {
  const ctx = context();
  const before = snapshot(ctx, 'before-name-update');
  for (const [table, count] of Object.entries(EXPECTED_COUNTS)) if (before.counts[table] !== count) throw new Error(`Unexpected ${table} count; refusing non-demo environment.`);
  const members = query(ctx, 'SELECT id,first_name,middle_name,last_name,gender FROM public.members ORDER BY id;', 'member-names-before');
  const mapping = nameMapping(members);
  const credentialsPath = resolve(ROOT, '.env.hosted-demo-accounts.local');
  const credentials = readFileSync(credentialsPath, 'utf8');
  const credentialHash = hash(credentials);
  const ids = [...credentials.matchAll(/^DEMO_[A-Z_]+_USER_ID=([0-9a-f-]{36})$/gm)].map(m => m[1]);
  const accounts = query(ctx, 'SELECT id,email FROM auth.users ORDER BY email;', 'auth-identity-check');
  if (ids.length !== 7 || accounts.length !== 7 || accounts.some(a => !ids.includes(a.id)) || ACCOUNTS.some(a => !accounts.some(u => u.email === a.email))) throw new Error('Unexpected Auth demo identities; refusing update.');
  const links = query(ctx, `SELECT user_id,member_id FROM public.account_members;`, 'member-link-check');
  const memberUserId = credentials.match(/^DEMO_MEMBER_USER_ID=([0-9a-f-]{36})$/m)?.[1];
  if (links.length !== 1 || links[0].user_id !== memberUserId || links[0].member_id !== fixtureId(1, 1)) throw new Error('Unexpected demo Member account link.');
  const branches = query(ctx, 'SELECT id,name FROM public.church_branches ORDER BY id;', 'branch-check');
  if (branches.some((b, i) => b.id !== fixtureId(0, i + 1) || b.name !== ['Batangas City', 'Bauan'][i])) throw new Error('Unexpected demo branches.');
  privateWrite(resolve(ctx.dir, 'name-backup.json'), members);
  privateWrite(resolve(ctx.dir, 'name-mapping.json'), mapping);
  const [unchanged] = query(ctx, `SELECT ${fingerprints} fingerprints;`, 'data-before');
  console.log(JSON.stringify({ members: mapping.length, surnamePool: FILIPINO_SURNAMES.length, examples: [mapping[0], mapping[2], mapping[90]], counts: EXPECTED_COUNTS, backup: relative(ROOT, ctx.dir) }, null, 2));
  if (!ctx.execute) return;
  const values = mapping.map(row => `(${[row.id, row.first_name, row.middle_name, row.last_name].map(literal).join(',')})`).join(',\n');
  const oldValues = members.map(row => `(${[row.id, row.first_name, row.middle_name, row.last_name, row.gender].map(literal).join(',')})`).join(',\n');
  query(ctx, `BEGIN;
    LOCK TABLE ${tables.map(t => `public.${t}`).join(',')},auth.users,auth.identities IN SHARE ROW EXCLUSIVE MODE;
    DO $$ DECLARE protected_before jsonb; protected_after jsonb; BEGIN
      SELECT ${fingerprints} INTO protected_before;
      IF protected_before <> ${literal(JSON.stringify(unchanged.fingerprints))}::jsonb THEN RAISE EXCEPTION 'Data changed after preflight'; END IF;
      IF (SELECT count(*) FROM public.members) <> 180 OR EXISTS (
        SELECT 1 FROM public.members m FULL JOIN (VALUES ${oldValues}) old(id,first_name,middle_name,last_name,gender) ON m.id=old.id::uuid
        WHERE m.id IS NULL OR old.id IS NULL OR ROW(m.first_name,m.middle_name,m.last_name,m.gender) IS DISTINCT FROM ROW(old.first_name,old.middle_name,old.last_name,old.gender)
      ) THEN RAISE EXCEPTION 'Member names changed after backup'; END IF;
      UPDATE public.members m SET first_name=v.first_name,middle_name=v.middle_name,last_name=v.last_name
      FROM (VALUES ${values}) v(id,first_name,middle_name,last_name) WHERE m.id=v.id::uuid
        AND ROW(m.first_name,m.middle_name,m.last_name) IS DISTINCT FROM ROW(v.first_name,v.middle_name,v.last_name);
      SELECT ${fingerprints} INTO protected_after;
      IF protected_before <> protected_after THEN RAISE EXCEPTION 'Protected data changed; rolling back names'; END IF;
    END $$;
    COMMIT; SELECT count(*) renamed_members FROM public.members WHERE middle_name IS NOT NULL;`, 'rename-only-member-names', true);
  const after = snapshot(ctx, 'after-name-update'); assertPreserved(before, after);
  if (JSON.stringify(before.counts) !== JSON.stringify(after.counts)) throw new Error('Row counts changed.');
  const [protectedAfter] = query(ctx, `SELECT ${fingerprints} fingerprints;`, 'data-after');
  if (JSON.stringify(unchanged) !== JSON.stringify(protectedAfter) || hash(readFileSync(credentialsPath, 'utf8')) !== credentialHash) throw new Error('Protected data/credentials changed.');
  const finalNames = query(ctx, 'SELECT id,first_name,middle_name,last_name,gender FROM public.members ORDER BY id;', 'verified-member-names');
  if (JSON.stringify(nameMapping(finalNames)) !== JSON.stringify(mapping)) throw new Error('Final names mismatch.');
  privateWrite(resolve(ctx.dir, 'rename-receipt.json'), { counts: after.counts, preserved: true, credentialsUnchanged: true, qrIdsUnchanged: true, examples: [mapping[0], mapping[2], mapping[90]], updatedAt: 'Existing trigger refreshes updated_at on changed members.' });
  console.log('PASS: 180 realistic full names; all protected rows, Auth identities, credentials, links, QR IDs, counts and security definitions unchanged. Existing updated_at trigger ran normally.');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) renameHostedMembers().catch(error => { console.error(error.message); process.exitCode = 1; });
