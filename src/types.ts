export type UserRole = 
  | 'admin' 
  | 'gerente' 
  | 'caixa' 
  | 'garcom' 
  | 'cozinha' 
  | 'estoque' 
  | 'financeiro';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  active: boolean;
  phone?: string;
  code?: string; // Short PIN/Code for fast waiter/cashier login
}

export interface CompanyProfileData {
  name: string;
  tradeName: string; // Nome Fantasia
  cnpj: string;
  ie: string; // Inscrição Estadual
  logoUrl: string;
  coverUrl: string;
  primaryColor: string;
  phone: string;
  whatsapp: string;
  email: string;
  instagram: string;
  website: string;
  address: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  };
  operatingHours: string;
  avgPrepTimeMinutes: number;
  minOrderValue: number;
  deliveryFee: number;
  buffetPrices: {
    lunchPricePerKg: number;
    breakfastPricePerKg: number;
    plateTareGrams: number;
  };
  servedNeighborhoods: string[];
  pixKey: string;
  bankInfo: {
    bank: string;
    agency: string;
    account: string;
    holder: string;
    doc: string;
  };
  fiscalInfo: {
    crt: string; // Código de Regime Tributário
    environment: 'homologation' | 'production';
    certStatus: 'valid' | 'expiring' | 'invalid';
    certExpirationDate: string;
    nfceSeries: number;
    nfceNextNumber: number;
  };
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  description?: string;
  order: number;
  active: boolean;
  showsInStock: boolean;
}

export interface SaleUnit {
  id: string;
  name: string;
  abbreviation: string;
}

export interface ProductAddition {
  id: string;
  name: string;
  price: number;
}

export interface Product {
  id: string;
  code: string;
  barcode?: string;
  name: string;
  categoryId: string;
  description: string;
  price: number;
  costPrice: number;
  promoPrice?: number;
  unit: string;
  imageUrl: string;
  available: boolean;
  requiresPreparation: boolean;
  trackStock: boolean;
  stockQuantity: number;
  minStock: number;
  additions?: ProductAddition[];
  // Fiscal fields
  fiscal: {
    ncm: string;
    cfop: string;
    cest?: string;
    cstCsosn: string;
    taxPercentage: number;
  };
}

export interface Ingredient {
  id: string;
  name: string;
  category: 'carnes' | 'laticinios' | 'hortifruti' | 'bebidas' | 'embalagens' | 'outros';
  stockQuantity: number;
  minStock: number;
  unit: 'KG' | 'G' | 'L' | 'ML' | 'UN' | 'CX';
  avgCostUnit: number;
  expiryDate?: string;
}

export type TableStatus = 'livre' | 'ocupada' | 'aguardando_pedido' | 'em_preparo' | 'pedido_pronto' | 'aguardando_fechamento';

export interface TableItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  additions: ProductAddition[];
  notes?: string;
  status: 'solicitado' | 'em_preparo' | 'pronto' | 'entregue' | 'cancelado';
  createdAt: string;
  waiterName?: string;
  isPaid?: boolean;
  paidAt?: string;
  partialPaymentId?: string;
  isCourtesy?: boolean;
  courtesyReason?: string;
  courtesyAuthorizedBy?: string;
}

export interface PartialPayment {
  id: string;
  tableId: string;
  tableNumber: number;
  amount: number;
  paymentMethod: PaymentMethod | string;
  splitPayments?: { method: PaymentMethod; amount: number }[];
  type: 'by_item' | 'by_amount';
  itemIdsPaid?: string[];
  paidItemsDetails?: { productName: string; quantity: number; unitPrice: number }[];
  customerName?: string;
  paidAt: string;
  userName: string;
  notes?: string;
  status: 'ativo' | 'estornado';
  canceledAt?: string;
  canceledBy?: string;
  remainingBalanceAfter: number;
}

export interface DiningTable {
  id: string;
  number: number;
  sector: 'Salão Principal' | 'Varanda' | 'Área VIP' | 'Delivery / Balcão';
  capacity: number;
  status: TableStatus;
  guestCount?: number;
  clientName?: string;
  openedAt?: string;
  waiterId?: string;
  waiterName?: string;
  items: TableItem[];
  subtotal: number;
  advancePayments?: PartialPayment[];
}

