// Constantes e helpers fiscais compartilhados pelo cadastro de produto (aba
// Fiscal) e pelo editor de Grupos Tributários. O objetivo é reunir num só lugar
// as listas de códigos (origem, CST/CSOSN, CST PIS/COFINS, CFOP) e as regras de
// "quais campos são obrigatórios" antes de mandar o item pro emissor de NF.

import type { FiscalData, Product, TaxGroup } from '../types';

// ---------------------------------------------------------------------------
// Valor padrão / vazio
// ---------------------------------------------------------------------------
export const emptyFiscalData = (): FiscalData => ({
  origem: '0',
  ncm: '',
  cest: '',
  cfop: '5102',
  gtin: '',
  unidadeTributavel: '',
  cstCsosn: '102',
  aliqIcms: 0,
  temSt: false,
  aliqFcp: 0,
  cstPis: '49',
  aliqPis: 0,
  cstCofins: '49',
  aliqCofins: 0,
  cstIpi: '',
  aliqIpi: 0,
  codEnquadramentoIpi: '',
  cBenef: '',
  infAdicional: '',
});

/** Normaliza um `fiscal` possivelmente incompleto (linhas antigas) para a forma atual. */
export const normalizeFiscalData = (f?: Partial<FiscalData> | null): FiscalData => ({
  ...emptyFiscalData(),
  ...(f || {}),
});

// ---------------------------------------------------------------------------
// Listas de códigos
// ---------------------------------------------------------------------------
export const ORIGEM_OPTIONS: { value: string; label: string }[] = [
  { value: '0', label: '0 - Nacional (exceto 3, 4, 5 e 8)' },
  { value: '1', label: '1 - Estrangeira - Importação direta (exceto 6)' },
  { value: '2', label: '2 - Estrangeira - Adquirida no mercado interno (exceto 7)' },
  { value: '3', label: '3 - Nacional, importação de 40% a 70%' },
  { value: '4', label: '4 - Nacional, produção conforme processos produtivos básicos' },
  { value: '5', label: '5 - Nacional, importação inferior a 40%' },
  { value: '6', label: '6 - Estrangeira - Importação direta, sem similar nacional (lista CAMEX)' },
  { value: '7', label: '7 - Estrangeira - Mercado interno, sem similar nacional (lista CAMEX)' },
  { value: '8', label: '8 - Nacional, importação superior a 70%' },
];

// CSOSN (Simples Nacional) + CST de ICMS (regime normal). O campo é único
// (`cstCsosn`) — o contador escolhe conforme o regime da empresa.
export const CSOSN_OPTIONS: { value: string; label: string }[] = [
  { value: '101', label: '101 - Tributada pelo Simples com permissão de crédito' },
  { value: '102', label: '102 - Tributada pelo Simples sem permissão de crédito' },
  { value: '103', label: '103 - Isenção do ICMS no Simples para faixa de receita' },
  { value: '201', label: '201 - Simples com crédito e com cobrança de ICMS por ST' },
  { value: '202', label: '202 - Simples sem crédito e com cobrança de ICMS por ST' },
  { value: '203', label: '203 - Isenção do ICMS no Simples, com cobrança por ST' },
  { value: '300', label: '300 - Imune' },
  { value: '400', label: '400 - Não tributada pelo Simples Nacional' },
  { value: '500', label: '500 - ICMS cobrado anteriormente por ST ou antecipação' },
  { value: '900', label: '900 - Outros (Simples Nacional)' },
];

export const CST_ICMS_OPTIONS: { value: string; label: string }[] = [
  { value: '00', label: '00 - Tributada integralmente' },
  { value: '10', label: '10 - Tributada e com cobrança do ICMS por ST' },
  { value: '20', label: '20 - Com redução de base de cálculo' },
  { value: '30', label: '30 - Isenta/não tributada e com cobrança do ICMS por ST' },
  { value: '40', label: '40 - Isenta' },
  { value: '41', label: '41 - Não tributada' },
  { value: '50', label: '50 - Suspensão' },
  { value: '51', label: '51 - Diferimento' },
  { value: '60', label: '60 - ICMS cobrado anteriormente por ST' },
  { value: '70', label: '70 - Com redução de base e cobrança do ICMS por ST' },
  { value: '90', label: '90 - Outras' },
];

// CST de PIS/COFINS (tabela única — os códigos valem para os dois tributos).
export const CST_PIS_COFINS_OPTIONS: { value: string; label: string }[] = [
  { value: '01', label: '01 - Operação tributável - alíquota básica' },
  { value: '02', label: '02 - Operação tributável - alíquota diferenciada' },
  { value: '03', label: '03 - Operação tributável - por unidade de medida' },
  { value: '04', label: '04 - Operação tributável - monofásica - alíquota zero' },
  { value: '05', label: '05 - Operação tributável - ST' },
  { value: '06', label: '06 - Operação tributável - alíquota zero' },
  { value: '07', label: '07 - Operação isenta da contribuição' },
  { value: '08', label: '08 - Operação sem incidência da contribuição' },
  { value: '09', label: '09 - Operação com suspensão da contribuição' },
  { value: '49', label: '49 - Outras operações de saída' },
  { value: '99', label: '99 - Outras operações' },
];

