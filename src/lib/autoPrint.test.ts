import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isAutoPrintDeliveryEnabled, setAutoPrintDeliveryEnabled, loadPrintedOrderIds, markOrderPrinted, claimOrderPrint } from './autoPrint';

// ===========================================================================
// Preferência é POR COMPUTADOR (localStorage), e o vitest.config.ts roda em
// ambiente "node" (sem jsdom) — então simulamos o Storage com um Map em
// memória em vez de trocar o ambiente de teste do projeto todo.
// ===========================================================================

function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => {
      data.set(k, String(v));
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
    clear: () => data.clear(),
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    get length() {
      return data.size;
    },
  } as Storage;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', createMemoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('isAutoPrintDeliveryEnabled / setAutoPrintDeliveryEnabled', () => {
  it('vem desligado por padrão', () => {
    expect(isAutoPrintDeliveryEnabled()).toBe(false);
  });

  it('liga e desliga persistindo no localStorage', () => {
    setAutoPrintDeliveryEnabled(true);
    expect(isAutoPrintDeliveryEnabled()).toBe(true);
    setAutoPrintDeliveryEnabled(false);
    expect(isAutoPrintDeliveryEnabled()).toBe(false);
  });

  it('não quebra quando o localStorage está bloqueado (ex.: aba anônima)', () => {
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    } as unknown as Storage);

    expect(isAutoPrintDeliveryEnabled()).toBe(false);
    expect(() => setAutoPrintDeliveryEnabled(true)).not.toThrow();
  });
});

describe('loadPrintedOrderIds / markOrderPrinted', () => {
  it('começa vazio', () => {
    expect(loadPrintedOrderIds()).toEqual(new Set());
  });

  it('registra pedidos impressos e não duplica na leitura seguinte', () => {
    markOrderPrinted('ord-1');
    markOrderPrinted('ord-2');
    expect(loadPrintedOrderIds()).toEqual(new Set(['ord-1', 'ord-2']));
  });

  it('mantém só os últimos 300 ids, descartando o mais antigo', () => {
    for (let i = 0; i < 300; i++) markOrderPrinted(`ord-${i}`);
    markOrderPrinted('ord-300');

    const ids = loadPrintedOrderIds();
    expect(ids.size).toBe(300);
    expect(ids.has('ord-0')).toBe(false);
    expect(ids.has('ord-300')).toBe(true);
  });

  it('JSON corrompido no localStorage não derruba a leitura', () => {
    localStorage.setItem('autoPrintDelivery:printed', '{not json');
    expect(loadPrintedOrderIds()).toEqual(new Set());
  });
});

describe('claimOrderPrint', () => {
  it('a primeira reivindicação do pedido ganha a impressão', () => {
    expect(claimOrderPrint('ord-1')).toBe(true);
  });

  it('uma segunda reivindicação do mesmo id logo em seguida perde (evita reimprimir em duas abas)', () => {
    claimOrderPrint('ord-1');
    expect(claimOrderPrint('ord-1')).toBe(false);
  });

  it('depois do TTL de 30s, o mesmo id pode ser reivindicado de novo', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    expect(claimOrderPrint('ord-1')).toBe(true);

    vi.setSystemTime(30_001);
    expect(claimOrderPrint('ord-1')).toBe(true);
  });

  it('ids de pedidos diferentes não interferem entre si', () => {
    expect(claimOrderPrint('ord-1')).toBe(true);
    expect(claimOrderPrint('ord-2')).toBe(true);
  });
});
