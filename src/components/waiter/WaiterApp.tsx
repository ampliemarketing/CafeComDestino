import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Smartphone, 
  Utensils, 
  Plus, 
  Search, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Users, 
  Receipt, 
  ArrowRightLeft, 
  Send, 
  ChevronRight, 
  Minus,
  Sparkles,
  Printer,
  Trash2,
  DollarSign,
  Scale,
  Coffee,
  UtensilsCrossed
} from 'lucide-react';
import { DiningTable, Product, ProductAddition, TableStatus } from '../../types';
import { PrintReceiptModal } from '../common/PrintReceiptModal';
import { KgWeightEntryModal } from '../common/KgWeightEntryModal';

export const WaiterApp: React.FC = () => {
  const { 
    tables, 
    products, 
    categories, 
    currentUser, 
    companyProfile,
    openTable, 
    addTableItem, 
    cancelTableItem, 
    transferTable, 
    closeTableAndPay,
    addToast 
  } = useApp();

  const [selectedTable, setSelectedTable] = useState<DiningTable | null>(null);
  const [activeTab, setActiveTab] = useState<'map' | 'order' | 'comanda'>('map');

  // KG Weight Modal State
  const [isKgModalOpen, setIsKgModalOpen] = useState(false);
  const [selectedKgType, setSelectedKgType] = useState<'lunch' | 'breakfast'>('lunch');

  const lunchPrice = companyProfile.buffetPrices?.lunchPricePerKg ?? 80.00;
  const breakfastPrice = companyProfile.buffetPrices?.breakfastPricePerKg ?? 54.99;

  // Open table modal
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);
  const [tableToOpen, setTableToOpen] = useState<DiningTable | null>(null);
  const [guestCountInput, setGuestCountInput] = useState(2);
  const [clientNameInput, setClientNameInput] = useState('');

  // Order Launch State
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productQty, setProductQty] = useState(1);
  const [selectedAdditions, setSelectedAdditions] = useState<ProductAddition[]>([]);
  const [customNotes, setCustomNotes] = useState('');

  // Split bill calculator modal
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [splitPeopleCount, setSplitPeopleCount] = useState(2);

  // Transfer Table modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferTargetTableId, setTransferTargetTableId] = useState('');

  // Pre-bill print modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const handleConfirmKgTableItem = (kgData: {
    productId: string;
    productName: string;
    weightKg: number;
    pricePerKg: number;
    totalPrice: number;
    notes: string;
  }) => {
    if (!currentActiveTable) return;
    addTableItem(currentActiveTable.id, {
      productId: kgData.productId,
      productName: kgData.productName,
      quantity: 1,
      unitPrice: kgData.totalPrice,
      additions: [],
      notes: kgData.notes,
      waiterName: currentUser?.name || 'Garçom',
    });
    addToast('success', 'Item por Quilo Adicionado', `${kgData.productName} (R$ ${kgData.totalPrice.toFixed(2).replace('.', ',')}) na Mesa #${currentActiveTable.number}`);
  };
  const getStatusBadge = (status: TableStatus) => {
    switch (status) {
      case 'livre': return { label: 'Livre', class: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      case 'ocupada': return { label: 'Ocupada', class: 'bg-amber-100 text-amber-800 border-amber-300' };
      case 'em_preparo': return { label: 'Em Preparo', class: 'bg-orange-100 text-orange-800 border-orange-300' };
      case 'pedido_pronto': return { label: 'Pedido Pronto!', class: 'bg-blue-100 text-blue-800 border-blue-400 animate-pulse' };
      case 'aguardando_fechamento': return { label: 'Fechamento', class: 'bg-rose-100 text-rose-800 border-rose-300' };
      default: return { label: 'Livre', class: 'bg-stone-100 text-stone-700' };
    }
  };

  const handleOpenTableClick = (tb: DiningTable) => {
    if (tb.status === 'livre') {
      setTableToOpen(tb);
      setGuestCountInput(2);
      setClientNameInput('');
      setIsOpenModalOpen(true);
    } else {
      setSelectedTable(tb);
      setActiveTab('comanda');
    }
  };

  const confirmOpenTable = () => {
    if (!tableToOpen) return;
    openTable(tableToOpen.id, guestCountInput, clientNameInput);
    setIsOpenModalOpen(false);
    
    // Select newly opened table
    const updated = tables.find((t) => t.id === tableToOpen.id);
    if (updated) setSelectedTable(updated);
    setActiveTab('order');
  };

  const handleSendItemToKitchen = () => {
    if (!selectedTable || !selectedProduct) return;
    addTableItem(selectedTable.id, selectedProduct.id, productQty, selectedAdditions, customNotes);
    
    setSelectedProduct(null);
    setProductQty(1);
    setSelectedAdditions([]);
    setCustomNotes('');
    addToast('success', 'Pedido enviado à Cozinha!', `Mesa #${selectedTable.number}`);
  };

  const currentActiveTable = selectedTable ? tables.find((t) => t.id === selectedTable.id) : null;

  return (
    <div className="min-h-screen bg-[#F6F1EA] text-stone-900 pb-20 p-3 sm:p-5 max-w-4xl mx-auto space-y-4">
      {/* Waiter Header Banner */}
      <div className="bg-stone-900 text-stone-100 p-4 rounded-2xl shadow-md border border-stone-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-800 text-white font-bold flex items-center justify-center text-sm shadow">
            <Smartphone className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm text-stone-100">Aplicativo do Garçom</h2>
              <span className="text-[10px] bg-amber-900 text-amber-300 px-1.5 py-0.5 rounded font-mono">
                {currentUser.name}
              </span>
            </div>
            <p className="text-[11px] text-stone-400 mt-0.5">
              {tables.filter((t) => t.status !== 'livre').length} mesas abertas • Atendimento Salão
            </p>
          </div>
        </div>

        <button
          onClick={() => setActiveTab('map')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
            activeTab === 'map' ? 'bg-amber-800 text-white border-amber-700' : 'bg-stone-800 text-stone-300 border-stone-700 hover:text-white'
          }`}
        >
          Mapa Mesas
        </button>
      </div>

      {/* Main Table Map View */}
      {activeTab === 'map' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-stone-200">
            <h3 className="font-bold text-stone-900 text-xs uppercase tracking-wider">
              Mesas e Comandas do Salão
            </h3>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
              {tables.filter((t) => t.status === 'livre').length} livres
            </span>
          </div>

          {/* Tables Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {tables.map((tb) => {
              const badge = getStatusBadge(tb.status);
              return (
                <div
                  key={tb.id}
                  onClick={() => handleOpenTableClick(tb)}
                  className={`bg-white p-4 rounded-2xl border-2 transition cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between h-36 ${
                    tb.status === 'livre'
                      ? 'border-emerald-300 hover:border-emerald-500 bg-emerald-50/20'
                      : 'border-amber-600 hover:border-amber-700 bg-amber-50/30'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xl font-bold text-stone-900">Mesa {tb.number}</span>
                      <p className="text-[10px] text-stone-500 font-semibold">{tb.sector}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${badge.class}`}>
                      {badge.label}
                    </span>
                  </div>

                  {tb.status !== 'livre' ? (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-stone-800 truncate">{tb.clientName}</p>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-stone-500">{tb.guestCount} pess • {tb.openedAt}</span>
                        <span className="font-bold text-amber-800">R$ {tb.subtotal.toFixed(2)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-stone-400 text-xs flex items-center gap-1">
                      <Plus className="w-4 h-4 text-emerald-600" />
                      <span>Toque para abrir</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Order Launch View for Selected Table */}
      {activeTab === 'order' && currentActiveTable && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-stone-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-stone-900 text-sm">
                Novo Pedido • Mesa #{currentActiveTable.number} ({currentActiveTable.clientName})
              </h3>
              <p className="text-xs text-stone-500">Selecione os produtos para enviar à cozinha</p>
            </div>
            <button
              onClick={() => setActiveTab('comanda')}
              className="bg-stone-800 text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1"
            >
              <span>Ver Comanda</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Quilo Launch for Waiter */}
          <div className="bg-gradient-to-r from-amber-900 to-stone-900 text-white p-3 rounded-2xl shadow-sm border border-amber-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-amber-300" />
                <span className="font-bold text-xs uppercase tracking-wider text-amber-200">Lançar Comida Por Quilo</span>
              </div>
              <span className="text-[10px] text-amber-300 font-mono">Balança Buffet</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setSelectedKgType('lunch'); setIsKgModalOpen(true); }}
                className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl border border-amber-700/60 flex items-center justify-between group transition text-left"
              >
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="w-4 h-4 text-amber-300 shrink-0" />
                  <div>
                    <p className="font-bold text-xs text-white group-hover:text-amber-200">Almoço por Quilo</p>
                    <p className="text-[10px] text-amber-300 font-mono">R$ {lunchPrice.toFixed(2).replace('.', ',')}/kg</p>
                  </div>
                </div>
                <span className="text-[10px] bg-amber-800 px-2 py-0.5 rounded font-bold">Lançar</span>
              </button>

              <button
                type="button"
                onClick={() => { setSelectedKgType('breakfast'); setIsKgModalOpen(true); }}
                className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl border border-amber-700/60 flex items-center justify-between group transition text-left"
              >
                <div className="flex items-center gap-2">
                  <Coffee className="w-4 h-4 text-amber-300 shrink-0" />
                  <div>
                    <p className="font-bold text-xs text-white group-hover:text-amber-200">Café por Quilo</p>
                    <p className="text-[10px] text-amber-300 font-mono">R$ {breakfastPrice.toFixed(2).replace('.', ',')}/kg</p>
                  </div>
                </div>
                <span className="text-[10px] bg-amber-800 px-2 py-0.5 rounded font-bold">Lançar</span>
              </button>
            </div>
          </div>

          {/* Search & Categories */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar produto pelo nome..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-xl pl-9 pr-3 py-2 text-xs focus:ring-2 focus:ring-amber-700"
              />
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                  selectedCategory === 'all' ? 'bg-amber-800 text-white' : 'bg-white border text-stone-700'
                }`}
              >
                Todos
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                    selectedCategory === c.id ? 'bg-amber-800 text-white' : 'bg-white border text-stone-700'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Fast Product Pick Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto">
            {products
              .filter((p) => (selectedCategory === 'all' || p.categoryId === selectedCategory) && p.name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    if (p.unit === 'KG' || p.name.toLowerCase().includes('por quilo') || p.id.includes('kg')) {
                      setSelectedKgType(p.name.toLowerCase().includes('café') ? 'breakfast' : 'lunch');
                      setIsKgModalOpen(true);
                      return;
                    }
                    setSelectedProduct(p);
                    setProductQty(1);
                    setSelectedAdditions([]);
                    setCustomNotes('');
                  }}
                  className="bg-white p-3 rounded-2xl border border-stone-200 hover:border-amber-700 cursor-pointer flex items-center justify-between gap-3 shadow-sm"
                >
                  <div>
                    <p className="font-bold text-xs text-stone-900">{p.name}</p>
                    <p className="text-[10px] text-stone-500 line-clamp-1">{p.description}</p>
                    <p className="text-xs font-bold text-amber-800 mt-1">R$ {p.price.toFixed(2)}</p>
                  </div>
                  <button className="bg-amber-800 text-white p-2 rounded-xl text-xs font-bold">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Product Options Modal before sending to kitchen */}
      {selectedProduct && currentActiveTable && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-stone-200">
            <div className="flex justify-between items-start border-b pb-2">
              <div>
                <h3 className="font-bold text-sm text-stone-900">{selectedProduct.name}</h3>
                <p className="text-xs text-stone-500">Mesa #{currentActiveTable.number}</p>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quantity */}
            <div className="flex items-center justify-between bg-stone-50 p-2.5 rounded-xl border">
              <span className="text-xs font-bold text-stone-700">Quantidade:</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setProductQty(Math.max(1, productQty - 1))}
                  className="w-8 h-8 rounded-lg bg-stone-200 font-bold text-stone-800 flex items-center justify-center"
                >
                  -
                </button>
                <span className="font-bold text-sm">{productQty}</span>
                <button
                  onClick={() => setProductQty(productQty + 1)}
                  className="w-8 h-8 rounded-lg bg-stone-200 font-bold text-stone-800 flex items-center justify-center"
                >
                  +
                </button>
              </div>
            </div>

            {/* Fast Preset Notes for Garçom */}
            <div className="space-y-1">
              <span className="text-xs font-semibold text-stone-700 block">Observações do Prato</span>
              <div className="flex flex-wrap gap-1.5 pb-2">
                {['Sem cebola', 'Carne bem passada', 'Pouco sal', 'Sem molho', 'Sem acompanhamento'].map((note) => (
                  <button
                    key={note}
                    onClick={() => setCustomNotes((prev) => (prev ? `${prev}, ${note}` : note))}
                    className="text-[10px] bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-700 px-2 py-1 rounded-lg"
                  >
                    + {note}
                  </button>
                ))}
              </div>
              <textarea
                placeholder="Ex: sem cebola, carne bem passada..."
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                className="w-full border rounded-xl p-2 text-xs focus:ring-2 focus:ring-amber-700"
                rows={2}
              />
            </div>

            <button
              onClick={handleSendItemToKitchen}
              className="w-full bg-amber-800 hover:bg-amber-900 text-white py-3 rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Enviar para Cozinha • R$ {(selectedProduct.price * productQty).toFixed(2)}</span>
            </button>
          </div>
        </div>
      )}

      {/* Active Comanda & Actions View */}
      {activeTab === 'comanda' && currentActiveTable && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-stone-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-stone-900 text-base">Comanda Mesa #{currentActiveTable.number}</h3>
              <p className="text-xs text-stone-500">
                Cliente: <strong className="text-stone-800">{currentActiveTable.clientName}</strong> ({currentActiveTable.guestCount} pessoas)
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('order')}
                className="bg-amber-800 text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Mais Itens</span>
              </button>
            </div>
          </div>

          {/* Comanda Items List */}
          <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
            <h4 className="font-bold text-xs uppercase text-stone-500 tracking-wider">Consumo da Mesa</h4>
            {currentActiveTable.items.length === 0 ? (
              <p className="text-xs text-stone-400 py-6 text-center">Nenhum item lançado ainda.</p>
            ) : (
              <div className="space-y-2">
                {currentActiveTable.items.map((item) => (
                  <div key={item.id} className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-stone-900">{item.quantity}x {item.productName}</p>
                      {item.notes && <p className="text-[10px] text-amber-800 italic">Obs: {item.notes}</p>}
                      <p className="text-[10px] text-stone-500">{item.createdAt} • por {item.waiterName || 'Garçom'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-amber-800 text-xs">R$ {(item.unitPrice * item.quantity).toFixed(2)}</span>
                      {item.status !== 'cancelado' && (
                        <button
                          onClick={() => cancelTableItem(currentActiveTable.id, item.id, 'Solicitado pelo cliente')}
                          className="text-rose-600 hover:text-rose-800 p-1"
                          title="Cancelar item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t pt-3 flex justify-between items-center text-sm">
              <span className="font-bold text-stone-700">Subtotal Parcial:</span>
              <span className="font-bold text-lg text-stone-900">R$ {currentActiveTable.subtotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Comanda Operational Actions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => setIsSplitModalOpen(true)}
              className="p-3 bg-white rounded-2xl border border-stone-200 font-semibold text-xs text-stone-800 hover:bg-stone-50 flex items-center justify-center gap-2"
            >
              <Users className="w-4 h-4 text-amber-700" />
              <span>Dividir Conta</span>
            </button>

            <button
              onClick={() => setIsTransferModalOpen(true)}
              className="p-3 bg-white rounded-2xl border border-stone-200 font-semibold text-xs text-stone-800 hover:bg-stone-50 flex items-center justify-center gap-2"
            >
              <ArrowRightLeft className="w-4 h-4 text-blue-700" />
              <span>Transferir Mesa</span>
            </button>

            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="p-3 bg-white rounded-2xl border border-stone-200 font-semibold text-xs text-stone-800 hover:bg-stone-50 flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4 text-emerald-700" />
              <span>Imprimir Pré-Conta</span>
            </button>

            <button
              onClick={() => {
                closeTableAndPay(currentActiveTable.id, 'pix', 0);
                setActiveTab('map');
              }}
              className="p-3 bg-emerald-700 text-white rounded-2xl font-bold text-xs shadow hover:bg-emerald-800 flex items-center justify-center gap-2"
            >
              <DollarSign className="w-4 h-4" />
              <span>Encerrar & Receber</span>
            </button>
          </div>
        </div>
      )}

      {/* Open Table Modal */}
      {isOpenModalOpen && tableToOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-stone-200">
            <h3 className="font-bold text-stone-900 text-base">Abrir Mesa #{tableToOpen.number}</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Quantidade de Pessoas</label>
                <input
                  type="number"
                  min="1"
                  value={guestCountInput}
                  onChange={(e) => setGuestCountInput(Number(e.target.value))}
                  className="w-full border rounded-xl p-2.5"
                />
              </div>
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Nome do Cliente (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Família Silva"
                  value={clientNameInput}
                  onChange={(e) => setClientNameInput(e.target.value)}
                  className="w-full border rounded-xl p-2.5"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsOpenModalOpen(false)}
                className="flex-1 py-2.5 bg-stone-200 text-stone-700 font-bold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={confirmOpenTable}
                className="flex-1 py-2.5 bg-amber-800 text-white font-bold rounded-xl text-xs shadow"
              >
                Confirmar Abertura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Split Bill Calculator Modal */}
      {isSplitModalOpen && currentActiveTable && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-stone-200">
            <h3 className="font-bold text-stone-900 text-base">Divisão da Conta • Mesa #{currentActiveTable.number}</h3>
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs space-y-1">
              <p className="font-semibold text-stone-700">Subtotal Total: R$ {currentActiveTable.subtotal.toFixed(2)}</p>
              <p className="text-amber-900 font-bold text-base">
                R$ {(currentActiveTable.subtotal / Math.max(1, splitPeopleCount)).toFixed(2)} / pessoa
              </p>
            </div>
            <div className="space-y-1 text-xs">
              <label className="font-semibold text-stone-700 block">Número de Pessoas</label>
              <input
                type="number"
                min="1"
                value={splitPeopleCount}
                onChange={(e) => setSplitPeopleCount(Number(e.target.value))}
                className="w-full border rounded-xl p-2.5"
              />
            </div>
            <button
              onClick={() => setIsSplitModalOpen(false)}
              className="w-full py-2.5 bg-stone-800 text-white font-bold rounded-xl text-xs"
            >
              Concluído
            </button>
          </div>
        </div>
      )}

      {/* Transfer Table Modal */}
      {isTransferModalOpen && currentActiveTable && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-stone-200">
            <h3 className="font-bold text-stone-900 text-base">Transferir Mesa #{currentActiveTable.number}</h3>
            <p className="text-xs text-stone-500">Selecione a mesa de destino:</p>
            <select
              value={transferTargetTableId}
              onChange={(e) => setTransferTargetTableId(e.target.value)}
              className="w-full border rounded-xl p-2.5 text-xs"
            >
              <option value="">Selecione uma mesa livre ou ocupada...</option>
              {tables
                .filter((t) => t.id !== currentActiveTable.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    Mesa #{t.number} ({t.sector}) - {t.status}
                  </option>
                ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="flex-1 py-2.5 bg-stone-200 text-stone-700 font-bold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (transferTargetTableId) {
                    transferTable(currentActiveTable.id, transferTargetTableId);
                    setIsTransferModalOpen(false);
                    setActiveTab('map');
                  }
                }}
                className="flex-1 py-2.5 bg-amber-800 text-white font-bold rounded-xl text-xs shadow"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-bill Thermal Ticket Modal */}
      {isPrintModalOpen && currentActiveTable && (
        <PrintReceiptModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          title="Impressão de Pré-Conta"
          receiptData={{
            tableNumber: currentActiveTable.number,
            customerName: currentActiveTable.clientName,
            waiterName: currentActiveTable.waiterName || currentUser.name,
            items: currentActiveTable.items.map((i) => ({ name: i.productName, quantity: i.quantity, price: i.unitPrice, notes: i.notes })),
            subtotal: currentActiveTable.subtotal,
            total: currentActiveTable.subtotal,
            type: 'pre_conta',
          }}
        />
      )}

      {/* Kg Weight Entry Modal */}
      <KgWeightEntryModal
        isOpen={isKgModalOpen}
        onClose={() => setIsKgModalOpen(false)}
        onConfirm={handleConfirmKgTableItem}
        initialType={selectedKgType}
      />
    </div>
  );
};
