import { 
  CompanyProfileData, 
  User, 
  Category, 
  Product, 
  Ingredient, 
  TechnicalSheet, 
  DiningTable, 
  Order, 
  CashShift, 
  Supplier, 
  LossRecord, 
  CourtesyRecord,
  Printer, 
  DeliveryDriver, 
  AuditLog 
} from '../types';

export const initialCompanyProfile: CompanyProfileData = {
  name: 'CAFÉ COM DESTINO',
  tradeName: 'CAFÉ COM DESTINO',
  cnpj: '12.345.678/0001-90',
  ie: '123.456.789.110',
  logoUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=300&q=80',
  coverUrl: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=1200&q=80',
  primaryColor: '#7C4A27',
  phone: '(11) 3456-7890',
  whatsapp: '(11) 98765-4321',
  email: 'contato@cafecomdestino.com.br',
  instagram: '@cafecomdestino_oficial',
  website: 'www.cafecomdestino.com.br',
  address: {
    street: 'Av. Paulista',
    number: '1200',
    complement: 'Térreo - Loja 4',
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01310-100',
  },
  operatingHours: 'Segunda a Sábado - 07:00 às 20:00',
  avgPrepTimeMinutes: 15,
  minOrderValue: 15.00,
  deliveryFee: 6.90,
  buffetPrices: {
    lunchPricePerKg: 80.00,
    breakfastPricePerKg: 54.99,
    plateTareGrams: 200,
  },
  servedNeighborhoods: ['Bela Vista', 'Jardins', 'Paraíso', 'Pinheiros', 'Itaim Bibi'],
  pixKey: '12.345.678/0001-90 (CNPJ)',
  bankInfo: {
    bank: 'Banco Itaú (341)',
    agency: '1234',
    account: '56789-0',
    holder: 'CAFÉ COM DESTINO Ltda',
    doc: '12.345.678/0001-90',
  },
  fiscalInfo: {
    crt: '1 - Simples Nacional',
    environment: 'homologation',
    certStatus: 'valid',
    certExpirationDate: '2027-12-31',
    nfceSeries: 1,
    nfceNextNumber: 1042,
  },
};

export const initialUsers: User[] = [
  { id: 'usr-1', name: 'Carlos Andrade', email: 'carlos.admin@cafecomdestino.com', role: 'admin', active: true, code: '1010', phone: '(11) 91111-1000' },
  { id: 'usr-2', name: 'Juliana Lima', email: 'juliana.gerente@cafecomdestino.com', role: 'gerente', active: true, code: '2020', phone: '(11) 92222-2000' },
  { id: 'usr-3', name: 'Roberto Silva', email: 'roberto.caixa@cafecomdestino.com', role: 'caixa', active: true, code: '3030', phone: '(11) 93333-3000' },
  { id: 'usr-4', name: 'Matheus Costa', email: 'matheus.garcom@cafecomdestino.com', role: 'garcom', active: true, code: '4040', phone: '(11) 94444-4000' },
  { id: 'usr-5', name: 'Chef Fernandes', email: 'cozinha@cafecomdestino.com', role: 'cozinha', active: true, code: '5050', phone: '(11) 95555-5000' },
  { id: 'usr-6', name: 'Ana Souza', email: 'estoque@cafecomdestino.com', role: 'estoque', active: true, code: '6060', phone: '(11) 96666-6000' },
  { id: 'usr-7', name: 'Mariana Santos', email: 'financeiro@cafecomdestino.com', role: 'financeiro', active: true, code: '7070', phone: '(11) 97777-7000' },
];

export const initialCategories: Category[] = [
  { id: 'cat-1', name: 'Marmitex & Quentinhas', icon: 'Box', description: 'Marmitas preparadas na hora com tempero caseiro e churrasco', order: 1, active: true },
  { id: 'cat-2', name: 'Buffet & Self-Service', icon: 'Utensils', description: 'Buffet completo no quilo ou livre para café da manhã e almoço', order: 2, active: true },
  { id: 'cat-3', name: 'Cafés & Salgados', icon: 'Coffee', description: 'Café expresso / passado e salgados artesanais quentinhos', order: 3, active: true },
  { id: 'cat-4', name: 'Sobremesas', icon: 'IceCream', description: 'Doces artesanais e sobremesas da casa', order: 4, active: true },
  { id: 'cat-5', name: 'Bebidas & Sucos', icon: 'CupSoda', description: 'Sucos naturais, refrigerantes e bebidas geladas', order: 5, active: true },
  { id: 'cat-6', name: 'Adicionais & Acompanhamentos', icon: 'PlusCircle', description: 'Porções extras de carnes, vinagrete e adicionais', order: 6, active: true },
];

