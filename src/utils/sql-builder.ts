const ALLOWED_COLUMNS = new Set([
  'status',
  'output_json',
  'metadata_json',
  'updated_at',
  'run_id',
  'workspace_id',
]);

function validateColumn(column: string): void {
  if (!ALLOWED_COLUMNS.has(column)) {
    throw new Error('Invalid column name: ' + column);
  }
}

export function buildPartialUpdate(
  table: string,
  fields: Array<{ column: string; value: unknown }>,
  whereColumns: Array<{ column: string; value: unknown }>,
): { sql: string; params: unknown[] } {
  if (fields.length === 0) {
    throw new Error('No fields to update');
  }
  for (const f of fields) {
    validateColumn(f.column);
  }
  for (const w of whereColumns) {
    validateColumn(w.column);
  }
  const setClauses = fields.map((f) => `${f.column} = ?`);
  const whereClauses = whereColumns.map((w) => `${w.column} = ?`);
  const sql = `UPDATE ${table} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;
  const params = [...fields.map((f) => f.value), ...whereColumns.map((w) => w.value)];
  return { sql, params };
}
