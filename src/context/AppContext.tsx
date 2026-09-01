import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { rowToCamel, toRow } from '../lib/caseMapping';
import { hasPermission } from '../lib/permissions';
import { comandaServiceFee, comandaCouvert } from '../lib/serviceFee';
import { LoginScreen } from '../components/auth/LoginScreen';
import {
  User,
  CompanyProfileData,
  Category,
  IngredientCategory,
  TableSector,
  SaleUnit,
  Product,
  Ingredient,
  DiningTable,
  Comanda,
  TableStatus,
  Order,
  OrderStatus,
  PaymentStatus,
  CashShift,
  CashMovement,
  FinancialEntry,
  Supplier,
  LossRecord,
  LossReason,
  CourtesyRecord,
  CourtesyReason,
  PartialPayment,
  Printer,
  DeliveryDriver,
  AuditLog,
  TableItem,
  OrderItem,
  PaymentMethod
} from '../types';

import {
  initialCompanyProfile,
  initialAuditLogs
} from '../data/initialData';


const formatTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';

// ID de pedido que não colide mesmo com vários terminais vendendo no mesmo
// milissegundo — timestamp + sufixo aleatório (mesmo padrão já usado para
// comandas `cmd-` e itens `item-`). O `orderNumber` sequencial, esse sim, é
// atribuído pelo servidor nas RPCs (migration 0036).
const newOrderId = () => 'ord-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);

// O `order_number` real é atribuído pelo servidor (sequence + trigger, migration
// 0036). O valor calculado no cliente é só um palpite otimista; após a venda
// buscamos o definitivo para recibo e tela de confirmação baterem com o banco.
async function fetchServerOrderNumber(orderId: string, fallback: number): Promise<number> {
  const { data } = await supabase.from('orders').select('order_number').eq('id', orderId).single();
  return (data as { order_number?: number } | null)?.order_number ?? fallback;
}

const mapCategory = (row: any): Category => rowToCamel<Category>(row);
const mapIngredientCategory = (row: any): IngredientCategory => rowToCamel<IngredientCategory>(row);
const mapSupplier = (row: any): Supplier => {
  const base = rowToCamel<Supplier>(row);
  return { ...base, suppliedCategories: base.suppliedCategories || [] };
};
const mapTableSector = (row: any): TableSector => rowToCamel<TableSector>(row);
const mapSaleUnit = (row: any): SaleUnit => rowToCamel<SaleUnit>(row);
const mapIngredient = (row: any): Ingredient => rowToCamel<Ingredient>(row);
const mapProduct = (row: any): Product => rowToCamel<Product>(row);
const mapDiningTable = (row: any): DiningTable => {
  const base = rowToCamel<DiningTable>(row);
  return { ...base, comandas: base.comandas || [] };
};
const mapCashShiftRow = (row: any): CashShift => rowToCamel<CashShift>(row);
const mapCashMovementRow = (row: any): CashMovement => rowToCamel<CashMovement>(row);
const mapFinancialEntryRow = (row: any): FinancialEntry => rowToCamel<FinancialEntry>(row);
const mapLossRow = (row: any): LossRecord => rowToCamel<LossRecord>(row);
const mapCourtesyRow = (row: any): CourtesyRecord => rowToCamel<CourtesyRecord>(row);
const mapPrinterRow = (row: any): Printer => rowToCamel<Printer>(row);
const mapDeliveryDriverRow = (row: any): DeliveryDriver => rowToCamel<DeliveryDriver>(row);
const mapAuditRow = (row: any): AuditLog => ({
  id: row.id,
  userName: row.actor_name || 'Sistema',
  userRole: row.actor_role || '',
  action: row.action,
  module: row.module || '',
  timestamp: row.created_at ? new Date(row.created_at).toLocaleString('pt-BR') : '',
  details: row.details && typeof row.details === 'object' && 'text' in row.details ? row.details.text : row.details,
  actorId: row.actor_id || undefined,
  entityType: row.entity_type || undefined,
  entityId: row.entity_id || undefined,
  amountBefore: row.amount_before ?? undefined,
  amountAfter: row.amount_after ?? undefined,
  createdAt: row.created_at || undefined,
});
const mapProfileRow = (row: any): User => rowToCamel<User>(row);

const mapOrderRow = (row: any): Order => {
  const base = rowToCamel<Order>(row);
  return {
    ...base,
    createdAt: formatTime(row.created_at),
    createdAtISO: row.created_at || undefined,
    updatedAt: formatTime(row.updated_at),
  };
};

function computeTableStatus(comandas: Comanda[]): TableStatus {
  return comandas.length === 0 ? 'livre' : 'ocupada';
}

const EMPTY_CASH_SHIFT: CashShift = {
  id: '',
  openedBy: '',
  openedAt: '',
  initialFloat: 0,
  status: 'fechado',
  salesCash: 0,
  salesCard: 0,
  salesCredit: 0,
  salesDebit: 0,
  salesPix: 0,
  salesMealVoucher: 0,
  salesOther: 0,
  additions: 0,
  withdrawals: 0,
  expectedTotal: 0,
};

