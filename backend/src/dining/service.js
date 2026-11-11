import { identifier } from '../catalog/validation.js';
import { object, text, key, problem, conflict, operate, snapshot } from '../business/core.js';

export function createDiningService(config) {
  const command = (type, input, actorId, payload, action) => operate(config, {type, actorId, requestKey:key(input.requestKey), payload,permission:'settings.manage'},action);
  return {
    async list() {
      return snapshot(config, async connection => {
        const [sections] = await connection.query('SELECT id,name,sort_order,revision FROM dining_sections ORDER BY sort_order,name,id');
        const [tables] = await connection.query(`WITH RECURSIVE family AS (
          SELECT group_id AS ancestor,group_id AS descendant FROM table_assignments WHERE released_at_utc IS NULL
          UNION ALL SELECT f.ancestor,g.id FROM family f JOIN settlement_groups g ON g.merged_into_id=f.descendant)
          SELECT t.id,t.name,t.section_id,t.is_active,t.revision,a.group_id,g.revision AS group_revision,g.opened_at_utc,g.bill_requested_at_utc,
          (SELECT COALESCE(SUM(l.total_minor-COALESCE((SELECT SUM(adj.amount_minor) FROM sale_adjustments adj WHERE adj.check_line_id=l.id AND adj.adjustment_type IN ('discount','complimentary')),0)),0) FROM settlement_group_memberships m JOIN check_lines l ON l.check_id=m.check_id
            WHERE m.group_id=g.id AND m.left_at_utc IS NULL AND NOT EXISTS (SELECT 1 FROM order_line_events e WHERE e.check_line_id=l.id AND e.event_type='cancelled')) AS total_minor,
          (SELECT COALESCE(SUM(IF(s.direction='settle',s.amount_minor,-CAST(s.amount_minor AS SIGNED))),0) FROM bill_settlements s WHERE s.group_id IN (SELECT descendant FROM family WHERE ancestor=g.id)) AS settled_minor
          FROM dining_tables t LEFT JOIN table_assignments a ON a.table_id=t.id AND a.released_at_utc IS NULL
          LEFT JOIN settlement_groups g ON g.id=a.group_id ORDER BY t.section_id,t.name,t.id`);
        return {sections:sections.map(row => ({id:String(row.id),name:row.name,sortOrder:row.sort_order,revision:String(row.revision)})),
          tables:tables.map(row => ({id:String(row.id),name:row.name,sectionId:String(row.section_id),isActive:Boolean(row.is_active),revision:String(row.revision),
            groupId:row.group_id === null ? null : String(row.group_id),groupRevision:row.group_revision === null ? null : String(row.group_revision),
            state:row.group_id === null ? 'empty':row.bill_requested_at_utc?'waiting':'occupied',openedAtUtc:row.opened_at_utc,
            totalMinor:String(row.total_minor),remainingMinor:(BigInt(row.total_minor)-BigInt(row.settled_minor)).toString()}))};
      });
    },
    async saveSection(id, input, actorId) {
      object(input,['requestKey','revision','name','sortOrder']);
      if (!Number.isInteger(input.sortOrder) || Math.abs(input.sortOrder)>100000) throw problem(400,'INVALID_INPUT','Bölüm sırası geçersiz.');
      const payload={id:id === null ? null:identifier(id),name:text(input.name,100,'Bölüm adı'),sortOrder:input.sortOrder,
        revision:id === null ? null:identifier(input.revision)};
      return command('dining.section.save',input,actorId,payload,async connection => {
        if (id !== null) {
          const [[row]]=await connection.execute('SELECT revision FROM dining_sections WHERE id=? FOR UPDATE',[payload.id]);
          if (!row) throw problem(404,'NOT_FOUND','Bölüm bulunamadı.');
          if (String(row.revision)!==payload.revision) throw conflict();
          await connection.execute('UPDATE dining_sections SET name=?,sort_order=?,revision=revision+1 WHERE id=?',[payload.name,payload.sortOrder,payload.id]);
        } else {
          const [result]=await connection.execute('INSERT INTO dining_sections(name,sort_order) VALUES (?,?)',[payload.name,payload.sortOrder]); payload.id=String(result.insertId);
        }
        return {id:payload.id};
      });
    },
    async createTables(input,actorId) {
      object(input,['requestKey','sectionId','prefix','start','count']);
      if(!Number.isSafeInteger(input.start)||input.start<1||input.start>99999||!Number.isSafeInteger(input.count)||input.count<1||input.count>100||input.start+input.count-1>99999)throw problem(400,'INVALID_INPUT','Başlangıç 1–99999, masa adedi 1–100 olmalı.');
      const payload={sectionId:identifier(input.sectionId),prefix:text(input.prefix,70,'Masa adı öneki'),start:input.start,count:input.count};
      return command('dining.tables.create',input,actorId,payload,async connection=>{
        const [[section]]=await connection.execute('SELECT id FROM dining_sections WHERE id=? FOR UPDATE',[payload.sectionId]);
        if(!section)throw problem(400,'INVALID_SECTION','Bölüm bulunamadı.');
        const names=Array.from({length:payload.count},(_,index)=>`${payload.prefix} ${payload.start+index}`);
        const [existing]=await connection.execute(`SELECT name FROM dining_tables WHERE section_id=? AND name IN (${names.map(()=>'?').join(',')})`,[payload.sectionId,...names]);
        if(existing.length)throw problem(409,'DUPLICATE_RECORD','Bu bölümde aynı adlı masa var. Başlangıç numarasını veya ad önekini değiştirin. Hiçbir masa eklenmedi.');
        const ids=[];
        for(const name of names){const [result]=await connection.execute('INSERT INTO dining_tables(name,section_id,is_active) VALUES (?,?,TRUE)',[name,payload.sectionId]);ids.push(String(result.insertId));}
        return {ids,count:ids.length};
      });
    },
    async saveTable(id,input,actorId) {
      object(input,['requestKey','revision','name','sectionId','isActive']);
      if (typeof input.isActive!=='boolean') throw problem(400,'INVALID_INPUT','Masa aktifliği geçersiz.');
      const payload={id:id === null ? null:identifier(id),name:text(input.name,80,'Masa adı'),sectionId:identifier(input.sectionId),isActive:input.isActive,
        revision:id === null ? null:identifier(input.revision)};
      return command('dining.table.save',input,actorId,payload,async connection => {
        const [[section]]=await connection.execute('SELECT id FROM dining_sections WHERE id=? FOR UPDATE',[payload.sectionId]);
        if (!section) throw problem(400,'INVALID_SECTION','Bölüm bulunamadı.');
        if (id !== null) {
          const [[row]]=await connection.execute('SELECT revision FROM dining_tables WHERE id=? FOR UPDATE',[payload.id]);
          if (!row) throw problem(404,'NOT_FOUND','Masa bulunamadı.');
          if (String(row.revision)!==payload.revision) throw conflict();
          const [[assignment]]=await connection.execute('SELECT id FROM table_assignments WHERE table_id=? AND released_at_utc IS NULL',[payload.id]);
          if (assignment && !payload.isActive) throw problem(409,'TABLE_OCCUPIED','Açık hesabı bulunan masa pasif yapılamaz.');
          await connection.execute('UPDATE dining_tables SET name=?,section_id=?,is_active=?,revision=revision+1 WHERE id=?',[payload.name,payload.sectionId,payload.isActive,payload.id]);
        } else {
          const [result]=await connection.execute('INSERT INTO dining_tables(name,section_id,is_active) VALUES (?,?,?)',[payload.name,payload.sectionId,payload.isActive]); payload.id=String(result.insertId);
        }
        return {id:payload.id};
      });
    }
  };
}
