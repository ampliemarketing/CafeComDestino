-- ============================================================================
-- Página pública de acompanhamento do pedido (sem login).
--
-- O cliente recebe um link /acompanhar?t=<token> (na tela de confirmação do
-- /pedir e em toda mensagem de WhatsApp) e vê o status ao vivo — sem expor
-- pedido de um cliente para outro.
--
-- COMO O TOKEN É GUARDADO: dentro de orders.customer->>'trackingToken', um
-- UUID gerado no navegador (crypto.randomUUID()) e enviado junto no pedido —
-- mesmo mecanismo já usado para 'wantsWhatsappUpdates'. Assim NÃO é preciso
-- alterar create_order_and_credit_cash (que persiste p_order->'customer'
-- inteiro). Não usamos o número do pedido como chave: ele é sequencial e
-- daria para varrer e vazar nome/endereço/telefone de todos os clientes.
--
-- A leitura é por uma RPC SECURITY DEFINER liberada para `anon` que devolve
-- SOMENTE campos seguros (status, itens, horários) — nunca telefone, endereço
-- completo, forma/estado de pagamento ou observações.
--
-- CONFIGURAÇÃO (SQL Editor, uma vez) — base URL pública para montar o link:
--   insert into integration_settings (key, value)
--   values ('public_base_url', 'https://cafecomdestino.ampliechef.com.br')
--   on conflict (key) do update set value = excluded.value, updated_at = now();
-- ============================================================================

-- Índice funcional para a busca por token ser O(log n).
create index if not exists orders_tracking_token_idx
  on orders ((customer->>'trackingToken'))
  where customer->>'trackingToken' is not null;

-- ----------------------------------------------------------------------------
-- RPC pública de acompanhamento. Retorna jsonb com campos seguros, ou NULL
-- quando o token não existe / é curto demais.
-- ----------------------------------------------------------------------------
create or replace function public.get_order_tracking(p_token text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'orderNumber',       o.order_number,
    'orderStatus',       o.order_status,
    'serviceType',       o.service_type,
    'createdAt',         o.created_at,
    'updatedAt',         o.updated_at,
    'preparedAt',        o.prepared_at,
    'deliveredAt',       o.delivered_at,
    'customerFirstName', split_part(coalesce(o.customer->>'name', ''), ' ', 1),
    'driverFirstName',   split_part(coalesce(o.delivery_driver_name, ''), ' ', 1),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'name',     it->>'productName',
               'quantity', (it->>'quantity')::int))
      from jsonb_array_elements(o.items) it
      where coalesce(it->>'status', 'ativo') <> 'cancelado'
    ), '[]'::jsonb),
    'subtotal',           o.subtotal,
    'deliveryFee',        o.delivery_fee,
    'total',              o.total,
    'restaurantName',     (select coalesce(nullif(trade_name, ''), name) from company_profile where id = true),
    'avgPrepTimeMinutes', (select avg_prep_time_minutes from company_profile where id = true)
  )
  from orders o
  where char_length(coalesce(p_token, '')) >= 20
    and o.customer->>'trackingToken' = p_token
  limit 1;
$$;

revoke all on function public.get_order_tracking(text) from public;
grant execute on function public.get_order_tracking(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Atualiza o trigger de WhatsApp (migration 0046) para mandar também o token
-- de rastreio e a base URL, de modo que a Edge Function acrescente o link
-- "Acompanhe seu pedido" nas mensagens.
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
  v_base_url     text;
  v_notif_id     bigint;
begin
  select value into v_url      from integration_settings where key = 'notify_whatsapp_url';
  select value into v_secret   from integration_settings where key = 'notify_whatsapp_secret';
  select value into v_base_url from integration_settings where key = 'public_base_url';

  -- Etapas que geram WhatsApp: só recebido, em preparo e saiu para entrega.
  if tg_op = 'INSERT' then
    v_should := (v_status = 'novo');
  elsif tg_op = 'UPDATE' then
    v_should := (new.order_status is distinct from old.order_status)
                and v_status in ('em_preparo', 'saiu_entrega');
  end if;
  if not v_should then return new; end if;

  if new.channel not in ('online', 'whatsapp', 'telefone') then return new; end if;
  if not v_wants then return new; end if;
  if v_status = 'saiu_entrega' and new.service_type is distinct from 'entrega' then return new; end if;

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

  insert into whatsapp_notifications
    (order_id, order_number, status, phone, customer_name, service_type, driver_name, notification_status)
  values
    (new.id, new.order_number, v_status, v_phone_e164,
     new.customer->>'name', new.service_type, new.delivery_driver_name, 'queued')
  on conflict (order_id, status) do nothing
  returning id into v_notif_id;
  if v_notif_id is null then return new; end if;

  if coalesce(v_url, '') = '' then return new; end if;

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
        'driver_name',     new.delivery_driver_name,
        'tracking_token',  new.customer->>'trackingToken',
        'base_url',        v_base_url
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
