import { describe, it, expect } from 'vitest';
import {
  PERMISSION_CATALOG,
  ALL_PERMISSIONS,
  SCREEN_ACCESS_PERMISSION,
  HOME_VIEW_BY_ROLE,
  ROLE_DEFAULT_PERMISSIONS,
  hasPermission,
  type UserRole,
} from './permissions';

const ROLES: UserRole[] = ['admin', 'gerente', 'caixa', 'garcom', 'cozinha', 'estoque', 'financeiro'];

describe('hasPermission', () => {
  it('nega sem usuário', () => {
    expect(hasPermission(null, 'mesas.acessar')).toBe(false);
    expect(hasPermission(undefined, 'mesas.acessar')).toBe(false);
  });

  it('admin pode tudo, mesmo com lista vazia', () => {
    expect(hasPermission({ role: 'admin', permissions: [] }, 'qualquer.coisa.inexistente')).toBe(true);
  });

  it('não-admin depende da lista explícita', () => {
    const caixa = { role: 'caixa' as UserRole, permissions: ['pdv.acessar', 'caixas.abrir'] };
    expect(hasPermission(caixa, 'pdv.acessar')).toBe(true);
    expect(hasPermission(caixa, 'caixas.fechar')).toBe(false);
  });

  it('não-admin sem array de permissões nega tudo', () => {
    expect(hasPermission({ role: 'garcom' } as never, 'mesas.acessar')).toBe(false);
  });
});

describe('PERMISSION_CATALOG — integridade', () => {
  it('toda tela tem chave de acesso terminando em ".acessar"', () => {
    for (const section of PERMISSION_CATALOG) {
      for (const group of section.groups) {
        expect(group.access.endsWith('.acessar'), `${group.screenId}: ${group.access}`).toBe(true);
      }
    }
  });

  it('não há screenId duplicado', () => {
    const ids = PERMISSION_CATALOG.flatMap((s) => s.groups.map((g) => g.screenId));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('não há chave de permissão duplicada no catálogo inteiro', () => {
    const dups = ALL_PERMISSIONS.filter((k, i) => ALL_PERMISSIONS.indexOf(k) !== i);
    expect(dups).toEqual([]);
  });

  it('ALL_PERMISSIONS cobre acessos e ações conhecidas', () => {
    expect(ALL_PERMISSIONS).toContain('dashboard.acessar');
    expect(ALL_PERMISSIONS).toContain('mesas.fechar_comanda');
    expect(ALL_PERMISSIONS).toContain('caixas.estornar_venda');
    expect(ALL_PERMISSIONS).toContain('usuarios.definir_pin');
  });
});

describe('SCREEN_ACCESS_PERMISSION', () => {
  it('mapeia id da Sidebar -> chave de acesso', () => {
    expect(SCREEN_ACCESS_PERMISSION.tables).toBe('mesas.acessar');
    expect(SCREEN_ACCESS_PERMISSION.caixas).toBe('caixas.acessar');
    expect(SCREEN_ACCESS_PERMISSION['livro-caixa']).toBe('livro_caixa.acessar');
  });
  it('tem uma entrada por grupo do catálogo', () => {
    const groupCount = PERMISSION_CATALOG.reduce((n, s) => n + s.groups.length, 0);
    expect(Object.keys(SCREEN_ACCESS_PERMISSION)).toHaveLength(groupCount);
  });
});

describe('HOME_VIEW_BY_ROLE', () => {
  it('define tela inicial para todo cargo', () => {
    for (const role of ROLES) {
      expect(HOME_VIEW_BY_ROLE[role], role).toBeTruthy();
    }
  });
  it('a tela inicial de cada cargo é uma tela conhecida', () => {
    for (const role of ROLES) {
      expect(SCREEN_ACCESS_PERMISSION[HOME_VIEW_BY_ROLE[role]], `${role} -> ${HOME_VIEW_BY_ROLE[role]}`).toBeDefined();
    }
  });
});

describe('ROLE_DEFAULT_PERMISSIONS — presets por cargo', () => {
  it('admin recebe exatamente ALL_PERMISSIONS', () => {
    expect(ROLE_DEFAULT_PERMISSIONS.admin).toEqual(ALL_PERMISSIONS);
  });

  it('todo preset só contém chaves que existem no catálogo', () => {
    const known = new Set(ALL_PERMISSIONS);
    for (const role of ROLES) {
      for (const key of ROLE_DEFAULT_PERMISSIONS[role]) {
        expect(known.has(key), `${role}: ${key}`).toBe(true);
      }
    }
  });

  it('caixa NÃO pode estornar venda, reabrir caixa nem aprovar desconto acima do teto', () => {
    const caixa = ROLE_DEFAULT_PERMISSIONS.caixa;
    expect(caixa).not.toContain('caixas.estornar_venda');
    expect(caixa).not.toContain('caixas.reabrir');
    expect(caixa).not.toContain('pdv.desconto_acima_limite');
    expect(caixa).not.toContain('mesas.desconto_acima_limite');
    expect(caixa).not.toContain('mesas.remover_taxa_servico');
  });

  it('caixa mantém o operacional essencial (abrir/fechar caixa, PDV)', () => {
    const caixa = ROLE_DEFAULT_PERMISSIONS.caixa;
    expect(caixa).toContain('pdv.acessar');
    expect(caixa).toContain('pdv.finalizar_venda');
    expect(caixa).toContain('caixas.abrir');
    expect(caixa).toContain('caixas.fechar');
  });

  it('garçom não aprova desconto acima do teto nem remove taxa, e não acessa caixa/PDV', () => {
    const garcom = ROLE_DEFAULT_PERMISSIONS.garcom;
    expect(garcom).toContain('mesas.abrir_comanda');
    expect(garcom).toContain('waiter.acessar');
    expect(garcom).not.toContain('mesas.desconto_acima_limite');
    expect(garcom).not.toContain('mesas.remover_taxa_servico');
    expect(garcom).not.toContain('pdv.acessar');
    expect(garcom).not.toContain('caixas.acessar');
  });

  it('cozinha só enxerga o KDS', () => {
    expect(ROLE_DEFAULT_PERMISSIONS.cozinha).toEqual(
      expect.arrayContaining(['kitchen.acessar', 'kitchen.avancar_status']),
    );
    expect(ROLE_DEFAULT_PERMISSIONS.cozinha.every((k) => k.startsWith('kitchen.'))).toBe(true);
  });

  it('estoque não acessa telas financeiras', () => {
    const estoque = ROLE_DEFAULT_PERMISSIONS.estoque;
    expect(estoque).toContain('estoque.acessar');
    expect(estoque).not.toContain('caixas.acessar');
    expect(estoque).not.toContain('livro_caixa.acessar');
  });
});
