import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  CompanyProfileData,
  Category,
  Product,
  Ingredient,
  TechnicalSheet,
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
  initialUsers,
  initialCategories,
  initialIngredients,
  initialProducts,
  initialTechnicalSheets,
  initialTables,
  initialOrders,
  initialCashShift,
  initialSuppliers,
  initialLossRecords,
  initialCourtesyRecords,
  initialPrinters,
  initialDeliveryDrivers,
  initialAuditLogs
} from '../data/initialData';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  timestamp: string;
}

interface AppContextType {
  currentUser: User;
  setCurrentUser: (user: User) => void;
  companyProfile: CompanyProfileData;
  setCompanyProfile: React.Dispatch<React.SetStateAction<CompanyProfileData>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  ingredients: Ingredient[];
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
  technicalSheets: TechnicalSheet[];
  setTechnicalSheets: React.Dispatch<React.SetStateAction<TechnicalSheet[]>>;
  tables: DiningTable[];
  setTables: React.Dispatch<React.SetStateAction<DiningTable[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  cashShift: CashShift;
  setCashShift: React.Dispatch<React.SetStateAction<CashShift>>;
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
  openTable: (tableId: string, guestCount: number, clientName?: string) => void;
  addTableItem: (tableId: string, productId: string, quantity: number, additions?: any[], notes?: string) => void;
  cancelTableItem: (tableId: string, itemId: string, reason: string) => void;
  transferTable: (fromTableId: string, toTableId: string) => void;
  closeTableAndPay: (tableId: string, paymentMethod: PaymentMethod, discount?: number, customerCpf?: string) => void;
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
  ) => PartialPayment | null;
  cancelPartialPayment: (tableId: string, paymentId: string) => void;
  
  updateOrderStatus: (orderId: string, status: OrderStatus, driverName?: string) => void;
  updatePaymentStatus: (orderId: string, status: PaymentStatus) => void;
  
  createOnlineOrder: (orderData: Partial<Order>) => Order;
  createPdvSale: (items: OrderItem[], paymentMethod: PaymentMethod, serviceType: Order['serviceType'], customerName?: string, discount?: number) => Order;
  
  openCashShift: (initialFloat: number) => void;
  closeCashShift: (actualTotal: number, notes?: string) => void;
  addCashMovement: (type: 'reforco' | 'sangria', amount: number, reason: string) => void;
  
  saveProduct: (product: Product) => void;
  deleteProduct: (productId: string) => void;
  
