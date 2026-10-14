// Test-only fetch guard. This is application isolation, not an OS firewall.
const fs = require('node:fs');
const originalFetch = globalThis.fetch;
const audit = { startedAt: new Date().toISOString(), allowed: {}, blocked: [], mode: 'loopback-fetch-only', osNetworkDisconnected: false };
globalThis.fetch = function(input, init) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !['http:', 'https:'].includes(url.protocol)) {
    audit.blocked.push(url.origin);
    return Promise.reject(new Error('OFFLINE_GUARD: non-loopback fetch blocked'));
  }
  audit.allowed[url.origin] = (audit.allowed[url.origin] || 0) + 1;
  return originalFetch(input, init);
};
if (process.env.OFFLINE_AUDIT) process.on('exit', () => fs.writeFileSync(process.env.OFFLINE_AUDIT, JSON.stringify(audit, null, 2)));
