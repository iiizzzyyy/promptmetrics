export function buildPartialUpdate(
  table: string,
  fields: Array<{ column: string; value: unknown }>,
  whereColumns: Array<{ column: string; value: unknown }>,
): { sql: string; params: unknown[] } {
  if (fields.length === 0) {
    throw new Error('No fields to update');
  }
  const setClauses = fields.map((f) => `${f.column} = ?`);
  const whereClauses = whereColumns.map((w) => `${w.column} = ?`);
  const sql = `UPDATE ${table} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;
  const params = [...fields.map((f) => f.value), ...whereColumns.map((w) => w.value)];
  return { sql, params };
}
