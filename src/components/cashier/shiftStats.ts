import { supabase } from '../../lib/supabaseClient';
import { Order, Product, Category } from '../../types';

const toCamelKey = (s: string) => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

function rowToCamel<T>(row: Record<string, any>): T {
  const out: Record<string, any> = {};
  Object.keys(row).forEach((k) => { out[toCamelKey(k)] = row[k]; });
  return out as T;
}

export const mapOrderRow = (row: any): Order => rowToCamel<Order>(row);

export async function fetchShiftOrders(shiftId: string): Promise<Order[]> {
  const { data } = await supabase.from('orders').select('*').eq('shift_id', shiftId);
  return data ? data.map(mapOrderRow) : [];
}

export interface ShiftSalesStats {
  totalBruto: number;
  numPedidos: number;
  ticketMedio: number;
  cancelamentos: { qtd: number; valor: number };
  descontos: { qtd: number; valor: number };
  porCategoria: { categoryId: string; categoryName: string; total: number }[];
}

// Verde = bate certinho, vermelho = falta dinheiro, âmbar = sobra.
export function diffTone(diff: number | undefined | null): 'neutral' | 'ok' | 'short' | 'over' {
  if (diff === undefined || diff === null) return 'neutral';
  if (diff === 0) return 'ok';
  return diff < 0 ? 'short' : 'over';
}

export const diffToneClasses: Record<'neutral' | 'ok' | 'short' | 'over', { box: string; label: string; value: string }> = {
  neutral: { box: 'bg-stone-50 border-stone-200', label: 'text-stone-500', value: 'text-stone-900' },
  ok: { box: 'bg-emerald-50 border-emerald-200', label: 'text-emerald-700', value: 'text-emerald-800' },
  short: { box: 'bg-rose-50 border-rose-200', label: 'text-rose-700', value: 'text-rose-800' },
  over: { box: 'bg-amber-50 border-amber-200', label: 'text-amber-700', value: 'text-amber-800' },
};

export function computeShiftStats(orders: Order[], products: Product[], categories: Category[]): ShiftSalesStats {
  const validOrders = orders.filter((o) => o.orderStatus !== 'cancelado');
  const cancelados = orders.filter((o) => o.orderStatus === 'cancelado');
  const comDesconto = orders.filter((o) => o.discount > 0);

  const totalBruto = validOrders.reduce((sum, o) => sum + o.total, 0);
  const numPedidos = validOrders.length;
  const ticketMedio = numPedidos > 0 ? totalBruto / numPedidos : 0;

  const productCategoryId = new Map(products.map((p) => [p.id, p.categoryId]));
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const porCategoriaMap = new Map<string, number>();

  validOrders.forEach((o) => {
    (o.items || []).forEach((it) => {
      const catId = productCategoryId.get(it.productId) || 'outros';
      const additionsTotal = (it.additions || []).reduce((s, a) => s + a.price, 0);
      const itemTotal = (it.unitPrice + additionsTotal) * it.quantity;
      porCategoriaMap.set(catId, (porCategoriaMap.get(catId) || 0) + itemTotal);
    });
  });

  const porCategoria = Array.from(porCategoriaMap.entries())
    .map(([categoryId, total]) => ({
      categoryId,
      categoryName: categoryName.get(categoryId) || 'Outros',
      total,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    totalBruto,
    numPedidos,
    ticketMedio,
    cancelamentos: { qtd: cancelados.length, valor: cancelados.reduce((s, o) => s + o.total, 0) },
    descontos: { qtd: comDesconto.length, valor: comDesconto.reduce((s, o) => s + o.discount, 0) },
    porCategoria,
  };
}
