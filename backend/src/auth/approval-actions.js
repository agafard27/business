import { createApprovalService } from './approvals.js';
import { createSalesService } from '../sales/service.js';
import { createPaymentService } from '../sales/payments.js';
import { createStockService } from '../stock/service.js';
import { createExpenseService } from '../expenses/service.js';
import { createFinanceService } from '../finance/service.js';
import { createPurchasingService } from '../purchasing/service.js';
export function createDefaultApprovalService(config){
  const sales=createSalesService(config),payments=createPaymentService(config),stock=createStockService(config),expenses=createExpenseService(config),finance=createFinanceService(config),purchases=createPurchasingService(config);
  const command=(payload,requestKey)=>({...payload.command,requestKey});
  return createApprovalService(config,{
    'sales.submit':{name:'Sipariş gönderimi',requestPermission:'orders.write',invoke:(p,actor,k)=>sales.submit(p.id,command(p,k),actor)},
    'sales.table.submit':{name:'Masaya ilk sipariş',requestPermission:'orders.write',invoke:(p,actor,k)=>sales.submitForTable(p.id,command(p,k),actor)},
    'sales.cancel':{name:'Sipariş iptali',requestPermission:'orders.write',invoke:(p,actor,k)=>sales.cancelLine(p.id,p.lineId,command(p,k),actor)},
    'sales.settle':{name:'Tahsilat / veresiye',requestPermission:'payments.write',invoke:(p,actor,k)=>payments.settle(p.id,command(p,k),actor)},
    'stock.movement':{name:'Stok düzeltmesi / tüketim',requestPermission:'stock.manage',invoke:(p,actor,k)=>stock.movement(command(p,k),actor)},
    'expense.create':{name:'Gider kaydı',requestPermission:'expenses.manage',invoke:(p,actor,k)=>expenses.create(command(p,k),actor)},
    'expense.pay':{name:'Gider ödemesi',requestPermission:'expenses.manage',invoke:(p,actor,k)=>expenses.pay(p.id,command(p,k),actor)},
    'cash.movement':{name:'Kasa hareketi',requestPermission:'cash.manage',invoke:(p,actor,k)=>finance.cashMovement(command(p,k),actor)},
    'purchase.create':{name:'Alış kaydı',requestPermission:'purchases.manage',invoke:(p,actor,k)=>purchases.create(command(p,k),actor)},
    'purchase.receive':{name:'Mal kabulü',requestPermission:'purchases.manage',invoke:(p,actor,k)=>purchases.receive(p.id,command(p,k),actor)}
  });
}
