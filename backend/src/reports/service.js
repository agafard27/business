import { object,problem,snapshot } from '../business/core.js';
import {reportDetails} from './details.js';
export function dateRange(query={}){
  object(query,['from','to']);
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul'}).format(new Date());
  const from=query.from||today,to=query.to||today;
  for(const date of [from,to])if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(`${date}T00:00:00Z`))||new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)!==date)throw problem(400,'INVALID_INPUT','Tarih YYYY-AA-GG biçiminde olmalı.');
  const start=new Date(`${from}T00:00:00+03:00`),end=new Date(new Date(`${to}T00:00:00+03:00`).getTime()+86400000);
  if(end<=start||end-start>366*86400000)throw problem(400,'INVALID_INPUT','Tarih aralığı 1–366 gün olmalı.');
  const sql=date=>date.toISOString().slice(0,19).replace('T',' ');return {from,to,start:sql(start),end:sql(end)};
}
export function createReportService(config){
  return {
    details(query){return reportDetails(config,query);},
    async dashboard(query,user){const data=await this.summary(query);const keys=['range','checkedAtUtc','netSalesMinor','payments','expensesMinor','currentReceivableMinor','currentPayableMinor','openGroups'];return snapshot(config,async connection=>{
      const [[open]]=await connection.query(`WITH RECURSIVE family AS (SELECT id AS root,id FROM settlement_groups WHERE status='open' UNION ALL SELECT f.root,g.id FROM family f JOIN settlement_groups g ON g.merged_into_id=f.id)
        SELECT (SELECT COALESCE(SUM(l.total_minor-COALESCE((SELECT SUM(a.amount_minor) FROM sale_adjustments a WHERE a.check_line_id=l.id AND a.adjustment_type IN ('discount','complimentary')),0)),0) FROM settlement_groups g JOIN settlement_group_memberships m ON m.group_id=g.id AND m.left_at_utc IS NULL JOIN check_lines l ON l.check_id=m.check_id WHERE g.status='open' AND NOT EXISTS(SELECT 1 FROM order_line_events e WHERE e.check_line_id=l.id AND e.event_type='cancelled')) - (SELECT COALESCE(SUM(IF(s.direction='settle',s.amount_minor,-CAST(s.amount_minor AS SIGNED))),0) FROM family f JOIN bill_settlements s ON s.group_id=f.id) AS amount`);
      const [low]=await connection.query(`SELECT p.id,p.name,p.reorder_quantity,COALESCE(SUM(m.quantity_base),0) AS quantity FROM products p LEFT JOIN stock_movements m ON m.product_id=p.id WHERE p.is_active=TRUE AND p.reorder_quantity IS NOT NULL GROUP BY p.id,p.name,p.reorder_quantity HAVING COALESCE(SUM(m.quantity_base),0)<=p.reorder_quantity ORDER BY quantity LIMIT 20`);
      const [expiry]=await connection.query(`SELECT l.id,p.name,l.lot_code,l.expires_at_utc,SUM(m.quantity_base) AS quantity FROM stock_lots l JOIN products p ON p.id=l.product_id JOIN stock_movements m ON m.lot_id=l.id WHERE l.expires_at_utc<=TIMESTAMPADD(DAY,7,UTC_TIMESTAMP()) GROUP BY l.id,p.name,l.lot_code,l.expires_at_utc HAVING SUM(m.quantity_base)>0 ORDER BY l.expires_at_utc LIMIT 20`);
      const [due]=await connection.query(`SELECT e.id,p.name,e.due_date,e.amount_minor-COALESCE((SELECT SUM(a.amount_minor) FROM party_payment_allocations a WHERE a.party_entry_id=e.id),0) AS remaining FROM party_entries e JOIN party_accounts ac ON ac.id=e.account_id JOIN parties p ON p.id=ac.party_id WHERE e.due_date<=DATE_ADD(UTC_DATE(),INTERVAL 7 DAY) AND e.amount_minor>0 AND (SELECT SUM(balance.amount_minor) FROM party_entries balance WHERE balance.account_id=ac.id)>0 HAVING remaining>0 ORDER BY e.due_date LIMIT 20`);
      const [[approvals]]=await connection.execute(`SELECT COUNT(*) AS count FROM approval_requests WHERE status='pending' ${user.permissions.includes('users.manage')?'':'AND requested_by_user_id=?'}`,user.permissions.includes('users.manage')?[]:[user.id]);
      return {...Object.fromEntries(keys.map(key=>[key,data[key]])),openBalanceMinor:String(open.amount),pendingApprovals:Number(approvals.count),lowStock:low.map(row=>({id:String(row.id),name:row.name,quantity:row.quantity,threshold:row.reorder_quantity})),expiringLots:expiry.map(row=>({id:String(row.id),name:row.name,code:row.lot_code,quantity:row.quantity,expiresAtUtc:row.expires_at_utc})),upcomingDues:due.map(row=>({id:String(row.id),name:row.name,dueDate:row.due_date,amountMinor:String(row.remaining)}))};
    });},
    async summary(query,{allProducts=false}={}){const range=dateRange(query);return snapshot(config,async connection=>{
      const bounds=[range.start,range.end];
      const [[sales]]=await connection.execute(`SELECT COALESCE(SUM(l.total_minor),0) AS gross,COUNT(*) AS line_count FROM check_lines l WHERE l.created_at_utc>=? AND l.created_at_utc<?`,bounds);
      const [[cancelled]]=await connection.execute(`SELECT COALESCE(SUM(l.total_minor),0) AS amount FROM check_lines l WHERE l.created_at_utc>=? AND l.created_at_utc<? AND EXISTS(SELECT 1 FROM order_line_events e WHERE e.check_line_id=l.id AND e.event_type='cancelled')`,bounds);
      const [[adjustments]]=await connection.execute(`SELECT COALESCE(SUM(a.amount_minor),0) AS amount FROM sale_adjustments a JOIN check_lines l ON l.id=a.check_line_id WHERE l.created_at_utc>=? AND l.created_at_utc<? AND a.adjustment_type IN ('discount','complimentary') AND NOT EXISTS(SELECT 1 FROM order_line_events e WHERE e.check_line_id=l.id AND e.event_type='cancelled')`,bounds);
      const [payments]=await connection.execute(`SELECT method,direction,SUM(amount_minor) AS amount FROM payments WHERE created_at_utc>=? AND created_at_utc<? GROUP BY method,direction`,bounds);
      const [[credit]]=await connection.execute("SELECT COALESCE(SUM(amount_minor),0) AS amount FROM party_entries WHERE entry_type='sale_credit' AND created_at_utc>=? AND created_at_utc<?",bounds);
      const [[expenses]]=await connection.execute("SELECT COALESCE(SUM(IF(expense_type IN ('operating','staff_payment'),total_minor,0)),0) AS amount,COALESCE(SUM(IF(expense_type='staff_advance',total_minor,0)),0) AS advance,COALESCE(SUM(IF(expense_type='equipment',total_minor,0)),0) AS equipment FROM expenses WHERE incurred_at_utc>=? AND incurred_at_utc<?",bounds);
      const [[parties]]=await connection.query("SELECT COALESCE(SUM(IF(a.account_type='receivable',e.amount_minor,0)),0) AS receivable,COALESCE(SUM(IF(a.account_type='payable',e.amount_minor,0)),0) AS payable FROM party_accounts a JOIN party_entries e ON e.account_id=a.id");
      const [[open]]=await connection.query("SELECT COUNT(*) AS count FROM settlement_groups WHERE status='open'");
      const [top]=await connection.execute(`SELECT product_id,product_name,unit_code,SUM(quantity) AS quantity,SUM(total_minor-COALESCE((SELECT SUM(a.amount_minor) FROM sale_adjustments a WHERE a.check_line_id=l.id AND a.adjustment_type IN ('discount','complimentary')),0)) AS amount FROM check_lines l WHERE created_at_utc>=? AND created_at_utc<? AND NOT EXISTS(SELECT 1 FROM order_line_events e WHERE e.check_line_id=l.id AND e.event_type='cancelled') GROUP BY product_id,product_name,unit_code ORDER BY amount DESC ${allProducts?'':'LIMIT 30'}`,bounds);
      const [[cost]]=await connection.execute(`SELECT COALESCE(SUM(IF(c.consumed>0 AND c.unknown_cost=0,c.cost,0)),0) AS known_cost,
        COALESCE(SUM(IF(c.consumed>0 AND c.unknown_cost=0 AND c.stock_mode_snapshot IN ('direct','recipe') AND c.stock_timing_snapshot<>'manual',0,1)),0) AS missing FROM (
        SELECT l.id,l.stock_mode_snapshot,l.stock_timing_snapshot,-SUM(m.quantity_base) AS consumed,SUM(m.unit_cost_minor IS NULL) AS unknown_cost,ROUND(-SUM(m.quantity_base*m.unit_cost_minor),0) AS cost
        FROM check_lines l LEFT JOIN stock_movements m ON m.check_line_id=l.id
        WHERE l.created_at_utc>=? AND l.created_at_utc<? AND NOT EXISTS(SELECT 1 FROM order_line_events e WHERE e.check_line_id=l.id AND e.event_type='cancelled') GROUP BY l.id,l.stock_mode_snapshot,l.stock_timing_snapshot) c`,bounds);
      const net=BigInt(sales.gross)-BigInt(cancelled.amount)-BigInt(adjustments.amount),profitAvailable=Number(cost.missing)===0;
      return {range:{from:range.from,to:range.to},checkedAtUtc:new Date().toISOString(),grossSalesMinor:String(sales.gross),cancelledMinor:String(cancelled.amount),adjustmentsMinor:String(adjustments.amount),netSalesMinor:(BigInt(sales.gross)-BigInt(cancelled.amount)-BigInt(adjustments.amount)).toString(),
        payments:payments.map(row=>({method:row.method,direction:row.direction,amountMinor:String(row.amount)})),creditSalesMinor:String(credit.amount),expensesMinor:String(expenses.amount),staffAdvancesMinor:String(expenses.advance),
        currentReceivableMinor:String(parties.receivable),currentPayableMinor:String(parties.payable),openGroups:Number(open.count),profitAvailable,knownCostMinor:String(cost.known_cost),missingCostLines:Number(cost.missing),equipmentMinor:String(expenses.equipment),grossProfitMinor:profitAvailable?(net-BigInt(cost.known_cost)).toString():null,operatingResultMinor:profitAvailable?(net-BigInt(cost.known_cost)-BigInt(expenses.amount)).toString():null,
        products:top.map(row=>({id:String(row.product_id),name:row.product_name,unitCode:row.unit_code,quantity:row.quantity,amountMinor:String(row.amount)}))};
    });},
    async audit(query){const range=dateRange(query);return snapshot(config,async connection=>{
      const [rows]=await connection.execute(`SELECT a.id,a.action_code,a.outcome,a.created_at_utc,u.display_name AS actor_name FROM audit_events a LEFT JOIN app_users u ON u.id=a.actor_user_id WHERE a.created_at_utc>=? AND a.created_at_utc<? ORDER BY a.id DESC LIMIT 500`,[range.start,range.end]);
      return {events:rows.map(row=>({id:String(row.id),action:row.action_code,outcome:row.outcome,actorName:row.actor_name,createdAtUtc:row.created_at_utc}))};
    });}
  };
}
