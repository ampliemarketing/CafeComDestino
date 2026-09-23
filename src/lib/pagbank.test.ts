import { describe, it, expect } from 'vitest';
import {
  resolvePagBankBaseUrl,
  sanitizeForLog,
  parsePagBankOrderResponse,
  translateDeclineMessage,
  sha256Hex,
  verifyPagBankWebhookSignature,
  validatePagBankCustomer,
  PAGBANK_SANDBOX_BASE_URL,
  PAGBANK_PRODUCTION_BASE_URL,
} from './pagbank';

describe('resolvePagBankBaseUrl', () => {
  it('usa produção só quando PAGBANK_ENV é exatamente "production"', () => {
    expect(resolvePagBankBaseUrl('production')).toBe(PAGBANK_PRODUCTION_BASE_URL);
  });

  it('cai em sandbox para qualquer outro valor (inclusive vazio/indefinido) — nunca produção por engano', () => {
    expect(resolvePagBankBaseUrl('sandbox')).toBe(PAGBANK_SANDBOX_BASE_URL);
    expect(resolvePagBankBaseUrl(undefined)).toBe(PAGBANK_SANDBOX_BASE_URL);
    expect(resolvePagBankBaseUrl(null)).toBe(PAGBANK_SANDBOX_BASE_URL);
    expect(resolvePagBankBaseUrl('Production')).toBe(PAGBANK_SANDBOX_BASE_URL);
    expect(resolvePagBankBaseUrl('')).toBe(PAGBANK_SANDBOX_BASE_URL);
  });
});

describe('sanitizeForLog', () => {
  it('mascara campos sensíveis de cartão em qualquer nível de aninhamento', () => {
    const input = {
      referenceId: 'pgb_123',
      payment_method: {
        type: 'CREDIT_CARD',
        card: {
          encrypted: 'abc123secret',
          security_code: '123',
          holder: { name: 'João', tax_id: '12345678900' },
        },
      },
    };
    const out = sanitizeForLog(input) as any;
    expect(out.referenceId).toBe('pgb_123');
    expect(out.payment_method.type).toBe('CREDIT_CARD');
    expect(out.payment_method.card).toBe('[REDACTED]');
  });

  it('mascara variações de casing (snake_case e camelCase)', () => {
    const out = sanitizeForLog({ securityCode: '999', cvv: '111', encrypted: 'xxx' }) as any;
    expect(out.securityCode).toBe('[REDACTED]');
    expect(out.cvv).toBe('[REDACTED]');
    expect(out.encrypted).toBe('[REDACTED]');
  });

  it('não mexe em valores não sensíveis', () => {
    expect(sanitizeForLog({ amount: 1990, status: 'PAID' })).toEqual({ amount: 1990, status: 'PAID' });
  });

  it('percorre arrays preservando a estrutura', () => {
    const out = sanitizeForLog([{ card: 'x' }, { amount: 10 }]) as any[];
    expect(out[0].card).toBe('[REDACTED]');
    expect(out[1].amount).toBe(10);
  });
});

describe('parsePagBankOrderResponse', () => {
  // Fixture real, capturada de uma chamada de verdade a POST /orders no
  // sandbox do PagBank em 2026-09-22 — regressão pro formato correto: o QR
  // Code fica dentro de charges[0].qr_code (objeto único), e o link da
  // imagem fica em charges[0].links[] (rel "QRCODE.PNG"/"QRCODE.BASE64"),
  // NÃO num array `qr_codes` no nível raiz do pedido como uma primeira
  // suposição (não confirmada) tinha assumido.
  const REAL_PIX_WAITING_RESPONSE = {
    id: 'ORDE_26833C65-6F1C-429D-8F54-1559F606ED56',
    reference_id: 'pgb_smoketest_0002',
    charges: [{
      id: 'CHAR_A24F7DEB-364F-4163-982D-E3A87D6A7123',
      reference_id: 'pgb_smoketest_0002',
      status: 'WAITING',
      payment_response: { code: '20000', message: 'SUCESSO' },
      payment_method: { type: 'PIX', pix: { expiration_date: '2026-09-22T16:11:21.257Z' } },
      links: [
        { rel: 'SELF', href: 'https://sandbox.api.pagseguro.com/charges/CHAR_A24F7DEB-364F-4163-982D-E3A87D6A7123', media: 'application/json', type: 'GET' },
        { rel: 'QRCODE.PNG', href: 'https://sandbox.api.pagseguro.com/qrcode/QRCO_4564306E-35DC-46FC-8838-A85D1120437C/png', media: 'image/png', type: 'GET' },
        { rel: 'QRCODE.BASE64', href: 'https://sandbox.api.pagseguro.com/qrcode/QRCO_4564306E-35DC-46FC-8838-A85D1120437C/base64', media: 'text/plain', type: 'GET' },
      ],
      qr_code: {
        id: 'QRCO_4564306E-35DC-46FC-8838-A85D1120437C',
        text: '00020101021226850014br.gov.bcb.pix2563api-h.pagseguro.com/pix/v2/4564306E-35DC-46FC-8838-A85D1120437C5204899953039865802BR5922PEDRO VITOR MARQUES CA6009Rio Verde62070503***63045262',
      },
    }],
  };

  it('interpreta um pedido PIX aguardando pagamento com QR Code (fixture real de sandbox)', () => {
    const parsed = parsePagBankOrderResponse(REAL_PIX_WAITING_RESPONSE);
    expect(parsed).toMatchObject({
      orderId: 'ORDE_26833C65-6F1C-429D-8F54-1559F606ED56',
      chargeId: 'CHAR_A24F7DEB-364F-4163-982D-E3A87D6A7123',
      status: 'WAITING',
      qrCodeText: REAL_PIX_WAITING_RESPONSE.charges[0].qr_code.text,
      qrCodeImageUrl: 'https://sandbox.api.pagseguro.com/qrcode/QRCO_4564306E-35DC-46FC-8838-A85D1120437C/png',
    });
  });

  it('trata AUTHORIZED como PAID (captura sempre automática nesta integração)', () => {
    const parsed = parsePagBankOrderResponse({ id: 'x', charges: [{ id: 'c1', status: 'AUTHORIZED' }] });
    expect(parsed.status).toBe('PAID');
  });

  it('interpreta cartão recusado com código de recusa', () => {
    const body = {
      id: 'ORDE_9',
      charges: [{
        id: 'CHAR_9',
        status: 'DECLINED',
        payment_response: { code: '20001', message: 'Insufficient funds' },
      }],
    };
    const parsed = parsePagBankOrderResponse(body);
    expect(parsed.status).toBe('DECLINED');
    expect(parsed.declineCode).toBe('20001');
    expect(parsed.declineMessage).toBe('Insufficient funds');
  });

  it('devolve UNKNOWN e campos nulos para payload vazio/inesperado', () => {
    expect(parsePagBankOrderResponse(null)).toMatchObject({ orderId: null, chargeId: null, status: 'UNKNOWN' });
    expect(parsePagBankOrderResponse({})).toMatchObject({ status: 'UNKNOWN' });
  });
});

