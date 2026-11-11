import { createHash, randomBytes } from 'node:crypto';
import { withConnection, dbError } from '../database.js';
import { hashPassword, verifyPassword, passwordIsValid } from './password.js';
import { installPolicy, roles } from './policy.js';

export const SESSION_MS = 12 * 60 * 60 * 1000;
export const REMEMBER_SESSION_MS = 30 * 24 * 60 * 60 * 1000;
export const authError = (status, code, title) => Object.assign(new Error(), { status, code, title });
const invalid = title => authError(400, 'INVALID_INPUT', title);
const tokenHash = token => createHash('sha256').update(token).digest();
const publicUser = row => ({ id: String(row.id), loginName: row.login_name, displayName: row.display_name });

function identity(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid('Gönderilen bilgiler geçersiz.');
  const loginName = typeof input.loginName === 'string' ? input.loginName.trim().toLowerCase() : '';
  const displayName = typeof input.displayName === 'string' ? input.displayName.trim() : '';
  if (!/^[a-z0-9_.-]{3,80}$/.test(loginName)) throw invalid('Kullanıcı adı 3–80 karakter olmalı; harf, rakam, nokta, alt çizgi veya tire kullanın.');
  if (!displayName || [...displayName].length > 160 || /[\u0000-\u001f\u007f]/u.test(displayName)) throw invalid('Ad soyad 1–160 karakter olmalı.');
  if (!passwordIsValid(input.password)) throw invalid('Parola 6–128 karakter olmalı.');
  return { loginName, displayName, password: input.password };
}

async function userAccess(connection, userId) {
  const [users] = await connection.execute('SELECT id, login_name, display_name FROM app_users WHERE id = ? AND is_active = TRUE', [userId]);
  if (!users.length) return null;
  const [assigned] = await connection.execute('SELECT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ? ORDER BY r.code', [userId]);
  // Approval/amount-restricted grants are not unrestricted endpoint permission.
  const [grants] = await connection.execute(`SELECT DISTINCT p.code FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = ? AND rp.requires_approval = FALSE AND rp.amount_limit_minor IS NULL ORDER BY p.code`, [userId]);
  const [rules]=await connection.execute(`SELECT p.code,rp.requires_approval,rp.amount_limit_minor FROM user_roles ur JOIN role_permissions rp ON rp.role_id=ur.role_id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=? ORDER BY p.code`,[userId]);
  return { ...publicUser(users[0]), roles: assigned.map(row => row.code), permissions: grants.map(row => row.code),permissionRules:rules.map(row=>({code:row.code,requiresApproval:Boolean(row.requires_approval),amountLimitMinor:row.amount_limit_minor===null?null:String(row.amount_limit_minor)})) };
}

async function newSession(connection, userId, previousToken, durationMs = SESSION_MS) {
  if (previousToken) await connection.execute('UPDATE user_sessions SET revoked_at_utc = UTC_TIMESTAMP(6) WHERE token_hash = ? AND revoked_at_utc IS NULL', [tokenHash(previousToken)]);
  const token = randomBytes(32).toString('base64url');
  // Use server UTC for expiry and verification to avoid host time zone conversion.
  await connection.execute('INSERT INTO user_sessions(user_id, token_hash, expires_at_utc) VALUES (?, ?, TIMESTAMPADD(SECOND, ?, UTC_TIMESTAMP(6)))', [userId, tokenHash(token), durationMs / 1000]);
  return token;
}

async function audit(connection, action, actorId, targetId) {
  await connection.execute(`INSERT INTO audit_events(actor_user_id, action_code, outcome, metadata_json)
    VALUES (?, ?, 'succeeded', ?)`, [actorId, action, JSON.stringify({ targetUserId: String(targetId) })]);
}

