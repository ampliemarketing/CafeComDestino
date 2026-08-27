-- Endurece as validações que dependiam só do frontend:
--
-- 1. create_order_and_credit_cash está exposta ao papel `anon` (cardápio
--    público, migration 0018). Ela já recalcula preço no servidor, mas
--    confiava no cliente para `channel`, quantidade de itens e dados do
--    cliente. Um chamador anônimo podia mandar channel != 'online' e furar
--    o pedido mínimo (0020), ou despejar nome/observação gigante direto no
--    jsonb. Agora, quando o chamador é `anon`, o canal é forçado e os
--    campos do cliente são validados em tamanho/formato.
--
-- 2. O schema guarda todo texto como `text` sem limite. Adiciona CHECKs de
--    comprimento nas colunas mais expostas (cadastro de produto, fornecedor,
--    insumo, pedido, perfil da empresa, perfil de usuário). Os limites batem
--    com os de src/lib/validation.ts (MAXLEN). Entram como NOT VALID para não
--    quebrar em cima de linhas já existentes — passam a valer para todo
--    INSERT/UPDATE novo.

-- ---------------------------------------------------------------------------
-- 1. create_order_and_credit_cash — guarda para chamadas anônimas
-- ---------------------------------------------------------------------------
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
  v_min_order_value numeric;
  v_is_anon boolean := auth.role() = 'anon';
  v_qty numeric;
begin
  -- Chamador anônimo (cardápio público): não dá pra confiar em nada que
  -- venha no payload além do carrinho. Trava o canal e valida os dados do
  -- cliente aqui, já que o frontend é burlável chamando a RPC direto.
  if v_is_anon then
    if coalesce(p_order->>'channel', '') <> 'online' then
      raise exception 'Canal inválido para pedido público.';
    end if;
    if coalesce(jsonb_array_length(p_order->'items'), 0) not between 1 and 50 then
      raise exception 'Pedido com número de itens inválido.';
    end if;
    if char_length(coalesce(p_order->'customer'->>'name', '')) not between 2 and 120 then
      raise exception 'Nome do cliente inválido.';
    end if;
    if char_length(regexp_replace(coalesce(p_order->'customer'->>'phone', ''), '\D', '', 'g')) not between 10 and 11 then
      raise exception 'Telefone do cliente inválido.';
    end if;
    if char_length(coalesce(p_order->>'notes', '')) > 1000 then
      raise exception 'Observação do pedido muito longa.';
    end if;
  end if;

  -- Quantidade de cada item de baixa de estoque precisa ser positiva e
  -- dentro de um teto plausível — vale para qualquer chamador.
  for v_qty in
    select coalesce((e->>'quantity')::numeric, 0)
    from jsonb_array_elements(coalesce(p_stock_items, '[]'::jsonb)) e
  loop
    if v_qty <= 0 or v_qty > 100000 then
      raise exception 'Quantidade de item inválida (%).', v_qty;
    end if;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_order->'items', '[]'::jsonb))
  loop
    -- Item cancelado não entra no subtotal e não precisa validar preço —
    -- inclusive porque o produto referenciado pode já nem existir mais.
    if coalesce(v_item->>'status', 'ativo') = 'cancelado' then
      v_validated_items := v_validated_items || v_item;
      continue;
    end if;

    v_qty := coalesce((v_item->>'quantity')::numeric, 1);
    if v_qty <= 0 or v_qty > 100000 then
      raise exception 'Quantidade inválida no item % .', v_item->>'productId';
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

    v_line_total := v_unit_price * v_qty;
    v_subtotal := v_subtotal + v_line_total;
    v_validated_items := v_validated_items || (v_item || jsonb_build_object('unitPrice', v_unit_price, 'additions', v_validated_additions));
  end loop;

  -- Pedido mínimo só se aplica a pedidos do Cardápio Online (interno ou
  -- público) — PDV/balcão e comandas de mesa não têm esse conceito.
  if p_order->>'channel' = 'online' then
    select min_order_value into v_min_order_value from company_profile where id = true;
    if v_min_order_value is not null and v_subtotal < v_min_order_value then
      raise exception 'Pedido abaixo do mínimo de R$ % (subtotal: R$ %) — venda rejeitada.', v_min_order_value, v_subtotal;
    end if;
  end if;

  v_delivery_fee := greatest(0, coalesce((p_order->>'deliveryFee')::numeric, 0));
  -- Chamador anônimo não concede desconto nem informa valor já pago.
  v_discount := case when v_is_anon then 0 else greatest(0, coalesce((p_order->>'discount')::numeric, 0)) end;
  v_discount := least(v_discount, v_subtotal);
  v_total := greatest(0, v_subtotal + v_delivery_fee - coalesce(case when v_is_anon then 0 else p_already_paid end, 0) - v_discount);

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

-- ---------------------------------------------------------------------------
-- 2. Limites de comprimento nas colunas de texto mais expostas.
--    NOT VALID: aplica a novas escritas sem revalidar linhas existentes.
-- ---------------------------------------------------------------------------
alter table products
  add constraint products_name_len       check (char_length(name) <= 120)        not valid,
  add constraint products_description_len check (char_length(description) <= 500) not valid,
  add constraint products_code_len        check (char_length(code) <= 20)         not valid,
  add constraint products_image_url_len   check (char_length(image_url) <= 2048)  not valid;

alter table categories
  add constraint categories_name_len check (char_length(name) <= 120) not valid;

alter table ingredient_categories
  add constraint ingredient_categories_name_len check (char_length(name) <= 120) not valid;

alter table ingredients
  add constraint ingredients_name_len check (char_length(name) <= 120) not valid;

alter table suppliers
  add constraint suppliers_name_len        check (char_length(name) <= 150)           not valid,
  add constraint suppliers_trade_name_len  check (char_length(trade_name) <= 150)     not valid,
  add constraint suppliers_cnpj_cpf_len    check (char_length(cnpj_cpf) <= 18)        not valid,
  add constraint suppliers_phone_len       check (char_length(phone) <= 20)           not valid,
  add constraint suppliers_email_len       check (char_length(email) <= 150)          not valid,
  add constraint suppliers_contact_len     check (char_length(contact_person) <= 120) not valid,
  add constraint suppliers_notes_len       check (notes is null or char_length(notes) <= 500) not valid;

alter table orders
  add constraint orders_notes_len check (notes is null or char_length(notes) <= 1000) not valid;

alter table profiles
  add constraint profiles_name_len  check (char_length(name) <= 120)               not valid,
  add constraint profiles_email_len check (char_length(email) <= 150)              not valid,
  add constraint profiles_phone_len check (phone is null or char_length(phone) <= 20) not valid;

alter table company_profile
  add constraint company_profile_name_len       check (char_length(name) <= 150)        not valid,
  add constraint company_profile_trade_name_len check (char_length(trade_name) <= 150)  not valid,
  add constraint company_profile_phone_len      check (char_length(phone) <= 20)        not valid,
  add constraint company_profile_whatsapp_len   check (char_length(whatsapp) <= 20)     not valid,
  add constraint company_profile_email_len      check (char_length(email) <= 150)       not valid,
  add constraint company_profile_cnpj_len       check (char_length(cnpj) <= 18)         not valid,
  add constraint company_profile_logo_url_len   check (char_length(logo_url) <= 2048)   not valid,
  add constraint company_profile_cover_url_len  check (char_length(cover_url) <= 2048)  not valid;
