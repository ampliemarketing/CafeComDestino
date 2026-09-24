// Este arquivo é importado tanto pelo frontend (Vite) quanto pela Edge Function
// admin-create-user (Deno) — por isso não importa nada de fora de src/lib/.
// O Deno exige extensão explícita em imports relativos e não resolve '../types'
// do jeito que o Vite resolve, então o tipo de cargo é duplicado aqui em vez de
// importado de '../types' (os dois devem ser mantidos iguais).
export type UserRole = 'admin' | 'gerente' | 'caixa' | 'garcom' | 'cozinha' | 'estoque' | 'financeiro';

export interface PermissionDef {
  key: string;
  label: string;
}

export interface ScreenPermissionGroup {
  screenId: string;
  screenLabel: string;
  access: string;
  actions: PermissionDef[];
}

export interface PermissionSection {
  title: string;
  groups: ScreenPermissionGroup[];
}

// Catálogo completo de permissões do sistema, organizado pelas mesmas
// seções do menu lateral (Sidebar). Cada grupo representa uma tela; o
// primeiro item de cada grupo é sempre o acesso à tela em si, seguido das
// ações específicas encontradas dentro dela.
export const PERMISSION_CATALOG: PermissionSection[] = [
  {
    title: 'Início',
    groups: [
      {
        screenId: 'dashboard',
        screenLabel: 'Dashboard',
        access: 'dashboard.acessar',
        actions: [],
      },
    ],
  },
  {
    title: 'Atendimento & Vendas',
    groups: [
      {
        // Só consulta (ver/pesquisar item) — pedir é exclusivo da rota pública
        // /pedir, então não há ação de "finalizar pedido" aqui dentro.
        screenId: 'online-menu',
        screenLabel: 'Cardápio Online',
        access: 'online_menu.acessar',
        // O botão "Restaurante Aberto/Fechado" fica na barra do topo, mas o que
        // ele controla é se o /pedir aceita pedido — por isso mora aqui.
        actions: [
          { key: 'online_menu.abrir_fechar_loja', label: 'Abrir/fechar o restaurante para pedidos online' },
        ],
      },
      {
        screenId: 'waiter',
        screenLabel: 'App do Garçom',
        access: 'waiter.acessar',
        actions: [],
      },
      {
        screenId: 'tables',
        screenLabel: 'Mesas & Comandas',
        access: 'mesas.acessar',
        actions: [
          { key: 'mesas.criar', label: 'Criar mesa' },
          { key: 'mesas.excluir', label: 'Excluir mesa' },
          { key: 'mesas.abrir_comanda', label: 'Abrir comanda' },
          { key: 'mesas.lancar_item', label: 'Lançar item na comanda' },
          { key: 'mesas.cancelar_item', label: 'Cancelar item da comanda' },
          { key: 'mesas.transferir', label: 'Transferir comanda entre mesas' },
          { key: 'mesas.cortesia', label: 'Lançar cortesia' },
          { key: 'mesas.pagamento_parcial', label: 'Lançar pagamento parcial/adiantamento' },
          { key: 'mesas.estornar_pagamento_parcial', label: 'Estornar pagamento parcial' },
          { key: 'mesas.desconto', label: 'Aplicar desconto no fechamento' },
          { key: 'mesas.desconto_acima_limite', label: 'Aprovar desconto acima do teto do cargo (com o próprio PIN)' },
          { key: 'mesas.remover_taxa_servico', label: 'Remover a taxa de serviço / couvert da comanda' },
          { key: 'mesas.fechar_comanda', label: 'Fechar comanda e receber pagamento' },
          { key: 'mesas.imprimir', label: 'Imprimir pré-conta' },
        ],
      },
      {
        screenId: 'kitchen',
        screenLabel: 'Painel da Cozinha (KDS)',
        access: 'kitchen.acessar',
        actions: [
          { key: 'kitchen.avancar_status', label: 'Avançar status do pedido' },
          { key: 'kitchen.chamar_apoio', label: 'Chamar apoio/garçom' },
        ],
      },
      {
        screenId: 'pdv',
        screenLabel: 'PDV / Frente de Caixa',
        access: 'pdv.acessar',
        actions: [
          { key: 'pdv.lancar_item_kg', label: 'Lançar item por quilo' },
          { key: 'pdv.desconto', label: 'Aplicar desconto na venda' },
          { key: 'pdv.desconto_acima_limite', label: 'Aprovar desconto acima do teto do cargo (com o próprio PIN)' },
          // NFC-e não é emitida no PDV — só manualmente pelo Módulo Fiscal.
          { key: 'pdv.finalizar_venda', label: 'Finalizar venda' },
          { key: 'pdv.imprimir', label: 'Imprimir comprovante' },
        ],
      },
      {
        screenId: 'caixas',
        screenLabel: 'Caixas',
        access: 'caixas.acessar',
        actions: [
          { key: 'caixas.abrir', label: 'Abrir caixa' },
          { key: 'caixas.movimentacao', label: 'Registrar sangria/reforço' },
          { key: 'caixas.fechar', label: 'Fechar caixa' },
          { key: 'caixas.estornar_venda', label: 'Estornar venda paga (PDV/comanda)' },
          { key: 'caixas.reabrir', label: 'Reabrir caixa fechado (para estorno)' },
          { key: 'caixas.imprimir', label: 'Imprimir relatório de fechamento' },
        ],
      },
      {
        screenId: 'livro-caixa',
        screenLabel: 'Livro-Caixa',
        access: 'livro_caixa.acessar',
        actions: [{ key: 'livro_caixa.exportar', label: 'Exportar livro-caixa (CSV)' }],
      },
      {
        screenId: 'sales',
        screenLabel: 'Gestão de Vendas',
        access: 'vendas.acessar',
        // Emissão de NFC-e e estorno PagBank moraram aqui (vendas.emitir_nfce /
        // vendas.estornar_pagbank) mas os botões ficam no Módulo Fiscal — viraram
        // fiscal.emitir_nfce / fiscal.estornar_pagbank (migration 0055).
        actions: [
          { key: 'vendas.reimprimir', label: 'Reimprimir comprovante' },
        ],
      },
    ],
  },
  {
    title: 'Produtos & Estoque',
    groups: [
      {
        screenId: 'products',
        screenLabel: 'Produtos',
        access: 'produtos.acessar',
        actions: [
          { key: 'produtos.criar', label: 'Cadastrar produto' },
          { key: 'produtos.editar', label: 'Editar produto (inclui preço)' },
          { key: 'produtos.excluir', label: 'Excluir produto' },
        ],
      },
      {
        screenId: 'inventory',
        screenLabel: 'Gestão de Estoque',
        access: 'estoque.acessar',
        actions: [
          { key: 'estoque.criar_insumo', label: 'Cadastrar insumo' },
          { key: 'estoque.editar_insumo', label: 'Editar insumo' },
          { key: 'estoque.excluir_insumo', label: 'Excluir insumo' },
          { key: 'estoque.entrada', label: 'Registrar entrada de estoque' },
          { key: 'estoque.perda', label: 'Registrar perda/descarte' },
          { key: 'estoque.cortesia', label: 'Registrar cortesia' },
        ],
      },
      {
        screenId: 'groups',
        screenLabel: 'Grupos',
        access: 'grupos.acessar',
        actions: [
          { key: 'grupos.gerenciar', label: 'Criar/editar/excluir grupos, categorias e áreas' },
        ],
      },
      {
        screenId: 'suppliers',
        screenLabel: 'Fornecedores',
        access: 'fornecedores.acessar',
        actions: [
          { key: 'fornecedores.criar', label: 'Cadastrar fornecedor' },
          { key: 'fornecedores.editar', label: 'Editar fornecedor' },
          { key: 'fornecedores.ativar_inativar', label: 'Ativar/inativar fornecedor' },
          { key: 'fornecedores.excluir', label: 'Excluir fornecedor' },
        ],
      },
    ],
  },
  {
    title: 'Operacional & Gestão',
    groups: [
      {
        screenId: 'deliveries',
        screenLabel: 'Gestão de Entregas',
        access: 'entregas.acessar',
        actions: [{ key: 'entregas.despachar', label: 'Despachar pedido para entrega' }],
      },
      {
        screenId: 'fiscal',
        screenLabel: 'Emissão Fiscal NFC-e',
        access: 'fiscal.acessar',
        actions: [
          { key: 'fiscal.emitir_nfce', label: 'Emitir / reenviar NFC-e de um pedido' },
          { key: 'fiscal.baixar_xml', label: 'Baixar XML de nota fiscal' },
          { key: 'fiscal.estornar_pagbank', label: 'Estornar pagamento PagBank (Pix/cartão) de nota autorizada' },
          { key: 'fiscal.grupos_tributarios', label: 'Criar/editar/excluir grupos tributários' },
          { key: 'fiscal.editar_dados_empresa', label: 'Editar dados fiscais da empresa (CNPJ, IE, ambiente SEFAZ)' },
        ],
      },
      {
        screenId: 'printers',
        screenLabel: 'Impressoras Térmicas',
        access: 'impressoras.acessar',
        actions: [],
      },
      {
        screenId: 'reports',
        screenLabel: 'Relatórios Gerenciais',
        access: 'relatorios.acessar',
        actions: [{ key: 'relatorios.exportar', label: 'Exportar relatórios' }],
      },
      {
        screenId: 'company',
        screenLabel: 'Perfil da Empresa',
        access: 'empresa.acessar',
        actions: [
          { key: 'empresa.editar_perfil', label: 'Editar perfil do restaurante' },
          { key: 'empresa.editar_midia', label: 'Alterar logo/capa do cardápio online' },
          { key: 'empresa.editar_precos_buffet', label: 'Editar preços do buffet/quilo' },
          { key: 'empresa.editar_regras_caixa', label: 'Editar regras de caixa (taxa de serviço, couvert, teto de desconto, diferença de fechamento)' },
        ],
      },
    ],
  },
  {
    title: 'Administração',
    groups: [
      {
        screenId: 'users',
        screenLabel: 'Usuários & Permissões',
        access: 'usuarios.acessar',
        actions: [
          { key: 'usuarios.criar', label: 'Criar novo usuário' },
          { key: 'usuarios.editar_permissoes', label: 'Alterar cargo/permissões de usuário' },
          { key: 'usuarios.ativar_inativar', label: 'Ativar/inativar usuário' },
          { key: 'usuarios.definir_pin', label: 'Definir PIN de fechamento de caixa' },
        ],
      },
      {
        screenId: 'audit',
        screenLabel: 'Auditoria',
        access: 'auditoria.acessar',
        actions: [],
      },
    ],
  },
];

