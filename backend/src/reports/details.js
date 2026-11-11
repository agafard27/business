import {object,problem,snapshot} from '../business/core.js';
import {identifier} from '../catalog/validation.js';
import {dateRange} from './service.js';
const reports={
  sales:{date:'l.created_at_utc',id:'l.id',sql:`SELECT l.id,l.created_at_utc AS date,l.product_name AS name,l.quantity,l.unit_code AS unit,l.total_minor AS amount_minor,c.check_type AS kind,l.check_id AS source_id,u.display_name AS actor FROM check_lines l JOIN checks c ON c.id=l.check_id JOIN app_users u ON u.id=l.added_by`},
  purchases:{date:'p.created_at_utc',id:'p.id',sql:`SELECT p.id,p.created_at_utc AS date,p.document_number AS name,p.total_minor AS amount_minor,p.status AS kind,p.due_date,u.display_name AS actor FROM purchases p JOIN app_users u ON u.id=p.created_by`},
  stock:{date:'m.created_at_utc',id:'m.id',sql:`SELECT m.id,m.created_at_utc AS date,p.name,m.quantity_base AS quantity,unit.code AS unit,m.unit_cost_minor AS unit_cost_minor,d.document_type AS kind,d.reason,u.display_name AS actor,l.lot_code,w.name AS warehouse FROM stock_movements m JOIN products p ON p.id=m.product_id LEFT JOIN units unit ON unit.id=p.base_unit_id JOIN stock_documents d ON d.id=m.document_id JOIN app_users u ON u.id=d.actor_user_id JOIN warehouses w ON w.id=m.warehouse_id LEFT JOIN stock_lots l ON l.id=m.lot_id`},
  production:{date:'b.prepared_at_utc',id:'b.id',sql:`SELECT b.id,b.prepared_at_utc AS date,p.name,b.batch_code,b.actual_output_quantity_base AS quantity,unit.code AS unit,b.total_cost_minor AS amount_minor,u.display_name AS actor FROM production_batches b JOIN products p ON p.id=b.output_product_id LEFT JOIN units unit ON unit.id=p.base_unit_id JOIN app_users u ON u.id=b.prepared_by`},
  expenses:{date:'e.incurred_at_utc',id:'e.id',sql:`SELECT e.id,e.incurred_at_utc AS date,e.description AS name,e.expense_type AS kind,e.total_minor AS amount_minor,e.due_date,u.display_name AS actor FROM expenses e JOIN app_users u ON u.id=e.created_by`},
  accounts:{date:'e.created_at_utc',id:'e.id',sql:`SELECT e.id,e.created_at_utc AS date,p.name,e.entry_type AS kind,a.account_type,e.amount_minor,e.due_date,e.description AS reason FROM party_entries e JOIN party_accounts a ON a.id=e.account_id JOIN parties p ON p.id=a.party_id`},
  cash:{date:'m.created_at_utc',id:'m.id',sql:`SELECT m.id,m.created_at_utc AS date,r.name,m.movement_kind AS kind,m.amount_minor,m.reason,u.display_name AS actor FROM cash_movements m JOIN cash_shifts s ON s.id=m.cash_shift_id JOIN cash_registers r ON r.id=s.cash_register_id JOIN app_users u ON u.id=m.actor_user_id`},
  shifts:{date:'s.created_at_utc',id:'s.id',sql:`SELECT s.id,s.created_at_utc AS date,r.name,s.status AS kind,s.expected_amount_minor,s.counted_amount_minor,s.difference_amount_minor,s.expected_pos_amount_minor,s.counted_pos_amount_minor,s.closing_reason AS reason,u.display_name AS actor FROM cash_shifts s JOIN cash_registers r ON r.id=s.cash_register_id JOIN app_users u ON u.id=s.responsible_user_id`},
  adjustments:{date:'a.created_at_utc',id:'a.id',sql:`SELECT a.id,a.created_at_utc AS date,l.product_name AS name,a.adjustment_type AS kind,a.amount_minor,a.reason,a.check_line_id AS source_id FROM sale_adjustments a JOIN check_lines l ON l.id=a.check_line_id`}
};
reports.groups={date:'g.opened_at_utc',id:'g.id',sql:`SELECT g.id,g.opened_at_utc AS date,COALESCE((SELECT t.name FROM table_assignments a JOIN dining_tables t ON t.id=a.table_id WHERE a.group_id=g.id ORDER BY a.id DESC LIMIT 1),'Masasız adisyon') AS name,g.status AS kind,g.merged_into_id AS target_id,u.display_name AS actor FROM settlement_groups g JOIN app_users u ON u.id=g.opened_by`};
reports.payments={date:'p.created_at_utc',id:'p.id',sql:`SELECT p.id,p.created_at_utc AS date,p.method,p.direction AS kind,p.amount_minor,p.reason,p.shift_id AS source_id,u.display_name AS actor FROM payments p JOIN app_users u ON u.id=p.received_by`};
reports.operating={...reports.expenses,filter:"e.expense_type='operating'"};
reports.equipment={...reports.expenses,filter:"e.expense_type='equipment'"};
reports.staff={...reports.expenses,filter:"e.expense_type IN ('staff_payment','staff_advance')",sql:`SELECT e.id,e.incurred_at_utc AS date,e.description AS name,staff.display_name AS staff,e.expense_type AS kind,e.total_minor AS amount_minor,e.due_date,u.display_name AS actor FROM expenses e JOIN app_users u ON u.id=e.created_by JOIN app_users staff ON staff.id=e.staff_user_id`};
reports.receivables={...reports.accounts,filter:"a.account_type='receivable'"};
reports.payables={...reports.accounts,filter:"a.account_type='payable'"};
// Keep the missing-cost predicate identical to summary(): a partial known cost
// must never turn a sale with incomplete cost evidence into a profit figure.
reports.costs={date:'l.created_at_utc',id:'l.id',filter:`NOT EXISTS(SELECT 1 FROM order_line_events e WHERE e.check_line_id=l.id AND e.event_type='cancelled')
  AND NOT (COALESCE(c.consumed,0)>0 AND c.unknown_cost=0 AND COALESCE(l.stock_mode_snapshot,'none') IN ('direct','recipe') AND COALESCE(l.stock_timing_snapshot,'manual')<>'manual')`,
  sql:`SELECT l.id,l.created_at_utc AS date,l.product_name AS name,l.quantity,l.unit_code AS unit,l.check_id AS source_id,
    JSON_UNQUOTE(JSON_EXTRACT(l.stock_issue_json,'$.message')) AS reason,
    CASE WHEN l.stock_mode_snapshot IS NULL OR l.stock_timing_snapshot IS NULL THEN 'snapshot'
      WHEN l.stock_mode_snapshot='none' THEN 'tracking'
      WHEN l.stock_timing_snapshot='manual' THEN 'manual'
      WHEN COALESCE(c.consumed,0)<=0 THEN 'pending'
      ELSE 'cost' END AS cost_issue
    FROM check_lines l LEFT JOIN (
      SELECT check_line_id,-SUM(quantity_base) AS consumed,SUM(unit_cost_minor IS NULL) AS unknown_cost
      FROM stock_movements WHERE check_line_id IS NOT NULL GROUP BY check_line_id
    ) c ON c.check_line_id=l.id`};
export const reportKinds=Object.keys(reports);
export async function reportDetails(config,query){object(query,['from','to','kind','before']);const report=typeof query.kind==='string'&&Object.hasOwn(reports,query.kind)?reports[query.kind]:null;if(!report)throw problem(400,'INVALID_INPUT','Rapor türü geçersiz.');const range=dateRange({from:query.from,to:query.to}),before=query.before?identifier(query.before):null;return snapshot(config,async connection=>{const [rows]=await connection.execute(`${report.sql} WHERE ${report.date}>=? AND ${report.date}<? ${report.filter?'AND '+report.filter:''} ${before?`AND ${report.id}<?`:''} ORDER BY ${report.id} DESC LIMIT 201`,[range.start,range.end,...(before?[before]:[])]);return {range:{from:range.from,to:range.to},kind:query.kind,nextCursor:rows.length>200?String(rows[199].id):null,rows:rows.slice(0,200).map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,value===null?null:value instanceof Date?value.toISOString():String(value)])))};});}