// ----------------------------------------------------------------------------
// Generic "core" collection: fetches once, then stays in sync via Supabase
// Realtime. Writes go straight to Supabase — the subscription below is what
// actually updates local state (including for the client that wrote it).
// ----------------------------------------------------------------------------
function useSupabaseCollection<T>(
  table: string,
  session: Session | null,
  mapRow: (row: any) => T,
  keyField: keyof T,
  orderColumn?: string,
  limit?: number,
  // Muda de valor quando a conexão volta — força re-buscar a coleção, já que o
  // realtime não reenvia os eventos perdidos enquanto esteve offline.
  refreshNonce = 0
): [T[], React.Dispatch<React.SetStateAction<T[]>>] {
  const [items, setItems] = useState<T[]>([]);

  useEffect(() => {
    if (!session) {
      setItems([]);
      return;
    }
    let cancelled = false;

    const fetchNow = () => {
      let query = supabase.from(table).select('*');
      if (orderColumn) query = query.order(orderColumn, { ascending: false });
      // Coleções que crescem sem parar (pedidos, turnos de caixa) são limitadas
      // às linhas mais recentes — carregar o histórico inteiro no login trava o app.
      if (limit) query = query.limit(limit);
      query.then(({ data, error }) => {
        if (cancelled || error || !data) return;
        setItems(data.map(mapRow));
      });
    };

    fetchNow();

    let subscribedOnce = false;
    const channel = supabase
      .channel(`public:${table}:${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        setItems((prev) => {
          if (payload.eventType === 'DELETE') {
            const oldKey = (payload.old as any)[keyField as string];
            return prev.filter((it) => (it as any)[keyField] !== oldKey);
          }
          const row = mapRow(payload.new);
          const rowKey = (row as any)[keyField];
          const exists = prev.some((it) => (it as any)[keyField] === rowKey);
          if (exists) {
            return prev.map((it) => ((it as any)[keyField] === rowKey ? row : it));
          }
          // Coleções com `limit` (ex.: orders, cash_shifts) não podem crescer sem
          // parar durante a sessão — o insert via realtime respeita o mesmo teto
          // do fetch inicial, descartando as linhas mais antigas.
          const next = [row, ...prev];
          return limit && next.length > limit ? next.slice(0, limit) : next;
        });
      })
      .subscribe((status) => {
        // Toda vez que o canal (RE)assina — inclusive depois de cair e voltar,
        // ou de a aba ser reativada — re-busca a coleção inteira. Sem isso, um
        // evento de realtime perdido durante a queda fica pra sempre fora do
        // estado local (foi o que deixou o `sales_cash` do caixa desatualizado).
        if (status === 'SUBSCRIBED') {
          if (subscribedOnce) fetchNow();
          subscribedOnce = true;
        }
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [table, session?.user?.id, orderColumn, limit, refreshNonce]);

  return [items, setItems];
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  timestamp: string;
}

interface AppContextType {
  currentUser: User;
  companyProfile: CompanyProfileData;
  setCompanyProfile: (profile: CompanyProfileData) => void;
  users: User[];
  updateUserProfile: (userId: string, patch: Partial<Pick<User, 'role' | 'active' | 'code' | 'phone' | 'name' | 'cpf' | 'permissions'>>) => Promise<void>;
  createUser: (input: { name: string; email: string; password: string; role: User['role']; phone?: string; code?: string; cpf?: string; permissions: string[] }) => Promise<{ error?: string }>;
  categories: Category[];
  ingredientCategories: IngredientCategory[];
  tableSectors: TableSector[];
  saleUnits: SaleUnit[];
  products: Product[];
  ingredients: Ingredient[];
  tables: DiningTable[];
  orders: Order[];
  cashShift: CashShift;
  cashShiftsHistory: CashShift[];
  cashMovements: CashMovement[];
  financialEntries: FinancialEntry[];
  suppliers: Supplier[];
  saveSupplier: (supplier: Supplier) => Promise<void>;
  deleteSupplier: (supplierId: string) => Promise<void>;
  lossRecords: LossRecord[];
  courtesyRecords: CourtesyRecord[];
  printers: Printer[];
  setPrinters: React.Dispatch<React.SetStateAction<Printer[]>>;
  deliveryDrivers: DeliveryDriver[];
  setDeliveryDrivers: React.Dispatch<React.SetStateAction<DeliveryDriver[]>>;
  auditLogs: AuditLog[];
  toasts: Toast[];
  connectionOnline: boolean;

  // Navigation
  activeView: string;
  setActiveView: (view: string) => void;
  selectedCashShiftId: string | null;
  setSelectedCashShiftId: (id: string | null) => void;

  // Toast
  addToast: (type: Toast['type'], title: string, message?: string) => void;
  removeToast: (id: string) => void;

  // Actions
  logAudit: (action: string, moduleName: string, details?: string) => void;
  logout: () => Promise<void>;
  createTable: (number: number, sector: DiningTable['sector'], capacity: number) => Promise<void>;
  deleteTable: (tableId: string) => Promise<void>;
  openComanda: (tableId: string, personName: string, guestCount?: number) => Promise<Comanda | null>;
  openComandas: (tableId: string, personNames: string[]) => Promise<Comanda[]>;
  addComandaItem: (tableId: string, comandaId: string, productId: string, quantity: number, additions?: any[], notes?: string, unitPriceOverride?: number) => Promise<void>;
  cancelComandaItem: (tableId: string, comandaId: string, itemId: string, reason: string) => Promise<void>;
  setComandaCharge: (tableId: string, comandaId: string, charge: 'serviceFee' | 'couvert', applied: boolean, reason?: string) => Promise<void>;
  setComandaCouvertQty: (tableId: string, comandaId: string, qty: number) => Promise<void>;
  transferComanda: (fromTableId: string, comandaId: string, toTableId: string) => Promise<void>;
  closeComandaAndPay: (tableId: string, comandaId: string, paymentMethod: PaymentMethod, discount?: number, splitPayments?: { method: PaymentMethod; amount: number }[], discountReason?: string, managerPin?: string) => Promise<Order | null>;
  addPartialPayment: (
    tableId: string,
    comandaId: string,
    paymentData: {
      amount: number;
      serviceFeePortion?: number;
      couvertPortion?: number;
      paymentMethod: PaymentMethod | string;
      type: 'by_item' | 'by_amount';
      itemIdsPaid?: string[];
      customerName?: string;
      notes?: string;
      splitPayments?: { method: PaymentMethod; amount: number }[];
    }
  ) => Promise<PartialPayment | null>;
  cancelPartialPayment: (tableId: string, comandaId: string, paymentId: string, reason: string) => Promise<void>;

  updateOrderStatus: (orderId: string, status: OrderStatus, driverName?: string) => Promise<void>;
  updatePaymentStatus: (orderId: string, status: PaymentStatus) => Promise<void>;

  createOnlineOrder: (orderData: Partial<Order>) => Promise<Order>;
  createPdvSale: (items: OrderItem[], paymentMethod: PaymentMethod, serviceType: Order['serviceType'], customerName?: string, discount?: number, splitPayments?: { method: PaymentMethod; amount: number }[], discountReason?: string, managerPin?: string) => Promise<Order | null>;

  reversePaidOrder: (orderId: string, reason: string, managerPin: string) => Promise<boolean>;
  validateManagerPin: (pin: string) => Promise<boolean>;
  validateOwnPin: (pin: string) => Promise<boolean>;
  recordCashExpense: (entry: { description: string; category?: string; amount: number }) => Promise<boolean>;

  openCashShift: (initialFloat: number) => Promise<string | null>;
  closeCashShift: (payload: {
    conferredCash: number;
    // formas eletrônicas: null = não conferido (conferência opcional)
    conferredCredit: number | null;
    conferredDebit: number | null;
    conferredPix: number | null;
    conferredMealVoucher: number | null;
    conferredOther: number | null;
    notes?: string;
  }) => Promise<void>;
  addCashMovement: (type: 'reforco' | 'sangria', amount: number, name: string, reason: string) => Promise<void>;

  saveCategory: (category: Category) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  saveIngredientCategory: (category: IngredientCategory) => Promise<void>;
  deleteIngredientCategory: (categoryId: string) => Promise<void>;
  saveTableSector: (sector: TableSector) => Promise<void>;
  deleteTableSector: (sectorId: string) => Promise<void>;
  saveSaleUnit: (saleUnit: SaleUnit) => Promise<void>;
  saveProduct: (product: Product) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;

  saveIngredient: (ingredient: Ingredient) => Promise<void>;
  deleteIngredient: (ingredientId: string) => Promise<void>;
  recordStockEntry: (ingredientId: string, qty: number, costUnit: number) => Promise<void>;
  recordProductStockEntry: (productId: string, qty: number) => Promise<void>;
  recordLoss: (data: {
    itemType: 'product' | 'ingredient';
    itemId?: string;
    itemName: string;
    quantity: number;
    unit: string;
    costValue: number;
    reason: LossReason;
    notes?: string;
    employeeName?: string;
    sector?: string;
  }) => Promise<void>;
  recordCourtesy: (data: {
    productId: string;
    quantity: number;
    reason: CourtesyReason;
    source: CourtesyRecord['source'];
    targetReference?: string;
    customerName?: string;
    authorizedBy: string;
    notes?: string;
    tableId?: string;
    comandaId?: string;
  }) => Promise<void>;

  issueNfce: (orderId: string) => Promise<string>;
  dispatchWhatsApp: (orderId: string, driverName: string) => Promise<string>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // ---- Auth ----
  const [session, setSession] = useState<Session | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authBanner, setAuthBanner] = useState<string | null>(null);

  // ---- Saúde da conexão (item #10) ----
  const [connectionOnline, setConnectionOnline] = useState(true);
  // Muda quando a conexão volta; passado às coleções operacionais para forçar
  // re-busca (o realtime não reenvia eventos perdidos durante o offline).
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    let offline = false;
    const goOffline = () => { offline = true; setConnectionOnline(false); };
    const goOnline = () => {
      setConnectionOnline(true);
      if (offline) { offline = false; setRefreshNonce((n) => n + 1); }
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    // Aba reativada (voltou de segundo plano / outra janela): re-valida as
    // coleções. Enquanto a aba fica em segundo plano o navegador estrangula o
    // WebSocket e eventos de realtime se perdem sem cair a conexão — foi o que
    // deixou o `sales_cash` do caixa preso num valor velho até dar Ctrl+Shift+R.
    let lastFocusRefresh = 0;
    const revalidateOnFocus = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastFocusRefresh < 8000) return; // não repete em rajada
      lastFocusRefresh = now;
      setRefreshNonce((n) => n + 1);
    };
    document.addEventListener('visibilitychange', revalidateOnFocus);
    window.addEventListener('focus', revalidateOnFocus);

    // Canal dedicado só pra medir a conexão com o Supabase (o navegador dizer
    // "online" não garante que o servidor está alcançável).
    const heartbeat = supabase
      .channel('connection-heartbeat')
      .on('broadcast', { event: 'ping' }, () => {})
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') goOnline();
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') goOffline();
      });

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      document.removeEventListener('visibilitychange', revalidateOnFocus);
      window.removeEventListener('focus', revalidateOnFocus);
      supabase.removeChannel(heartbeat);
    };
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionChecked(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setSessionChecked(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setCurrentUser(null);
      setAuthLoading(false);
      return;
    }
    let cancelled = false;
    setAuthLoading(true);
    supabase
      .from('profiles')
      // `code` (PIN) foi revogado do cliente na migration 0028 — nunca selecionar.
      .select('id, name, email, role, phone, active, cpf, permissions')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        if (data && data.active === false) {
          setCurrentUser(null);
          setAuthLoading(false);
          setAuthBanner('Sua conta foi desativada. Fale com um administrador.');
          supabase.auth.signOut();
          return;
        }
        setAuthBanner(null);
        setCurrentUser(data ? mapProfileRow(data) : null);
        setAuthLoading(false);
      });
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const logout = async () => {
    await supabase.auth.signOut();
  };

  // ---- Company Profile (Supabase-backed singleton row `company_profile`,
  // readable publicly — the public online catalog in PublicOnlineMenu.tsx
  // needs it without a session) ----
  const [companyProfile, setCompanyProfileState] = useState<CompanyProfileData>(initialCompanyProfile);

  useEffect(() => {
    supabase.from('company_profile').select('*').eq('id', true).single().then(({ data }) => {
      if (data) setCompanyProfileState(rowToCamel<CompanyProfileData>(data));
    });
  }, []);

  const setCompanyProfile = (profile: CompanyProfileData) => {
    setCompanyProfileState(profile);
    supabase.from('company_profile').update(toRow(profile)).eq('id', true).then(({ error }) => {
      if (error) addToast('error', 'Erro ao salvar perfil da empresa', error.message);
    });
  };

  // Perdas, cortesias, impressoras e entregadores agora vêm do Supabase com
  // realtime (migration 0038) — antes eram localStorage / memória e não
  // sincronizavam entre terminais.
  const [lossRecords] = useSupabaseCollection<LossRecord>('loss_records', session, mapLossRow, 'id', 'created_at', 500);
  const [courtesyRecords] = useSupabaseCollection<CourtesyRecord>('courtesy_records', session, mapCourtesyRow, 'id', 'created_at', 500);
  const [printers, setPrinters] = useSupabaseCollection<Printer>('printers', session, mapPrinterRow, 'id');
  const [deliveryDrivers, setDeliveryDrivers] = useSupabaseCollection<DeliveryDriver>('delivery_drivers', session, mapDeliveryDriverRow, 'id');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(initialAuditLogs);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [selectedCashShiftId, setSelectedCashShiftId] = useState<string | null>(null);

  // ---- Core data (Supabase) ----
  const [categories] = useSupabaseCollection<Category>('categories', session, mapCategory, 'id');
  const [ingredientCategories] = useSupabaseCollection<IngredientCategory>('ingredient_categories', session, mapIngredientCategory, 'id');
  const [suppliers] = useSupabaseCollection<Supplier>('suppliers', session, mapSupplier, 'id');
  const [tableSectors] = useSupabaseCollection<TableSector>('table_sectors', session, mapTableSector, 'id');
  const [saleUnits] = useSupabaseCollection<SaleUnit>('sale_units', session, mapSaleUnit, 'id');
  // As coleções operacionais recebem refreshNonce: ao reconectar, re-buscam do
  // servidor pra recuperar o que mudou durante o offline.
  const [ingredients] = useSupabaseCollection<Ingredient>('ingredients', session, mapIngredient, 'id', undefined, undefined, refreshNonce);
  const [products] = useSupabaseCollection<Product>('products', session, mapProduct, 'id', undefined, undefined, refreshNonce);
  const [tables] = useSupabaseCollection<DiningTable>('dining_tables', session, mapDiningTable, 'id', undefined, undefined, refreshNonce);
  // Últimos 1000 pedidos: cobre com folga dashboard, vendas e caixa do dia a dia.
  // Relatórios que precisem de janelas maiores devem fazer query própria com filtro de data.
  const [orders] = useSupabaseCollection<Order>('orders', session, mapOrderRow, 'id', 'created_at', 1000, refreshNonce);

  const [users, setUsers] = useState<User[]>([]);
  const refreshUsers = () => {
    if (!session) { setUsers([]); return; }
    supabase.from('profiles')
      .select('id, name, email, role, phone, active, cpf, permissions')
      .then(({ data }) => {
        if (data) setUsers(data.map(mapProfileRow));
      });
  };
  useEffect(refreshUsers, [session?.user?.id]);

  // Realtime em profiles (migration 0040): mudança de cargo/permissão/ativação
  // feita por um admin vale na hora, sem o usuário precisar recarregar a aba.
  useEffect(() => {
    if (!session) return;
    const uid = session.user.id;
    const channel = supabase
      .channel(`public:profiles:${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        refreshUsers(); // mantém a tela Usuários & Equipe em dia
        const row = payload.new as Record<string, any> | null;
        if (!row || row.id !== uid) return;
        if (row.active === false) {
          setCurrentUser(null);
          setAuthBanner('Sua conta foi desativada. Fale com um administrador.');
          supabase.auth.signOut();
          return;
        }
        // Aplica cargo/permissões/dados novos no usuário logado imediatamente.
        setCurrentUser((prev) => (prev ? { ...prev, ...mapProfileRow(row) } : prev));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const updateUserProfile: AppContextType['updateUserProfile'] = async (userId, patch) => {
    const { error } = await supabase.from('profiles').update(toRow(patch)).eq('id', userId);
    if (error) { addToast('error', 'Erro ao atualizar usuário', error.message); return; }
    refreshUsers();
    if (currentUser && userId === currentUser.id) {
      setCurrentUser((prev) => (prev ? { ...prev, ...patch } : prev));
    }
    addToast('success', 'Usuário atualizado');
  };

  const createUser: AppContextType['createUser'] = async ({ name, email, password, role, phone, code, cpf, permissions }) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return { error: 'Sessão expirada. Faça login novamente.' };

    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: { name, email, password, role, phone, code, cpf, permissions },
      headers: { Authorization: `Bearer ${token}` },
    });

    if (error) return { error: error.message };
    if (data?.error) return { error: data.error };

    refreshUsers();
    addToast('success', 'Usuário criado');
    return {};
  };

  const [cashShiftsHistory] = useSupabaseCollection<CashShift>('cash_shifts', session, mapCashShiftRow, 'id', 'created_at', 200, refreshNonce);

  const cashShift = cashShiftsHistory.find((s) => s.status === 'aberto') ?? cashShiftsHistory[0] ?? EMPTY_CASH_SHIFT;

  const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);

  useEffect(() => {
    if (!session || !cashShift.id) { setCashMovements([]); return; }
    let cancelled = false;
    supabase.from('cash_movements').select('*').eq('shift_id', cashShift.id).order('timestamp')
      .then(({ data }) => { if (!cancelled && data) setCashMovements(data.map(mapCashMovementRow)); });

    const channel = supabase
      .channel(`public:cash_movements:${cashShift.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_movements', filter: `shift_id=eq.${cashShift.id}` }, (payload) => {
        setCashMovements((prev) => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as any).id;
            return prev.filter((m) => m.id !== oldId);
          }
          const row = mapCashMovementRow(payload.new);
          const exists = prev.some((m) => m.id === row.id);
          return exists ? prev.map((m) => (m.id === row.id ? row : m)) : [row, ...prev];
        });
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [session?.user?.id, cashShift.id]);

  // O livro-caixa (cash_ledger) NÃO é carregado aqui — a tela Livro-Caixa faz
  // a própria query sob demanda (botão Buscar), pra não puxar tudo ao abrir.

  // ---- Lançamentos financeiros (financial_entries) ----
  const [financialEntries] = useSupabaseCollection<FinancialEntry>('financial_entries', session, mapFinancialEntryRow, 'id', 'created_at', 500);

  // ---- Auditoria persistida (audit_log) — só carrega para quem tem acesso ----
  useEffect(() => {
    if (!session || !hasPermission(currentUser, 'auditoria.acessar')) return;
    let cancelled = false;
    supabase.from('audit_log').select('*').order('seq', { ascending: false }).limit(300)
      .then(({ data }) => { if (!cancelled && data) setAuditLogs(data.map(mapAuditRow)); });

    const channel = supabase
      .channel(`public:audit_log:${session.user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_log' }, (payload) => {
        const row = mapAuditRow(payload.new);
        setAuditLogs((prev) => (prev.some((l) => l.id === row.id) ? prev : [row, ...prev]));
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [session?.user?.id, currentUser?.id]);

  // ---- Toasts & audit ----
  const addToast = (type: Toast['type'], title: string, message?: string) => {
    const newToast: Toast = {
      id: 'toast-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      type,
      title,
      message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setToasts((prev) => [newToast, ...prev.slice(0, 4)]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const logAudit = (action: string, moduleName: string, details?: string) => {
    const newLog: AuditLog = {
      id: 'log-' + Date.now(),
      userName: currentUser?.name || 'Sistema',
      userRole: currentUser?.role || 'admin',
      action,
      module: moduleName,
      timestamp: new Date().toLocaleString('pt-BR'),
      details,
    };
    // Feedback instantâneo na UI + persistência real e imutável (audit_log).
    // As RPCs financeiras já gravam sua própria linha no servidor; este log
    // cobre as ações que não passam por RPC. Fire-and-forget.
    setAuditLogs((prev) => [newLog, ...prev]);
    void supabase.rpc('write_audit_log', {
      p_action: action,
      p_module: moduleName,
      p_details: details ? { text: details } : {},
    });
  };

  // ---- Table Management Actions ----
  const createTable = async (number: number, sector: DiningTable['sector'], capacity: number) => {
    const newTable: DiningTable = {
      id: 'tb-' + Date.now(),
      number,
      sector,
      capacity,
      status: 'livre',
      comandas: [],
    };

    const { error } = await supabase.from('dining_tables').insert(toRow(newTable));
    if (error) { addToast('error', 'Erro ao criar mesa', error.message); return; }

    addToast('success', 'Mesa criada', `Mesa ${number} adicionada em ${sector}`);
    logAudit('Criação de Mesa', 'Mesas', `Mesa ${number} - ${sector} (${capacity} lugares)`);
  };

  const deleteTable = async (tableId: string) => {
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;
    if (table.status !== 'livre' || table.comandas.length > 0) {
      addToast('error', 'Não é possível remover', 'Só é possível remover mesas livres e sem comanda aberta.');
      return;
    }

    const { error } = await supabase.from('dining_tables').delete().eq('id', tableId);
    if (error) { addToast('error', 'Erro ao remover mesa', error.message); return; }

    addToast('warning', 'Mesa removida', `Mesa ${table.number}`);
    logAudit('Remoção de Mesa', 'Mesas', `Mesa ${table.number}`);
  };

  // Abre uma nova comanda na mesa (funciona tanto pra abrir a mesa quanto
  // pra adicionar mais uma pessoa numa mesa já ocupada).
  const openComanda = async (tableId: string, personName: string, guestCount?: number): Promise<Comanda | null> => {
    if (!currentUser) return null;
    const table = tables.find((t) => t.id === tableId);
    if (!table) return null;

    const newComanda: Comanda = {
      id: 'cmd-' + Date.now(),
      personName: personName || 'Cliente',
      guestCount,
      openedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      waiterId: currentUser.id,
      waiterName: currentUser.name,
      items: [],
      subtotal: 0,
      status: 'aberta',
    };

    const updatedComandas = [...table.comandas, newComanda];

    const { error } = await supabase
      .from('dining_tables')
      .update({ comandas: updatedComandas, status: computeTableStatus(updatedComandas) })
      .eq('id', tableId);

    if (error) { addToast('error', 'Erro ao abrir comanda', error.message); return null; }

    addToast('success', 'Comanda aberta', `${personName}${guestCount ? ` (${guestCount} pessoas)` : ''}`);
    logAudit('Abertura de Comanda', 'Atendimento Salão', `Mesa ${table.number} - ${personName}`);
    return newComanda;
  };

  // Abre várias comandas de uma vez (uma por nome) num único update, evitando
  // que updates concorrentes se sobrescrevam por causa do atraso do realtime.
  const openComandas = async (tableId: string, personNames: string[]): Promise<Comanda[]> => {
    if (!currentUser) return [];
    const table = tables.find((t) => t.id === tableId);
    if (!table) return [];

    const nowLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newComandas: Comanda[] = personNames.map((personName, idx) => ({
      id: 'cmd-' + Date.now() + '-' + idx + '-' + Math.random().toString(36).substring(2, 7),
      personName: personName || 'Cliente',
      openedAt: nowLabel,
      waiterId: currentUser.id,
      waiterName: currentUser.name,
      items: [],
      subtotal: 0,
      status: 'aberta',
    }));

    const updatedComandas = [...table.comandas, ...newComandas];

    const { error } = await supabase
      .from('dining_tables')
      .update({ comandas: updatedComandas, status: computeTableStatus(updatedComandas) })
      .eq('id', tableId);

    if (error) { addToast('error', 'Erro ao abrir comanda', error.message); return []; }

    addToast('success', newComandas.length > 1 ? 'Comandas abertas' : 'Comanda aberta', personNames.join(', '));
    logAudit('Abertura de Comanda', 'Atendimento Salão', `Mesa ${table.number} - ${personNames.join(', ')}`);
    return newComandas;
  };

  const addComandaItem = async (tableId: string, comandaId: string, productId: string, quantity: number, additions: any[] = [], notes?: string, unitPriceOverride?: number) => {
    if (!currentUser) return;
    const product = products.find((p) => p.id === productId);
    const table = tables.find((t) => t.id === tableId);
    const comanda = table?.comandas.find((c) => c.id === comandaId);
    if (!product || !table || !comanda) return;

    const additionsTotal = additions.reduce((acc, a) => acc + (a.price || 0), 0);
    const unitPrice = unitPriceOverride !== undefined ? unitPriceOverride : (product.promoPrice || product.price) + additionsTotal;
    const nowLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Cada unidade vira sua própria linha (quantity: 1) em vez de um item
    // agregado, para permitir selecionar/cancelar/pagar unidades individuais
    // (ex: pagamento parcial de só 1 das 2 cocas pedidas juntas).
    const newItems: TableItem[] = Array.from({ length: Math.max(1, quantity) }, (_, idx) => ({
      id: 'item-' + Date.now() + '-' + idx + '-' + Math.random().toString(36).substring(2, 6),
      productId,
      productName: product.name,
      quantity: 1,
      unitPrice,
      additions,
      notes,
      status: 'ativo',
      createdAt: nowLabel,
      waiterName: currentUser.name,
    }));

    // RPC atômica (migration 0037): trava a mesa com FOR UPDATE, relê a comanda,
    // anexa os itens (carimbando hora/garçom no servidor) e dá baixa de estoque
    // na MESMA transação. Substitui o read-modify-write do JSON no cliente, que
    // perdia lançamentos concorrentes de garçons na mesma mesa.
    const { error } = await supabase.rpc('comanda_add_items', {
      p_table_id: tableId,
      p_comanda_id: comandaId,
      p_items: newItems,
      p_stock_items: [{ productId, quantity }],
    });

    if (error) { addToast('error', 'Erro ao lançar item', error.message); return; }

    addToast('success', 'Item lançado na comanda', `${quantity}x ${product.name}`);
  };

  const cancelComandaItem = async (tableId: string, comandaId: string, itemId: string, reason: string) => {
    if (!currentUser) return;
    if (!hasPermission(currentUser, 'mesas.cancelar_item')) {
      addToast('error', 'Sem permissão', 'Você não pode cancelar item de comanda.');
      return;
    }
    if (!reason || !reason.trim()) { addToast('error', 'Cancelamento', 'Informe o motivo do cancelamento.'); return; }
    const table = tables.find((t) => t.id === tableId);
    const comanda = table?.comandas.find((c) => c.id === comandaId);
    if (!table || !comanda) return;
    const target = comanda.items.find((i) => i.id === itemId);
    if (!target || target.status === 'cancelado') return;

    // RPC atômica (migration 0037): trava a mesa, marca o item como cancelado,
    // recalcula o subtotal e repõe o estoque (exceto cortesia) na mesma
    // transação.
    const { error } = await supabase.rpc('comanda_cancel_item', {
      p_table_id: tableId,
      p_comanda_id: comandaId,
      p_item_id: itemId,
      p_reason: reason.trim(),
    });

    if (error) { addToast('error', 'Erro ao cancelar item', error.message); return; }

    addToast('warning', 'Item cancelado na mesa', `Motivo: ${reason.trim()}`);
  };

  // Liga/desliga a taxa de serviço OU o couvert de UMA comanda. Remover exige
  // a permissão mesas.remover_taxa_servico; reativar (voltar ao padrão) é livre
  // para quem edita a comanda.
  const setComandaCharge = async (
    tableId: string,
    comandaId: string,
    charge: 'serviceFee' | 'couvert',
    applied: boolean,
    reason?: string
  ) => {
    if (!currentUser) return;
    const label = charge === 'serviceFee' ? 'taxa de serviço' : 'couvert';
    if (!applied && !hasPermission(currentUser, 'mesas.remover_taxa_servico')) {
      addToast('error', 'Sem permissão', `Você não pode remover a ${label}.`);
      return;
    }
    const table = tables.find((t) => t.id === tableId);
    const comanda = table?.comandas.find((c) => c.id === comandaId);
    if (!table || !comanda) return;

    // RPC atômica (migration 0037): trava a mesa e aplica o patch na comanda
    // (serviceFeeApplied/couvertApplied + quem removeu / motivo).
    const { error } = await supabase.rpc('comanda_set_charge', {
      p_table_id: tableId,
      p_comanda_id: comandaId,
      p_charge: charge,
      p_applied: applied,
      p_reason: reason?.trim() || null,
    });
    if (error) { addToast('error', `Erro ao alterar ${label}`, error.message); return; }

    addToast(
      applied ? 'success' : 'warning',
      applied ? `${label[0].toUpperCase()}${label.slice(1)} reativada` : `${label[0].toUpperCase()}${label.slice(1)} removida`,
      `Mesa ${table.number} - ${comanda.personName}`
    );
  };

  // Define quantos couverts a comanda cobra (1 = padrão). Ex.: comanda de um
  // grupo de 3 pessoas → 3 couverts. RPC atômica (migration 0041).
  const setComandaCouvertQty = async (tableId: string, comandaId: string, qty: number) => {
    if (!currentUser) return;
    const clamped = Math.min(50, Math.max(1, Math.round(qty)));
    const table = tables.find((t) => t.id === tableId);
    const comanda = table?.comandas.find((c) => c.id === comandaId);
    if (!table || !comanda) return;

    const { error } = await supabase.rpc('comanda_set_couvert_qty', {
      p_table_id: tableId,
      p_comanda_id: comandaId,
      p_qty: clamped,
    });
    if (error) { addToast('error', 'Erro ao alterar couvert', error.message); return; }

    addToast('info', `Couvert: ${clamped}×`, `Mesa ${table.number} - ${comanda.personName}`);
  };

  // Move só uma comanda (com seus itens) para outra mesa — as demais
  // comandas da mesa de origem não são afetadas.
  const transferComanda = async (fromTableId: string, comandaId: string, toTableId: string) => {
    const sourceTable = tables.find((t) => t.id === fromTableId);
    const targetTable = tables.find((t) => t.id === toTableId);
    const comanda = sourceTable?.comandas.find((c) => c.id === comandaId);
    if (!sourceTable || !targetTable || !comanda) return;

    // RPC atômica (migration 0037): trava as duas mesas em ordem estável de id
    // (evita deadlock em transferências cruzadas) e move a comanda numa só
    // transação — antes eram dois UPDATEs separados que podiam deixar a comanda
    // duplicada ou sumida se um falhasse.
    const { error } = await supabase.rpc('comanda_transfer', {
      p_from_table_id: fromTableId,
      p_comanda_id: comandaId,
      p_to_table_id: toTableId,
    });

    if (error) { addToast('error', 'Erro ao transferir comanda', error.message); return; }

    addToast('info', 'Comanda transferida com sucesso', `${comanda.personName}: Mesa ${sourceTable.number} → Mesa ${targetTable.number}`);
  };

  const closeComandaAndPay = async (tableId: string, comandaId: string, paymentMethod: PaymentMethod, discount = 0, splitPayments?: { method: PaymentMethod; amount: number }[], discountReason?: string, managerPin?: string): Promise<Order | null> => {
    if (!currentUser) return null;
    if (cashShift.status !== 'aberto') {
      addToast('error', 'Caixa Fechado', 'Não é possível fechar uma comanda sem um caixa aberto. Abra o caixa antes de vender.');
      return null;
    }
    const table = tables.find((t) => t.id === tableId);
    const comanda = table?.comandas.find((c) => c.id === comandaId);
    if (!table || !comanda) return null;

    const finalSubtotal = comanda.subtotal;
    // Taxa de serviço / couvert: mesma regra do servidor (close_comanda_and_pay).
    const serviceFee = comandaServiceFee(comanda, companyProfile);
    const couvert = comandaCouvert(comanda, companyProfile);
    const advancesTotal = (comanda.advancePayments || [])
      .filter((p) => p.status === 'ativo')
      .reduce((sum, p) => sum + p.amount, 0);
    const finalTotal = Math.max(0, finalSubtotal + serviceFee + couvert - advancesTotal - discount);

    const newOrder: Order = {
      id: newOrderId(),
      orderNumber: orders.length + 1001,
      channel: 'garcom',
      tableNumber: table.number,
      customer: { name: comanda.personName, phone: '(11) 00000-0000' },
      // Itens cancelados não entram no pedido: o subtotal/total já os exclui, e
      // mantê-los aqui inflava a quantidade vendida nos relatórios (dashboard).
      items: comanda.items
        .filter((it) => it.status !== 'cancelado')
        .map((it) => ({
          id: it.id, productId: it.productId, productName: it.productName, quantity: it.quantity,
          unitPrice: it.unitPrice, additions: it.additions, notes: it.notes,
        })),
      serviceType: 'consumo_local',
      subtotal: finalSubtotal,
      deliveryFee: 0,
      discount,
      serviceFee,
      couvert,
      total: finalTotal,
      paymentMethod,
      splitPayments,
      paymentStatus: 'pagamento_aprovado',
      orderStatus: 'concluido',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      waiterName: comanda.waiterName || currentUser.name,
      fiscalIssued: true,
      nfceKey: '352607' + Math.floor(100000000000000 + Math.random() * 900000000000000),
    };

    const { error } = await supabase.rpc('close_comanda_and_pay', {
      p_table_id: tableId,
      p_comanda_id: comandaId,
      p_order: newOrder,
      p_cash_amount: cashShift.status === 'aberto' ? finalTotal : null,
      p_payment_method: paymentMethod,
      p_split_payments: splitPayments && splitPayments.length > 0 ? splitPayments : null,
      p_discount_reason: discountReason || null,
      p_manager_pin: managerPin || null,
    });

    if (error) { addToast('error', 'Erro ao fechar comanda', error.message); return null; }

    newOrder.orderNumber = await fetchServerOrderNumber(newOrder.id, newOrder.orderNumber);

    addToast(
      'success',
      `Comanda ${comanda.personName} fechada`,
      `Pagamento de R$ ${finalTotal.toFixed(2)} recebido (${paymentMethod.toUpperCase()})${advancesTotal > 0 ? ` • R$ ${advancesTotal.toFixed(2)} já adiantado` : ''}`
    );
    logAudit('Fechamento e Pagamento de Comanda', 'PDV / Caixa', `Mesa ${table.number} - ${comanda.personName} - Total R$ ${finalTotal.toFixed(2)}`);
    return newOrder;
  };

  const addPartialPayment: AppContextType['addPartialPayment'] = async (tableId, comandaId, paymentData) => {
    if (!currentUser) return null;
    // Atômico no servidor: relê a comanda, valida saldo, atualiza o jsonb e
    // lança o adiantamento no livro-caixa por forma de pagamento (RPC 0027).
    const { data, error } = await supabase.rpc('credit_partial_payment', {
      p_table_id: tableId,
      p_comanda_id: comandaId,
      p_payment: paymentData,
    });
    if (error) { addToast('error', 'Erro ao registrar adiantamento', error.message); return null; }

    const created = data as PartialPayment | null;
    const table = tables.find((t) => t.id === tableId);
    addToast(
      'success',
      `Adiantamento Parcial Registrado!`,
      `R$ ${paymentData.amount.toFixed(2)}${created ? ` • Saldo restante: R$ ${Number(created.remainingBalanceAfter ?? 0).toFixed(2)}` : ''}`
    );
    logAudit(
      'Adiantamento Parcial de Comanda',
      'Atendimento / Caixa',
      `Mesa #${table?.number ?? '?'} - R$ ${paymentData.amount.toFixed(2)} (${paymentData.type === 'by_item' ? 'Por Produtos' : 'Por Valor'})`
    );
    return created;
  };

  const cancelPartialPayment = async (tableId: string, comandaId: string, paymentId: string, reason: string) => {
    if (!currentUser) return;
    if (!reason || !reason.trim()) { addToast('error', 'Estorno cancelado', 'Informe o motivo do estorno.'); return; }
    // Reverte também o caixa: espelha cada linha do adiantamento no livro-caixa (RPC 0027).
    const { error } = await supabase.rpc('reverse_partial_payment', {
      p_table_id: tableId,
      p_comanda_id: comandaId,
      p_payment_id: paymentId,
      p_reason: reason.trim(),
    });
    if (error) { addToast('error', 'Erro ao estornar adiantamento', error.message); return; }

    addToast('warning', 'Adiantamento estornado', 'O valor foi revertido do caixa.');
    logAudit('Estorno de Adiantamento', 'Caixa / Atendimento', `Adiantamento ${paymentId} - Motivo: ${reason.trim()}`);
  };

  // ---- Kitchen & Delivery Order Flow ----
  const updateOrderStatus = async (orderId: string, status: OrderStatus, driverName?: string) => {
    const order = orders.find((o) => o.id === orderId);
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const { error } = await supabase
      .from('orders')
      .update({
        order_status: status,
        delivery_driver_name: driverName || order?.deliveryDriverName || null,
        updated_at: new Date().toISOString(),
        prepared_at: status === 'pronto' ? nowStr : order?.preparedAt || null,
        delivered_at: status === 'concluido' ? nowStr : order?.deliveredAt || null,
      })
      .eq('id', orderId);

    if (error) { addToast('error', 'Erro ao atualizar pedido', error.message); return; }

    addToast('info', 'Status do pedido atualizado', `Pedido ID #${orderId} agora está: ${status.replace('_', ' ').toUpperCase()}`);
    logAudit('Atualização de Status de Pedido', 'Cozinha/Expedição', `Pedido #${orderId} -> ${status}`);
  };

  const updatePaymentStatus = async (orderId: string, status: PaymentStatus) => {
    const { error } = await supabase.from('orders').update({ payment_status: status }).eq('id', orderId);
    if (error) { addToast('error', 'Erro ao atualizar pagamento', error.message); return; }
    addToast('success', 'Status de Pagamento', `Pagamento do Pedido #${orderId}: ${status}`);
  };

  // ---- Online Customer Order (Tuna Pagamentos simulated approval) ----
  const createOnlineOrder = async (orderData: Partial<Order>): Promise<Order> => {
    const subtotal = (orderData.items || []).reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
    const deliveryFee = orderData.serviceType === 'entrega' ? companyProfile.deliveryFee : 0;
    const total = subtotal + deliveryFee - (orderData.discount || 0);

    const newOrder: Order = {
      id: newOrderId(),
      orderNumber: orders.length + 1001,
      channel: 'online',
      customer: orderData.customer || { name: 'Cliente Online', phone: '(11) 99999-9999' },
      items: orderData.items || [],
      serviceType: orderData.serviceType || 'entrega',
      subtotal,
      deliveryFee,
      discount: orderData.discount || 0,
      total,
      paymentMethod: orderData.paymentMethod || 'pix',
      paymentStatus: (orderData.paymentMethod === 'pix' || orderData.paymentMethod === 'cartao_credito') ? 'pagamento_aprovado' : 'aguardando_pagamento',
      orderStatus: 'novo',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      tunaTransactionId: 'TUNA-' + Math.floor(100000 + Math.random() * 900000),
      notes: orderData.notes,
      fiscalIssued: false,
    };

    const { error } = await supabase.rpc('create_order_and_credit_cash', {
      p_order: newOrder,
      p_cash_amount: null,
      p_payment_method: newOrder.paymentMethod,
      p_stock_items: newOrder.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    });

    if (error) {
      addToast('error', 'Erro ao registrar pedido online', error.message);
      throw error;
    }

    newOrder.orderNumber = await fetchServerOrderNumber(newOrder.id, newOrder.orderNumber);

    addToast('success', 'Pedido Online Recebido!', `Pedido #${newOrder.orderNumber} - R$ ${newOrder.total.toFixed(2)} (${newOrder.paymentMethod.toUpperCase()})`);
    logAudit('Novo Pedido Online', 'Cardápio Online', `Pedido #${newOrder.orderNumber} por ${newOrder.customer.name}`);

    return newOrder;
  };

  // ---- Direct PDV Express Sale ----
  const createPdvSale = async (
    items: OrderItem[],
    paymentMethod: PaymentMethod,
    serviceType: Order['serviceType'],
    customerName = 'Cliente Balcão',
    discount = 0,
    splitPayments?: { method: PaymentMethod; amount: number }[],
    discountReason?: string,
    managerPin?: string
  ): Promise<Order | null> => {
    if (cashShift.status !== 'aberto') {
      addToast('error', 'Caixa Fechado', 'Não é possível lançar uma venda sem um caixa aberto. Abra o caixa antes de vender.');
      return null;
    }
    const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const total = Math.max(0, subtotal - discount);

    const newOrder: Order = {
      id: newOrderId(),
      orderNumber: orders.length + 1001,
      channel: 'pdv',
      customer: { name: customerName, phone: '(11) 90000-0000' },
      items,
      serviceType,
      subtotal,
      deliveryFee: 0,
      discount,
      total,
      paymentMethod,
      splitPayments,
      paymentStatus: 'pagamento_aprovado',
      orderStatus: 'concluido',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      fiscalIssued: true,
      nfceKey: '352607' + Math.floor(100000000000000 + Math.random() * 900000000000000),
    };

    const { error } = await supabase.rpc('create_order_and_credit_cash', {
      p_order: newOrder,
      p_cash_amount: cashShift.status === 'aberto' ? total : null,
      p_payment_method: paymentMethod,
      p_stock_items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      p_split_payments: splitPayments && splitPayments.length > 0 ? splitPayments : null,
      p_discount_reason: discountReason || null,
      p_manager_pin: managerPin || null,
    });

    if (error) {
      addToast('error', 'Erro ao registrar venda', error.message);
      throw error;
    }

    newOrder.orderNumber = await fetchServerOrderNumber(newOrder.id, newOrder.orderNumber);

    addToast('success', 'Venda realizada com sucesso', `Total R$ ${total.toFixed(2)} - NFC-e gerada`);
    logAudit('Venda Direta PDV', 'Frente de Caixa', `Pedido #${newOrder.orderNumber} - R$ ${total.toFixed(2)}`);

    return newOrder;
  };

  // ---- Cash Register Controls ----
  const openCashShift = async (initialFloat: number): Promise<string | null> => {
    if (!currentUser) return null;
    // Toda a escrita em cash_shifts é via RPC security definer (migration 0027/0028):
    // valida permissão, recusa segundo caixa aberto e lança a linha de abertura no livro-caixa.
    const { data, error } = await supabase.rpc('open_cash_shift', {
      p_initial_float: initialFloat,
      p_notes: null,
    });
    if (error) { addToast('error', 'Erro ao abrir caixa', error.message); return null; }

    addToast('success', 'Caixa Aberto', `Fundo inicial de R$ ${initialFloat.toFixed(2)}`);
    logAudit('Abertura de Caixa', 'Controle de Caixa', `Fundo inicial R$ ${initialFloat.toFixed(2)}`);
    return (data as string) ?? null;
  };

  const closeCashShift: AppContextType['closeCashShift'] = async (payload) => {
    if (!currentUser) return;
    // O servidor recalcula o esperado a partir do livro-caixa, recusa fechamento
    // com mesa em aberto e exige justificativa acima do limite configurado.
    const { error } = await supabase.rpc('close_cash_shift', {
      p_conferred: {
        cash: payload.conferredCash,
        credit: payload.conferredCredit,
        debit: payload.conferredDebit,
        pix: payload.conferredPix,
        meal_voucher: payload.conferredMealVoucher,
        other: payload.conferredOther,
      },
      p_notes: payload.notes || null,
    });

    if (error) { addToast('error', 'Erro ao fechar caixa', error.message); return; }

    addToast('warning', 'Caixa Fechado', 'Conferência registrada. Confira a diferença no detalhe do turno.');
    logAudit('Fechamento de Caixa', 'Controle de Caixa', `Total contado R$ ${payload.conferredCash.toFixed(2)}`);
  };

  const addCashMovement = async (type: 'reforco' | 'sangria', amount: number, name: string, reason: string) => {
    if (!currentUser) return;
    // A RPC resolve o turno aberto no servidor, valida permissão/valor e lança no livro-caixa.
    const { error } = await supabase.rpc('add_cash_movement', {
      p_movement: { type, amount, name, reason },
    });
    if (error) { addToast('error', 'Erro ao registrar movimentação', error.message); return; }

    addToast('info', `Movimentação de Caixa: ${type === 'reforco' ? 'ENTRADA' : 'SAÍDA'}`, `${name} - R$ ${amount.toFixed(2)}`);
    logAudit(`Movimento Caixa (${type === 'reforco' ? 'entrada' : 'saída'})`, 'Caixa', `${name} - R$ ${amount.toFixed(2)}`);
  };

  const reversePaidOrder = async (orderId: string, reason: string, managerPin: string): Promise<boolean> => {
    const { error } = await supabase.rpc('reverse_paid_order', {
      p_order_id: orderId,
      p_reason: reason,
      p_manager_pin: managerPin,
    });
    if (error) { addToast('error', 'Erro ao estornar venda', error.message); return false; }
    addToast('warning', 'Venda estornada', 'Pedido cancelado, caixa e estoque revertidos.');
    logAudit('Estorno de Venda', 'Frente de Caixa', `Pedido ${orderId} - Motivo: ${reason}`);
    return true;
  };

  const validateManagerPin = async (pin: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('validate_manager_pin', { p_pin: pin });
    if (error) { addToast('error', 'Erro ao validar PIN', error.message); return false; }
    return data === true;
  };

  const validateOwnPin = async (pin: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('validate_user_pin', { p_pin: pin });
    if (error) { addToast('error', 'Erro ao validar PIN', error.message); return false; }
    return data === true;
  };

  const recordCashExpense = async (entry: { description: string; category?: string; amount: number }): Promise<boolean> => {
    const { error } = await supabase.rpc('record_cash_expense', { p_entry: entry });
    if (error) { addToast('error', 'Erro ao lançar despesa', error.message); return false; }
    addToast('success', 'Despesa registrada', `${entry.description} - R$ ${entry.amount.toFixed(2)}`);
    logAudit('Despesa em Dinheiro', 'Financeiro', `${entry.description} - R$ ${entry.amount.toFixed(2)}`);
    return true;
  };

  // ---- Category CRUD ----
  const saveCategory = async (category: Category) => {
    const { error } = await supabase.from('categories').upsert(toRow(category));
    if (error) { addToast('error', 'Erro ao salvar categoria', error.message); return; }
    addToast('success', 'Categoria salva', category.name);
    logAudit('Cadastro de Categoria', 'Produtos', `Categoria: ${category.name}`);
  };

  const deleteCategory = async (categoryId: string) => {
    const { error } = await supabase.from('categories').delete().eq('id', categoryId);
    if (error) { addToast('error', 'Erro ao remover categoria', error.message); return; }
    addToast('warning', 'Categoria removida');
    logAudit('Exclusão de Categoria', 'Produtos', `ID da categoria: ${categoryId}`);
  };

  // ---- Ingredient Category (Grupos de Insumos) CRUD ----
  const saveIngredientCategory = async (category: IngredientCategory) => {
    const { error } = await supabase.from('ingredient_categories').upsert(toRow(category));
    if (error) { addToast('error', 'Erro ao salvar grupo de insumo', error.message); return; }
    addToast('success', 'Grupo de insumo salvo', category.name);
    logAudit('Cadastro de Grupo de Insumo', 'Estoque', `Grupo: ${category.name}`);
  };

  const deleteIngredientCategory = async (categoryId: string) => {
    const { error } = await supabase.from('ingredient_categories').delete().eq('id', categoryId);
    if (error) { addToast('error', 'Erro ao remover grupo de insumo', error.message); return; }
    addToast('warning', 'Grupo de insumo removido');
    logAudit('Exclusão de Grupo de Insumo', 'Estoque', `ID do grupo: ${categoryId}`);
  };

  // ---- Supplier (Fornecedores) CRUD ----
  const saveSupplier = async (supplier: Supplier) => {
    const { error } = await supabase.from('suppliers').upsert(toRow(supplier));
    if (error) { addToast('error', 'Erro ao salvar fornecedor', error.message); return; }
    addToast('success', 'Fornecedor salvo', supplier.name);
    logAudit('Cadastro de Fornecedor', 'Fornecedores', `Fornecedor: ${supplier.name}`);
  };

  const deleteSupplier = async (supplierId: string) => {
    const { error } = await supabase.from('suppliers').delete().eq('id', supplierId);
    if (error) { addToast('error', 'Erro ao remover fornecedor', error.message); return; }
    addToast('warning', 'Fornecedor removido');
    logAudit('Exclusão de Fornecedor', 'Fornecedores', `ID do fornecedor: ${supplierId}`);
  };

  // ---- Table Sector (Áreas do Restaurante) CRUD ----
  const saveTableSector = async (sector: TableSector) => {
    const { error } = await supabase.from('table_sectors').upsert(toRow(sector));
    if (error) { addToast('error', 'Erro ao salvar área', error.message); return; }
    addToast('success', 'Área salva', sector.name);
    logAudit('Cadastro de Área do Restaurante', 'Mesas', `Área: ${sector.name}`);
  };

  const deleteTableSector = async (sectorId: string) => {
    const { error } = await supabase.from('table_sectors').delete().eq('id', sectorId);
    if (error) { addToast('error', 'Erro ao remover área', error.message); return; }
    addToast('warning', 'Área removida');
    logAudit('Exclusão de Área do Restaurante', 'Mesas', `ID da área: ${sectorId}`);
  };

  const saveSaleUnit = async (saleUnit: SaleUnit) => {
    const { error } = await supabase.from('sale_units').upsert(toRow(saleUnit));
    if (error) { addToast('error', 'Erro ao salvar unidade', error.message); return; }
    addToast('success', 'Unidade de venda salva', saleUnit.name);
    logAudit('Cadastro de Unidade de Venda', 'Produtos', `Unidade: ${saleUnit.name} (${saleUnit.abbreviation})`);
  };

  // ---- Product CRUD ----
  const saveProduct = async (product: Product) => {
    const { error } = await supabase.from('products').upsert(toRow(product));
    if (error) { addToast('error', 'Erro ao salvar produto', error.message); return; }
    addToast('success', 'Produto salvo', `${product.name} (R$ ${product.price.toFixed(2)})`);
    logAudit('Cadastro de Produto', 'Produtos', `Salvo produto: ${product.name}`);
  };

  const deleteProduct = async (productId: string) => {
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) { addToast('error', 'Erro ao remover produto', error.message); return; }
    addToast('warning', 'Produto removido');
    logAudit('Exclusão de Produto', 'Produtos', `ID do produto: ${productId}`);
  };

  // ---- Stock CRUD ----
  const saveIngredient = async (ingredient: Ingredient) => {
    const { error } = await supabase.from('ingredients').upsert(toRow(ingredient));
    if (error) { addToast('error', 'Erro ao salvar insumo', error.message); return; }
    addToast('success', 'Insumo salvo', ingredient.name);
  };

  const deleteIngredient = async (ingredientId: string) => {
    const { error } = await supabase.from('ingredients').delete().eq('id', ingredientId);
    if (error) { addToast('error', 'Erro ao remover insumo', error.message); return; }
    addToast('warning', 'Insumo removido');
    logAudit('Exclusão de Insumo', 'Estoque', `ID do insumo: ${ingredientId}`);
  };

  const recordStockEntry = async (ingredientId: string, qty: number, costUnit: number) => {
    // Ajuste atômico no servidor (migration 0039): soma dentro do banco, sem
    // read-modify-write no cliente.
    const { error } = await supabase.rpc('adjust_stock', {
      p_op: 'entrada',
      p_item_type: 'ingredient',
      p_id: ingredientId,
      p_qty: qty,
      p_cost_unit: costUnit > 0 ? costUnit : null,
    });

    if (error) { addToast('error', 'Erro ao registrar entrada', error.message); return; }

    addToast('success', 'Entrada de estoque', `+${qty} unidades registradas`);
    logAudit('Entrada de Mercadoria', 'Estoque', `Insumo ID ${ingredientId} +${qty}`);
  };

  const recordProductStockEntry = async (productId: string, qty: number) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const { error } = await supabase.rpc('adjust_stock', {
      p_op: 'entrada',
      p_item_type: 'product',
      p_id: productId,
      p_qty: qty,
    });

    if (error) { addToast('error', 'Erro ao registrar entrada', error.message); return; }

    addToast('success', 'Entrada de estoque', `+${qty} ${prod.unit} de ${prod.name}`);
    logAudit('Entrada de Estoque de Produto', 'Estoque', `Produto ${prod.name} +${qty} ${prod.unit}`);
  };

  const recordLoss: AppContextType['recordLoss'] = async (data) => {
    if (data.itemId) {
      // Baixa atômica (migration 0039). Vale para produto e insumo.
      const { error: stockErr } = await supabase.rpc('adjust_stock', {
        p_op: 'perda',
        p_item_type: data.itemType,
        p_id: data.itemId,
        p_qty: data.quantity,
      });
      if (stockErr) { addToast('error', 'Erro ao baixar estoque', stockErr.message); return; }
    }

    const newLoss: LossRecord = {
      id: 'loss-' + Date.now(),
      itemType: data.itemType,
      itemId: data.itemId,
      ingredientName: data.itemName,
      quantity: data.quantity,
      unit: data.unit,
      costValue: data.costValue,
      reason: data.reason,
      registeredBy: currentUser?.name || '',
      registeredAt: new Date().toLocaleString('pt-BR'),
      notes: data.notes,
      employeeName: data.employeeName || currentUser?.name || '',
      sector: data.sector || 'Estoque',
    };

    // Persiste no servidor; a subscription realtime injeta na lista local (e nos
    // outros terminais). Antes ficava só no localStorage deste navegador.
    const { error } = await supabase.from('loss_records').insert(toRow(newLoss));
    if (error) { addToast('error', 'Erro ao registrar perda', error.message); return; }

    addToast('error', 'Perda de Estoque Registrada', `${data.quantity} ${data.unit} de ${data.itemName} - R$ ${data.costValue.toFixed(2)} (${data.reason.replace('_', ' ')})`);
    logAudit('Registro de Perdas de Estoque', 'Estoque', `${data.itemName}: ${data.quantity} ${data.unit} - Motivo: ${data.reason}`);
  };

  const recordCourtesy: AppContextType['recordCourtesy'] = async (data) => {
    const prod = products.find((p) => p.id === data.productId);
    if (!prod || !currentUser) return;

    if (prod.trackStock) {
      // Baixa atômica no servidor (migration 0039).
      const { error: stockErr } = await supabase.rpc('adjust_stock', {
        p_op: 'cortesia',
        p_item_type: 'product',
        p_id: data.productId,
        p_qty: data.quantity,
      });
      if (stockErr) { addToast('error', 'Erro ao baixar estoque', stockErr.message); return; }
    }

    const totalRetail = prod.price * data.quantity;
    const totalCost = prod.costPrice * data.quantity;

    const newCourtesy: CourtesyRecord = {
      id: 'crt-' + Date.now(),
      productId: prod.id,
      productName: prod.name,
      quantity: data.quantity,
      unitPrice: prod.price,
      costPrice: prod.costPrice,
      totalRetailValue: totalRetail,
      totalCostValue: totalCost,
      reason: data.reason,
      source: data.source,
      targetReference: data.targetReference || (data.tableId ? `Mesa` : 'Geral'),
      customerName: data.customerName,
      authorizedBy: data.authorizedBy,
      registeredBy: currentUser.name,
      registeredAt: new Date().toLocaleString('pt-BR'),
      notes: data.notes,
    };

    const { error } = await supabase.from('courtesy_records').insert(toRow(newCourtesy));
    if (error) { addToast('error', 'Erro ao registrar cortesia', error.message); return; }

    if (data.tableId && data.comandaId) {
      const table = tables.find((t) => t.id === data.tableId);
      const comanda = table?.comandas.find((c) => c.id === data.comandaId);
      if (table && comanda) {
        const newTableItem: TableItem = {
          id: 'item-' + Date.now(),
          productId: prod.id,
          productName: `${prod.name} (CORTESIA)`,
          quantity: data.quantity,
          unitPrice: 0,
          additions: [],
          notes: `Cortesia: ${data.reason.replace('_', ' ')} (Aut: ${data.authorizedBy})`,
          status: 'ativo',
          createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          waiterName: currentUser.name,
          isCourtesy: true,
          courtesyReason: data.reason,
          courtesyAuthorizedBy: data.authorizedBy,
          isPaid: true,
        };

        const updatedComandas = table.comandas.map((c) =>
          c.id === data.comandaId ? { ...c, items: [...c.items, newTableItem] } : c
        );

        await supabase.from('dining_tables').update({ comandas: updatedComandas }).eq('id', data.tableId);
      }
    }

    addToast('success', 'Cortesia Registrada', `${data.quantity}x ${prod.name} (Cortesia R$ 0,00) - Aut: ${data.authorizedBy}`);
    logAudit('Registro de Cortesia', 'Operacional', `${data.quantity}x ${prod.name} - Motivo: ${data.reason} - Aut: ${data.authorizedBy}`);
  };

  // ---- Fiscal emission simulation ----
  const issueNfce = async (orderId: string): Promise<string> => {
    const key = '352607' + Math.floor(100000000000000 + Math.random() * 900000000000000);
    const { error } = await supabase.from('orders').update({ fiscal_issued: true, nfce_key: key }).eq('id', orderId);
    if (error) { addToast('error', 'Erro ao emitir NFC-e', error.message); return ''; }
    addToast('success', 'NFC-e Emitida', `Chave: ${key.substring(0, 15)}...`);
    logAudit('Emissão NFC-e', 'Fiscal', `Pedido #${orderId} - Chave ${key}`);
    return key;
  };

  // ---- WhatsApp Driver Dispatch message generator ----
  const dispatchWhatsApp = async (orderId: string, driverName: string): Promise<string> => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return '';

    const itemsText = order.items.map((i) => `• ${i.quantity}x ${i.productName}`).join('\n');
    const msg = `🛵 *${companyProfile.name.toUpperCase()} - NOVO PEDIDO PARA ENTREGA*\n\n` +
      `📦 *Pedido:* #${order.orderNumber}\n` +
      `👤 *Cliente:* ${order.customer.name}\n` +
      `📞 *Telefone:* ${order.customer.phone}\n` +
      `📍 *Endereço:* ${order.customer.address?.street}, ${order.customer.address?.number} - ${order.customer.address?.neighborhood}\n` +
      `🧭 *Ref:* ${order.customer.address?.reference || 'Sem referência'}\n\n` +
      `🛒 *Itens:*\n${itemsText}\n\n` +
      `💰 *Valor Total:* R$ ${order.total.toFixed(2)}\n` +
      `💳 *Pagamento:* ${order.paymentMethod.toUpperCase()} (${order.paymentStatus === 'pagamento_aprovado' ? 'PAGO ONLINE ✅' : 'COBRAR NA ENTREGA ⚠️'})\n\n` +
      `👨‍✈️ *Entregador Responsável:* ${driverName}\n` +
      `🗺️ *Google Maps:* https://maps.google.com/?q=${encodeURIComponent(`${order.customer.address?.street}, ${order.customer.address?.number}`)}`;

    await updateOrderStatus(orderId, 'saiu_entrega', driverName);
    addToast('success', 'Mensagem WhatsApp Gerada', `Notificação enviada para ${driverName}`);
    return msg;
  };

  if (!sessionChecked || (session && authLoading)) {
    return (
      <div className="min-h-screen bg-[#F6F1EA] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-800 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session || !currentUser) {
    return <LoginScreen banner={authBanner} />;
  }

  return (
    <AppContext.Provider
      value={{
        currentUser,
        companyProfile,
        setCompanyProfile,
        users,
        updateUserProfile,
        createUser,
        categories,
        ingredientCategories,
        tableSectors,
        saleUnits,
        products,
        ingredients,
        tables,
        orders,
        cashShift,
        cashShiftsHistory,
        cashMovements,
        financialEntries,
        selectedCashShiftId,
        setSelectedCashShiftId,
        suppliers,
        saveSupplier,
        deleteSupplier,
        lossRecords,
        courtesyRecords,
        printers,
        setPrinters,
        deliveryDrivers,
        setDeliveryDrivers,
        auditLogs,
        toasts,
        connectionOnline,
        activeView,
        setActiveView,
        addToast,
        removeToast,
        logAudit,
        logout,
        createTable,
        deleteTable,
        openComanda,
        openComandas,
        addComandaItem,
        cancelComandaItem,
        setComandaCharge,
        setComandaCouvertQty,
        transferComanda,
        closeComandaAndPay,
        addPartialPayment,
        cancelPartialPayment,
        updateOrderStatus,
        updatePaymentStatus,
        createOnlineOrder,
        createPdvSale,
        reversePaidOrder,
        validateManagerPin,
        validateOwnPin,
        recordCashExpense,
        openCashShift,
        closeCashShift,
        addCashMovement,
        saveCategory,
        deleteCategory,
        saveIngredientCategory,
        deleteIngredientCategory,
        saveTableSector,
        deleteTableSector,
        saveSaleUnit,
        saveProduct,
        deleteProduct,
        saveIngredient,
        deleteIngredient,
        recordStockEntry,
        recordProductStockEntry,
        recordLoss,
        recordCourtesy,
        issueNfce,
        dispatchWhatsApp,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
