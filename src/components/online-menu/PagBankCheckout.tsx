import React, { useEffect, useRef, useState } from 'react';
import { QrCode, CreditCard, Copy, Loader2, XCircle, ShieldCheck } from 'lucide-react';
import {
  MAXLEN, sanitizeText, isValidEmail, isValidCpfCnpj, maskCpfCnpj, onlyDigits,
} from '../../lib/validation';
import { OrderItem, PaymentMethod } from '../../types';
import {
  createPagBankPixCharge, createPagBankCardCharge, pollPagBankPixStatus, PagBankOrderDraft,
} from '../../lib/pagbankClient';

// Checkout PagBank do Cardápio Online — substitui o antigo bloco mockado
// "Integração Tuna Pagamentos". Só existe enquanto paymentMethod é 'pix' ou
// 'cartao_credito'; o método 'dinheiro' (pagamento na entrega/retirada)
// continua 100% no fluxo antigo em PublicOnlineMenu.tsx, sem passar por aqui.
//
// O pedido real só é criado no banco quando o pagamento é confirmado (Edge
// Function pagbank-create-pix/pagbank-create-card + webhook) — até lá, nada
// aqui toca estoque nem `orders`.

declare global {
  interface Window {
    // Confirmado contra a doc oficial (developer.pagbank.com.br/docs/criptografia-e-chave-publica):
    // `encryptedCard` no retorno é uma STRING direta, não um objeto aninhado.
    PagSeguro?: {
      encryptCard: (opts: {
        publicKey: string;
        holder: string;
        number: string;
        expMonth: string;
        expYear: string;
        securityCode: string;
      }) => { hasErrors: boolean; errors?: { code: string; message: string }[]; encryptedCard?: string };
    };
  }
}

const PAGBANK_SDK_URL = 'https://assets.pagseguro.com.br/checkout-sdk-js/rc/dist/browser/pagseguro.min.js';

interface OrderContext {
  items: OrderItem[];
  customerName: string;
  customerPhone: string;
  wantsWhatsappUpdates: boolean;
  serviceType: 'entrega' | 'retirada' | 'consumo_local';
  deliveryFee: number;
  notes: string;
  trackingToken: string;
  address?: {
    street: string;
    number: string;
    neighborhood: string;
    complement?: string;
    reference?: string;
  };
}

interface Props {
  paymentMethod: Extract<PaymentMethod, 'pix' | 'cartao_credito'>;
  orderContext: OrderContext;
  cartTotal: number;
  onPaid: (result: { orderNumber: number | null; trackingToken: string }) => void;
}

type Phase = 'form' | 'submitting' | 'pix-waiting' | 'declined-error';

const genReferenceId = (): string => {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  const uuid = c && typeof c.randomUUID === 'function' ? c.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `pgb_${uuid}`;
};

