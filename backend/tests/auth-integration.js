import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { withConnection } from '../src/database.js';
import { createAuthService } from '../src/auth/service.js';

// Only the disposable integration MySQL instance may call this helper.
export async function checkAuthFlows(base, config) {
  const password = randomBytes(3).toString('hex');
  let otherPassword = randomBytes(3).toString('hex');
  while (otherPassword === password) otherPassword = randomBytes(3).toString('hex');
  const headers = { 'Content-Type': 'application/json', 'X-Nar-Request': '1', Origin: base };
  const request = (route, { cookie, data, extraHeaders = {}, method } = {}) => fetch(`${base}${route}`, {
    method: method ?? (data === undefined ? 'GET' : 'POST'),
    headers: { ...headers, ...(cookie ? { Cookie: cookie } : {}), ...extraHeaders },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }), signal: AbortSignal.timeout(20000)
  });
  const cookieOf = response => response.headers.get('set-cookie')?.split(';')[0];
  assert.deepEqual(await (await request('/api/auth/status')).json(), { setupRequired: true, user: null });
  assert.equal((await request('/api/auth/me')).status, 401);
  assert.equal((await request('/api/users')).status, 401);
  const shortSetup = await request('/api/auth/setup', { data: {
    loginName: 'short_owner', displayName: 'Kısa parola denemesi', password: password.slice(0, 5)
  } });
  assert.equal(shortSetup.status, 400, 'First account must reject a five-character password');
  assert.equal((await shortSetup.json()).code, 'INVALID_INPUT');
  assert.equal((await (await request('/api/auth/status')).json()).setupRequired, true, 'Rejected setup must leave first-account creation available');
  const attempts = await Promise.all(['first_owner', 'second_owner'].map(loginName => request('/api/auth/setup', {
    data: { loginName, displayName: 'İşletme sahibi', password }
  })));
  assert.deepEqual(attempts.map(response => response.status).sort(), [201, 409], 'Concurrent bootstrap creates exactly one owner');
  const winner = attempts.find(response => response.status === 201);
  const owner = (await winner.json()).user;
  let ownerCookie = cookieOf(winner);
  assert.match(winner.headers.get('set-cookie'), /HttpOnly/);
  assert.match(winner.headers.get('set-cookie'), /SameSite=Strict/);
  assert.doesNotMatch(winner.headers.get('set-cookie'), /Max-Age|Expires=/);
  assert.equal(owner.roles.includes('owner'), true);
  assert.equal(owner.permissions.includes('users.manage'), true);
  assert.equal((await (await request('/api/auth/status', { cookie: ownerCookie })).json()).setupRequired, false);
  const listed = await (await request('/api/users', { cookie: ownerCookie })).json();
  assert.equal(listed.users.length, 1);
  assert.equal(listed.roles.length, 6);
  assert.ok(listed.roles.every(role => role.code && role.name));
  assert.ok(!JSON.stringify(listed).includes(password));
  const shortEmployee = await request('/api/users', { cookie: ownerCookie, data: {
    loginName: 'short_employee', displayName: 'Kısa parola denemesi', password: otherPassword.slice(0, 5), roleCodes: ['waiter']
  } });
  assert.equal(shortEmployee.status, 400, 'Employee creation must reject a five-character password');
  assert.equal((await shortEmployee.json()).code, 'INVALID_INPUT');
  const create = await request('/api/users', { cookie: ownerCookie, data: {
    loginName: 'test_waiter', displayName: 'Deneme çalışanı', password: otherPassword, roleCodes: ['waiter', 'kitchen']
  } });
  assert.equal(create.status, 201, await create.clone().text());
  const waiter = (await create.json()).user;
  assert.deepEqual(waiter.roles, ['kitchen', 'waiter']);
  assert.equal(waiter.permissions.includes('payments.write'), false, 'Waiter cannot automatically collect payments');
  const duplicate = await request('/api/users', { cookie: ownerCookie, data: {
    loginName: 'test_waiter', displayName: 'Yinelenen', password: otherPassword, roleCodes: ['waiter']
  } });
  assert.equal(duplicate.status, 409);
  const invalidRole = await request('/api/users', { cookie: ownerCookie, data: {
    loginName: 'bad_role', displayName: 'Geçersiz', password: otherPassword, roleCodes: ['unexpected']
  } });
  assert.equal(invalidRole.status, 400);
  const badKnown = await request('/api/auth/login', { data: { loginName: owner.loginName, password: otherPassword } });
  const badUnknown = await request('/api/auth/login', { data: { loginName: 'unknown_user', password: otherPassword } });
  assert.equal(badKnown.status, 401); assert.equal(badUnknown.status, 401);
  assert.equal((await badKnown.json()).title, (await badUnknown.json()).title);
  const waiterLogin = await request('/api/auth/login', { data: { loginName: waiter.loginName, password: otherPassword, rememberMe:true } });
  assert.equal(waiterLogin.status, 200);
  const waiterCookie = cookieOf(waiterLogin);
  assert.match(waiterLogin.headers.get('set-cookie'), /Max-Age=2592000/);
  assert.equal((await request('/api/users', { cookie: waiterCookie })).status, 403);
  assert.equal((await request('/api/users', { cookie: waiterCookie, data: { loginName: 'forbidden_owner', displayName: 'Yasak', password, roleCodes: ['owner'] } })).status, 403);
  // Fresh service has no process-local sessions: all authority comes from MySQL.
  const token = ownerCookie.split('=')[1];
  assert.equal((await createAuthService(config).authenticate(token)).id, owner.id);
  await withConnection(config, async connection => {
    const [users] = await connection.query('SELECT login_name, password_hash FROM app_users');
    assert.equal(users.length, 2);
    for (const row of users) {
      assert.match(row.password_hash, /^scrypt\$131072\$8\$1\$/);
      // A random six-character hexadecimal value may coincidentally occur inside a hash.
      // The strict scrypt format proves storage is derived rather than plaintext.
      assert.notEqual(row.password_hash, password); assert.notEqual(row.password_hash, otherPassword);
    }
    const [[row]] = await connection.execute('SELECT token_hash, expires_at_utc > UTC_TIMESTAMP(6) AS valid, TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(6), expires_at_utc) AS remaining FROM user_sessions WHERE token_hash = ?', [createHash('sha256').update(token).digest()]);
    assert.equal(row.token_hash.length, 32); assert.equal(Number(row.valid), 1);
    assert.ok(Number(row.remaining)>43100&&Number(row.remaining)<=43200,'Normal oturum sunucuda en fazla 12 saattir');
    assert.ok(!row.token_hash.equals(Buffer.from(token)));
    await connection.execute('DELETE rp FROM role_permissions rp JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id WHERE r.code = ? AND p.code = ?', ['waiter', 'orders.write']);
  });
  const refreshed = (await (await request('/api/auth/me', { cookie: waiterCookie })).json()).user;
  assert.equal(refreshed.permissions.includes('orders.write'), false, 'Permissions are re-read for every authenticated request');
  await withConnection(config, connection => connection.execute('UPDATE app_users SET is_active = FALSE WHERE id = ?', [waiter.id]));
  assert.equal((await request('/api/auth/me', { cookie: waiterCookie })).status, 401);
  const rotatedLogin = await request('/api/auth/login', { cookie: ownerCookie, data: { loginName: owner.loginName, password, rememberMe:true } });
  assert.equal(rotatedLogin.status, 200);
  assert.match(rotatedLogin.headers.get('set-cookie'), /Max-Age=2592000/);
  const oldCookie = ownerCookie;
  ownerCookie = cookieOf(rotatedLogin);
  assert.notEqual(ownerCookie, oldCookie);
  assert.equal((await request('/api/auth/me', { cookie: oldCookie })).status, 401);
  const rememberedToken=ownerCookie.split('=')[1];
  await withConnection(config,async connection=>{const [[row]]=await connection.execute('SELECT TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(6), expires_at_utc) AS remaining FROM user_sessions WHERE token_hash=?',[createHash('sha256').update(rememberedToken).digest()]);assert.ok(Number(row.remaining)>2591900&&Number(row.remaining)<=2592000,'Çerez ve MySQL hatırlama süresi 30 gündür');});
  assert.equal((await createAuthService(config).authenticate(rememberedToken)).id,owner.id,'Hatırlama yeniden oluşturulan serviste de MySQL üzerinden geçerlidir');
  const logout = await request('/api/auth/logout', { cookie: ownerCookie, data: {} });
  assert.equal(logout.status, 204); assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await request('/api/auth/me', { cookie: ownerCookie })).status, 401);
  const nextLogin = await request('/api/auth/login', { data: { loginName: owner.loginName, password, rememberMe:false } });
  assert.equal(nextLogin.status, 200);
  assert.doesNotMatch(nextLogin.headers.get('set-cookie'), /Max-Age|Expires=/);
  const nextCookie = cookieOf(nextLogin);
  await withConnection(config, connection => connection.execute('UPDATE user_sessions SET expires_at_utc = TIMESTAMPADD(SECOND, -1, UTC_TIMESTAMP(6)) WHERE token_hash = ?', [createHash('sha256').update(nextCookie.split('=')[1]).digest()]));
  assert.equal((await request('/api/auth/me', { cookie: nextCookie })).status, 401);
  // Earlier two invalid credentials count; successful employee logins do not.
  for (let index = 0; index < 3; index++) {
    assert.equal((await request('/api/auth/login', { data: { loginName: owner.loginName, password: otherPassword } })).status, 401);
  }
  const limited = await request('/api/auth/login', { data: { loginName: owner.loginName, password } });
  assert.equal(limited.status, 429); assert.ok(Number(limited.headers.get('retry-after')) > 0);
  await withConnection(config, async connection => {
    const [events] = await connection.query('SELECT actor_user_id, action_code, outcome, metadata_json FROM audit_events ORDER BY id');
    for (const action of ['auth.setup', 'auth.login', 'auth.logout', 'users.create']) assert.ok(events.some(event => event.action_code === action));
    assert.equal(events.filter(event => event.action_code === 'auth.setup').length, 1);
    assert.equal(events.filter(event => event.action_code === 'users.create').length, 1, 'Rolled back duplicate creation must not leave a success event');
    for (const event of events) {
      assert.equal(event.outcome, 'succeeded');
      assert.ok(event.actor_user_id);
      assert.deepEqual(Object.keys(event.metadata_json), ['targetUserId']);
      assert.match(event.metadata_json.targetUserId, /^[0-9]+$/);
    }
    const serialized = JSON.stringify(events);
    for (const hidden of [password, otherPassword, owner.loginName, waiter.loginName, 'scrypt$', token]) assert.ok(!serialized.includes(hidden));
  });
}
