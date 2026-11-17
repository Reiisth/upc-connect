import assert from 'node:assert/strict';
import { resolve, relative } from 'node:path';
import { context, query, literal, insert, privateWrite, ROOT, PROJECT } from './hosted-demo-env.mjs';
import { day, todayManila, fixtureId } from './hosted-demo-data.mjs';

// This seed writes movement fixtures only. It never changes member/account state.
const ctx = context();
const marker = '[MOCK MIGRATION]';
const prefix = 'd8110000-0000-4000-8000-';
const anchor = todayManila();
const branchA = fixtureId(0, 1), branchB = fixtureId(0, 2);
const branches = query(ctx, `SELECT id,name FROM public.church_branches WHERE id IN (${literal(branchA)},${literal(branchB)}) AND is_active ORDER BY id;`, 'mock-migration-branches');
assert.equal(branches.length, 2, 'Expected the existing two active demo branches.');
const names = new Map(branches.map(branch => [branch.id, branch.name]));
const candidates = query(ctx, `SELECT id,church_branch_id AS branch FROM public.members
  WHERE id::text LIKE 'd8010000-0000-4000-8000-%' AND is_archived IS FALSE AND departed_at IS NULL
    AND created_at <= ${literal(`${day(anchor, -31)}T00:00:00+08:00`)}
    AND church_branch_id IN (${literal(branchA)},${literal(branchB)}) ORDER BY id;`, 'mock-migration-members');
const aMembers = candidates.filter(member => member.branch === branchA).slice(0, 12);
const bMembers = candidates.filter(member => member.branch === branchB).slice(0, 4);
assert.equal(aMembers.length, 12, 'Need 12 eligible existing demo members in the first branch.');
assert.equal(bMembers.length, 4, 'Need 4 eligible existing demo members in the second branch.');
const before = query(ctx, `SELECT
 (SELECT count(*) FROM public.member_migrations) AS event_count,
 (SELECT count(*) FROM public.member_migrations WHERE id::text LIKE ${literal(`${prefix}%`)}) AS existing_mock_count,
 (SELECT md5(coalesce(string_agg(to_jsonb(m)::text,'' ORDER BY id),'')) FROM public.members m) AS members_hash,
 (SELECT md5(coalesce(string_agg(to_jsonb(e)::text,'' ORDER BY id),'')) FROM public.member_migrations e) AS events_hash,
 (SELECT started_at FROM public.member_migration_tracking WHERE singleton) AS tracking_started;`, 'mock-migration-before')[0];
assert.equal(Number(before.existing_mock_count), 0, 'This mock batch already exists; refusing duplicate data.');

const rows = [];
for (const [index, member] of [...aMembers, ...bMembers].entries()) {
  let events;
  if (member.branch === branchB) events = [['transfer',branchA,branchB],['transfer',branchB,branchA],['departure',branchA,null],['return',null,branchB]];
  else if (index % 4 === 0) events = [['return',null,branchB],['transfer',branchB,branchA],['departure',branchA,null],['return',null,branchA]];
  else if (index % 4 === 1) events = [['transfer',branchA,branchB],['departure',branchB,null],['return',null,branchB],['transfer',branchB,branchA]];
  else events = [['transfer',branchB,branchA],['departure',branchA,null],['return',null,branchB],['transfer',branchB,branchA]];
  let position = events[0][1];
  for (const [step, [kind, from, to]] of events.entries()) {
    assert.equal(from, position, 'Mock movements must form a coherent sequence.');
    position = to;
    const date = day(anchor, -([27,18,9,1][step] + index % 3));
    rows.push({id:fixtureId(11,rows.length+1),member_id:member.id,kind,
      from_branch_id:from,to_branch_id:to,member_name:`${marker} Example ${String(index+1).padStart(2,'0')}`,
      from_branch_name:from ? names.get(from) : null,to_branch_name:to ? names.get(to) : null,
      recorded_at:`${date}T${String(8+index%9).padStart(2,'0')}:15:00+08:00`,recorded_by:null});
  }
  assert.equal(position, member.branch, 'Final mock branch must match the existing demo member.');
}
assert.equal(rows.length, 64);
assert.equal(new Set(rows.map(row=>row.id)).size,64);
const totals = {events:rows.length,members:new Set(rows.map(row=>row.member_id)).size,
  transfers:rows.filter(row=>row.kind==='transfer').length,departures:rows.filter(row=>row.kind==='departure').length,returns:rows.filter(row=>row.kind==='return').length};
