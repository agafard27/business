import mysql from 'mysql2';

export const dbError = code => Object.assign(new Error(code), { code });

export async function withConnection(config, action, timeoutMs = 6000) {
  const raw = mysql.createConnection(config);
  // mysql2 emits transport errors even outside a command. Operations still reject;
  // observing the event prevents an unhandled EventEmitter error from killing Node.
  raw.on('error', () => {});
  const connection = raw.promise();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => { raw.destroy(); reject(dbError('NAR_DB_TIMEOUT')); }, timeoutMs);
  });
  try {
    return await Promise.race([(async () => { await connection.connect(); return action(connection); })(), deadline]);
  } finally { clearTimeout(timer); raw.destroy(); }
}

export function createDatabasePool(config) {
  const pool = mysql.createPool({ ...config, connectionLimit: 10, maxIdle: 5, idleTimeout: 60000,
    waitForConnections: false, queueLimit: 0 });
  pool.on('connection', connection => connection.on('error', () => {}));
  return pool.promise();
}

// No automatic retry of writes: a lost commit response has an unknown outcome.
// Future sales commands will add an idempotency key inside their transaction.
export async function inTransaction(pool, action, timeoutMs = 8000) {
  const connection = await pool.getConnection();
  let timer;
  let commitStarted = false;
  let reusable = true;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => { reusable = false; connection.destroy(); reject(dbError(commitStarted ? 'COMMIT_UNKNOWN' : 'NAR_DB_TIMEOUT')); }, timeoutMs);
  });
  try {
    return await Promise.race([(async () => {
      await connection.beginTransaction();
      const result = await action(connection);
      commitStarted = true;
      await connection.commit();
      return result;
    })(), deadline]);
  } catch (error) {
    if (commitStarted) { reusable = false; connection.destroy(); throw dbError('COMMIT_UNKNOWN'); }
    if (reusable) {
      try { await connection.rollback(); } catch { reusable = false; connection.destroy(); }
    }
    throw error;
  } finally { clearTimeout(timer); if (reusable) connection.release(); }
}
