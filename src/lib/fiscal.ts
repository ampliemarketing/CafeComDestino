// Constantes e helpers fiscais compartilhados pelo cadastro de produto (aba
// Fiscal) e pelo editor de Grupos Tributários. O objetivo é reunir num só lugar
// as listas de códigos (origem, CST/CSOSN, CST PIS/COFINS, CFOP) e as regras de
// "quais campos são obrigatórios" antes de mandar o item pro emissor de NF.

import type { FiscalData, FiscalInvoice, Order, OrderChannel, PaymentMethod, Product, TaxGroup } from '../types';

export const emptyFiscalData = (): FiscalData => ({
  origem: '0',
  ncm: '',
  cest: '',
  cfop: '5102',
  gtin: '',
  unidadeTributavel: '',
  cstCsosn: '102',
  temSt: false,
  cstPis: '49',
  aliqPis: 0,
  cstCofins: '49',
  aliqCofins: 0,
  cBenef: '',
  infAdicional: '',
});

/** Normaliza um `fiscal` possivelmente incompleto (linhas antigas) para a forma atual. */
export const normalizeFiscalData = (f?: Partial<FiscalData> | null): FiscalData => ({
  ...emptyFiscalData(),
  ...(f || {}),
});

export const ORIGEM_OPTIONS: { value: string; label: string }[] = [
  { value: '0', label: '0 - Nacional (exceto 3, 4, 5 e 8)' },
  { value: '1', label: '1 - Estrangeira - Importação direta (exceto 6)' },
  { value: '2', label: '2 - Estrangeira - Adquirida no mercado interno (exceto 7)' },
  { value: '3', label: '3 - Nacional, importação de 40% a 70%' },
  { value: '4', label: '4 - Nacional, produção conforme processos produtivos básicos' },
  { value: '5', label: '5 - Nacional, importação inferior a 40%' },
  { value: '6', label: '6 - Estrangeira - Importação direta, sem similar nacional (lista CAMEX)' },
  { value: '7', label: '7 - Estrangeira - Mercado interno, sem similar nacional (lista CAMEX)' },
  { value: '8', label: '8 - Nacional, importação superior a 70%' },
];

// CSOSN (Simples Nacional) + CST de ICMS (regime normal). O campo é único
// (`cstCsosn`) — o contador escolhe conforme o regime da empresa.
export const CSOSN_OPTIONS: { value: string; label: string }[] = [
  { value: '101', label: '101 - Tributada pelo Simples com permissão de crédito' },
  { value: '102', label: '102 - Tributada pelo Simples sem permissão de crédito' },
  { value: '103', label: '103 - Isenção do ICMS no Simples para faixa de receita' },
  { value: '201', label: '201 - Simples com crédito e com cobrança de ICMS por ST' },
  { value: '202', label: '202 - Simples sem crédito e com cobrança de ICMS por ST' },
  { value: '203', label: '203 - Isenção do ICMS no Simples, com cobrança por ST' },
  { value: '300', label: '300 - Imune' },
  { value: '400', label: '400 - Não tributada pelo Simples Nacional' },
  { value: '500', label: '500 - ICMS cobrado anteriormente por ST ou antecipação' },
  { value: '900', label: '900 - Outros (Simples Nacional)' },
];

export const CST_ICMS_OPTIONS: { value: string; label: string }[] = [
  { value: '00', label: '00 - Tributada integralmente' },
  { value: '10', label: '10 - Tributada e com cobrança do ICMS por ST' },
  { value: '20', label: '20 - Com redução de base de cálculo' },
  { value: '30', label: '30 - Isenta/não tributada e com cobrança do ICMS por ST' },
  { value: '40', label: '40 - Isenta' },
  { value: '41', label: '41 - Não tributada' },
  { value: '50', label: '50 - Suspensão' },
  { value: '51', label: '51 - Diferimento' },
  { value: '60', label: '60 - ICMS cobrado anteriormente por ST' },
  { value: '70', label: '70 - Com redução de base e cobrança do ICMS por ST' },
  { value: '90', label: '90 - Outras' },
];

// CST de PIS/COFINS (tabela única — os códigos valem para os dois tributos).
export const CST_PIS_COFINS_OPTIONS: { value: string; label: string }[] = [
  { value: '01', label: '01 - Operação tributável - alíquota básica' },
  { value: '02', label: '02 - Operação tributável - alíquota diferenciada' },
  { value: '03', label: '03 - Operação tributável - por unidade de medida' },
  { value: '04', label: '04 - Operação tributável - monofásica - alíquota zero' },
  { value: '05', label: '05 - Operação tributável - ST' },
  { value: '06', label: '06 - Operação tributável - alíquota zero' },
  { value: '07', label: '07 - Operação isenta da contribuição' },
  { value: '08', label: '08 - Operação sem incidência da contribuição' },
  { value: '09', label: '09 - Operação com suspensão da contribuição' },
  { value: '49', label: '49 - Outras operações de saída' },
  { value: '99', label: '99 - Outras operações' },
];