export const initialIngredients: Ingredient[] = [
  { id: 'ing-1', name: 'Cortes Nobres de Churrasco (Picanha/Alcatra)', category: 'carnes', stockQuantity: 35.0, minStock: 10.0, unit: 'KG', avgCostUnit: 48.00, expiryDate: '2026-08-10' },
  { id: 'ing-2', name: 'Pó de Café Gourmet', category: 'outros', stockQuantity: 15.0, minStock: 3.0, unit: 'KG', avgCostUnit: 35.00, expiryDate: '2026-08-20' },
  { id: 'ing-3', name: 'Queijo Mussarela Fatiado', category: 'laticinios', stockQuantity: 12.0, minStock: 4.0, unit: 'KG', avgCostUnit: 38.50, expiryDate: '2026-08-15' },
  { id: 'ing-4', name: 'Feijão Carioca Caseiro', category: 'hortifruti', stockQuantity: 25.0, minStock: 8.0, unit: 'KG', avgCostUnit: 8.00, expiryDate: '2026-08-25' },
  { id: 'ing-5', name: 'Arroz Branco Soltinho', category: 'outros', stockQuantity: 50.0, minStock: 15.0, unit: 'KG', avgCostUnit: 5.50, expiryDate: '2026-08-30' },
  { id: 'ing-6', name: 'Refrigerante Guaraná 2L', category: 'bebidas', stockQuantity: 36, minStock: 12, unit: 'UN', avgCostUnit: 5.50 },
  { id: 'ing-7', name: 'Massa para Salgados Folhados', category: 'outros', stockQuantity: 10.0, minStock: 3.0, unit: 'KG', avgCostUnit: 18.00 },
  { id: 'ing-8', name: 'Embalagem Marmita Alumínio / Isopor', category: 'embalagens', stockQuantity: 250, minStock: 50, unit: 'UN', avgCostUnit: 0.90 },
  { id: 'ing-9', name: 'Linguiça Toscano para Churrasco', category: 'carnes', stockQuantity: 18.0, minStock: 5.0, unit: 'KG', avgCostUnit: 22.00 },
];

