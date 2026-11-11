// Historical closures remain readable; all new handovers require a recipient.
export const cashHandover = [
  {table:'cash_shifts',column:'handover_to_user_id',type:'bigint unsigned',target:'app_users',sql:'ALTER TABLE cash_shifts ADD COLUMN handover_to_user_id BIGINT UNSIGNED NULL, ADD CONSTRAINT fk_cash_handover_user FOREIGN KEY (handover_to_user_id) REFERENCES app_users(id)'},
  {table:'cash_shifts',column:'handover_operation_id',type:'bigint unsigned',target:'business_operations',sql:'ALTER TABLE cash_shifts ADD COLUMN handover_operation_id BIGINT UNSIGNED NULL, ADD CONSTRAINT fk_cash_handover_operation FOREIGN KEY (handover_operation_id) REFERENCES business_operations(id)'}
];
