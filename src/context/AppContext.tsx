import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { LoginScreen } from '../components/auth/LoginScreen';
import {
  User,
  CompanyProfileData,
  Category,
  SaleUnit,
  Product,
  Ingredient,
  DiningTable,
  Order,
  OrderStatus,
  PaymentStatus,
  CashShift,
  CashMovement,
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
  initialSuppliers,
  initialLossRecords,
  initialCourtesyRecords,
  initialPrinters,
  initialDeliveryDrivers,
  initialAuditLogs
} from '../data/initialData';

// ----------------------------------------------------------------------------
// Supabase row <-> app object mapping (snake_case columns <-> camelCase JS).
// Nested jsonb columns (items, additions, fiscal, customer, advancePayments,
// fiscal etc.) already store camelCase keys as-is, so only top-level column
// names need converting.
// ----------------------------------------------------------------------------
const toCamelKey = (s: string) => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const toSnakeKey = (s: string) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());

function rowToCamel<T>(row: Record<string, any>): T {
  const out: Record<string, any> = {};
  Object.keys(row).forEach((k) => { out[toCamelKey(k)] = row[k]; });
  return out as T;
}

function toRow(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  Object.keys(obj).forEach((k) => { out[toSnakeKey(k)] = obj[k]; });
  return out;
}

const formatTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';

const mapCategory = (row: any): Category => rowToCamel<Category>(row);
const mapSaleUnit = (row: any): SaleUnit => rowToCamel<SaleUnit>(row);
const mapIngredient = (row: any): Ingredient => rowToCamel<Ingredient>(row);
const mapProduct = (row: any): Product => rowToCamel<Product>(row);
const mapDiningTable = (row: any): DiningTable => rowToCamel<DiningTable>(row);
const mapCashShiftRow = (row: any): CashShift => rowToCamel<CashShift>(row);
const mapCashMovementRow = (row: any): CashMovement => rowToCamel<CashMovement>(row);
const mapProfileRow = (row: any): User => rowToCamel<User>(row);

const mapOrderRow = (row: any): Order => {
  const base = rowToCamel<Order>(row);
  return { ...base, createdAt: formatTime(row.created_at), updatedAt: formatTime(row.updated_at) };
};

