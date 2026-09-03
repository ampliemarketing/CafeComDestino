-- ============================================================================
-- Notificação de status de pedido no WhatsApp do cliente (Z-API).
--
-- OBJETIVO: toda vez que um pedido de delivery/retirada feito em /pedir muda
-- de status (na cozinha ou na Gestão de Entregas), o cliente recebe um
-- WhatsApp com a etapa atual — recebido, confirmado, em preparo, pronto,
-- saiu para entrega, cancelado.
--
-- ARQUITETURA (decidida com o time):
--   UPDATE orders.order_status  (feito por updateOrderStatus no app)
--        │
--        ▼  TRIGGER after insert/update  →  registra em whatsapp_notifications
--        │                                  e chama a Edge Function via pg_net
--        ▼
--   Edge Function `notify-whatsapp`  →  monta a mensagem PT-BR e chama a Z-API
--        │
--        ▼  grava o resultado de volta em whatsapp_notifications
--
-- Por que NÃO disparar do frontend: o bundle é público (anon key), então o
-- token da Z-API vazaria; e só enviaria se a aba da cozinha estivesse aberta.
-- O gatilho no banco funciona em qualquer caminho que escreva em `orders`.
--
-- Seguro de aplicar com caixa aberto / pedidos em andamento: só adiciona uma
-- tabela de log, uma função e um trigger AFTER. Não toca em nenhuma função
-- financeira nem no fluxo de criação de pedido. Se a configuração (URL/secret)
-- ainda não existir, o trigger apenas registra 'queued' e não quebra nada.
--
-- ----------------------------------------------------------------------------
-- CONFIGURAÇÃO (rodar UMA vez no SQL Editor do projeto, fora da migration):
--
--   insert into integration_settings (key, value) values
--     ('notify_whatsapp_url',
--      'https://<PROJECT_REF>.supabase.co/functions/v1/notify-whatsapp'),
--     ('notify_whatsapp_secret', '<STRING_ALEATORIA_LONGA>')
--   on conflict (key) do update set value = excluded.value, updated_at = now();
--
-- E os secrets da Edge Function (Supabase CLI):
--   supabase secrets set ZAPI_INSTANCE=... ZAPI_TOKEN=... ZAPI_CLIENT_TOKEN=... \
--                        NOTIFY_WHATSAPP_SECRET=<a MESMA string acima>
--   supabase functions deploy notify-whatsapp --no-verify-jwt
--
-- (Guardar a config numa tabela, e não em `alter database ... set app.*`,
--  porque o role `postgres` do Supabase não é superusuário e não tem permissão
--  para definir parâmetros customizados.)
-- ============================================================================

create extension if not exists pg_net;

-- ----------------------------------------------------------------------------
-- 0. Config de integrações (chave/valor). RLS sem policy nenhuma: nenhum
--    cliente PostgREST (anon/authenticated) lê ou escreve. Só quem enxerga é
--    o trigger abaixo (SECURITY DEFINER, dono = postgres, ignora RLS) e o
--    SQL Editor do dashboard (roda como postgres).
-- ----------------------------------------------------------------------------
create table if not exists integration_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
alter table integration_settings enable row level security;

-- ----------------------------------------------------------------------------
-- 1. Log / fila de notificações. É também a trava de idempotência: no máximo
--    uma mensagem por (pedido, status), então retry de trigger ou update
--    repetido do mesmo status nunca reenvia.
-- ----------------------------------------------------------------------------
create table if not exists whatsapp_notifications (
  id                  bigint generated always as identity primary key,
  order_id            text not null references orders(id) on delete cascade,
  order_number        int,
  status              text not null,          -- order_status que disparou
  phone               text,                   -- normalizado (55 + DDD + número)
  customer_name       text,
  service_type        text,
  driver_name         text,
  message             text,                   -- texto efetivamente enviado
  notification_status text not null default 'queued'
    check (notification_status in ('queued', 'sent', 'failed', 'skipped')),
  provider_message_id text,
  provider_response   jsonb,
  http_status         int,
  error               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (order_id, status)
);

create index if not exists whatsapp_notifications_order_idx
  on whatsapp_notifications (order_id);
create index if not exists whatsapp_notifications_created_idx
  on whatsapp_notifications (created_at desc);

alter table whatsapp_notifications enable row level security;

-- Funcionário logado pode ler (para uma futura tela de acompanhamento).
-- Ninguém escreve pelo PostgREST: só o trigger (SECURITY DEFINER, dono ignora
-- RLS) e a Edge Function (service role).
drop policy if exists "authenticated_read_whatsapp_notifications" on whatsapp_notifications;
create policy "authenticated_read_whatsapp_notifications"
  on whatsapp_notifications for select
  using (auth.role() = 'authenticated');

