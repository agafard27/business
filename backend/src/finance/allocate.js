import {problem} from '../business/core.js';

// Caller holds the party lock. Link money to the original debt, including when
// payment starts from the party screen rather than an individual invoice.
export async function allocatePartyPayment(connection,{accountId,paymentId,amount,purchaseId=null,expenseId=null}){
  const [entries]=await connection.execute(`SELECT e.id,e.amount_minor,s.purchase_id,s.expense_id,
    COALESCE((SELECT SUM(a.amount_minor) FROM party_payment_allocations a WHERE a.party_entry_id=e.id),0) AS paid,
    COALESCE((SELECT -SUM(r.amount_minor) FROM party_entries r LEFT JOIN party_entry_sources rs ON rs.party_entry_id=r.id
      WHERE r.amount_minor<0 AND r.entry_type<>'payment' AND (r.reversal_of_id=e.id OR (s.purchase_id IS NOT NULL AND rs.purchase_id=s.purchase_id))),0) AS reductions
    FROM party_entries e LEFT JOIN party_entry_sources s ON s.party_entry_id=e.id
    WHERE e.account_id=? AND e.amount_minor>0 ${purchaseId?'AND s.purchase_id=?':expenseId?'AND s.expense_id=?':''} ORDER BY e.id`,[accountId,...(purchaseId?[purchaseId]:expenseId?[expenseId]:[])]);
  let remaining=BigInt(amount);
  for(const entry of entries){
    if(!remaining)break;const available=BigInt(entry.amount_minor)-BigInt(entry.paid)-BigInt(entry.reductions);if(available<=0n)continue;
    const part=remaining<available?remaining:available;
    await connection.execute('INSERT INTO party_payment_allocations(payment_id,party_entry_id,amount_minor) VALUES (?,?,?)',[paymentId,entry.id,part.toString()]);
    if(entry.purchase_id)await connection.execute('INSERT INTO purchase_payment_allocations(purchase_id,payment_id,amount_minor) VALUES (?,?,?)',[entry.purchase_id,paymentId,part.toString()]);
    if(entry.expense_id)await connection.execute('INSERT INTO expense_payment_allocations(expense_id,payment_id,amount_minor) VALUES (?,?,?)',[entry.expense_id,paymentId,part.toString()]);
    remaining-=part;
  }
  if(remaining)throw problem(409,'BALANCE_CHANGED','Ödenecek borcun kalan tutarı değişmiş. Hareketleri yenileyin.');
}
