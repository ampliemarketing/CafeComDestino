// Edge Function `emit-nfce` — emite a NFC-e (modelo 65) de um pedido pela
// emissora externa Brasil NFe (https://www.brasilnfe.com.br). Fase 1: disparo
// MANUAL, ambiente de homologação.
//
// Chamada pelo frontend: supabase.functions.invoke('emit-nfce', { body: { orderId } })
// O JWT do funcionário logado vai no header Authorization e é validado aqui —
// só quem tem a permissão `vendas.emitir_nfce` (ou é admin) pode emitir.
//
// Secrets necessários (supabase secrets set ...):
//   BRASILNFE_TOKEN              - token de emissão (header `Token`)
//   BRASILNFE_USER_TOKEN         - token do módulo Empresa (header `UserToken`) [opcional aqui]
//   BRASILNFE_BASE_URL           - default https://api.brasilnfe.com.br/services/
// (SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY são injetados.)
//
// IMPORTANTE — CSC não é enviado por nota: confirmado por teste ponta-a-ponta
// (2026-09-20) que `EnviarNotaFiscal` não tem campos `Csc`/`IdTokenCsc` — a
// Brasil NFe assina o QR Code com o CSC cadastrado UMA VEZ no cadastro da
// empresa (`POST /empresa/EditarEmpresa`, objeto `Configuracao.NFCe`:
// `IdCSCProducao`, `CSCProducao`, `IdCSCHomologacao`, `CSCHomologacao`, com o
// ID sempre com 6 dígitos, ex. "000001"). Enviar esses campos aqui não tem
// efeito nenhum — por isso foram removidos do payload abaixo. Configure o CSC
// pelo painel da Brasil NFe (Empresas ▸ Editar ▸ NFC-e) ou via aquele endpoint.
//
// Enquanto BRASILNFE_TOKEN não estiver configurado, grava uma linha
// `fiscal_invoices.status = 'erro'` com o motivo e devolve { ok:false,
// notConfigured:true } — NÃO lança exceção, não quebra nada.
//
// TODO(fase-0): os nomes exatos dos campos do payload EnviarNotaFiscal precisam
// ser confirmados com um teste ponta-a-ponta em homologação (script
// scripts/brasilnfe-smoke.mjs). A estrutura/mapeamento abaixo segue a doc REST
// pública + o SDK PHP; ajuste as chaves se o smoke test acusar rejeição de schema.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { parseEnviarNotaFiscalResponse } from '../../../src/lib/fiscalNfceResponse.ts';

// NOTA: o Deno não resolve os imports de `src/lib/fiscal.ts` (ele importa de
// '../types' sem extensão, que só o Vite entende). Por isso os helpers fiscais
// abaixo são uma cópia enxuta do que existe em src/lib/fiscal.ts — mantenha os
// dois lados em sincronia (mesmo trade-off do src/lib/permissions.ts).
// `fiscalNfceResponse.ts` é a exceção: não tem imports próprios, então o Deno
// resolve o caminho relativo direto — por isso aquele módulo é compartilhado
// de verdade (mesmo arquivo, testado por `fiscalNfceResponse.test.ts`).

const FISCAL_DEFAULTS = {
  origem: '0', ncm: '', cest: '', cfop: '5102', gtin: '', unidadeTributavel: '',
  cstCsosn: '102', temSt: false,
  cstPis: '49', aliqPis: 0, cstCofins: '49', aliqCofins: 0,
  cBenef: '', infAdicional: '',
};
type FiscalShape = typeof FISCAL_DEFAULTS & Record<string, unknown>;

const normalizeFiscal = (f?: Record<string, unknown> | null): FiscalShape =>
  ({ ...FISCAL_DEFAULTS, ...(f ?? {}) }) as FiscalShape;

