-- Adiciona CPF e permissões granulares por usuário. As chaves de permissão
-- espelham o catálogo em src/lib/permissions.ts — mudanças em um lado devem
-- ser refletidas no outro.
alter table profiles add column if not exists cpf text;
alter table profiles add column if not exists permissions text[] not null default '{}';

-- Backfill: cada usuário existente recebe o conjunto de permissões
-- equivalente ao acesso que seu cargo já tinha antes desta migration (o
-- antigo controle era só por tela, via Sidebar). Assim ninguém perde acesso
-- na hora que essa coluna passa a valer.
update profiles set permissions = case role
  when 'admin' then array[
    'dashboard.acessar',
    'online_menu.acessar','online_menu.finalizar_pedido',
    'waiter.acessar',
    'mesas.acessar','mesas.criar','mesas.excluir','mesas.abrir_comanda','mesas.lancar_item','mesas.cancelar_item','mesas.transferir','mesas.cortesia','mesas.pagamento_parcial','mesas.estornar_pagamento_parcial','mesas.desconto','mesas.fechar_comanda','mesas.imprimir',
    'kitchen.acessar','kitchen.avancar_status','kitchen.chamar_apoio',
    'pdv.acessar','pdv.lancar_item_kg','pdv.desconto','pdv.finalizar_venda','pdv.imprimir',
    'caixas.acessar','caixas.abrir','caixas.movimentacao','caixas.fechar','caixas.imprimir',
    'vendas.acessar','vendas.emitir_nfce','vendas.reimprimir',
    'produtos.acessar','produtos.criar','produtos.editar','produtos.excluir',
    'estoque.acessar','estoque.criar_insumo','estoque.editar_insumo','estoque.excluir_insumo','estoque.entrada','estoque.perda','estoque.cortesia',
    'grupos.acessar','grupos.gerenciar',
    'fornecedores.acessar','fornecedores.criar','fornecedores.editar','fornecedores.ativar_inativar','fornecedores.excluir',
    'entregas.acessar','entregas.despachar',
    'fiscal.acessar','fiscal.baixar_xml','fiscal.editar_dados_empresa',
    'financeiro_dre.acessar','financeiro_dre.lancar',
    'impressoras.acessar',
    'relatorios.acessar','relatorios.exportar',
    'empresa.acessar','empresa.editar_perfil','empresa.editar_midia','empresa.editar_precos_buffet',
    'usuarios.acessar','usuarios.criar','usuarios.editar_permissoes','usuarios.ativar_inativar','usuarios.definir_pin'
  ]
  when 'gerente' then array[
    'dashboard.acessar',
    'online_menu.acessar','online_menu.finalizar_pedido',
    'waiter.acessar',
    'mesas.acessar','mesas.criar','mesas.excluir','mesas.abrir_comanda','mesas.lancar_item','mesas.cancelar_item','mesas.transferir','mesas.cortesia','mesas.pagamento_parcial','mesas.estornar_pagamento_parcial','mesas.desconto','mesas.fechar_comanda','mesas.imprimir',
    'kitchen.acessar','kitchen.avancar_status','kitchen.chamar_apoio',
    'pdv.acessar','pdv.lancar_item_kg','pdv.desconto','pdv.finalizar_venda','pdv.imprimir',
    'caixas.acessar','caixas.abrir','caixas.movimentacao','caixas.fechar','caixas.imprimir',
    'vendas.acessar','vendas.emitir_nfce','vendas.reimprimir',
    'produtos.acessar','produtos.criar','produtos.editar','produtos.excluir',
    'estoque.acessar','estoque.criar_insumo','estoque.editar_insumo','estoque.excluir_insumo','estoque.entrada','estoque.perda','estoque.cortesia',
    'grupos.acessar','grupos.gerenciar',
    'fornecedores.acessar','fornecedores.criar','fornecedores.editar','fornecedores.ativar_inativar','fornecedores.excluir',
    'entregas.acessar','entregas.despachar',
    'fiscal.acessar','fiscal.baixar_xml','fiscal.editar_dados_empresa',
    'financeiro_dre.acessar','financeiro_dre.lancar',
    'impressoras.acessar',
    'relatorios.acessar','relatorios.exportar'
  ]
  when 'caixa' then array[
    'online_menu.acessar','online_menu.finalizar_pedido',
    'mesas.acessar','mesas.criar','mesas.excluir','mesas.abrir_comanda','mesas.lancar_item','mesas.cancelar_item','mesas.transferir','mesas.cortesia','mesas.pagamento_parcial','mesas.estornar_pagamento_parcial','mesas.desconto','mesas.fechar_comanda','mesas.imprimir',
    'pdv.acessar','pdv.lancar_item_kg','pdv.desconto','pdv.finalizar_venda','pdv.imprimir',
    'caixas.acessar','caixas.abrir','caixas.movimentacao','caixas.fechar','caixas.imprimir',
    'vendas.acessar','vendas.emitir_nfce','vendas.reimprimir',
    'entregas.acessar','entregas.despachar',
    'fiscal.acessar','fiscal.baixar_xml','fiscal.editar_dados_empresa'
  ]
  when 'garcom' then array[
    'online_menu.acessar','online_menu.finalizar_pedido',
    'waiter.acessar',
    'mesas.acessar','mesas.criar','mesas.excluir','mesas.abrir_comanda','mesas.lancar_item','mesas.cancelar_item','mesas.transferir','mesas.cortesia','mesas.pagamento_parcial','mesas.estornar_pagamento_parcial','mesas.desconto','mesas.fechar_comanda','mesas.imprimir'
  ]
  when 'cozinha' then array[
    'kitchen.acessar','kitchen.avancar_status','kitchen.chamar_apoio'
  ]
  when 'estoque' then array[
    'produtos.acessar','produtos.criar','produtos.editar','produtos.excluir',
    'estoque.acessar','estoque.criar_insumo','estoque.editar_insumo','estoque.excluir_insumo','estoque.entrada','estoque.perda','estoque.cortesia',
    'grupos.acessar','grupos.gerenciar',
    'fornecedores.acessar','fornecedores.criar','fornecedores.editar','fornecedores.ativar_inativar','fornecedores.excluir'
  ]
  when 'financeiro' then array[
    'dashboard.acessar',
    'caixas.acessar','caixas.abrir','caixas.movimentacao','caixas.fechar','caixas.imprimir',
    'vendas.acessar','vendas.emitir_nfce','vendas.reimprimir',
    'relatorios.acessar','relatorios.exportar',
    'fiscal.acessar','fiscal.baixar_xml','fiscal.editar_dados_empresa',
    'financeiro_dre.acessar','financeiro_dre.lancar'
  ]
  else '{}'
end
where permissions = '{}';

-- Estende o trigger de proteção (criado na migration 0014) para cobrir a
-- nova coluna permissions com a mesma regra: só admin pode alterá-la.
create or replace function public.prevent_self_privilege_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (new.role is distinct from old.role
      or new.active is distinct from old.active
      or new.code is distinct from old.code
      or new.permissions is distinct from old.permissions)
     and auth.uid() is not null
     and not exists (
       select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
     )
  then
    raise exception 'Apenas administradores podem alterar cargo, status ativo, PIN ou permissões de um usuário.';
  end if;
  return new;
end;
$$;
