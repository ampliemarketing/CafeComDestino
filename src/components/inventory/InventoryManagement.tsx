import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Boxes, 
  Plus, 
  Search, 
  AlertTriangle, 
  TrendingDown, 
  FileText, 
  X, 
  CheckCircle2, 
  Trash2,
  DollarSign,
  Gift,
  ShieldAlert,
  UserCheck,
  Calendar,
  Filter,
  PackageCheck,
  Tag
} from 'lucide-react';
import { Ingredient, Product, LossReason, CourtesyReason } from '../../types';

export const InventoryManagement: React.FC = () => {
  const { 
    ingredients, 
    products, 
    lossRecords, 
    courtesyRecords, 
    recordStockEntry, 
    recordLoss, 
    recordCourtesy, 
    currentUser,
    users 
  } = useApp();

  const [activeTab, setActiveTab] = useState<'stock' | 'losses' | 'courtesies'>('stock');
  const [searchQuery, setSearchQuery] = useState('');

  // Entry Modal
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [entryQty, setEntryQty] = useState<number>(10);
  const [unitCostInput, setUnitCostInput] = useState<number>(5.00);

  // New Comprehensive Loss Modal
  const [isLossModalOpen, setIsLossModalOpen] = useState(false);
  const [lossItemType, setLossItemType] = useState<'ingredient' | 'product'>('ingredient');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [lossQty, setLossQty] = useState<number>(1);
  const [lossReason, setLossReason] = useState<LossReason>('vencido');
  const [employeeName, setEmployeeName] = useState<string>('');
  const [sectorName, setSectorName] = useState<string>('Cozinha');
  const [lossNotes, setLossNotes] = useState<string>('');

  // Courtesy Modal from Inventory
  const [isCourtesyModalOpen, setIsCourtesyModalOpen] = useState(false);
  const [courtesyProductId, setCourtesyProductId] = useState<string>('');
  const [courtesyQty, setCourtesyQty] = useState<number>(1);
  const [courtesyReason, setCourtesyReason] = useState<CourtesyReason>('promocional');
  const [courtesyCustomer, setCourtesyCustomer] = useState<string>('');
  const [courtesyAuthorizer, setCourtesyAuthorizer] = useState<string>(currentUser.name);
  const [courtesyNotes, setCourtesyNotes] = useState<string>('');

  // Filtered ingredients
  const filteredIngredients = ingredients.filter((ing) =>
    ing.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Financial KPIs
  const totalIngredientValue = ingredients.reduce((acc, ing) => acc + ing.stockQuantity * ing.avgCostUnit, 0);
  const totalProductStockValue = products
    .filter((p) => p.trackStock)
    .reduce((acc, p) => acc + p.stockQuantity * p.costPrice, 0);

  const lowStockIngredientsCount = ingredients.filter((ing) => ing.stockQuantity <= ing.minStock).length;
  const lowStockProductsCount = products.filter((p) => p.trackStock && p.stockQuantity <= (p.minStock || 5)).length;

  // Total Losses KPI
  const totalLossesValue = lossRecords.reduce((acc, l) => acc + l.costValue, 0);
  const totalLossesCount = lossRecords.reduce((acc, l) => acc + l.quantity, 0);

  // Total Courtesies KPI
  const totalCourtesyRetailValue = courtesyRecords.reduce((acc, c) => acc + c.totalRetailValue, 0);
  const totalCourtesyCostValue = courtesyRecords.reduce((acc, c) => acc + c.totalCostValue, 0);
  const totalCourtesyCount = courtesyRecords.reduce((acc, c) => acc + c.quantity, 0);

  const handleOpenLossModal = (itemType: 'ingredient' | 'product', id?: string) => {
    setLossItemType(itemType);
    if (itemType === 'ingredient') {
      const ing = id ? ingredients.find((i) => i.id === id) : ingredients[0];
      if (ing) {
        setSelectedItemId(ing.id);
      }
    } else {
      const prod = id ? products.find((p) => p.id === id) : products[0];
      if (prod) {
        setSelectedItemId(prod.id);
      }
    }
    setLossQty(1);
    setLossReason('vencido');
    setEmployeeName(currentUser.name);
    setIsLossModalOpen(true);
  };

  const handleConfirmLoss = () => {
    if (lossItemType === 'ingredient') {
      const ing = ingredients.find((i) => i.id === selectedItemId);
      if (!ing) return;
      const computedCost = ing.avgCostUnit * lossQty;
      recordLoss({
        itemType: 'ingredient',
        itemId: ing.id,
        itemName: ing.name,
        quantity: lossQty,
        unit: ing.unit,
        costValue: computedCost,
        reason: lossReason,
        notes: lossNotes,
        employeeName: employeeName || currentUser.name,
        sector: sectorName,
      });
    } else {
      const prod = products.find((p) => p.id === selectedItemId);
      if (!prod) return;
      const computedCost = prod.costPrice * lossQty;
      recordLoss({
        itemType: 'product',
        itemId: prod.id,
        itemName: prod.name,
        quantity: lossQty,
        unit: 'unid',
        costValue: computedCost,
        reason: lossReason,
        notes: lossNotes,
        employeeName: employeeName || currentUser.name,
        sector: sectorName,
      });
    }
    setIsLossModalOpen(false);
  };

  const handleConfirmCourtesyFromInventory = () => {
    const prod = products.find((p) => p.id === courtesyProductId);
    if (!prod) return;

    recordCourtesy({
      productId: prod.id,
      quantity: courtesyQty,
      reason: courtesyReason,
      source: 'caixa_pdv',
      targetReference: 'Atendimento / Geral',
      customerName: courtesyCustomer || undefined,
      authorizedBy: courtesyAuthorizer || currentUser.name,
      notes: courtesyNotes || undefined,
    });

    setIsCourtesyModalOpen(false);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-stone-900 text-stone-100 p-5 rounded-2xl border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-800 text-white font-bold flex items-center justify-center shadow">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Estoque, Perdas & Cortesias</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Controle completo de insumos, baixas por perdas de estoque e registro de cortesias aos clientes.
            </p>
          </div>
        </div>

        {/* Top KPI Badge */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-stone-800 px-3 py-1.5 rounded-xl border border-stone-700 text-xs">
            <span className="text-stone-400">Total em Insumos: </span>
            <strong className="text-amber-300 font-bold">R$ {totalIngredientValue.toFixed(2)}</strong>
          </div>
          <div className="bg-stone-800 px-3 py-1.5 rounded-xl border border-stone-700 text-xs">
            <span className="text-stone-400">Total em Produtos: </span>
            <strong className="text-emerald-300 font-bold">R$ {totalProductStockValue.toFixed(2)}</strong>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex gap-2 bg-stone-100 p-1.5 rounded-2xl border border-stone-200 text-xs font-bold">
        <button
          onClick={() => setActiveTab('stock')}
          className={`flex-1 py-3 rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'stock' ? 'bg-amber-800 text-white shadow' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Insumos & Estoque Atual</span>
        </button>

        <button
          onClick={() => setActiveTab('losses')}
          className={`flex-1 py-3 rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'losses' ? 'bg-amber-800 text-white shadow' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          <span>Registro & Relatório de Perdas ({lossRecords.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('courtesies')}
          className={`flex-1 py-3 rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'courtesies' ? 'bg-amber-800 text-white shadow' : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Gift className="w-4 h-4" />
          <span>Registro & Relatório de Cortesias ({courtesyRecords.length})</span>
        </button>
      </div>

      {/* TAB 1: STOCK MANAGEMENT */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          {/* Low Stock Alert */}
          {(lowStockIngredientsCount > 0 || lowStockProductsCount > 0) && (
            <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl flex items-center justify-between text-amber-950 shadow-sm">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
                <div className="text-xs">
                  <p className="font-bold">Atenção ao Estoque Mínimo de Segurança!</p>
                  <p className="text-amber-900">
                    {lowStockIngredientsCount} insumo(s) e {lowStockProductsCount} produto(s) estão abaixo do limite mínimo.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Buscar insumo por nome ou código..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border rounded-xl pl-10 pr-4 py-2 text-xs focus:ring-2 focus:ring-amber-700"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => handleOpenLossModal('ingredient')}
                className="flex-1 sm:flex-none px-3.5 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl text-xs shadow transition flex items-center justify-center gap-1.5"
              >
                <TrendingDown className="w-4 h-4" />
                <span>Registrar Perda</span>
              </button>

              <button
                onClick={() => {
                  setCourtesyProductId(products[0]?.id || '');
                  setIsCourtesyModalOpen(true);
                }}
                className="flex-1 sm:flex-none px-3.5 py-2 bg-amber-800 hover:bg-amber-900 text-white font-bold rounded-xl text-xs shadow transition flex items-center justify-center gap-1.5"
              >
                <Gift className="w-4 h-4" />
                <span>Registrar Cortesia</span>
              </button>
            </div>
          </div>

          {/* Ingredients Table */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-stone-100 text-stone-600 uppercase font-bold border-b">
                  <tr>
                    <th className="p-3.5">Cód Insumo</th>
                    <th className="p-3.5">Nome do Insumo</th>
                    <th className="p-3.5">Estoque Atual</th>
                    <th className="p-3.5">Estoque Mínimo</th>
                    <th className="p-3.5">Custo Médio (R$)</th>
                    <th className="p-3.5">Valorização Total</th>
                    <th className="p-3.5 text-center">Ações Rápidas</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredIngredients.map((ing) => {
                    const isLow = ing.stockQuantity <= ing.minStock;

                    return (
                      <tr key={ing.id} className="hover:bg-stone-50 transition">
                        <td className="p-3.5 font-bold font-mono text-stone-700">{ing.id}</td>
                        <td className="p-3.5 font-bold text-stone-900">{ing.name}</td>
                        <td className="p-3.5">
                          <span className={`px-2.5 py-1 rounded font-bold text-xs inline-block ${
                            isLow ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {ing.stockQuantity} {ing.unit}
                          </span>
                        </td>
                        <td className="p-3.5 text-stone-600 font-semibold">{ing.minStock} {ing.unit}</td>
                        <td className="p-3.5 font-semibold text-stone-800">R$ {ing.avgCostUnit.toFixed(2)} / {ing.unit}</td>
                        <td className="p-3.5 font-bold text-amber-900">R$ {(ing.stockQuantity * ing.avgCostUnit).toFixed(2)}</td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedIngredient(ing);
                                setUnitCostInput(ing.avgCostUnit);
                                setIsEntryModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-emerald-700 text-white font-bold rounded-lg text-[10px] shadow hover:bg-emerald-800"
                            >
                              + Entrada
                            </button>
                            <button
                              onClick={() => handleOpenLossModal('ingredient', ing.id)}
                              className="px-2.5 py-1 bg-rose-700 text-white font-bold rounded-lg text-[10px] shadow hover:bg-rose-800"
                            >
                              - Registrar Perda
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LOSS REPORT & REGISTRATION */}
      {activeTab === 'losses' && (
        <div className="space-y-5">
          {/* Loss KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-stone-500 text-xs font-semibold block">Custo Total de Perdas</span>
                <strong className="text-rose-700 font-bold text-2xl">R$ {totalLossesValue.toFixed(2)}</strong>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                <TrendingDown className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-stone-500 text-xs font-semibold block">Ocorrências Registradas</span>
                <strong className="text-stone-900 font-bold text-2xl">{lossRecords.length} registros</strong>
              </div>
              <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center font-bold">
                <FileText className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-stone-500 text-xs font-semibold block">Ação Recomendada</span>
                <span className="text-xs text-amber-900 font-bold block mt-1">Conferência semanal de validade</span>
              </div>
              <button
                onClick={() => handleOpenLossModal('ingredient')}
                className="bg-rose-700 hover:bg-rose-800 text-white font-bold px-3 py-2 rounded-xl text-xs shadow"
              >
                + Nova Perda
              </button>
            </div>
          </div>

          {/* Loss Records History Table */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-stone-50 flex items-center justify-between">
              <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-rose-700" />
                <span>Histórico Detalhado de Perdas de Estoque</span>
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-stone-100 text-stone-600 uppercase font-bold border-b">
                  <tr>
                    <th className="p-3.5">Data/Hora</th>
                    <th className="p-3.5">Tipo</th>
                    <th className="p-3.5">Item / Insumo</th>
                    <th className="p-3.5">Qtd Perdida</th>
                    <th className="p-3.5">Custo Estimado (R$)</th>
                    <th className="p-3.5">Motivo Especificado</th>
                    <th className="p-3.5">Setor / Operador</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lossRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-stone-400 italic">
                        Nenhum registro de perda cadastrado até o momento.
                      </td>
                    </tr>
                  ) : (
                    lossRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-stone-50 transition">
                        <td className="p-3.5 font-mono text-stone-600">{rec.registeredAt}</td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            rec.itemType === 'product' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {rec.itemType === 'product' ? 'PRODUTO' : 'INSUMO'}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold text-stone-900">{rec.ingredientName}</td>
                        <td className="p-3.5 font-bold text-rose-700">
                          {rec.quantity} {rec.unit}
                        </td>
                        <td className="p-3.5 font-bold text-stone-900">R$ {rec.costValue.toFixed(2)}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-1 rounded bg-stone-100 border border-stone-200 text-stone-800 font-semibold">
                            {rec.reason.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="p-3.5 text-stone-600 font-semibold">
                          {rec.employeeName || rec.registeredBy} ({rec.sector || 'Geral'})
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: COURTESY REPORT & REGISTRATION */}
      {activeTab === 'courtesies' && (
        <div className="space-y-5">
          {/* Courtesy KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-stone-500 text-xs font-semibold block">Valor de Venda Concedido</span>
                <strong className="text-amber-900 font-bold text-2xl">R$ {totalCourtesyRetailValue.toFixed(2)}</strong>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                <Gift className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-stone-500 text-xs font-semibold block">Custo Real das Cortesias</span>
                <strong className="text-stone-800 font-bold text-2xl">R$ {totalCourtesyCostValue.toFixed(2)}</strong>
              </div>
              <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center font-bold">
                <Tag className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-stone-500 text-xs font-semibold block">Itens Cortesia Entregues</span>
                <strong className="text-stone-900 font-bold text-2xl">{totalCourtesyCount} unidades</strong>
              </div>
              <button
                onClick={() => {
                  setCourtesyProductId(products[0]?.id || '');
                  setIsCourtesyModalOpen(true);
                }}
                className="bg-amber-800 hover:bg-amber-900 text-white font-bold px-3 py-2 rounded-xl text-xs shadow"
              >
                + Nova Cortesia
              </button>
            </div>
          </div>

          {/* Courtesy Records History Table */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-stone-50 flex items-center justify-between">
              <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                <Gift className="w-4 h-4 text-amber-800" />
                <span>Histórico Detalhado de Cortesias Concedidas</span>
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-stone-100 text-stone-600 uppercase font-bold border-b">
                  <tr>
                    <th className="p-3.5">Data/Hora</th>
                    <th className="p-3.5">Produto Concedido</th>
                    <th className="p-3.5">Qtd</th>
                    <th className="p-3.5">Valor Venda (R$)</th>
                    <th className="p-3.5">Custo Real (R$)</th>
                    <th className="p-3.5">Motivo</th>
                    <th className="p-3.5">Cliente / Ref</th>
                    <th className="p-3.5">Autorizado Por</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {courtesyRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-stone-400 italic">
                        Nenhuma cortesia registrada até o momento.
                      </td>
                    </tr>
                  ) : (
                    courtesyRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-stone-50 transition">
                        <td className="p-3.5 font-mono text-stone-600">{rec.registeredAt}</td>
                        <td className="p-3.5 font-bold text-stone-900">{rec.productName}</td>
                        <td className="p-3.5 font-bold text-amber-900">{rec.quantity}x</td>
                        <td className="p-3.5 font-bold text-stone-900">R$ {rec.totalRetailValue.toFixed(2)}</td>
                        <td className="p-3.5 font-semibold text-stone-600">R$ {rec.totalCostValue.toFixed(2)}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                            {rec.reason.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="p-3.5 text-stone-700 font-semibold">
                          {rec.customerName || rec.targetReference || 'Atendimento'}
                        </td>
                        <td className="p-3.5 text-stone-800 font-bold flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                          <span>{rec.authorizedBy}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Stock Entry */}
      {isEntryModalOpen && selectedIngredient && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-stone-200 text-xs">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-stone-900 text-base">Entrada de Estoque • {selectedIngredient.name}</h3>
              <button onClick={() => setIsEntryModalOpen(false)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">
                  Quantidade Adicionada ({selectedIngredient.unit})
                </label>
                <input
                  type="number"
                  value={entryQty}
                  onChange={(e) => setEntryQty(Number(e.target.value))}
                  className="w-full border rounded-xl p-2.5 font-bold text-sm"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Custo Unitário da Nota (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={unitCostInput}
                  onChange={(e) => setUnitCostInput(Number(e.target.value))}
                  className="w-full border rounded-xl p-2.5 font-semibold text-xs"
                />
              </div>
            </div>

            <button
              onClick={() => {
                recordStockEntry(selectedIngredient.id, entryQty, unitCostInput);
                setIsEntryModalOpen(false);
              }}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 rounded-xl font-bold text-xs shadow"
            >
              Confirmar Entrada de Estoque
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Comprehensive Loss Registration */}
      {isLossModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-stone-200 text-xs">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-stone-900 text-base flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-rose-700" />
                <span>Registrar Perda / Descarte de Estoque</span>
              </h3>
              <button onClick={() => setIsLossModalOpen(false)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Type Toggle */}
              <div className="flex bg-stone-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setLossItemType('ingredient');
                    setSelectedItemId(ingredients[0]?.id || '');
                  }}
                  className={`flex-1 py-1.5 rounded-lg font-bold ${lossItemType === 'ingredient' ? 'bg-amber-800 text-white' : 'text-stone-600'}`}
                >
                  Insumo / Ingrediente
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLossItemType('product');
                    setSelectedItemId(products[0]?.id || '');
                  }}
                  className={`flex-1 py-1.5 rounded-lg font-bold ${lossItemType === 'product' ? 'bg-amber-800 text-white' : 'text-stone-600'}`}
                >
                  Produto Final
                </button>
              </div>

              {/* Item selection */}
              <div>
                <label className="font-bold text-stone-700 block mb-1">
                  Selecione o {lossItemType === 'ingredient' ? 'Insumo' : 'Produto'}
                </label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full border rounded-xl p-2.5 font-semibold text-xs"
                >
                  {lossItemType === 'ingredient'
                    ? ingredients.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} (Estoque: {i.stockQuantity} {i.unit} - Custo: R$ {i.avgCostUnit.toFixed(2)})
                        </option>
                      ))
                    : products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Estoque: {p.stockQuantity} unid - Custo: R$ {p.costPrice.toFixed(2)})
                        </option>
                      ))}
                </select>
              </div>

              {/* Quantity & Reason */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Quantidade Perdida</label>
                  <input
                    type="number"
                    min="1"
                    value={lossQty}
                    onChange={(e) => setLossQty(Math.max(1, Number(e.target.value)))}
                    className="w-full border rounded-xl p-2.5 font-bold text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">Motivo Específico</label>
                  <select
                    value={lossReason}
                    onChange={(e) => setLossReason(e.target.value as LossReason)}
                    className="w-full border rounded-xl p-2.5 font-semibold text-xs"
                  >
                    <option value="validade_vencida">Validade Vencida</option>
                    <option value="erro_preparo">Erro no Preparo</option>
                    <option value="queda_quebra">Queda / Quebra</option>
                    <option value="produto_danificado">Produto Danificado</option>
                    <option value="sobra_descartada">Sobra Descartada</option>
                    <option value="armazenamento_inadequado">Armazenamento Inadequado</option>
                    <option value="cancelamento_pos_preparo">Cancelamento pós-preparo</option>
                    <option value="ajuste_inventario">Ajuste de Inventário</option>
                    <option value="outro">Outro Motivo</option>
                  </select>
                </div>
              </div>

              {/* Employee & Sector */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Responsável / Funcionário</label>
                  <input
                    type="text"
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    className="w-full border rounded-xl p-2 text-xs"
                  />
                </div>

                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Setor</label>
                  <select
                    value={sectorName}
                    onChange={(e) => setSectorName(e.target.value)}
                    className="w-full border rounded-xl p-2 text-xs font-semibold"
                  >
                    <option value="Cozinha">Cozinha</option>
                    <option value="Bar / Bebidas">Bar / Bebidas</option>
                    <option value="Salão / Garçons">Salão / Garçons</option>
                    <option value="Estoque Central">Estoque Central</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Observações / Detalhes</label>
                <input
                  type="text"
                  placeholder="Ex: Embalagem rasgada na entrega"
                  value={lossNotes}
                  onChange={(e) => setLossNotes(e.target.value)}
                  className="w-full border rounded-xl p-2 text-xs"
                />
              </div>
            </div>

            <button
              onClick={handleConfirmLoss}
              className="w-full bg-rose-700 hover:bg-rose-800 text-white py-2.5 rounded-xl font-bold text-xs shadow flex items-center justify-center gap-1.5"
            >
              <TrendingDown className="w-4 h-4" />
              <span>Confirmar Baixa e Registrar Perda</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Courtesy from Inventory */}
      {isCourtesyModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-stone-200 text-xs">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-stone-900 text-base flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-800" />
                <span>Lançar Cortesia Geral</span>
              </h3>
              <button onClick={() => setIsCourtesyModalOpen(false)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="font-bold text-stone-700 block mb-1">Produto Cortesia</label>
                <select
                  value={courtesyProductId}
                  onChange={(e) => setCourtesyProductId(e.target.value)}
                  className="w-full border rounded-xl p-2.5 font-semibold text-xs"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — Venda: R$ {p.price.toFixed(2)} (Custo: R$ {p.costPrice.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">Quantidade</label>
                  <input
                    type="number"
                    min="1"
                    value={courtesyQty}
                    onChange={(e) => setCourtesyQty(Math.max(1, Number(e.target.value)))}
                    className="w-full border rounded-xl p-2.5 font-bold text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-700 block mb-1">Motivo da Cortesia</label>
                  <select
                    value={courtesyReason}
                    onChange={(e) => setCourtesyReason(e.target.value as CourtesyReason)}
                    className="w-full border rounded-xl p-2.5 font-semibold text-xs"
                  >
                    <option value="promocional">Ação Promocional</option>
                    <option value="atraso">Compensação por Atraso</option>
                    <option value="erro_pedido">Erro no Pedido</option>
                    <option value="cliente_especial">Cliente VIP</option>
                    <option value="aniversario">Aniversário</option>
                    <option value="gerencia">Cortesia da Gerência</option>
                    <option value="degustacao">Degustação</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Cliente Beneficiado</label>
                <input
                  type="text"
                  placeholder="Ex: Cliente da mesa 5"
                  value={courtesyCustomer}
                  onChange={(e) => setCourtesyCustomer(e.target.value)}
                  className="w-full border rounded-xl p-2 text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Autorizado Por</label>
                <input
                  type="text"
                  value={courtesyAuthorizer}
                  onChange={(e) => setCourtesyAuthorizer(e.target.value)}
                  className="w-full border rounded-xl p-2 text-xs font-semibold"
                />
              </div>
            </div>

            <button
              onClick={handleConfirmCourtesyFromInventory}
              className="w-full bg-amber-800 hover:bg-amber-900 text-white py-2.5 rounded-xl font-bold text-xs shadow flex items-center justify-center gap-1.5"
            >
              <Gift className="w-4 h-4" />
              <span>Confirmar Registro de Cortesia</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
