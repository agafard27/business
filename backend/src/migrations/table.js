export function table(name, body) {
  return { name, sql: `CREATE TABLE IF NOT EXISTS \`${name}\` (\n${body}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci` };
}