export const ALL_PERMISSIONS: string[] = PERMISSION_CATALOG.flatMap((section) =>
  section.groups.flatMap((group) => [group.access, ...group.actions.map((a) => a.key)])
);

// Mapa tela (id da Sidebar) -> chave de acesso, usado pela Sidebar para
// decidir quais itens de menu mostrar.
export const SCREEN_ACCESS_PERMISSION: Record<string, string> = Object.fromEntries(
  PERMISSION_CATALOG.flatMap((section) => section.groups.map((group) => [group.screenId, group.access]))
);

// Tela inicial por cargo pós-login (item #17). Evita que todo mundo caia no
// Dashboard — que puxa o chunk de gráficos (~380 KB) — quando o operacional
// (garçom, cozinha, caixa) vai direto pra outra tela. Se o cargo não tiver
// acesso à tela sugerida, o App cai no fluxo padrão de "primeira tela
// permitida".
export const HOME_VIEW_BY_ROLE: Record<UserRole, string> = {
  admin: 'dashboard',
  gerente: 'dashboard',
  financeiro: 'dashboard',
  caixa: 'pdv',
  garcom: 'waiter',
  cozinha: 'kitchen',
  estoque: 'inventory',
};

// Presets aplicados quando um cargo é escolhido no formulário de usuário —
// só um ponto de partida editável, quem decide o acesso de verdade é a
// lista `permissions` gravada no usuário (exceto admin, que sempre tem tudo).
const screenPermissions = (screenIds: string[]): string[] =>
  PERMISSION_CATALOG.flatMap((section) =>
    section.groups
      .filter((group) => screenIds.includes(group.screenId))
      .flatMap((group) => [group.access, ...group.actions.map((a) => a.key)])
  );

