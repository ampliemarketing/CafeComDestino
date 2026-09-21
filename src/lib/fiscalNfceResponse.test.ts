import { describe, it, expect } from 'vitest';
import { pickField, parseEnviarNotaFiscalResponse } from './fiscalNfceResponse';

// ===========================================================================
// Fixtures reais, capturadas de chamadas de verdade a `Fiscal/EnviarNotaFiscal`
// (Brasil NFe) em homologação, em 2026-09-20 — uma rejeitada (CSC não
// cadastrado na Sefaz) e uma autorizada, depois do CSC configurado na
// empresa. Servem de regressão para dois bugs reais encontrados nesse teste:
//   1) `protocolo` pegava o número da nota (`Numero`) em vez do protocolo de
//      autorização (`NumeroProtocolo`), e `numero` nunca era preenchido.
//   2) `Base64Xml`/`Base64File` vêm no nível raiz da resposta, não dentro de
//      `ReturnNF` — por isso nunca eram salvos, mesmo em notas autorizadas.
// ===========================================================================

const REJECTED_RESPONSE = {
  ReturnNF: {
    Numero: 1,
    Serie: 1,
    ChaveNF: '52260955103000000109650010000000011033761539',
    NumeroProtocolo: null,
    CodTipoAmbiente: 2,
    DsTipoAmbiente: 'Homologação',
    CodStatusRespostaSefaz: 462,
    DsStatusRespostaSefaz: 'Rejeição: Código Identificador do CSC no QR-Code não cadastrado na SEFAZ',
    Ok: false,
    Detalhes: { valorNf: 1, valorIcms: 0, valorIpi: 0, valorPis: 0, valorCofins: 0 },
  },
  Base64Xml: 'UEg1bVpWQnliMk1n', // trecho fictício — não usado nas asserções de conteúdo
  Error: null,
  Avisos: [],
};

const AUTHORIZED_RESPONSE = {
  ReturnNF: {
    Numero: 2,
    Serie: 1,
    ChaveNF: '52260955103000000109650010000000021033762702',
    NumeroProtocolo: '152260027708189',
    CodTipoAmbiente: 2,
    DsTipoAmbiente: 'Homologação',
    CodStatusRespostaSefaz: 100,
    DsStatusRespostaSefaz: 'Autorizado o uso da NF-e',
    Ok: true,
    Detalhes: { valorNf: 1, valorIcms: 0, valorIpi: 0, valorPis: 0, valorCofins: 0 },
  },
  Base64Xml: 'PG5mZVByb2MgdmVyc2FvPSI0LjAwIi8+', // XML de teste, truncado
  Base64File: 'JVBERi0xLjQK', // PDF de teste, truncado
  Error: null,
  Avisos: [],
};

describe('pickField', () => {
  it('é case-insensitive e prioriza a primeira chave que existir', () => {
    expect(pickField({ ChaveNF: 'abc' }, 'chaveNf', 'ChaveNF')).toBe('abc');
    expect(pickField({ chave: 'xyz' }, 'chaveNf', 'ChaveNF', 'chave')).toBe('xyz');
  });

  it('ignora null/undefined e retorna undefined se nada bater', () => {
    expect(pickField({ foo: null }, 'foo')).toBeUndefined();
    expect(pickField({}, 'foo')).toBeUndefined();
    expect(pickField(null, 'foo')).toBeUndefined();
  });
});

describe('parseEnviarNotaFiscalResponse — nota rejeitada (CSC não cadastrado)', () => {
  const parsed = parseEnviarNotaFiscalResponse(REJECTED_RESPONSE);

  it('não marca como autorizada', () => {
    expect(parsed.authorized).toBe(false);
    expect(parsed.cStat).toBe('462');
    expect(parsed.xMotivo).toContain('CSC no QR-Code não cadastrado');
  });

  it('ainda extrai a chave mesmo rejeitada', () => {
    expect(parsed.chave).toBe('52260955103000000109650010000000011033761539');
  });

  it('protocolo fica null quando a Sefaz não retorna NumeroProtocolo (regressão: não pode virar o número da nota)', () => {
    expect(parsed.protocolo).toBeNull();
    expect(parsed.protocolo).not.toBe(1);
    expect(parsed.protocolo).not.toBe('1');
  });

  it('numero da nota vem de "Numero", não fica null', () => {
    expect(parsed.numero).toBe(1);
  });
});

