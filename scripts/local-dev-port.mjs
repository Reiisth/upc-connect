import { createConnection } from 'node:net';

export async function assertDevPortAvailable(port) {
  // A wildcard Next listener is reachable on loopback too. Probe both IP families
  // without depending on firewall behavior for connections to our own LAN IP.
  const hosts = ['127.0.0.1', '::1'];
  await Promise.all(hosts.map(host => new Promise((resolve, reject) => {
    const socket = createConnection({ host, port });
    socket.once('connect', () => {
      socket.destroy();
      reject(new Error(`Port ${port} already has a listener on ${host}. Stop the existing Next.js server before starting another local runtime.`));
    });
    socket.once('error', error => {
      socket.destroy();
      if (['ECONNREFUSED', 'EADDRNOTAVAIL', 'ENETUNREACH', 'EHOSTUNREACH'].includes(error.code)) resolve();
      else reject(error);
    });
    socket.setTimeout(1000, () => {
      socket.destroy();
      reject(new Error(`Could not verify that port ${port} on ${host} is free.`));
    });
  })));
}
