import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const PROJECT = 'uuionqwconjeguxcwnla';
export const TARGET = `https://${PROJECT}.supabase.co`;
export const REFERENCES = ['roles', 'permissions', 'role_permissions', 'service_types', 'departments', 'member_field_definitions'];
export const OPERATIONS = ['ai_report_documents', 'attendance_records', 'financial_contributions', 'baptism_records', 'member_follow_ups', 'member_custom_field_values', 'account_members', 'members', 'services', 'user_branch_access', 'user_roles'];
export const privateWrite = (path, value) => writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value, null, 2), { mode: 0o600 });
export const hash = value => createHash('sha256').update(value).digest('hex');
export function assertTarget(url, flag) {
  if (url !== TARGET || flag !== 'true') throw new Error(`Requires exact target ${TARGET} and UPC_ALLOW_HOSTED_DEMO_RESET=true.`);
}
export function context(args = process.argv.slice(2)) {
  // Hosted tooling deliberately does NOT load .env.supabase.local or mutate local development env.
  const configFile = resolve(ROOT, '.env.hosted-demo.local');
  if (existsSync(configFile)) {
    for (const line of readFileSync(configFile, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  const url = process.env.UPC_HOSTED_DEMO_URL;
  assertTarget(url, process.env.UPC_ALLOW_HOSTED_DEMO_RESET);
  const key = process.env.UPC_HOSTED_DEMO_SECRET_KEY;
  if (!key) throw new Error('Missing UPC_HOSTED_DEMO_SECRET_KEY in private hosted configuration.');
  const execute = args.includes('--execute');
  const allowed = new Set(['--execute', `--confirm=${PROJECT}`]);
  if (args.some(arg => !allowed.has(arg))) throw new Error('Unknown command argument.');
  if (execute && !args.includes(`--confirm=${PROJECT}`)) throw new Error(`Execution requires --confirm=${PROJECT}.`);
  const dir = resolve(ROOT, 'supabase/.temp/hosted-demo', `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`);
  mkdirSync(dir, { recursive: true });
  console.log(`Hosted QA/demo target: ${url} (${PROJECT}); ${execute ? 'EXECUTE' : 'DRY RUN (no mutations)'}`);
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, redirect: 'error' }) } });
  return { dir, execute, client, url, publicKey: process.env.UPC_HOSTED_DEMO_PUBLIC_KEY };
}
export function cli(ctx, args, label) {
  const argv = ['--yes', 'supabase@3.0.0', ...args];
  // Only fixed CLI arguments and workspace-generated paths enter the Windows command line.
  if (argv.some(a => !/^[a-zA-Z0-9_./,:=@-]+$/.test(a))) throw new Error('Unsafe CLI argument.');
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(PG|DATABASE_URL|SUPABASE_DB)/.test(key)) delete env[key];
  const result = spawnSync('cmd.exe', ['/d', '/s', '/c', `npx.cmd ${argv.join(' ')}`], { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 240000 });
  privateWrite(resolve(ctx.dir, `${label}.log`), `${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  if (result.error || result.status !== 0) throw new Error(`${label} failed. Inspect private log in ${relative(ROOT, ctx.dir)}.`);
  return result.stdout;
}
export function query(ctx, sql, label, write = false) {
  if (write && !ctx.execute) throw new Error('Write blocked in dry run.');
  const path = resolve(ctx.dir, `${label}.sql`);
  privateWrite(path, sql);
  const stdout = cli(ctx, ['db', 'query', `--remote=${PROJECT}`, '--file', relative(ROOT, path).replaceAll('\\', '/'), ...(write ? ['--yes'] : ['--read-only'])], label);
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  if (start < 0) return [];
  return JSON.parse(stdout.slice(start, end + 1)).rows ?? [];
}
export const literal = value => value === null || value === undefined ? 'NULL' : typeof value === 'boolean' || typeof value === 'number' ? String(value) : `'${String(value).replaceAll("'", "''")}'`;
export function insert(table, rows) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  return `INSERT INTO public.${table} (${keys.join(',')}) VALUES\n${rows.map(row => `(${keys.map(k => literal(row[k])).join(',')})`).join(',\n')};\n`;
}
export function snapshot(ctx, label) {
  const counts = [...REFERENCES, ...OPERATIONS, 'profiles', 'church_branches'].map(table => `${literal(table)},(SELECT count(*) FROM public.${table})`).join(',');
  const refs = REFERENCES.map(table => `${literal(table)},(SELECT md5(coalesce(string_agg(row_to_json(t)::text, '' ORDER BY row_to_json(t)::text),'')) FROM public.${table} t)`).join(',');
  const [row] = query(ctx, `SELECT jsonb_build_object(${counts}) counts, jsonb_build_object(${refs}) AS "references",
    (SELECT md5(string_agg(row_to_json(m)::text,'' ORDER BY version)) FROM supabase_migrations.schema_migrations m) migrations,
    (SELECT md5(string_agg(value,'' ORDER BY value)) FROM (
      SELECT pg_get_functiondef(p.oid)||coalesce(p.proacl::text,'') value FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
      UNION ALL SELECT row_to_json(p)::text FROM pg_policies p WHERE schemaname='public'
      UNION ALL SELECT indexdef FROM pg_indexes WHERE schemaname='public'
      UNION ALL SELECT pg_get_triggerdef(t.oid)||t.tgenabled::text FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth') AND NOT t.tgisinternal
      UNION ALL SELECT c.relname||c.relrowsecurity::text||c.relforcerowsecurity::text||coalesce(c.relacl::text,'') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'
      UNION ALL SELECT pg_get_constraintdef(c.oid)||c.conname FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public'
    ) security) security;`, label);
  if (!row?.counts || !row.references || !row.security || !row.migrations) throw new Error('Incomplete preservation snapshot.');
  privateWrite(resolve(ctx.dir, `${label}.json`), row);
  return row;
}
export function assertPreserved(before, after) {
  for (const key of ['references', 'migrations', 'security']) if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) throw new Error(`Preservation check failed: ${key}.`);
}
export async function authUsers(client) {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(`Auth user inventory failed (${error.status ?? 'unknown'}).`);
    users.push(...data.users);
    if (data.users.length < 100) return users;
  }
}
export function backup(ctx, before) {
  console.log('Taking private timestamped schema and public + Auth data backups before mutation.');
  const paths = {};
  for (const [name, flags] of [['schema', []], ['data', ['--data-only', '--use-copy']]]) {
    const path = resolve(ctx.dir, `${name}.sql`);
    cli(ctx, ['db', 'dump', `--remote=${PROJECT}`, '--schema', 'public,auth', '-f', relative(ROOT, path).replaceAll('\\', '/'), ...flags], `backup-${name}`);
    if (!existsSync(path)) throw new Error('Backup missing. No mutation allowed.');
    const content = readFileSync(path, 'utf8');
    if (content.length < 100) throw new Error('Backup incomplete.');
    if (name === 'data' && !/COPY\s+"?auth"?\."?users"?\s*\([^;]*encrypted_password/i.test(content)) throw new Error('Auth password backup missing. No mutation allowed.');
    paths[name] = { file: relative(ROOT, path), sha256: hash(content) };
  }
  privateWrite(resolve(ctx.dir, 'backup-manifest.json'), { project: PROJECT, createdAt: new Date().toISOString(), before, files: paths });
  console.log(`Backup verified: ${relative(ROOT, ctx.dir)} (contains sensitive Auth data; keep private).`);
}