// Sugestões de CFOP de saída mais comuns em bar/café/restaurante.
export const CFOP_SAIDA_SUGESTOES: { value: string; label: string }[] = [
  { value: '5101', label: '5101 - Venda de produção do estabelecimento' },
  { value: '5102', label: '5102 - Venda de mercadoria adquirida de terceiros' },
  { value: '5103', label: '5103 - Venda de produção - não incidência do ICMS' },
  { value: '5104', label: '5104 - Venda de mercadoria de terceiros - não incidência' },
  { value: '5405', label: '5405 - Venda de mercadoria com ICMS por ST (contribuinte substituído)' },
  { value: '5656', label: '5656 - Venda de combustível/lubrificante adquirido de terceiros' },
  { value: '5933', label: '5933 - Prestação de serviço tributado pelo ISSQN' },
  { value: '6101', label: '6101 - Venda de produção do estabelecimento (interestadual)' },
  { value: '6102', label: '6102 - Venda de mercadoria de terceiros (interestadual)' },
  { value: '6108', label: '6108 - Venda de mercadoria a não contribuinte (interestadual)' },
  { value: '6404', label: '6404 - Venda de mercadoria com ICMS por ST a consumidor final (interestadual)' },
];

// ---------------------------------------------------------------------------
// Validação: quais campos precisam estar preenchidos antes de emitir
// ---------------------------------------------------------------------------
const onlyDigits = (v: string) => (v || '').replace(/\D/g, '');

/** Campos obrigatórios que estão inválidos/vazios, como mapa de booleanos. */
export interface FiscalFieldErrors {
  origem?: boolean;
  ncm?: boolean;
  cfop?: boolean;
  cest?: boolean;
  cstCsosn?: boolean;
  cstPis?: boolean;
  aliqPis?: boolean;
  cstCofins?: boolean;
  aliqCofins?: boolean;
}

const FISCAL_FIELD_LABELS: Record<keyof FiscalFieldErrors, string> = {
  origem: 'Origem da mercadoria',
  ncm: 'NCM',
  cfop: 'CFOP',
  cest: 'CEST',
  cstCsosn: 'CST / CSOSN de ICMS',
  cstPis: 'CST de PIS',
  aliqPis: 'Alíquota de PIS',
  cstCofins: 'CST de COFINS',
  aliqCofins: 'Alíquota de COFINS',
};

export const fiscalFieldErrors = (f: FiscalData): FiscalFieldErrors => ({
  origem: !f.origem,
  ncm: onlyDigits(f.ncm).length !== 8,
  cfop: onlyDigits(f.cfop).length !== 4,
  cest: !!f.temSt && onlyDigits(f.cest || '').length !== 7,
  cstCsosn: !f.cstCsosn,
  cstPis: !f.cstPis,
  aliqPis: f.aliqPis == null || Number.isNaN(f.aliqPis),
  cstCofins: !f.cstCofins,
  aliqCofins: f.aliqCofins == null || Number.isNaN(f.aliqCofins),
});

/** Retorna a lista de rótulos de campos obrigatórios que estão faltando. */
export const fiscalMissingFields = (f: FiscalData): string[] => {
  const errs = fiscalFieldErrors(f);
  return (Object.keys(FISCAL_FIELD_LABELS) as (keyof FiscalFieldErrors)[])
    .filter((k) => errs[k])
    .map((k) => FISCAL_FIELD_LABELS[k]);
};

export const isFiscalComplete = (f: FiscalData): boolean => fiscalMissingFields(f).length === 0;

// ---------------------------------------------------------------------------
// Resolução dos dados fiscais efetivos de um produto
// ---------------------------------------------------------------------------
/**
 * Dados fiscais que valem para o produto na hora de emitir a nota.
 * Se o produto está vinculado a um Grupo Tributário, o grupo manda — os dados
 * do grupo são a fonte de verdade e o `product.fiscal` é só um espelho/fallback.
 */
export const resolveProductFiscal = (
  product: Pick<Product, 'fiscal' | 'taxGroupId'>,
  taxGroups: TaxGroup[],
): FiscalData => {
  if (product.taxGroupId) {
    const group = taxGroups.find((g) => g.id === product.taxGroupId);
    if (group) return normalizeFiscalData(group.fiscal);
  }
  return normalizeFiscalData(product.fiscal);
};
