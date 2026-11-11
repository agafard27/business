import test from 'node:test';
import assert from 'node:assert/strict';
import { createMonitor } from '../src/monitor.js';

test('kesinti, toparlanma ve eski durum bilgisi', async () => {
  let clock = Date.now();
  let failure = false;
  const monitor = createMonitor(async () => { if (failure) throw Object.assign(new Error('DO_NOT_EXPOSE_PASSWORD'), { code: 'ECONNREFUSED' }); return 1; }, { now: () => clock, staleMs: 100, logger() {} });
  assert.equal(monitor.status().ready, false);
  await monitor.check();
  assert.equal(monitor.status().ready, true);
  const success = monitor.status().lastSuccessAtUtc;
  clock += 101;
  assert.equal(monitor.status().state, 'stale');
  failure = true;
  await monitor.check();
  assert.equal(monitor.status().ready, false);
  assert.equal(monitor.status().lastSuccessAtUtc, success);
  assert.ok(!JSON.stringify(monitor.status()).includes('DO_NOT_EXPOSE_PASSWORD'));
  failure = false;
  await monitor.check();
  assert.equal(monitor.status().ready, true);
});

test('aynı anda birden fazla veritabanı kontrolü başlatılmaz', async () => {
  let count = 0;
  let resolve;
  const monitor = createMonitor(() => { count++; return new Promise(done => { resolve = done; }); }, { logger() {} });
  const first = monitor.check();
  await monitor.check();
  assert.equal(count, 1);
  resolve(1);
  await first;
});

test('şema ve erişim hataları hazır sayılmaz', async () => {
  for (const code of ['SCHEMA_MISMATCH', 'ER_NO_SUCH_TABLE', 'ER_ACCESS_DENIED_ERROR', 'CONFIG_ERROR']) {
    const monitor = createMonitor(async () => { throw Object.assign(new Error(), { code }); }, { logger() {} });
    await monitor.check();
    assert.equal(monitor.status().ready, false);
    assert.notEqual(monitor.status().state, 'ready');
  }
});
