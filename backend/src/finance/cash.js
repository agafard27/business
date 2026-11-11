import { identifier } from '../catalog/validation.js';
import { object,text,key,money,problem,conflict,operate,snapshot } from '../business/core.js';
import { lockShift,recordCash } from '../sales/payments.js';

export function createCashService(config){
  const write=(type,permission,input,actorId,payload,action)=>operate(config,{type,permission,actorId,requestKey:key(input.requestKey),payload},action);
  return {
    async cash(){return snapshot(config,async connection=>{
      const [registers]=await connection.query('SELECT id,code,name,is_active FROM cash_registers ORDER BY name');
      const [users]=await connection.query('SELECT id,display_name AS name FROM app_users WHERE is_active=TRUE ORDER BY display_name');
      const [shifts]=await connection.query(`SELECT s.*,r.name AS register_name,u.display_name AS responsible_name,opened.display_name AS opened_by_name,closed.display_name AS closed_by_name,recipient.display_name AS recipient_name,
        COALESCE((SELECT SUM(amount_minor) FROM cash_movements m WHERE m.cash_shift_id=s.id),0)+s.opening_amount_minor AS current_expected,
        COALESCE((SELECT SUM(IF(p.direction='in',p.amount_minor,-CAST(p.amount_minor AS SIGNED))) FROM payments p WHERE p.shift_id=s.id AND p.method='card'),0) AS current_pos
        FROM cash_shifts s JOIN cash_registers r ON r.id=s.cash_register_id JOIN app_users u ON u.id=s.responsible_user_id LEFT JOIN app_users opened ON opened.id=s.opened_by_user_id LEFT JOIN app_users closed ON closed.id=s.closed_by_user_id LEFT JOIN app_users recipient ON recipient.id=s.handover_to_user_id ORDER BY (s.status='open') DESC,s.id DESC LIMIT 100`);
      const [movements]=await connection.query(`SELECT m.*,a.display_name AS actor_name,c.display_name AS custody_name FROM cash_movements m JOIN app_users a ON a.id=m.actor_user_id LEFT JOIN app_users c ON c.id=m.custody_user_id ORDER BY m.id DESC LIMIT 200`);
      return {users:users.map(row=>({id:String(row.id),name:row.name})),registers:registers.map(row=>({id:String(row.id),code:row.code,name:row.name,isActive:Boolean(row.is_active)})),
          shifts:shifts.map(row=>({id:String(row.id),name:row.register_name,responsibleName:row.responsible_name,responsibleId:String(row.responsible_user_id),registerId:String(row.cash_register_id),status:row.status,revision:String(row.revision),
          openedByName:row.opened_by_name,openedAtUtc:row.created_at_utc,closedByName:row.closed_by_name,closedAtUtc:row.closed_at_utc,recipientName:row.recipient_name,recipientId:row.handover_to_user_id===null?null:String(row.handover_to_user_id),handoverOperationId:row.handover_operation_id===null?null:String(row.handover_operation_id),reason:row.closing_reason,
          expectedMinor:String(row.status==='closed'?row.expected_amount_minor:row.current_expected),expectedPosMinor:String(row.status==='closed'?row.expected_pos_amount_minor:row.current_pos),countedPosMinor:row.counted_pos_amount_minor===null?null:String(row.counted_pos_amount_minor),countedMinor:row.counted_amount_minor===null?null:String(row.counted_amount_minor),
          differenceMinor:row.difference_amount_minor===null?null:String(row.difference_amount_minor)})),
        movements:movements.map(row=>({id:String(row.id),shiftId:String(row.cash_shift_id),actorName:row.actor_name,custodyName:row.custody_name,transferGroup:row.transfer_group,kind:row.movement_kind,amountMinor:String(row.amount_minor),reason:row.reason,createdAtUtc:row.created_at_utc}))};
    });},
    async register(input,actorId){
      object(input,['requestKey','name','code']);const payload={name:text(input.name,150,'Kasa adı'),code:text(input.code,40,'Kasa kodu')};
      if(!/^[a-zA-Z0-9_-]+$/.test(payload.code))throw problem(400,'INVALID_INPUT','Kasa kodunda harf, rakam, tire kullanın.');
      return write('cash.register.create','settings.manage',input,actorId,payload,async connection=>{
        const [result]=await connection.execute('INSERT INTO cash_registers(code,name) VALUES (?,?)',[payload.code,payload.name]);return {id:String(result.insertId)};
      });
    },
    async openShift(input,actorId){
      object(input,['requestKey','registerId','openingMinor']);const registerId=identifier(input.registerId),openingMinor=money(input.openingMinor,{zero:true});
      return write('cash.shift.open','cash.manage',input,actorId,{registerId,openingMinor},async(connection,_operation,actor)=>{
        const [[register]]=await connection.execute('SELECT id,is_active FROM cash_registers WHERE id=? FOR UPDATE',[registerId]);
        if(!register||!register.is_active)throw problem(400,'INVALID_REGISTER','Etkin kasa seçin.');
        const [result]=await connection.execute('INSERT INTO cash_shifts(cash_register_id,responsible_user_id,opened_by_user_id,opening_amount_minor) VALUES (?,?,?,?)',[registerId,actor,actor,openingMinor]);
        return {id:String(result.insertId)};
      });
    },
    async closeShift(id,input,actorId){
      id=identifier(id);object(input,['requestKey','revision','countedMinor','countedPosMinor','reason','toUserId']);
      if(!input.toUserId)throw problem(400,'HANDOVER_REQUIRED','Kasayı kapatmak için parayı teslim ettiğiniz kişiyi seçin.');
      const payload={id,revision:identifier(input.revision),countedMinor:money(input.countedMinor,{zero:true}),countedPosMinor:money(input.countedPosMinor,{zero:true}),toUserId:identifier(input.toUserId),reason:text(input.reason,1000,'Teslim açıklaması')};
      return write('cash.handover','cash.manage',input,actorId,payload,async(connection,operation,actor)=>{
        const [[shift]]=await connection.execute("SELECT * FROM cash_shifts WHERE id=? AND status='open' FOR UPDATE",[id]);
        if(!shift)throw problem(409,'SHIFT_CLOSED','Kasa zaten teslim edilip kapatılmış.');if(String(shift.revision)!==payload.revision)throw conflict();
        if(String(shift.responsible_user_id)===payload.toUserId)throw problem(400,'INVALID_RECIPIENT','Kasayı teslim alacak başka bir kişi seçin.');
        const [[recipient]]=await connection.execute('SELECT id FROM app_users WHERE id=? AND is_active=TRUE FOR SHARE',[payload.toUserId]);
        if(!recipient)throw problem(400,'INVALID_RECIPIENT','Teslim alacak etkin kişiyi seçin.');
        const [[cash]]=await connection.execute('SELECT COALESCE(SUM(amount_minor),0) AS amount FROM cash_movements WHERE cash_shift_id=?',[id]);
        const [[pos]]=await connection.execute("SELECT COALESCE(SUM(IF(direction='in',amount_minor,-CAST(amount_minor AS SIGNED))),0) AS amount FROM payments WHERE shift_id=? AND method='card'",[id]);
        const [held]=await connection.execute('SELECT custody_user_id,SUM(amount_minor) AS amount FROM cash_movements WHERE cash_shift_id=? AND custody_user_id IS NOT NULL AND custody_user_id<>? GROUP BY custody_user_id HAVING SUM(amount_minor)<>0',[id,shift.responsible_user_id]);
        if(held.length)throw problem(409,'CUSTODY_REMAINS','Personelde teslim edilmemiş nakit var. Önce kasa teslimini kaydedin.');
        const expected=BigInt(shift.opening_amount_minor)+BigInt(cash.amount);
        await connection.execute("UPDATE cash_shifts SET status='closed',expected_amount_minor=?,counted_amount_minor=?,expected_pos_amount_minor=?,counted_pos_amount_minor=?,closing_reason=?,closed_by_user_id=?,closed_at_utc=UTC_TIMESTAMP(6),handover_to_user_id=?,handover_operation_id=?,revision=revision+1 WHERE id=?",[expected.toString(),payload.countedMinor,pos.amount,payload.countedPosMinor,payload.reason,actor,payload.toUserId,operation,id]);
        return {id,operationId:String(operation),toUserId:payload.toUserId,handedOverMinor:payload.countedMinor,expectedMinor:expected.toString(),differenceMinor:(BigInt(payload.countedMinor)-expected).toString()};
      });
    },
    async cashMovement(input,actorId){
      object(input,['requestKey','shiftId','kind','amountMinor','reason']);const payload={shiftId:identifier(input.shiftId),kind:input.kind,amountMinor:money(input.amountMinor),reason:text(input.reason,1000,'Gerekçe')};
      if(!['manual_in','manual_out'].includes(payload.kind))throw problem(400,'INVALID_INPUT','Kasa hareketi türü geçersiz.');
      return write('cash.movement','cash.manage',input,actorId,payload,async(connection,operation,actor)=>{
        await lockShift(connection,payload.shiftId);
        const [[shift]]=await connection.execute('SELECT responsible_user_id FROM cash_shifts WHERE id=?',[payload.shiftId]);
        await recordCash(connection,{operation,shiftId:payload.shiftId,actor,custodyId:String(shift.responsible_user_id),amount:(payload.kind==='manual_out'?-BigInt(payload.amountMinor):BigInt(payload.amountMinor)).toString(),kind:payload.kind,reason:payload.reason});return {saved:true};
      });
    },
    async transfer(input,actorId){
      object(input,['requestKey','shiftId','fromUserId','toUserId','amountMinor','reason']);const payload={shiftId:identifier(input.shiftId),fromUserId:identifier(input.fromUserId),toUserId:identifier(input.toUserId),amountMinor:money(input.amountMinor),reason:text(input.reason,1000,'Teslim gerekçesi')};
      if(payload.fromUserId===payload.toUserId)throw problem(400,'INVALID_INPUT','Teslim eden ve alan farklı olmalı.');
      return write('cash.transfer','cash.manage',input,actorId,payload,async(connection,operation,actor)=>{
        await lockShift(connection,payload.shiftId);const [[shift]]=await connection.execute('SELECT responsible_user_id,opening_amount_minor FROM cash_shifts WHERE id=?',[payload.shiftId]);
        for(const userId of [payload.fromUserId,payload.toUserId].sort((a,b)=>BigInt(a)<BigInt(b)?-1:1)){const [[user]]=await connection.execute('SELECT id FROM app_users WHERE id=? AND is_active=TRUE FOR SHARE',[userId]);if(!user)throw problem(400,'INVALID_USER','Etkin kişi seçin.');}
        const [[held]]=await connection.execute('SELECT COALESCE(SUM(amount_minor),0) AS amount FROM cash_movements WHERE cash_shift_id=? AND custody_user_id=?',[payload.shiftId,payload.fromUserId]);
        const available=BigInt(held.amount)+(String(shift.responsible_user_id)===payload.fromUserId?BigInt(shift.opening_amount_minor):0n);if(BigInt(payload.amountMinor)>available)throw problem(409,'CUSTODY_EXCEEDED','Teslim tutarı kişideki kayıtlı nakdi aşıyor.');
        for(const [custody,kind,sign] of [[payload.fromUserId,'transfer_out',-1n],[payload.toUserId,'transfer_in',1n]])await connection.execute('INSERT INTO cash_movements(operation_id,cash_shift_id,actor_user_id,custody_user_id,movement_kind,amount_minor,transfer_group,reason) VALUES (?,?,?,?,?,?,?,?)',[operation,payload.shiftId,actor,custody,kind,(sign*BigInt(payload.amountMinor)).toString(),key(input.requestKey),payload.reason]);
        return {saved:true};
      });
    },
  };
}
