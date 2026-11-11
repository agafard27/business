import { identifier } from '../catalog/validation.js';
import { object,key,problem,conflict,operate,snapshot } from '../business/core.js';
import { consumeLine } from '../stock/sales.js';
export function createKitchenService(config){
  return {
    async list(){return snapshot(config,async connection=>{
      const [stations]=await connection.query('SELECT id,name FROM preparation_stations WHERE is_active=TRUE ORDER BY name');
      const [warehouses]=await connection.query('SELECT id,name FROM warehouses WHERE is_active=TRUE ORDER BY name');
      const [rows]=await connection.query(`SELECT t.id,t.station_id,t.status,t.revision,l.stock_issue_json,l.product_name,l.option_name,l.quantity,l.unit_code,l.note,l.added_by,l.created_at_utc,
        m.group_id,dt.name AS table_name FROM preparation_tickets t JOIN check_lines l ON l.id=t.check_line_id
        JOIN settlement_group_memberships m ON m.check_id=l.check_id AND m.left_at_utc IS NULL LEFT JOIN table_assignments a ON a.group_id=m.group_id AND a.released_at_utc IS NULL
        LEFT JOIN dining_tables dt ON dt.id=a.table_id WHERE t.status IN ('new','preparing','ready') ORDER BY l.created_at_utc,t.id LIMIT 500`);
      return {stations:stations.map(row=>({id:String(row.id),name:row.name})),warehouses:warehouses.map(row=>({id:String(row.id),name:row.name})),tickets:rows.map(row=>({id:String(row.id),stationId:String(row.station_id),status:row.status,revision:String(row.revision),stockIssue:typeof row.stock_issue_json==='string'?JSON.parse(row.stock_issue_json):row.stock_issue_json,productName:row.product_name,optionName:row.option_name,quantity:row.quantity,unitCode:row.unit_code,note:row.note,tableName:row.table_name,groupId:String(row.group_id),createdAtUtc:row.created_at_utc}))};
    });},
    async transition(id,input,actorId){
      id=identifier(id);object(input,['requestKey','revision','status','warehouseId']);const payload={id,revision:identifier(input.revision),status:input.status,warehouseId:input.warehouseId?identifier(input.warehouseId):null};
      if(!['preparing','ready','delivered'].includes(payload.status))throw problem(400,'INVALID_INPUT','Hazırlık durumu geçersiz.');
      return operate(config,{type:'kitchen.transition',permission:'kitchen.write',actorId,requestKey:key(input.requestKey),payload},async(connection,operation,actor)=>{
        const [[ref]]=await connection.execute(`SELECT m.group_id FROM preparation_tickets t JOIN check_lines l ON l.id=t.check_line_id JOIN settlement_group_memberships m ON m.check_id=l.check_id AND m.left_at_utc IS NULL WHERE t.id=?`,[id]);
        if(!ref)throw problem(404,'NOT_FOUND','Hazırlık satırı bulunamadı.');
        await connection.execute('SELECT id FROM settlement_groups WHERE id=? FOR UPDATE',[ref.group_id]);
        const [[ticket]]=await connection.execute('SELECT * FROM preparation_tickets WHERE id=? FOR UPDATE',[id]);
        if(String(ticket.revision)!==payload.revision)throw conflict();
        const next={new:'preparing',preparing:'ready',ready:'delivered'};if(next[ticket.status]!==payload.status)throw problem(409,'INVALID_TRANSITION','Hazırlık aşaması sırayla ilerlemeli.');
        if(payload.status==='preparing')await consumeLine(connection,{lineId:String(ticket.check_line_id),warehouseId:payload.warehouseId,operation,actor});
        await connection.execute('UPDATE preparation_tickets SET status=?,revision=revision+1 WHERE id=?',[payload.status,id]);
        await connection.execute('INSERT INTO order_line_events(check_line_id,operation_id,event_type,actor_user_id) VALUES (?,?,?,?)',[ticket.check_line_id,operation,payload.status,actor]);
        await connection.execute('UPDATE settlement_groups SET revision=revision+1 WHERE id=?',[ref.group_id]);return {id,status:payload.status};
      });
    }
  };
}
