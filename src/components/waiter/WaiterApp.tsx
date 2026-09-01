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
  Receipt,
  ArrowRightLeft,
  Send,
  ChevronLeft,
  Minus,
  Sparkles,
  Printer,
  Trash2,
  DollarSign,
  Scale,
  Coffee,
  UtensilsCrossed,
  RotateCcw
} from 'lucide-react';
import { DiningTable, Product, ProductAddition, TableStatus, PaymentMethod, Order } from '../../types';
import { PrintReceiptModal } from '../common/PrintReceiptModal';
import { KgWeightEntryModal } from '../common/KgWeightEntryModal';
import { PartialPaymentModal } from '../tables/PartialPaymentModal';
import { hasPermission } from '../../lib/permissions';
import { comandaServiceFee, comandaCouvert } from '../../lib/serviceFee';
import { MAXLEN, sanitizeText, toBoundedNumber } from '../../lib/validation';

export const WaiterApp: React.FC = () => {
  const {
    tables,
    tableSectors,
    products,
    categories,
    currentUser,
    companyProfile,
    createTable,
    openComandas,
    addComandaItem,
    cancelComandaItem,
    setComandaCharge,
    setComandaCouvertQty,
    transferComanda,
    closeComandaAndPay,
    addToast
  } = useApp();

  const can = (key: string) => hasPermission(currentUser, key);

  const [selectedTable, setSelectedTable] = useState<DiningTable | null>(null);
  const [selectedComandaId, setSelectedComandaId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'map' | 'order' | 'comanda'>('map');
  const [tableSearchQuery, setTableSearchQuery] = useState('');

  // KG Weight Modal State
  const [isKgModalOpen, setIsKgModalOpen] = useState(false);
  const [selectedKgType, setSelectedKgType] = useState<'lunch' | 'breakfast'>('lunch');

  const lunchPrice = companyProfile.buffetPrices?.lunchPricePerKg ?? 80.00;
  const breakfastPrice = companyProfile.buffetPrices?.breakfastPricePerKg ?? 54.99;

  // New table modal
  const [isNewTableModalOpen, setIsNewTableModalOpen] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState<number>(1);
  const [newTableSector, setNewTableSector] = useState<string>('');
  const [newTableCapacity, setNewTableCapacity] = useState<number>(2);

  // New comanda modal (opens a free table, or adds another person to one already occupied)
  const [isNewComandaModalOpen, setIsNewComandaModalOpen] = useState(false);
  const [tableForNewComanda, setTableForNewComanda] = useState<DiningTable | null>(null);
  const [comandaNamesInput, setComandaNamesInput] = useState<string[]>(['']);

  // Order Launch State
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productQty, setProductQty] = useState(1);
  const [selectedAdditions, setSelectedAdditions] = useState<ProductAddition[]>([]);
  const [customNotes, setCustomNotes] = useState('');

  // Partial payment modal
  const [isPartialModalOpen, setIsPartialModalOpen] = useState(false);

  // Transfer comanda modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferTargetTableId, setTransferTargetTableId] = useState('');

  // Pre-bill print modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Confirmação de remoção de taxa de serviço / couvert
  const [pendingCharge, setPendingCharge] = useState<null | 'serviceFee' | 'couvert'>(null);

  // Final payment (close comanda) modal
  const [isFinalPayModalOpen, setIsFinalPayModalOpen] = useState(false);
  const [finalPaymentMethod, setFinalPaymentMethod] = useState<PaymentMethod>('pix');
  const [isFinalSplitPayment, setIsFinalSplitPayment] = useState(false);
  const [finalSplitRows, setFinalSplitRows] = useState<{ method: PaymentMethod; amount: string }[]>([
    { method: 'pix', amount: '0' },
    { method: 'dinheiro', amount: '0' },
  ]);

  // Fiscal receipt printed right after a comanda is closed & paid
  const [isFinalReceiptModalOpen, setIsFinalReceiptModalOpen] = useState(false);
  const [lastFinalizedOrder, setLastFinalizedOrder] = useState<Order | null>(null);

  const currentActiveTable = selectedTable ? tables.find((t) => t.id === selectedTable.id) || null : null;
  const currentComanda = currentActiveTable?.comandas.find((c) => c.id === selectedComandaId) || null;

  const normalizedTableSearch = tableSearchQuery.trim().toLowerCase();
  const filteredTables = (normalizedTableSearch
    ? tables.filter((t) =>
        String(t.number).includes(normalizedTableSearch) ||
        t.sector.toLowerCase().includes(normalizedTableSearch) ||
        t.comandas.some((c) => c.personName.toLowerCase().includes(normalizedTableSearch))
      )
    : tables
  ).slice().sort((a, b) => a.number - b.number);

  const currentComandaAdvancesTotal = (currentComanda?.advancePayments || [])
    .filter((p) => p.status === 'ativo')
    .reduce((sum, p) => sum + p.amount, 0);
  const currentComandaServiceFee = currentComanda ? comandaServiceFee(currentComanda, companyProfile) : 0;
  const currentComandaCouvert = currentComanda ? comandaCouvert(currentComanda, companyProfile) : 0;
  const currentComandaSubtotalComTaxa = (currentComanda?.subtotal || 0) + currentComandaServiceFee + currentComandaCouvert;
  const currentComandaRemainingTotal = currentComanda
    ? Math.max(0, currentComandaSubtotalComTaxa - currentComandaAdvancesTotal)
    : 0;

  // Itens já quitados por "adiantamento por produto" saem da lista de consumo em
  // aberto e vão para um bloco "Já pagos"; também não entram na pré-conta.
  const currentComandaOpenItems = (currentComanda?.items || []).filter((i) => !i.isPaid);
  const currentComandaPaidItems = (currentComanda?.items || []).filter((i) => i.isPaid);
  const currentComandaOpenSubtotal = currentComandaOpenItems
    .filter((i) => i.status !== 'cancelado')
    .reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const currentComandaPaidItemsValue = currentComandaPaidItems
    .filter((i) => i.status !== 'cancelado')
    .reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  // Adiantamentos que ainda abatem do restante (os itens já pagos por produto já
  // saíram do subtotal, então não podem ser descontados de novo).
  const currentComandaAdvancesForRemaining = Math.max(0, currentComandaAdvancesTotal - currentComandaPaidItemsValue);
  const [showPaidItems, setShowPaidItems] = useState(false);

  const selectedProductCategoryName = selectedProduct
    ? categories.find((cat) => cat.id === selectedProduct.categoryId)?.name
    : undefined;
  const isPratoFeitoProduct = selectedProductCategoryName?.trim().toLowerCase() === 'prato feito';

  const handleConfirmKgTableItem = (kgData: {
    productId: string;
    productName: string;
    weightKg: number;
    pricePerKg: number;
    totalPrice: number;
    notes: string;
  }) => {
    if (!currentActiveTable || !selectedComandaId) return;
    addComandaItem(currentActiveTable.id, selectedComandaId, kgData.productId, 1, [], kgData.notes, kgData.totalPrice);
    addToast('success', 'Item por Quilo Adicionado', `${kgData.productName} (R$ ${kgData.totalPrice.toFixed(2).replace('.', ',')}) na Mesa #${currentActiveTable.number}`);
  };
  const getStatusBadge = (status: TableStatus) => {
    switch (status) {
      case 'ocupada': return { label: 'Ocupada', class: 'bg-amber-100 text-amber-800 border-amber-300' };
      default: return { label: 'Livre', class: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    }
  };

  const handleOpenTableClick = (tb: DiningTable) => {
    setSelectedTable(tb);
    if (tb.comandas.length === 0) {
      setTableForNewComanda(tb);
      setComandaNamesInput(['']);
      setIsNewComandaModalOpen(true);
    } else {
      setSelectedComandaId(tb.comandas[0].id);
      setActiveTab('comanda');
    }
  };

  const handleOpenNewComandaModal = (tb: DiningTable) => {
    setTableForNewComanda(tb);
    setComandaNamesInput(['']);
    setIsNewComandaModalOpen(true);
  };

  const confirmOpenComanda = async () => {
    if (!tableForNewComanda) return;
    const validNames = comandaNamesInput.map((n) => n.trim()).filter((n) => n.length > 0);
    if (validNames.length === 0) return;

    setIsNewComandaModalOpen(false);
    setSelectedTable(tableForNewComanda);

    const created = await openComandas(tableForNewComanda.id, validNames);

    if (created.length > 0) {
      setSelectedComandaId(created[0].id);
      setActiveTab('order');
    } else {
      setActiveTab('map');
    }
  };

  const handleSendItemToKitchen = () => {
    if (!currentActiveTable || !selectedComandaId || !selectedProduct) return;
    addComandaItem(currentActiveTable.id, selectedComandaId, selectedProduct.id, productQty, selectedAdditions, customNotes);

    setSelectedProduct(null);
    setProductQty(1);
    setSelectedAdditions([]);
    setCustomNotes('');
    addToast('success', 'Pedido enviado à Cozinha!', `Mesa #${currentActiveTable.number}`);
  };

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
          className={`px-4 py-2.5 rounded-xl text-sm font-bold transition border ${
            activeTab === 'map' ? 'bg-amber-800 text-white border-amber-700' : 'bg-stone-800 text-stone-300 border-stone-700 hover:text-white'
          }`}
        >
          Mapa Mesas
        </button>
      </div>

      {/* Main Table Map View */}
      {activeTab === 'map' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-2xl border border-stone-200 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-stone-900 text-xs uppercase tracking-wider">
                Mesas e Comandas do Salão
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                  {tables.filter((t) => t.status === 'livre').length} livres
                </span>
                {can('mesas.criar') && (
                <button
                  onClick={() => {
                    if (tableSectors.length === 0) {
                      addToast('error', 'Nenhuma área cadastrada', 'Peça para um gerente cadastrar uma área do restaurante em Grupos antes de criar mesas.');
                      return;
                    }
                    const nextNumber = tables.length > 0 ? Math.max(...tables.map((t) => t.number)) + 1 : 1;
                    setNewTableNumber(nextNumber);
                    setNewTableSector(tableSectors[0].name);
                    setNewTableCapacity(2);
                    setIsNewTableModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Mesa</span>
                </button>
                )}
              </div>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar mesa por número, setor ou nome do cliente..."
                maxLength={60}
                value={tableSearchQuery}
                onChange={(e) => setTableSearchQuery(e.target.value.slice(0, 60))}
                className="w-full bg-white border border-stone-300 rounded-xl pl-9 pr-3 py-2 text-xs focus:ring-2 focus:ring-amber-700"
              />
            </div>
          </div>

          {/* Tables Cards Grid */}
          {filteredTables.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-stone-200 text-center text-xs text-stone-400">
              Nenhuma mesa encontrada para "{tableSearchQuery}".
            </div>
          ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredTables.map((tb) => {
              const badge = getStatusBadge(tb.status);
              const tableSubtotal = tb.comandas.reduce((sum, c) => sum + c.subtotal, 0);
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

                  {tb.comandas.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-stone-800 truncate">
                        {tb.comandas.length} comanda{tb.comandas.length > 1 ? 's' : ''} aberta{tb.comandas.length > 1 ? 's' : ''}
                      </p>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-stone-500">{tb.comandas.map((c) => c.personName).join(', ')}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-amber-800">R$ {tableSubtotal.toFixed(2)}</span>
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
          )}
        </div>
      )}

      {/* Order Launch View for Selected Comanda */}
      {activeTab === 'order' && currentActiveTable && currentComanda && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-stone-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveTab('comanda')}
                className="bg-stone-800 text-white p-3 rounded-xl hover:bg-stone-700"
                title="Voltar"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h3 className="font-bold text-stone-900 text-sm">
                  Novo Pedido • Mesa #{currentActiveTable.number} ({currentComanda.personName})
                </h3>
                <p className="text-xs text-stone-500">Selecione os produtos para enviar à cozinha</p>
              </div>
            </div>
          </div>

          {/* Quick Quilo Launch for Waiter */}
          {can('mesas.lancar_item') && (
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
          )}

          {/* Search & Categories */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar produto pelo nome..."
                maxLength={60}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value.slice(0, 60))}
                className="w-full bg-white border border-stone-300 rounded-xl pl-9 pr-3 py-2 text-xs focus:ring-2 focus:ring-amber-700"
              />
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap ${
                  selectedCategory === 'all' ? 'bg-amber-800 text-white' : 'bg-white border text-stone-700'
                }`}
              >
                Todos
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  className={`px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap ${
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
                  <button className="bg-amber-800 text-white p-3 rounded-xl text-xs font-bold">
                    <Plus className="w-5 h-5" />
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
              <button onClick={() => setSelectedProduct(null)} className="p-2 text-stone-400">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Quantity */}
            <div className="flex items-center justify-between bg-stone-50 p-2.5 rounded-xl border">
              <span className="text-xs font-bold text-stone-700">Quantidade:</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setProductQty(Math.max(1, productQty - 1))}
                  className="w-11 h-11 rounded-lg bg-stone-200 font-bold text-stone-800 text-lg flex items-center justify-center"
                >
                  -
                </button>
                <span className="font-bold text-base">{productQty}</span>
                <button
                  onClick={() => setProductQty(productQty + 1)}
                  className="w-11 h-11 rounded-lg bg-stone-200 font-bold text-stone-800 text-lg flex items-center justify-center"
                >
                  +
                </button>
              </div>
            </div>

            {isPratoFeitoProduct && (
              <div className="space-y-1">
                <span className="text-xs font-semibold text-stone-700 block">Observação do Prato</span>
                <textarea
                  placeholder="Ex: sem cebola, carne bem passada..."
                  maxLength={MAXLEN.shortNote}
                  value={customNotes}
                  onChange={(e) => setCustomNotes(sanitizeText(e.target.value, MAXLEN.shortNote))}
                  className="w-full border rounded-xl p-2 text-xs focus:ring-2 focus:ring-amber-700"
                  rows={2}
                />
              </div>
            )}

            <button
              onClick={handleSendItemToKitchen}
              disabled={!can('mesas.lancar_item')}
              className="w-full bg-amber-800 hover:bg-amber-900 text-white py-4 rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
              <span>Enviar para Cozinha • R$ {(selectedProduct.price * productQty).toFixed(2)}</span>
            </button>
          </div>
        </div>
      )}

      {/* Active Comanda & Actions View */}
      {activeTab === 'comanda' && currentActiveTable && currentComanda && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-stone-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setActiveTab('map'); setSelectedTable(null); setSelectedComandaId(null); }}
                  className="bg-stone-800 text-white p-3 rounded-xl hover:bg-stone-700"
                  title="Voltar"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <h3 className="font-bold text-stone-900 text-base">Comanda Mesa #{currentActiveTable.number}</h3>
                  <p className="text-xs text-stone-500">
                    Cliente: <strong className="text-stone-800">{currentComanda.personName}</strong>{currentComanda.guestCount ? ` (${currentComanda.guestCount} pessoas)` : ''}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenNewComandaModal(currentActiveTable)}
                  className="bg-stone-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Comanda</span>
                </button>
                <button
                  onClick={() => setActiveTab('order')}
                  className="bg-amber-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Mais Itens</span>
                </button>
              </div>
            </div>

            {currentActiveTable.comandas.length > 1 && (
              <div>
                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-1">Selecionar Cliente</label>
                <select
                  value={currentComanda.id}
                  onChange={(e) => setSelectedComandaId(e.target.value)}
                  className="w-full border rounded-xl p-3 text-sm bg-white font-semibold"
                >
                  {currentActiveTable.comandas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.personName} • R$ {c.subtotal.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Comanda Items List */}
          <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
            <h4 className="font-bold text-xs uppercase text-stone-500 tracking-wider">Consumo da Comanda</h4>
            {currentComanda.items.length === 0 ? (
              <p className="text-xs text-stone-400 py-6 text-center">Nenhum item lançado ainda.</p>
            ) : (
              <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                {currentComandaOpenItems.length === 0 && (
                  <p className="text-xs text-stone-400 py-4 text-center">Todos os itens já foram pagos em adiantamento.</p>
                )}
                {currentComandaOpenItems.map((item) => (
                  <div key={item.id} className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-stone-900">{item.quantity}x {item.productName}</p>
                      {item.notes && <p className="text-[10px] text-amber-800 italic">Obs: {item.notes}</p>}
                      <p className="text-[10px] text-stone-500">{item.createdAt} • por {item.waiterName || 'Garçom'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-amber-800 text-xs">R$ {(item.unitPrice * item.quantity).toFixed(2)}</span>
                      {item.status !== 'cancelado' && can('mesas.cancelar_item') && (
                        <button
                          onClick={() => cancelComandaItem(currentActiveTable.id, currentComanda.id, item.id, 'Solicitado pelo cliente')}
                          className="text-rose-600 hover:text-rose-800 p-2"
                          title="Cancelar item"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {currentComandaPaidItems.length > 0 && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowPaidItems((v) => !v)}
                      className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold text-emerald-900"
                    >
                      <span>Já pagos em adiantamento ({currentComandaPaidItems.length})</span>
                      <span>{showPaidItems ? '−' : '+'}</span>
                    </button>
                    {showPaidItems && (
                      <div className="px-3 pb-2 space-y-1.5">
                        {currentComandaPaidItems.map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-[11px] text-emerald-900/80">
                            <span>{item.quantity}x {item.productName}</span>
                            <span className="font-semibold line-through">R$ {(item.unitPrice * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="border-t pt-3 space-y-1.5">
              <div className="flex justify-between items-center text-sm">
                <span className="font-semibold text-stone-600">Subtotal (itens):</span>
                <span className="font-bold text-stone-900">R$ {currentComanda.subtotal.toFixed(2)}</span>
              </div>
              {currentComandaServiceFee > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-stone-600">Taxa de serviço ({companyProfile.serviceFeePercent}%):</span>
                  <span className="font-bold text-stone-700">+ R$ {currentComandaServiceFee.toFixed(2)}</span>
                </div>
              )}
              {companyProfile.couvertEnabled && currentComanda.couvertApplied !== false && companyProfile.couvertValue > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-stone-600 flex items-center gap-2">
                    Couvert
                    {can('mesas.lancar_item') ? (
                      <span className="inline-flex items-center border border-stone-200 rounded-lg overflow-hidden">
                        <button
                          type="button"
                          disabled={(currentComanda.couvertQty ?? 1) <= 1}
                          onClick={() => setComandaCouvertQty(currentActiveTable.id, currentComanda.id, (currentComanda.couvertQty ?? 1) - 1)}
                          className="px-2 py-0.5 font-bold text-stone-600 hover:bg-stone-100 disabled:opacity-30"
                        >−</button>
                        <span className="px-2 font-bold text-stone-800 tabular-nums">{currentComanda.couvertQty ?? 1}×</span>
                        <button
                          type="button"
                          disabled={(currentComanda.couvertQty ?? 1) >= 50}
                          onClick={() => setComandaCouvertQty(currentActiveTable.id, currentComanda.id, (currentComanda.couvertQty ?? 1) + 1)}
                          className="px-2 py-0.5 font-bold text-stone-600 hover:bg-stone-100 disabled:opacity-30"
                        >+</button>
                      </span>
                    ) : (
                      <span className="font-bold text-stone-700">{currentComanda.couvertQty ?? 1}×</span>
                    )}
                  </span>
                  <span className="font-bold text-stone-700">+ R$ {currentComandaCouvert.toFixed(2)}</span>
                </div>
              )}
              {(companyProfile.serviceFeeEnabled || companyProfile.couvertEnabled) && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {companyProfile.serviceFeeEnabled && (
                    currentComanda.serviceFeeApplied === false ? (
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-stone-200 bg-stone-50 text-[11px]">
                        <span className="font-bold text-rose-600">Taxa removida</span>
                        {currentComanda.serviceFeeRemovedBy && <span className="text-stone-400">· {currentComanda.serviceFeeRemovedBy}</span>}
                        <button
                          onClick={() => setComandaCharge(currentActiveTable.id, currentComanda.id, 'serviceFee', true)}
                          className="inline-flex items-center gap-0.5 text-amber-800 font-bold hover:underline"
                        >
                          <RotateCcw className="w-3 h-3" /> Reativar
                        </button>
                      </div>
                    ) : can('mesas.remover_taxa_servico') ? (
                      <button
                        onClick={() => setPendingCharge('serviceFee')}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-[11px] font-bold hover:bg-rose-100 transition"
                      >
                        <X className="w-3 h-3" /> Remover taxa de serviço
                      </button>
                    ) : null
                  )}
                  {companyProfile.couvertEnabled && (
                    currentComanda.couvertApplied === false ? (
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-stone-200 bg-stone-50 text-[11px]">
                        <span className="font-bold text-rose-600">Couvert removido</span>
                        {currentComanda.couvertRemovedBy && <span className="text-stone-400">· {currentComanda.couvertRemovedBy}</span>}
                        <button
                          onClick={() => setComandaCharge(currentActiveTable.id, currentComanda.id, 'couvert', true)}
                          className="inline-flex items-center gap-0.5 text-amber-800 font-bold hover:underline"
                        >
                          <RotateCcw className="w-3 h-3" /> Reativar
                        </button>
                      </div>
                    ) : can('mesas.remover_taxa_servico') ? (
                      <button
                        onClick={() => setPendingCharge('couvert')}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-[11px] font-bold hover:bg-rose-100 transition"
                      >
                        <X className="w-3 h-3" /> Remover couvert
                      </button>
                    ) : null
                  )}
                </div>
              )}
              {currentComandaAdvancesTotal > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-emerald-700">Adiantamento:</span>
                  <span className="font-bold text-emerald-700">- R$ {currentComandaAdvancesTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center border-t pt-1.5">
                <span className="font-bold text-stone-700">Total:</span>
                <span className="font-bold text-lg text-stone-900">R$ {currentComandaRemainingTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Comanda Operational Actions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {can('mesas.pagamento_parcial') && (
            <button
              onClick={() => setIsPartialModalOpen(true)}
              className="p-4 bg-white rounded-2xl border border-stone-200 font-semibold text-sm text-stone-800 hover:bg-stone-50 flex items-center justify-center gap-2"
            >
              <Receipt className="w-5 h-5 text-amber-700" />
              <span>Pagamento Parcial</span>
            </button>
            )}

            {can('mesas.transferir') && (
            <button
              onClick={() => setIsTransferModalOpen(true)}
              className="p-4 bg-white rounded-2xl border border-stone-200 font-semibold text-sm text-stone-800 hover:bg-stone-50 flex items-center justify-center gap-2"
            >
              <ArrowRightLeft className="w-5 h-5 text-blue-700" />
              <span>Transferir Comanda</span>
            </button>
            )}

            {can('mesas.imprimir') && (
            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="p-4 bg-white rounded-2xl border border-stone-200 font-semibold text-sm text-stone-800 hover:bg-stone-50 flex items-center justify-center gap-2"
            >
              <Printer className="w-5 h-5 text-emerald-700" />
              <span>Imprimir Pré-Conta</span>
            </button>
            )}

            {can('mesas.fechar_comanda') && (
            <button
              onClick={() => {
                setFinalPaymentMethod('pix');
                setIsFinalSplitPayment(false);
                setFinalSplitRows([
                  { method: 'pix', amount: '0' },
                  { method: 'dinheiro', amount: '0' },
                ]);
                setIsFinalPayModalOpen(true);
              }}
              className="p-4 bg-emerald-700 text-white rounded-2xl font-bold text-sm shadow hover:bg-emerald-800 flex items-center justify-center gap-2"
            >
              <DollarSign className="w-5 h-5" />
              <span>Encerrar & Receber</span>
            </button>
            )}
          </div>
        </div>
      )}

      {/* New Table Modal */}
      {isNewTableModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-stone-200">
            <h3 className="font-bold text-stone-900 text-base">Nova Mesa</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Número da Mesa</label>
                <input
                  type="number"
                  min="1"
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(toBoundedNumber(e.target.value, 1, 9999, 1))}
                  className="w-full border rounded-xl p-3 text-sm"
                />
              </div>
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Setor</label>
                <select
                  value={newTableSector}
                  onChange={(e) => setNewTableSector(e.target.value)}
                  className="w-full border rounded-xl p-3 text-sm bg-white font-semibold"
                >
                  {tableSectors.map((sec) => (
                    <option key={sec.id} value={sec.name}>{sec.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Capacidade (lugares)</label>
                <input
                  type="number"
                  min="1"
                  value={newTableCapacity}
                  onChange={(e) => setNewTableCapacity(toBoundedNumber(e.target.value, 1, 100, 1))}
                  className="w-full border rounded-xl p-3 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsNewTableModalOpen(false)}
                className="flex-1 py-3.5 bg-stone-200 text-stone-700 font-bold rounded-xl text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (tables.some((t) => t.number === newTableNumber)) {
                    addToast('error', 'Número já existe', `Já existe uma mesa com o número ${newTableNumber}.`);
                    return;
                  }
                  createTable(newTableNumber, newTableSector, newTableCapacity);
                  setIsNewTableModalOpen(false);
                }}
                className="flex-1 py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-sm shadow"
              >
                Criar Mesa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Comanda Modal */}
      {isNewComandaModalOpen && tableForNewComanda && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-stone-200">
            <h3 className="font-bold text-stone-900 text-base">Nova Comanda • Mesa #{tableForNewComanda.number}</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Pessoas / Comandas</label>
                <div className="space-y-2">
                  {comandaNamesInput.map((name, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={MAXLEN.personName}
                        placeholder={`Nome da pessoa ${idx + 1}`}
                        value={name}
                        onChange={(e) => {
                          const updated = [...comandaNamesInput];
                          updated[idx] = sanitizeText(e.target.value, MAXLEN.personName);
                          setComandaNamesInput(updated);
                        }}
                        className="flex-1 border rounded-xl p-3 text-sm"
                      />
                      {comandaNamesInput.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setComandaNamesInput(comandaNamesInput.filter((_, i) => i !== idx))}
                          className="p-2.5 text-rose-600 hover:text-rose-800"
                          title="Remover"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setComandaNamesInput([...comandaNamesInput, ''])}
                  className="mt-2 flex items-center gap-1.5 text-amber-800 font-bold text-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar Pessoa</span>
                </button>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsNewComandaModalOpen(false)}
                className="flex-1 py-3.5 bg-stone-200 text-stone-700 font-bold rounded-xl text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={confirmOpenComanda}
                disabled={!can('mesas.abrir_comanda') || !comandaNamesInput.some((n) => n.trim().length > 0)}
                className="flex-1 py-3.5 bg-amber-800 text-white font-bold rounded-xl text-sm shadow disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Abrir Comanda{comandaNamesInput.filter((n) => n.trim().length > 0).length > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partial Payment Modal */}
      {isPartialModalOpen && currentActiveTable && currentComanda && (
        <PartialPaymentModal
          isOpen={isPartialModalOpen}
          onClose={() => setIsPartialModalOpen(false)}
          table={currentActiveTable}
          comandaId={currentComanda.id}
        />
      )}

      {/* Final Payment Modal (Encerrar & Receber) */}
      {isFinalPayModalOpen && currentActiveTable && currentComanda && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-stone-200">
            <h3 className="font-bold text-stone-900 text-base">
              Fechar e Receber • {currentComanda.personName} (Mesa #{currentActiveTable.number})
            </h3>

            <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-1.5 text-xs">
              <div className="flex justify-between text-stone-600">
                <span>Subtotal (itens):</span>
                <strong className="text-stone-900">R$ {currentComanda.subtotal.toFixed(2)}</strong>
              </div>
              {currentComandaServiceFee > 0 && (
                <div className="flex justify-between text-stone-600">
                  <span>Taxa de serviço ({companyProfile.serviceFeePercent}%):</span>
                  <span>+ R$ {currentComandaServiceFee.toFixed(2)}</span>
                </div>
              )}
              {currentComandaCouvert > 0 && (
                <div className="flex justify-between text-stone-600">
                  <span>Couvert:</span>
                  <span>+ R$ {currentComandaCouvert.toFixed(2)}</span>
                </div>
              )}
              {currentComandaAdvancesTotal > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Adiantamento:</span>
                  <span>- R$ {currentComandaAdvancesTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-emerald-950 font-bold text-sm border-t pt-1.5">
                <span>Total a Cobrar Agora:</span>
                <strong className="text-base text-emerald-800">R$ {currentComandaRemainingTotal.toFixed(2)}</strong>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-stone-700 block text-xs">Forma de Pagamento</label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-amber-900">
                  <input
                    type="checkbox"
                    checked={isFinalSplitPayment}
                    onChange={(e) => setIsFinalSplitPayment(e.target.checked)}
                    className="w-4 h-4 accent-amber-800 rounded cursor-pointer"
                  />
                  <span>Múltiplas Formas / Pagamento Misto</span>
                </label>
              </div>

              {!isFinalSplitPayment ? (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[
                    { id: 'pix', label: 'PIX', icon: '⚡' },
                    { id: 'cartao_credito', label: 'Crédito', icon: '💳' },
                    { id: 'cartao_debito', label: 'Débito', icon: '💳' },
                    { id: 'dinheiro', label: 'Dinheiro', icon: '💵' },
                    { id: 'vale_refeicao', label: 'Vale-refeição', icon: '🎫' },
                    { id: 'boleto', label: 'Boleto', icon: '🧾' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setFinalPaymentMethod(m.id as PaymentMethod)}
                      className={`p-2.5 rounded-xl border font-bold transition flex flex-col items-center justify-center gap-1 ${
                        finalPaymentMethod === m.id
                          ? 'bg-amber-800 text-white border-amber-800'
                          : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      <span className="text-base">{m.icon}</span>
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-2 bg-stone-50 p-3 rounded-xl border border-stone-200 text-xs">
                  <p className="text-[11px] text-stone-500 font-semibold">
                    Divida o valor de R$ {currentComandaRemainingTotal.toFixed(2)} entre mais de uma forma:
                  </p>
                  {finalSplitRows.map((row, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={row.method}
                        onChange={(e) => {
                          const val = e.target.value as PaymentMethod;
                          setFinalSplitRows((prev) => prev.map((r, i) => (i === idx ? { ...r, method: val } : r)));
                        }}
                        className="border rounded-xl p-2 bg-white font-semibold text-xs"
                      >
                        <option value="pix">PIX</option>
                        <option value="cartao_credito">Cartão de Crédito</option>
                        <option value="cartao_debito">Cartão de Débito</option>
                        <option value="dinheiro">Dinheiro</option>
                        <option value="vale_refeicao">Vale-refeição</option>
                        <option value="boleto">Boleto</option>
                      </select>
                      <div className="relative flex-1">
                        <span className="absolute left-2.5 top-2 text-stone-400 font-bold">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.amount}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : String(Math.max(0, Number(e.target.value) || 0));
                            setFinalSplitRows((prev) => prev.map((r, i) => (i === idx ? { ...r, amount: val } : r)));
                          }}
                          className="w-full border rounded-xl pl-8 pr-2 py-2 font-bold bg-white text-xs"
                        />
                      </div>
                      {finalSplitRows.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setFinalSplitRows((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-rose-600 p-1 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFinalSplitRows((prev) => [...prev, { method: 'dinheiro', amount: '0' }])}
                    className="text-amber-800 hover:underline font-bold text-xs flex items-center gap-1 mt-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar outra forma</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsFinalPayModalOpen(false)}
                className="flex-1 py-3.5 bg-stone-200 text-stone-700 font-bold rounded-xl text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  let splitPayments: { method: PaymentMethod; amount: number }[] | undefined = undefined;

                  if (isFinalSplitPayment) {
                    const parsedSplits = finalSplitRows
                      .map((r) => ({ method: r.method, amount: parseFloat(r.amount) || 0 }))
                      .filter((r) => r.amount > 0);
                    const splitSum = parsedSplits.reduce((acc, r) => acc + r.amount, 0);
                    if (Math.abs(splitSum - currentComandaRemainingTotal) > 0.05) {
                      addToast('error', 'Soma das formas de pagamento incorreta', `A soma (R$ ${splitSum.toFixed(2)}) deve ser igual ao total a cobrar (R$ ${currentComandaRemainingTotal.toFixed(2)}).`);
                      return;
                    }
                    splitPayments = parsedSplits;
                  }

                  const finishedOrder = await closeComandaAndPay(
                    currentActiveTable.id,
                    currentComanda.id,
                    isFinalSplitPayment ? 'multiplo' : finalPaymentMethod,
                    0,
                    splitPayments
                  );
                  setIsFinalPayModalOpen(false);
                  setSelectedComandaId(null);
                  setActiveTab('map');
                  if (finishedOrder) {
                    setLastFinalizedOrder(finishedOrder);
                    setIsFinalReceiptModalOpen(true);
                  }
                }}
                className="flex-1 py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-sm shadow"
              >
                Confirmar e Finalizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Comanda Modal */}
      {isTransferModalOpen && currentActiveTable && currentComanda && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-stone-200">
            <h3 className="font-bold text-stone-900 text-base">Transferir Comanda de {currentComanda.personName}</h3>
            <p className="text-xs text-stone-500">Selecione a mesa de destino:</p>
            <select
              value={transferTargetTableId}
              onChange={(e) => setTransferTargetTableId(e.target.value)}
              className="w-full border rounded-xl p-3 text-sm"
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
                className="flex-1 py-3.5 bg-stone-200 text-stone-700 font-bold rounded-xl text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (transferTargetTableId) {
                    transferComanda(currentActiveTable.id, currentComanda.id, transferTargetTableId);
                    setIsTransferModalOpen(false);
                    setSelectedComandaId(null);
                    setActiveTab('map');
                  }
                }}
                className="flex-1 py-3.5 bg-amber-800 text-white font-bold rounded-xl text-sm shadow"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-bill Thermal Ticket Modal */}
      {isPrintModalOpen && currentActiveTable && currentComanda && (
        <PrintReceiptModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          title="Impressão de Pré-Conta"
          receiptData={{
            tableNumber: currentActiveTable.number,
            customerName: currentComanda.personName,
            waiterName: currentComanda.waiterName || currentUser.name,
            items: currentComandaOpenItems.map((i) => ({ name: i.productName, quantity: i.quantity, price: i.unitPrice, notes: i.notes })),
            subtotal: currentComandaOpenSubtotal,
            serviceFee: currentComandaServiceFee || undefined,
            servicePct: companyProfile.serviceFeePercent,
            couvert: currentComandaCouvert || undefined,
            advancePaid: currentComandaAdvancesForRemaining || undefined,
            total: Math.max(0, currentComandaOpenSubtotal + currentComandaServiceFee + currentComandaCouvert - currentComandaAdvancesForRemaining),
            type: 'pre_conta',
          }}
        />
      )}

      {/* Fiscal Receipt Modal (printed right after closing & paying a comanda) */}
      {isFinalReceiptModalOpen && lastFinalizedOrder && (
        <PrintReceiptModal
          isOpen={isFinalReceiptModalOpen}
          onClose={() => setIsFinalReceiptModalOpen(false)}
          title="Cupom Fiscal"
          receiptData={{
            orderNumber: lastFinalizedOrder.orderNumber,
            tableNumber: lastFinalizedOrder.tableNumber,
            customerName: lastFinalizedOrder.customer.name,
            waiterName: lastFinalizedOrder.waiterName,
            items: lastFinalizedOrder.items.map((i) => ({ name: i.productName, quantity: i.quantity, price: i.unitPrice, notes: i.notes })),
            subtotal: lastFinalizedOrder.subtotal,
            serviceFee: lastFinalizedOrder.serviceFee || undefined,
            servicePct: lastFinalizedOrder.serviceFee ? companyProfile.serviceFeePercent : undefined,
            couvert: lastFinalizedOrder.couvert || undefined,
            discount: lastFinalizedOrder.discount,
            advancePaid: lastFinalizedOrder.advancePaid,
            total: lastFinalizedOrder.total,
            paymentMethod: lastFinalizedOrder.paymentMethod,
            splitPayments: lastFinalizedOrder.splitPayments,
            nfceKey: lastFinalizedOrder.nfceKey,
            type: 'caixa',
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

      {/* Confirmar remoção de taxa de serviço / couvert */}
      {pendingCharge && currentActiveTable && currentComanda && (
        <div className="fixed inset-0 z-[60] bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xs w-full p-5 space-y-4 shadow-2xl border border-stone-200">
            <h3 className="font-bold text-stone-900 text-sm">
              Remover {pendingCharge === 'serviceFee' ? 'a taxa de serviço' : 'o couvert'}?
            </h3>
            <p className="text-xs text-stone-500">
              {pendingCharge === 'serviceFee' ? 'A taxa de serviço' : 'O couvert'} não será cobrado no fechamento da comanda de <strong>{currentComanda.personName}</strong> (Mesa #{currentActiveTable.number}).
            </p>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setPendingCharge(null)} className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl text-xs transition">Cancelar</button>
              <button
                onClick={() => {
                  setComandaCharge(currentActiveTable.id, currentComanda.id, pendingCharge, false);
                  setPendingCharge(null);
                }}
                className="flex-1 py-2.5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl text-xs shadow flex items-center justify-center gap-1.5 transition"
              >
                <X className="w-4 h-4" /> Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