/** Grupo tributário vinculado manda; senão usa o `fiscal` espelhado do produto. */
function resolveProductFiscal(
  product: { fiscal?: Record<string, unknown> | null; taxGroupId?: string | null },
  taxGroups: { id: string; fiscal?: Record<string, unknown> | null }[],
): FiscalShape {
  if (product.taxGroupId) {
    const g = taxGroups.find((x) => x.id === product.taxGroupId);
    if (g) return normalizeFiscal(g.fiscal);
  }
  return normalizeFiscal(product.fiscal);
}

const PAYMENT_METHOD_SEFAZ: Record<string, string> = {
  dinheiro: '01', cartao_credito: '03', cartao_debito: '04',
  pix: '17', boleto: '15', vale_refeicao: '11', multiplo: '99',
};
const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro', cartao_credito: 'Cartão de crédito', cartao_debito: 'Cartão de débito',
  pix: 'PIX', boleto: 'Boleto', vale_refeicao: 'Vale-refeição', multiplo: 'Múltiplo',
};

interface SefazPaymentEntry { forma: string; rotulo: string; valor: number }

function sefazPaymentEntries(order: {
  paymentMethod: string;
  splitPayments?: { method: string; amount: number }[] | null;
  total: number;
}): SefazPaymentEntry[] {
  const split = (order.splitPayments ?? []).filter((p) => p && p.amount > 0);
  if (split.length > 0) {
    return split.map((p) => ({
      forma: PAYMENT_METHOD_SEFAZ[p.method] ?? '99',
      rotulo: PAYMENT_LABELS[p.method] ?? 'Outros',
      valor: Number(p.amount.toFixed(2)),
    }));
  }
  return [{
    forma: PAYMENT_METHOD_SEFAZ[order.paymentMethod] ?? '99',
    rotulo: PAYMENT_LABELS[order.paymentMethod] ?? 'Outros',
    valor: Number(order.total.toFixed(2)),
  }];
}

/** Rateia o desconto do pedido pelos itens (sobra de arredondamento no último). */
function prorateDiscount(items: { unitPrice: number; quantity: number }[], totalDiscount: number): number[] {
  const n = items.length;
  if (n === 0 || totalDiscount <= 0) return new Array(n).fill(0);
  const gross = items.map((it) => it.unitPrice * it.quantity);
  const grossTotal = gross.reduce((s, v) => s + v, 0);
  if (grossTotal <= 0) return new Array(n).fill(0);
  const out = gross.map((g) => Math.round(((g / grossTotal) * totalDiscount) * 100) / 100);
  const diff = Number((totalDiscount - out.reduce((s, v) => s + v, 0)).toFixed(2));
  out[n - 1] = Number((out[n - 1] + diff).toFixed(2));
  return out;
}

/**
 * Reescala as linhas de pagamento pro valor declarado da nota (soma dos itens
 * - desconto). `order.total` pode ser maior quando há taxa de serviço/couvert
 * (não viram item da NFC-e) — se `Pagamentos` somar o total do pedido, a Sefaz
 * rejeita: "Rejeição 866: Ausência de troco quando o valor dos pagamentos
 * informados for maior que o total da nota" (mesmo sem ser dinheiro). Ver
 * regressão real em src/lib/fiscal.test.ts::scalePaymentsToNoteTotal.
 */
