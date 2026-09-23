-- ============================================================================
-- Correções da auditoria de segurança da integração PagBank (0053), achados
-- de Alto risco — ver docs/pagbank.md para o resumo completo da auditoria.
--
-- 1. Race condition em finalizePaidCharge: a resposta síncrona do cartão e o
--    webhook podiam chamar a finalização quase ao mesmo tempo pro mesmo
--    referenceId; sem lock, as duas passavam pela checagem de
--    created_order_id como null, a segunda batia em violação de PK ao
--    inserir o pedido (que a primeira já tinha criado) e sobrescrevia
--    status='paid' com status='error' — um pedido pago de verdade aparecia
--    como erro. Corrigido: toda a finalização agora roda ATÔMICA numa única
--    função SQL (`finalize_pagbank_paid_charge`), com `select ... for
--    update` travando a linha de `pagbank_orders` — a segunda chamada
--    concorrente espera a primeira commitar e aí já vê created_order_id
--    preenchido, sem nunca tentar inserir de novo nem sobrescrever o status.
--
-- 2. price_public_order_items confiava no unitPrice enviado pelo cliente
--    para os itens por quilo (prod-kg-almoco/prod-kg-cafe) — esses produtos
--    nunca aparecem no cardápio público (só são lançados manualmente no PDV,
--    com pesagem física real), então herdar essa exceção pro canal de
--    pagamento público permitia forjar o preço chamando a Edge Function
--    direto. Corrigido: esses productId agora são rejeitados nesta função —
--    quem precisar vender item por peso no cardápio online terá que ser
--    tratado como feature nova, não reaproveitar essa exceção do PDV.
--
-- 3. Rate limiting básico (por IP) nos dois endpoints públicos de criação de
--    cobrança — mitiga "card testing" (testar cartões roubados em massa
--    usando o merchant como oráculo de aprovado/recusado) e abuso geral.
--    Mesmo padrão simples de `login_attempts`/`pin_attempts` já usado no
--    projeto — não é uma solução de WAF, é proteção mínima.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. price_public_order_items — remove a exceção de preço livre pra item por
--    quilo (só existe hoje pro PDV, com pesagem física; não faz sentido no
--    canal público/pagamento online).
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
      raise exception 'Item de cortesia não é permitido no pagamento online.';
    elsif v_item->>'productId' in ('prod-kg-almoco', 'prod-kg-cafe') then
      raise exception 'Item vendido por peso não está disponível para pagamento online — requer pesagem no balcão.';
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
    v_validated_items := v_validated_items || (v_item || jsonb_build_object('unitPrice', v_unit_price, 'additions', v_validated_additions));
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

