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
  Loader2
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { rowToCamel } from '../../lib/caseMapping';
import { Product, ProductAddition, PaymentMethod, Category, CompanyProfileData, OrderItem } from '../../types';
import { LegalModal } from '../legal/LegalModal';

// Página pública do cardápio online — pedido como convidado, sem login.
// Propositalmente não usa AppContext/useApp(): roda fora da árvore
// autenticada, com a chave anon do Supabase, então busca os próprios dados
// (perfil da empresa, categorias, produtos) e cria o pedido direto via RPC.
// Acompanhamento do pedido depois de feito fica para uma próxima etapa —
// a tela de confirmação abaixo é só um resumo estático do que foi pedido.

interface Message { type: 'success' | 'error'; text: string }

export const PublicOnlineMenu: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfileData | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('company_profile').select('*').eq('id', true).single(),
      supabase.from('categories').select('*'),
      supabase.from('products').select('*'),
    ]).then(([companyRes, categoriesRes, productsRes]) => {
      if (companyRes.data) setCompanyProfile(rowToCamel<CompanyProfileData>(companyRes.data));
      if (categoriesRes.data) setCategories(categoriesRes.data.map((r) => rowToCamel<Category>(r)));
      if (productsRes.data) setProducts(productsRes.data.map((r) => rowToCamel<Product>(r)));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  const findPratoFeitoCategoryId = (cats: Category[]) =>
    cats.find((c) => c.name.trim().toLowerCase() === 'prato feito')?.id;

  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [hasManuallySelectedCategory, setHasManuallySelectedCategory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (hasManuallySelectedCategory || selectedCategory || categories.length === 0) return;
    setSelectedCategory(findPratoFeitoCategoryId(categories) || categories[0].id);
  }, [categories, hasManuallySelectedCategory, selectedCategory]);

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
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [complement, setComplement] = useState('');
  const [reference, setReference] = useState('');
  const [isPixCopied, setIsPixCopied] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState<number | null>(null);

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
    setSelectedAdditions((prev) =>
      prev.some((a) => a.id === add.id) ? prev.filter((a) => a.id !== add.id) : [...prev, add]
    );
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;
    const additionsPrice = selectedAdditions.reduce((acc, a) => acc + a.price, 0);
    const unitPrice = (selectedProduct.promoPrice || selectedProduct.price) + additionsPrice;

    setCart((prev) => [...prev, { product: selectedProduct, quantity: productQty, additions: selectedAdditions, notes: productNotes, unitPrice }]);
    setMessage({ type: 'success', text: `${productQty}x ${selectedProduct.name} adicionado ao carrinho.` });
    setSelectedProduct(null);
  };

  const removeFromCart = (index: number) => setCart((prev) => prev.filter((_, i) => i !== index));

  const cartSubtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const cartDeliveryFee = serviceType === 'entrega' ? (companyProfile?.deliveryFee || 0) : 0;
  const cartTotal = cartSubtotal + cartDeliveryFee;

  const belowMinOrder = cartSubtotal > 0 && cartSubtotal < (companyProfile?.minOrderValue || 0);

  const handleFinalizeOrder = async () => {
    if (belowMinOrder) {
      setMessage({ type: 'error', text: `Pedido mínimo de R$ ${companyProfile?.minOrderValue.toFixed(2)}. Faltam R$ ${((companyProfile?.minOrderValue || 0) - cartSubtotal).toFixed(2)}.` });
      return;
    }
    if (!customerName || !customerPhone) {
      setMessage({ type: 'error', text: 'Nome e WhatsApp/Telefone são obrigatórios.' });
      return;
    }
    if (serviceType === 'entrega' && (!street || !number || !neighborhood)) {
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
    const newOrder = {
      id: 'ord-' + Date.now(),
      orderNumber,
      channel: 'online',
      customer: {
        name: customerName,
        phone: customerPhone,
        address: serviceType === 'entrega' ? { street, number, neighborhood, complement, reference } : undefined,
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
      setCustomerName('');
      setCustomerPhone('');
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
      <div className="min-h-screen bg-[#F6F1EA] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-800 animate-spin" />
      </div>
    );
  }

  if (!companyProfile) {
    return (
      <div className="min-h-screen bg-[#F6F1EA] flex items-center justify-center p-4 text-center text-sm text-stone-500">
        Não foi possível carregar o cardápio agora. Tente novamente em instantes.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F1EA] text-stone-900 pb-28">
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

      {/* Restaurant Header Banner */}
      <div className="relative h-48 sm:h-64 w-full bg-stone-900 overflow-hidden">
        <img src={companyProfile.coverUrl} alt="Capa Restaurante" className="w-full h-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/40 to-transparent" />

        <div className="absolute bottom-4 left-4 right-4 max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-end justify-between gap-4 text-white">
          <div className="flex items-center gap-4">
            <img src={companyProfile.logoUrl} alt="Logo" className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-white/80 object-cover shadow-lg shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{companyProfile.tradeName}</h1>
                <span className="text-[10px] bg-emerald-700 text-white font-bold px-2 py-0.5 rounded-full uppercase">Aberto</span>
              </div>
              <p className="text-xs text-stone-300 mt-1 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Preparo médio: {companyProfile.avgPrepTimeMinutes} min</span>
                <span>•</span>
                <span>Pedido mín: R$ {companyProfile.minOrderValue.toFixed(2)}</span>
              </p>
              <p className="text-xs text-stone-300 flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>{companyProfile.address.street}, {companyProfile.address.number} - {companyProfile.address.neighborhood}</span>
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenCart}
            className="self-start sm:self-auto bg-amber-800 hover:bg-amber-900 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-lg flex items-center gap-2 border border-amber-600/50 transition"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Meu Carrinho ({cart.reduce((a, c) => a + c.quantity, 0)})</span>
            {cartSubtotal > 0 && <span>• R$ {cartSubtotal.toFixed(2)}</span>}
          </button>
        </div>
      </div>

      {/* Main Catalog View */}
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="space-y-3">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Buscar pratos, bebidas ou sobremesas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-stone-300 rounded-xl pl-10 pr-4 py-2 text-xs focus:ring-2 focus:ring-amber-700 focus:outline-none shadow-sm"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setSelectedCategory(cat.id); setHasManuallySelectedCategory(true); }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategory === cat.id ? 'bg-amber-800 text-white shadow-sm' : 'bg-white text-stone-700 hover:bg-stone-200 border border-stone-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProducts.map((prod) => (
            <div
              key={prod.id}
              onClick={() => handleOpenProduct(prod)}
              className="bg-white p-4 rounded-2xl border border-stone-200 hover:border-amber-700/50 transition cursor-pointer shadow-sm hover:shadow-md flex items-center justify-between gap-4 group"
            >
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-stone-900 group-hover:text-amber-800 transition">{prod.name}</h3>
                  {prod.promoPrice && <span className="bg-rose-100 text-rose-700 font-bold text-[10px] px-1.5 py-0.5 rounded">Promo</span>}
                </div>
                <p className="text-xs text-stone-500 line-clamp-2">{prod.description}</p>
                <div className="pt-2 flex items-center gap-2">
                  <span className="text-sm font-bold text-stone-900">R$ {(prod.promoPrice || prod.price).toFixed(2)}</span>
                  {prod.promoPrice && <span className="text-xs text-stone-400 line-through">R$ {prod.price.toFixed(2)}</span>}
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
          {filteredProducts.length === 0 && (
            <p className="text-xs text-stone-400 text-center py-10 col-span-full">Nenhum produto encontrado.</p>
          )}
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
                  onChange={(e) => setProductNotes(e.target.value)}
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
                className="flex-1 bg-amber-800 hover:bg-amber-900 text-white py-2.5 px-4 rounded-xl font-bold text-xs shadow-md flex items-center justify-between"
              >
                <span>Adicionar ao Carrinho</span>
                <span>
                  R${' '}
                  {(((selectedProduct.promoPrice || selectedProduct.price) + selectedAdditions.reduce((a, b) => a + b.price, 0)) * productQty).toFixed(2)}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer / Checkout Flow */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex justify-end">
          <div className="bg-white max-w-md w-full h-full shadow-2xl flex flex-col justify-between overflow-hidden">
            <div className="bg-stone-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">Seu Pedido Online</h3>
              </div>
              <button onClick={() => setIsCartOpen(false)} className="p-1 rounded-lg hover:bg-stone-800">
                <X className="w-5 h-5" />
              </button>
            </div>

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
                    <input type="text" placeholder="Nome completo *" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full border border-stone-300 rounded-xl p-2.5" />
                    <input type="text" placeholder="WhatsApp / Telefone com DDD *" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="w-full border border-stone-300 rounded-xl p-2.5" />
                  </div>

                  {serviceType === 'entrega' && (
                    <div className="space-y-2 pt-2">
                      <h4 className="font-bold text-xs uppercase text-stone-500 tracking-wider">Endereço de Entrega</h4>
                      <input type="text" placeholder="Rua / Avenida *" value={street} onChange={(e) => setStreet(e.target.value)} className="w-full border border-stone-300 rounded-xl p-2.5" />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" placeholder="Número *" value={number} onChange={(e) => setNumber(e.target.value)} className="w-full border border-stone-300 rounded-xl p-2.5" />
                        <input type="text" placeholder="Bairro *" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className="w-full border border-stone-300 rounded-xl p-2.5" />
                      </div>
                      <input type="text" placeholder="Complemento (Apto, Bloco)" value={complement} onChange={(e) => setComplement(e.target.value)} className="w-full border border-stone-300 rounded-xl p-2.5" />
                      <input type="text" placeholder="Ponto de referência" value={reference} onChange={(e) => setReference(e.target.value)} className="w-full border border-stone-300 rounded-xl p-2.5" />
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
                </div>
              )}
            </div>

            {checkoutStep !== 'confirmed' && (
              <div className="p-4 bg-stone-50 border-t border-stone-200 space-y-3">
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
                    <button onClick={() => setCheckoutStep('cart')} className="px-4 py-3 bg-stone-200 text-stone-700 rounded-xl font-bold text-xs">
                      Voltar
                    </button>
                    <button onClick={() => setCheckoutStep('payment')} className="flex-1 bg-amber-800 hover:bg-amber-900 text-white py-3 rounded-xl font-bold text-xs shadow-md">
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
                      disabled={isPlacingOrder}
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