function scalePaymentsToNoteTotal(entries: SefazPaymentEntry[], noteTotal: number): SefazPaymentEntry[] {
  const sum = Number(entries.reduce((s, e) => s + e.valor, 0).toFixed(2));
  const target = Number(noteTotal.toFixed(2));
  if (entries.length === 0 || sum <= 0 || Math.abs(sum - target) < 0.005) return entries;
  const scaled = entries.map((e) => ({ ...e, valor: Math.round((e.valor / sum) * target * 100) / 100 }));
  const diff = Number((target - scaled.reduce((s, e) => s + e.valor, 0)).toFixed(2));
  scaled[scaled.length - 1] = { ...scaled[scaled.length - 1], valor: Number((scaled[scaled.length - 1].valor + diff).toFixed(2)) };
  return scaled;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const BRASILNFE_TOKEN = Deno.env.get('BRASILNFE_TOKEN') ?? '';
const BRASILNFE_USER_TOKEN = Deno.env.get('BRASILNFE_USER_TOKEN') ?? '';
const BRASILNFE_BASE_URL = (Deno.env.get('BRASILNFE_BASE_URL') ?? 'https://api.brasilnfe.com.br/services/')
  .replace(/\/*$/, '/');
// CSC não é secret desta função — ver nota acima (cadastrado uma vez na Brasil NFe).

const onlyDigits = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const money = (v: number) => Number((Number.isFinite(v) ? v : 0).toFixed(2));

function crtCode(raw: unknown): number {
  const m = String(raw ?? '').match(/\d/);
  const n = m ? Number(m[0]) : 1;
  return n === 2 || n === 3 ? n : 1; // 1 Simples · 2 Simples (excesso) · 3 Regime normal
}

// ---------------------------------------------------------------------------
// Monta o corpo do EnviarNotaFiscal (NFC-e / modelo 65).
// ---------------------------------------------------------------------------
function buildNfcePayload(args: {
  order: Record<string, any>;
  company: Record<string, any>;
  products: Record<string, any>[];
  taxGroups: Record<string, any>[];
  ambiente: number;
}) {
  const { order, company, products, taxGroups, ambiente } = args;
  const fi = company.fiscal_info ?? {};
  const addr = company.address ?? {};
  const items: any[] = Array.isArray(order.items) ? order.items : [];

  const perItemDiscount = prorateDiscount(
    items.map((it) => ({ unitPrice: Number(it.unitPrice) || 0, quantity: Number(it.quantity) || 0 })),
    Number(order.discount) || 0,
  );

  const produtos = items.map((it, idx) => {
    const prod = products.find((p) => p.id === it.productId);
    const fiscal = resolveProductFiscal(
      { fiscal: prod?.fiscal ?? {}, taxGroupId: prod?.tax_group_id ?? undefined },
      taxGroups as any,
    );
    const qty = Number(it.quantity) || 0;
    const unit = Number(it.unitPrice) || 0;
    const gtin = onlyDigits(fiscal.gtin);

    return {
      CodProdutoServico: prod?.code || it.productId,
      NmProduto: String(it.productName || prod?.name || 'ITEM').slice(0, 120),
      EAN: gtin.length >= 8 ? gtin : 'SEM GTIN',
      NCM: onlyDigits(fiscal.ncm),
      CEST: fiscal.temSt ? onlyDigits(fiscal.cest) : undefined,
      CFOP: onlyDigits(fiscal.cfop) || '5102',
      UnidadeComercial: (it.unit || prod?.unit || 'UN').toString().toUpperCase().slice(0, 6),
      UnidadeComercialTributavel: (fiscal.unidadeTributavel || it.unit || prod?.unit || 'UN').toString().toUpperCase().slice(0, 6),
      Quantidade: qty,
      QuantidadeTributavel: qty,
      ValorUnitario: money(unit),
      ValorUnitarioTributavel: money(unit),
      ValorTotal: money(unit * qty),
      ValorDesconto: money(perItemDiscount[idx] || 0),
      OrigemProduto: Number(fiscal.origem) || 0,
      InformacoesAdicionais: fiscal.infAdicional || undefined,
      Imposto: {
        ICMS: {
          CodSituacaoTributaria: fiscal.cstCsosn,        // CSOSN (Simples) ou CST (regime normal)
          // Empresa é Simples Nacional: ICMS vem embutido no DAS, não
          // discriminado por alíquota na nota — por isso sempre 0 aqui. Se um
          // dia a empresa mudar de regime (CST de regime normal, fora do
          // CSOSN), esse valor passa a precisar vir de um campo editável de
          // novo — ver decisão em FiscalFieldsForm.tsx.
          AliquotaICMS: 0,
          AliquotaFCP: 0,
        },
        PIS: {
          CodSituacaoTributaria: fiscal.cstPis,
          Aliquota: money(fiscal.aliqPis || 0),
        },
        COFINS: {
          CodSituacaoTributaria: fiscal.cstCofins,
          Aliquota: money(fiscal.aliqCofins || 0),
        },
        // Sem grupo de IPI: só se aplica a indústria/importador, não a
        // revenda de bar/café (ver FiscalFieldsForm.tsx).
      },
    };
  });

  // vNF real da nota (só os itens) — pode ser menor que order.total quando o
  // pedido tem taxa de serviço/couvert, que não entram como Produto aqui.
  const noteTotal = produtos.reduce((s, p) => s + p.ValorTotal - (p.ValorDesconto || 0), 0);
  const pagamentos = scalePaymentsToNoteTotal(sefazPaymentEntries(order), noteTotal).map((p) => ({
    IndicadorPagamento: 0,             // 0 = pagamento à vista
    FormaPagamento: p.forma,           // tPag (01 dinheiro, 03 crédito, 04 débito, 17 PIX...)
    VlPago: money(p.valor),
  }));

  const custTaxId = onlyDigits(order.customer?.taxId);
  const cliente = custTaxId.length === 11 || custTaxId.length === 14
    ? {
        CpfCnpj: custTaxId,
        NmCliente: order.customer?.name || 'CONSUMIDOR',
        IndicadorIE: 9,                // 9 = não contribuinte
      }
    : undefined;                       // NFC-e sem identificação do consumidor

  return {
    TipoAmbiente: ambiente,            // 1 produção · 2 homologação
    IdentificadorInterno: String(order.id),
    ModeloDocumento: 65,              // NFC-e
    Serie: Number(fi.nfceSeries) || 1,
    Finalidade: 1,                    // 1 = normal (2 complementar, 3 ajuste, 4 devolução)
    NaturezaOperacao: 'Venda ao consumidor',
    ConsumidorFinal: true,
    IndicadorPresenca: 1,            // 1 = operação presencial
    EnviarEmail: false,
    Emitente: {
      CpfCnpj: onlyDigits(company.cnpj),
      InscricaoEstadual: onlyDigits(company.ie),
      RazaoSocial: company.name,
      NomeFantasia: company.trade_name || company.name,
      CRT: crtCode(fi.crt),
      Endereco: {
        Logradouro: addr.street,
        Numero: addr.number,
        Complemento: addr.complement || undefined,
        Bairro: addr.neighborhood,
        CodMunicipio: onlyDigits(addr.codMunicipioIbge),
        Municipio: addr.city,
        UF: addr.state,
        Cep: onlyDigits(addr.zipCode),
      },
    },
    Cliente: cliente,
    Produtos: produtos,
    Pagamentos: pagamentos,
    InformacoesAdicionais: `Pedido #${order.order_number ?? ''}`.trim(),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Não autenticado.' }, 401);

  // ---- 1. valida o funcionário pelo JWT ----
  const caller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userErr } = await caller.auth.getUser();
  if (userErr || !user) return json({ error: 'Não autenticado.' }, 401);

  const { data: profile } = await caller.from('profiles').select('role, permissions').eq('id', user.id).single();
  const perms: string[] = Array.isArray(profile?.permissions) ? profile!.permissions : [];
  const allowed = profile?.role === 'admin' || perms.includes('vendas.emitir_nfce') || perms.includes('fiscal.acessar');
  if (!allowed) return json({ error: 'Sem permissão para emitir NFC-e.' }, 403);

  const body = await req.json().catch(() => null);
  const orderId = typeof body?.orderId === 'string' ? body.orderId : '';
  if (!orderId) return json({ error: 'orderId é obrigatório.' }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ---- 2. idempotência ----
  const { data: existing } = await admin
    .from('fiscal_invoices')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();

  if (existing?.status === 'autorizada') {
    return json({ ok: true, alreadyIssued: true, status: 'autorizada', chave: existing.chave });
  }
  if (existing?.status === 'processando') {
    return json({ ok: false, processing: true, status: 'processando' }, 409);
  }

  // ---- 3. carrega pedido + emitente + produtos ----
  const { data: order, error: orderErr } = await admin.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (orderErr || !order) return json({ error: 'Pedido não encontrado.' }, 404);

  const { data: company } = await admin.from('company_profile').select('*').eq('id', true).maybeSingle();
  if (!company) return json({ error: 'Perfil da empresa não configurado.' }, 400);

  const productIds = Array.isArray(order.items) ? [...new Set(order.items.map((i: any) => i.productId))] : [];
  const { data: products } = await admin.from('products').select('id, code, name, unit, fiscal, tax_group_id').in('id', productIds);
  const { data: taxGroups } = await admin.from('tax_groups').select('id, name, active, fiscal');

  const ambiente = (company.fiscal_info?.environment === 'production') ? 1 : 2;

  const invoiceId = existing?.id ?? `fisc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const upsertInvoice = (patch: Record<string, unknown>) =>
    admin.from('fiscal_invoices').upsert(
      { id: invoiceId, order_id: orderId, modelo: 65, ambiente, emitted_by: user.id, ...patch },
      { onConflict: 'order_id' },
    );

  // ---- 4. integração ainda não configurada → registra e sai sem quebrar ----
  if (!BRASILNFE_TOKEN) {
    await upsertInvoice({
      status: 'erro',
      rejeicao_motivo: 'Integração Brasil NFe não configurada (secret BRASILNFE_TOKEN ausente).',
    });
    return json({ ok: false, notConfigured: true, message: 'Integração fiscal não configurada no servidor.' });
  }

  // ---- 5. monta e envia ----
  let payload: unknown;
  try {
    payload = buildNfcePayload({
      order,
      company,
      products: products ?? [],
      taxGroups: taxGroups ?? [],
      ambiente,
    });
  } catch (e) {
    await upsertInvoice({ status: 'erro', rejeicao_motivo: `Falha ao montar a nota: ${String(e)}` });
    return json({ ok: false, error: `Falha ao montar a nota: ${String(e)}` }, 500);
  }

  await upsertInvoice({ status: 'processando', provider_response: null, rejeicao_motivo: null, rejeicao_codigo: null });

  let httpStatus = 0;
  let providerBody: any = null;
  try {
    const resp = await fetch(`${BRASILNFE_BASE_URL}Fiscal/EnviarNotaFiscal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Token': BRASILNFE_TOKEN,
        ...(BRASILNFE_USER_TOKEN ? { 'UserToken': BRASILNFE_USER_TOKEN } : {}),
      },
      body: JSON.stringify(payload),
    });
    httpStatus = resp.status;
    providerBody = await resp.json().catch(() => null);
  } catch (e) {
    await upsertInvoice({ status: 'erro', rejeicao_motivo: `Erro de comunicação com a Brasil NFe: ${String(e)}` });
    return json({ ok: false, error: `Erro de comunicação com a Brasil NFe: ${String(e)}` }, 502);
  }

  // ---- 6. interpreta a resposta (aceita PascalCase e camelCase) ----
  const { authorized, cStat, xMotivo, chave, protocolo, numero, xml, danfe } =
    parseEnviarNotaFiscalResponse(providerBody);

  await upsertInvoice({
    status: authorized ? 'autorizada' : 'rejeitada',
    chave,
    protocolo,
    numero,
    xml: xml ?? null,
    danfe_base64: danfe ?? null,
    rejeicao_codigo: authorized ? null : (cStat || String(httpStatus)),
    rejeicao_motivo: authorized ? null : (xMotivo || `HTTP ${httpStatus}`),
    provider_response: providerBody,
  });

  if (authorized && chave) {
    await admin.from('orders').update({ fiscal_issued: true, nfce_key: chave }).eq('id', orderId);
  }

  return json({
    ok: authorized,
    status: authorized ? 'autorizada' : 'rejeitada',
    chave,
    protocolo,
    motivo: authorized ? null : (xMotivo || `HTTP ${httpStatus}`),
    httpStatus,
  });
});