// Sugestões de CFOP de saída mais comuns em bar/café/restaurante.
export const CFOP_SAIDA_SUGESTOES: { value: string; label: string }[] = [
  { value: '5101', label: '5101 - Venda de produção do estabelecimento' },
  { value: '5102', label: '5102 - Venda de mercadoria adquirida de terceiros' },
  { value: '5103', label: '5103 - Venda de produção - não incidência do ICMS' },
  { value: '5104', label: '5104 - Venda de mercadoria de terceiros - não incidência' },
  { value: '5405', label: '5405 - Venda de mercadoria com ICMS por ST (contribuinte substituído)' },
  { value: '5656', label: '5656 - Venda de combustível/lubrificante adquirido de terceiros' },
  { value: '5933', label: '5933 - Prestação de serviço tributado pelo ISSQN' },
  { value: '6101', label: '6101 - Venda de produção do estabelecimento (interestadual)' },
  { value: '6102', label: '6102 - Venda de mercadoria de terceiros (interestadual)' },
  { value: '6108', label: '6108 - Venda de mercadoria a não contribuinte (interestadual)' },
  { value: '6404', label: '6404 - Venda de mercadoria com ICMS por ST a consumidor final (interestadual)' },
];

// ---------------------------------------------------------------------------
// Validação: quais campos precisam estar preenchidos antes de emitir
// ---------------------------------------------------------------------------
const onlyDigits = (v: string) => (v || '').replace(/\D/g, '');

/** Campos obrigatórios que estão inválidos/vazios, como mapa de booleanos. */
export interface FiscalFieldErrors {
  origem?: boolean;
  ncm?: boolean;
  cfop?: boolean;
  cest?: boolean;
  cstCsosn?: boolean;
  cstPis?: boolean;
  aliqPis?: boolean;
  cstCofins?: boolean;
  aliqCofins?: boolean;
}

const FISCAL_FIELD_LABELS: Record<keyof FiscalFieldErrors, string> = {
  origem: 'Origem da mercadoria',
  ncm: 'NCM',
  cfop: 'CFOP',
  cest: 'CEST',
  cstCsosn: 'CST / CSOSN de ICMS',
  cstPis: 'CST de PIS',
  aliqPis: 'Alíquota de PIS',
  cstCofins: 'CST de COFINS',
  aliqCofins: 'Alíquota de COFINS',
};

export const fiscalFieldErrors = (f: FiscalData): FiscalFieldErrors => ({
  origem: !f.origem,
  ncm: onlyDigits(f.ncm).length !== 8,
  cfop: onlyDigits(f.cfop).length !== 4,
  cest: !!f.temSt && onlyDigits(f.cest || '').length !== 7,
  cstCsosn: !f.cstCsosn,
  cstPis: !f.cstPis,
  aliqPis: f.aliqPis == null || Number.isNaN(f.aliqPis),
  cstCofins: !f.cstCofins,
  aliqCofins: f.aliqCofins == null || Number.isNaN(f.aliqCofins),
});

export const fiscalMissingFields = (f: FiscalData): string[] => {
  const errs = fiscalFieldErrors(f);
  return (Object.keys(FISCAL_FIELD_LABELS) as (keyof FiscalFieldErrors)[])
    .filter((k) => errs[k])
    .map((k) => FISCAL_FIELD_LABELS[k]);
};

export const isFiscalComplete = (f: FiscalData): boolean => fiscalMissingFields(f).length === 0;

/**
 * Dados fiscais que valem para o produto na hora de emitir a nota.
 * Se o produto está vinculado a um Grupo Tributário, o grupo manda — os dados
 * do grupo são a fonte de verdade e o `product.fiscal` é só um espelho/fallback.
 */
export const resolveProductFiscal = (
  product: Pick<Product, 'fiscal' | 'taxGroupId'>,
  taxGroups: TaxGroup[],
): FiscalData => {
  if (product.taxGroupId) {
    const group = taxGroups.find((g) => g.id === product.taxGroupId);
    if (group) return normalizeFiscalData(group.fiscal);
  }
  return normalizeFiscalData(product.fiscal);
};

