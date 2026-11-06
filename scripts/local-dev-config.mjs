import { assertLoopback } from './local-env.mjs';
import { resolveLanHost } from './local-lan-host.mjs';
export { assertLanHost } from './local-lan-host.mjs';

export async function localDevConfig(env, lan = false, discovery) {
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');
  const internalUrl = assertLoopback(env.NEXT_PUBLIC_SUPABASE_URL || '');
  if (!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || !env.SUPABASE_SECRET_KEY) throw new Error('Local public and server keys are required.');
  const childEnv = { ...env, UPC_LOCAL_INTERNAL_SUPABASE_URL: internalUrl };
  // Only the explicit LAN command may consume the optional host setting.
  delete childEnv.UPC_LOCAL_LAN_HOST;
  if (lan) {
    const host = await resolveLanHost(env.UPC_LOCAL_LAN_HOST, discovery);
    const browserUrl = new URL(internalUrl);
    browserUrl.protocol = 'http:';
    browserUrl.hostname = host;
    childEnv.NEXT_PUBLIC_SUPABASE_URL = browserUrl.origin;
    childEnv.UPC_LOCAL_LAN_HOST = host;
  }
  return { env: childEnv, port, args: ['node_modules/next/dist/bin/next', 'dev', '--port', String(port), '--hostname', lan ? '0.0.0.0' : '127.0.0.1'] };
}
