import {allowedRequestHost,isLocalRequest} from '../network.js';
import { Router } from 'express';
import { REMEMBER_SESSION_MS, authError } from './service.js';
import { log } from '../log.js';

const COOKIE = 'nar_session';
function sessionToken(req) {
  const value = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{43}$/.test(value) ? value : null;
}

function setSession(req, res, token, rememberMe = false) {
  const secure = req.secure ? '; Secure' : '';
  const lifetime = !token ? '; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT' : rememberMe ? `; Max-Age=${REMEMBER_SESSION_MS / 1000}; Expires=${new Date(Date.now() + REMEMBER_SESSION_MS).toUTCString()}` : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${token ?? ''}; Path=/; HttpOnly; SameSite=Strict${lifetime}${secure}`);
}

export function mutationGuard(req, res, next) {
  const host = req.get('host') ?? '';
  const origin = req.get('origin');
  const fetchSite = req.get('sec-fetch-site');
  if (!allowedRequestHost(req) || (!isLocalRequest(req) && !origin) || (origin && origin !== `${req.protocol}://${host}`)
    || (fetchSite && !['same-origin', 'none'].includes(fetchSite)) || req.get('x-nar-request') !== '1') {
    return res.status(403).json({ title: 'İstek güvenlik kontrolünden geçemedi. Uygulamayı kendi adresinden açın.', code: 'REQUEST_REJECTED' });
  }
  if (!req.is('application/json')) return res.status(415).json({ title: 'İstek JSON biçiminde gönderilmeli.', code: 'JSON_REQUIRED' });
  next();
}

export function createRateLimiter({ limit = 5, windowMs = 5 * 60 * 1000, now = Date.now } = {}) {
  const attempts = new Map();
  return (req, res, next) => {
    const current = now();
    // Bound memory and count failures per actual socket address; forwarded headers are not trusted.
    for (const [key, value] of attempts) if (value.until <= current) attempts.delete(key);
    const key = req.socket.remoteAddress ?? 'local';
    let attempt = attempts.get(key);
    if (!attempt) {
      if (attempts.size >= 1000) return res.status(429).json({ title: 'Çok fazla giriş denemesi var. Biraz bekleyin.', code: 'RATE_LIMITED' });
      attempt = { count: 0, pending: 0, until: current + windowMs }; attempts.set(key, attempt);
    }
    if (attempt.count + attempt.pending >= limit) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((attempt.until - current) / 1000))));
      return res.status(429).json({ title: 'Çok fazla giriş denemesi var. Beş dakika sonra tekrar deneyin.', code: 'RATE_LIMITED' });
    }
    attempt.pending++;
    let completed = false;
    const finish = () => {
      if (completed) return;
      completed = true;
      attempt.pending--;
      if ([400, 401].includes(res.statusCode)) attempt.count++;
    };
    res.once('finish', finish);
    res.once('close', finish);
    next();
  };
}

function sendAuthFailure(error, req, res) {
  if (res.headersSent) return res.destroy();
  if (Number.isInteger(error.status) && error.status >= 400 && error.status <= 599 && error.title) {
    return res.status(error.status).json({ title: error.title, code: error.code, traceId: req.traceId });
  }
  const code = error.code === 'COMMIT_UNKNOWN' ? 'COMMIT_UNKNOWN' : error.code === 'AUTH_BUSY' ? 'AUTH_BUSY' : 'DATABASE_UNAVAILABLE';
  log('error', 'auth_request_failed', { traceId: req.traceId, code });
  if (code === 'AUTH_BUSY') res.set('Retry-After', '2');
  res.status(503).json({ code, title: code === 'COMMIT_UNKNOWN'
    ? 'İşlemin kaydedilip kaydedilmediği doğrulanamadı. Tekrar kayıt oluşturmadan önce giriş yapmayı ve kullanıcı listesini kontrol edin.'
    : code === 'AUTH_BUSY' ? 'Giriş işlemleri yoğun. Birkaç saniye sonra tekrar deneyin.'
    : 'Veritabanına şu anda erişilemiyor. Bağlantı düzelince tekrar deneyin.', traceId: req.traceId });
}

// Every future business router uses these same guards; no role decision belongs in the browser.
export function createSessionGuard(service, monitor) {
  return async (req, res, next) => {
    try {
      if (!service || !monitor.status().ready) throw authError(503, 'DATABASE_UNAVAILABLE', 'Veritabanına şu anda erişilemiyor. Bağlantı düzelince tekrar deneyin.');
      req.user = await service.authenticate(sessionToken(req));
      if (!req.user) { setSession(req, res, null); throw authError(401, 'AUTH_REQUIRED', 'Devam etmek için giriş yapın.'); }
      next();
    } catch (error) { sendAuthFailure(error, req, res); }
  };
}

export function requirePermission(code) {
  return (req, res, next) => {
    if (!req.user) return sendAuthFailure(authError(401, 'AUTH_REQUIRED', 'Devam etmek için giriş yapın.'), req, res);
    if (!req.user.permissions.includes(code)) return sendAuthFailure(authError(403, 'PERMISSION_DENIED', 'Bu işlem için yetkiniz yok.'), req, res);
    next();
  };
}

export function createAuthRouter(service, monitor) {
  const router = Router();
  const available = () => {
    if (!service || !monitor.status().ready) throw authError(503, 'DATABASE_UNAVAILABLE', 'Veritabanına şu anda erişilemiyor. Bağlantı düzelince tekrar deneyin.');
  };
  const handler = action => async (req, res, next) => {
    try { available(); await action(req, res); }
    catch (error) { next(error); }
  };
  const requireUser = createSessionGuard(service, monitor);
  const requireUsersPermission = requirePermission('users.manage');
  router.get('/auth/status', handler(async (req, res) => res.json(await service.status(sessionToken(req)))));
  router.get('/auth/me', requireUser, (req, res) => res.json({ user: req.user }));
  router.post('/auth/setup', mutationGuard, createRateLimiter(), handler(async (req, res) => {
    const result = await service.setup(req.body, sessionToken(req));
    setSession(req, res, result.token); res.status(201).json({ user: result.user });
  }));
  router.post('/auth/login', mutationGuard, createRateLimiter(), handler(async (req, res) => {
    const result = await service.login(req.body, sessionToken(req));
    setSession(req, res, result.token, result.rememberMe === true); res.json({ user: result.user });
  }));
  router.post('/auth/logout', mutationGuard, handler(async (req, res) => {
    await service.logout(sessionToken(req)); setSession(req, res, null); res.status(204).end();
  }));
  router.get('/users', requireUser, requireUsersPermission, handler(async (_req, res) => res.json(await service.listUsers())));
  router.post('/users', mutationGuard, requireUser, requireUsersPermission, handler(async (req, res) => res.status(201).json({ user: await service.createUser(req.body, req.user.id) })));
  router.use((error, req, res, _next) => sendAuthFailure(error, req, res));
  return router;
}
