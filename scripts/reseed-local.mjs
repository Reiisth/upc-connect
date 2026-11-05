import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
if (process.argv.length !== 2) throw new Error('Local reseed accepts no target arguments.');
const env = { ...process.env };
for (const name of Object.keys(env)) if (/^PG/.test(name)) delete env[name];
env.PGPASSWORD = process.env.UPC_LOCAL_DB_PASSWORD || 'postgres';
const result = spawnSync('psql', ['-X', '-w', '-h', '127.0.0.1', '-p', '54322', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-f', 'supabase/seed.sql'], {
  cwd: fileURLToPath(new URL('..', import.meta.url)), env, stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
