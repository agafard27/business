export const diningRevisions = ['dining_sections', 'dining_tables'].map(table => ({ table, column:'revision',
  sql:`ALTER TABLE ${table} ADD COLUMN revision BIGINT UNSIGNED NOT NULL DEFAULT 1` }));
