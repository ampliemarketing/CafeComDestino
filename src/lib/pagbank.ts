// Helpers puros da integração PagBank — resolução de URL base por ambiente,
// sanitização de log e interpretação da resposta de /orders. Módulo sem
// imports "estilo Vite" de propósito (nem de `../types`): é importado tanto
// pelo frontend/Vitest (Node) quanto pelas Edge Functions `pagbank-*` (Deno)
// — o Deno só resolve um import relativo direto quando o arquivo importado
// (e tudo que ele importa, recursivamente) não depende de resolução
// "estilo Vite" (sem extensão). Mesmo mecanismo já usado por
// `fiscalNfceResponse.ts` com `emit-nfce`. A única exceção é o import de
// `./validation.ts` logo abaixo — ele também não tem nenhum import próprio,
// então a cadeia continua Deno-safe.

import { isValidCpfCnpj, isValidEmail, isValidPhone } from './validation.ts';

// Formato de `POST/GET /orders` confirmado num teste real em sandbox
// (2026-09-22) — ver comentário de parsePagBankOrderResponse.
//
// TODO(fase-0): a tabela de códigos de recusa (`payment_response.code`) só
// tem os poucos valores mais comuns mapeados (ver KNOWN_DECLINE_MESSAGES) —
// completar conforme forem aparecendo em cartões de teste recusados.

// ---------------------------------------------------------------------------
// Autenticidade de webhook — mecanismo OFICIAL do PagBank (confirmado na doc
// "Confirmar autenticidade da notificação",
// https://developer.pagbank.com.br/reference/confirmar-autenticidade-da-notificacao):
// o PagBank manda o header `x-authenticity-token` = SHA-256 hex de
// "{PAGBANK_TOKEN}-{corpo bruto da requisição}". Não é uma chamada de API,
// não é um segredo separado — usa o mesmo Bearer token já usado pra
// autenticar as chamadas à API. `crypto.subtle` é Web Crypto padrão,
// disponível tanto em Deno (Edge Function) quanto em Node 20+/Vitest.
// ---------------------------------------------------------------------------
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifica o header `x-authenticity-token` de um webhook do PagBank.
 * `rawBody` precisa ser o corpo EXATO recebido (string bruta, antes de
 * qualquer JSON.parse/stringify) — reformatar o JSON muda o hash.
 */
export async function verifyPagBankWebhookSignature(
  token: string,
  rawBody: string,
  headerValue: string | null,
): Promise<boolean> {
  if (!token || !headerValue) return false;
  const expected = await sha256Hex(`${token}-${rawBody}`);
  return expected === headerValue;
}

export const PAGBANK_SANDBOX_BASE_URL = 'https://sandbox.api.pagseguro.com';
export const PAGBANK_PRODUCTION_BASE_URL = 'https://api.pagseguro.com';

export type PagBankEnv = 'sandbox' | 'production';

/** PAGBANK_ENV != 'production' cai em sandbox por padrão — nunca o contrário. */
export function resolvePagBankBaseUrl(env: string | undefined | null): string {
  return env === 'production' ? PAGBANK_PRODUCTION_BASE_URL : PAGBANK_SANDBOX_BASE_URL;
}

// Chaves que nunca podem aparecer em log/console, em qualquer nível de
// aninhamento e independente de casing (a API do PagBank mistura snake_case
// com variações de SDK).
const SENSITIVE_KEYS = new Set([
  'card', 'encrypted', 'security_code', 'securitycode', 'cvv', 'cvc',
  'number', 'exp_month', 'exp_year', 'holder',
]);

/** Clona `value` mascarando recursivamente qualquer campo sensível de cartão. */
export function sanitizeForLog(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeForLog);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : sanitizeForLog(v);
    }
    return out;
  }
  return value;
}

export type PagBankChargeStatus = 'PAID' | 'DECLINED' | 'CANCELED' | 'WAITING' | 'IN_ANALYSIS' | 'UNKNOWN';

export interface ParsedPagBankOrder {
  orderId: string | null;
  chargeId: string | null;
  status: PagBankChargeStatus;
  declineCode: string | null;
  declineMessage: string | null;
  qrCodeText: string | null;
  qrCodeImageUrl: string | null;
}

function normalizeChargeStatus(raw: unknown): PagBankChargeStatus {
  const s = String(raw ?? '').toUpperCase();
  if (s === 'PAID' || s === 'AUTHORIZED') return 'PAID'; // capture=true sempre — AUTHORIZED já é definitivo
  if (s === 'DECLINED') return 'DECLINED';
  if (s === 'CANCELED' || s === 'CANCELLED') return 'CANCELED';
  if (s === 'IN_ANALYSIS') return 'IN_ANALYSIS';
  if (s === 'WAITING') return 'WAITING';
  return 'UNKNOWN';
}