export function createAuthService(config) {
  const read = action => withConnection(config, action);
  async function transaction(action, bootstrap = false) {
    let commitStarted = false;
    try {
      return await withConnection(config, async connection => {
        let locked = false;
        try {
          if (bootstrap) {
            const [[row]] = await connection.execute('SELECT GET_LOCK(?, 5) AS acquired', [`${config.database}:first-owner`]);
            if (Number(row.acquired) !== 1) throw authError(409, 'SETUP_BUSY', 'Kurulum başka bir pencerede sürüyor. Kısa süre sonra tekrar deneyin.');
            locked = true;
          }
          await connection.beginTransaction();
          const result = await action(connection);
          commitStarted = true;
          await connection.commit();
          return result;
        } catch (error) {
          if (commitStarted) throw dbError('COMMIT_UNKNOWN');
          try { await connection.rollback(); } catch { /* The connection is discarded. */ }
          throw error;
        } finally {
          if (locked) {
            // Keep bootstrap lock through commit; lost connections release it in MySQL.
            try { await connection.execute('SELECT RELEASE_LOCK(?)', [`${config.database}:first-owner`]); } catch { }
          }
        }
      }, 12000);
    } catch (error) {
      if (commitStarted && !error.status) throw dbError('COMMIT_UNKNOWN');
      throw error;
    }
  }
  async function currentUser(token, connection) {
    if (!token) return null;
    const [sessions] = await connection.execute(`SELECT user_id FROM user_sessions
      WHERE token_hash = ? AND revoked_at_utc IS NULL AND expires_at_utc > UTC_TIMESTAMP(6)`, [tokenHash(token)]);
    return sessions.length ? userAccess(connection, sessions[0].user_id) : null;
  }
  return {
    async status(token) {
      return read(async connection => {
        const [[row]] = await connection.query('SELECT EXISTS(SELECT 1 FROM app_users) AS has_users');
        return { setupRequired: !Number(row.has_users), user: await currentUser(token, connection) };
      });
    },
    authenticate: token => read(connection => currentUser(token, connection)),
    async setup(input, previousToken) {
      const values = identity(input);
      const passwordHash = await hashPassword(values.password);
      return transaction(async connection => {
        const [[count]] = await connection.query('SELECT COUNT(*) AS count FROM app_users');
        if (Number(count.count)) throw authError(409, 'SETUP_COMPLETE', 'İlk kurulum tamamlanmış. Kullanıcı adınız ve parolanızla giriş yapın.');
        await installPolicy(connection);
        const [result] = await connection.execute('INSERT INTO app_users(login_name, display_name, password_hash) VALUES (?, ?, ?)', [values.loginName, values.displayName, passwordHash]);
        await connection.execute("INSERT INTO user_roles(user_id, role_id) SELECT ?, id FROM roles WHERE code = 'owner'", [result.insertId]);
        const token = await newSession(connection, result.insertId, previousToken);
        await audit(connection, 'auth.setup', result.insertId, result.insertId);
        return { user: await userAccess(connection, result.insertId), token };
      }, true);
    },
    async login(input, previousToken) {
      if (input?.rememberMe !== undefined && typeof input.rememberMe !== 'boolean') throw invalid('Beni hatırla seçimi geçersiz.');
      const rememberMe = input?.rememberMe === true;
      const loginName = typeof input?.loginName === 'string' ? input.loginName.trim().toLowerCase() : '';
      // Malformed input is rejected before expensive work; unknown valid names have constant-cost hash verification.
      if (!/^[a-z0-9_.-]{3,80}$/.test(loginName) || typeof input?.password !== 'string' || Buffer.byteLength(input.password, 'utf8') > 512) {
        throw authError(401, 'INVALID_CREDENTIALS', 'Kullanıcı adı veya parola hatalı.');
      }
      const row = await read(async connection => {
        const [rows] = await connection.execute('SELECT id, password_hash, is_active FROM app_users WHERE login_name = ?', [loginName]);
        return rows[0];
      });
      if (!await verifyPassword(input.password, row?.password_hash) || !row?.is_active) throw authError(401, 'INVALID_CREDENTIALS', 'Kullanıcı adı veya parola hatalı.');
      return transaction(async connection => {
        // Re-read after hashing: activation/password may have changed meanwhile.
        const [rows] = await connection.execute('SELECT password_hash FROM app_users WHERE id = ? AND is_active = TRUE FOR UPDATE', [row.id]);
        if (!rows.length || rows[0].password_hash !== row.password_hash) throw authError(401, 'INVALID_CREDENTIALS', 'Kullanıcı adı veya parola hatalı.');
        const token = await newSession(connection, row.id, previousToken, rememberMe ? REMEMBER_SESSION_MS : SESSION_MS);
        await audit(connection, 'auth.login', row.id, row.id);
        return { user: await userAccess(connection, row.id), token, rememberMe };
      });
    },
    async logout(token) {
      if (token) await transaction(async connection => {
        const [sessions] = await connection.execute(`SELECT user_id FROM user_sessions WHERE token_hash = ?
          AND revoked_at_utc IS NULL AND expires_at_utc > UTC_TIMESTAMP(6) FOR UPDATE`, [tokenHash(token)]);
        if (!sessions.length) return;
        await connection.execute('UPDATE user_sessions SET revoked_at_utc = UTC_TIMESTAMP(6) WHERE token_hash = ?', [tokenHash(token)]);
        await audit(connection, 'auth.logout', sessions[0].user_id, sessions[0].user_id);
      });
    },
    async listUsers() {
      return read(async connection => {
        const [users] = await connection.query('SELECT id, login_name, display_name, is_active, revision FROM app_users ORDER BY display_name, id LIMIT 1000');
        const [assigned] = await connection.query('SELECT ur.user_id, r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id ORDER BY r.code');
        const [knownRoles] = await connection.query('SELECT code, name FROM roles ORDER BY code');
        return { users: users.map(row => ({ ...publicUser(row), revision: String(row.revision), isActive: Boolean(row.is_active), roles: assigned.filter(role => String(role.user_id) === String(row.id)).map(role => role.code) })), roles: knownRoles };
      });
    },
    async createUser(input, actorId) {
      const values = identity(input);
      if (!Array.isArray(input.roleCodes) || !input.roleCodes.length || input.roleCodes.length > roles.length
        || new Set(input.roleCodes).size !== input.roleCodes.length || input.roleCodes.some(code => !roles.some(role => role.code === code))) throw invalid('En az bir geçerli görev seçin.');
      const passwordHash = await hashPassword(values.password);
      try {
        return await transaction(async connection => {
          const [result] = await connection.execute('INSERT INTO app_users(login_name, display_name, password_hash) VALUES (?, ?, ?)', [values.loginName, values.displayName, passwordHash]);
          for (const code of input.roleCodes) {
            const [assigned] = await connection.execute('INSERT INTO user_roles(user_id, role_id) SELECT ?, id FROM roles WHERE code = ?', [result.insertId, code]);
            if (assigned.affectedRows !== 1) throw invalid('Görev tanımı bulunamadı.');
          }
          await audit(connection, 'users.create', actorId, result.insertId);
          return { ...await userAccess(connection, result.insertId), isActive: true };
        });
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') throw authError(409, 'LOGIN_NAME_TAKEN', 'Bu kullanıcı adı kullanılıyor.');
        throw error;
      }
    }
  };
}
