/* eslint-disable @typescript-eslint/no-require-imports -- Real PostgreSQL migration regression. */
const test = require('node:test'), assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
test('email migration removes duplicate state and preserves links, Auth changes and profile deletion cleanup', { skip: !process.env.UPC_AUTHZ_TEST_PG_PORT }, () => {
  const db = 'upc_email_' + randomUUID().replaceAll('-', '');
  function sql(input, database = db) {
    const result = spawnSync('psql', ['-X', '-w', '-qAt', '-h', '127.0.0.1', '-p', process.env.UPC_AUTHZ_TEST_PG_PORT, '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1'], { input, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
  }
  sql('CREATE DATABASE ' + db, 'postgres');
  try {
    sql(`CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
      CREATE TABLE profiles(id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE);
      CREATE TABLE members(id uuid PRIMARY KEY,first_name text NOT NULL,last_name text NOT NULL,email text,account_status text DEFAULT 'no_account',updated_at timestamptz DEFAULT now());
      CREATE TABLE account_members(user_id uuid REFERENCES profiles ON DELETE CASCADE,member_id uuid REFERENCES members);
      CREATE TABLE member_field_definitions(id int PRIMARY KEY,field_key text);
      CREATE TABLE member_custom_field_values(field_definition_id int REFERENCES member_field_definitions,value jsonb);
      CREATE FUNCTION handle_profile_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE members SET email=NULL,account_status='no_account' WHERE id IN(SELECT member_id FROM account_members WHERE user_id=old.id);RETURN old;END $$;
      CREATE TRIGGER before_profile_delete_cleanup_members BEFORE DELETE ON profiles FOR EACH ROW EXECUTE FUNCTION handle_profile_delete();
      INSERT INTO auth.users VALUES ('00000000-0000-4000-8000-000000000001','current@example.test');
      INSERT INTO profiles SELECT id FROM auth.users;
      INSERT INTO members(id,first_name,last_name,email,account_status) VALUES ('00000000-0000-4000-8000-000000000002','Linked','Member','stale@example.test','connected');
      INSERT INTO account_members SELECT p.id,m.id FROM profiles p,members m;
      INSERT INTO member_field_definitions VALUES (1,'email'),(2,'phone_number');
      INSERT INTO member_custom_field_values VALUES (1,'"discard obsolete"'),(2,'"preserve"');`);
    sql(readFileSync('supabase/migrations/20261108090000_remove_member_email.sql', 'utf8'));
    assert.equal(sql("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='members' AND column_name='email'"), '0');
    assert.equal(sql('SELECT count(*) FROM account_members'), '1');
    assert.equal(sql('SELECT count(*) FROM member_field_definitions'), '1');
    assert.equal(sql('SELECT value FROM member_custom_field_values'), '"preserve"');
    sql("UPDATE auth.users SET email='changed@example.test'");
    assert.equal(sql('SELECT u.email FROM members m JOIN account_members am ON am.member_id=m.id JOIN auth.users u ON u.id=am.user_id'), 'changed@example.test');
    sql("INSERT INTO members(id,first_name,last_name) VALUES ('00000000-0000-4000-8000-000000000003','Unlinked','Member')");
    sql('DELETE FROM auth.users');
    assert.equal(sql('SELECT count(*) FROM account_members'), '0');
    assert.equal(sql("SELECT account_status FROM members WHERE first_name='Linked'"), 'no_account');
    assert.equal(sql('SELECT count(*) FROM members'), '2');
  } finally { sql('DROP DATABASE ' + db + ' WITH (FORCE)', 'postgres'); }
});