export const initialProducts: Product[] = [
  {
    id: 'prod-marmita-1',
    code: '101',
    barcode: '7891234560010',
    name: 'Marmitex Sem Churrasco',
    categoryId: 'cat-1',
    description: 'Arroz soltinho, feijão caseiro, opção de carne cozida ou grelhada, legumes, farofa e salada do dia.',
    price: 20.00,
    costPrice: 7.50,
    unit: 'UN',
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
    available: true,
    trackStock: true,
    stockQuantity: 80,
    minStock: 15,
    additions: [
      { id: 'add-1', name: 'Ovo frito caipira', price: 4.00 },
      { id: 'add-2', name: 'Porção extra de feijão', price: 5.00 },
    ],
    fiscal: {
      ncm: '2106.90.90',
      cfop: '5102',
      cest: '1704200',
      cstCsosn: '102',
      taxPercentage: 4.5,
    }
  },
  {
    id: 'prod-marmita-2',
    code: '102',
    barcode: '7891234560027',
    name: 'Marmitex Com Churrasco',
    categoryId: 'cat-1',
    description: 'Arroz, feijão, mandioca/fritas, salada fresca e cortes variados no churrasco de carvão.',
    price: 25.00,
    costPrice: 9.50,
    unit: 'UN',
    imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80',
    available: true,
    trackStock: true,
    stockQuantity: 70,
    minStock: 15,
    additions: [
      { id: 'add-3', name: 'Porção extra de Churrasco', price: 10.00 },
      { id: 'add-4', name: 'Maionese caseira', price: 4.00 },
    ],
    fiscal: {
      ncm: '2106.90.90',
      cfop: '5102',
      cstCsosn: '102',
      taxPercentage: 4.5,
    }
  },
  {
    id: 'prod-marmita-3',
    code: '103',
    barcode: '7891234560034',
    name: 'Marmitex Especial Com Churrasco (Grande)',
    categoryId: 'cat-1',
    description: 'Tamanho família/reforçado. Acompanha arroz, feijão tropeiro, vinagrete, maionese, mandioca frita e porção farta de churrasco misto.',
    price: 30.00,
    costPrice: 11.80,
    unit: 'UN',
    imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
    available: true,
    trackStock: true,
    stockQuantity: 60,
    minStock: 10,
    additions: [
      { id: 'add-5', name: 'Queijo coalho assado', price: 6.00 },
    ],
    fiscal: {
      ncm: '2106.90.90',
      cfop: '5102',
      cstCsosn: '102',
      taxPercentage: 4.5,
    }
  },
  {
    id: 'prod-salgado-1',
    code: '104',
    barcode: '7891234560041',
    name: 'Salgados Variados',
    categoryId: 'cat-3',
    description: 'Coxinha de frango, pão de queijo quentinho, empada de palmito, folhado de presunto e queijo ou enroladinho de salsicha.',
    price: 10.00,
    costPrice: 3.50,
    unit: 'UN',
    imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80',
    available: true,
    trackStock: true,
    stockQuantity: 120,
    minStock: 20,
    fiscal: {
      ncm: '1905.90.90',
      cfop: '5102',
      cstCsosn: '102',
      taxPercentage: 4.5,
    }
  },
  {
    id: 'prod-cafe-1',
    code: '105',
    barcode: '7891234560058',
    name: 'Café Expresso / Passado',
    categoryId: 'cat-3',
    description: 'Café fresquinho de grãos selecionados, tirado na hora ou coado tradicional.',
    price: 3.00,
    costPrice: 0.60,
    unit: 'UN',
    imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
    available: true,
    trackStock: true,
    stockQuantity: 200,
    minStock: 30,
    fiscal: {
      ncm: '0901.21.00',
      cfop: '5102',
      cstCsosn: '102',
      taxPercentage: 4.5,
    }
  },
  {
    id: 'prod-buffet-1',
    code: '106',
    barcode: '7891234560065',
    name: 'Self-Service Café da Manhã (Livre)',
    categoryId: 'cat-2',
    description: 'Buffet livre de café da manhã: pães, bolos da casa, frios, tapioca, frutas, ovos mexidos, sucos e cafés à vontade.',
    price: 34.99,
    costPrice: 12.00,
    unit: 'UN',
    imageUrl: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=600&q=80',
    available: true,
    trackStock: false,
    stockQuantity: 100,
    minStock: 10,
    fiscal: {
      ncm: '2106.90.90',
      cfop: '5102',
      cstCsosn: '102',
      taxPercentage: 4.5,
    }
  },
  {
    id: 'prod-buffet-2',
    code: '107',
    barcode: '7891234560072',
    name: 'Self-Service Almoço (Livre)',
    categoryId: 'cat-2',
    description: 'Buffet livre no almoço com variedade de pratos quentes, churrasco na grelha, saladas nobres e acompanhamentos.',
    price: 40.00,
    costPrice: 14.50,
    unit: 'UN',
    imageUrl: 'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=600&q=80',
    available: true,
    trackStock: false,
    stockQuantity: 100,
    minStock: 10,
    fiscal: {
      ncm: '2106.90.90',
      cfop: '5102',
      cstCsosn: '102',
      taxPercentage: 4.5,
    }
  },
  {
    id: 'prod-kg-almoco',
    code: '110',
    barcode: '7891234560110',
    name: 'Almoço Por Quilo (R$ 80,00/kg)',
    categoryId: 'cat-2',
    description: 'Buffet de almoço pesado na balança. R$ 80,00 o quilo.',
    price: 80.00,
    costPrice: 22.00,
    unit: 'KG',
    imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
    available: true,
    trackStock: false,
    stockQuantity: 999,
    minStock: 10,
    fiscal: {
      ncm: '2106.90.90',
      cfop: '5102',
      cstCsosn: '102',
      taxPercentage: 4.5,
    }
  },
  {
    id: 'prod-kg-cafe',
    code: '111',
    barcode: '7891234560111',
    name: 'Café da Manhã Por Quilo (R$ 54,99/kg)',
    categoryId: 'cat-2',
    description: 'Buffet de café da manhã pesado na balança. R$ 54,99 o quilo.',
    price: 54.99,
    costPrice: 15.00,
    unit: 'KG',
    imageUrl: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80',
    available: true,
    trackStock: false,
    stockQuantity: 999,
    minStock: 10,
    fiscal: {
      ncm: '2106.90.90',
      cfop: '5102',
      cstCsosn: '102',
      taxPercentage: 4.5,
    }
  },
  {
    id: 'prod-doces-1',
    code: '108',
    barcode: '7891234560089',
    name: 'Petit Gâteau de Doce de Leite',
    categoryId: 'cat-4',
    description: 'Bolo quente de doce de leite artesanal com sorvete de creme.',
    price: 24.90,
    costPrice: 8.00,
    unit: 'UN',
    imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80',
    available: true,
    trackStock: true,
    stockQuantity: 25,
    minStock: 5,
    fiscal: {
      ncm: '1905.90.90',
      cfop: '5102',
      cstCsosn: '102',
      taxPercentage: 4.5,
    }
  },
  {
    id: 'prod-suco-1',
    code: '109',
    barcode: '7891234560096',
    name: 'Suco Natural Laranja 500ml',
    categoryId: 'cat-5',
    description: 'Suco 100% fruta espremido na hora.',
    price: 11.00,
    costPrice: 3.20,
    unit: 'UN',
    imageUrl: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80',
    available: true,
    trackStock: true,
    stockQuantity: 80,
    minStock: 15,
    fiscal: {
      ncm: '2009.12.00',
      cfop: '5102',
      cstCsosn: '102',
      taxPercentage: 4.5,
    }
  },
];

