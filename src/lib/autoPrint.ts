// Impressão automática de cupom de pedidos de delivery.
//
// É uma preferência POR COMPUTADOR (localStorage), não por conta: ligue só na
// máquina da cozinha/expedição que fica com o sistema aberto. O conjunto de
// pedidos já impressos também mora no localStorage pra não reimprimir em
// refresh/reconexão.

const ENABLED_KEY = 'autoPrintDelivery';
const PRINTED_KEY = 'autoPrintDelivery:printed';
const CLAIM_PREFIX = 'autoPrintDelivery:claim:';
const MAX_PRINTED = 300;
const CLAIM_TTL_MS = 30_000;

export const isAutoPrintDeliveryEnabled = (): boolean => {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1';
  } catch {
    return false;
  }
};

export const setAutoPrintDeliveryEnabled = (on: boolean): void => {
  try {
    localStorage.setItem(ENABLED_KEY, on ? '1' : '0');
  } catch {
    /* localStorage indisponível — segue sem persistir */
  }
};

export const loadPrintedOrderIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(PRINTED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
};

export const markOrderPrinted = (id: string): void => {
  try {
    const ids = [...loadPrintedOrderIds(), id];
    localStorage.setItem(PRINTED_KEY, JSON.stringify(ids.slice(-MAX_PRINTED)));
  } catch {
    /* ignore */
  }
};

/**
 * Trava curta entre abas do mesmo navegador: a primeira aba a "reivindicar" o
 * pedido imprime; as outras veem a marca e desistem. Não é à prova de corrida
 * absoluta, mas a janela é de milissegundos.
 */
export const claimOrderPrint = (id: string): boolean => {
  const key = CLAIM_PREFIX + id;
  try {
    const prev = localStorage.getItem(key);
    if (prev && Date.now() - Number(prev) < CLAIM_TTL_MS) return false;
    localStorage.setItem(key, String(Date.now()));
    return true;
  } catch {
    return true;
  }
};