export type OrderChannel = 'pdv' | 'garcom' | 'online' | 'balcao' | 'whatsapp' | 'telefone';
export type PaymentMethod = 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'multiplo';
export type OrderStatus = 'novo' | 'aceito' | 'em_preparo' | 'pronto' | 'saiu_entrega' | 'concluido' | 'cancelado';
export type PaymentStatus = 'aguardando_pagamento' | 'pagamento_aprovado' | 'pagamento_recusado' | 'pagamento_cancelado' | 'pagamento_estornado';

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  additions: ProductAddition[];
  notes?: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  channel: OrderChannel;
  tableNumber?: number;
  customer: {
    name: string;
    phone: string;
    address?: {
      street: string;
      number: string;
      neighborhood: string;
      complement?: string;
      reference?: string;
    };
  };
  items: OrderItem[];
  serviceType: 'entrega' | 'retirada' | 'consumo_local';
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  createdAt: string;
  updatedAt: string;
  preparedAt?: string;
  deliveredAt?: string;
  tunaTransactionId?: string;
  deliveryDriverName?: string;
  waiterName?: string;
  notes?: string;
  fiscalIssued: boolean;
  nfceKey?: string;
}

export interface FinancialEntry {
  id: string;
  type: 'receita' | 'despesa';
  description: string;
  category: string;
  amount: number;
  dueDate: string;
  status: 'pago' | 'pendente' | 'atrasado';
  paymentMethod?: string;
}

export interface CashShift {
  id: string;
  openedBy: string;
  openedAt: string;
  closedBy?: string;
  closedAt?: string;
  initialFloat: number; // Valor inicial em caixa
  status: 'aberto' | 'fechado';
  salesCash: number;
  salesCard: number;
  salesPix: number;
  additions: number; // Reforço
  withdrawals: number; // Sangria
  expectedTotal: number;
  actualTotal?: number;
  difference?: number;
  notes?: string;
}

export interface CashMovement {
  id: string;
  shiftId: string;
  type: 'reforco' | 'sangria' | 'venda_dinheiro';
  amount: number;
  reason: string;
  userName: string;
  timestamp: string;
}

export interface Supplier {
  id: string;
  name: string;
  tradeName: string;
  cnpjCpf: string;
  phone: string;
  email: string;
  suppliedCategories: string[];
  contactPerson: string;
}

export type LossReason = 
  | 'vencido' 
  | 'erro_preparo' 
  | 'queda_quebra' 
  | 'danificado' 
  | 'sobra_descartada' 
  | 'armazenamento' 
  | 'cancelamento' 
  | 'ajuste_inventario' 
  | 'outro';

export interface LossRecord {
  id: string;
  itemType: 'product' | 'ingredient';
  itemId?: string;
  ingredientName: string; // Product or Ingredient name
  quantity: number;
  unit: string;
  costValue: number;
  reason: LossReason;
  registeredBy: string;
  registeredAt: string;
  notes?: string;
  employeeName?: string;
  sector?: string;
}

export type CourtesyReason = 
  | 'promocional' 
  | 'atraso' 
  | 'erro_pedido' 
  | 'cliente_especial' 
  | 'aniversario' 
  | 'gerencia' 
  | 'degustacao' 
  | 'outro';

export interface CourtesyRecord {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number; // Retail price
  costPrice: number; // Product cost
  totalRetailValue: number; // quantity * unitPrice
  totalCostValue: number; // quantity * costPrice
  reason: CourtesyReason;
  source: 'mesa' | 'comanda' | 'pedido' | 'caixa_pdv';
  targetReference?: string;
  customerName?: string;
  authorizedBy: string;
  registeredBy: string;
  registeredAt: string;
  notes?: string;
}

export interface FiscalNote {
  id: string;
  orderId: string;
  orderNumber: number;
  nfceNumber: number;
  series: number;
  accessKey: string;
  issueDate: string;
  customerCpfCnpj?: string;
  totalAmount: number;
  status: 'autorizada' | 'cancelada' | 'contingencia';
  xmlUrl?: string;
}

export interface Printer {
  id: string;
  name: string;
  location: 'cozinha' | 'bar' | 'caixa' | 'expedicao';
  type: 'network' | 'usb' | 'bluetooth';
  ipAddress?: string;
  paperWidth: '58mm' | '80mm';
  autoPrint: boolean;
  status: 'online' | 'offline';
}

export interface DeliveryDriver {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  plate: string;
  active: boolean;
  currentDeliveries: number;
}

export interface AuditLog {
  id: string;
  userName: string;
  userRole: UserRole;
  action: string;
  module: string;
  timestamp: string;
  details?: string;
}
