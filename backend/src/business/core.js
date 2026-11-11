import { createHash } from 'node:crypto';
import { withConnection, dbError } from '../database.js';
import { identifier } from '../catalog/validation.js';

export const problem = (status, code, title) => Object.assign(new Error(), { status, code, title });
export const invalid = title => problem(400, 'INVALID_INPUT', title);
export const conflict = (title = 'Kayıt değişti. Güncel bilgileri yükleyin.') => problem(409, 'REVISION_CONFLICT', title);
export function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw invalid('Gönderilen bilgiler geçersiz.');
  return value;
}
export function text(value, max, label = 'Ad') {
  const result = typeof value === 'string' ? value.trim().normalize('NFC') : '';
  if (!result || [...result].length > max || /[\u0000-\u001f\u007f]/u.test(result)) throw invalid(`${label} 1–${max} karakter olmalı.`);
  return result;
}
export function key(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw invalid('İşlem kimliği geçersiz.');
  return value.toLowerCase();
}
export function money(value, { zero = false, signed = false } = {}) {
  if (typeof value !== 'string' || !(signed ? /^-?(0|[1-9][0-9]{0,12})$/ : /^(0|[1-9][0-9]{0,12})$/).test(value) || (!zero && BigInt(value) === 0n)) throw invalid('Tutar kuruş olarak tam sayı olmalı.');
  return value;
}
export function decimal(value, { zero = false } = {}) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,8})(\.[0-9]{1,6})?$/.test(value)) throw invalid('Miktar en fazla altı ondalık basamakla girilmeli.');
  const [whole, fraction = ''] = value.split('.');
  const scaled = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'));
  if (!zero && scaled === 0n) throw invalid('Miktar sıfırdan büyük olmalı.');
  return scaled;
}
export const decimalString = value => value < 0n ? `-${decimalString(-value)}` : `${value / 1000000n}.${(value % 1000000n).toString().padStart(6, '0')}`;
export function storedDecimal(value){const match=/^(-?)(\d{1,32})(?:\.(\d{1,6}))?$/.exec(String(value));if(!match)throw problem(409,'STORED_DECIMAL_INVALID','Kayıtlı miktar doğrulanamadı.');const result=BigInt(match[2])*1000000n+BigInt((match[3]||'').padEnd(6,'0'));return match[1]?-result:result;}
export const roundedRatio = (numerator, denominator) => (numerator + denominator / 2n) / denominator;
export function dateOnly(value){if(value===null||value===undefined||value==='')return null;if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(`${value}T00:00:00Z`))||new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)!==value)throw invalid('Tarih YYYY-AA-GG biçiminde olmalı.');return value;}
export function expiryDate(value){const date=dateOnly(value);return date?new Date(`${date}T23:59:59+03:00`).toISOString().slice(0,19).replace('T',' '):null;}
export async function snapshot(config, action) {
  return withConnection(config, async connection => {
    await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await connection.beginTransaction();
    try { const result = await action(connection); await connection.commit(); return result; }
    catch (error) { try { await connection.rollback(); } catch {} throw error; }
  }, 12000);
}
export async function assertPermission(connection, actorId, permission, {allowRestricted=false,amount=null}={}) {
  const [[user]] = await connection.execute('SELECT id FROM app_users WHERE id = ? AND is_active = TRUE FOR SHARE', [actorId]);
  if (!user) throw problem(403, 'PERMISSION_DENIED', 'Etkin yetkili kullanıcı gerekli.');
  const [grants] = await connection.execute(`SELECT rp.requires_approval,rp.amount_limit_minor FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id WHERE ur.user_id = ? AND p.code = ?`, [actorId, permission]);
  if (!grants.length) throw problem(403, 'PERMISSION_DENIED', 'Bu işlem için yetkiniz yok.');
  if(!allowRestricted&&!grants.some(grant=>!grant.requires_approval&&(grant.amount_limit_minor===null||(amount!==null&&BigInt(amount)<=BigInt(grant.amount_limit_minor)))))throw problem(409,'APPROVAL_REQUIRED','Bu işlem için yetkili onayı gerekli.');
}
function operationAmount(type,payload){
  if(type==='sales.settle')return payload.amount;
  if(type==='expense.create')return payload.totalMinor;
  if(['expense.pay','party.entry','cash.movement','cash.transfer','purchase.pay'].includes(type))return payload.amountMinor;
  if(type==='purchase.create')return payload.items.reduce((sum,item)=>sum+roundedRatio(decimal(item.quantity)*BigInt(item.unitPriceMinor),1000000n),0n).toString();
  return null;
}
export async function operate(config, { type, actorId, requestKey, payload, permission, allowRestricted=false }, action) {
  actorId = identifier(actorId); requestKey = key(requestKey);
  const hash = createHash('sha256').update(JSON.stringify({ type, actorId, payload })).digest();
  let committing = false;
  try {
    return await withConnection(config, async connection => {
      await connection.beginTransaction();
      try {
        await assertPermission(connection, actorId, permission,{allowRestricted,amount:operationAmount(type,payload)});
        let operationId;
        try {
          const [created] = await connection.execute(`INSERT INTO business_operations(request_key,request_hash,operation_type,actor_user_id) VALUES (?,?,?,?)`, [requestKey, hash, type, actorId]);
          operationId = String(created.insertId);
        } catch (error) {
          if (error.code !== 'ER_DUP_ENTRY') throw error;
          const [[previous]] = await connection.execute('SELECT request_hash,status,result_json FROM business_operations WHERE request_key = ? FOR UPDATE', [requestKey]);
          if (!previous || !Buffer.from(previous.request_hash).equals(hash)) throw problem(409, 'REQUEST_KEY_REUSED', 'İşlem kimliği farklı bir istek için kullanılmış.');
          if (previous.status !== 'completed' || previous.result_json === null) throw problem(409, 'OPERATION_PENDING', 'İşlemin sonucu henüz hazır değil.');
          const result = typeof previous.result_json === 'string' ? JSON.parse(previous.result_json) : previous.result_json;
          await connection.rollback(); return result;
        }
        const result = await action(connection, operationId, actorId);
        await connection.execute(`INSERT INTO audit_events(operation_id,actor_user_id,action_code,outcome,metadata_json) VALUES (?,?,?,'succeeded',?)`,
          [operationId, actorId, type, JSON.stringify({ requestKey })]);
        await connection.execute(`INSERT INTO outbox_events(operation_id,event_type,payload_json) VALUES (?,?,?)`, [operationId, type, JSON.stringify({ operationId })]);
        await connection.execute(`UPDATE business_operations SET status='completed',result_json=?,completed_at_utc=UTC_TIMESTAMP(6) WHERE id=?`, [JSON.stringify(result), operationId]);
        committing = true; await connection.commit(); return result;
      } catch (error) { if (committing) throw dbError('COMMIT_UNKNOWN'); try { await connection.rollback(); } catch {} throw error; }
    }, 20000);
  } catch (error) {
    if (committing) throw dbError('COMMIT_UNKNOWN');
    if (error.code === 'ER_DUP_ENTRY') throw problem(409, 'DUPLICATE_RECORD', 'Bu ad veya kod zaten kullanılıyor.');
    if (error.code === 'ER_LOCK_DEADLOCK' || error.code === 'ER_LOCK_WAIT_TIMEOUT') throw problem(409, 'BUSY', 'Başka bir işlem sürüyor. Güncel bilgileri yükleyin.');
    throw error;
  }
}