const EMPTY_CASH_SHIFT: CashShift = {
  id: '',
  openedBy: '',
  openedAt: '',
  initialFloat: 0,
  status: 'fechado',
  salesCash: 0,
  salesCard: 0,
  salesPix: 0,
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
  orderColumn?: string
): [T[], React.Dispatch<React.SetStateAction<T[]>>] {
  const [items, setItems] = useState<T[]>([]);

  useEffect(() => {
    if (!session) {
      setItems([]);
      return;
    }
    let cancelled = false;

    const query = orderColumn
      ? supabase.from(table).select('*').order(orderColumn, { ascending: false })
      : supabase.from(table).select('*');

    query.then(({ data, error }) => {
      if (cancelled || error || !data) return;
      setItems(data.map(mapRow));
    });

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
          return exists
            ? prev.map((it) => ((it as any)[keyField] === rowKey ? row : it))
            : [row, ...prev];
        });
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [table, session?.user?.id]);

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
  setCompanyProfile: React.Dispatch<React.SetStateAction<CompanyProfileData>>;
  users: User[];
  updateUserProfile: (userId: string, patch: Partial<Pick<User, 'role' | 'active' | 'code' | 'phone' | 'name'>>) => Promise<void>;
  categories: Category[];
  saleUnits: SaleUnit[];
  products: Product[];
  ingredients: Ingredient[];
  tables: DiningTable[];
  orders: Order[];
  cashShift: CashShift;
  cashMovements: CashMovement[];
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  lossRecords: LossRecord[];
  courtesyRecords: CourtesyRecord[];
  printers: Printer[];
  setPrinters: React.Dispatch<React.SetStateAction<Printer[]>>;
  deliveryDrivers: DeliveryDriver[];
  setDeliveryDrivers: React.Dispatch<React.SetStateAction<DeliveryDriver[]>>;
  auditLogs: AuditLog[];
  toasts: Toast[];

  // Navigation
  activeView: string;
  setActiveView: (view: string) => void;

  // Toast
  addToast: (type: Toast['type'], title: string, message?: string) => void;
  removeToast: (id: string) => void;

  // Actions
  logAudit: (action: string, moduleName: string, details?: string) => void;
  logout: () => Promise<void>;
  createTable: (number: number, sector: DiningTable['sector'], capacity: number) => Promise<void>;
  deleteTable: (tableId: string) => Promise<void>;
  openTable: (tableId: string, guestCount: number, clientName?: string) => Promise<void>;
  addTableItem: (tableId: string, productId: string, quantity: number, additions?: any[], notes?: string, unitPriceOverride?: number) => Promise<void>;
  cancelTableItem: (tableId: string, itemId: string, reason: string) => Promise<void>;
  transferTable: (fromTableId: string, toTableId: string) => Promise<void>;
  closeTableAndPay: (tableId: string, paymentMethod: PaymentMethod, discount?: number, customerCpf?: string) => Promise<void>;
  addPartialPayment: (
    tableId: string,
    paymentData: {
      amount: number;
      paymentMethod: PaymentMethod | string;
      type: 'by_item' | 'by_amount';
      itemIdsPaid?: string[];
      customerName?: string;
      notes?: string;
      splitPayments?: { method: PaymentMethod; amount: number }[];
    }
  ) => Promise<PartialPayment | null>;
  cancelPartialPayment: (tableId: string, paymentId: string) => Promise<void>;

  updateOrderStatus: (orderId: string, status: OrderStatus, driverName?: string) => Promise<void>;
  updatePaymentStatus: (orderId: string, status: PaymentStatus) => Promise<void>;

  createOnlineOrder: (orderData: Partial<Order>) => Promise<Order>;
  createPdvSale: (items: OrderItem[], paymentMethod: PaymentMethod, serviceType: Order['serviceType'], customerName?: string, discount?: number) => Promise<Order>;

  openCashShift: (initialFloat: number) => Promise<void>;
  closeCashShift: (actualTotal: number, notes?: string) => Promise<void>;
  addCashMovement: (type: 'reforco' | 'sangria', amount: number, reason: string) => Promise<void>;

  saveCategory: (category: Category) => Promise<void>;
  saveSaleUnit: (saleUnit: SaleUnit) => Promise<void>;
  saveProduct: (product: Product) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;

  saveIngredient: (ingredient: Ingredient) => Promise<void>;
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
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        setCurrentUser(data ? mapProfileRow(data) : null);
        setAuthLoading(false);
      });
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const logout = async () => {
    await supabase.auth.signOut();
  };

  // ---- Non-core data (still localStorage-backed) ----
  const [companyProfile, setCompanyProfile] = useState<CompanyProfileData>(() => {
    const saved = localStorage.getItem('ampliechef_company');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.buffetPrices) {
          parsed.buffetPrices = { lunchPricePerKg: 80.00, breakfastPricePerKg: 54.99, plateTareGrams: 200 };
        }
        return parsed;
      } catch {
        return initialCompanyProfile;
      }
    }
    return initialCompanyProfile;
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [lossRecords, setLossRecords] = useState<LossRecord[]>(() => {
    const saved = localStorage.getItem('ampliechef_losses');
    return saved ? JSON.parse(saved) : initialLossRecords;
  });
  const [courtesyRecords, setCourtesyRecords] = useState<CourtesyRecord[]>(() => {
    const saved = localStorage.getItem('ampliechef_courtesies');
    return saved ? JSON.parse(saved) : initialCourtesyRecords;
  });
  const [printers, setPrinters] = useState<Printer[]>(initialPrinters);
  const [deliveryDrivers, setDeliveryDrivers] = useState<DeliveryDriver[]>(initialDeliveryDrivers);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(initialAuditLogs);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activeView, setActiveView] = useState<string>('dashboard');

  useEffect(() => { localStorage.setItem('ampliechef_company', JSON.stringify(companyProfile)); }, [companyProfile]);
  useEffect(() => { localStorage.setItem('ampliechef_losses', JSON.stringify(lossRecords)); }, [lossRecords]);
  useEffect(() => { localStorage.setItem('ampliechef_courtesies', JSON.stringify(courtesyRecords)); }, [courtesyRecords]);

  // ---- Core data (Supabase) ----
  const [categories] = useSupabaseCollection<Category>('categories', session, mapCategory, 'id');
  const [saleUnits] = useSupabaseCollection<SaleUnit>('sale_units', session, mapSaleUnit, 'id');
  const [ingredients] = useSupabaseCollection<Ingredient>('ingredients', session, mapIngredient, 'id');
  const [products] = useSupabaseCollection<Product>('products', session, mapProduct, 'id');
  const [tables] = useSupabaseCollection<DiningTable>('dining_tables', session, mapDiningTable, 'id');
  const [orders] = useSupabaseCollection<Order>('orders', session, mapOrderRow, 'id', 'created_at');

  const [users, setUsers] = useState<User[]>([]);
  const refreshUsers = () => {
    if (!session) { setUsers([]); return; }
    supabase.from('profiles').select('*').then(({ data }) => {
      if (data) setUsers(data.map(mapProfileRow));
    });
  };
  useEffect(refreshUsers, [session?.user?.id]);

  const updateUserProfile: AppContextType['updateUserProfile'] = async (userId, patch) => {
    const { error } = await supabase.from('profiles').update(toRow(patch)).eq('id', userId);
    if (error) { addToast('error', 'Erro ao atualizar usuário', error.message); return; }
    refreshUsers();
    if (currentUser && userId === currentUser.id) {
      setCurrentUser((prev) => (prev ? { ...prev, ...patch } : prev));
    }
    addToast('success', 'Usuário atualizado');
  };

  const [cashShift, setCashShift] = useState<CashShift>(EMPTY_CASH_SHIFT);

  useEffect(() => {
    if (!session) { setCashShift(EMPTY_CASH_SHIFT); return; }
    let cancelled = false;
    supabase.from('cash_shifts').select('*').order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => {
        if (!cancelled && data && data[0]) setCashShift(mapCashShiftRow(data[0]));
      });

    const channel = supabase
      .channel(`public:cash_shifts:${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_shifts' }, (payload) => {
        if (payload.eventType === 'DELETE') return;
        const row = mapCashShiftRow(payload.new);
        setCashShift((prev) => (row.id === prev.id || !prev.id || row.status === 'aberto' ? row : prev));
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [session?.user?.id]);

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
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const deductStockForItems = async (items: { productId: string; quantity: number }[]) => {
    if (items.length === 0) return;
    const { error } = await supabase.rpc('deduct_stock_for_items', { p_items: items });
    if (error) addToast('error', 'Erro ao baixar estoque', error.message);
  };

  // ---- Table Management Actions ----
  const createTable = async (number: number, sector: DiningTable['sector'], capacity: number) => {
    const newTable: DiningTable = {
      id: 'tb-' + Date.now(),
      number,
      sector,
      capacity,
      status: 'livre',
      items: [],
      subtotal: 0,
    };

    const { error } = await supabase.from('dining_tables').insert(toRow(newTable));
    if (error) { addToast('error', 'Erro ao criar mesa', error.message); return; }

    addToast('success', 'Mesa criada', `Mesa ${number} adicionada em ${sector}`);
    logAudit('Criação de Mesa', 'Mesas', `Mesa ${number} - ${sector} (${capacity} lugares)`);
  };

  const deleteTable = async (tableId: string) => {
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;
    if (table.status !== 'livre' || table.items.length > 0) {
      addToast('error', 'Não é possível remover', 'Só é possível remover mesas livres e sem comanda aberta.');
      return;
    }

    const { error } = await supabase.from('dining_tables').delete().eq('id', tableId);
    if (error) { addToast('error', 'Erro ao remover mesa', error.message); return; }

    addToast('warning', 'Mesa removida', `Mesa ${table.number}`);
    logAudit('Remoção de Mesa', 'Mesas', `Mesa ${table.number}`);
  };

  const openTable = async (tableId: string, guestCount: number, clientName?: string) => {
    if (!currentUser) return;
    const { error } = await supabase
      .from('dining_tables')
      .update({
        status: 'ocupada',
        guest_count: guestCount,
        client_name: clientName || `Mesa ${tableId}`,
        opened_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        waiter_id: currentUser.id,
        waiter_name: currentUser.name,
      })
      .eq('id', tableId);

    if (error) { addToast('error', 'Erro ao abrir mesa', error.message); return; }

    addToast('success', `Mesa aberta`, `Cliente: ${clientName || 'Geral'} (${guestCount} pessoas)`);
    logAudit(`Abertura de Mesa`, 'Atendimento Salão', `Mesa ${tableId} - ${guestCount} pessoas`);
  };

  const addTableItem = async (tableId: string, productId: string, quantity: number, additions: any[] = [], notes?: string, unitPriceOverride?: number) => {
    if (!currentUser) return;
    const product = products.find((p) => p.id === productId);
    const table = tables.find((t) => t.id === tableId);
    if (!product || !table) return;

    const additionsTotal = additions.reduce((acc, a) => acc + (a.price || 0), 0);
    const unitPrice = unitPriceOverride !== undefined ? unitPriceOverride : (product.promoPrice || product.price) + additionsTotal;

    const newItem: TableItem = {
      id: 'item-' + Date.now(),
      productId,
      productName: product.name,
      quantity,
      unitPrice,
      additions,
      notes,
      status: product.requiresPreparation === false ? 'pronto' : 'em_preparo',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      waiterName: currentUser.name,
    };

    const updatedItems = [...table.items, newItem];
    const newSubtotal = updatedItems
      .filter((i) => i.status !== 'cancelado')
      .reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

    const stillPreparing = updatedItems.some((i) => i.status === 'em_preparo');
    const newTableStatus = stillPreparing ? 'em_preparo' : 'pedido_pronto';

    const { error } = await supabase
      .from('dining_tables')
      .update({ items: updatedItems, subtotal: newSubtotal, status: newTableStatus })
      .eq('id', tableId);

    if (error) { addToast('error', 'Erro ao lançar item', error.message); return; }

    await deductStockForItems([{ productId, quantity }]);

    addToast('success', 'Item lançado na comanda', `${quantity}x ${product.name}`);
    logAudit('Lançamento de Pedido na Mesa', 'Garçom App', `Mesa ID: ${tableId} - ${quantity}x ${product.name}`);
  };

  const cancelTableItem = async (tableId: string, itemId: string, reason: string) => {
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;

    const updatedItems = table.items.map((i) => (i.id === itemId ? { ...i, status: 'cancelado' as const } : i));
    const newSubtotal = updatedItems
      .filter((i) => i.status !== 'cancelado')
      .reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

    const { error } = await supabase
      .from('dining_tables')
      .update({ items: updatedItems, subtotal: newSubtotal })
      .eq('id', tableId);

    if (error) { addToast('error', 'Erro ao cancelar item', error.message); return; }

    addToast('warning', 'Item cancelado na mesa', `Motivo: ${reason}`);
    logAudit('Cancelamento de Item de Comanda', 'Mesas', `Mesa ID ${tableId}, Item ID ${itemId}, Motivo: ${reason}`);
  };

  const transferTable = async (fromTableId: string, toTableId: string) => {
    const sourceTable = tables.find((t) => t.id === fromTableId);
    const targetTable = tables.find((t) => t.id === toTableId);
    if (!sourceTable || !targetTable) return;

    const mergedItems = [...targetTable.items, ...sourceTable.items];
    const newSubtotal = mergedItems
      .filter((i) => i.status !== 'cancelado')
      .reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

    const { error: targetError } = await supabase
      .from('dining_tables')
      .update({
        status: 'ocupada',
        guest_count: (targetTable.guestCount || 0) + (sourceTable.guestCount || 1),
        client_name: targetTable.clientName || sourceTable.clientName || null,
        items: mergedItems,
        subtotal: newSubtotal,
      })
      .eq('id', toTableId);

    if (targetError) { addToast('error', 'Erro ao transferir mesa', targetError.message); return; }

    const { error: sourceError } = await supabase
      .from('dining_tables')
      .update({ status: 'livre', guest_count: 0, client_name: null, opened_at: null, items: [], subtotal: 0 })
      .eq('id', fromTableId);

    if (sourceError) { addToast('error', 'Erro ao limpar mesa de origem', sourceError.message); return; }

    addToast('info', 'Mesa transferida com sucesso', `Mesa ${sourceTable.number} transferida para Mesa ${targetTable.number}`);
    logAudit('Transferência de Mesa', 'Atendimento', `Da Mesa ${sourceTable.number} para Mesa ${targetTable.number}`);
  };

  const closeTableAndPay = async (tableId: string, paymentMethod: PaymentMethod, discount = 0) => {
    if (!currentUser) return;
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;

    const finalSubtotal = table.subtotal;
    const finalTotal = Math.max(0, finalSubtotal - discount);

    const newOrder: Order = {
      id: 'ord-' + Date.now(),
      orderNumber: orders.length + 1001,
      channel: 'garcom',
      tableNumber: table.number,
      customer: { name: table.clientName || `Mesa ${table.number}`, phone: '(11) 00000-0000' },
      items: table.items.map((it) => ({
        id: it.id, productId: it.productId, productName: it.productName, quantity: it.quantity,
        unitPrice: it.unitPrice, additions: it.additions, notes: it.notes,
      })),
      serviceType: 'consumo_local',
      subtotal: finalSubtotal,
      deliveryFee: 0,
      discount,
      total: finalTotal,
      paymentMethod,
      paymentStatus: 'pagamento_aprovado',
      orderStatus: 'concluido',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      waiterName: table.waiterName || currentUser.name,
      fiscalIssued: true,
      nfceKey: '352607' + Math.floor(100000000000000 + Math.random() * 900000000000000),
    };

    const { error } = await supabase.rpc('close_table_and_pay', {
      p_table_id: tableId,
      p_order: newOrder,
      p_cash_amount: cashShift.status === 'aberto' ? finalTotal : null,
      p_payment_method: paymentMethod,
    });

    if (error) { addToast('error', 'Erro ao fechar mesa', error.message); return; }

    addToast('success', `Mesa ${table.number} fechada`, `Pagamento de R$ ${finalTotal.toFixed(2)} recebido (${paymentMethod.toUpperCase()})`);
    logAudit('Fechamento e Pagamento de Mesa', 'PDV / Caixa', `Mesa ${table.number} - Total R$ ${finalTotal.toFixed(2)}`);
  };

  const addPartialPayment: AppContextType['addPartialPayment'] = async (tableId, paymentData) => {
    if (!currentUser) return null;
    const table = tables.find((t) => t.id === tableId);
    if (!table) return null;

    const currentAdvances = table.advancePayments || [];
    const activeAdvancesTotal = currentAdvances.filter((p) => p.status === 'ativo').reduce((sum, p) => sum + p.amount, 0);
    const totalConsumed = table.items.filter((i) => i.status !== 'cancelado').reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const currentRemaining = Math.max(0, totalConsumed - activeAdvancesTotal);

    if (paymentData.amount <= 0 || paymentData.amount > currentRemaining + 0.05) {
      addToast('error', 'Valor de adiantamento inválido', `Saldo restante atual da mesa: R$ ${currentRemaining.toFixed(2)}`);
      return null;
    }

    const newPaymentId = 'adv-' + Date.now();
    const paidAtTimestamp = new Date().toLocaleString('pt-BR');

    let paidItemsDetails: { productName: string; quantity: number; unitPrice: number }[] = [];
    if (paymentData.type === 'by_item' && paymentData.itemIdsPaid && paymentData.itemIdsPaid.length > 0) {
      const targetItems = table.items.filter((i) => paymentData.itemIdsPaid?.includes(i.id));
      paidItemsDetails = targetItems.map((i) => ({ productName: i.productName, quantity: i.quantity, unitPrice: i.unitPrice }));
    }

    const remainingAfter = Math.max(0, currentRemaining - paymentData.amount);

    const newPartialPayment: PartialPayment = {
      id: newPaymentId,
      tableId,
      tableNumber: table.number,
      amount: paymentData.amount,
      paymentMethod: paymentData.paymentMethod,
      splitPayments: paymentData.splitPayments,
      type: paymentData.type,
      itemIdsPaid: paymentData.itemIdsPaid,
      paidItemsDetails,
      customerName: paymentData.customerName || 'Cliente',
      paidAt: paidAtTimestamp,
      userName: currentUser.name,
      notes: paymentData.notes,
      status: 'ativo',
      remainingBalanceAfter: remainingAfter,
    };

    const updatedItems = table.items.map((item) => {
      if (paymentData.type === 'by_item' && paymentData.itemIdsPaid?.includes(item.id)) {
        return { ...item, isPaid: true, paidAt: paidAtTimestamp, partialPaymentId: newPaymentId };
      }
      return item;
    });

    const updatedAdvances = [...currentAdvances, newPartialPayment];

    const { error } = await supabase
      .from('dining_tables')
      .update({
        items: updatedItems,
        advance_payments: updatedAdvances,
        status: remainingAfter === 0 ? 'aguardando_fechamento' : table.status,
      })
      .eq('id', tableId);

    if (error) { addToast('error', 'Erro ao registrar adiantamento', error.message); return null; }

    if (cashShift.status === 'aberto') {
      let cashAdd = 0, cardAdd = 0, pixAdd = 0;
      if (paymentData.splitPayments && paymentData.splitPayments.length > 0) {
        paymentData.splitPayments.forEach((sp) => {
          if (sp.method === 'dinheiro') cashAdd += sp.amount;
          else if (sp.method === 'cartao_credito' || sp.method === 'cartao_debito') cardAdd += sp.amount;
          else if (sp.method === 'pix') pixAdd += sp.amount;
        });
      } else {
        const pm = paymentData.paymentMethod;
        if (pm === 'dinheiro') cashAdd = paymentData.amount;
        else if (pm === 'cartao_credito' || pm === 'cartao_debito') cardAdd = paymentData.amount;
        else if (pm === 'pix') pixAdd = paymentData.amount;
      }

      await supabase
        .from('cash_shifts')
        .update({
          sales_cash: cashShift.salesCash + cashAdd,
          sales_card: cashShift.salesCard + cardAdd,
          sales_pix: cashShift.salesPix + pixAdd,
        })
        .eq('id', cashShift.id);
    }

    addToast(
      'success',
      `Adiantamento Parcial Registrado!`,
      `Mesa #${table.number}: R$ ${paymentData.amount.toFixed(2)} (${paymentData.customerName || 'Cliente'}). Saldo restante: R$ ${remainingAfter.toFixed(2)}`
    );
    logAudit(
      'Adiantamento Parcial de Comanda',
      'Atendimento / Caixa',
      `Mesa #${table.number} - R$ ${paymentData.amount.toFixed(2)} por ${paymentData.customerName || 'Cliente'} (${paymentData.type === 'by_item' ? 'Por Produtos' : 'Por Valor'})`
    );

    return newPartialPayment;
  };

  const cancelPartialPayment = async (tableId: string, paymentId: string) => {
    if (!currentUser) return;
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;

    const paymentToCancel = table.advancePayments?.find((p) => p.id === paymentId);
    if (!paymentToCancel || paymentToCancel.status === 'estornado') return;

    const updatedItems = table.items.map((item) =>
      item.partialPaymentId === paymentId ? { ...item, isPaid: false, paidAt: undefined, partialPaymentId: undefined } : item
    );
    const updatedAdvances = (table.advancePayments || []).map((p) =>
      p.id === paymentId ? { ...p, status: 'estornado' as const, canceledAt: new Date().toLocaleString('pt-BR'), canceledBy: currentUser.name } : p
    );

    const { error } = await supabase
      .from('dining_tables')
      .update({ items: updatedItems, advance_payments: updatedAdvances })
      .eq('id', tableId);

    if (error) { addToast('error', 'Erro ao estornar adiantamento', error.message); return; }

    addToast('warning', 'Adiantamento estornado', `Adiantamento de R$ ${paymentToCancel.amount.toFixed(2)} foi estornado com sucesso.`);
    logAudit('Estorno de Adiantamento', 'Caixa / Atendimento', `Mesa ${table.number} - Estornado R$ ${paymentToCancel.amount.toFixed(2)}`);
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
      id: 'ord-' + Date.now(),
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
    discount = 0
  ): Promise<Order> => {
    const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const total = Math.max(0, subtotal - discount);

    const newOrder: Order = {
      id: 'ord-' + Date.now(),
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
    });

    if (error) {
      addToast('error', 'Erro ao registrar venda', error.message);
      throw error;
    }

    addToast('success', 'Venda realizada com sucesso', `Total R$ ${total.toFixed(2)} - NFC-e gerada`);
    logAudit('Venda Direta PDV', 'Frente de Caixa', `Pedido #${newOrder.orderNumber} - R$ ${total.toFixed(2)}`);

    return newOrder;
  };

  // ---- Cash Register Controls ----
  const openCashShift = async (initialFloat: number) => {
    if (!currentUser) return;
    const newShift: CashShift = {
      id: 'shift-' + Date.now(),
      openedBy: `${currentUser.name} (${currentUser.role})`,
      openedAt: new Date().toLocaleString('pt-BR'),
      initialFloat,
      status: 'aberto',
      salesCash: 0,
      salesCard: 0,
      salesPix: 0,
      additions: 0,
      withdrawals: 0,
      expectedTotal: initialFloat,
      notes: 'Abertura de caixa realizada.',
    };

    const { error } = await supabase.from('cash_shifts').insert(toRow(newShift));
    if (error) { addToast('error', 'Erro ao abrir caixa', error.message); return; }

    addToast('success', 'Caixa Aberto', `Fundo inicial de R$ ${initialFloat.toFixed(2)}`);
    logAudit('Abertura de Caixa', 'Controle de Caixa', `Fundo inicial R$ ${initialFloat.toFixed(2)}`);
  };

  const closeCashShift = async (actualTotal: number, notes?: string) => {
    if (!currentUser || !cashShift.id) return;
    const expected = cashShift.initialFloat + cashShift.salesCash + cashShift.additions - cashShift.withdrawals;
    const diff = actualTotal - expected;

    const { error } = await supabase
      .from('cash_shifts')
      .update({
        closed_by: `${currentUser.name} (${currentUser.role})`,
        closed_at: new Date().toLocaleString('pt-BR'),
        status: 'fechado',
        expected_total: expected,
        actual_total: actualTotal,
        difference: diff,
        notes: notes || 'Fechamento concluído.',
      })
      .eq('id', cashShift.id);

    if (error) { addToast('error', 'Erro ao fechar caixa', error.message); return; }

    addToast('warning', 'Caixa Fechado', `Diferença apurada: R$ ${diff.toFixed(2)}`);
    logAudit('Fechamento de Caixa', 'Controle de Caixa', `Total contado R$ ${actualTotal.toFixed(2)} (Dif: R$ ${diff.toFixed(2)})`);
  };

  const addCashMovement = async (type: 'reforco' | 'sangria', amount: number, reason: string) => {
    if (!currentUser || !cashShift.id) return;
    const newMovement: CashMovement = {
      id: 'mov-' + Date.now(),
      shiftId: cashShift.id,
      type,
      amount,
      reason,
      userName: currentUser.name,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const { error } = await supabase.rpc('add_cash_movement', { p_movement: newMovement });
    if (error) { addToast('error', 'Erro ao registrar movimentação', error.message); return; }

    addToast('info', `Movimentação de Caixa: ${type.toUpperCase()}`, `Valor R$ ${amount.toFixed(2)} - ${reason}`);
    logAudit(`Movimento Caixa (${type})`, 'Caixa', `R$ ${amount.toFixed(2)} - ${reason}`);
  };

  // ---- Category CRUD ----
  const saveCategory = async (category: Category) => {
    const { error } = await supabase.from('categories').upsert(toRow(category));
    if (error) { addToast('error', 'Erro ao salvar categoria', error.message); return; }
    addToast('success', 'Categoria salva', category.name);
    logAudit('Cadastro de Categoria', 'Produtos', `Categoria: ${category.name}`);
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

  const recordStockEntry = async (ingredientId: string, qty: number, costUnit: number) => {
    const ing = ingredients.find((i) => i.id === ingredientId);
    if (!ing) return;

    const { error } = await supabase
      .from('ingredients')
      .update({ stock_quantity: ing.stockQuantity + qty, avg_cost_unit: costUnit > 0 ? costUnit : ing.avgCostUnit })
      .eq('id', ingredientId);

    if (error) { addToast('error', 'Erro ao registrar entrada', error.message); return; }

    addToast('success', 'Entrada de estoque', `+${qty} unidades registradas`);
    logAudit('Entrada de Mercadoria', 'Estoque', `Insumo ID ${ingredientId} +${qty}`);
  };

  const recordProductStockEntry = async (productId: string, qty: number) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const { error } = await supabase
      .from('products')
      .update({ stock_quantity: prod.stockQuantity + qty })
      .eq('id', productId);

    if (error) { addToast('error', 'Erro ao registrar entrada', error.message); return; }

    addToast('success', 'Entrada de estoque', `+${qty} ${prod.unit} de ${prod.name}`);
    logAudit('Entrada de Estoque de Produto', 'Estoque', `Produto ${prod.name} +${qty} ${prod.unit}`);
  };

  const recordLoss: AppContextType['recordLoss'] = async (data) => {
    if (data.itemType === 'product' && data.itemId) {
      const p = products.find((x) => x.id === data.itemId);
      if (p) await supabase.from('products').update({ stock_quantity: Math.max(0, p.stockQuantity - data.quantity) }).eq('id', data.itemId);
    } else if (data.itemId) {
      const i = ingredients.find((x) => x.id === data.itemId);
      if (i) await supabase.from('ingredients').update({ stock_quantity: Math.max(0, i.stockQuantity - data.quantity) }).eq('id', data.itemId);
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

    setLossRecords((prev) => [newLoss, ...prev]);
    addToast('error', 'Perda de Estoque Registrada', `${data.quantity} ${data.unit} de ${data.itemName} - R$ ${data.costValue.toFixed(2)} (${data.reason.replace('_', ' ')})`);
    logAudit('Registro de Perdas de Estoque', 'Estoque', `${data.itemName}: ${data.quantity} ${data.unit} - Motivo: ${data.reason}`);
  };

  const recordCourtesy: AppContextType['recordCourtesy'] = async (data) => {
    const prod = products.find((p) => p.id === data.productId);
    if (!prod || !currentUser) return;

    if (prod.trackStock) {
      await supabase.from('products').update({ stock_quantity: Math.max(0, prod.stockQuantity - data.quantity) }).eq('id', data.productId);
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

    setCourtesyRecords((prev) => [newCourtesy, ...prev]);

    if (data.tableId) {
      const table = tables.find((t) => t.id === data.tableId);
      if (table) {
        const newTableItem: TableItem = {
          id: 'item-' + Date.now(),
          productId: prod.id,
          productName: `${prod.name} (CORTESIA)`,
          quantity: data.quantity,
          unitPrice: 0,
          additions: [],
          notes: `Cortesia: ${data.reason.replace('_', ' ')} (Aut: ${data.authorizedBy})`,
          status: 'entregue',
          createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          waiterName: currentUser.name,
          isCourtesy: true,
          courtesyReason: data.reason,
          courtesyAuthorizedBy: data.authorizedBy,
          isPaid: true,
        };

        await supabase.from('dining_tables').update({ items: [...table.items, newTableItem] }).eq('id', data.tableId);
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
    return <LoginScreen />;
  }

  return (
    <AppContext.Provider
      value={{
        currentUser,
        companyProfile,
        setCompanyProfile,
        users,
        updateUserProfile,
        categories,
        saleUnits,
        products,
        ingredients,
        tables,
        orders,
        cashShift,
        cashMovements,
        suppliers,
        setSuppliers,
        lossRecords,
        courtesyRecords,
        printers,
        setPrinters,
        deliveryDrivers,
        setDeliveryDrivers,
        auditLogs,
        toasts,
        activeView,
        setActiveView,
        addToast,
        removeToast,
        logAudit,
        logout,
        createTable,
        deleteTable,
        openTable,
        addTableItem,
        cancelTableItem,
        transferTable,
        closeTableAndPay,
        addPartialPayment,
        cancelPartialPayment,
        updateOrderStatus,
        updatePaymentStatus,
        createOnlineOrder,
        createPdvSale,
        openCashShift,
        closeCashShift,
        addCashMovement,
        saveCategory,
        saveSaleUnit,
        saveProduct,
        deleteProduct,
        saveIngredient,
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
