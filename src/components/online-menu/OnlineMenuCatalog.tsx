import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
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
  Check
} from 'lucide-react';
import { Product, ProductAddition, PaymentMethod, Order } from '../../types';
import { OnlineOrderTrackingModal } from './OnlineOrderTrackingModal';
import { hasPermission } from '../../lib/permissions';
import { LegalModal } from '../legal/LegalModal';

const STEPS: Array<{ key: 'cart' | 'customer' | 'payment'; label: string }> = [
  { key: 'cart', label: 'Carrinho' },
  { key: 'customer', label: 'Dados' },
  { key: 'payment', label: 'Pagamento' },
];

export const OnlineMenuCatalog: React.FC = () => {
  const { companyProfile, categories, products, orders, createOnlineOrder, addToast, currentUser } = useApp();
  const canFinalizeOrder = hasPermission(currentUser, 'online_menu.finalizar_pedido');
  const [showLegalModal, setShowLegalModal] = useState(false);

  const findPratoFeitoCategoryId = (cats: typeof categories) =>
    cats.find((c) => c.name.trim().toLowerCase() === 'prato feito')?.id;

  const [selectedCategory, setSelectedCategory] = useState<string>(
    () => findPratoFeitoCategoryId(categories) || categories[0]?.id || ''
  );
  const [hasManuallySelectedCategory, setHasManuallySelectedCategory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Assim que as categorias carregarem (ex: primeiro acesso antes do fetch
  // terminar), abre o cardápio já em "Prato Feito" — só respeita a escolha
  // do cliente depois que ele mesmo trocar de categoria.
  useEffect(() => {
    if (hasManuallySelectedCategory || selectedCategory) return;
    const pratoFeitoId = findPratoFeitoCategoryId(categories);
    if (pratoFeitoId) {
      setSelectedCategory(pratoFeitoId);
    } else if (categories[0]) {
      setSelectedCategory(categories[0].id);
    }
  }, [categories, hasManuallySelectedCategory, selectedCategory]);

  // Product Detail Modal State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productQty, setProductQty] = useState(1);
  const [selectedAdditions, setSelectedAdditions] = useState<ProductAddition[]>([]);
  const [productNotes, setProductNotes] = useState('');

  // Cart State
  const [cart, setCart] = useState<Array<{
    product: Product;
    quantity: number;
    additions: ProductAddition[];
    notes: string;
    unitPrice: number;
  }>>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Checkout State
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'customer' | 'payment' | 'tracking'>('cart');
  const [serviceType, setServiceType] = useState<'entrega' | 'retirada' | 'consumo_local'>('entrega');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');

  // Customer Form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [complement, setComplement] = useState('');
  const [reference, setReference] = useState('');

  // Placed Orders Memory & Tracking Modal
  const [placedOrderIds, setPlacedOrderIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ampliechef_online_placed_order_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [trackingModalOrderId, setTrackingModalOrderId] = useState<string | null>(null);

  const [activePlacedOrder, setActivePlacedOrder] = useState<Order | null>(null);
  const [isPixCopied, setIsPixCopied] = useState(false);

  // Active orders for floating tracker bar
  const myPlacedOrders = orders.filter((o) => placedOrderIds.includes(o.id));
  const activeOrdersCount = myPlacedOrders.filter((o) => o.orderStatus !== 'concluido' && o.orderStatus !== 'cancelado').length;
  const latestActiveOrder = myPlacedOrders.find((o) => o.orderStatus !== 'concluido' && o.orderStatus !== 'cancelado');

  // Filter products
  const isSearching = searchQuery.trim().length > 0;
  const filteredProducts = products.filter((p) => {
    const matchesCat = isSearching || !selectedCategory || p.categoryId === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch && p.available;
  });

  const handleOpenProduct = (product: Product) => {
    setSelectedProduct(product);
    setProductQty(1);
    setSelectedAdditions([]);
    setProductNotes('');
  };

  const toggleAddition = (add: ProductAddition) => {
    if (selectedAdditions.some((a) => a.id === add.id)) {
      setSelectedAdditions(selectedAdditions.filter((a) => a.id !== add.id));
    } else {
      setSelectedAdditions([...selectedAdditions, add]);
    }
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;

    const additionsPrice = selectedAdditions.reduce((acc, a) => acc + a.price, 0);
    const unitPrice = (selectedProduct.promoPrice || selectedProduct.price) + additionsPrice;

    setCart([
      ...cart,
      {
        product: selectedProduct,
        quantity: productQty,
        additions: selectedAdditions,
        notes: productNotes,
        unitPrice,
      }
    ]);

    addToast('success', 'Adicionado ao carrinho', `${productQty}x ${selectedProduct.name}`);
    setSelectedProduct(null);
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const cartDeliveryFee = serviceType === 'entrega' ? companyProfile.deliveryFee : 0;
  const cartTotal = cartSubtotal + cartDeliveryFee;
  const belowMinOrder = cartSubtotal > 0 && cartSubtotal < companyProfile.minOrderValue;
  const minOrderMet = companyProfile.minOrderValue > 0 && cartSubtotal >= companyProfile.minOrderValue;
  const minOrderProgressPct = companyProfile.minOrderValue > 0 ? Math.max(0, Math.min(100, (cartSubtotal / companyProfile.minOrderValue) * 100)) : 100;

  const handleFinalizeOrder = async () => {
    if (belowMinOrder) {
      addToast('error', 'Pedido abaixo do mínimo', `Pedido mínimo de R$ ${companyProfile.minOrderValue.toFixed(2)}. Faltam R$ ${(companyProfile.minOrderValue - cartSubtotal).toFixed(2)}.`);
      return;
    }
    if (!customerName || !customerPhone) {
      addToast('error', 'Preencha seus dados', 'Nome e WhatsApp/Telefone são obrigatórios.');
      return;
    }

    if (serviceType === 'entrega' && (!street || !number || !neighborhood)) {
      addToast('error', 'Endereço incompleto', 'Informe rua, número e bairro para entrega.');
      return;
    }

    const orderItems = cart.map((c) => ({
      id: 'item-' + Math.random().toString(36).substring(2, 7),
      productId: c.product.id,
      productName: c.product.name,
      quantity: c.quantity,
      unitPrice: c.unitPrice,
      additions: c.additions,
      notes: c.notes,
    }));

    const placed = await createOnlineOrder({
      customer: {
        name: customerName,
        phone: customerPhone,
        address: serviceType === 'entrega' ? { street, number, neighborhood, complement, reference } : undefined,
      },
      items: orderItems,
      serviceType,
      paymentMethod,
      notes: `Pedido Online Tuna Pagamentos - ${serviceType.toUpperCase()}`,
    });

    // Save order ID to local storage for tracking
    const updatedPlacedIds = Array.from(new Set([placed.id, ...placedOrderIds]));
    setPlacedOrderIds(updatedPlacedIds);
    try {
      localStorage.setItem('ampliechef_online_placed_order_ids', JSON.stringify(updatedPlacedIds));
    } catch (e) {
      console.error(e);
    }

    setActivePlacedOrder(placed);
    setCart([]);
    setCheckoutStep('cart');

    // Open tracking modal directly
    setTrackingModalOrderId(placed.id);
    setIsTrackingModalOpen(true);
  };

  const activeStepIndex = STEPS.findIndex((s) => s.key === checkoutStep);

  return (
    <div className="min-h-screen bg-[#F6F1EA] text-stone-900 pb-6">
      {/* Restaurant Header Banner */}
      <div className="relative h-48 sm:h-64 lg:h-72 w-full bg-stone-900 overflow-hidden">
        <img
          src={companyProfile.coverUrl}
          alt="Capa Restaurante"
          className="w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/40 to-transparent" />

        <div className="absolute bottom-4 left-4 right-4 max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-end justify-between gap-4 text-white">
          <div className="flex items-center gap-4">
            <img
              src={companyProfile.logoUrl}
              alt="Logo"
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-white/80 object-cover shadow-lg shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{companyProfile.tradeName}</h1>
                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-700 text-white font-bold px-2 py-0.5 rounded-full uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                  Aberto
                </span>
              </div>
              <p className="text-xs text-stone-300 mt-1 flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-amber-400" />Preparo médio: {companyProfile.avgPrepTimeMinutes} min</span>
                <span>•</span>
                <span className="flex items-center gap-1"><Truck className="w-3.5 h-3.5 text-amber-400" />Entrega R$ {companyProfile.deliveryFee.toFixed(2)}</span>
                <span>•</span>
                <span>Pedido mín: R$ {companyProfile.minOrderValue.toFixed(2)}</span>
              </p>
              <p className="text-xs text-stone-300 flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>{companyProfile.address.street}, {companyProfile.address.number} - {companyProfile.address.neighborhood}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Meus Pedidos & Acompanhamento Button */}
            <button
              onClick={() => {
                setTrackingModalOrderId(latestActiveOrder ? latestActiveOrder.id : (placedOrderIds[0] || null));
                setIsTrackingModalOpen(true);
              }}
              className="relative bg-stone-900/90 hover:bg-black text-amber-300 px-3.5 py-2.5 rounded-xl font-bold text-xs shadow-lg flex items-center gap-2 border border-amber-600/60 transition"
            >
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Meus Pedidos</span>
              {activeOrdersCount > 0 && (
                <span className="bg-amber-500 text-stone-950 text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
                  {activeOrdersCount}
                </span>
              )}
            </button>

            {/* Cart Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="bg-amber-800 hover:bg-amber-900 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-lg flex items-center gap-2 border border-amber-600/50 transition"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Meu Carrinho ({cart.reduce((a, c) => a + c.quantity, 0)})</span>
              {cartSubtotal > 0 && <span>• R$ {cartSubtotal.toFixed(2)}</span>}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto lg:px-4">
        {/* Menu column */}
        <div className="flex-1 min-w-0">
          {/* Sticky search + categories */}
          <div className="sticky top-0 z-20 bg-[#F6F1EA] px-4 lg:px-0 py-3 border-b border-stone-200/70">
            <div className="relative max-w-md mb-2.5">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar pratos, bebidas ou sobremesas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-xl pl-10 pr-4 py-2 text-xs focus:ring-2 focus:ring-amber-700 focus:outline-none shadow-sm"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => { setSelectedCategory(cat.id); setHasManuallySelectedCategory(true); }}
                  className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                    selectedCategory === cat.id
                      ? 'bg-amber-800 text-white shadow-sm'
                      : 'bg-white text-stone-700 hover:bg-stone-200 border border-stone-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 lg:px-0 py-5 space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredProducts.map((prod) => (
                <div
                  key={prod.id}
                  onClick={() => handleOpenProduct(prod)}
                  className="bg-white p-4 rounded-2xl border border-stone-200 hover:border-amber-700/50 transition cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 flex items-center justify-between gap-4 group"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    {prod.promoPrice && (
                      <span className="inline-block bg-rose-100 text-rose-700 font-bold text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded mb-1">Promoção</span>
                    )}
                    <h3 className="font-bold text-sm text-stone-900 group-hover:text-amber-800 transition">
                      {prod.name}
                    </h3>
                    <p className="text-xs text-stone-500 line-clamp-2">{prod.description}</p>
                    <div className="pt-2 flex items-center gap-2">
                      <span className="text-sm font-bold text-stone-900">
                        R$ {(prod.promoPrice || prod.price).toFixed(2)}
                      </span>
                      {prod.promoPrice && (
                        <span className="text-xs text-stone-400 line-through">
                          R$ {prod.price.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-stone-100 shrink-0 border border-stone-200">
                    <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                    <button className="absolute bottom-1 right-1 bg-amber-800 text-white p-1 rounded-lg shadow">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Min-order progress trigger */}
            {cartSubtotal > 0 && companyProfile.minOrderValue > 0 && (
              <div className={`rounded-2xl border p-4 transition-colors ${minOrderMet ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-stone-200'}`}>
                <div className="flex items-center justify-between text-[11px] font-bold text-stone-600 mb-2">
                  {minOrderMet ? (
                    <span className="flex items-center gap-1.5 text-emerald-700">
                      <Check className="w-3.5 h-3.5" />
                      Pedido mínimo liberado
                    </span>
                  ) : (
                    <span>Faltam R$ {(companyProfile.minOrderValue - cartSubtotal).toFixed(2)} para o pedido mínimo</span>
                  )}
                  <span>R$ {cartSubtotal.toFixed(2)} / R$ {companyProfile.minOrderValue.toFixed(2)}</span>
                </div>
                <div className="h-2 rounded-full bg-stone-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${minOrderMet ? 'bg-emerald-600' : 'bg-amber-700'}`}
                    style={{ width: `${minOrderProgressPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cart backdrop */}
        {isCartOpen && (
          <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-40" onClick={() => setIsCartOpen(false)} />
        )}

        {/* Cart panel: overlay drawer, opened via the cart button (any screen size) */}
        <div className={`fixed inset-0 z-50 ${isCartOpen ? 'flex' : 'hidden'} justify-end`}>
          <div className="bg-white max-w-md w-full h-full shadow-2xl flex flex-col overflow-hidden">
            {/* Drawer Header */}
            <div className="bg-stone-900 text-white p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">Seu Pedido Online</h3>
              </div>
              <button onClick={() => setIsCartOpen(false)} className="p-1 rounded-lg hover:bg-stone-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            {checkoutStep !== 'tracking' && (
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
            )}

            {/* Drawer Body - Flow Steps */}
            <div className="p-5 flex-1 overflow-y-auto space-y-5">
              {checkoutStep === 'cart' && (
                <>
                  <h4 className="font-bold text-xs uppercase text-stone-500 tracking-wider">Itens Escolhidos</h4>
                  {cart.length === 0 ? (
                    <div className="text-center py-12 text-stone-400 space-y-2">
                      <ShoppingBag className="w-10 h-10 mx-auto opacity-40" />
                      <p className="text-xs">Seu carrinho está vazio.</p>
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
                      className={`p-2.5 rounded-xl border text-center font-bold flex flex-col items-center gap-1 ${
                        serviceType === 'entrega' ? 'bg-amber-800 text-white border-amber-800' : 'bg-stone-50 border-stone-200 text-stone-700'
                      }`}
                    >
                      <Truck className="w-4 h-4" />
                      <span>Entrega</span>
                    </button>
                    <button
                      onClick={() => setServiceType('retirada')}
                      className={`p-2.5 rounded-xl border text-center font-bold flex flex-col items-center gap-1 ${
                        serviceType === 'retirada' ? 'bg-amber-800 text-white border-amber-800' : 'bg-stone-50 border-stone-200 text-stone-700'
                      }`}
                    >
                      <StoreIcon className="w-4 h-4" />
                      <span>Retirada</span>
                    </button>
                    <button
                      onClick={() => setServiceType('consumo_local')}
                      className={`p-2.5 rounded-xl border text-center font-bold flex flex-col items-center gap-1 ${
                        serviceType === 'consumo_local' ? 'bg-amber-800 text-white border-amber-800' : 'bg-stone-50 border-stone-200 text-stone-700'
                      }`}
                    >
                      <Utensils className="w-4 h-4" />
                      <span>Mesa</span>
                    </button>
                  </div>

                  <h4 className="font-bold text-xs uppercase text-stone-500 tracking-wider pt-2">Seus Dados</h4>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Nome completo *"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full border border-stone-300 rounded-xl p-2.5"
                    />
                    <input
                      type="text"
                      placeholder="WhatsApp / Telefone com DDD *"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full border border-stone-300 rounded-xl p-2.5"
                    />
                  </div>

                  {serviceType === 'entrega' && (
                    <div className="space-y-2 pt-2">
                      <h4 className="font-bold text-xs uppercase text-stone-500 tracking-wider">Endereço de Entrega</h4>
                      <input
                        type="text"
                        placeholder="Rua / Avenida *"
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        className="w-full border border-stone-300 rounded-xl p-2.5"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Número *"
                          value={number}
                          onChange={(e) => setNumber(e.target.value)}
                          className="w-full border border-stone-300 rounded-xl p-2.5"
                        />
                        <input
                          type="text"
                          placeholder="Bairro *"
                          value={neighborhood}
                          onChange={(e) => setNeighborhood(e.target.value)}
                          className="w-full border border-stone-300 rounded-xl p-2.5"
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Complemento (Apto, Bloco)"
                        value={complement}
                        onChange={(e) => setComplement(e.target.value)}
                        className="w-full border border-stone-300 rounded-xl p-2.5"
                      />
                      <input
                        type="text"
                        placeholder="Ponto de referência"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        className="w-full border border-stone-300 rounded-xl p-2.5"
                      />
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
                      className={`w-full p-3 rounded-xl border text-left font-bold flex items-center justify-between ${
                        paymentMethod === 'pix' ? 'bg-emerald-50 border-emerald-600 text-emerald-950' : 'border-stone-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <QrCode className="w-4 h-4 text-emerald-700" />
                        <span>Pix Instantâneo (Aprovação Imediata)</span>
                      </div>
                      {paymentMethod === 'pix' && <CheckCircle2 className="w-4 h-4 text-emerald-700" />}
                    </button>

                    <button
                      onClick={() => setPaymentMethod('cartao_credito')}
                      className={`w-full p-3 rounded-xl border text-left font-bold flex items-center justify-between ${
                        paymentMethod === 'cartao_credito' ? 'bg-amber-50 border-amber-600 text-amber-950' : 'border-stone-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-amber-700" />
                        <span>Cartão de Crédito Online</span>
                      </div>
                      {paymentMethod === 'cartao_credito' && <CheckCircle2 className="w-4 h-4 text-amber-700" />}
                    </button>

                    <button
                      onClick={() => setPaymentMethod('dinheiro')}
                      className={`w-full p-3 rounded-xl border text-left font-bold flex items-center justify-between ${
                        paymentMethod === 'dinheiro' ? 'bg-amber-50 border-amber-600 text-amber-950' : 'border-stone-200'
                      }`}
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

              {checkoutStep === 'tracking' && activePlacedOrder && (
                <div className="space-y-4 text-xs text-center py-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-stone-900">Pedido Confirmado!</h4>
                    <p className="text-stone-500 mt-1">Pedido nº #{activePlacedOrder.orderNumber}</p>
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
                        onClick={() => {
                          setIsPixCopied(true);
                          addToast('success', 'Chave Pix Copiada!');
                        }}
                        className="w-full bg-emerald-700 text-white py-2 rounded-xl font-bold flex items-center justify-center gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{isPixCopied ? 'Chave Copiada!' : 'Copiar Código Pix'}</span>
                      </button>
                    </div>
                  )}

                  {/* Status Steps */}
                  <div className="space-y-2 text-left pt-2 border-t">
                    <p className="font-bold text-stone-800">Acompanhamento:</p>
                    <div className="space-y-2 pl-2 border-l-2 border-amber-600">
                      <div className="flex items-center gap-2 text-emerald-700 font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>1. Pedido Recebido</span>
                      </div>
                      <div className="flex items-center gap-2 text-amber-700 font-bold">
                        <Clock className="w-4 h-4" />
                        <span>2. Em Preparo na Cozinha</span>
                      </div>
                      <div className="flex items-center gap-2 text-stone-400">
                        <Truck className="w-4 h-4" />
                        <span>3. Saiu para Entrega</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            {checkoutStep !== 'tracking' && (
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
                      Pedido mínimo de R$ {companyProfile.minOrderValue.toFixed(2)} — faltam R$ {(companyProfile.minOrderValue - cartSubtotal).toFixed(2)}
                    </p>
                  )}
                </div>

                {checkoutStep === 'cart' && (
                  <button
                    disabled={cart.length === 0 || belowMinOrder}
                    onClick={() => setCheckoutStep('customer')}
                    className="w-full bg-amber-800 hover:bg-amber-900 text-white py-3 rounded-xl font-bold text-xs shadow-md disabled:opacity-50"
                  >
                    Avançar para Identificação
                  </button>
                )}

                {checkoutStep === 'customer' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCheckoutStep('cart')}
                      className="px-4 py-3 bg-stone-200 text-stone-700 rounded-xl font-bold text-xs"
                    >
                      Voltar
                    </button>
                    <button
                      onClick={() => setCheckoutStep('payment')}
                      className="flex-1 bg-amber-800 hover:bg-amber-900 text-white py-3 rounded-xl font-bold text-xs shadow-md"
                    >
                      Ir para Pagamento
                    </button>
                  </div>
                )}

                {checkoutStep === 'payment' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCheckoutStep('customer')}
                      className="px-4 py-3 bg-stone-200 text-stone-700 rounded-xl font-bold text-xs"
                    >
                      Voltar
                    </button>
                    <button
                      onClick={handleFinalizeOrder}
                      disabled={!canFinalizeOrder}
                      title={canFinalizeOrder ? undefined : 'Você não tem permissão para finalizar pedidos'}
                      className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white py-3 rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <Sparkles className="w-4 h-4" />
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
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-3 right-3 bg-stone-900/70 text-white p-2 rounded-full hover:bg-stone-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <h3 className="font-bold text-lg text-stone-900">{selectedProduct.name}</h3>
                <p className="text-xs text-stone-500 mt-1">{selectedProduct.description}</p>
                <p className="text-base font-bold text-amber-800 mt-2">
                  R$ {(selectedProduct.promoPrice || selectedProduct.price).toFixed(2)}
                </p>
              </div>

              {/* Additions list */}
              {selectedProduct.additions && selectedProduct.additions.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <span className="font-semibold text-xs text-stone-700 block uppercase tracking-wider">
                    Deseja Adicionais?
                  </span>
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

              {/* Custom Observations */}
              <div className="space-y-1 pt-2 border-t">
                <span className="font-semibold text-xs text-stone-700 block">Observações do pedido</span>
                <textarea
                  placeholder="Ex: sem cebola, ponto da carne, pouco sal..."
                  value={productNotes}
                  onChange={(e) => setProductNotes(e.target.value)}
                  className="w-full border border-stone-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-amber-700 focus:outline-none"
                  rows={2}
                />
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-4">
              <div className="flex items-center border border-stone-300 bg-white rounded-xl">
                <button
                  onClick={() => setProductQty(Math.max(1, productQty - 1))}
                  className="p-2 text-stone-600 hover:text-stone-900"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-3 text-xs font-bold">{productQty}</span>
                <button
                  onClick={() => setProductQty(productQty + 1)}
                  className="p-2 text-stone-600 hover:text-stone-900"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={handleAddToCart}
                className="flex-1 bg-amber-800 hover:bg-amber-900 text-white py-2.5 px-4 rounded-xl font-bold text-xs shadow-md flex items-center justify-between"
              >
                <span>Adicionar ao Carrinho</span>
                <span>
                  R${' '}
                  {(
                    ((selectedProduct.promoPrice || selectedProduct.price) +
                      selectedAdditions.reduce((a, b) => a + b.price, 0)) *
                    productQty
                  ).toFixed(2)}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Floating Active Order Notification Bar */}
      {latestActiveOrder && (
        <div className="lg:hidden fixed bottom-4 left-4 right-4 max-w-lg mx-auto z-40 bg-stone-900 text-white p-3.5 rounded-2xl shadow-2xl border border-amber-600/50 flex items-center justify-between gap-3 animate-slide-up">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-800 text-amber-300 flex items-center justify-center font-bold shrink-0 animate-pulse">
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold text-xs truncate">Pedido #{latestActiveOrder.orderNumber}</p>
                <span className="text-[9px] bg-amber-500 text-stone-950 font-black px-1.5 py-0.2 rounded uppercase shrink-0">
                  {latestActiveOrder.orderStatus === 'novo' ? 'Recebido' : latestActiveOrder.orderStatus.replace('_', ' ')}
                </span>
              </div>
              <p className="text-[11px] text-stone-300 truncate">
                {latestActiveOrder.orderStatus === 'novo' && 'Aguardando preparo na cozinha...'}
                {latestActiveOrder.orderStatus === 'em_preparo' && '🍳 Em preparo na cozinha!'}
                {latestActiveOrder.orderStatus === 'saiu_entrega' && '🛵 Saiu para entrega!'}
                {latestActiveOrder.orderStatus === 'pronto' && '✅ Pronto para retirada/servir!'}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setTrackingModalOrderId(latestActiveOrder.id);
              setIsTrackingModalOpen(true);
            }}
            className="bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold px-3.5 py-2 rounded-xl shrink-0 transition border border-amber-600/50 shadow"
          >
            Acompanhar
          </button>
        </div>
      )}

      {/* Real-time Order Tracking Modal */}
      <OnlineOrderTrackingModal
        isOpen={isTrackingModalOpen}
        onClose={() => setIsTrackingModalOpen(false)}
        initialOrderId={trackingModalOrderId}
        placedOrderIds={placedOrderIds}
      />

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
