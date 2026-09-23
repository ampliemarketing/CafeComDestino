// Config/cliente compartilhado pelas 4 Edge Functions `pagbank-*`. Deno
// resolve import relativo entre arquivos que ficam só dentro de
// `supabase/functions/` sem problema nenhum — o obstáculo documentado em
// `emit-nfce/index.ts` é só ao importar arquivo de `src/lib/*.ts` que ele
// mesmo tenha imports "estilo Vite" (sem extensão). Este módulo não tem esse
// problema, então pode ser compartilhado de verdade entre as 4 funções.
//
// Secrets (supabase secrets set ...):
//   PAGBANK_ENV          - sandbox | production (default: sandbox)
//   PAGBANK_TOKEN        - Bearer token do ambiente ativo (também usado pra
//                          validar a assinatura do webhook — ver pagbank-webhook)
//   PAGBANK_WEBHOOK_URL  - URL pública de pagbank-webhook (vai em notification_urls)
// (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY são injetados.)

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { resolvePagBankBaseUrl, type PagBankEnv } from '../../../../src/lib/pagbank.ts';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

export interface PagBankConfig {
  env: PagBankEnv;
  token: string;
  baseUrl: string;
  webhookUrl: string;
}

/**
 * Lê a config da PagBank a partir dos secrets da função. Em produção, falha
 * explicitamente (fail-fast) se faltar token ou webhook — igual ao requisito
 * de "falhar de forma explícita se faltar alguma [variável] em produção". Em
 * sandbox/dev, token ausente não derruba a função — cada handler decide o que
 * fazer (mesmo padrão de `notConfigured` já usado em emit-nfce), pra não
 * quebrar o checkout enquanto as credenciais de sandbox não chegam.
 *
 * Nota sobre "token de sandbox usado em produção e vice-versa" (requisito de
 * segurança #8): não existe um jeito confiável de distinguir os dois só pela
 * string do token sem confirmar contra a doc oficial. A proteção prática aqui
 * é que um token do ambiente errado simplesmente não autentica no host do
 * outro ambiente — o PagBank devolve 401 na primeira chamada, e isso é
 * tratado como erro de configuração (nunca like um "pagamento recusado").
 */
export function loadPagBankConfig(): PagBankConfig {
  const env = (Deno.env.get('PAGBANK_ENV') === 'production' ? 'production' : 'sandbox') as PagBankEnv;
  const token = Deno.env.get('PAGBANK_TOKEN') ?? '';
  const webhookUrl = Deno.env.get('PAGBANK_WEBHOOK_URL') ?? '';
  const baseUrl = resolvePagBankBaseUrl(env);

  if (env === 'production' && (!token || !webhookUrl)) {
    throw new Error('Configuração PagBank incompleta para produção (PAGBANK_TOKEN / PAGBANK_WEBHOOK_URL).');
  }

  return { env, token, baseUrl, webhookUrl };
}

/** fetch autenticado contra a API do PagBank, com timeout. */
export async function pagbankFetch(config: PagBankConfig, path: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(`${config.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.token}`,
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

export const createAdminClient = () => createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

export const createCallerClient = (authHeader: string) =>
  createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });

/** IP real do cliente — a plataforma do Supabase injeta `x-forwarded-for`. */
export function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  return fwd.split(',')[0]?.trim() || 'unknown';
}

/**
 * Rate limit básico por IP (achado de auditoria, Alto #1 — "card testing":
 * testar cartões roubados em massa usando o merchant como oráculo de
 * aprovado/recusado). Não é uma solução de WAF, é proteção mínima — ver
 * `check_pagbank_rate_limit` (migration 0054) pro upsert atômico que evita
 * race entre requisições concorrentes do mesmo IP.
 */
export async function checkRateLimit(
  admin: ReturnType<typeof createAdminClient>,
  bucket: string,
  key: string,
  maxHits: number,
  windowSeconds: number,
): Promise<boolean> {
  const { data, error } = await admin.rpc('check_pagbank_rate_limit', {
    p_bucket: bucket,
    p_key: key,
    p_max_hits: maxHits,
    p_window_seconds: windowSeconds,
  });
  if (error) return true; // falha ao checar rate limit não deve derrubar o checkout — fail-open aqui
  return data === true;
}
