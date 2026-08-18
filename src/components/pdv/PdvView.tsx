import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Monitor, 
  Search, 
  Barcode, 
  Plus, 
  Minus, 
  X, 
  Trash2, 
  DollarSign, 
  CreditCard, 
  QrCode, 
  Printer, 
  CheckCircle2, 
  Percent, 
  User, 
  ShoppingBag,
  Sparkles,
  Scale,
  UtensilsCrossed,
  Coffee
} from 'lucide-react';
import { Product, PaymentMethod, OrderItem } from '../../types';
import { PrintReceiptModal } from '../common/PrintReceiptModal';
import { KgWeightEntryModal } from '../common/KgWeightEntryModal';

export const PdvView: React.FC = () => {
  const { products, categories, createPdvSale, cashShift, companyProfile, addToast } = useApp();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeQuery, setBarcodeQuery] = useState('');

  // Cart State
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);
  const [discountInput, setDiscountInput] = useState<number>(0);
  const [customerNameInput, setCustomerNameInput] = useState<string>('Cliente Balcão');
  const [serviceType, setServiceType] = useState<'consumo_local' | 'retirada' | 'entrega'>('retirada');

  // Payment Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [cashTendered, setCashTendered] = useState<number>(0);

  // Print Receipt modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [lastCompletedSale, setLastCompletedSale] = useState<any>(null);

  // KG Weight Modal State
  const [isKgModalOpen, setIsKgModalOpen] = useState(false);
  const [selectedKgType, setSelectedKgType] = useState<'lunch' | 'breakfast'>('lunch');

  const lunchPrice = companyProfile.buffetPrices?.lunchPricePerKg ?? 80.00;
  const breakfastPrice = companyProfile.buffetPrices?.breakfastPricePerKg ?? 54.99;

  const filteredProducts = products.filter((p) => {
    const matchCat = selectedCategory === 'all' || p.categoryId === selectedCategory;
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (p.barcode && p.barcode.includes(searchQuery));
    return matchCat && matchSearch && p.available;
  });

  const addToCart = (product: Product) => {
    // If product is sold by KG or named 'por quilo', open weight modal
    if (product.unit === 'KG' || product.name.toLowerCase().includes('por quilo') || product.id.includes('kg')) {
      const isCafe = product.name.toLowerCase().includes('café');
      setSelectedKgType(isCafe ? 'breakfast' : 'lunch');
      setIsKgModalOpen(true);
      return;
    }

    const existingIndex = cartItems.findIndex((item) => item.productId === product.id);
    const unitPrice = product.promoPrice || product.price;

    if (existingIndex !== -1) {
      const updated = [...cartItems];
      updated[existingIndex].quantity += 1;
      setCartItems(updated);
    } else {
      setCartItems([
        ...cartItems,
        {
          id: 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice,
          additions: [],
        },
      ]);
    }
  };

  const handleConfirmKgItem = (kgData: {
    productId: string;
    productName: string;
    weightKg: number;
    pricePerKg: number;
    totalPrice: number;
    notes: string;
  }) => {
    setCartItems((prev) => [
      ...prev,
      {
        id: 'item-kg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        productId: kgData.productId,
        productName: kgData.productName,
        quantity: 1,
        unitPrice: kgData.totalPrice,
        additions: [],
        notes: kgData.notes,
      },
    ]);
    addToast('success', 'Comida por Quilo Adicionada', `${kgData.productName} - R$ ${kgData.totalPrice.toFixed(2).replace('.', ',')}`);
  };

  const updateItemQty = (id: string, newQty: number) => {
    if (newQty <= 0) {
      setCartItems(cartItems.filter((i) => i.id !== id));
    } else {
      setCartItems(cartItems.map((i) => (i.id === id ? { ...i, quantity: newQty } : i)));
    }
  };

  const subtotal = cartItems.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  const total = Math.max(0, subtotal - discountInput);
  const changeDue = Math.max(0, cashTendered - total);

  const handleFinalizeSale = () => {
    if (cartItems.length === 0) {
      addToast('error', 'Carrinho Vazio', 'Adicione produtos antes de finalizar.');
      return;
    }

    if (cashShift.status !== 'aberto') {
      addToast('warning', 'Caixa Fechado', 'Abra o caixa no módulo Controle de Caixa antes de lançar vendas.');
    }

    const sale = createPdvSale(
      cartItems,
      paymentMethod,
      serviceType,
      customerNameInput || 'Cliente Balcão',
      discountInput
    );

    setLastCompletedSale(sale);
    setIsPaymentModalOpen(false);
    setIsPrintModalOpen(true);

    // Reset PDV state
    setCartItems([]);
    setDiscountInput(0);
    setCustomerNameInput('Cliente Balcão');
    setCashTendered(0);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      {/* Top Banner */}
      <div className="bg-stone-900 text-stone-100 p-4 rounded-2xl shadow-md border border-stone-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-800 text-white font-bold flex items-center justify-center shadow">
            <Monitor className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-stone-100">PDV & Frente de Caixa</h2>
            <p className="text-[11px] text-stone-400">
              Venda rápida no balcão com leitor de código de barras e emissão NFC-e.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-xl border ${
            cashShift.status === 'aberto' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-rose-950 text-rose-400 border-rose-800'
          }`}>
            Caixa: {cashShift.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Main PDV Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Columns: Products Catalog Grid */}
        <div className="lg:col-span-7 space-y-4">
          {/* Quick Launch Cards: Comida Por Quilo (Buffet & Balança) */}
          <div className="bg-gradient-to-r from-amber-900 to-amber-950 text-white p-3.5 rounded-2xl shadow-md border border-amber-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-800 text-amber-200 rounded-lg">
                  <Scale className="w-4 h-4" />
                </div>
                <span className="font-bold text-xs uppercase tracking-wider text-amber-200">
                  Lançamento de Comida Por Quilo (Balança)
                </span>
              </div>
              <span className="text-[10px] text-amber-300 font-mono">Autocalculado em R$ / kg</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedKgType('lunch');
                  setIsKgModalOpen(true);
                }}
                className="bg-white/10 hover:bg-white/20 border border-amber-700/60 p-2.5 rounded-xl transition text-left flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-700 text-white flex items-center justify-center font-bold">
                    <UtensilsCrossed className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-xs text-white group-hover:text-amber-200">Almoço por Quilo</p>
                    <p className="text-[10px] text-amber-300 font-mono">R$ {lunchPrice.toFixed(2).replace('.', ',')} / kg</p>
                  </div>
                </div>
                <span className="text-xs bg-amber-800/80 px-2 py-1 rounded-lg font-bold text-amber-200">Lançar</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedKgType('breakfast');
                  setIsKgModalOpen(true);
                }}
                className="bg-white/10 hover:bg-white/20 border border-amber-700/60 p-2.5 rounded-xl transition text-left flex items-center justify-between group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-700 text-white flex items-center justify-center font-bold">
                    <Coffee className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-xs text-white group-hover:text-amber-200">Café da Manhã por Quilo</p>
                    <p className="text-[10px] text-amber-300 font-mono">R$ {breakfastPrice.toFixed(2).replace('.', ',')} / kg</p>
                  </div>
                </div>
                <span className="text-xs bg-amber-800/80 px-2 py-1 rounded-lg font-bold text-amber-200">Lançar</span>
              </button>
            </div>
          </div>

          {/* Search & Barcode Input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Buscar por nome ou código..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:ring-2 focus:ring-amber-700"
              />
            </div>
            <div className="relative w-48">
              <Barcode className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Cód. Barras"
                value={barcodeQuery}
                onChange={(e) => setBarcodeQuery(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-xl pl-9 pr-3 py-2.5 text-xs font-mono"
              />
            </div>
          </div>

          {/* Categories Horizontal */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap ${
                selectedCategory === 'all' ? 'bg-amber-800 text-white' : 'bg-white border text-stone-700'
              }`}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap ${
                  selectedCategory === cat.id ? 'bg-amber-800 text-white' : 'bg-white border text-stone-700'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[520px] overflow-y-auto">
            {filteredProducts.map((p) => (
              <div
                key={p.id}
                onClick={() => addToCart(p)}
                className="bg-white p-3 rounded-2xl border border-stone-200 hover:border-amber-700 cursor-pointer transition shadow-sm hover:shadow-md flex flex-col justify-between h-36 group"
              >
                <div className="space-y-1">
                  <span className="text-[10px] text-stone-400 font-mono">CÓD {p.code}</span>
                  <p className="font-bold text-xs text-stone-900 group-hover:text-amber-800 line-clamp-2">
                    {p.name}
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="font-bold text-amber-800 text-xs">
                    R$ {(p.promoPrice || p.price).toFixed(2)}
                  </span>
                  <button className="bg-amber-800 text-white p-1 rounded-lg">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 5 Columns: Active Order Terminal */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="font-bold text-stone-900 text-sm">Comanda Balcão</h3>
              <button
                onClick={() => setCartItems([])}
                className="text-xs text-rose-600 hover:underline flex items-center gap-1 font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar</span>
              </button>
            </div>

            {/* Customer & Service type selector */}
            <div className="grid grid-cols-2 gap-2 my-3">
              <input
                type="text"
                placeholder="Nome do cliente"
                value={customerNameInput}
                onChange={(e) => setCustomerNameInput(e.target.value)}
                className="border rounded-xl p-2 text-xs"
              />
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as any)}
                className="border rounded-xl p-2 text-xs font-semibold text-stone-700"
              >
                <option value="retirada">Retirada no Balcão</option>
                <option value="consumo_local">Consumo no Local</option>
                <option value="entrega">Entrega / Delivery</option>
              </select>
            </div>

            {/* Cart Items List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {cartItems.length === 0 ? (
                <p className="text-xs text-stone-400 py-12 text-center font-medium">
                  Selecione produtos no catálogo ao lado para montar o pedido.
                </p>
              ) : (
                cartItems.map((item) => (
                  <div key={item.id} className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <p className="font-bold text-stone-900">{item.productName}</p>
                      <p className="text-[10px] text-stone-500">Un: R$ {item.unitPrice.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center border bg-white rounded-lg">
                        <button onClick={() => updateItemQty(item.id, item.quantity - 1)} className="p-1 hover:text-stone-900">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 font-bold">{item.quantity}</span>
                        <button onClick={() => updateItemQty(item.id, item.quantity + 1)} className="p-1 hover:text-stone-900">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="font-bold text-amber-800">
                        R$ {(item.unitPrice * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bottom Totals & Tender Action */}
          <div className="pt-4 border-t space-y-3">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-stone-600">
                <span>Subtotal:</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-stone-600">
                <span>Desconto (R$):</span>
                <input
                  type="number"
                  min="0"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(Number(e.target.value))}
                  className="w-20 border rounded-lg p-1 text-right text-xs font-semibold"
                />
              </div>
              <div className="flex justify-between font-bold text-lg text-stone-900 border-t pt-2">
                <span>TOTAL:</span>
                <span>R$ {total.toFixed(2)}</span>
              </div>
            </div>

            <button
              disabled={cartItems.length === 0}
              onClick={() => setIsPaymentModalOpen(true)}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-3 rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <DollarSign className="w-5 h-5" />
              <span>Receber Pagamento & Finalizar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Payment Tendering Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-stone-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-stone-900 text-base">Recebimento de Venda</h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-center">
              <p className="text-xs text-stone-600">Valor Total a Pagar</p>
              <p className="text-2xl font-bold text-amber-900">R$ {total.toFixed(2)}</p>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2 text-xs">
              <span className="font-semibold text-stone-700 block">Forma de Pagamento</span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'pix' as PaymentMethod, label: 'Pix QR Code', icon: QrCode },
                  { id: 'cartao_credito' as PaymentMethod, label: 'Cartão Crédito', icon: CreditCard },
                  { id: 'cartao_debito' as PaymentMethod, label: 'Cartão Débito', icon: CreditCard },
                  { id: 'dinheiro' as PaymentMethod, label: 'Dinheiro Espécie', icon: DollarSign },
                ].map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setPaymentMethod(m.id)}
                      className={`p-3 rounded-xl border text-left font-bold flex items-center gap-2 ${
                        paymentMethod === m.id ? 'bg-amber-800 text-white border-amber-800' : 'bg-stone-50 border-stone-200 text-stone-700'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {paymentMethod === 'dinheiro' && (
              <div className="space-y-2 text-xs pt-2">
                <label className="font-semibold text-stone-700 block">Valor Entregue pelo Cliente (R$)</label>
                <input
                  type="number"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(Number(e.target.value))}
                  className="w-full border rounded-xl p-2.5 font-bold text-sm"
                />
                <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between font-bold text-emerald-800">
                  <span>Troco a Devolver:</span>
                  <span>R$ {changeDue.toFixed(2)}</span>
                </div>
              </div>
            )}

            <button
              onClick={handleFinalizeSale}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-3 rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Concluir Venda e Emitir NFC-e</span>
            </button>
          </div>
        </div>
      )}

      {/* Print Receipt Modal */}
      {isPrintModalOpen && lastCompletedSale && (
        <PrintReceiptModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          title="Comprovante de Venda PDV"
          receiptData={{
            orderNumber: lastCompletedSale.orderNumber,
            customerName: lastCompletedSale.customer.name,
            items: lastCompletedSale.items.map((i: any) => ({ name: i.productName, quantity: i.quantity, price: i.unitPrice })),
            subtotal: lastCompletedSale.subtotal,
            discount: lastCompletedSale.discount,
            total: lastCompletedSale.total,
            paymentMethod: lastCompletedSale.paymentMethod,
            nfceKey: lastCompletedSale.nfceKey,
            type: 'caixa',
          }}
        />
      )}

      {/* Kg Weight Entry Modal */}
      <KgWeightEntryModal
        isOpen={isKgModalOpen}
        onClose={() => setIsKgModalOpen(false)}
        onConfirm={handleConfirmKgItem}
        initialType={selectedKgType}
      />
    </div>
  );
};