describe('parseEnviarNotaFiscalResponse — nota autorizada', () => {
  const parsed = parseEnviarNotaFiscalResponse(AUTHORIZED_RESPONSE);

  it('marca como autorizada quando cStat é 100', () => {
    expect(parsed.authorized).toBe(true);
    expect(parsed.cStat).toBe('100');
  });

  it('separa corretamente número da nota e protocolo de autorização (regressão)', () => {
    expect(parsed.numero).toBe(2);
    expect(parsed.protocolo).toBe('152260027708189');
    expect(parsed.numero).not.toBe(parsed.protocolo);
  });

  it('chave de acesso extraída corretamente', () => {
    expect(parsed.chave).toBe('52260955103000000109650010000000021033762702');
  });

  it('lê XML e DANFCE do nível raiz da resposta, não de dentro de ReturnNF (regressão)', () => {
    expect(parsed.xml).toBe('PG5mZVByb2MgdmVyc2FvPSI0LjAwIi8+');
    expect(parsed.danfe).toBe('JVBERi0xLjQK');
  });
});

// Capturada em produção (fiscal_invoices.provider_response) em 2026-09-21: a
// Brasil NFe rejeitou ANTES de mandar pra Sefaz porque `Pagamentos` somava
// mais que o valor da nota (o pedido tinha taxa de serviço/couvert, que não
// vira item na NFC-e — ver comentário em scalePaymentsToNoteTotal). `ReturnNF`
// vem todo zerado; o motivo de verdade só existe em `Error`.
const SCHEMA_REJECTED_RESPONSE = {
  Avisos: [],
  Base64File: null,
  Base64Xml: null,
  Error: 'Rejeição 866: Ausência de troco quando o valor dos pagamentos informados for maior que o total da nota. [vPago:43.80 - vNF:36.90]',
  ReturnNF: {
    ChaveNF: null,
    CodStatusRespostaSefaz: 0,
    CodTipoAmbiente: 0,
    Detalhes: { valorCofins: 0, valorIcms: 0, valorIpi: 0, valorNf: 0, valorPis: 0 },
    DsStatusRespostaSefaz: null,
    DsTipoAmbiente: null,
    Numero: 0,
    NumeroProtocolo: null,
    Ok: false,
    Serie: 0,
  },
};

describe('parseEnviarNotaFiscalResponse — rejeição de validação (Error no nível raiz, ReturnNF zerado)', () => {
  const parsed = parseEnviarNotaFiscalResponse(SCHEMA_REJECTED_RESPONSE);

  it('não marca como autorizada', () => {
    expect(parsed.authorized).toBe(false);
    expect(parsed.cStat).toBe('0');
  });

  it('usa o campo Error como motivo em vez de ficar vazio (regressão: virava "HTTP 200" na tela)', () => {
    expect(parsed.xMotivo).toContain('Rejeição 866');
    expect(parsed.xMotivo).toContain('Ausência de troco');
  });

  it('chave/protocolo/xml ficam null (nota nunca chegou na Sefaz)', () => {
    expect(parsed.chave).toBeNull();
    expect(parsed.protocolo).toBeNull();
    expect(parsed.xml).toBeNull();
  });
});

describe('parseEnviarNotaFiscalResponse — respostas incompletas/erro', () => {
  it('não quebra com corpo vazio ou nulo', () => {
    expect(() => parseEnviarNotaFiscalResponse(null)).not.toThrow();
    expect(() => parseEnviarNotaFiscalResponse({})).not.toThrow();
    const parsed = parseEnviarNotaFiscalResponse({});
    expect(parsed.authorized).toBe(false);
    expect(parsed.chave).toBeNull();
    expect(parsed.xml).toBeNull();
    expect(parsed.danfe).toBeNull();
  });

  it('quando falta Base64File (nota rejeitada não gera DANFCE), danfe fica null', () => {
    const parsed = parseEnviarNotaFiscalResponse(REJECTED_RESPONSE);
    expect(parsed.danfe).toBeNull();
  });
});