export const initialTechnicalSheets: TechnicalSheet[] = [
  {
    productId: 'prod-marmita-2',
    ingredients: [
      { ingredientId: 'ing-1', quantityUsed: 0.200, unit: 'KG' }, // 200g churrasco
      { ingredientId: 'ing-5', quantityUsed: 0.150, unit: 'KG' }, // 150g arroz
      { ingredientId: 'ing-4', quantityUsed: 0.100, unit: 'KG' }, // 100g feijao
      { ingredientId: 'ing-8', quantityUsed: 1, unit: 'UN' },     // embalagem
    ],
    servingsYield: 1,
    totalCost: 9.50,
    marginPercent: 62.0,
  },
  {
    productId: 'prod-cafe-1',
    ingredients: [
      { ingredientId: 'ing-2', quantityUsed: 0.015, unit: 'KG' }, // 15g po de cafe
    ],
    servingsYield: 1,
    totalCost: 0.60,
    marginPercent: 80.0,
  }
];

export const initialTables: DiningTable[] = [
  {
    id: 'tb-1',
    number: 1,
    sector: 'Salão Principal',
    capacity: 2,
    status: 'ocupada',
    guestCount: 2,
    clientName: 'Fernando & Ana',
    openedAt: '12:15',
    waiterId: 'usr-4',
    waiterName: 'Matheus Costa',
    subtotal: 91.00,
    items: [
      { id: 'item-101', productId: 'prod-buffet-2', productName: 'Self-Service Almoço', quantity: 2, unitPrice: 40.00, additions: [], notes: 'Churrasco no ponto', status: 'em_preparo', createdAt: '12:18', waiterName: 'Matheus' },
      { id: 'item-102', productId: 'prod-suco-1', productName: 'Suco Natural Laranja 500ml', quantity: 1, unitPrice: 11.00, additions: [], notes: 'Sem açúcar', status: 'entregue', createdAt: '12:16', waiterName: 'Matheus' },
    ]
  },
  {
    id: 'tb-2',
    number: 2,
    sector: 'Salão Principal',
    capacity: 4,
    status: 'pedido_pronto',
    guestCount: 3,
    clientName: 'Família Oliveira',
    openedAt: '12:30',
    waiterId: 'usr-4',
    waiterName: 'Matheus Costa',
    subtotal: 81.00,
    items: [
      { id: 'item-201', productId: 'prod-marmita-2', productName: 'Marmitex Com Churrasco', quantity: 3, unitPrice: 25.00, additions: [], notes: 'Bem servida', status: 'pronto', createdAt: '12:32', waiterName: 'Matheus' },
      { id: 'item-202', productId: 'prod-cafe-1', productName: 'Café Expresso / Passado', quantity: 2, unitPrice: 3.00, additions: [], status: 'pronto', createdAt: '12:33', waiterName: 'Matheus' },
    ]
  },
  { id: 'tb-3', number: 3, sector: 'Salão Principal', capacity: 4, status: 'livre', items: [], subtotal: 0 },
  { id: 'tb-4', number: 4, sector: 'Salão Principal', capacity: 6, status: 'livre', items: [], subtotal: 0 },
  {
    id: 'tb-5',
    number: 5,
    sector: 'Varanda',
    capacity: 2,
    status: 'aguardando_fechamento',
    guestCount: 2,
    clientName: 'Lucas Mendes',
    openedAt: '11:45',
    waiterId: 'usr-4',
    waiterName: 'Matheus Costa',
    subtotal: 54.90,
    items: [
      { id: 'item-501', productId: 'prod-marmita-3', productName: 'Marmitex Especial Com Churrasco (Grande)', quantity: 1, unitPrice: 30.00, additions: [], status: 'entregue', createdAt: '11:50', waiterName: 'Matheus' },
      { id: 'item-502', productId: 'prod-doces-1', productName: 'Petit Gâteau de Doce de Leite', quantity: 1, unitPrice: 24.90, additions: [], status: 'entregue', createdAt: '12:20', waiterName: 'Matheus' },
    ]
  },
  { id: 'tb-6', number: 6, sector: 'Varanda', capacity: 4, status: 'livre', items: [], subtotal: 0 },
  { id: 'tb-7', number: 7, sector: 'Área VIP', capacity: 8, status: 'livre', items: [], subtotal: 0 },
  { id: 'tb-8', number: 8, sector: 'Área VIP', capacity: 10, status: 'livre', items: [], subtotal: 0 },
];

