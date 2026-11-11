export const saleStockSnapshots=[
  {column:'stock_mode_snapshot',definition:"ENUM('none','direct','recipe') NULL",type:"enum('none','direct','recipe')"},
  {column:'stock_timing_snapshot',definition:"ENUM('sale','submission','preparation','manual') NULL",type:"enum('sale','submission','preparation','manual')"},
  {column:'base_unit_id_snapshot',definition:'BIGINT UNSIGNED NULL',type:'bigint unsigned'},
  {column:'warehouse_id_snapshot',definition:'BIGINT UNSIGNED NULL',type:'bigint unsigned'}
].map(step=>({...step,table:'check_lines',sql:`ALTER TABLE check_lines ADD COLUMN ${step.column} ${step.definition}`}));