const ids = rows.map(row=>literal(row.id)).join(',');
const predicate = `id IN (${ids}) AND member_name LIKE ${literal(`${marker}%`)}`;
const sql = `BEGIN ISOLATION LEVEL SERIALIZABLE;
SELECT pg_advisory_xact_lock(hashtext('upc-mock-migrations-d811'));
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.member_migrations WHERE id::text LIKE ${literal(`${prefix}%`)}) THEN RAISE EXCEPTION 'Mock batch already exists'; END IF;
 IF (SELECT md5(coalesce(string_agg(to_jsonb(m)::text,'' ORDER BY id),'')) FROM public.members m) <> ${literal(before.members_hash)} THEN RAISE EXCEPTION 'Members changed after preflight; rerun safely'; END IF;
 IF (SELECT md5(coalesce(string_agg(to_jsonb(e)::text,'' ORDER BY id),'')) FROM public.member_migrations e) <> ${literal(before.events_hash)} THEN RAISE EXCEPTION 'Movement records changed after preflight; rerun safely'; END IF;
END $$;
${insert('member_migrations',rows)}
DO $$ BEGIN
 IF (SELECT count(*) FROM public.member_migrations WHERE ${predicate}) <> 64 THEN RAISE EXCEPTION 'Incomplete seed'; END IF;
 IF (SELECT md5(coalesce(string_agg(to_jsonb(m)::text,'' ORDER BY id),'')) FROM public.members m) <> ${literal(before.members_hash)} THEN RAISE EXCEPTION 'Unexpected member changes'; END IF;
 IF (SELECT md5(coalesce(string_agg(to_jsonb(e)::text,'' ORDER BY id),'')) FROM public.member_migrations e WHERE id::text NOT LIKE ${literal(`${prefix}%`)}) <> ${literal(before.events_hash)} THEN RAISE EXCEPTION 'Existing movements changed'; END IF;
END $$;
COMMIT;`;
privateWrite(resolve(ctx.dir,'mock-migration-manifest.json'),{project:PROJECT,anchor,marker,before,totals,rows});
privateWrite(resolve(ctx.dir,'seed-mock-migrations.sql'),sql);
privateWrite(resolve(ctx.dir,'cleanup-mock-migrations.sql'),`BEGIN;\nDELETE FROM public.member_migrations WHERE ${predicate};\nCOMMIT;\n`);
console.log(JSON.stringify({project:PROJECT,mode:ctx.execute?'execute':'preview',dateRange:[day(anchor,-29),day(anchor,-1)],branches:branches.map(branch=>branch.name),totals,artifacts:relative(ROOT,ctx.dir)},null,2));
if (ctx.execute) {
  query(ctx,sql,'apply-mock-migrations',true);
  const verified=query(ctx,`SELECT (SELECT count(*) FROM public.member_migrations) AS all_events,
    (SELECT count(*) FROM public.member_migrations WHERE ${predicate}) AS mock_events,
    (SELECT md5(coalesce(string_agg(to_jsonb(m)::text,'' ORDER BY id),'')) FROM public.members m) AS members_hash,
    (SELECT started_at FROM public.member_migration_tracking WHERE singleton) AS tracking_started,
    (SELECT jsonb_object_agg(kind,total) FROM (SELECT kind,count(*) total FROM public.member_migrations WHERE ${predicate} GROUP BY kind) k) AS kinds;`,'verify-mock-migrations')[0];
  assert.equal(Number(verified.mock_events),64);assert.equal(verified.members_hash,before.members_hash);
  assert.equal(verified.tracking_started,before.tracking_started);
  assert.equal(Number(verified.all_events),Number(before.event_count)+64);
  privateWrite(resolve(ctx.dir,'verification.json'),verified);
  console.log(JSON.stringify({verified,cleanup:relative(ROOT,resolve(ctx.dir,'cleanup-mock-migrations.sql'))},null,2));
}
