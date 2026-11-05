import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Fixed commands only. No passthrough flags, linked targets or caller-provided DB URLs.
const commands = { start: ['start'], reset: ['db', 'reset'], status: ['status'] };
const action = process.argv[2];
if (!commands[action] || process.argv.length !== 3) throw new Error('Use local-db.mjs start|reset|status, without extra arguments.');
const env = { ...process.env };
for (const name of Object.keys(env)) {
  if (/^(SUPABASE_|PG|DATABASE_URL)/.test(name)) delete env[name];
}
const args = ['--yes', 'supabase@3.0.0', ...commands[action]];
const result = spawnSync(process.platform === 'win32' ? 'cmd.exe' : 'npx', process.platform === 'win32' ? ['/d', '/s', '/c', `npx.cmd ${args.join(' ')}`] : args, {
  cwd: fileURLToPath(new URL('..', import.meta.url)), env, stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
