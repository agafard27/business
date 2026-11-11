import { requirePermission } from '../auth/routes.js';
import { businessRouter,endpoint,writeGuards,businessErrors } from '../business/router.js';
export function createFinanceRouter(service,auth,monitor){
  const router=businessRouter(auth,monitor);
  router.get('/cash',requirePermission('cash.manage'),endpoint(()=>service.cash()));
  router.post('/registers',...writeGuards('settings.manage'),endpoint(req=>service.register(req.body,req.user.id)));
  router.post('/shifts',...writeGuards('cash.manage'),endpoint(req=>service.openShift(req.body,req.user.id)));
  router.post('/cash-sessions/:id/handover',...writeGuards('cash.manage'),endpoint(req=>service.closeShift(req.params.id,req.body,req.user.id)));
  router.post('/shifts/:id/close',...writeGuards('cash.manage'),endpoint(req=>service.closeShift(req.params.id,req.body,req.user.id)));
  router.post('/cash-movements',...writeGuards('cash.manage'),endpoint(req=>service.cashMovement(req.body,req.user.id)));
  router.post('/transfers',...writeGuards('cash.manage'),endpoint(req=>service.transfer(req.body,req.user.id)));
  router.get('/parties',requirePermission('parties.manage'),endpoint(()=>service.parties()));
  router.get('/payment-meta',requirePermission('parties.manage'),endpoint(()=>service.paymentMeta()));
  router.post('/parties',...writeGuards('parties.manage'),endpoint(req=>service.party(req.body,req.user.id)));
  router.patch('/parties/:id',...writeGuards('parties.manage'),endpoint(req=>service.updateParty(req.params.id,req.body,req.user.id)));
  router.get('/parties/:id/ledger',requirePermission('parties.manage'),endpoint(req=>service.ledger(req.params.id)));
  router.post('/parties/:id/entries',...writeGuards('parties.manage'),endpoint(req=>service.partyEntry(req.params.id,req.body,req.user.id)));
  return businessErrors(router);
}
