/* eslint-disable @typescript-eslint/no-require-imports -- PostgreSQL migration regression. */
const test = require('node:test'), assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process'), { randomUUID } = require('node:crypto'), { readFileSync } = require('node:fs');
test('performer conversion preserves custom names, resolves UUID names and defaults to creator', { skip: !process.env.UPC_AUTHZ_TEST_PG_PORT }, () => {
  const db = 'upc_performer_' + randomUUID().replaceAll('-', '');
  function sql(source, database = db) {
    const r = spawnSync('psql', ['-X', '-w', '-qAt', '-h', '127.0.0.1', '-p', process.env.UPC_AUTHZ_TEST_PG_PORT, '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1'], { input: source, encoding: 'utf8' });
    if (r.error) throw r.error;
    assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
  }
  sql('CREATE DATABASE ' + db, 'postgres');
  try {
    sql(`CREATE TABLE profiles(id uuid PRIMARY KEY,display_name text);
      INSERT INTO profiles VALUES ('00000000-0000-0000-0000-000000000001','Linked Performer'),('00000000-0000-0000-0000-000000000002','Original Creator');
      CREATE TABLE member_follow_ups(id int PRIMARY KEY,followed_up_by uuid REFERENCES profiles(id),followed_up_by_name text,created_by uuid REFERENCES profiles(id),notes text);
      INSERT INTO member_follow_ups VALUES
      (1,'00000000-0000-0000-0000-000000000001',NULL,'00000000-0000-0000-0000-000000000002','keep'),
      (2,'00000000-0000-0000-0000-000000000001',' Custom Name ','00000000-0000-0000-0000-000000000002','keep'),
      (3,NULL,' ','00000000-0000-0000-0000-000000000002','keep'),(4,NULL,NULL,NULL,'keep');`);
    sql(readFileSync('supabase/migrations/20261109100000_follow_up_performer_text.sql', 'utf8'));
    assert.equal(sql(`SELECT data_type FROM information_schema.columns WHERE table_name='member_follow_ups' AND column_name='followed_up_by'`), 'text');
    assert.equal(sql(`SELECT count(*) FROM information_schema.columns WHERE table_name='member_follow_ups' AND column_name='followed_up_by_name'`), '0');
    assert.deepEqual(JSON.parse(sql('SELECT json_agg(followed_up_by ORDER BY id) FROM member_follow_ups')), ['Linked Performer', 'Custom Name', 'Original Creator', null]);
    sql("UPDATE member_follow_ups SET followed_up_by='A person without an account' WHERE id=1; DELETE FROM profiles WHERE id='00000000-0000-0000-0000-000000000001';");
    assert.equal(sql('SELECT count(*) FROM member_follow_ups WHERE notes=\'keep\''), '4');
  } finally { sql('DROP DATABASE ' + db + ' WITH (FORCE)', 'postgres'); }
});