// ---------------------------------------------------------------------------
// Pagamento → código da forma de pagamento na NFC-e (tabela tPag da Sefaz)
// ---------------------------------------------------------------------------
/**
 * Mapeia a `PaymentMethod` interna para o código `tPag` que vai no grupo
 * <pag><detPag> da NFC-e. Não depende de nenhuma integração de pagamento — a
 * nota só *declara* como o cliente pagou (maquininha avulsa, PIX manual, etc.).
 * 01 Dinheiro · 03 Cartão de crédito · 04 Cartão de débito · 15 Boleto ·
 * 17 PIX · 11 Vale-refeição (PAT) · 99 Outros.
 */
export const PAYMENT_METHOD_SEFAZ: Record<PaymentMethod, string> = {
  dinheiro: '01',
  cartao_credito: '03',
  cartao_debito: '04',
  pix: '17',
  boleto: '15',
  vale_refeicao: '11',
  multiplo: '99',
};

export interface SefazPaymentEntry {
  /** Código tPag da Sefaz. */
  forma: string;
  /** Rótulo legível (para telas/erros). */
  rotulo: string;
  valor: number;
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  cartao_credito: 'Cartão de crédito',
  cartao_debito: 'Cartão de débito',
  pix: 'PIX',
  boleto: 'Boleto',
  vale_refeicao: 'Vale-refeição',
  multiplo: 'Múltiplo',
};

/**
 * Linhas de pagamento da NFC-e a partir do pedido. Usa `splitPayments` quando
 * existe (uma linha por forma); senão, uma linha única com o total do pedido.
 * A soma tem que fechar com o total da nota (a Sefaz rejeita se não bater).
 */
export const sefazPaymentEntries = (
  order: Pick<Order, 'paymentMethod' | 'splitPayments' | 'total'>,
): SefazPaymentEntry[] => {
  const split = order.splitPayments?.filter((p) => p && p.amount > 0) ?? [];
  if (split.length > 0) {
    return split.map((p) => ({
      forma: PAYMENT_METHOD_SEFAZ[p.method] ?? '99',
      rotulo: PAYMENT_LABELS[p.method] ?? 'Outros',
      valor: Number(p.amount.toFixed(2)),
    }));
  }
  return [
    {
      forma: PAYMENT_METHOD_SEFAZ[order.paymentMethod] ?? '99',
      rotulo: PAYMENT_LABELS[order.paymentMethod] ?? 'Outros',
      valor: Number(order.total.toFixed(2)),
    },
  ];
};

/**
 * Reescala as linhas de pagamento para a soma bater EXATAMENTE com o valor
 * declarado da nota (soma dos itens - desconto). O `order.total` pode ser
 * maior que isso quando há taxa de serviço/couvert — hoje eles não viram item
 * na NFC-e (não são "produto" nenhum), então se `Pagamentos` somar o total do
 * pedido a Sefaz rejeita: "Rejeição 866: Ausência de troco quando o valor dos
 * pagamentos informados for maior que o total da nota" (mesmo em PIX/cartão,
 * onde não existe troco de verdade). Mantém a proporção entre as formas e
 * joga a sobra de arredondamento na última linha.
 *
 * Isso é uma correção técnica (a nota tem que fechar com o que ela mesma
 * declara), não uma decisão fiscal — se o contador decidir que taxa de
 * serviço/couvert devem entrar na NFC-e como item de serviço, esta função
 * some e o valor pago volta a ser o `order.total` inteiro.
 */
export const scalePaymentsToNoteTotal = (
  entries: SefazPaymentEntry[],
  noteTotal: number,
): SefazPaymentEntry[] => {
  const sum = Number(entries.reduce((s, e) => s + e.valor, 0).toFixed(2));
  const target = Number(noteTotal.toFixed(2));
  if (entries.length === 0 || sum <= 0 || Math.abs(sum - target) < 0.005) return entries;

  const scaled = entries.map((e) => ({ ...e, valor: Math.round((e.valor / sum) * target * 100) / 100 }));
  const diff = Number((target - scaled.reduce((s, e) => s + e.valor, 0)).toFixed(2));
  scaled[scaled.length - 1] = {
    ...scaled[scaled.length - 1],
    valor: Number((scaled[scaled.length - 1].valor + diff).toFixed(2)),
  };
  return scaled;
};

// ---------------------------------------------------------------------------
// Rateio de desconto do pedido pelos itens
// ---------------------------------------------------------------------------
/**
 * O pedido guarda `discount` só no total; a NFC-e precisa do desconto (vDesc)
 * item a item. Rateia proporcionalmente ao valor bruto de cada item e joga a
 * sobra de arredondamento no último item, de forma que a soma feche exatamente
 * com `totalDiscount`.
 */