/**
 * Interpreta a resposta de `POST/GET /orders/{id}` do PagBank.
 *
 * Formato confirmado num teste real em sandbox (2026-09-22): o QR Code do Pix
 * NÃO vem num array `qr_codes` no nível raiz do pedido — vem dentro da
 * própria cobrança, `charges[0].qr_code` (objeto único, com `text`), e o link
 * da imagem/base64 vem em `charges[0].links[]` (`rel: "QRCODE.PNG"` /
 * `"QRCODE.BASE64"`), não em `qr_codes[0].links[]`.
 */
export function parsePagBankOrderResponse(body: unknown): ParsedPagBankOrder {
  const rec = (body ?? {}) as Record<string, unknown>;
  const charges = Array.isArray(rec.charges) ? (rec.charges as Record<string, unknown>[]) : [];
  const charge = charges[0] ?? {};
  const paymentResponse = (charge.payment_response ?? {}) as Record<string, unknown>;
  const qr = (charge.qr_code ?? {}) as Record<string, unknown>;
  const links = Array.isArray(charge.links) ? (charge.links as Record<string, unknown>[]) : [];
  const qrImage = links.find((l) => String(l.rel ?? '').toUpperCase().includes('QRCODE.PNG'))
    ?? links.find((l) => String(l.rel ?? '').toUpperCase().includes('QRCODE'));

  return {
    orderId: typeof rec.id === 'string' ? rec.id : null,
    chargeId: typeof charge.id === 'string' ? charge.id : null,
    status: normalizeChargeStatus(charge.status),
    declineCode: paymentResponse.code != null ? String(paymentResponse.code) : null,
    declineMessage: paymentResponse.message != null ? String(paymentResponse.message) : null,
    qrCodeText: typeof qr.text === 'string' ? qr.text : null,
    qrCodeImageUrl: typeof qrImage?.href === 'string' ? (qrImage.href as string) : null,
  };
}

// Mensagens amigáveis pro operador/cliente. Só os poucos códigos mais comuns
// e bem documentados entram com mensagem específica — o resto cai num texto
// genérico (o código/mensagem crus do PagBank ficam gravados em
// payment_events/provider_response pra investigação, nunca escondidos de
// quem audita, só não vazam pro cliente final).
const KNOWN_DECLINE_MESSAGES: Record<string, string> = {
  '20000': 'Transação recusada pela operadora do cartão.',
  '20001': 'Saldo/limite insuficiente.',
  '20002': 'Cartão expirado.',
  '20003': 'Dados do cartão inválidos.',
  '20007': 'Cartão recusado — suspeita de fraude.',
};

export function translateDeclineMessage(code: string | null, rawMessage: string | null): string {
  if (code && KNOWN_DECLINE_MESSAGES[code]) return KNOWN_DECLINE_MESSAGES[code];
  return 'Pagamento recusado pela operadora. Tente outro cartão ou escolha Pix.';
}

// ---------------------------------------------------------------------------
// Validação server-side do cliente informado no checkout PagBank — achado de
// segurança (Alto #4): `create_order_and_credit_cash` só valida nome/telefone
// quando `auth.role() = 'anon'`, mas o fluxo PagBank chama essa RPC via
// service_role (v_is_anon = false), então esse bloco é pulado. As Edge
// Functions pagbank-create-pix/pagbank-create-card chamam esta função ANTES
// de criar qualquer cobrança — a validação de CPF/CNPJ/e-mail do frontend
// (`PagBankCheckout.tsx`) é só UX, nunca a fonte de verdade.
// ---------------------------------------------------------------------------

export interface PagBankCustomerInput {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  taxId?: unknown;
}

/** Devolve uma mensagem de erro em PT-BR se algum campo for inválido, ou `null` se tudo ok. */
export function validatePagBankCustomer(customer: PagBankCustomerInput | null | undefined): string | null {
  const name = String(customer?.name ?? '').trim();
  const phone = String(customer?.phone ?? '');
  const email = String(customer?.email ?? '');
  const taxId = String(customer?.taxId ?? '');

  if (name.length < 2 || name.length > 120) return 'Nome do cliente inválido.';
  if (!isValidPhone(phone)) return 'Telefone do cliente inválido.';
  if (!email || !isValidEmail(email)) return 'E-mail do cliente inválido.';
  if (!taxId || !isValidCpfCnpj(taxId)) return 'CPF/CNPJ do cliente inválido.';

  return null;
}
