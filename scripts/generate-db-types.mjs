import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// Fixed local target only; never infer a linked/hosted project from credentials.
const env = { ...process.env };
for (const key of Object.keys(env)) if (/^(PG|SUPABASE_|DATABASE_URL)/.test(key)) delete env[key];
const result = spawnSync('cmd.exe', ['/d', '/s', '/c', 'npx.cmd --yes supabase@3.0.0 gen types --schema public'], {
  cwd: fileURLToPath(new URL('../', import.meta.url)), env, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
});
if (result.error || result.status !== 0 || !result.stdout.includes('export type Database')) throw new Error('Local Supabase type generation failed.');
writeFileSync(new URL('../lib/database.types.ts', import.meta.url), result.stdout);
console.log('Generated lib/database.types.ts from local Supabase.');
