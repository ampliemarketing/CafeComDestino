import React, { useState, useEffect } from 'react';
import { Scale, Coffee, UtensilsCrossed, X, Check, Sparkles, DollarSign, RotateCcw } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface KgWeightEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (item: {
    productId: string;
    productName: string;
    weightKg: number;
    pricePerKg: number;
    totalPrice: number;
    notes: string;
  }) => void;
  initialType?: 'lunch' | 'breakfast';
}

export const KgWeightEntryModal: React.FC<KgWeightEntryModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialType = 'lunch',
}) => {
  const { companyProfile } = useApp();

  const [selectedType, setSelectedType] = useState<'lunch' | 'breakfast'>(initialType);
  const [entryMode, setEntryMode] = useState<'weight' | 'value'>('weight');

  // Config values
  const defaultLunchPrice = companyProfile.buffetPrices?.lunchPricePerKg ?? 80.00;
  const defaultBreakfastPrice = companyProfile.buffetPrices?.breakfastPricePerKg ?? 54.99;
  const defaultTare = companyProfile.buffetPrices?.plateTareGrams ?? 200;

  // Custom price override
  const [customPricePerKg, setCustomPricePerKg] = useState<number | null>(null);

  // Weight & Value states
  const [grossWeightGrams, setGrossWeightGrams] = useState<number>(650);
  const [deductTare, setDeductTare] = useState<boolean>(true);
  const [directValue, setDirectValue] = useState<number>(20.00);

  useEffect(() => {
    setSelectedType(initialType);
    setCustomPricePerKg(null);
  }, [initialType, isOpen]);

  if (!isOpen) return null;

  const currentPricePerKg =
    customPricePerKg !== null
      ? customPricePerKg
      : selectedType === 'lunch'
      ? defaultLunchPrice
      : defaultBreakfastPrice;

  // Calculate weight & total
  let netWeightGrams = 0;
  let netWeightKg = 0;
  let totalPrice = 0;

  if (entryMode === 'weight') {
    const tareGrams = deductTare ? defaultTare : 0;
    netWeightGrams = Math.max(0, grossWeightGrams - tareGrams);
    netWeightKg = netWeightGrams / 1000;
    totalPrice = netWeightKg * currentPricePerKg;
  } else {
    totalPrice = Math.max(0, directValue);
    netWeightKg = currentPricePerKg > 0 ? totalPrice / currentPricePerKg : 0;
    netWeightGrams = Math.round(netWeightKg * 1000);
  }

  const handleConfirm = () => {
    if (totalPrice <= 0 || netWeightKg <= 0) {
      return;
    }

    const typeTitle = selectedType === 'lunch' ? 'Almoço Por Quilo' : 'Café da Manhã Por Quilo';
    const prodId = selectedType === 'lunch' ? 'prod-kg-almoco' : 'prod-kg-cafe';

    const formattedWeight = netWeightKg.toFixed(3).replace('.', ',');
    const formattedPriceKg = currentPricePerKg.toFixed(2).replace('.', ',');
    const tareNote = deductTare && entryMode === 'weight' ? ` (Tara: ${defaultTare}g)` : '';

    onConfirm({
      productId: prodId,
      productName: `${typeTitle} (${netWeightGrams}g)`,
      weightKg: Number(netWeightKg.toFixed(3)),
      pricePerKg: currentPricePerKg,
      totalPrice: Number(totalPrice.toFixed(2)),
      notes: `Peso líq: ${formattedWeight}kg @ R$ ${formattedPriceKg}/kg${tareNote}`,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-stone-900 text-stone-100 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-800 text-amber-300 flex items-center justify-center font-bold shadow">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Lançar Comida Por Quilo</h3>
              <p className="text-[11px] text-stone-400">Balança de Buffet & Self-Service</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 text-xs overflow-y-auto max-h-[80vh]">
          {/* Buffet Type Selector */}
          <div>
            <label className="font-bold text-stone-700 block mb-2">1. Selecione o Tipo de Buffet:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedType('lunch');
                  setCustomPricePerKg(null);
                }}
                className={`p-3 rounded-2xl border-2 font-bold transition flex flex-col items-center gap-1.5 text-center ${
                  selectedType === 'lunch'
                    ? 'border-amber-700 bg-amber-50 text-amber-950 shadow-sm'
                    : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                }`}
              >
                <UtensilsCrossed className="w-5 h-5 text-amber-800" />
                <span>Almoço Por Quilo</span>
                <span className="text-[11px] font-mono text-amber-800">
                  R$ {defaultLunchPrice.toFixed(2).replace('.', ',')} / kg
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedType('breakfast');
                  setCustomPricePerKg(null);
                }}
                className={`p-3 rounded-2xl border-2 font-bold transition flex flex-col items-center gap-1.5 text-center ${
                  selectedType === 'breakfast'
                    ? 'border-amber-700 bg-amber-50 text-amber-950 shadow-sm'
                    : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                }`}
              >
                <Coffee className="w-5 h-5 text-amber-800" />
                <span>Café da Manhã</span>
                <span className="text-[11px] font-mono text-amber-800">
                  R$ {defaultBreakfastPrice.toFixed(2).replace('.', ',')} / kg
                </span>
              </button>
            </div>
          </div>

          {/* Entry Mode Tabs */}
          <div className="flex bg-stone-100 p-1 rounded-2xl border border-stone-200 font-semibold">
            <button
              type="button"
              onClick={() => setEntryMode('weight')}
              className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
                entryMode === 'weight' ? 'bg-white text-stone-900 shadow-sm font-bold' : 'text-stone-500'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Digitar Peso (g)</span>
            </button>

            <button
              type="button"
              onClick={() => setEntryMode('value')}
              className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
                entryMode === 'value' ? 'bg-white text-stone-900 shadow-sm font-bold' : 'text-stone-500'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Digitar Valor (R$)</span>
            </button>
          </div>

          {/* Mode 1: Weight Input */}
          {entryMode === 'weight' && (
            <div className="space-y-3 bg-stone-50 p-4 rounded-2xl border border-stone-200">
              <div className="flex items-center justify-between">
                <label className="font-bold text-stone-800">Peso Bruto da Balança (g):</label>
                <span className="text-[10px] text-stone-500 font-mono">
                  {(grossWeightGrams / 1000).toFixed(3)} kg
                </span>
              </div>

              <div className="relative">
                <input
                  type="number"
                  step="10"
                  min="0"
                  value={grossWeightGrams || ''}
                  onChange={(e) => setGrossWeightGrams(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="Ex: 450"
                  className="w-full border-2 border-amber-300 focus:border-amber-600 focus:ring-0 bg-white rounded-2xl p-3 text-2xl font-black text-stone-900 text-center tracking-tight"
                />
                <span className="absolute right-4 top-4 font-bold text-stone-400">g</span>
              </div>

              {/* Quick Weight Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[250, 350, 450, 500, 650, 800].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setGrossWeightGrams(w)}
                    className="px-2.5 py-1 bg-white border border-stone-200 hover:border-amber-600 rounded-xl font-bold text-[11px] text-stone-700 hover:text-amber-800 transition"
                  >
                    {w}g
                  </button>
                ))}
              </div>

              {/* Tare Toggle */}
              <div
                onClick={() => setDeductTare(!deductTare)}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                  deductTare ? 'bg-amber-100/60 border-amber-300 text-amber-950' : 'bg-white border-stone-200 text-stone-500'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${deductTare ? 'bg-amber-800 border-amber-800 text-white' : 'border-stone-300'}`}>
                    {deductTare && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span className="font-bold">Descontar Tara do Prato ({defaultTare}g)</span>
                </div>
                <span className="font-mono text-[11px] text-amber-900 font-bold">
                  {deductTare ? `-${defaultTare}g` : 'Sem tara'}
                </span>
              </div>
            </div>
          )}

          {/* Mode 2: Direct Value Input */}
          {entryMode === 'value' && (
            <div className="space-y-3 bg-stone-50 p-4 rounded-2xl border border-stone-200">
              <label className="font-bold text-stone-800 block">Valor Desejado em Reais (R$):</label>

              <div className="relative">
                <span className="absolute left-4 top-3 text-lg font-bold text-stone-400">R$</span>
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  value={directValue || ''}
                  onChange={(e) => setDirectValue(parseFloat(e.target.value) || 0)}
                  placeholder="20,00"
                  className="w-full border-2 border-amber-300 focus:border-amber-600 focus:ring-0 bg-white rounded-2xl p-3 pl-12 text-2xl font-black text-stone-900 tracking-tight"
                />
              </div>

              {/* Quick Value Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[10, 15, 20, 25, 30, 40].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setDirectValue(val)}
                    className="px-2.5 py-1 bg-white border border-stone-200 hover:border-amber-600 rounded-xl font-bold text-[11px] text-stone-700 hover:text-amber-800 transition"
                  >
                    R$ {val},00
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Summary Readout Card */}
          <div className="bg-gradient-to-br from-amber-900 to-stone-900 text-stone-100 p-4 rounded-2xl shadow-md space-y-2">
            <div className="flex items-center justify-between border-b border-amber-800/60 pb-2">
              <span className="text-[11px] text-amber-300 font-semibold uppercase tracking-wider">
                {selectedType === 'lunch' ? 'Almoço Por Quilo' : 'Café da Manhã Por Quilo'}
              </span>
              <span className="font-mono text-xs font-bold text-amber-200">
                R$ {currentPricePerKg.toFixed(2).replace('.', ',')} / kg
              </span>
            </div>

            <div className="flex items-baseline justify-between pt-1">
              <div>
                <p className="text-[10px] text-stone-400 uppercase">Peso Líquido Calculado</p>
                <p className="text-xl font-black font-mono text-white">
                  {netWeightKg.toFixed(3).replace('.', ',')} kg
                  <span className="text-xs font-normal text-stone-300 ml-1">({netWeightGrams}g)</span>
                </p>
              </div>

              <div className="text-right">
                <p className="text-[10px] text-amber-300 uppercase font-bold">Total a Lançar</p>
                <p className="text-2xl font-black font-mono text-amber-400">
                  R$ {totalPrice.toFixed(2).replace('.', ',')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 border border-stone-300 rounded-xl font-bold text-stone-700 hover:bg-stone-100 transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={totalPrice <= 0 || netWeightKg <= 0}
            className="flex-[2] py-3 bg-amber-800 hover:bg-amber-900 text-white rounded-xl font-bold transition shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Adicionar R$ {totalPrice.toFixed(2).replace('.', ',')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
