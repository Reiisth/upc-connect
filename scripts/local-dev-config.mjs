import { isIP } from 'node:net';
import { assertLoopback } from './local-env.mjs';

export function assertLanHost(host) {
  if (host === 'localhost') return host;
  if (isIP(host) !== 4) throw new Error('LAN host must be a private IPv4 address or localhost.');
  const [a, b] = host.split('.').map(Number);
  if (!(a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168))) {
    throw new Error('LAN host must be a private IPv4 address or loopback.');
  }
  return host;
}

export function localDevConfig(env, lan = false) {
  const internalUrl = assertLoopback(env.NEXT_PUBLIC_SUPABASE_URL || '');
  if (!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || !env.SUPABASE_SECRET_KEY) throw new Error('Local public and server keys are required.');
  const childEnv = { ...env, UPC_LOCAL_INTERNAL_SUPABASE_URL: internalUrl };
  // Only the explicit LAN command may consume the optional host setting.
  delete childEnv.UPC_LOCAL_LAN_HOST;
  if (lan) {
    const host = assertLanHost(env.UPC_LOCAL_LAN_HOST || '');
    const browserUrl = new URL(internalUrl);
    browserUrl.protocol = 'http:';
    browserUrl.hostname = host;
    childEnv.NEXT_PUBLIC_SUPABASE_URL = browserUrl.origin;
    childEnv.UPC_LOCAL_LAN_HOST = host;
  }
  return { env: childEnv, args: ['node_modules/next/dist/bin/next', 'dev', '--hostname', lan ? '0.0.0.0' : '127.0.0.1'] };
}
