import { resolve, relative } from 'node:path';
import { context, ROOT, OPERATIONS, literal, query, snapshot, assertPreserved, authUsers, backup, privateWrite } from './hosted-demo-env.mjs';

async function main() {
  const ctx = context();
  console.log('DESTRUCTIVE: removes ALL hosted operational rows and ALL Auth accounts. References/schema are preserved.');
  const before = snapshot(ctx, 'before');
  const users = await authUsers(ctx.client);
  console.log(JSON.stringify({ before: before.counts, authAccountsToDelete: users.map(u => ({ id: u.id, email: u.email })) }, null, 2));
  privateWrite(resolve(ctx.dir, 'auth-inventory.json'), users);
  if (!ctx.execute) return;
  backup(ctx, before);
  const fresh = snapshot(ctx, 'pre-mutation');
  assertPreserved(before, fresh);
  if (JSON.stringify(before.counts) !== JSON.stringify(fresh.counts)) throw new Error('Concurrent data change detected after backup. Aborting.');
  const freshUsers = await authUsers(ctx.client);
  if (JSON.stringify(users.map(u => u.id).sort()) !== JSON.stringify(freshUsers.map(u => u.id).sort())) throw new Error('Auth inventory changed after backup. Aborting.');
  query(ctx, `BEGIN; LOCK TABLE ${[...OPERATIONS, 'profiles'].map(t => `public.${t}`).join(',')} IN ACCESS EXCLUSIVE MODE;
    DO $$ BEGIN IF (SELECT count(*) FROM auth.users) <> ${users.length} OR EXISTS (SELECT 1 FROM auth.users WHERE id NOT IN (${users.length ? users.map(u => literal(u.id)).join(',') : 'NULL'})) THEN RAISE EXCEPTION 'Auth inventory changed'; END IF; END $$;
    DO $$ BEGIN IF ${[...OPERATIONS, 'profiles'].map(t => `(SELECT count(*) FROM public.${t}) <> ${before.counts[t]}`).join(' OR ')} THEN RAISE EXCEPTION 'Operational counts changed after backup'; END IF; END $$;
    UPDATE public.profiles SET archived_at=now();
    ${OPERATIONS.map(t => `DELETE FROM public.${t};`).join('\n')}
    COMMIT;`, 'scrub-operations', true);
  const receipt = { phase: 'operational-scrub-complete', deletedAuthIds: [], pendingAuthIds: users.map(u => u.id) };
  const receiptPath = resolve(ctx.dir, 'scrub-receipt.json');
  privateWrite(receiptPath, receipt);
  for (const user of users) {
    const { error } = await ctx.client.auth.admin.deleteUser(user.id);
    if (error) throw new Error(`Auth deletion failed (${error.status ?? 'unknown'}); see private receipt for recovery.`);
    receipt.deletedAuthIds.push(user.id);
    receipt.pendingAuthIds = receipt.pendingAuthIds.filter(id => id !== user.id);
    privateWrite(receiptPath, receipt);
  }
  const after = snapshot(ctx, 'after');
  assertPreserved(before, after);
  if ([...OPERATIONS, 'profiles'].some(t => after.counts[t] !== 0) || (await authUsers(ctx.client)).length) throw new Error('Scrub incomplete; inspect receipt.');
  receipt.phase = 'verified-complete'; privateWrite(receiptPath, receipt);
  console.log(JSON.stringify({ after: after.counts, authUsers: 0, receipt: relative(ROOT, receiptPath) }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
