// Conversão de linha do Supabase (snake_case) <-> objeto JS (camelCase).
// Colunas jsonb aninhadas (ex: address, buffetPrices) já guardam chaves em
// camelCase como estão — só as colunas de topo da linha precisam converter.
export const toCamelKey = (s: string) => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
export const toSnakeKey = (s: string) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());

export function rowToCamel<T>(row: Record<string, any>): T {
  const out: Record<string, any> = {};
  Object.keys(row).forEach((k) => { out[toCamelKey(k)] = row[k]; });
  return out as T;
}

export function toRow(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  Object.keys(obj).forEach((k) => { out[toSnakeKey(k)] = obj[k]; });
  return out;
}
