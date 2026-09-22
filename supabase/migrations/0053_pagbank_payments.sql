-- ============================================================================
-- Integração PagBank (PIX + Cartão) — Cardápio Online (/pedir) — Fase 1.
--
-- Só o canal `online` usa isto (PDV e mesa continuam com pagamento físico,
-- sem nenhuma mudança). NENHUMA função financeira existente é alterada:
-- `create_order_and_credit_cash`, `close_comanda_and_pay` e os `cash_shifts`
-- ficam intocados — zero risco pro fluxo de caixa/PDV/mesa.
--
-- ARQUITETURA (mesmo padrão de fiscal_invoices/whatsapp_notifications):
--
--   pagbank-create-pix / pagbank-create-card (Edge Function, cliente anônimo)
--        │  1. precifica os itens no servidor (price_public_order_items) —
--        │     nunca confia no total que o cardápio público mandou
--        │  2. grava pagbank_orders (status='waiting'), SEM tocar orders/estoque
--        │  3. cria a cobrança no PagBank
--        ▼
--   pagbank_orders (1 linha por tentativa de cobrança — reference_id nosso é a PK)
--        │
--        ▼ pago (webhook confirmado contra a API, ou resposta síncrona do cartão)
--   create_order_and_credit_cash(order_draft)  ← função já existente, INTOCADA
--        │  só agora estoque é baixado e o pedido passa a existir de verdade
--        ▼
--   orders (pagbank_charge_id preenchido) + pagbank_orders.created_order_id
--
-- Pedido nunca pago (QR expira, cartão recusado, cliente some) nunca vira
-- `orders` — não baixa estoque, não precisa de rotina de expiração/estorno.
--
-- CONFIGURAÇÃO (rodar depois, fora da migration):
--   supabase secrets set \
--     PAGBANK_ENV=sandbox \
--     PAGBANK_TOKEN=... \
--     PAGBANK_WEBHOOK_URL="https://<project>.supabase.co/functions/v1/pagbank-webhook"
--   -- Sem PAGBANK_WEBHOOK_SECRET: a autenticidade da notificação usa o
--   -- mecanismo oficial do PagBank (header x-authenticity-token = SHA-256 de
--   -- "{PAGBANK_TOKEN}-{corpo}"), não um segredo à parte.
--   supabase functions deploy pagbank-create-pix
--   supabase functions deploy pagbank-create-card
--   supabase functions deploy pagbank-webhook --no-verify-jwt
--   supabase functions deploy pagbank-cancel
-- Ver docs/pagbank.md para o passo a passo completo (sandbox → produção).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. pagbank_orders — 1 linha por tentativa de cobrança. A PK é o nosso
--    reference_id (gerado pela Edge Function, "pgb_<uuid>"), correlacionando
--    com order_id/charge_id do PagBank. `amount` é sempre o valor calculado no
--    servidor (nunca o que o cliente mandou). `order_draft` é o payload pronto
--    pra virar p_order de create_order_and_credit_cash quando confirmado.
-- ----------------------------------------------------------------------------
create table if not exists pagbank_orders (
  id                 text primary key,
  status             text not null default 'waiting'
    check (status in ('waiting', 'paid', 'declined', 'cancelled', 'expired', 'error')),
  payment_method     text not null check (payment_method in ('pix', 'cartao_credito', 'cartao_debito')),
  amount             numeric(10,2) not null check (amount >= 0),
  pagbank_order_id   text,
  pagbank_charge_id  text,
  qr_code_text       text,
  qr_code_image_url  text,
  expiration_date    timestamptz,
  order_draft        jsonb not null,
  provider_response  jsonb,
  created_order_id   text references orders(id),
  error_message      text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (pagbank_charge_id)
);

create index if not exists pagbank_orders_status_idx  on pagbank_orders (status);
create index if not exists pagbank_orders_created_idx on pagbank_orders (created_at desc);

