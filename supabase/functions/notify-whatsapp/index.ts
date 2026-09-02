// Edge Function que envia a notificação de status de pedido no WhatsApp do
// cliente, via Z-API (API não-oficial). É chamada pelo trigger
// `trg_notify_order_status_whatsapp` (migration 0046) através do pg_net —
// NUNCA pelo frontend, para o token da Z-API não vazar no bundle público.
//
// Autenticação: header `x-webhook-secret` tem que bater com o secret
// NOTIFY_WHATSAPP_SECRET (o mesmo valor gravado em
// app.settings.notify_whatsapp_secret no banco). Deploy com --no-verify-jwt,
// já que o pg_net não manda JWT do Supabase.
//
// Secrets necessários (supabase secrets set ...):
//   ZAPI_INSTANCE          - ID da instância Z-API
//   ZAPI_TOKEN             - token da instância Z-API
//   ZAPI_CLIENT_TOKEN      - "Account Security Token" da conta Z-API (header Client-Token)
//   ZAPI_BASE_URL          - opcional, default https://api.z-api.io
//   NOTIFY_WHATSAPP_SECRET - string aleatória compartilhada com o banco
// (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetados automaticamente.)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const ZAPI_BASE_URL = (Deno.env.get('ZAPI_BASE_URL') ?? 'https://api.z-api.io').replace(/\/+$/, '');
const ZAPI_INSTANCE = Deno.env.get('ZAPI_INSTANCE') ?? '';
const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN') ?? '';
const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN') ?? '';
const WEBHOOK_SECRET = Deno.env.get('NOTIFY_WHATSAPP_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

interface Payload {
  notification_id?: number;
  order_id: string;
  order_number: number | null;
  status: string;
  phone: string;
  customer_name?: string | null;
  service_type?: string | null;
  driver_name?: string | null;
}

const firstName = (name?: string | null) => (name ?? '').trim().split(/\s+/)[0] || 'tudo bem';

// 55 + DDD + número, só dígitos. Aceita o número já vindo pronto do trigger.
function normalizePhone(raw: string): string | null {
  const d = (raw ?? '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) return '55' + d;
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d;
  return null;
}

function buildMessage(p: Payload, restaurant: string): string {
  const n = p.order_number ?? '';
  const isDelivery = p.service_type === 'entrega';
  switch (p.status) {
    case 'novo':
      return `Olá, ${firstName(p.customer_name)}! 👋\n\nRecebemos seu pedido *#${n}* na *${restaurant}* e ele já está na fila. Vamos te avisar por aqui a cada etapa. ☕`;
    case 'aceito':
      return `Pedido *#${n}* confirmado! ✅\n\nJá foi pra cozinha — em instantes começamos o preparo.`;
    case 'em_preparo':
      return `Seu pedido *#${n}* está *em preparo* agora. 👨‍🍳🔥\n\nJá já fica pronto!`;
    case 'pronto':
      return isDelivery
        ? `Pedido *#${n}* *pronto*! 📦\n\nJá vamos despachar pra entrega.`
        : `Pedido *#${n}* *pronto* para retirada no balcão! 🎉`;
    case 'saiu_entrega':
      return `Seu pedido *#${n}* *saiu para entrega*! 🛵💨${p.driver_name ? `\n\nEntregador: *${p.driver_name}*` : ''}\n\nJá está a caminho.`;
    case 'cancelado':
      return `Seu pedido *#${n}* foi *cancelado*.\n\nSe tiver qualquer dúvida, é só responder esta mensagem. 🙏`;
    default:
      return `Atualização do seu pedido *#${n}*: ${p.status}`;
  }
}

async function finish(
  notificationId: number | undefined,
  patch: Record<string, unknown>,
) {
  if (!notificationId) return;
  await admin.from('whatsapp_notifications')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', notificationId);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  if (!WEBHOOK_SECRET || req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return json({ error: 'Não autorizado.' }, 401);
  }

  const p = (await req.json().catch(() => null)) as Payload | null;
  if (!p || !p.order_id || !p.status || !p.phone) {
    return json({ error: 'Payload inválido.' }, 400);
  }

  // Idempotência: se essa notificação já foi enviada, não repete.
  if (p.notification_id) {
    const { data: existing } = await admin
      .from('whatsapp_notifications')
      .select('notification_status')
      .eq('id', p.notification_id)
      .maybeSingle();
    if (existing?.notification_status === 'sent') {
      return json({ ok: true, skipped: 'already_sent' });
    }
  }

  if (!ZAPI_INSTANCE || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
    await finish(p.notification_id, { notification_status: 'failed', error: 'Z-API não configurada (secrets ausentes).' });
    return json({ error: 'Z-API não configurada.' }, 500);
  }

  const phone = normalizePhone(p.phone);
  if (!phone) {
    await finish(p.notification_id, { notification_status: 'skipped', error: 'telefone inválido' });
    return json({ ok: true, skipped: 'invalid_phone' });
  }

  // Nome fantasia para a mensagem.
  const { data: company } = await admin
    .from('company_profile')
    .select('trade_name, name')
    .eq('id', true)
    .maybeSingle();
  const restaurant = company?.trade_name || company?.name || 'nosso restaurante';

  const message = buildMessage(p, restaurant);

  let httpStatus = 0;
  let providerBody: unknown = null;
  try {
    const resp = await fetch(
      `${ZAPI_BASE_URL}/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': ZAPI_CLIENT_TOKEN },
        body: JSON.stringify({ phone, message }),
      },
    );
    httpStatus = resp.status;
    providerBody = await resp.json().catch(() => null);

    if (!resp.ok) {
      await finish(p.notification_id, {
        notification_status: 'failed',
        message,
        http_status: httpStatus,
        provider_response: providerBody,
        error: `Z-API HTTP ${httpStatus}`,
      });
      return json({ error: 'Falha ao enviar pela Z-API.', status: httpStatus, body: providerBody }, 502);
    }

    const messageId =
      (providerBody as { messageId?: string; id?: string })?.messageId ??
      (providerBody as { id?: string })?.id ??
      null;

    await finish(p.notification_id, {
      notification_status: 'sent',
      message,
      phone,
      http_status: httpStatus,
      provider_response: providerBody,
      provider_message_id: messageId,
      error: null,
    });
    return json({ ok: true, messageId });
  } catch (e) {
    await finish(p.notification_id, {
      notification_status: 'failed',
      message,
      http_status: httpStatus || null,
      error: String(e),
    });
    return json({ error: 'Erro inesperado ao enviar.', detail: String(e) }, 500);
  }
});