export const initialOrders: Order[] = [
  {
    id: 'ord-1001',
    orderNumber: 1001,
    channel: 'online',
    customer: {
      name: 'Gabriel Siqueira',
      phone: '(11) 99887-6655',
      address: {
        street: 'Rua Augusta',
        number: '1450',
        neighborhood: 'Consolação',
        complement: 'Apto 82',
        reference: 'Próximo ao Metrô',
      }
    },
    items: [
      { id: 'oi-1', productId: 'prod-marmita-2', productName: 'Marmitex Com Churrasco', quantity: 2, unitPrice: 25.00, additions: [{ id: 'add-4', name: 'Maionese caseira', price: 4.00 }] },
      { id: 'oi-2', productId: 'prod-suco-1', productName: 'Suco Natural Laranja 500ml', quantity: 2, unitPrice: 11.00, additions: [] }
    ],
    serviceType: 'entrega',
    subtotal: 76.00,
    deliveryFee: 7.90,
    discount: 0,
    total: 83.90,
    paymentMethod: 'pix',
    paymentStatus: 'pagamento_aprovado',
    orderStatus: 'em_preparo',
    createdAt: '12:40',
    updatedAt: '12:42',
    tunaTransactionId: 'TUNA-TX-998811',
    waiterName: 'Pedido Online',
    notes: 'Entregar na portaria se demorar.',
    fiscalIssued: true,
    nfceKey: '35260712345678000190650010000010411234567890',
  },
  {
    id: 'ord-1002',
    orderNumber: 1002,
    channel: 'garcom',
    tableNumber: 1,
    customer: { name: 'Fernando & Ana', phone: '(11) 97111-2233' },
    items: [
      { id: 'oi-3', productId: 'prod-buffet-2', productName: 'Self-Service Almoço', quantity: 2, unitPrice: 40.00, additions: [] },
      { id: 'oi-4', productId: 'prod-suco-1', productName: 'Suco Natural Laranja 500ml', quantity: 1, unitPrice: 11.00, additions: [] }
    ],
    serviceType: 'consumo_local',
    subtotal: 91.00,
    deliveryFee: 0,
    discount: 0,
    total: 91.00,
    paymentMethod: 'pix',
    paymentStatus: 'aguardando_pagamento',
    orderStatus: 'em_preparo',
    createdAt: '12:18',
    updatedAt: '12:18',
    waiterName: 'Matheus Costa',
    notes: 'Churrasco bem passado',
    fiscalIssued: false,
  },
  {
    id: 'ord-1003',
    orderNumber: 1003,
    channel: 'pdv',
    customer: { name: 'Cliente Balcão', phone: '(11) 90000-0000' },
    items: [
      { id: 'oi-5', productId: 'prod-marmita-1', productName: 'Marmitex Sem Churrasco', quantity: 3, unitPrice: 20.00, additions: [] }
    ],
    serviceType: 'retirada',
    subtotal: 60.00,
    deliveryFee: 0,
    discount: 0,
    total: 60.00,
    paymentMethod: 'cartao_credito',
    paymentStatus: 'pagamento_aprovado',
    orderStatus: 'concluido',
    createdAt: '12:05',
    updatedAt: '12:10',
    notes: 'Embalagem bem lacrada',
    fiscalIssued: true,
    nfceKey: '35260712345678000190650010000010401234567891',
  },
];

