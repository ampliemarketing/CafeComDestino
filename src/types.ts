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
  code?: string; // PIN — write-only: o cliente não lê mais este campo (revogado em 0028);
                 // validação é via RPC validate_user_pin / validate_manager_pin.
  cpf?: string;
  permissions: string[]; // Chaves do catálogo em src/lib/permissions.ts
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
  // Taxa de serviço / couvert / conferência de caixa (migration 0026)
  serviceFeePercent: number;
  serviceFeeEnabled: boolean;
  couvertValue: number;
  couvertEnabled: boolean;
  blindConferenceThreshold: number; // diferença de fechamento acima disso exige justificativa
  discountLimits: Partial<Record<UserRole, number>>; // teto de desconto (%) por cargo
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

export interface IngredientCategory {
  id: string;
  name: string;
}

export interface TableSector {
  id: string;
  name: string;
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
  category: string;
  stockQuantity: number;
  minStock: number;
  unit: 'KG' | 'G' | 'L' | 'ML' | 'UN' | 'CX';
  avgCostUnit: number;
  expiryDate?: string;
}

export type TableStatus = 'livre' | 'ocupada';

export interface TableItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  additions: ProductAddition[];
  notes?: string;
  status: 'ativo' | 'cancelado';
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
  comandaId: string;
  amount: number;
  serviceFeePortion?: number; // parcela do `amount` que é taxa de serviço
  couvertPortion?: number; // parcela do `amount` que é couvert
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

export interface Comanda {
  id: string;
  personName: string;
  guestCount?: number;
  openedAt: string;
  waiterId?: string;
  waiterName?: string;
  items: TableItem[];
  subtotal: number;
  status: 'aberta' | 'aguardando_fechamento';
  advancePayments?: PartialPayment[];
  serviceFeeApplied?: boolean; // ausente = aplica quando a taxa está habilitada na empresa
  serviceFeeRemovedBy?: string;
  serviceFeeRemovedReason?: string;
  couvertApplied?: boolean; // ausente = aplica quando o couvert está habilitado na empresa
  couvertRemovedBy?: string;
  couvertRemovedReason?: string;
  couvertQty?: number; // multiplicador do couvert; ausente = 1 (valor fixo por comanda)
}

export interface DiningTable {
  id: string;
  number: number;
  sector: string;
  capacity: number;
  status: TableStatus;
  comandas: Comanda[];
}

export type OrderChannel = 'pdv' | 'garcom' | 'online' | 'balcao' | 'whatsapp' | 'telefone';
export type PaymentMethod = 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'boleto' | 'multiplo' | 'vale_refeicao';
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
  splitPayments?: { method: PaymentMethod; amount: number }[];
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  createdAt: string; // Somente hora "HH:MM", para exibição em listas/telas operacionais
  createdAtISO?: string; // Timestamp completo (ISO) — usado para filtros por data/período
  updatedAt: string;
  preparedAt?: string;
  deliveredAt?: string;
  tunaTransactionId?: string;
  deliveryDriverName?: string;
  waiterName?: string;
  notes?: string;
  fiscalIssued: boolean;
  nfceKey?: string;
  shiftId?: string;
  serviceFee?: number; // taxa de serviço (não entra no subtotal de produtos)
  couvert?: number;
  advancePaid?: number; // total já quitado por adiantamento(s), abatido no fechamento
  discountReason?: string;
  discountAuthorizedBy?: string;
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
  shiftId?: string;
  ledgerId?: string;
  createdByName?: string;
  createdAt?: string;
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
  salesCard: number; // legado: crédito+débito somados (turnos antes da separação)
  salesCredit: number;
  salesDebit: number;
  salesPix: number;
  salesMealVoucher: number;
  salesOther: number;
  additions: number; // Reforço
  withdrawals: number; // Sangria
  expectedTotal: number;
  actualTotal?: number; // valor de dinheiro conferido no fechamento
  difference?: number; // diferença do dinheiro conferido
  conferredCredit?: number;
  conferredDebit?: number;
  conferredPix?: number;
  conferredMealVoucher?: number;
  conferredOther?: number;
  notes?: string;
  salesServiceFee?: number; // taxa de serviço acumulada (migration 0026)
  salesCouvert?: number;
  cashChangeGiven?: number; // troco entregue
  cashExpenses?: number; // despesas pagas em dinheiro do caixa
  goodsOut?: number; // valor de menu da mercadoria vendida no turno (migration 0033)
}

export type CashLedgerEntryType =
  | 'abertura' | 'venda' | 'adiantamento' | 'estorno_venda' | 'estorno_adiantamento'
  | 'sangria' | 'suprimento' | 'troco' | 'despesa' | 'taxa_servico' | 'couvert' | 'ajuste'
  | 'saida_mercadoria';

export interface CashLedgerEntry {
  id: string;
  seq?: number;
  shiftId: string;
  entryType: CashLedgerEntryType;
  direction: 'entrada' | 'saida';
  paymentMethod?: 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'pix' | 'vale_refeicao' | 'boleto' | 'outro';
  amount: number;
  orderId?: string;
  comandaId?: string;
  tableId?: string;
  relatedLedgerId?: string;
  reason?: string;
  createdBy?: string;
  createdByName: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface CashMovement {
  id: string;
  shiftId: string;
  type: 'reforco' | 'sangria' | 'venda_dinheiro';
  amount: number;
  name: string;
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
  notes?: string;
  active: boolean;
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
  userRole: UserRole | string;
  action: string;
  module: string;
  timestamp: string;
  details?: string | Record<string, unknown>;
  // Campos da forma persistida (tabela audit_log, migration 0025)
  actorId?: string;
  entityType?: string;
  entityId?: string;
  amountBefore?: number;
  amountAfter?: number;
  createdAt?: string;
}
