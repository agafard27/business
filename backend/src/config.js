import { readFile } from 'node:fs/promises';
import { configPath } from './paths.js';
import { unprotect } from './secrets.js';

export async function loadConfig(env = process.env) {
  let local = {};
  try { local = JSON.parse(await readFile(configPath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw Object.assign(new Error('Invalid local config'), { code: 'CONFIG_ERROR' }); }
  const config = {
    host: env.NAR_DB_HOST ?? local.host ?? '127.0.0.1',
    port: Number(env.NAR_DB_PORT ?? local.port ?? 3306),
    database: env.NAR_DB_NAME ?? local.database ?? 'nar_cicegi',
    user: env.NAR_DB_USER ?? local.user ?? 'nar_cicegi_backend',
    password: env.NAR_DB_PASSWORD ?? (local.protectedPassword ? await unprotect(local.protectedPassword) : ''),
    connectTimeout: 4000, charset: 'utf8mb4', timezone: 'Z',
    supportBigNumbers: true, bigNumberStrings: true, multipleStatements: false,
    enableKeepAlive: true
  };
  if (!['127.0.0.1', 'localhost', '::1'].includes(config.host) || !Number.isInteger(config.port) || config.port < 1 || config.port > 65535 ||
      !/^[a-z][a-z0-9_]{0,39}$/.test(config.database) || !/^[a-z][a-z0-9_]{0,39}$/.test(config.user))
    throw Object.assign(new Error('Invalid database settings'), { code: 'CONFIG_ERROR' });
  return config;
}
