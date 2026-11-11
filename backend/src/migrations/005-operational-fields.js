export const operationalFields=[
  {table:'settlement_groups',column:'bill_requested_at_utc',definition:'DATETIME(6) NULL',type:'datetime(6)',nullable:'YES',defaultValue:null},
  {table:'parties',column:'revision',definition:'BIGINT UNSIGNED NOT NULL DEFAULT 1',type:'bigint unsigned',nullable:'NO',defaultValue:'1'}
].map(step=>({...step,sql:`ALTER TABLE ${step.table} ADD COLUMN ${step.column} ${step.definition}`}));
