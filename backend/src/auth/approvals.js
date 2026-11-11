import { createHash } from 'node:crypto';
import { identifier } from '../catalog/validation.js';
import { object,text,key,problem,operate,snapshot } from '../business/core.js';
function executionKey(id){const hash=createHash('sha256').update(`approval-execution:${id}`).digest('hex').slice(0,32).split('');hash[12]='8';hash[16]='a';const s=hash.join('');return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;}
export function createApprovalService(config,actions){
  const parse=row=>typeof row==='string'?JSON.parse(row):row;
  return {
    async list(actorId,manage){return snapshot(config,async connection=>{
      const [rows]=await connection.execute(`SELECT a.*,o.result_json,u.display_name AS requester_name
        FROM approval_requests a JOIN business_operations o ON o.id=a.operation_id JOIN app_users u ON u.id=a.requested_by_user_id
        ${manage?'':'WHERE a.requested_by_user_id=?'} ORDER BY a.id DESC LIMIT 200`,manage?[]:[actorId]);
      const result=[];
      for(const row of rows){const stored=parse(row.result_json);const [[execution]]=await connection.execute('SELECT status FROM business_operations WHERE request_key=?',[executionKey(String(row.id))]);
        result.push({id:String(row.id),action:row.action_code,status:row.status,reason:row.reason,decisionReason:row.decision_reason,requesterName:row.requester_name,requestedBy:String(row.requested_by_user_id),decidedBy:row.decided_by_user_id===null?null:String(row.decided_by_user_id),payload:stored.payload,executed:execution?.status==='completed'});}
      const [grants]=await connection.execute(`SELECT DISTINCT p.code FROM user_roles ur JOIN role_permissions rp ON rp.role_id=ur.role_id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=?`,[actorId]);
      return {actions:Object.entries(actions).filter(([_code,action])=>grants.some(grant=>grant.code===action.requestPermission)).map(([code,action])=>({code,name:action.name})),requests:result};
    });},
    async request(input,actorId){
      object(input,['requestKey','action','payload','reason']);const action=actions[input.action];if(!action)throw problem(400,'INVALID_ACTION','Onay işlemi geçersiz.');
      if(!input.payload||typeof input.payload!=='object'||Array.isArray(input.payload)||Object.keys(input.payload).some(name=>/password|token|secret/i.test(name)))throw problem(400,'INVALID_INPUT','Onay bilgileri geçersiz.');
      const payload={action:input.action,payload:input.payload,reason:text(input.reason,1000,'Onay gerekçesi')};
      return operate(config,{type:'approval.request',permission:action.requestPermission,allowRestricted:true,actorId,requestKey:key(input.requestKey),payload},async(connection,operation,actor)=>{
        const [result]=await connection.execute('INSERT INTO approval_requests(operation_id,action_code,requested_by_user_id,reason) VALUES (?,?,?,?)',[operation,payload.action,actor,payload.reason]);
        return {id:String(result.insertId),action:payload.action,payload:payload.payload};
      });
    },
    async decide(id,input,actorId){
      id=identifier(id);object(input,['requestKey','decision','reason']);if(!['approved','rejected'].includes(input.decision))throw problem(400,'INVALID_INPUT','Onay kararı geçersiz.');
      const payload={id,decision:input.decision,reason:text(input.reason,1000,'Karar gerekçesi')};
      const result=await operate(config,{type:'approval.decide',permission:'users.manage',actorId,requestKey:key(input.requestKey),payload},async(connection,_operation,actor)=>{
        const [[row]]=await connection.execute('SELECT * FROM approval_requests WHERE id=? FOR UPDATE',[id]);if(!row)throw problem(404,'NOT_FOUND','Onay talebi bulunamadı.');
        if(row.status!=='pending')throw problem(409,'ALREADY_DECIDED','Talep zaten karara bağlanmış.');if(String(row.requested_by_user_id)===actor)throw problem(409,'SELF_APPROVAL','Kendi talebini onaylayamazsın.');
        const [[original]]=await connection.execute('SELECT result_json FROM business_operations WHERE id=?',[row.operation_id]);const stored=parse(original.result_json);
        await connection.execute('UPDATE approval_requests SET status=?,decided_by_user_id=?,decision_reason=?,decided_at_utc=UTC_TIMESTAMP(6) WHERE id=?',[payload.decision,actor,payload.reason,id]);
        return {id,status:payload.decision,action:row.action_code,payload:stored.payload,actorId:actor};
      });
      if(result.status==='approved')await actions[result.action].invoke(result.payload,result.actorId,executionKey(id));
      return {id,status:result.status};
    },
    async execute(id,actorId){
      id=identifier(id);const row=await snapshot(config,async connection=>{
        const [[found]]=await connection.execute("SELECT a.action_code,a.decided_by_user_id,o.result_json FROM approval_requests a JOIN business_operations o ON o.id=a.operation_id WHERE a.id=? AND a.status='approved'",[id]);
        if(!found||String(found.decided_by_user_id)!==String(actorId))throw problem(403,'PERMISSION_DENIED','Onaylı işlemi karar veren yetkili çalıştırabilir.');return found;
      });
      await actions[row.action_code].invoke(parse(row.result_json).payload,actorId,executionKey(id));return {id,executed:true};
    }
  };
}