export const prorateDiscount = (
  items: { unitPrice: number; quantity: number }[],
  totalDiscount: number,
): number[] => {
  const n = items.length;
  if (n === 0 || totalDiscount <= 0) return new Array(n).fill(0);
  const gross = items.map((it) => it.unitPrice * it.quantity);
  const grossTotal = gross.reduce((s, v) => s + v, 0);
  if (grossTotal <= 0) return new Array(n).fill(0);

  const out = gross.map((g) => Math.round(((g / grossTotal) * totalDiscount) * 100) / 100);
  const diff = Number((totalDiscount - out.reduce((s, v) => s + v, 0)).toFixed(2));
  out[n - 1] = Number((out[n - 1] + diff).toFixed(2));
  return out;
};

// ---------------------------------------------------------------------------
// Lista de notas fiscais (tela Módulo Fiscal ▸ Notas Fiscais)
// ---------------------------------------------------------------------------
/** Status de exibição: os da tabela `fiscal_invoices` + "nunca tentou emitir". */
export type FiscalNoteStatus = FiscalInvoice['status'] | 'sem_emissao';

export interface FiscalNoteRow {
  key: string;
  orderId: string;
  order?: Order;
  /** `null` = pedido concluído que ainda não teve nenhuma tentativa de emissão. */
  invoice: FiscalInvoice | null;
  status: FiscalNoteStatus;
}

/**
 * Uma lista só: pedidos sem nenhuma linha em `fiscal_invoices` entram como
 * status "sem_emissao" (em vez de sumirem da tela ou aparecerem só numa caixa
 * separada). Um pedido com tentativa anterior (rejeitada/erro/autorizada) não
 * duplica aqui — ele já aparece pela própria linha de `invoices`.
 */
export const buildFiscalNoteRows = (orders: Order[], invoices: FiscalInvoice[]): FiscalNoteRow[] => {
  const ordersById = new Map(orders.map((o) => [o.id, o]));

  const invoiceRows: FiscalNoteRow[] = invoices.map((inv) => ({
    key: inv.id,
    orderId: inv.orderId,
    order: ordersById.get(inv.orderId),
    invoice: inv,
    status: inv.status,
  }));

  const orderIdsWithInvoice = new Set(invoices.map((i) => i.orderId));
  const pendingRows: FiscalNoteRow[] = orders
    .filter((o) => !orderIdsWithInvoice.has(o.id) && !o.fiscalIssued)
    .map((o) => ({
      key: `pending-${o.id}`,
      orderId: o.id,
      order: o,
      invoice: null,
      status: 'sem_emissao' as const,
    }));

  return [...invoiceRows, ...pendingRows].sort((a, b) => {
    const da = a.invoice?.createdAt || a.order?.createdAtISO || '';
    const db = b.invoice?.createdAt || b.order?.createdAtISO || '';
    return db.localeCompare(da);
  });
};

/** Status que caem na "Fila de Requerimento" — precisam de uma ação do usuário (reenviar). */
export const RETRY_QUEUE_STATUSES: FiscalNoteStatus[] = ['rejeitada', 'erro'];

/**
 * Fila de requerimento (Módulo Fiscal ▸ Fila de Requerimento): só as notas
 * rejeitadas pela Sefaz ou com erro ao emitir, com busca livre por nº do
 * pedido, cliente ou trecho do motivo devolvido.
 */
export const retryQueueRows = (rows: FiscalNoteRow[], query: string): FiscalNoteRow[] => {
  const base = rows.filter((r) => RETRY_QUEUE_STATUSES.includes(r.status));
  const q = query.trim().toLowerCase();
  if (!q) return base;
  return base.filter((r) =>
    String(r.order?.orderNumber ?? '').includes(q) ||
    (r.order?.customer?.name || '').toLowerCase().includes(q) ||
    (r.invoice?.rejeicaoMotivo || '').toLowerCase().includes(q),
  );
};

export interface FiscalNoteFilters {
  status: FiscalNoteStatus | 'todas';
  payment: PaymentMethod | 'todas';
  channel: OrderChannel | 'todos';
  query: string;
}

/** Aplica os mesmos filtros da tela (status, forma de pagamento, canal, busca livre). */
export const filterFiscalNoteRows = (rows: FiscalNoteRow[], filters: FiscalNoteFilters): FiscalNoteRow[] => {
  const q = filters.query.trim().toLowerCase();
  return rows
    .filter((r) => filters.status === 'todas' || r.status === filters.status)
    .filter((r) => filters.payment === 'todas' || r.order?.paymentMethod === filters.payment)
    .filter((r) => filters.channel === 'todos' || r.order?.channel === filters.channel)
    .filter((r) => {
      if (!q) return true;
      return (
        (r.invoice?.chave || '').toLowerCase().includes(q) ||
        (r.order?.customer?.name || '').toLowerCase().includes(q) ||
        String(r.order?.orderNumber ?? '').includes(q)
      );
    });
};
