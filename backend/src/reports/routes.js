import { requirePermission } from '../auth/routes.js';
import { businessRouter,endpoint,businessErrors } from '../business/router.js';
export function createReportRouter(service,auth,monitor){
  const router=businessRouter(auth,monitor);
  router.get('/summary',requirePermission('reports.read'),endpoint(req=>service.summary(req.query,{allProducts:true})));
  router.get('/dashboard',requirePermission('dashboard.read'),endpoint(req=>service.dashboard(req.query,req.user)));
  router.get('/audit',requirePermission('reports.read'),endpoint(req=>service.audit(req.query)));
  router.get('/details',requirePermission('reports.read'),endpoint(req=>service.details(req.query)));
  router.get('/export',requirePermission('reports.read'),async(req,res,next)=>{try{
    const data=await service.summary(req.query,{allProducts:true});const cell=value=>`"${String(value).replace(/^[=+\-@\t\r]/,"'$&").replaceAll('"','""')}"`;
    const rows=[['Ürün','Birim','Miktar','Tutar (kuruş)'],...data.products.map(row=>[row.name,row.unitCode,row.quantity,row.amountMinor])];
    res.set({'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="satis-raporu.csv"'}).send('\ufeff'+rows.map(row=>row.map(cell).join(';')).join('\r\n'));
  }catch(error){next(error);}});
  return businessErrors(router);
}