describe('verifyPagBankWebhookSignature', () => {
  // Vetor de referência gerado com node:crypto (sha256("token-body", 'hex')),
  // independente da implementação — regressão contra o mecanismo oficial
  // documentado em "Confirmar autenticidade da notificação".
  const TOKEN = 'test-token-abc123';
  const BODY = '{"id":"ORDE_123","charges":[{"id":"CHAR_1","status":"PAID"}]}';
  const EXPECTED_HASH = '63677fae5acddf212b0425085d1b460788bac46e749da80a5cd712f96cf24bc8';

  it('sha256Hex bate com o hash de referência (SHA-256 de "{token}-{body}")', async () => {
    expect(await sha256Hex(`${TOKEN}-${BODY}`)).toBe(EXPECTED_HASH);
    expect(EXPECTED_HASH).toHaveLength(64);
  });

  it('aceita o header quando a assinatura bate', async () => {
    expect(await verifyPagBankWebhookSignature(TOKEN, BODY, EXPECTED_HASH)).toBe(true);
  });

  it('rejeita quando o corpo foi alterado (payload adulterado)', async () => {
    expect(await verifyPagBankWebhookSignature(TOKEN, BODY + 'x', EXPECTED_HASH)).toBe(false);
  });

  it('rejeita quando o token está errado', async () => {
    expect(await verifyPagBankWebhookSignature('outro-token', BODY, EXPECTED_HASH)).toBe(false);
  });

  it('rejeita header ausente ou token vazio', async () => {
    expect(await verifyPagBankWebhookSignature(TOKEN, BODY, null)).toBe(false);
    expect(await verifyPagBankWebhookSignature('', BODY, EXPECTED_HASH)).toBe(false);
  });
});

describe('translateDeclineMessage', () => {
  it('usa a mensagem específica para códigos conhecidos', () => {
    expect(translateDeclineMessage('20001', 'raw')).toBe('Saldo/limite insuficiente.');
  });

  it('cai numa mensagem genérica para código desconhecido, sem vazar o texto cru do provedor', () => {
    const msg = translateDeclineMessage('99999', 'some internal provider detail');
    expect(msg).not.toContain('internal provider detail');
    expect(msg.length).toBeGreaterThan(0);
  });
});

describe('validatePagBankCustomer', () => {
  const VALID = { name: 'Maria da Silva', phone: '11987654321', email: 'maria@example.com', taxId: '52998224725' };

  it('aceita um cliente com todos os campos válidos', () => {
    expect(validatePagBankCustomer(VALID)).toBeNull();
  });

  it('rejeita nome ausente/curto demais — achado de auditoria: essa checagem não roda mais no create_order_and_credit_cash quando chamado via service_role', () => {
    expect(validatePagBankCustomer({ ...VALID, name: '' })).toMatch(/nome/i);
    expect(validatePagBankCustomer({ ...VALID, name: 'A' })).toMatch(/nome/i);
  });

  it('rejeita telefone inválido', () => {
    expect(validatePagBankCustomer({ ...VALID, phone: '123' })).toMatch(/telefone/i);
  });

  it('rejeita e-mail ausente ou malformado', () => {
    expect(validatePagBankCustomer({ ...VALID, email: '' })).toMatch(/e-mail/i);
    expect(validatePagBankCustomer({ ...VALID, email: 'nao-e-email' })).toMatch(/e-mail/i);
  });

  it('rejeita CPF ausente, malformado ou com dígito verificador errado', () => {
    expect(validatePagBankCustomer({ ...VALID, taxId: '' })).toMatch(/cpf/i);
    expect(validatePagBankCustomer({ ...VALID, taxId: '123' })).toMatch(/cpf/i);
    expect(validatePagBankCustomer({ ...VALID, taxId: '11111111111' })).toMatch(/cpf/i); // dígitos repetidos, DV inválido
  });

  it('aceita CNPJ válido no campo taxId', () => {
    expect(validatePagBankCustomer({ ...VALID, taxId: '11222333000181' })).toBeNull();
  });

  it('rejeita customer nulo/indefinido sem lançar exceção', () => {
    expect(validatePagBankCustomer(null)).not.toBeNull();
    expect(validatePagBankCustomer(undefined)).not.toBeNull();
  });
});