const without = (keys: string[], excluded: string[]) => keys.filter((k) => !excluded.includes(k));

// Configuração fiscal sensível (CNPJ/ambiente SEFAZ, grupos tributários) —
// fica fora dos presets operacionais; admin/gerente liberam caso a caso.
const FISCAL_CONFIG_KEYS = ['fiscal.editar_dados_empresa', 'fiscal.grupos_tributarios'];

export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ALL_PERMISSIONS,
  // Gerente cria/edita usuários, mas definir PIN (credencial de aprovação)
  // continua só com quem o admin liberar.
  gerente: without(screenPermissions([
    'dashboard', 'online-menu', 'waiter', 'tables', 'kitchen', 'pdv', 'caixas', 'livro-caixa', 'sales',
    'products', 'inventory', 'groups', 'suppliers',
    'deliveries', 'fiscal', 'printers', 'reports', 'users', 'audit',
  ]), ['usuarios.definir_pin']),
  caixa: without(screenPermissions(['online-menu', 'tables', 'pdv', 'caixas', 'livro-caixa', 'sales', 'deliveries', 'fiscal']), [
    'caixas.estornar_venda', 'caixas.reabrir',
    'pdv.desconto_acima_limite', 'mesas.desconto_acima_limite', 'mesas.remover_taxa_servico',
    'fiscal.estornar_pagbank', ...FISCAL_CONFIG_KEYS,
  ]),
  garcom: without(screenPermissions(['online-menu', 'waiter', 'tables']), [
    'mesas.desconto_acima_limite', 'mesas.remover_taxa_servico', 'online_menu.abrir_fechar_loja',
  ]),
  cozinha: screenPermissions(['kitchen']),
  estoque: screenPermissions(['products', 'inventory', 'groups', 'suppliers']),
  financeiro: without(screenPermissions(['dashboard', 'caixas', 'livro-caixa', 'sales', 'reports', 'fiscal']), FISCAL_CONFIG_KEYS),
};

export function hasPermission(user: { role: UserRole; permissions?: string[] } | null | undefined, key: string): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return !!user.permissions?.includes(key);
}

// Quem não é admin só concede permissões que ele mesmo tem, e nunca o cargo
// admin — mesma regra do servidor (trigger prevent_self_privilege_escalation e
// Edge Function admin-create-user, migration 0055).
export const canGrantPermission = hasPermission;

export function grantableRoles(user: { role: UserRole } | null | undefined, roles: UserRole[]): UserRole[] {
  return user?.role === 'admin' ? roles : roles.filter((r) => r !== 'admin');
}
