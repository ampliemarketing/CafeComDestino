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

// Colunas `numeric` do Postgres voltam como NÚMERO na API REST (PostgREST) mas
// como STRING no payload de Realtime (postgres_changes). Sem coagir, um
// `"0.00" + "0.00"` vira concatenação e o `.toFixed()` seguinte estoura — foi o
// que quebrava a tela de Caixas logo depois de abrir um turno (evento realtime).
export const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(v as string);
  return Number.isFinite(n) ? n : 0;
};

// Igual a `num`, mas mantém null/undefined (ex.: valores conferidos só existem
// depois do fechamento; virar 0 mostraria "conferido" onde não foi).
export const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(v as string);
  return Number.isFinite(n) ? n : null;
};
