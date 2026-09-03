import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Clock,
  MapPin,
  Search,
  Plus,
  Minus,
  X,
  CheckCircle2,
  QrCode,
  CreditCard,
  Truck,
  Store as StoreIcon,
  Utensils,
  Sparkles,
  Copy,
  XCircle,
  Loader2,
  Check
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { rowToCamel } from '../../lib/caseMapping';
import { MAXLEN, sanitizeText, hasText, isValidPhone, maskPhone } from '../../lib/validation';
import { Product, ProductAddition, PaymentMethod, Category, CompanyProfileData, OrderItem } from '../../types';
import { LegalModal } from '../legal/LegalModal';

// Página pública do cardápio online — pedido como convidado, sem login.
// Propositalmente não usa AppContext/useApp(): roda fora da árvore
// autenticada, com a chave anon do Supabase, então busca os próprios dados
// (perfil da empresa, categorias, produtos) e cria o pedido direto via RPC.
// Acompanhamento do pedido depois de feito fica para uma próxima etapa —
// a tela de confirmação abaixo é só um resumo estático do que foi pedido.
//
// Visual: header escuro com laranja de ação (design "Cardápio Digital"),
// carrossel de destaques, busca + chips fixos e itens agrupados por
// categoria com barra de carrinho flutuante. O carrinho em si (gaveta),
// o modal do produto e o checkout são as mesmas etapas de antes.

interface Message { type: 'success' | 'error'; text: string }

// Bitter para títulos/preços; o corpo herda Karla do container.
const BITTER: React.CSSProperties = { fontFamily: "'Bitter', Georgia, 'Times New Roman', serif" };

const money = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

// Token do link público de acompanhamento (/acompanhar?t=). UUID quando
// disponível; senão um aleatório longo o bastante (a RPC exige >= 20 chars).
const genTrackingToken = (): string => {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
};

const STEPS: Array<{ key: 'cart' | 'customer' | 'payment'; label: string }> = [
  { key: 'cart', label: 'Carrinho' },
  { key: 'customer', label: 'Dados' },
  { key: 'payment', label: 'Pagamento' },
];