-- ----------------------------------------------------------------------------
-- 2. finalize_pagbank_paid_charge — finalização ATÔMICA de uma cobrança paga.
--    Substitui a orquestração em várias chamadas separadas que existia em
--    supabase/functions/_shared/pagbank/finalize.ts (select, rpc, select,
--    update, update, insert — 6 idas e vindas, sem transação nem lock
--    unindo elas). Agora tudo roda dentro de UMA função plpgsql, que o
--    Postgres já executa como uma transação implícita só — o `for update`
--    trava a linha de pagbank_orders até essa transação terminar, então uma
--    segunda chamada concorrente (webhook vs. resposta síncrona do cartão)
--    fica bloqueada esperando, e quando destrava já vê created_order_id
--    preenchido — nunca tenta inserir o pedido de novo.
-- ----------------------------------------------------------------------------
create or replace function public.finalize_pagbank_paid_charge(
  p_reference_id text,
  p_source text,
  p_provider_response jsonb default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_row pagbank_orders%rowtype;
  v_draft jsonb;
  v_stock_items jsonb;
  v_order_number int;
  v_order_id text;
begin
  if p_source not in ('create', 'webhook') then
    raise exception 'source inválido: %', p_source;
  end if;

  select * into v_row from pagbank_orders where id = p_reference_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'pagbank_orders não encontrado.');
  end if;

  -- Já finalizado (pela outra via, ou reenvio) — idempotente, nada a fazer.
  if v_row.created_order_id is not null then
    select order_number into v_order_number from orders where id = v_row.created_order_id;
    return jsonb_build_object('ok', true, 'alreadyFinalized', true, 'orderId', v_row.created_order_id, 'orderNumber', v_order_number);
  end if;

  v_draft := v_row.order_draft || jsonb_build_object('paymentStatus', 'pagamento_aprovado');
  v_order_id := v_draft->>'id';

  select coalesce(jsonb_agg(jsonb_build_object('productId', it->>'productId', 'quantity', it->>'quantity')), '[]'::jsonb)
    into v_stock_items
    from jsonb_array_elements(coalesce(v_row.order_draft->'items', '[]'::jsonb)) it;

  begin
    perform public.create_order_and_credit_cash(
      v_draft, null, v_draft->>'paymentMethod', v_stock_items, null
    );
  exception when others then
    update pagbank_orders
       set status = 'error', error_message = 'Falha ao finalizar pedido: ' || sqlerrm
     where id = p_reference_id and created_order_id is null;
    insert into payment_events (pagbank_order_ref, event_type, status, source, detail)
      values (p_reference_id, 'finalize_error', 'error', p_source, jsonb_build_object('error', sqlerrm));
    return jsonb_build_object('ok', false, 'error', sqlerrm);
  end;

  select order_number into v_order_number from orders where id = v_order_id;

  update orders set pagbank_charge_id = v_row.pagbank_charge_id where id = v_order_id;

  update pagbank_orders
     set status = 'paid', created_order_id = v_order_id, provider_response = p_provider_response
   where id = p_reference_id;

  insert into payment_events (pagbank_order_ref, order_id, event_type, status, source, detail)
    values (p_reference_id, v_order_id, 'order_finalized', 'paid', p_source, jsonb_build_object('orderNumber', v_order_number));

  return jsonb_build_object('ok', true, 'orderId', v_order_id, 'orderNumber', v_order_number);
end;
$$;

revoke all on function public.finalize_pagbank_paid_charge(text, text, jsonb) from public, anon, authenticated;
-- Só service role chama (dentro das Edge Functions pagbank-create-card e
-- pagbank-webhook) — sem grant pra anon/authenticated de propósito.

-- ----------------------------------------------------------------------------
-- 3. Rate limiting básico por IP — usado pelos endpoints públicos
--    pagbank-create-pix/pagbank-create-card antes de criar qualquer cobrança.
--    Upsert atômico (on conflict do update ... returning) evita race entre
--    requisições concorrentes do mesmo IP.
-- ----------------------------------------------------------------------------
create table if not exists public.pagbank_rate_limits (
  bucket       text not null,
  rate_key     text not null,
  window_start timestamptz not null default now(),
  hit_count    int not null default 0,
  primary key (bucket, rate_key)
);

alter table public.pagbank_rate_limits enable row level security;
-- Sem policy: só service role toca (mesmo padrão de login_attempts).

create or replace function public.check_pagbank_rate_limit(
  p_bucket text,
  p_key text,
  p_max_hits int,
  p_window_seconds int
)
returns boolean -- true = dentro do limite (segue); false = excedeu (bloqueia)
language plpgsql
security definer set search_path = public
as $$
declare
  v_count int;
begin
  insert into pagbank_rate_limits (bucket, rate_key, window_start, hit_count)
  values (p_bucket, p_key, now(), 1)
  on conflict (bucket, rate_key) do update
    set hit_count = case
          when pagbank_rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
            then 1
          else pagbank_rate_limits.hit_count + 1
        end,
        window_start = case
          when pagbank_rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
            then now()
          else pagbank_rate_limits.window_start
        end
  returning hit_count into v_count;

  return v_count <= p_max_hits;
end;
$$;

revoke all on function public.check_pagbank_rate_limit(text, text, int, int) from public, anon, authenticated;