export const PagBankCheckout: React.FC<Props> = ({ paymentMethod, orderContext, cartTotal, onPaid }) => {
  // Um referenceId novo por montagem do componente — cada vez que o cliente
  // entra no passo de pagamento é uma tentativa de cobrança nova. Reenviado
  // em todo clique repetido de "gerar Pix"/"pagar" dentro da mesma tentativa,
  // pro backend deduplicar (não cobra duas vezes em duplo clique/F5).
  const [referenceId] = useState(genReferenceId);
  const [phase, setPhase] = useState<Phase>('form');
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [taxId, setTaxId] = useState('');

  const [pixData, setPixData] = useState<{ qrCodeText: string | null; qrCodeImageUrl: string | null; expirationDate: string | null } | null>(null);
  const [isPixCopied, setIsPixCopied] = useState(false);

  const [sdkReady, setSdkReady] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState(''); // MM/AA
  const [cardCvv, setCardCvv] = useState('');
  const [cardHolder, setCardHolder] = useState('');

  const pollAbortRef = useRef<AbortController | null>(null);

  useEffect(() => () => pollAbortRef.current?.abort(), []);

  // Carrega o SDK do PagBank sob demanda, só quando a pessoa escolhe cartão.
  useEffect(() => {
    if (paymentMethod !== 'cartao_credito') return;
    if (window.PagSeguro) { setSdkReady(true); return; }
    const existing = document.querySelector(`script[src="${PAGBANK_SDK_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => setSdkReady(true));
      return;
    }
    const script = document.createElement('script');
    script.src = PAGBANK_SDK_URL;
    script.async = true;
    script.onload = () => setSdkReady(true);
    script.onerror = () => setError('Não foi possível carregar o SDK de pagamento. Verifique sua conexão e tente novamente.');
    document.head.appendChild(script);
  }, [paymentMethod]);

  const buildDraft = (): PagBankOrderDraft => ({
    customer: {
      name: orderContext.customerName,
      phone: orderContext.customerPhone,
      email: email.trim() || undefined,
      taxId: onlyDigits(taxId) || undefined,
      wantsWhatsappUpdates: orderContext.wantsWhatsappUpdates,
      trackingToken: orderContext.trackingToken,
      address: orderContext.address,
    },
    items: orderContext.items,
    serviceType: orderContext.serviceType,
    deliveryFee: orderContext.deliveryFee,
    notes: orderContext.notes,
  });

  const validateContactFields = (): boolean => {
    if (!isValidEmail(email)) {
      setError('Informe um e-mail válido — o PagBank exige para processar o pagamento.');
      return false;
    }
    if (!onlyDigits(taxId) || !isValidCpfCnpj(taxId)) {
      setError('Informe um CPF válido.');
      return false;
    }
    setError(null);
    return true;
  };

  const startPixPolling = async () => {
    const controller = new AbortController();
    pollAbortRef.current = controller;
    const status = await pollPagBankPixStatus(referenceId, { signal: controller.signal });
    if (!status) return;
    if (status.status === 'paid') {
      onPaid({ orderNumber: status.orderNumber, trackingToken: status.trackingToken || orderContext.trackingToken });
    } else if (status.status === 'expired') {
      setError('O QR Code expirou sem pagamento. Gere um novo código para continuar.');
      setPhase('form');
    } else if (status.status === 'declined' || status.status === 'cancelled') {
      setError('Não foi possível confirmar o pagamento.');
      setPhase('form');
    }
  };

  const handleGeneratePix = async () => {
    if (!validateContactFields()) return;
    setPhase('submitting');
    setError(null);
    const result = await createPagBankPixCharge(referenceId, buildDraft());
    if (!result.ok) {
      setError(result.notConfigured
        ? 'Pagamento via Pix indisponível no momento. Escolha "Pagamento na Entrega / Retirada".'
        : (result.message || 'Não foi possível gerar o Pix agora. Tente novamente.'));
      setPhase('form');
      return;
    }
    setPixData({ qrCodeText: result.qrCodeText ?? null, qrCodeImageUrl: result.qrCodeImageUrl ?? null, expirationDate: result.expirationDate ?? null });
    setPhase('pix-waiting');
    startPixPolling();
  };

  const maskCardNumber = (v: string) => onlyDigits(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  const maskExpiry = (v: string) => {
    const d = onlyDigits(v).slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  const handlePayCard = async () => {
    if (!validateContactFields()) return;
    if (!cardHolder.trim() || onlyDigits(cardNumber).length < 13 || cardExpiry.length < 4 || cardCvv.length < 3) {
      setError('Preencha todos os dados do cartão.');
      return;
    }
    if (!window.PagSeguro || !sdkReady) {
      setError('O módulo de pagamento ainda está carregando. Aguarde alguns segundos e tente de novo.');
      return;
    }
    const publicKey = import.meta.env.VITE_PAGBANK_PUBLIC_KEY as string | undefined;
    if (!publicKey) {
      setError('Pagamento por cartão indisponível no momento. Escolha "Pagamento na Entrega / Retirada".');
      return;
    }

    setPhase('submitting');
    setError(null);

    const [expMonth, expYearShort] = maskExpiry(cardExpiry).split('/');
    // O SDK exige expYear com 4 dígitos (1900–2099) — o campo captura só 2
    // ("30"), então completa pro século 2000 antes de mandar pro encryptCard.
    // Erro real visto em teste manual: "invalid field `expYear`. You must
    // pass a value between 1900 and 2099" ao mandar "30" cru.
    const expYear = expYearShort ? `20${expYearShort}` : '';
    const encrypted = window.PagSeguro.encryptCard({
      publicKey,
      holder: cardHolder.trim(),
      number: onlyDigits(cardNumber),
      expMonth: expMonth ?? '',
      expYear,
      securityCode: cardCvv,
    });

    if (encrypted.hasErrors || !encrypted.encryptedCard) {
      setError(encrypted.errors?.[0]?.message || 'Dados do cartão inválidos.');
      setPhase('form');
      return;
    }

    const result = await createPagBankCardCharge({
      referenceId,
      orderDraft: buildDraft(),
      encryptedCard: encrypted.encryptedCard,
      holderName: cardHolder.trim(),
      holderTaxId: onlyDigits(taxId),
    });

    if (result.ok && result.status === 'paid') {
      onPaid({ orderNumber: result.orderNumber ?? null, trackingToken: orderContext.trackingToken });
      return;
    }
    if (result.ok && result.status === 'waiting') {
      setPhase('pix-waiting'); // reaproveita a tela de espera — confirmação virá do webhook
      startPixPolling();
      return;
    }

    setError(result.notConfigured
      ? 'Pagamento por cartão indisponível no momento. Escolha "Pagamento na Entrega / Retirada".'
      : (result.message || 'Pagamento recusado. Tente outro cartão ou escolha Pix.'));
    setPhase('form');
  };

  if (phase === 'pix-waiting') {
    return (
      <div className="space-y-4 text-xs text-center">
        {pixData?.qrCodeImageUrl && (
          <img src={pixData.qrCodeImageUrl} alt="QR Code Pix" className="w-40 h-40 mx-auto rounded-xl border border-stone-200" />
        )}
        {pixData?.qrCodeText && (
          <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-2 text-left">
            <p className="font-bold text-stone-800 text-xs text-center">Pix Copia e Cola</p>
            <div className="bg-white p-2 rounded-xl border font-mono text-[10px] break-all text-stone-600">
              {pixData.qrCodeText}
            </div>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(pixData.qrCodeText || '');
                setIsPixCopied(true);
              }}
              className="w-full bg-emerald-700 text-white py-2 rounded-xl font-bold flex items-center justify-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{isPixCopied ? 'Chave Copiada!' : 'Copiar Código Pix'}</span>
            </button>
          </div>
        )}
        <p className="flex items-center justify-center gap-1.5 text-stone-500">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Aguardando confirmação do pagamento...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-xs">
      <div className="p-3 bg-stone-100 rounded-xl border border-stone-200 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-stone-900 text-sm">Pagamento seguro via PagBank</p>
          <p className="text-[10px] text-stone-600 mt-0.5">Seus dados de cartão são criptografados no seu navegador — nunca chegam aos nossos servidores.</p>
        </div>
      </div>

      {error && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-700">
          <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <input
          type="email" inputMode="email" maxLength={MAXLEN.email} placeholder="E-mail *"
          value={email} onChange={(e) => setEmail(sanitizeText(e.target.value, MAXLEN.email))}
          className="w-full border border-stone-300 rounded-xl p-2.5"
        />
        <input
          type="text" inputMode="numeric" maxLength={MAXLEN.cpfCnpj} placeholder="CPF *"
          value={taxId} onChange={(e) => setTaxId(maskCpfCnpj(e.target.value))}
          className="w-full border border-stone-300 rounded-xl p-2.5"
        />
      </div>

      {paymentMethod === 'pix' && (
        <button
          onClick={handleGeneratePix}
          disabled={phase === 'submitting'}
          className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-3 rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {phase === 'submitting' ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
          <span>Gerar QR Code Pix — R$ {cartTotal.toFixed(2)}</span>
        </button>
      )}

      {paymentMethod === 'cartao_credito' && (
        <div className="space-y-3 pt-1 border-t">
          <h4 className="font-bold text-xs uppercase text-stone-500 tracking-wider pt-2">Dados do Cartão</h4>
          <input
            type="text" inputMode="text" maxLength={MAXLEN.personName} placeholder="Nome impresso no cartão *"
            value={cardHolder} onChange={(e) => setCardHolder(sanitizeText(e.target.value, MAXLEN.personName))}
            className="w-full border border-stone-300 rounded-xl p-2.5"
          />
          <input
            type="text" inputMode="numeric" maxLength={23} placeholder="Número do cartão *"
            value={cardNumber} onChange={(e) => setCardNumber(maskCardNumber(e.target.value))}
            className="w-full border border-stone-300 rounded-xl p-2.5"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text" inputMode="numeric" maxLength={5} placeholder="MM/AA *"
              value={cardExpiry} onChange={(e) => setCardExpiry(maskExpiry(e.target.value))}
              className="w-full border border-stone-300 rounded-xl p-2.5"
            />
            <input
              type="text" inputMode="numeric" maxLength={4} placeholder="CVV *"
              value={cardCvv} onChange={(e) => setCardCvv(onlyDigits(e.target.value).slice(0, 4))}
              className="w-full border border-stone-300 rounded-xl p-2.5"
            />
          </div>
          <button
            onClick={handlePayCard}
            disabled={phase === 'submitting' || !sdkReady}
            className="w-full bg-amber-800 hover:bg-amber-900 text-white py-3 rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {phase === 'submitting' || !sdkReady ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            <span>{sdkReady ? `Pagar R$ ${cartTotal.toFixed(2)}` : 'Carregando pagamento seguro...'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