export const PublicOnlineMenu: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfileData | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      supabase.from('company_profile').select('*').eq('id', true).single(),
      supabase.from('categories').select('*'),
      supabase.from('products').select('*'),
    ]).then(([companyRes, categoriesRes, productsRes]) => {
      if (cancelled) return;
      if (companyRes.data) setCompanyProfile(rowToCamel<CompanyProfileData>(companyRes.data));
      if (categoriesRes.data) setCategories(categoriesRes.data.map((r) => rowToCamel<Category>(r)));
      if (productsRes.data) setProducts(productsRes.data.map((r) => rowToCamel<Product>(r)));
      setLoading(false);
    });

    // Realtime: o cliente com o cardápio aberto vê na hora a troca de
    // aberto/fechado (company_profile) e mudanças de preço/disponibilidade
    // (products/categories) feitas no painel interno, sem recarregar.
    const applyRowChange = (
      setter: React.Dispatch<React.SetStateAction<any[]>>,
      payload: any,
    ) => {
      setter((prev) => {
        if (payload.eventType === 'DELETE') {
          return prev.filter((it) => it.id !== payload.old?.id);
        }
        const row = rowToCamel<any>(payload.new);
        return prev.some((it) => it.id === row.id)
          ? prev.map((it) => (it.id === row.id ? row : it))
          : [...prev, row];
      });
    };

    const channel = supabase
      .channel('public-online-menu')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_profile' }, (payload) => {
        if (payload.new && Object.keys(payload.new).length > 0) {
          setCompanyProfile(rowToCamel<CompanyProfileData>(payload.new));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => applyRowChange(setProducts, payload))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, (payload) => applyRowChange(setCategories, payload))
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productQty, setProductQty] = useState(1);
  const [selectedAdditions, setSelectedAdditions] = useState<ProductAddition[]>([]);
  const [productNotes, setProductNotes] = useState('');

  const [cart, setCart] = useState<Array<{
    product: Product;
    quantity: number;
    additions: ProductAddition[];
    notes: string;
    unitPrice: number;
  }>>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'customer' | 'payment' | 'confirmed'>('cart');
  const [serviceType, setServiceType] = useState<'entrega' | 'retirada' | 'consumo_local'>('entrega');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [wantsWhatsappUpdates, setWantsWhatsappUpdates] = useState(true);
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [complement, setComplement] = useState('');
  const [reference, setReference] = useState('');
  const [isPixCopied, setIsPixCopied] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState<number | null>(null);
  const [confirmedTrackingToken, setConfirmedTrackingToken] = useState<string | null>(null);

  // Status aberto/fechado: mesmo critério do toggle no Navbar interno
  // (companyProfile.operatingHours === 'Fechado'). Fechado = cliente
  // navega no cardápio, mas não consegue montar carrinho nem concluir pedido.
  const isStoreOpen = (companyProfile?.operatingHours ?? '') !== 'Fechado';

  // Categorias visíveis, na ordem definida no cadastro.
  const menuCategories = categories
    .filter((c) => c.active !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const query = searchQuery.trim().toLowerCase();
  const isSearching = query.length > 0;
  const matchesSearch = (p: Product) =>
    !query || p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query);

  const availableProducts = products.filter((p) => p.available);

  // Seções renderizadas: quando "Tudo", todas as categorias com itens;
  // senão, só a categoria ativa. A busca combina com o filtro (AND).
  const groups = menuCategories
    .filter((c) => selectedCategory === 'all' || c.id === selectedCategory)
    .map((c) => ({
      id: c.id,
      label: c.name,
      items: availableProducts.filter((p) => p.categoryId === c.id && matchesSearch(p)),
    }))
    .filter((g) => g.items.length > 0);

  const isEmpty = groups.length === 0;

  // Destaques: promoções primeiro, depois o resto — some durante a busca.
  const featured = [...availableProducts]
    .sort((a, b) => Number(Boolean(b.promoPrice)) - Number(Boolean(a.promoPrice)))
    .slice(0, 8);

  const chips = [{ id: 'all', name: 'Tudo' }, ...menuCategories];

  const handleOpenProduct = (product: Product) => {
    setSelectedProduct(product);
    setProductQty(1);
    setSelectedAdditions([]);
    setProductNotes('');
  };

  const toggleAddition = (add: ProductAddition) => {
    setSelectedAdditions((prev) =>
      prev.some((a) => a.id === add.id) ? prev.filter((a) => a.id !== add.id) : [...prev, add]
    );
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;
    if (!isStoreOpen) {
      setMessage({ type: 'error', text: 'O restaurante está fechado no momento. Não é possível fazer pedidos agora.' });
      return;
    }
    const additionsPrice = selectedAdditions.reduce((acc, a) => acc + a.price, 0);
    const unitPrice = (selectedProduct.promoPrice || selectedProduct.price) + additionsPrice;

    setCart((prev) => [...prev, { product: selectedProduct, quantity: productQty, additions: selectedAdditions, notes: productNotes, unitPrice }]);
    setMessage({ type: 'success', text: `${productQty}x ${selectedProduct.name} adicionado ao carrinho.` });
    setSelectedProduct(null);
  };

  const removeFromCart = (index: number) => setCart((prev) => prev.filter((_, i) => i !== index));

  const cartSubtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const cartItemCount = cart.reduce((a, c) => a + c.quantity, 0);
  const cartDeliveryFee = serviceType === 'entrega' ? (companyProfile?.deliveryFee || 0) : 0;
  const cartTotal = cartSubtotal + cartDeliveryFee;

  const minOrderValue = companyProfile?.minOrderValue || 0;
  const belowMinOrder = cartSubtotal > 0 && cartSubtotal < minOrderValue;
  const minOrderMet = minOrderValue > 0 && cartSubtotal >= minOrderValue;
  const minOrderProgressPct = minOrderValue > 0 ? Math.max(0, Math.min(100, (cartSubtotal / minOrderValue) * 100)) : 100;

  const handleFinalizeOrder = async () => {
    if (!isStoreOpen) {
      setMessage({ type: 'error', text: 'O restaurante está fechado no momento. Não é possível concluir o pedido.' });
      return;
    }
    if (belowMinOrder) {
      setMessage({ type: 'error', text: `Pedido mínimo de R$ ${minOrderValue.toFixed(2)}. Faltam R$ ${(minOrderValue - cartSubtotal).toFixed(2)}.` });
      return;
    }
    if (!hasText(customerName) || !hasText(customerPhone)) {
      setMessage({ type: 'error', text: 'Nome e WhatsApp/Telefone são obrigatórios.' });
      return;
    }
    if (customerName.trim().length < 2) {
      setMessage({ type: 'error', text: 'Informe seu nome completo.' });
      return;
    }
    if (!isValidPhone(customerPhone)) {
      setMessage({ type: 'error', text: 'Telefone inválido. Use DDD + número (10 ou 11 dígitos).' });
      return;
    }
    if (serviceType === 'entrega' && (!hasText(street) || !hasText(number) || !hasText(neighborhood))) {
      setMessage({ type: 'error', text: 'Informe rua, número e bairro para entrega.' });
      return;
    }

    setIsPlacingOrder(true);

    const orderItems: OrderItem[] = cart.map((c) => ({
      id: 'item-' + Math.random().toString(36).substring(2, 7),
      productId: c.product.id,
      productName: c.product.name,
      quantity: c.quantity,
      unitPrice: c.unitPrice,
      additions: c.additions,
      notes: c.notes,
    }));

    const orderNumber = 1000 + Math.floor(Math.random() * 9000);
    const trackingToken = genTrackingToken();
    const newOrder = {
      id: 'ord-' + Date.now(),
      orderNumber,
      channel: 'online',
      customer: {
        name: customerName.trim().slice(0, MAXLEN.personName),
        phone: customerPhone.trim().slice(0, MAXLEN.phone),
        wantsWhatsappUpdates,
        trackingToken,
        address: serviceType === 'entrega'
          ? {
              street: street.trim().slice(0, MAXLEN.address),
              number: number.trim().slice(0, 20),
              neighborhood: neighborhood.trim().slice(0, MAXLEN.personName),
              complement: complement.trim().slice(0, MAXLEN.shortNote),
              reference: reference.trim().slice(0, MAXLEN.shortNote),
            }
          : undefined,
      },
      items: orderItems,
      serviceType,
      subtotal: cartSubtotal,
      deliveryFee: cartDeliveryFee,
      discount: 0,
      total: cartTotal,
      paymentMethod,
      paymentStatus: (paymentMethod === 'pix' || paymentMethod === 'cartao_credito') ? 'pagamento_aprovado' : 'aguardando_pagamento',
      orderStatus: 'novo',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      tunaTransactionId: 'TUNA-' + Math.floor(100000 + Math.random() * 900000),
      notes: `Pedido Online (convidado) - ${serviceType.toUpperCase()}`,
      fiscalIssued: false,
    };

    const { error } = await supabase.rpc('create_order_and_credit_cash', {
      p_order: newOrder,
      p_cash_amount: null,
      p_payment_method: newOrder.paymentMethod,
      p_stock_items: newOrder.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    });

    setIsPlacingOrder(false);

    if (error) {
      setMessage({ type: 'error', text: error.message });
      return;
    }

    setConfirmedOrderNumber(orderNumber);
    setConfirmedTrackingToken(trackingToken);
    setCart([]);
    setCheckoutStep('confirmed');
  };

  // Depois de um pedido confirmado, o carrinho fica "preso" na tela de
  // confirmação — reabrir o carrinho pra fazer um novo pedido precisa
  // voltar pro passo inicial, senão mostra a confirmação do pedido antigo.
  const handleOpenCart = () => {
    if (checkoutStep === 'confirmed') {
      setCheckoutStep('cart');
      setConfirmedOrderNumber(null);
      setConfirmedTrackingToken(null);
      setCustomerName('');
      setCustomerPhone('');
      setWantsWhatsappUpdates(true);
      setStreet('');
      setNumber('');
      setNeighborhood('');
      setComplement('');
      setReference('');
      setIsPixCopied(false);
    }
    setIsCartOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6efe4] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#9c4a17] animate-spin" />
      </div>
    );
  }

  if (!companyProfile) {
    return (
      <div className="min-h-screen bg-[#f6efe4] flex items-center justify-center p-4 text-center text-sm text-[#8a7a67]">
        Não foi possível carregar o cardápio agora. Tente novamente em instantes.
      </div>
    );
  }

  const activeStepIndex = STEPS.findIndex((s) => s.key === checkoutStep);

  return (
    <div
      className="min-h-screen bg-[#f6efe4] text-[#241a12]"
      style={{ fontFamily: "Karla, system-ui, sans-serif" }}
    >
      {message && (
        <div className="fixed top-4 right-4 z-[70] max-w-sm">
          <div className={`p-3.5 rounded-xl shadow-lg border flex items-start gap-2.5 bg-white ${message.type === 'success' ? 'border-l-4 border-emerald-600' : 'border-l-4 border-rose-600'}`}>
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <p className="text-xs text-stone-700">{message.text}</p>
          </div>
        </div>
      )}

      <div className="max-w-[1240px] mx-auto pb-[110px]">
        {/* Header da loja */}
        <header className="relative overflow-hidden bg-[linear-gradient(180deg,#241a12_0%,#100a06_100%)] text-[#f6efe4] px-[22px] pt-[26px] pb-[30px] rounded-b-[26px]">
          {companyProfile.coverUrl && (
            <img src={companyProfile.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(36,26,18,0.72)_0%,rgba(16,10,6,0.93)_100%)]" />
          <div className="relative max-w-[1140px] mx-auto flex flex-wrap items-center justify-between gap-[18px]">
            <div className="flex items-center gap-4 min-w-[280px]">
              <div className="w-[74px] h-[74px] rounded-[20px] shrink-0 overflow-hidden border-2 border-[#9c4a17] bg-[#1b120b]">
                {companyProfile.logoUrl && (
                  <img src={companyProfile.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="m-0 text-[30px] font-extrabold leading-none tracking-[-0.5px]" style={BITTER}>
                    {companyProfile.tradeName || companyProfile.name}
                  </h1>
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] px-2.5 py-[5px] rounded-full ${
                    isStoreOpen ? 'bg-[#0f5132] text-[#c8f4d8]' : 'bg-[#5b2323] text-[#f3c9c9]'
                  }`}>
                    <span className={`w-[7px] h-[7px] rounded-full ${isStoreOpen ? 'bg-[#3ddc84] animate-pulse-dot' : 'bg-[#dc6b6b]'}`} />
                    {isStoreOpen ? 'ABERTO' : 'FECHADO'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-[18px] gap-y-2 text-[13.5px] text-[#c9b8a2]">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#f0b071]" />
                    Preparo médio <strong className="text-[#f6efe4]">{companyProfile.avgPrepTimeMinutes} min</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-[#f0b071]" />
                    Entrega <strong className="text-[#f6efe4]">{money(companyProfile.deliveryFee)}</strong>
                  </span>
                  <span>Pedido mín. <strong className="text-[#f6efe4]">{money(companyProfile.minOrderValue)}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-[13px] text-[#9d8b76]">
                  <MapPin className="w-3.5 h-3.5 text-[#f0b071]" />
                  <span>{companyProfile.address.street}, {companyProfile.address.number} — {companyProfile.address.neighborhood}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleOpenCart}
              className="inline-flex items-center gap-2.5 bg-[#9c4a17] hover:bg-[#b5561c] text-white rounded-full px-[22px] py-3.5 text-[15px] font-bold transition shadow-[0_8px_20px_rgba(156,74,23,0.35)]"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Meu carrinho ({cartItemCount})</span>
            </button>
          </div>
        </header>

        {/* Aviso de loja fechada */}
        {!isStoreOpen && (
          <div className="mx-[22px] mt-4 flex items-start gap-2 rounded-2xl border border-[#e6b8b8] bg-[#fbeaea] px-4 py-3 text-[13.5px] leading-[1.45] text-[#8a3b3b]">
            <Clock className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              No momento o restaurante está <strong>fechado</strong>. Você pode ver o cardápio, mas não é
              possível fazer pedidos agora.
            </span>
          </div>
        )}

        {/* Destaques da casa */}
        {!isSearching && featured.length > 0 && (
          <section className="px-[22px] pt-[26px] pb-1.5">
            <div className="flex items-baseline justify-between gap-3 mb-3.5">
              <h2 className="m-0 text-[20px] font-bold" style={BITTER}>Destaques da casa</h2>
              <span className="text-[12.5px] text-[#8a7a67]">arraste para ver mais →</span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-3 custom-scrollbar snap-x snap-mandatory">
              {featured.map((prod) => (
                <article
                  key={prod.id}
                  onClick={() => handleOpenProduct(prod)}
                  className="snap-start shrink-0 w-[320px] rounded-[22px] overflow-hidden bg-[#241a12] text-[#f6efe4] relative cursor-pointer shadow-[0_10px_24px_rgba(36,26,18,0.14)]"
                >
                  <div className="h-[150px] bg-[#31241a]">
                    <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute top-3 left-3 bg-[#9c4a17] text-[11px] font-bold tracking-[0.06em] px-2.5 py-[5px] rounded-full">
                    {prod.promoPrice ? 'PROMOÇÃO' : 'DESTAQUE'}
                  </div>
                  <div className="p-[18px] pt-4 flex flex-col gap-2">
                    <h3 className="m-0 text-[19px] font-bold" style={BITTER}>{prod.name}</h3>
                    <p className="m-0 text-[13.5px] leading-[1.45] text-[#c1af99] line-clamp-2">{prod.description}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[20px] font-bold text-[#f0b071]" style={BITTER}>
                        {money(prod.promoPrice || prod.price)}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenProduct(prod); }}
                        className="bg-[#f6efe4] hover:bg-white text-[#241a12] rounded-full px-[18px] py-2.5 text-[14px] font-bold transition"
                      >
                        Adicionar
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Busca + filtros (sticky) */}
        <div className="sticky top-0 z-20 bg-[#f6efe4] px-[22px] pt-3.5 pb-3 border-b border-[#e4d7c2]">
          <div className="flex items-center gap-2.5 bg-white border border-[#e0d2ba] rounded-full px-[18px] py-3 shadow-[0_2px_8px_rgba(36,26,18,0.05)]">
            <Search className="w-4 h-4 text-[#a4907a] shrink-0" />
            <input
              type="text"
              maxLength={60}
              placeholder="Buscar pratos, bebidas ou sobremesas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.slice(0, 60))}
              className="flex-1 bg-transparent border-0 outline-none text-[15px] text-[#241a12] placeholder:text-[#a4907a]"
            />
          </div>
          <div className="flex gap-2.5 overflow-x-auto pt-3.5 pb-1 custom-scrollbar">
            {chips.map((chip) => {
              const on = selectedCategory === chip.id;
              return (
                <button
                  key={chip.id}
                  onClick={() => setSelectedCategory(chip.id)}
                  className={`shrink-0 rounded-full px-5 py-2.5 text-[14px] font-bold border transition ${
                    on
                      ? 'bg-[#9c4a17] text-white border-[#9c4a17]'
                      : 'bg-white text-[#5d4c39] border-[#e0d2ba] hover:border-[#dcc9ac]'
                  }`}
                >
                  {chip.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Lista de itens agrupada por categoria */}
        <main className="px-[22px] pt-6">
          {groups.map((group) => (
            <section key={group.id} className="mb-[38px] animate-rise-in">
              <div className="flex items-center gap-3.5 mb-4">
                <h2 className="m-0 text-[23px] font-extrabold tracking-[-0.3px]" style={BITTER}>{group.label}</h2>
                <span className="text-[12px] font-bold text-[#9c4a17] bg-[#f0e2cd] px-2.5 py-1 rounded-full">
                  {group.items.length} {group.items.length === 1 ? 'item' : 'itens'}
                </span>
                <div className="flex-1 h-px bg-[#e4d7c2]" />
              </div>

              <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
                {group.items.map((prod) => (
                  <article
                    key={prod.id}
                    onClick={() => handleOpenProduct(prod)}
                    className="group flex gap-3.5 bg-white border border-[#ece0cd] rounded-[20px] p-4 cursor-pointer transition shadow-[0_2px_10px_rgba(36,26,18,0.05)] hover:shadow-[0_10px_26px_rgba(36,26,18,0.13)] hover:border-[#dcc9ac]"
                  >
                    <div className="flex-1 min-w-0 flex flex-col gap-[7px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="m-0 text-[17px] font-bold" style={BITTER}>{prod.name}</h3>
                        {prod.promoPrice && (
                          <span className="text-[10.5px] font-bold tracking-[0.06em] text-[#0f5132] bg-[#dcf3e4] px-2 py-[3px] rounded-full">
                            PROMOÇÃO
                          </span>
                        )}
                      </div>
                      <p className="m-0 text-[13.5px] leading-[1.45] text-[#7d6c58] line-clamp-2">{prod.description}</p>
                      <div className="mt-auto pt-2 flex items-center gap-2.5">
                        <span className="text-[19px] font-bold text-[#241a12]" style={BITTER}>
                          {money(prod.promoPrice || prod.price)}
                        </span>
                        {prod.promoPrice && (
                          <span className="text-[12px] text-[#a4907a] line-through">{money(prod.price)}</span>
                        )}
                      </div>
                    </div>
                    <div className="relative shrink-0">
                      <div className="w-[104px] h-[104px] rounded-[16px] overflow-hidden bg-[#f0e6d6]">
                        <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover transition duration-300 group-hover:scale-105" />
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenProduct(prod); }}
                        aria-label={`Adicionar ${prod.name}`}
                        className="absolute -right-1.5 -bottom-1.5 w-[38px] h-[38px] rounded-full border-[3px] border-white bg-[#9c4a17] hover:bg-[#b5561c] text-white text-[19px] font-bold leading-none flex items-center justify-center transition"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}

          {isEmpty && (
            <div className="text-center py-[60px] px-5">
              <div className="text-[20px] text-[#241a12] mb-2" style={BITTER}>Nada encontrado</div>
              <div className="text-[14px] text-[#8a7a67]">Tente outro termo ou toque em “Tudo”.</div>
            </div>
          )}

          {/* Progresso do pedido mínimo */}
          {cartSubtotal > 0 && minOrderValue > 0 && (
            <div className={`rounded-2xl border p-4 mb-6 transition-colors ${minOrderMet ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-[#ece0cd]'}`}>
              <div className="flex items-center justify-between text-[11px] font-bold text-[#7d6c58] mb-2">
                {minOrderMet ? (
                  <span className="flex items-center gap-1.5 text-emerald-700">
                    <Check className="w-3.5 h-3.5" />
                    Pedido mínimo liberado
                  </span>
                ) : (
                  <span>Faltam {money(minOrderValue - cartSubtotal)} para o pedido mínimo</span>
                )}
                <span>{money(cartSubtotal)} / {money(minOrderValue)}</span>
              </div>
              <div className="h-2 rounded-full bg-[#e4d7c2] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${minOrderMet ? 'bg-emerald-600' : 'bg-[#9c4a17]'}`}
                  style={{ width: `${minOrderProgressPct}%` }}
                />
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-[#e4d7c2] mt-2.5 py-[34px] px-[22px] text-center text-[13px] leading-[1.9] text-[#8a7a67]">
          <p>
            <button
              type="button"
              onClick={() => setShowLegalModal(true)}
              className="text-[#9c4a17] hover:text-[#6d3110] underline underline-offset-2"
            >
              Termos de Uso e Política de Privacidade
            </button>
          </p>
          <p>&copy; {new Date().getFullYear()} {companyProfile.tradeName || companyProfile.name}. Todos os direitos reservados.</p>
          <p>Sistema desenvolvido por <span className="font-semibold text-[#7d6c58]">Amplie Marketing</span></p>
        </footer>
      </div>

      <div className="max-w-[1180px] mx-auto lg:px-4">
        {/* Cart backdrop */}
        {isCartOpen && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-40" onClick={() => setIsCartOpen(false)} />
        )}

        {/* Cart panel: overlay drawer, opened via the cart button (any screen size) */}
        <div className={`fixed inset-0 z-50 ${isCartOpen ? 'flex' : 'hidden'} justify-end`}>
          <div className="bg-white max-w-md w-full h-full shadow-2xl flex flex-col overflow-hidden">
            <div className="bg-stone-900 text-white p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">Seu Pedido</h3>
              </div>
              <button onClick={() => setIsCartOpen(false)} className="p-1 rounded-lg hover:bg-stone-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper */}
            <div className="flex items-center px-4 py-3 gap-1.5 bg-white border-b border-stone-200 shrink-0 text-[10px]">
              {STEPS.map((step, idx) => (
                <React.Fragment key={step.key}>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center font-bold shrink-0 transition-colors ${
                        idx < activeStepIndex ? 'bg-emerald-600 text-white' : idx === activeStepIndex ? 'bg-amber-800 text-white' : 'bg-stone-200 text-stone-500'
                      }`}
                    >
                      {idx < activeStepIndex ? <Check className="w-3 h-3" /> : idx + 1}
                    </span>
                    <span className={`font-bold ${idx <= activeStepIndex ? 'text-stone-900' : 'text-stone-400'}`}>{step.label}</span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <span className={`flex-1 h-0.5 mx-1 ${idx < activeStepIndex ? 'bg-emerald-600' : 'bg-stone-200'}`} />
                  )}
                </React.Fragment>
              ))}
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-5">
              {checkoutStep === 'cart' && (
                <>
                  <h4 className="font-bold text-xs uppercase text-stone-500 tracking-wider">Itens Escolhidos</h4>
                  {cart.length === 0 ? (
                    <div className="text-center py-12 text-stone-400 space-y-2">
                      <ShoppingBag className="w-10 h-10 mx-auto opacity-40" />
                      <p className="text-xs">Seu carrinho está vazio.<br />Toque em um prato pra começar.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cart.map((item, idx) => (
                        <div key={idx} className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-start justify-between text-xs">
                          <div className="space-y-1">
                            <p className="font-bold text-stone-900">{item.quantity}x {item.product.name}</p>
                            {item.additions.map((a) => (
                              <p key={a.id} className="text-[10px] text-stone-500 pl-2">+ {a.name}</p>
                            ))}
                            {item.notes && <p className="text-[10px] text-amber-800 italic">Obs: {item.notes}</p>}
                            <p className="font-semibold text-amber-800">R$ {(item.unitPrice * item.quantity).toFixed(2)}</p>
                          </div>
                          <button onClick={() => removeFromCart(idx)} className="text-rose-600 hover:text-rose-800 p-1">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {checkoutStep === 'customer' && (
                <div className="space-y-4 text-xs">
                  <h4 className="font-bold text-xs uppercase text-stone-500 tracking-wider">Tipo de Atendimento</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setServiceType('entrega')}
                      className={`p-2.5 rounded-xl border text-center font-bold flex flex-col items-center gap-1 ${serviceType === 'entrega' ? 'bg-amber-800 text-white border-amber-800' : 'bg-stone-50 border-stone-200 text-stone-700'}`}
                    >
                      <Truck className="w-4 h-4" />
                      <span>Entrega</span>
                    </button>
                    <button
                      onClick={() => setServiceType('retirada')}
                      className={`p-2.5 rounded-xl border text-center font-bold flex flex-col items-center gap-1 ${serviceType === 'retirada' ? 'bg-amber-800 text-white border-amber-800' : 'bg-stone-50 border-stone-200 text-stone-700'}`}
                    >
                      <StoreIcon className="w-4 h-4" />
                      <span>Retirada</span>
                    </button>
                    <button
                      onClick={() => setServiceType('consumo_local')}
                      className={`p-2.5 rounded-xl border text-center font-bold flex flex-col items-center gap-1 ${serviceType === 'consumo_local' ? 'bg-amber-800 text-white border-amber-800' : 'bg-stone-50 border-stone-200 text-stone-700'}`}
                    >
                      <Utensils className="w-4 h-4" />
                      <span>Mesa</span>
                    </button>
                  </div>

                  <h4 className="font-bold text-xs uppercase text-stone-500 tracking-wider pt-2">Seus Dados</h4>
                  <div className="space-y-2">
                    <input type="text" inputMode="text" maxLength={MAXLEN.personName} placeholder="Nome completo *" value={customerName} onChange={(e) => setCustomerName(sanitizeText(e.target.value, MAXLEN.personName))} className="w-full border border-stone-300 rounded-xl p-2.5" />
                    <input type="tel" inputMode="tel" maxLength={MAXLEN.phone} placeholder="WhatsApp / Telefone com DDD *" value={customerPhone} onChange={(e) => setCustomerPhone(maskPhone(e.target.value))} className="w-full border border-stone-300 rounded-xl p-2.5" />
                  </div>

                  <label className="flex items-start gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={wantsWhatsappUpdates}
                      onChange={(e) => setWantsWhatsappUpdates(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-emerald-600 shrink-0"
                    />
                    <span className="text-[11px] leading-snug text-stone-600">
                      Quero acompanhar meu pedido pelo <strong>WhatsApp</strong> — receber aviso de
                      confirmação, preparo, pronto e saída para entrega no número informado acima.
                    </span>
                  </label>

                  {serviceType === 'entrega' && (
                    <div className="space-y-2 pt-2">
                      <h4 className="font-bold text-xs uppercase text-stone-500 tracking-wider">Endereço de Entrega</h4>
                      <input type="text" maxLength={MAXLEN.address} placeholder="Rua / Avenida *" value={street} onChange={(e) => setStreet(sanitizeText(e.target.value, MAXLEN.address))} className="w-full border border-stone-300 rounded-xl p-2.5" />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" maxLength={20} placeholder="Número *" value={number} onChange={(e) => setNumber(sanitizeText(e.target.value, 20))} className="w-full border border-stone-300 rounded-xl p-2.5" />
                        <input type="text" maxLength={MAXLEN.personName} placeholder="Bairro *" value={neighborhood} onChange={(e) => setNeighborhood(sanitizeText(e.target.value, MAXLEN.personName))} className="w-full border border-stone-300 rounded-xl p-2.5" />
                      </div>
                      <input type="text" maxLength={MAXLEN.shortNote} placeholder="Complemento (Apto, Bloco)" value={complement} onChange={(e) => setComplement(sanitizeText(e.target.value, MAXLEN.shortNote))} className="w-full border border-stone-300 rounded-xl p-2.5" />
                      <input type="text" maxLength={MAXLEN.shortNote} placeholder="Ponto de referência" value={reference} onChange={(e) => setReference(sanitizeText(e.target.value, MAXLEN.shortNote))} className="w-full border border-stone-300 rounded-xl p-2.5" />
                    </div>
                  )}

                  <p className="text-[10px] text-stone-400 text-center pt-1">
                    Ao continuar, você concorda com os{' '}
                    <button type="button" onClick={() => setShowLegalModal(true)} className="underline underline-offset-2 hover:text-stone-600">
                      Termos de Uso e a Política de Privacidade
                    </button>.
                  </p>
                </div>
              )}

              {checkoutStep === 'payment' && (
                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-stone-100 rounded-xl border border-stone-200">
                    <p className="font-bold text-stone-900 text-sm">Integração Tuna Pagamentos</p>
                    <p className="text-[10px] text-stone-600 mt-0.5">Checkout seguro e confirmação instantânea via Webhook.</p>
                  </div>

                  <h4 className="font-bold text-xs uppercase text-stone-500 tracking-wider">Forma de Pagamento</h4>
                  <div className="space-y-2">
                    <button
                      onClick={() => setPaymentMethod('pix')}
                      className={`w-full p-3 rounded-xl border text-left font-bold flex items-center justify-between ${paymentMethod === 'pix' ? 'bg-emerald-50 border-emerald-600 text-emerald-950' : 'border-stone-200'}`}
                    >
                      <div className="flex items-center gap-2">
                        <QrCode className="w-4 h-4 text-emerald-700" />
                        <span>Pix Instantâneo (Aprovação Imediata)</span>
                      </div>
                      {paymentMethod === 'pix' && <CheckCircle2 className="w-4 h-4 text-emerald-700" />}
                    </button>

                    <button
                      onClick={() => setPaymentMethod('cartao_credito')}
                      className={`w-full p-3 rounded-xl border text-left font-bold flex items-center justify-between ${paymentMethod === 'cartao_credito' ? 'bg-amber-50 border-amber-600 text-amber-950' : 'border-stone-200'}`}
                    >
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-amber-700" />
                        <span>Cartão de Crédito Online</span>
                      </div>
                      {paymentMethod === 'cartao_credito' && <CheckCircle2 className="w-4 h-4 text-amber-700" />}
                    </button>

                    <button
                      onClick={() => setPaymentMethod('dinheiro')}
                      className={`w-full p-3 rounded-xl border text-left font-bold flex items-center justify-between ${paymentMethod === 'dinheiro' ? 'bg-amber-50 border-amber-600 text-amber-950' : 'border-stone-200'}`}
                    >
                      <div className="flex items-center gap-2">
                        <StoreIcon className="w-4 h-4 text-amber-700" />
                        <span>Pagamento na Entrega / Retirada</span>
                      </div>
                      {paymentMethod === 'dinheiro' && <CheckCircle2 className="w-4 h-4 text-amber-700" />}
                    </button>
                  </div>
                </div>
              )}

              {checkoutStep === 'confirmed' && confirmedOrderNumber !== null && (
                <div className="space-y-4 text-xs text-center py-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-stone-900">Pedido Confirmado!</h4>
                    <p className="text-stone-500 mt-1">Pedido nº #{confirmedOrderNumber}</p>
                    <p className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded inline-block mt-1">
                      Tuna Pagamentos: APROVADO
                    </p>
                  </div>

                  {paymentMethod === 'pix' && (
                    <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-2 text-left">
                      <p className="font-bold text-stone-800 text-xs text-center">Chave Pix Copia e Cola</p>
                      <div className="bg-white p-2 rounded-xl border font-mono text-[10px] break-all text-stone-600">
                        00020126580014br.gov.bcb.pix0136cafecomdestino-pay-1001-sp5204000053039865405115.705802BR5925CAFE COM DESTINO6009SAO PAULO62070503***6304
                      </div>
                      <button
                        onClick={() => { setIsPixCopied(true); setMessage({ type: 'success', text: 'Chave Pix copiada!' }); }}
                        className="w-full bg-emerald-700 text-white py-2 rounded-xl font-bold flex items-center justify-center gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{isPixCopied ? 'Chave Copiada!' : 'Copiar Código Pix'}</span>
                      </button>
                    </div>
                  )}

                  <p className="text-stone-500 pt-2 border-t">
                    Vamos avisar por WhatsApp/telefone conforme seu pedido avançar na cozinha. Guarde o número do
                    pedido acima caso precise falar com o restaurante.
                  </p>

                  {confirmedTrackingToken && (
                    <a
                      href={`/acompanhar?t=${encodeURIComponent(confirmedTrackingToken)}`}
                      className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-3 rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-1.5"
                    >
                      <Truck className="w-4 h-4" />
                      <span>Acompanhar meu pedido</span>
                    </a>
                  )}

                  <button
                    onClick={() => { setCheckoutStep('cart'); setConfirmedOrderNumber(null); setConfirmedTrackingToken(null); }}
                    className="w-full bg-amber-800 hover:bg-amber-900 text-white py-3 rounded-xl font-bold text-xs shadow-md"
                  >
                    Fazer novo pedido
                  </button>
                </div>
              )}
            </div>

            {checkoutStep !== 'confirmed' && (
              <div className="p-4 bg-stone-50 border-t border-stone-200 space-y-3 shrink-0">
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-stone-600">
                    <span>Subtotal:</span>
                    <span>R$ {cartSubtotal.toFixed(2)}</span>
                  </div>
                  {serviceType === 'entrega' && (
                    <div className="flex justify-between text-stone-600">
                      <span>Taxa de Entrega:</span>
                      <span>R$ {cartDeliveryFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm text-stone-900 border-t pt-1">
                    <span>Total:</span>
                    <span>R$ {cartTotal.toFixed(2)}</span>
                  </div>
                  {belowMinOrder && (
                    <p className="text-rose-600 text-[11px] font-semibold text-center pt-1">
                      Pedido mínimo de R$ {minOrderValue.toFixed(2)} — faltam R$ {(minOrderValue - cartSubtotal).toFixed(2)}
                    </p>
                  )}
                  {!isStoreOpen && (
                    <p className="text-rose-600 text-[11px] font-semibold text-center pt-1">
                      Restaurante fechado no momento — não é possível concluir o pedido.
                    </p>
                  )}
                </div>

                {checkoutStep === 'cart' && (
                  <button
                    disabled={cart.length === 0 || belowMinOrder || !isStoreOpen}
                    onClick={() => setCheckoutStep('customer')}
                    className="w-full bg-amber-800 hover:bg-amber-900 text-white py-3 rounded-xl font-bold text-xs shadow-md disabled:opacity-50"
                  >
                    Avançar para Identificação
                  </button>
                )}

                {checkoutStep === 'customer' && (
                  <div className="flex gap-2">
                    <button onClick={() => setCheckoutStep('cart')} className="px-4 py-3 bg-stone-200 text-stone-700 rounded-xl font-bold text-xs">
                      Voltar
                    </button>
                    <button onClick={() => setCheckoutStep('payment')} disabled={!isStoreOpen} className="flex-1 bg-amber-800 hover:bg-amber-900 text-white py-3 rounded-xl font-bold text-xs shadow-md disabled:opacity-50">
                      Ir para Pagamento
                    </button>
                  </div>
                )}

                {checkoutStep === 'payment' && (
                  <div className="flex gap-2">
                    <button onClick={() => setCheckoutStep('customer')} className="px-4 py-3 bg-stone-200 text-stone-700 rounded-xl font-bold text-xs">
                      Voltar
                    </button>
                    <button
                      onClick={handleFinalizeOrder}
                      disabled={isPlacingOrder || !isStoreOpen}
                      className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white py-3 rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {isPlacingOrder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      <span>Confirmar & Pagar R$ {cartTotal.toFixed(2)}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product Customizer Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-stone-200">
            <div className="relative h-48 w-full bg-stone-100">
              <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-cover" />
              <button onClick={() => setSelectedProduct(null)} className="absolute top-3 right-3 bg-stone-900/70 text-white p-2 rounded-full hover:bg-stone-900">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <h3 className="font-bold text-lg text-stone-900">{selectedProduct.name}</h3>
                <p className="text-xs text-stone-500 mt-1">{selectedProduct.description}</p>
                <p className="text-base font-bold text-amber-800 mt-2">R$ {(selectedProduct.promoPrice || selectedProduct.price).toFixed(2)}</p>
              </div>

              {selectedProduct.additions && selectedProduct.additions.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <span className="font-semibold text-xs text-stone-700 block uppercase tracking-wider">Deseja Adicionais?</span>
                  <div className="space-y-1.5">
                    {selectedProduct.additions.map((add) => {
                      const isChecked = selectedAdditions.some((a) => a.id === add.id);
                      return (
                        <div
                          key={add.id}
                          onClick={() => toggleAddition(add)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition ${
                            isChecked ? 'bg-amber-50 border-amber-600 text-amber-950 font-semibold' : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                          }`}
                        >
                          <span>+ {add.name}</span>
                          <span>+ R$ {add.price.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-1 pt-2 border-t">
                <span className="font-semibold text-xs text-stone-700 block">Observações do pedido</span>
                <textarea
                  placeholder="Ex: sem cebola, ponto da carne, pouco sal..."
                  value={productNotes}
                  maxLength={MAXLEN.shortNote}
                  onChange={(e) => setProductNotes(sanitizeText(e.target.value, MAXLEN.shortNote))}
                  className="w-full border border-stone-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-amber-700 focus:outline-none"
                  rows={2}
                />
              </div>
            </div>

            <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-4">
              <div className="flex items-center border border-stone-300 bg-white rounded-xl">
                <button onClick={() => setProductQty(Math.max(1, productQty - 1))} className="p-2 text-stone-600 hover:text-stone-900">
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-3 text-xs font-bold">{productQty}</span>
                <button onClick={() => setProductQty(productQty + 1)} className="p-2 text-stone-600 hover:text-stone-900">
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={!isStoreOpen}
                className="flex-1 bg-amber-800 hover:bg-amber-900 text-white py-2.5 px-4 rounded-xl font-bold text-xs shadow-md flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isStoreOpen ? (
                  <>
                    <span>Adicionar ao Carrinho</span>
                    <span>
                      R${' '}
                      {(((selectedProduct.promoPrice || selectedProduct.price) + selectedAdditions.reduce((a, b) => a + b.price, 0)) * productQty).toFixed(2)}
                    </span>
                  </>
                ) : (
                  <span className="w-full text-center">Restaurante fechado no momento</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra fixa do carrinho (aparece só com ≥1 item) */}
      {cartItemCount > 0 && !isCartOpen && !selectedProduct && (
        <div className="fixed inset-x-0 bottom-0 z-30 px-[18px] pb-3.5 pt-8 bg-[linear-gradient(180deg,rgba(246,239,228,0)_0%,#f6efe4_45%)]">
          <div className="max-w-[640px] mx-auto flex items-center gap-3.5 bg-[#241a12] text-[#f6efe4] rounded-full pl-[22px] pr-3.5 py-3 shadow-[0_14px_34px_rgba(36,26,18,0.32)] animate-slide-up">
            <div className="flex-1 leading-tight">
              <span className="block text-[12px] text-[#c1af99]">
                {cartItemCount === 1 ? '1 item no carrinho' : `${cartItemCount} itens no carrinho`}
              </span>
              <strong className="text-[18px]" style={BITTER}>{money(cartSubtotal)}</strong>
            </div>
            <button
              onClick={handleOpenCart}
              className="bg-[#9c4a17] hover:bg-[#b5561c] text-white rounded-full px-[26px] py-3.5 text-[15px] font-bold transition"
            >
              Finalizar pedido
            </button>
          </div>
        </div>
      )}

      {showLegalModal && (
        <LegalModal
          onClose={() => setShowLegalModal(false)}
          company={{
            name: companyProfile.tradeName || companyProfile.name,
            cnpj: companyProfile.cnpj,
            address: `${companyProfile.address.street}, ${companyProfile.address.number} - ${companyProfile.address.neighborhood}, ${companyProfile.address.city}/${companyProfile.address.state}`,
            phone: companyProfile.phone,
            email: companyProfile.email,
          }}
        />
      )}
    </div>
  );
};