alter table pagbank_orders enable row level security;
-- Sem policy nenhuma: ninguém lê/escreve direto por PostgREST (nem anon, nem
-- authenticated) — só a service role (Edge Functions) e a RPC pública abaixo,
-- que devolve só um subconjunto seguro dos campos.

do $$
begin
  alter publication supabase_realtime add table pagbank_orders;
exception when duplicate_object then null;
end $$;

-- ----------------------------------------------------------------------------
-- 2. payment_webhook_events — dedupe de notificação do PagBank. `event_key` é
--    o id do evento quando o PagBank manda um, senão um valor sintético
--    "charge_id:status" (mesmo truque de unique(order_id,status) já usado em
--    whatsapp_notifications) — evento repetido não reprocessa.
-- ----------------------------------------------------------------------------
create table if not exists payment_webhook_events (
  id           bigint generated always as identity primary key,
  provider     text not null default 'pagbank',
  event_key    text not null,
  payload      jsonb,
  received_at  timestamptz not null default now(),
  unique (provider, event_key)
);

alter table payment_webhook_events enable row level security;
-- Sem policy: só service role escreve/lê (webhook + auditoria interna).

-- ----------------------------------------------------------------------------
-- 3. payment_events — auditoria de toda mudança de status de cobrança
--    (origem: create | webhook | manual_check | cancel).
-- ----------------------------------------------------------------------------
create table if not exists payment_events (
  id                bigint generated always as identity primary key,
  pagbank_order_ref text references pagbank_orders(id) on delete cascade,
  order_id          text references orders(id),
  event_type        text not null,
  status            text,
  source            text not null check (source in ('create', 'webhook', 'manual_check', 'cancel')),
  detail            jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists payment_events_ref_idx   on payment_events (pagbank_order_ref);
create index if not exists payment_events_order_idx on payment_events (order_id);

alter table payment_events enable row level security;
drop policy if exists "authenticated_read_payment_events" on payment_events;
create policy "authenticated_read_payment_events"
  on payment_events for select
  using (auth.role() = 'authenticated');
-- Escrita só por service role (Edge Functions).

-- ----------------------------------------------------------------------------
-- 4. `updated_at` automático em pagbank_orders (mesmo padrão de fiscal_invoices).
-- ----------------------------------------------------------------------------
create or replace function public.tg_pagbank_orders_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_pagbank_orders_touch on public.pagbank_orders;
create trigger trg_pagbank_orders_touch
  before update on public.pagbank_orders
  for each row execute function public.tg_pagbank_orders_touch();

-- ----------------------------------------------------------------------------
-- 5. Coluna denormalizada em orders (mesmo padrão de nfce_key/fiscal_issued) —
--    só pra telas existentes (ex. acompanhamento do pedido) mostrarem a
--    referência do pagamento sem precisar de join.
-- ----------------------------------------------------------------------------
alter table orders add column if not exists pagbank_charge_id text;

-- ----------------------------------------------------------------------------
-- 6. price_public_order_items — precificação server-side PURA (sem side
--    effect nenhum: não baixa estoque, não toca orders/cash_shifts). Reaplica
--    exatamente as mesmas checagens do branch `v_is_anon` de
--    create_order_and_credit_cash (migration 0023) — mesmo trade-off de
--    duplicar lógica já aceito no repo (emit-nfce duplica src/lib/fiscal.ts).
--    A Edge Function usa isto pra saber o valor real ANTES de mandar a
--    cobrança pro PagBank; create_order_and_credit_cash continua sendo a
--    validação final no momento de fato de inserir o pedido (defesa em
--    profundidade — se o preço mudou nesse meio tempo, a segunda validação
--    pega a divergência e a venda é rejeitada lá, não aqui).
-- ----------------------------------------------------------------------------
create or replace function public.price_public_order_items(
  p_items jsonb,
  p_delivery_fee numeric default 0
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_item jsonb;
  v_addition jsonb;
  v_product products%rowtype;
  v_unit_price numeric;
  v_addition_price numeric;
  v_additions_total numeric;
  v_validated_additions jsonb;
  v_validated_items jsonb := '[]'::jsonb;
  v_line_total numeric;
  v_subtotal numeric := 0;
  v_delivery_fee numeric;
  v_total numeric;
  v_min_order_value numeric;
  v_qty numeric;
begin
  if coalesce(jsonb_array_length(p_items), 0) not between 1 and 50 then
    raise exception 'Pedido com número de itens inválido.';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := coalesce((v_item->>'quantity')::numeric, 1);
    if v_qty <= 0 or v_qty > 100000 then
      raise exception 'Quantidade inválida no item %.', v_item->>'productId';
    end if;

    if (v_item->>'isCourtesy')::boolean is true then
      v_unit_price := 0;
      v_validated_additions := coalesce(v_item->'additions', '[]'::jsonb);
    elsif v_item->>'productId' in ('prod-kg-almoco', 'prod-kg-cafe') then
      v_unit_price := coalesce((v_item->>'unitPrice')::numeric, 0);
      v_validated_additions := coalesce(v_item->'additions', '[]'::jsonb);
    else
      select * into v_product from products where id = v_item->>'productId';
      if not found then
        raise exception 'Produto % não encontrado — pedido rejeitado.', v_item->>'productId';
      end if;

      v_validated_additions := '[]'::jsonb;
      v_additions_total := 0;
      for v_addition in select * from jsonb_array_elements(coalesce(v_item->'additions', '[]'::jsonb))
      loop
        select (elem->>'price')::numeric into v_addition_price
        from jsonb_array_elements(coalesce(v_product.additions, '[]'::jsonb)) elem
        where elem->>'id' = v_addition->>'id';

        if v_addition_price is null then
          raise exception 'Adicional % inválido para o produto % — pedido rejeitado.', v_addition->>'id', v_product.name;
        end if;

        v_additions_total := v_additions_total + v_addition_price;
        v_validated_additions := v_validated_additions || jsonb_build_object('id', v_addition->>'id', 'name', v_addition->>'name', 'price', v_addition_price);
      end loop;

      v_unit_price := coalesce(v_product.promo_price, v_product.price) + v_additions_total;
    end if;

    v_line_total := v_unit_price * v_qty;
    v_subtotal := v_subtotal + v_line_total;
    v_validated_items := v_validated_items || (v_item || jsonb_build_object('unitPrice', v_unit_price, 'quantity', v_qty, 'additions', v_validated_additions));
  end loop;

  select min_order_value into v_min_order_value from company_profile where id = true;
  if v_min_order_value is not null and v_subtotal < v_min_order_value then
    raise exception 'Pedido abaixo do mínimo de R$ % (subtotal: R$ %) — pedido rejeitado.', v_min_order_value, v_subtotal;
  end if;

  v_delivery_fee := greatest(0, coalesce(p_delivery_fee, 0));
  v_total := v_subtotal + v_delivery_fee;

  return jsonb_build_object('items', v_validated_items, 'subtotal', v_subtotal, 'deliveryFee', v_delivery_fee, 'total', v_total);
end;
$$;

revoke all on function public.price_public_order_items(jsonb, numeric) from public;
grant execute on function public.price_public_order_items(jsonb, numeric) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. get_pagbank_payment_status — status público pra tela de pagamento fazer
--    polling (mesmo padrão de get_order_tracking, migration 0047). Devolve só
--    o essencial — nunca customer, provider_response ou o qr code bruto de
--    novo (o qr já foi devolvido uma vez, na criação da cobrança).
-- ----------------------------------------------------------------------------
create or replace function public.get_pagbank_payment_status(p_reference_id text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'status',         po.status,
    'expirationDate', po.expiration_date,
    'orderNumber',    o.order_number,
    'trackingToken',  o.customer->>'trackingToken'
  )
  from pagbank_orders po
  left join orders o on o.id = po.created_order_id
  where po.id = p_reference_id
  limit 1;
$$;

revoke all on function public.get_pagbank_payment_status(text) from public;
grant execute on function public.get_pagbank_payment_status(text) to anon, authenticated;
