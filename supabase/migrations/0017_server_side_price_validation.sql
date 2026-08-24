-- Achado de pentest (item 2): create_order_and_credit_cash e
-- close_comanda_and_pay confiavam 100% no jsonb que o cliente mandava —
-- preço unitário, subtotal, desconto, total e até o valor creditado no
-- caixa (p_cash_amount) vinham prontos do navegador, sem nenhuma
-- verificação contra o preço real em `products`. Bastava adulterar a
-- requisição (DevTools, extensão maliciosa, replay) pra registrar uma
-- venda de R$ 500 como R$ 5.
--
-- Esta migration faz create_order_and_credit_cash recalcular, para cada
-- item do pedido:
--   - preço = products.promo_price/price real, validado contra o banco;
--   - adicionais validados contra products.additions (adicional que não
--     existe no produto derruba a transação inteira, não é ignorado);
--   - produto que não existe mais derruba a transação inteira.
-- Duas exceções propositais (não dá pra validar contra o banco):
--   - itens de cortesia (isCourtesy=true) — preço forçado a 0 sempre,
--     independente do que vier, é mais seguro que só confiar no valor
--     enviado;
--   - itens "por quilo" (prod-kg-almoco / prod-kg-cafe) — o preço depende
--     do peso real na balança, que não tem contrapartida no banco pra
--     comparar. Mesmo trust boundary que qualquer PDV com produto pesável.
-- subtotal/total são recalculados a partir dos itens validados; o
-- p_cash_amount enviado pelo cliente deixa de ser usado para creditar o
-- caixa — quem credita agora é o valor recalculado no servidor.
--
-- close_comanda_and_pay também passa a reler os itens e adiantamentos
-- direto da linha atual de dining_tables (não do jsonb que veio na
-- chamada), fechando a brecha de mandar um p_order desconectado do que
-- está realmente na comanda.
-- create or replace NÃO troca a função quando a lista de parâmetros muda de
-- tamanho — ele cria uma segunda função sobrecarregada ao lado da antiga.
-- Como o app chama create_order_and_credit_cash com exatamente os 5
-- parâmetros nomeados de sempre, isso deixaria a chamada ambígua entre a
-- versão antiga (ainda sem validação) e a nova. Por isso a assinatura de
-- 5 parâmetros precisa ser derrubada explicitamente antes de recriar com 6.
drop function if exists public.create_order_and_credit_cash(jsonb, numeric, text, jsonb, jsonb);

