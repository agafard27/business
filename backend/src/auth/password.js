import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
const options = Object.freeze({ N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
let active = 0;
// Bound memory use; a flooded endpoint must not queue unbounded expensive work.
export async function hashPassword(password, salt = randomBytes(16)) {
  if (active >= 2) throw Object.assign(new Error(), { code: 'AUTH_BUSY' });
  active++;
  try {
    const key = await derive(password, salt, 64, options);
    return `scrypt$131072$8$1$${salt.toString('hex')}$${key.toString('hex')}`;
  } finally { active--; }
}

export async function verifyPassword(password, encoded) {
  // Invalid/unknown accounts still perform the same costly operation.
  const valid = typeof encoded === 'string' && /^scrypt\$131072\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(encoded);
  const fields = valid ? encoded.split('$') : null;
  const salt = fields ? Buffer.from(fields[4], 'hex') : Buffer.alloc(16);
  const computed = await hashPassword(password, salt);
  return valid && timingSafeEqual(Buffer.from(computed.split('$')[5], 'hex'), Buffer.from(fields[5], 'hex'));
}

export function passwordIsValid(password) {
  return typeof password === 'string' && [...password].length >= 6 && [...password].length <= 128
    && Buffer.byteLength(password, 'utf8') <= 512;
}
