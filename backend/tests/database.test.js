import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { once } from 'node:events';
import { withConnection } from '../src/database.js';

test('cevap vermeyen MySQL bağlantısına süre sınırı uygulanır', async t => {
  const sockets = new Set();
  const server = net.createServer(socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { for (const socket of sockets) socket.destroy(); server.close(); });
  const start = Date.now();
  await assert.rejects(withConnection({ host: '127.0.0.1', port: server.address().port, user: 'test', connectTimeout: 5000 }, async () => {}, 100), { code: 'NAR_DB_TIMEOUT' });
  assert.ok(Date.now() - start < 2000);
});