export const initialCashShift: CashShift = {
  id: 'shift-101',
  openedBy: 'Roberto Silva (Caixa)',
  openedAt: '2026-07-29 08:30',
  initialFloat: 200.00,
  status: 'aberto',
  salesCash: 350.00,
  salesCard: 1280.50,
  salesPix: 890.00,
  additions: 50.00,
  withdrawals: 100.00,
  expectedTotal: 500.00, // 200 + 350 + 50 - 100
  notes: 'Caixa aberto sem divergências.',
};

export const initialSuppliers: Supplier[] = [
  { id: 'sup-1', name: 'Distribuidora Horta & Fruta', tradeName: 'HortaFruta SP', cnpjCpf: '98.765.432/0001-11', phone: '(11) 3222-1100', email: 'vendas@hortafrutasp.com', suppliedCategories: ['Hortifruti', 'Verduras'], contactPerson: 'Sr. Marcos' },
  { id: 'sup-2', name: 'Frigorifico Boi de Ouro', tradeName: 'Boi de Ouro Carnes', cnpjCpf: '87.654.321/0001-22', phone: '(11) 3333-4455', email: 'comercial@boideouro.com', suppliedCategories: ['Carnes', 'Cortes Nobres'], contactPerson: 'Dra. Claudia' },
  { id: 'sup-3', name: 'Embalagens Chef Pro', tradeName: 'ChefPro Embalagens', cnpjCpf: '76.543.210/0001-33', phone: '(11) 3444-5566', email: 'pedidos@chefpro.com.br', suppliedCategories: ['Embalagens', 'Descartáveis'], contactPerson: 'Lucas' },
];

export const initialLossRecords: LossRecord[] = [
  { 
    id: 'loss-1', 
    itemType: 'ingredient',
    itemId: 'ing-1',
    ingredientName: 'Cortes Nobres de Churrasco', 
    quantity: 1.2, 
    unit: 'KG', 
    costValue: 57.60, 
    reason: 'vencido', 
    registeredBy: 'Chef Fernandes', 
    registeredAt: '2026-08-05 16:30', 
    notes: 'Insumo passou da data de validade',
    employeeName: 'Chef Fernandes',
    sector: 'Cozinha'
  },
  { 
    id: 'loss-2', 
    itemType: 'product',
    itemId: 'prod-marmita-2',
    ingredientName: 'Marmitex Com Churrasco', 
    quantity: 2, 
    unit: 'UN', 
    costValue: 19.00, 
    reason: 'erro_preparo', 
    registeredBy: 'Juliana Lima', 
    registeredAt: '2026-08-05 12:45', 
    notes: 'Ponto da carne feito errado a pedido do cliente',
    employeeName: 'Matheus Costa',
    sector: 'Atendimento Salão'
  },
  { 
    id: 'loss-3', 
    itemType: 'ingredient',
    itemId: 'ing-6',
    ingredientName: 'Refrigerante Guaraná 2L', 
    quantity: 3, 
    unit: 'UN', 
    costValue: 16.50, 
    reason: 'queda_quebra', 
    registeredBy: 'Roberto Silva', 
    registeredAt: '2026-08-04 11:20', 
    notes: 'Garrafas caíram da prateleira ao descarregar',
    employeeName: 'Roberto Silva',
    sector: 'Estoque'
  }
];