create or replace function public.create_order_and_credit_cash(
  p_order jsonb,
  p_cash_amount numeric,
  p_payment_method text,
  p_stock_items jsonb default '[]'::jsonb,
  p_split_payments jsonb default null,
  p_already_paid numeric default 0
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_shift_id text;
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
  v_discount numeric;
  v_total numeric;
  v_split_sum numeric;
begin
  for v_item in select * from jsonb_array_elements(coalesce(p_order->'items', '[]'::jsonb))
  loop
    -- Item cancelado não entra no subtotal e não precisa validar preço —
    -- inclusive porque o produto referenciado pode já nem existir mais.
    if coalesce(v_item->>'status', 'ativo') = 'cancelado' then
      v_validated_items := v_validated_items || v_item;
      continue;
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
        raise exception 'Produto % não encontrado — venda rejeitada.', v_item->>'productId';
      end if;

      v_validated_additions := '[]'::jsonb;
      v_additions_total := 0;
      for v_addition in select * from jsonb_array_elements(coalesce(v_item->'additions', '[]'::jsonb))
      loop
        select (elem->>'price')::numeric into v_addition_price
        from jsonb_array_elements(coalesce(v_product.additions, '[]'::jsonb)) elem
        where elem->>'id' = v_addition->>'id';

        if v_addition_price is null then
          raise exception 'Adicional % inválido para o produto % — venda rejeitada.', v_addition->>'id', v_product.name;
        end if;

        v_additions_total := v_additions_total + v_addition_price;
        v_validated_additions := v_validated_additions || jsonb_build_object('id', v_addition->>'id', 'name', v_addition->>'name', 'price', v_addition_price);
      end loop;

      v_unit_price := coalesce(v_product.promo_price, v_product.price) + v_additions_total;
    end if;

    v_line_total := v_unit_price * coalesce((v_item->>'quantity')::numeric, 1);
    v_subtotal := v_subtotal + v_line_total;
    v_validated_items := v_validated_items || (v_item || jsonb_build_object('unitPrice', v_unit_price, 'additions', v_validated_additions));
  end loop;

  v_delivery_fee := greatest(0, coalesce((p_order->>'deliveryFee')::numeric, 0));
  v_discount := greatest(0, coalesce((p_order->>'discount')::numeric, 0));
  v_total := greatest(0, v_subtotal + v_delivery_fee - coalesce(p_already_paid, 0) - v_discount);

  perform public.deduct_stock_for_items(p_stock_items);

  select id into v_shift_id from cash_shifts where status = 'aberto' limit 1;

  insert into orders (
    id, order_number, channel, table_number, customer, items, service_type,
    subtotal, delivery_fee, discount, total, payment_method, payment_status,
    order_status, prepared_at, delivered_at, tuna_transaction_id,
    delivery_driver_name, waiter_name, notes, fiscal_issued, nfce_key,
    split_payments, shift_id
  )
  values (
    p_order->>'id', (p_order->>'orderNumber')::int, p_order->>'channel',
    nullif(p_order->>'tableNumber','')::int, p_order->'customer', v_validated_items,
    p_order->>'serviceType', v_subtotal, v_delivery_fee,
    v_discount, v_total, p_order->>'paymentMethod',
    p_order->>'paymentStatus', p_order->>'orderStatus', p_order->>'preparedAt', p_order->>'deliveredAt',
    p_order->>'tunaTransactionId', p_order->>'deliveryDriverName', p_order->>'waiterName',
    p_order->>'notes', (p_order->>'fiscalIssued')::boolean, p_order->>'nfceKey',
    p_split_payments, v_shift_id
  );

  if v_shift_id is not null then
    if p_split_payments is not null and jsonb_array_length(p_split_payments) > 0 then
      select coalesce(sum((elem->>'amount')::numeric), 0) into v_split_sum
      from jsonb_array_elements(p_split_payments) elem;

      if abs(v_split_sum - v_total) > 0.05 then
        raise exception 'Soma das formas de pagamento (R$ %) não bate com o total da venda (R$ %) — venda rejeitada.', v_split_sum, v_total;
      end if;

      update cash_shifts set
        sales_cash = sales_cash + coalesce((
          select sum((elem->>'amount')::numeric) from jsonb_array_elements(p_split_payments) elem
          where elem->>'method' = 'dinheiro'
        ), 0),
        sales_credit = sales_credit + coalesce((
          select sum((elem->>'amount')::numeric) from jsonb_array_elements(p_split_payments) elem
          where elem->>'method' = 'cartao_credito'
        ), 0),
        sales_debit = sales_debit + coalesce((
          select sum((elem->>'amount')::numeric) from jsonb_array_elements(p_split_payments) elem
          where elem->>'method' = 'cartao_debito'
        ), 0),
        sales_card = sales_card + coalesce((
          select sum((elem->>'amount')::numeric) from jsonb_array_elements(p_split_payments) elem
          where elem->>'method' in ('cartao_credito', 'cartao_debito')
        ), 0),
        sales_pix = sales_pix + coalesce((
          select sum((elem->>'amount')::numeric) from jsonb_array_elements(p_split_payments) elem
          where elem->>'method' = 'pix'
        ), 0),
        sales_meal_voucher = sales_meal_voucher + coalesce((
          select sum((elem->>'amount')::numeric) from jsonb_array_elements(p_split_payments) elem
          where elem->>'method' = 'vale_refeicao'
        ), 0),
        sales_other = sales_other + coalesce((
          select sum((elem->>'amount')::numeric) from jsonb_array_elements(p_split_payments) elem
          where elem->>'method' not in ('dinheiro', 'cartao_credito', 'cartao_debito', 'pix', 'vale_refeicao')
        ), 0)
      where id = v_shift_id;
    else
      update cash_shifts set
        sales_cash = sales_cash + case when p_payment_method = 'dinheiro' then v_total else 0 end,
        sales_credit = sales_credit + case when p_payment_method = 'cartao_credito' then v_total else 0 end,
        sales_debit = sales_debit + case when p_payment_method = 'cartao_debito' then v_total else 0 end,
        sales_card = sales_card + case when p_payment_method in ('cartao_credito','cartao_debito') then v_total else 0 end,
        sales_pix  = sales_pix  + case when p_payment_method = 'pix' then v_total else 0 end,
        sales_meal_voucher = sales_meal_voucher + case when p_payment_method = 'vale_refeicao' then v_total else 0 end,
        sales_other = sales_other + case when p_payment_method not in ('dinheiro','cartao_credito','cartao_debito','pix','vale_refeicao') then v_total else 0 end
      where id = v_shift_id;
    end if;
  end if;
end;
$$;

create or replace function public.close_comanda_and_pay(
  p_table_id text,
  p_comanda_id text,
  p_order jsonb,
  p_cash_amount numeric,
  p_payment_method text,
  p_split_payments jsonb default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_remaining jsonb;
  v_comanda jsonb;
  v_advances_total numeric;
begin
  select elem into v_comanda
  from jsonb_array_elements((select comandas from dining_tables where id = p_table_id)) as elem
  where elem->>'id' = p_comanda_id;

  if v_comanda is null then
    raise exception 'Comanda % não encontrada na mesa % — operação rejeitada.', p_comanda_id, p_table_id;
  end if;

  select coalesce(sum((adv->>'amount')::numeric), 0) into v_advances_total
  from jsonb_array_elements(coalesce(v_comanda->'advancePayments', '[]'::jsonb)) adv
  where adv->>'status' = 'ativo';

  -- Usa os itens que estão de fato gravados na mesa agora, não o array que
  -- veio na chamada — fecha a brecha de mandar um p_order desconectado do
  -- que realmente está na comanda.
  perform public.create_order_and_credit_cash(
    jsonb_set(p_order, '{items}', coalesce(v_comanda->'items', '[]'::jsonb)),
    p_cash_amount,
    p_payment_method,
    '[]'::jsonb,
    p_split_payments,
    v_advances_total
  );

  select coalesce(jsonb_agg(elem), '[]'::jsonb) into v_remaining
  from jsonb_array_elements((select comandas from dining_tables where id = p_table_id)) as elem
  where elem->>'id' <> p_comanda_id;

  update dining_tables set
    comandas = v_remaining,
    status = public.compute_table_status(v_remaining)
  where id = p_table_id;
end;
$$;

-- Reafirma os grants da migration 0016 (create or replace function
-- reseta a lista de EXECUTE em alguns setups, então reforça aqui pra
-- não reabrir a brecha sem querer).
grant execute on function public.create_order_and_credit_cash(jsonb, numeric, text, jsonb, jsonb, numeric) to authenticated;
grant execute on function public.close_comanda_and_pay(text, text, jsonb, numeric, text, jsonb) to authenticated;
revoke execute on function public.create_order_and_credit_cash(jsonb, numeric, text, jsonb, jsonb, numeric) from public, anon;
revoke execute on function public.close_comanda_and_pay(text, text, jsonb, numeric, text, jsonb) from public, anon;
