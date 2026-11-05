/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');

test('contributor migration backfills without loss and enforces exclusive historical identities', { skip: !process.env.UPC_AUTHZ_TEST_PG_PORT }, () => {
  const database = `upc_contributors_${randomUUID().replaceAll('-', '')}`;
  function sql(source, db = database, fail = false) {
    const run = spawnSync('psql', ['-X', '-w', '-qAt', '-h', '127.0.0.1', '-p', process.env.UPC_AUTHZ_TEST_PG_PORT, '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1'], { input: source, encoding: 'utf8' });
    if (run.error) throw run.error;
    if (fail) { assert.notEqual(run.status, 0); return run.stderr; }
    assert.equal(run.status, 0, run.stderr);
    return run.stdout.replace(/\r\n/g, '\n').trim();
  }
  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  sql(`CREATE DATABASE ${database};`, 'postgres');
  try {
    sql(`CREATE TABLE public.financial_contributions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), member_id uuid, church_branch_id uuid NOT NULL, amount numeric(12,2) NOT NULL CHECK(amount>0));
      INSERT INTO public.financial_contributions(member_id,church_branch_id,amount) VALUES ('${id(1)}','${id(2)}',0.10),(NULL,'${id(3)}',0.20);`);
    sql(readFileSync('supabase/migrations/20261105090000_cross_branch_contributors.sql', 'utf8'));
    assert.equal(sql('SELECT contributor_type,amount,visitor_name IS NULL FROM public.financial_contributions ORDER BY amount;'), 'member|0.10|t\nanonymous|0.20|t');
    sql(`INSERT INTO public.financial_contributions(contributor_type,member_id,visitor_name,church_branch_id,amount) VALUES
      ('visitor',NULL,'Maria Santos','${id(3)}',300.00),('member','${id(1)}',NULL,'${id(3)}',500.00);`);
    assert.equal(sql(`SELECT sum(amount)::text FROM public.financial_contributions WHERE church_branch_id='${id(3)}';`), '800.20');
    for (const fields of [
      "'member',NULL,NULL", `'member','${id(1)}','Maria'`,
      "'visitor',NULL,NULL", "'visitor',NULL,'   '", `'visitor','${id(1)}','Maria'`,
      "'anonymous',NULL,'Maria'", `'anonymous','${id(1)}',NULL`, "'unknown',NULL,NULL",
      "'visitor',NULL,repeat('x',161)", "NULL,NULL,NULL",
    ]) assert.match(sql(`INSERT INTO public.financial_contributions(contributor_type,member_id,visitor_name,church_branch_id,amount) VALUES (${fields},'${id(2)}',1.00);`, database, true), /constraint|not-null/);
    assert.equal(sql("SELECT count(*) FROM public.financial_contributions WHERE visitor_name ILIKE '%maria%';"), '1');
    assert.equal(sql('SELECT count(*) FROM public.financial_contributions;'), '4');
  } finally { sql(`DROP DATABASE ${database} WITH (FORCE);`, 'postgres'); }
});
