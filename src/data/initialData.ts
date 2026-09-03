import {
  CompanyProfileData,
  LossRecord,
  CourtesyRecord,
  Printer,
  AuditLog
} from '../types';

// Categorias, produtos, ingredientes, ficha técnica, mesas, pedidos, caixa e
// usuários agora vêm do Supabase (ver src/context/AppContext.tsx) — não têm
// mais seed local aqui. Os módulos abaixo ainda não foram migrados e
// continuam persistidos no localStorage.

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
  serviceFeePercent: 0,
  serviceFeeEnabled: false,
  couvertValue: 0,
  couvertEnabled: false,
  blindConferenceThreshold: 10,
  discountLimits: { caixa: 5, gerente: 20, financeiro: 10, admin: 100 },
};

export const initialLossRecords: LossRecord[] = [];

export const initialCourtesyRecords: CourtesyRecord[] = [];

export const initialPrinters: Printer[] = [];

export const initialAuditLogs: AuditLog[] = [];
