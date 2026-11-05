import { readFileSync, existsSync } from 'node:fs';

// Never implicitly load .env.local: it may contain hosted credentials.
export function loadLocalEnv() {
  const file = new URL('../.env.supabase.local', import.meta.url);
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (match && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
      }
    }
  }
}

export function assertLoopback(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Local setup requires a loopback Supabase URL with no path or credentials.');
  }
  return url.href;
}
