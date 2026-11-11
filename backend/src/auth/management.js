import { createHash } from 'node:crypto';
import { identifier } from '../catalog/validation.js';
import { object,text,key,money,problem,conflict,operate,snapshot } from '../business/core.js';
import { hashPassword,passwordIsValid } from './password.js';

async function roleGrants(connection,id){
  const [rows]=await connection.execute('SELECT p.code,rp.requires_approval,rp.amount_limit_minor FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE rp.role_id=? ORDER BY p.code',[id]);
  return rows.map(row=>({code:row.code,requiresApproval:Boolean(row.requires_approval),amountLimitMinor:row.amount_limit_minor===null?null:String(row.amount_limit_minor)}));
}
const revision=grants=>createHash('sha256').update(JSON.stringify(grants)).digest('hex');
export function createAuthManagementService(config){
  const write=(type,input,actorId,payload,action)=>operate(config,{type,permission:'users.manage',actorId,requestKey:key(input.requestKey),payload},action);
  return {
    async policy(){return snapshot(config,async connection=>{
      const [roles]=await connection.query('SELECT id,code,name FROM roles ORDER BY code');const [permissions]=await connection.query('SELECT code,description FROM permissions ORDER BY code');
      const result=[];for(const role of roles){const grants=await roleGrants(connection,role.id);result.push({id:String(role.id),code:role.code,name:role.name,revision:revision(grants),grants});}
      return {roles:result,permissions};
    });},
    async updateUser(id,input,actorId){
      id=identifier(id);object(input,['requestKey','revision','displayName','isActive','roleCodes']);
      const payload={id,revision:identifier(input.revision),displayName:text(input.displayName,160,'Ad soyad'),isActive:input.isActive,roleCodes:input.roleCodes};
      if(typeof payload.isActive!=='boolean'||!Array.isArray(payload.roleCodes)||!payload.roleCodes.length||payload.roleCodes.length>20||new Set(payload.roleCodes).size!==payload.roleCodes.length||payload.roleCodes.some(code=>typeof code!=='string'||!/^[a-z][a-z0-9_-]{0,39}$/.test(code)))throw problem(400,'INVALID_INPUT','Kullanıcı görevleri geçersiz.');
      return write('users.update',input,actorId,payload,async connection=>{
        const [users]=await connection.query('SELECT id,revision FROM app_users ORDER BY id FOR UPDATE');const target=users.find(row=>String(row.id)===id);if(!target)throw problem(404,'NOT_FOUND','Kullanıcı bulunamadı.');if(String(target.revision)!==payload.revision)throw conflict();
        const [owners]=await connection.query("SELECT u.id FROM app_users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.is_active=TRUE AND r.code='owner'");
        if(owners.length===1&&String(owners[0].id)===id&&(!payload.isActive||!payload.roleCodes.includes('owner')))throw problem(409,'LAST_OWNER','Son etkin işletme sahibi kapatılamaz veya görevden çıkarılamaz.');
        const [roles]=await connection.query('SELECT id,code FROM roles');if(payload.roleCodes.some(code=>!roles.some(role=>role.code===code)))throw problem(400,'INVALID_ROLE','Görev bulunamadı.');
        await connection.execute('UPDATE app_users SET display_name=?,is_active=?,revision=revision+1 WHERE id=?',[payload.displayName,payload.isActive,id]);
        await connection.execute('DELETE FROM user_roles WHERE user_id=?',[id]);
        for(const code of payload.roleCodes)await connection.execute('INSERT INTO user_roles(user_id,role_id) VALUES (?,?)',[id,roles.find(role=>role.code===code).id]);
        await connection.execute('UPDATE user_sessions SET revoked_at_utc=UTC_TIMESTAMP(6) WHERE user_id=? AND revoked_at_utc IS NULL',[id]);
        return {id,revision:(BigInt(payload.revision)+1n).toString()};
      });
    },
    async revoke(id,input,actorId){
      id=identifier(id);object(input,['requestKey']);return write('users.sessions.revoke',input,actorId,{id},async connection=>{await connection.execute('UPDATE user_sessions SET revoked_at_utc=UTC_TIMESTAMP(6) WHERE user_id=? AND revoked_at_utc IS NULL',[id]);return {id};});
    },
    async resetPassword(id,input,actorId){
      id=identifier(id);object(input,['requestKey','revision','password']);if(!passwordIsValid(input.password))throw problem(400,'INVALID_INPUT','Parola 6–128 karakter olmalı.');
      const requestKey=key(input.requestKey),targetRevision=identifier(input.revision);
      // The operation fingerprint also uses expensive scrypt; no fast password hash is persisted.
      const fingerprint=await hashPassword(input.password,Buffer.from(requestKey.replaceAll('-',''),'hex'));
      return write('users.password.reset',input,actorId,{id,revision:targetRevision,fingerprint},async connection=>{
        const [[row]]=await connection.execute('SELECT revision FROM app_users WHERE id=? FOR UPDATE',[id]);if(!row)throw problem(404,'NOT_FOUND','Kullanıcı bulunamadı.');if(String(row.revision)!==targetRevision)throw conflict();
        const hash=await hashPassword(input.password);await connection.execute('UPDATE app_users SET password_hash=?,revision=revision+1 WHERE id=?',[hash,id]);
        await connection.execute('UPDATE user_sessions SET revoked_at_utc=UTC_TIMESTAMP(6) WHERE user_id=? AND revoked_at_utc IS NULL',[id]);return {id};
      });
    },
    async updateRole(id,input,actorId){
      id=identifier(id);object(input,['requestKey','revision','grants']);
      if(typeof input.revision!=='string'||!/^[0-9a-f]{64}$/.test(input.revision)||!Array.isArray(input.grants)||input.grants.length>100)throw problem(400,'INVALID_INPUT','Yetki düzenlemesi geçersiz.');
      const grants=input.grants.map(grant=>{object(grant,['code','requiresApproval','amountLimitMinor']);if(typeof grant.code!=='string'||typeof grant.requiresApproval!=='boolean')throw problem(400,'INVALID_INPUT','Yetki satırı geçersiz.');return {code:grant.code,requiresApproval:grant.requiresApproval,amountLimitMinor:grant.amountLimitMinor===null?null:money(grant.amountLimitMinor,{zero:true})};}).sort((a,b)=>a.code.localeCompare(b.code));
      if(new Set(grants.map(grant=>grant.code)).size!==grants.length)throw problem(400,'INVALID_INPUT','Yetki bir kez seçilebilir.');
      return write('users.role.update',input,actorId,{id,revision:input.revision,grants},async connection=>{
        const [[role]]=await connection.execute('SELECT code FROM roles WHERE id=? FOR UPDATE',[id]);if(!role)throw problem(404,'NOT_FOUND','Görev bulunamadı.');if(role.code==='owner')throw problem(409,'OWNER_ROLE_PROTECTED','İşletme sahibi rolünün temel yetkileri korunur.');
        const current=await roleGrants(connection,id);if(revision(current)!==input.revision)throw conflict();
        const [permissions]=await connection.query('SELECT id,code FROM permissions');if(grants.some(grant=>!permissions.some(permission=>permission.code===grant.code)))throw problem(400,'INVALID_INPUT','Yetki tanımı bulunamadı.');
        await connection.execute('DELETE FROM role_permissions WHERE role_id=?',[id]);
        for(const grant of grants)await connection.execute('INSERT INTO role_permissions(role_id,permission_id,requires_approval,amount_limit_minor) VALUES (?,?,?,?)',[id,permissions.find(permission=>permission.code===grant.code).id,grant.requiresApproval,grant.amountLimitMinor]);
        return {id};
      });
    }
  };
}