  saveIngredient: (ingredient: Ingredient) => void;
  recordStockEntry: (ingredientId: string, qty: number, costUnit: number) => void;
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
  }) => void;
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
  }) => void;
  
  issueNfce: (orderId: string) => string;
  dispatchWhatsApp: (orderId: string, driverName: string) => string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load state from localStorage or initialData
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const saved = localStorage.getItem('ampliechef_user');
    return saved ? JSON.parse(saved) : initialUsers[0];
  });

  const [companyProfile, setCompanyProfile] = useState<CompanyProfileData>(() => {
    const saved = localStorage.getItem('ampliechef_company');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.name || parsed.name.includes('AmplieChef') || parsed.name.includes('Villa')) {
          parsed.name = 'CAFÉ COM DESTINO';
          parsed.tradeName = 'CAFÉ COM DESTINO';
        }
        if (!parsed.buffetPrices) {
          parsed.buffetPrices = {
            lunchPricePerKg: 80.00,
            breakfastPricePerKg: 54.99,
            plateTareGrams: 200,
          };
        }
        return parsed;
      } catch (e) {
        return initialCompanyProfile;
      }
    }
    return initialCompanyProfile;
  });

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('ampliechef_users');
    return saved ? JSON.parse(saved) : initialUsers;
  });

  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem('ampliechef_categories');
    if (!saved) return initialCategories;
    try {
      const parsed: Category[] = JSON.parse(saved);
      const hasOldPizza = parsed.some(c => c.name.toLowerCase().includes('pizza'));
      if (hasOldPizza || parsed.length < initialCategories.length) {
        return initialCategories;
      }
      return parsed;
    } catch {
      return initialCategories;
    }
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('ampliechef_products');
    if (!saved) return initialProducts;
    try {
      const parsed: Product[] = JSON.parse(saved);
      // Filter out removed items: pizzas, gorgonzola, file mignon
      const filtered = parsed.filter(p => {
        const name = p.name.toLowerCase();
        return !name.includes('pizza') && !name.includes('gorgonzola') && !name.includes('mignon');
      });
      // Ensure all initialProducts are present
      const existingIds = new Set(filtered.map(p => p.id));
      const missing = initialProducts.filter(p => !existingIds.has(p.id));
      return [...filtered, ...missing];
    } catch {
      return initialProducts;
    }
  });

  const [ingredients, setIngredients] = useState<Ingredient[]>(() => {
    const saved = localStorage.getItem('ampliechef_ingredients');
    return saved ? JSON.parse(saved) : initialIngredients;
  });

  const [technicalSheets, setTechnicalSheets] = useState<TechnicalSheet[]>(initialTechnicalSheets);

  const [tables, setTables] = useState<DiningTable[]>(() => {
    const saved = localStorage.getItem('ampliechef_tables');
    return saved ? JSON.parse(saved) : initialTables;
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('ampliechef_orders');
    return saved ? JSON.parse(saved) : initialOrders;
  });

  const [cashShift, setCashShift] = useState<CashShift>(() => {
    const saved = localStorage.getItem('ampliechef_cash_shift');
    return saved ? JSON.parse(saved) : initialCashShift;
  });

  const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);

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

  // Persistence effects
  useEffect(() => { localStorage.setItem('ampliechef_user', JSON.stringify(currentUser)); }, [currentUser]);
  useEffect(() => { localStorage.setItem('ampliechef_company', JSON.stringify(companyProfile)); }, [companyProfile]);
  useEffect(() => { localStorage.setItem('ampliechef_products', JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem('ampliechef_ingredients', JSON.stringify(ingredients)); }, [ingredients]);
  useEffect(() => { localStorage.setItem('ampliechef_tables', JSON.stringify(tables)); }, [tables]);
  useEffect(() => { localStorage.setItem('ampliechef_orders', JSON.stringify(orders)); }, [orders]);
  useEffect(() => { localStorage.setItem('ampliechef_cash_shift', JSON.stringify(cashShift)); }, [cashShift]);
  useEffect(() => { localStorage.setItem('ampliechef_losses', JSON.stringify(lossRecords)); }, [lossRecords]);
  useEffect(() => { localStorage.setItem('ampliechef_courtesies', JSON.stringify(courtesyRecords)); }, [courtesyRecords]);

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
      userName: currentUser.name,
      userRole: currentUser.role,
      action,
      module: moduleName,
      timestamp: new Date().toLocaleString('pt-BR'),
      details,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // Stock deduction logic via TechnicalSheet & Products
  const deductStockForItems = (items: { productId: string; quantity: number }[]) => {
    setIngredients((prevIngs) => {
      const updated = [...prevIngs];
      items.forEach((item) => {
        const sheet = technicalSheets.find((ts) => ts.productId === item.productId);
        if (sheet) {
          sheet.ingredients.forEach((ingUsage) => {
            const ingIndex = updated.findIndex((i) => i.id === ingUsage.ingredientId);
            if (ingIndex !== -1) {
              const qtyToDeduct = ingUsage.quantityUsed * item.quantity;
              updated[ingIndex] = {
                ...updated[ingIndex],
                stockQuantity: Math.max(0, updated[ingIndex].stockQuantity - qtyToDeduct),
              };
            }
          });
        }
      });
      return updated;
    });

    setProducts((prevProds) => {
      const updated = [...prevProds];
      items.forEach((item) => {
        const pIndex = updated.findIndex((p) => p.id === item.productId);
        if (pIndex !== -1 && updated[pIndex].trackStock) {
          updated[pIndex] = {
            ...updated[pIndex],
            stockQuantity: Math.max(0, updated[pIndex].stockQuantity - item.quantity),
          };
        }
      });
      return updated;
    });
  };

  // Table Management Actions
  const openTable = (tableId: string, guestCount: number, clientName?: string) => {
    setTables((prev) =>
      prev.map((tb) => {
        if (tb.id === tableId) {
          return {
            ...tb,
            status: 'ocupada',
            guestCount,
            clientName: clientName || `Mesa ${tb.number}`,
            openedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            waiterId: currentUser.id,
            waiterName: currentUser.name,
          };
        }
        return tb;
      })
    );
    addToast('success', `Mesa ${tableId} aberta`, `Cliente: ${clientName || 'Geral'} (${guestCount} pessoas)`);
    logAudit(`Abertura de Mesa`, 'Atendimento Salão', `Mesa ${tableId} - ${guestCount} pessoas`);
  };

  const addTableItem = (tableId: string, productId: string, quantity: number, additions: any[] = [], notes?: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const additionsTotal = additions.reduce((acc, a) => acc + (a.price || 0), 0);
    const unitPrice = (product.promoPrice || product.price) + additionsTotal;

    const newItem: TableItem = {
      id: 'item-' + Date.now(),
      productId,
      productName: product.name,
      quantity,
      unitPrice,
      additions,
      notes,
      status: 'em_preparo',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      waiterName: currentUser.name,
    };

    setTables((prev) =>
      prev.map((tb) => {
        if (tb.id === tableId) {
          const updatedItems = [...tb.items, newItem];
          const newSubtotal = updatedItems
            .filter((i) => i.status !== 'cancelado')
            .reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

          return {
            ...tb,
            items: updatedItems,
            subtotal: newSubtotal,
            status: 'em_preparo',
          };
        }
        return tb;
      })
    );

    // Auto deduct ingredients stock
    deductStockForItems([{ productId, quantity }]);

    addToast('success', 'Item lançado na comanda', `${quantity}x ${product.name}`);
    logAudit('Lançamento de Pedido na Mesa', 'Garçom App', `Mesa ID: ${tableId} - ${quantity}x ${product.name}`);
  };

  const cancelTableItem = (tableId: string, itemId: string, reason: string) => {
    setTables((prev) =>
      prev.map((tb) => {
        if (tb.id === tableId) {
          const updatedItems = tb.items.map((i) => (i.id === itemId ? { ...i, status: 'cancelado' as const } : i));
          const newSubtotal = updatedItems
            .filter((i) => i.status !== 'cancelado')
            .reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

          return {
            ...tb,
            items: updatedItems,
            subtotal: newSubtotal,
          };
        }
        return tb;
      })
    );

    addToast('warning', 'Item cancelado na mesa', `Motivo: ${reason}`);
    logAudit('Cancelamento de Item de Comanda', 'Mesas', `Mesa ID ${tableId}, Item ID ${itemId}, Motivo: ${reason}`);
  };

  const transferTable = (fromTableId: string, toTableId: string) => {
    const sourceTable = tables.find((t) => t.id === fromTableId);
    const targetTable = tables.find((t) => t.id === toTableId);

    if (!sourceTable || !targetTable) return;

    setTables((prev) =>
      prev.map((tb) => {
        if (tb.id === toTableId) {
          const mergedItems = [...tb.items, ...sourceTable.items];
          const newSubtotal = mergedItems
            .filter((i) => i.status !== 'cancelado')
            .reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

          return {
            ...tb,
            status: 'ocupada',
            guestCount: (tb.guestCount || 0) + (sourceTable.guestCount || 1),
            clientName: tb.clientName || sourceTable.clientName,
            items: mergedItems,
            subtotal: newSubtotal,
          };
        }
        if (tb.id === fromTableId) {
          return {
            ...tb,
            status: 'livre',
            guestCount: 0,
            clientName: undefined,
            openedAt: undefined,
            items: [],
            subtotal: 0,
          };
        }
        return tb;
      })
    );

    addToast('info', 'Mesa transferida com sucesso', `Mesa ${sourceTable.number} transferida para Mesa ${targetTable.number}`);
    logAudit('Transferência de Mesa', 'Atendimento', `Da Mesa ${sourceTable.number} para Mesa ${targetTable.number}`);
  };

  const closeTableAndPay = (tableId: string, paymentMethod: PaymentMethod, discount = 0, customerCpf?: string) => {
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;

    const finalSubtotal = table.subtotal;
    const finalTotal = Math.max(0, finalSubtotal - discount);

    // Create corresponding completed order
    const newOrder: Order = {
      id: 'ord-' + Date.now(),
      orderNumber: orders.length + 1001,
      channel: 'garcom',
      tableNumber: table.number,
      customer: {
        name: table.clientName || `Mesa ${table.number}`,
        phone: '(11) 00000-0000',
      },
      items: table.items.map((it) => ({
        id: it.id,
        productId: it.productId,
        productName: it.productName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        additions: it.additions,
        notes: it.notes,
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

    setOrders((prev) => [newOrder, ...prev]);

    // Update cash shift
    if (cashShift.status === 'aberto') {
      setCashShift((prev) => ({
        ...prev,
        salesCash: paymentMethod === 'dinheiro' ? prev.salesCash + finalTotal : prev.salesCash,
        salesCard: (paymentMethod === 'cartao_credito' || paymentMethod === 'cartao_debito') ? prev.salesCard + finalTotal : prev.salesCard,
        salesPix: paymentMethod === 'pix' ? prev.salesPix + finalTotal : prev.salesPix,
      }));
    }

    // Reset Table
    setTables((prev) =>
      prev.map((tb) => {
        if (tb.id === tableId) {
          return {
            ...tb,
            status: 'livre',
            guestCount: 0,
            clientName: undefined,
            openedAt: undefined,
            items: [],
            subtotal: 0,
          };
        }
        return tb;
      })
    );

    addToast('success', `Mesa ${table.number} fechada`, `Pagamento de R$ ${finalTotal.toFixed(2)} recebido (${paymentMethod.toUpperCase()})`);
    logAudit('Fechamento e Pagamento de Mesa', 'PDV / Caixa', `Mesa ${table.number} - Total R$ ${finalTotal.toFixed(2)}`);
  };

  // Kitchen & Delivery Order Flow
  const updateOrderStatus = (orderId: string, status: OrderStatus, driverName?: string) => {
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          return {
            ...ord,
            orderStatus: status,
            deliveryDriverName: driverName || ord.deliveryDriverName,
            updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            preparedAt: status === 'pronto' ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ord.preparedAt,
            deliveredAt: status === 'concluido' ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ord.deliveredAt,
          };
        }
        return ord;
      })
    );

    addToast('info', 'Status do pedido atualizado', `Pedido ID #${orderId} agora está: ${status.replace('_', ' ').toUpperCase()}`);
    logAudit('Atualização de Status de Pedido', 'Cozinha/Expedição', `Pedido #${orderId} -> ${status}`);
  };

  const updatePaymentStatus = (orderId: string, status: PaymentStatus) => {
    setOrders((prev) =>
      prev.map((ord) => (ord.id === orderId ? { ...ord, paymentStatus: status } : ord))
    );
    addToast('success', 'Status de Pagamento', `Pagamento do Pedido #${orderId}: ${status}`);
  };

  // Create Online Customer Order with Tuna Pagamentos simulated approval
  const createOnlineOrder = (orderData: Partial<Order>): Order => {
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

    setOrders((prev) => [newOrder, ...prev]);

    // Deduct stock
    deductStockForItems(newOrder.items.map((i) => ({ productId: i.productId, quantity: i.quantity })));

    addToast('success', 'Pedido Online Recebido!', `Pedido #${newOrder.orderNumber} - R$ ${newOrder.total.toFixed(2)} (${newOrder.paymentMethod.toUpperCase()})`);
    logAudit('Novo Pedido Online', 'Cardápio Online', `Pedido #${newOrder.orderNumber} por ${newOrder.customer.name}`);

    return newOrder;
  };

  // Direct PDV Express Sale
  const createPdvSale = (
    items: OrderItem[], 
    paymentMethod: PaymentMethod, 
    serviceType: Order['serviceType'], 
    customerName = 'Cliente Balcão', 
    discount = 0
  ): Order => {
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

    setOrders((prev) => [newOrder, ...prev]);

    // Deduct ingredient stock
    deductStockForItems(items.map((i) => ({ productId: i.productId, quantity: i.quantity })));

    // Update Cash shift
    if (cashShift.status === 'aberto') {
      setCashShift((prev) => ({
        ...prev,
        salesCash: paymentMethod === 'dinheiro' ? prev.salesCash + total : prev.salesCash,
        salesCard: (paymentMethod === 'cartao_credito' || paymentMethod === 'cartao_debito') ? prev.salesCard + total : prev.salesCard,
        salesPix: paymentMethod === 'pix' ? prev.salesPix + total : prev.salesPix,
      }));
    }

    addToast('success', 'Venda realizada com sucesso', `Total R$ ${total.toFixed(2)} - NFC-e gerada`);
    logAudit('Venda Direta PDV', 'Frente de Caixa', `Pedido #${newOrder.orderNumber} - R$ ${total.toFixed(2)}`);

    return newOrder;
  };

  // Cash Register Controls
  const openCashShift = (initialFloat: number) => {
    setCashShift({
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
    });
    addToast('success', 'Caixa Aberto', `Fundo inicial de R$ ${initialFloat.toFixed(2)}`);
    logAudit('Abertura de Caixa', 'Controle de Caixa', `Fundo inicial R$ ${initialFloat.toFixed(2)}`);
  };

  const closeCashShift = (actualTotal: number, notes?: string) => {
    const expected = cashShift.initialFloat + cashShift.salesCash + cashShift.additions - cashShift.withdrawals;
    const diff = actualTotal - expected;

    setCashShift((prev) => ({
      ...prev,
      closedBy: `${currentUser.name} (${currentUser.role})`,
      closedAt: new Date().toLocaleString('pt-BR'),
      status: 'fechado',
      expectedTotal: expected,
      actualTotal,
      difference: diff,
      notes: notes || 'Fechamento concluído.',
    }));

    addToast('warning', 'Caixa Fechado', `Diferença apurada: R$ ${diff.toFixed(2)}`);
    logAudit('Fechamento de Caixa', 'Controle de Caixa', `Total contado R$ ${actualTotal.toFixed(2)} (Dif: R$ ${diff.toFixed(2)})`);
  };

  const addCashMovement = (type: 'reforco' | 'sangria', amount: number, reason: string) => {
    const newMovement: CashMovement = {
      id: 'mov-' + Date.now(),
      shiftId: cashShift.id,
      type,
      amount,
      reason,
      userName: currentUser.name,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setCashMovements((prev) => [newMovement, ...prev]);

    setCashShift((prev) => ({
      ...prev,
      additions: type === 'reforco' ? prev.additions + amount : prev.additions,
      withdrawals: type === 'sangria' ? prev.withdrawals + amount : prev.withdrawals,
    }));

    addToast('info', `Movimentação de Caixa: ${type.toUpperCase()}`, `Valor R$ ${amount.toFixed(2)} - ${reason}`);
    logAudit(`Movimento Caixa (${type})`, 'Caixa', `R$ ${amount.toFixed(2)} - ${reason}`);
  };

  // Product CRUD
  const saveProduct = (product: Product) => {
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      if (exists) {
        return prev.map((p) => (p.id === product.id ? product : p));
      }
      return [product, ...prev];
    });
    addToast('success', 'Produto salvo', `${product.name} (R$ ${product.price.toFixed(2)})`);
    logAudit('Cadastro de Produto', 'Produtos', `Salvo produto: ${product.name}`);
  };

  const deleteProduct = (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    addToast('warning', 'Produto removido');
    logAudit('Exclusão de Produto', 'Produtos', `ID do produto: ${productId}`);
  };

  // Stock CRUD
  const saveIngredient = (ingredient: Ingredient) => {
    setIngredients((prev) => {
      const exists = prev.some((i) => i.id === ingredient.id);
      if (exists) {
        return prev.map((i) => (i.id === ingredient.id ? ingredient : i));
      }
      return [ingredient, ...prev];
    });
    addToast('success', 'Insumo salvo', ingredient.name);
  };

  const recordStockEntry = (ingredientId: string, qty: number, costUnit: number) => {
    setIngredients((prev) =>
      prev.map((ing) => {
        if (ing.id === ingredientId) {
          const newQty = ing.stockQuantity + qty;
          return {
            ...ing,
            stockQuantity: newQty,
            avgCostUnit: costUnit > 0 ? costUnit : ing.avgCostUnit,
          };
        }
        return ing;
      })
    );
    addToast('success', 'Entrada de estoque', `+${qty} unidades registradas`);
    logAudit('Entrada de Mercadoria', 'Estoque', `Insumo ID ${ingredientId} +${qty}`);
  };

  const addPartialPayment = (
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
  ): PartialPayment | null => {
    const table = tables.find((t) => t.id === tableId);
    if (!table) return null;

    const currentAdvances = table.advancePayments || [];
    const activeAdvancesTotal = currentAdvances
      .filter((p) => p.status === 'ativo')
      .reduce((sum, p) => sum + p.amount, 0);

    const totalConsumed = table.items
      .filter((i) => i.status !== 'cancelado')
      .reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

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
      paidItemsDetails = targetItems.map((i) => ({
        productName: i.productName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      }));
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

    setTables((prev) =>
      prev.map((tb) => {
        if (tb.id === tableId) {
          const updatedItems = tb.items.map((item) => {
            if (paymentData.type === 'by_item' && paymentData.itemIdsPaid?.includes(item.id)) {
              return {
                ...item,
                isPaid: true,
                paidAt: paidAtTimestamp,
                partialPaymentId: newPaymentId,
              };
            }
            return item;
          });

          const updatedAdvances = [...(tb.advancePayments || []), newPartialPayment];

          return {
            ...tb,
            items: updatedItems,
            advancePayments: updatedAdvances,
            status: remainingAfter === 0 ? 'aguardando_fechamento' : tb.status,
          };
        }
        return tb;
      })
    );

    // Update cash shift if open
    if (cashShift.status === 'aberto') {
      let cashAdd = 0;
      let cardAdd = 0;
      let pixAdd = 0;

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

      setCashShift((prev) => ({
        ...prev,
        salesCash: prev.salesCash + cashAdd,
        salesCard: prev.salesCard + cardAdd,
        salesPix: prev.salesPix + pixAdd,
      }));
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

  const cancelPartialPayment = (tableId: string, paymentId: string) => {
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;

    const paymentToCancel = table.advancePayments?.find((p) => p.id === paymentId);
    if (!paymentToCancel || paymentToCancel.status === 'estornado') return;

    setTables((prev) =>
      prev.map((tb) => {
        if (tb.id === tableId) {
          const updatedItems = tb.items.map((item) => {
            if (item.partialPaymentId === paymentId) {
              return {
                ...item,
                isPaid: false,
                paidAt: undefined,
                partialPaymentId: undefined,
              };
            }
            return item;
          });

          const updatedAdvances = (tb.advancePayments || []).map((p) => {
            if (p.id === paymentId) {
              return {
                ...p,
                status: 'estornado' as const,
                canceledAt: new Date().toLocaleString('pt-BR'),
                canceledBy: currentUser.name,
              };
            }
            return p;
          });

          return {
            ...tb,
            items: updatedItems,
            advancePayments: updatedAdvances,
          };
        }
        return tb;
      })
    );

    addToast('warning', 'Adiantamento estornado', `Adiantamento de R$ ${paymentToCancel.amount.toFixed(2)} foi estornado com sucesso.`);
    logAudit('Estorno de Adiantamento', 'Caixa / Atendimento', `Mesa ${table.number} - Estornado R$ ${paymentToCancel.amount.toFixed(2)}`);
  };

  const recordLoss = (data: {
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
  }) => {
    if (data.itemType === 'product' && data.itemId) {
      setProducts((prev) =>
        prev.map((p) => (p.id === data.itemId ? { ...p, stockQuantity: Math.max(0, p.stockQuantity - data.quantity) } : p))
      );
    } else if (data.itemId) {
      setIngredients((prev) =>
        prev.map((i) => (i.id === data.itemId ? { ...i, stockQuantity: Math.max(0, i.stockQuantity - data.quantity) } : i))
      );
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
      registeredBy: currentUser.name,
      registeredAt: new Date().toLocaleString('pt-BR'),
      notes: data.notes,
      employeeName: data.employeeName || currentUser.name,
      sector: data.sector || 'Estoque',
    };

    setLossRecords((prev) => [newLoss, ...prev]);
    addToast('error', 'Perda de Estoque Registrada', `${data.quantity} ${data.unit} de ${data.itemName} - R$ ${data.costValue.toFixed(2)} (${data.reason.replace('_', ' ')})`);
    logAudit('Registro de Perdas de Estoque', 'Estoque', `${data.itemName}: ${data.quantity} ${data.unit} - Motivo: ${data.reason}`);
  };

  const recordCourtesy = (data: {
    productId: string;
    quantity: number;
    reason: CourtesyReason;
    source: CourtesyRecord['source'];
    targetReference?: string;
    customerName?: string;
    authorizedBy: string;
    notes?: string;
    tableId?: string;
  }) => {
    const prod = products.find((p) => p.id === data.productId);
    if (!prod) return;

    // Deduct product stock if tracked
    setProducts((prev) =>
      prev.map((p) => (p.id === data.productId && p.trackStock ? { ...p, stockQuantity: Math.max(0, p.stockQuantity - data.quantity) } : p))
    );

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

    // If launching in a table
    if (data.tableId) {
      setTables((prev) =>
        prev.map((tb) => {
          if (tb.id === data.tableId) {
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

            return {
              ...tb,
              items: [...tb.items, newTableItem],
            };
          }
          return tb;
        })
      );
    }

    addToast('success', 'Cortesia Registrada', `${data.quantity}x ${prod.name} (Cortesia R$ 0,00) - Aut: ${data.authorizedBy}`);
    logAudit('Registro de Cortesia', 'Operacional', `${data.quantity}x ${prod.name} - Motivo: ${data.reason} - Aut: ${data.authorizedBy}`);
  };

  // Fiscal emission simulation
  const issueNfce = (orderId: string): string => {
    const key = '352607' + Math.floor(100000000000000 + Math.random() * 900000000000000);
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, fiscalIssued: true, nfceKey: key } : o))
    );
    addToast('success', 'NFC-e Emitida', `Chave: ${key.substring(0, 15)}...`);
    logAudit('Emissão NFC-e', 'Fiscal', `Pedido #${orderId} - Chave ${key}`);
    return key;
  };

  // WhatsApp Driver Dispatch message generator
  const dispatchWhatsApp = (orderId: string, driverName: string): string => {
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

    updateOrderStatus(orderId, 'saiu_entrega', driverName);
    addToast('success', 'Mensagem WhatsApp Gerada', `Notificação enviada para ${driverName}`);
    return msg;
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        companyProfile,
        setCompanyProfile,
        users,
        setUsers,
        categories,
        setCategories,
        products,
        setProducts,
        ingredients,
        setIngredients,
        technicalSheets,
        setTechnicalSheets,
        tables,
        setTables,
        orders,
        setOrders,
        cashShift,
        setCashShift,
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
        saveProduct,
        deleteProduct,
        saveIngredient,
        recordStockEntry,
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
