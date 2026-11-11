export const importReversal = [
  {table:'import_rows',column:'undo_json',type:'json',sql:'ALTER TABLE import_rows ADD COLUMN undo_json JSON NULL'},
  {table:'import_batches',column:'reversed_operation_id',type:'bigint unsigned',sql:'ALTER TABLE import_batches ADD COLUMN reversed_operation_id BIGINT UNSIGNED NULL, ADD CONSTRAINT fk_import_reversal FOREIGN KEY (reversed_operation_id) REFERENCES business_operations(id)'}
];
