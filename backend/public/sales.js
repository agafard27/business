import {renderOrderEntry,renderTableOrder} from './order-entry.js';
import {renderPaymentEntry} from './payment-entry.js';
import {renderAccountList} from './account-list.js';

// Only screen routing lives here. Order, collection and account tools are separate modules.
export async function renderSales(container,context){
  const {request,user,isCurrent,groupId}=context;
  if(context.tableDraft)return renderTableOrder(container,context);
  if(!groupId)return renderAccountList(container,context);
  const {group}=await request('/api/sales/groups/'+groupId);if(!isCurrent())return;
  const refresh=()=>renderSales(container,context);
  const canOrder=user.permissions.includes('orders.write')||user.permissionRules?.some(rule=>rule.code==='orders.write'&&!rule.requiresApproval&&rule.amountLimitMinor!==null);
  if(group.status==='open'&&canOrder&&!context.paymentMode){
    return renderOrderEntry(container,{...context,group,onRefresh:refresh,onPayment:()=>renderSales(container,{...context,paymentMode:true})});
  }
  return renderPaymentEntry(container,{...context,group,refresh,onOrder:()=>renderSales(container,{...context,paymentMode:false})});
}
