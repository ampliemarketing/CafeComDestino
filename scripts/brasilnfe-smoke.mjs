// ============================================================================
// Smoke test da emissora Brasil NFe — Fase 0 (ISOLADO, não toca no app).
//
// Monta um payload de NFC-e (modelo 65) MÍNIMO em ambiente de HOMOLOGAÇÃO e
// chama EnviarNotaFiscal. Serve para:
//   • validar Token / UserToken / CSC / certificado A1;
//   • descobrir o formato exato dos campos (a doc REST pública é resumida);
//   • ver a DANFCE de homologação sair.
//
// O XML e o PDF retornados são salvos em ./scratch-nfce-*.{xml,pdf}.
//
// Como rodar:
//   BRASILNFE_TOKEN=...  BRASILNFE_USER_TOKEN=...  BRASILNFE_CSC=...  \
//   BRASILNFE_CSC_ID=000001  node scripts/brasilnfe-smoke.mjs
//
// Opcionais:
//   BRASILNFE_BASE_URL   (default https://api.brasilnfe.com.br/services/)
//   CNPJ, IE, UF, COD_MUNICIPIO, RAZAO_SOCIAL, SERIE
//
// ⚠️ Antes disso a empresa + certificado A1 precisam estar cadastrados na
//    Brasil NFe (painel deles ou SDK — módulo Empresa, usa o UserToken).
// ============================================================================
import { writeFileSync } from 'node:fs';

const BASE = (process.env.BRASILNFE_BASE_URL ?? 'https://api.brasilnfe.com.br/services/').replace(/\/*$/, '/');
const TOKEN = process.env.BRASILNFE_TOKEN;
const USER_TOKEN = process.env.BRASILNFE_USER_TOKEN ?? '';
const CSC = process.env.BRASILNFE_CSC ?? '';
const CSC_ID = process.env.BRASILNFE_CSC_ID ?? '';

if (!TOKEN) {
  console.error('Faltou BRASILNFE_TOKEN. Veja o cabeçalho do arquivo.');
  process.exit(1);
}

const only = (v) => String(v ?? '').replace(/\D/g, '');

const MODELO = Number(process.env.MODELO) || 65; // 65 NFC-e · 55 NF-e (diagnóstico)
const AMBIENTE = Number(process.env.AMBIENTE) || 2; // 2 homologação · 1 PRODUÇÃO (gera nota fiscal real!)

const payload = {
  TipoAmbiente: AMBIENTE,
  IdentificadorInterno: `SMOKE-${Date.now()}`,
  ModeloDocumento: MODELO,
  Serie: Number(process.env.SERIE) || 1,
  Finalidade: 1,
  NaturezaOperacao: 'Venda ao consumidor',
  ConsumidorFinal: true,
  IndicadorPresenca: 1,
  EnviarEmail: false,
  Emitente: {
    CpfCnpj: only(process.env.CNPJ) || '00000000000191',
    InscricaoEstadual: only(process.env.IE) || '',
    RazaoSocial: process.env.RAZAO_SOCIAL || 'EMPRESA TESTE LTDA',
    NomeFantasia: process.env.RAZAO_SOCIAL || 'EMPRESA TESTE',
    CRT: 1,
    Endereco: {
      Logradouro: 'RUA TESTE',
      Numero: '100',
      Bairro: 'CENTRO',
      CodMunicipio: only(process.env.COD_MUNICIPIO) || '3550308',
      Municipio: 'SAO PAULO',
      UF: process.env.UF || 'SP',
      Cep: '01001000',
    },
  },
  IdTokenCsc: MODELO === 65 ? (CSC_ID || undefined) : undefined, // CSC só existe para NFC-e (QR Code)
  Csc: MODELO === 65 ? (CSC || undefined) : undefined,
  Produtos: [
    {
      CodProdutoServico: 'TESTE-1',
      NmProduto: 'PRODUTO TESTE NFC-E',
      EAN: 'SEM GTIN',
      NCM: '21069090',
      CFOP: '5102',
      UnidadeComercial: 'UN',
      UnidadeComercialTributavel: 'UN',
      Quantidade: 1,
      QuantidadeTributavel: 1,
      ValorUnitario: 1.0,
      ValorUnitarioTributavel: 1.0,
      ValorTotal: 1.0,
      ValorDesconto: 0,
      OrigemProduto: 0,
      Imposto: {
        ICMS: { CodSituacaoTributaria: '102', AliquotaICMS: 0 },
        PIS: { CodSituacaoTributaria: '49', Aliquota: 0 },
        COFINS: { CodSituacaoTributaria: '49', Aliquota: 0 },
      },
    },
  ],
  Pagamentos: [{ IndicadorPagamento: 0, FormaPagamento: '01', VlPago: 1.0 }],
  InformacoesAdicionais: 'Smoke test - documento sem valor fiscal (homologacao).',
  // NF-e (modelo 55) exige destinatário; CPF de teste com dígito verificador válido.
  ...(MODELO === 55
    ? {
        Cliente: {
          CpfCnpj: '11144477735',
          NmCliente: 'CONSUMIDOR TESTE',
          IndicadorIE: 9,
          Endereco: {
            Logradouro: 'RUA TESTE',
            Numero: '100',
            Bairro: 'CENTRO',
            CodMunicipio: only(process.env.COD_MUNICIPIO) || '5218805',
            Municipio: 'RIO VERDE',
            UF: process.env.UF || 'GO',
            Cep: '75901000',
          },
        },
      }
    : {}),
};

console.log('POST', `${BASE}Fiscal/EnviarNotaFiscal`);
console.log(JSON.stringify(payload, null, 2));

const resp = await fetch(`${BASE}Fiscal/EnviarNotaFiscal`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Token: TOKEN,
    ...(USER_TOKEN ? { UserToken: USER_TOKEN } : {}),
  },
  body: JSON.stringify(payload),
});

const body = await resp.json().catch(() => null);
console.log('\nHTTP', resp.status);
console.log(JSON.stringify(body, null, 2));

const ret = body?.returnNF ?? body?.ReturnNF ?? body ?? {};
const pick = (...ks) => {
  for (const k of ks) {
    for (const key of Object.keys(ret)) {
      if (key.toLowerCase() === k.toLowerCase() && ret[key] != null) return ret[key];
    }
  }
  return undefined;
};

const stamp = Date.now();
const xml = pick('base64Xml', 'xml');
const pdf = pick('base64File', 'danfe', 'pdf');
if (xml) { writeFileSync(`scratch-nfce-${stamp}.xml`, Buffer.from(xml, 'base64')); console.log(`\n→ scratch-nfce-${stamp}.xml`); }
if (pdf) { writeFileSync(`scratch-nfce-${stamp}.pdf`, Buffer.from(pdf, 'base64')); console.log(`→ scratch-nfce-${stamp}.pdf`); }

const cStat = pick('codStatusRespostaSefaz', 'CodStatusRespostaSefaz');
const xMotivo = pick('dsStatusRespostaSefaz', 'mensagem', 'message');
console.log(`\nSEFAZ ${cStat ?? '?'}: ${xMotivo ?? '(sem mensagem)'}`);
process.exit(resp.ok && (cStat === '100' || cStat === 100) ? 0 : 1);
