import { networkInterfaces } from 'node:os';
import { createSocket } from 'node:dgram';
import { isIP } from 'node:net';

export function assertLanHost(host) {
  if (isIP(host) !== 4) throw new Error('LAN host must be a private IPv4 address.');
  const [a, b] = host.split('.').map(Number);
  if (!(a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168))) {
    throw new Error('LAN host must be a private IPv4 address (10/8, 172.16/12 or 192.168/16).');
  }
  return host;
}

// Node exposes assigned interfaces, but no portable physical-adapter/default-route
// metadata. Rank recognizable physical names, exclude known virtual names, and
// refuse equally plausible addresses rather than guessing a default route.
export function selectInterfaceHost(interfaces = networkInterfaces) {
  const candidates = [];
  const virtual = /docker|wsl|hyper-v|vethernet|virtual|vmware|vbox|vpn|tailscale|zerotier|wireguard|loopback|bluetooth|\btun\d*\b|\btap\d*\b|^br-|^virbr|^veth|^utun|hamachi/i;
  const physical = /wi-?fi|wireless|ethernet|^wlan\d|^wl[pox]|^eth\d|^en[opsx]|^en\d/i;
  for (const [name, entries] of Object.entries(interfaces())) {
    if (virtual.test(name)) continue;
    for (const entry of entries ?? []) {
      if (entry.internal || !['IPv4', 4].includes(entry.family)) continue;
      try { assertLanHost(entry.address); } catch { continue; }
      candidates.push({ name, address: entry.address, rank: physical.test(name) ? 1 : 0 });
    }
  }
  candidates.sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name) || a.address.localeCompare(b.address));
  const best = candidates.filter(candidate => candidate.rank === candidates[0]?.rank);
  const addresses = [...new Set(best.map(candidate => candidate.address))];
  if (addresses.length === 1) return addresses[0];
  const details = candidates.map(candidate => `${candidate.name}: ${candidate.address}`).join(', ') || 'none (virtual/loopback/public adapters excluded)';
  throw new Error(`Cannot select a unique private LAN IPv4. Candidates: ${details}. Set UPC_LOCAL_LAN_HOST to the intended private IPv4 override.`);
}

// UDP connect asks the routing table for a source address. No datagram is sent,
// no DNS lookup is made and no remote response is needed.
export function probeRouteAddress(socketFactory = createSocket, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    let socket, timer, settled = false;
    function finish(error, address) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { socket?.close(); } catch { /* Already closed or never bound. */ }
      if (error) reject(error); else resolve(address);
    }
    try {
      socket = socketFactory('udp4');
      socket.once('error', error => finish(error));
      timer = setTimeout(() => finish(new Error('IPv4 route probe timed out.')), timeoutMs);
      socket.connect(53, '8.8.8.8', () => {
        if (settled) return;
        try { finish(null, socket.address().address); } catch (error) { finish(error); }
      });
    } catch (error) { finish(error); }
  });
}

export async function resolveLanHost(override, { probe = probeRouteAddress, interfaces = networkInterfaces } = {}) {
  if (override !== undefined && override !== '') return assertLanHost(override);
  try { return assertLanHost(await probe()); }
  catch (routeError) {
    try { return selectInterfaceHost(interfaces); }
    catch (error) { throw new Error(`Route detection unavailable (${routeError.message}). ${error.message}`); }
  }
}