export const initialCourtesyRecords: CourtesyRecord[] = [
  {
    id: 'crt-1',
    productId: 'prod-doces-1',
    productName: 'Petit Gâteau de Doce de Leite',
    quantity: 1,
    unitPrice: 24.90,
    costPrice: 8.00,
    totalRetailValue: 24.90,
    totalCostValue: 8.00,
    reason: 'aniversario',
    source: 'mesa',
    targetReference: 'Mesa #2',
    customerName: 'Família Oliveira',
    authorizedBy: 'Juliana Lima (Gerente)',
    registeredBy: 'Matheus Costa',
    registeredAt: '2026-08-05 13:10',
    notes: 'Cortesia de sobremesa de aniversário'
  },
  {
    id: 'crt-2',
    productId: 'prod-cafe-1',
    productName: 'Café Expresso / Passado',
    quantity: 2,
    unitPrice: 3.00,
    costPrice: 0.60,
    totalRetailValue: 6.00,
    totalCostValue: 1.20,
    reason: 'atraso',
    source: 'comanda',
    targetReference: 'Mesa #5',
    customerName: 'Lucas Mendes',
    authorizedBy: 'Carlos Andrade (Admin)',
    registeredBy: 'Matheus Costa',
    registeredAt: '2026-08-05 12:15',
    notes: 'Compensação por pequeno atraso no prato principal'
  }
];

export const initialPrinters: Printer[] = [
  { id: 'prt-1', name: 'Impressora Cozinha Central', location: 'cozinha', type: 'network', ipAddress: '192.168.1.201', paperWidth: '80mm', autoPrint: true, status: 'online' },
  { id: 'prt-2', name: 'Impressora Bar & Bebidas', location: 'bar', type: 'network', ipAddress: '192.168.1.202', paperWidth: '80mm', autoPrint: true, status: 'online' },
  { id: 'prt-3', name: 'NFC-e Caixa Principal', location: 'caixa', type: 'usb', paperWidth: '80mm', autoPrint: true, status: 'online' },
];

export const initialDeliveryDrivers: DeliveryDriver[] = [
  { id: 'drv-1', name: 'Rodrigo Motoboy', phone: '(11) 98111-9988', vehicle: 'Honda CG 160 Titan', plate: 'ABC-1234', active: true, currentDeliveries: 1 },
  { id: 'drv-2', name: 'Lucas Entregador', phone: '(11) 98222-7766', vehicle: 'Yamaha Factor 150', plate: 'XYZ-5678', active: true, currentDeliveries: 0 },
];

export const initialAuditLogs: AuditLog[] = [
  { id: 'log-1', userName: 'Carlos Andrade', userRole: 'admin', action: 'Login no sistema', module: 'Autenticação', timestamp: '2026-07-29 08:00', details: 'Acesso realizado pelo navegador Chrome/Desktop' },
  { id: 'log-2', userName: 'Roberto Silva', userRole: 'caixa', action: 'Abertura de Caixa', module: 'Controle de Caixa', timestamp: '2026-07-29 08:30', details: 'Valor inicial R$ 200,00' },
  { id: 'log-3', userName: 'Matheus Costa', userRole: 'garcom', action: 'Abertura de Mesa 1', module: 'Atendimento Salão', timestamp: '2026-07-29 12:15', details: '2 pessoas - Fernando & Ana' },
];