-- Realtime opcional — permite acompanhar os envios ao vivo num painel.
do $$
begin
  alter publication supabase_realtime add table whatsapp_notifications;
exception when duplicate_object then null;
end $$;

-- ----------------------------------------------------------------------------
-- 2. Trigger: decide se o evento notifica, normaliza o telefone, registra a
--    intenção e chama a Edge Function de forma assíncrona (pg_net não bloqueia
--    a transação do pedido).
-- ----------------------------------------------------------------------------
create or replace function public.tg_notify_order_status_whatsapp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status       text := new.order_status;
  v_should       boolean := false;
  v_wants        boolean := coalesce((new.customer->>'wantsWhatsappUpdates')::boolean, false);
  v_phone_digits text;
  v_phone_e164   text;
  v_url          text;
  v_secret       text;
  v_notif_id     bigint;
begin
  select value into v_url    from integration_settings where key = 'notify_whatsapp_url';
  select value into v_secret from integration_settings where key = 'notify_whatsapp_secret';

  -- (a) esse evento deve gerar mensagem? Só recebido, em preparo e saiu p/ entrega.
  if tg_op = 'INSERT' then
    v_should := (v_status = 'novo');
  elsif tg_op = 'UPDATE' then
    v_should := (new.order_status is distinct from old.order_status)
                and v_status in ('em_preparo', 'saiu_entrega');
  end if;
  if not v_should then
    return new;
  end if;

  -- (b) só canais em que existe telefone real de cliente
  if new.channel not in ('online', 'whatsapp', 'telefone') then
    return new;
  end if;

  -- (c) consentimento LGPD (opt-in marcado no checkout do /pedir)
  if not v_wants then
    return new;
  end if;

  -- (d) "saiu para entrega" só faz sentido em pedido de entrega
  if v_status = 'saiu_entrega' and new.service_type is distinct from 'entrega' then
    return new;
  end if;

  -- (e) telefone → dígitos; prefixa 55 quando vier só com DDD + número
  v_phone_digits := regexp_replace(coalesce(new.customer->>'phone', ''), '\D', '', 'g');
  if length(v_phone_digits) between 10 and 11 then
    v_phone_e164 := '55' || v_phone_digits;
  elsif length(v_phone_digits) between 12 and 13 then
    v_phone_e164 := v_phone_digits;
  else
    insert into whatsapp_notifications
      (order_id, order_number, status, phone, notification_status, error)
    values
      (new.id, new.order_number, v_status, v_phone_digits, 'skipped', 'telefone inválido')
    on conflict (order_id, status) do nothing;
    return new;
  end if;

  -- (f) registra a intenção — o UNIQUE(order_id, status) garante 1 envio só
  insert into whatsapp_notifications
    (order_id, order_number, status, phone, customer_name, service_type, driver_name, notification_status)
  values
    (new.id, new.order_number, v_status, v_phone_e164,
     new.customer->>'name', new.service_type, new.delivery_driver_name, 'queued')
  on conflict (order_id, status) do nothing
  returning id into v_notif_id;

  -- já existia (retry / status repetido) — não reenvia
  if v_notif_id is null then
    return new;
  end if;

  -- (g) sem configuração ainda → deixa 'queued' e não quebra o pedido
  if coalesce(v_url, '') = '' then
    return new;
  end if;

  -- (h) chama a Edge Function de forma assíncrona
  begin
    perform net.http_post(
      url     := v_url,
      body    := jsonb_build_object(
        'notification_id', v_notif_id,
        'order_id',        new.id,
        'order_number',    new.order_number,
        'status',          v_status,
        'phone',           v_phone_e164,
        'customer_name',   new.customer->>'name',
        'service_type',    new.service_type,
        'driver_name',     new.delivery_driver_name
      ),
      headers := jsonb_build_object(
        'Content-Type',    'application/json',
        'x-webhook-secret', coalesce(v_secret, '')
      ),
      timeout_milliseconds := 5000
    );
  exception when others then
    update whatsapp_notifications
       set notification_status = 'failed',
           error = 'pg_net: ' || sqlerrm,
           updated_at = now()
     where id = v_notif_id;
  end;

  return new;
end;
$$;

drop trigger if exists trg_notify_order_status_whatsapp on public.orders;
create trigger trg_notify_order_status_whatsapp
  after insert or update of order_status on public.orders
  for each row execute function public.tg_notify_order_status_whatsapp();
