import React, { useEffect, useState } from 'react';
import { useApp, mapCashShiftRow } from '../../context/AppContext';
import { supabase } from '../../lib/supabaseClient';
import { num } from '../../lib/caseMapping';
import { CashMovement, CashShift, Order } from '../../types';
import { fetchShiftOrders, computeShiftStats, diffTone, diffToneClasses } from './shiftStats';
import { CashShiftPrintReport } from './CashShiftPrintReport';
import { hasPermission } from '../../lib/permissions';
import { MAXLEN, sanitizeText, toBoundedNumber } from '../../lib/validation';
import {
  ArrowLeft,
  Wallet,
  Banknote,
  CreditCard,
  QrCode,
  Ticket,
  MoreHorizontal,
  ArrowUpCircle,
  ArrowDownCircle,
  Scale,
  Loader2,
  StickyNote,
  Printer,
  Receipt,
  TrendingDown,
  Percent,
  DollarSign,
  Lock,
  X,
  KeyRound,
  Clock,
  FileText,
} from 'lucide-react';

const mapMovementRow = (row: any): CashMovement => ({
  id: row.id,
  shiftId: row.shift_id,
  type: row.type,
  amount: Number(row.amount),
  name: row.name,
  reason: row.reason,
  userName: row.user_name,
  timestamp: row.timestamp,
});

export const CashShiftDetail: React.FC = () => {
  const { cashShiftsHistory, selectedCashShiftId, setActiveView, products, categories, currentUser, companyProfile, closeCashShift, addCashMovement, validateOwnPin } = useApp();
  // Diferença acima deste valor (em qualquer forma de pagamento) exige justificativa nas observações.
  const JUSTIFICATION_THRESHOLD = companyProfile.blindConferenceThreshold ?? 10;
  const can = (key: string) => hasPermission(currentUser, key);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [shiftOrders, setShiftOrders] = useState<Order[]>([]);
  // Cópia fresca do turno buscada ao abrir a tela — os totais (sales_cash etc.)
  // vêm de um trigger no servidor e são a peça mais sensível a um evento de
  // realtime perdido. Aqui a tela de conferência sempre lê o valor do banco.
  const [dbShift, setDbShift] = useState<CashShift | null>(null);
  // Esperado em espécie calculado pelo servidor (RPC cash_shift_expected_cash) —
  // é a base que o fechamento usa de verdade. O cálculo local abaixo omite
  // couvert/taxa recebidos em dinheiro, o que gerava "diferença" fantasma.
  const [serverExpectedCash, setServerExpectedCash] = useState<number | null>(null);

  // Nova Movimentação (entrada/saída)
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [movType, setMovType] = useState<'reforco' | 'sangria'>('sangria');
  const [movName, setMovName] = useState<string>('');
  const [movAmount, setMovAmount] = useState<string>('');
  const [movReason, setMovReason] = useState<string>('');

  // Conferência / fechamento
  const [isClosing, setIsClosing] = useState(false);
  const [conferredCash, setConferredCash] = useState(0);
  const [conferredCredit, setConferredCredit] = useState(0);
  const [conferredDebit, setConferredDebit] = useState(0);
  const [conferredPix, setConferredPix] = useState(0);
  const [conferredMealVoucher, setConferredMealVoucher] = useState(0);
  const [conferredOther, setConferredOther] = useState(0);
  // Quais formas eletrônicas o operador de fato conferiu (as outras vão como
  // "não conferido" = opcional, e não forçam justificativa).
  const [conferredTouched, setConferredTouched] = useState<Record<string, boolean>>({});
  const [closeNotesInput, setCloseNotesInput] = useState('');
  const [pinStepOpen, setPinStepOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [pinChecking, setPinChecking] = useState(false);

  useEffect(() => {
    if (!pinStepOpen) return;
    setHasPin(null);
    supabase.rpc('current_user_has_pin').then(({ data }) => setHasPin(data === true));
  }, [pinStepOpen]);

  const index = cashShiftsHistory.findIndex((s) => s.id === selectedCashShiftId);
  const turno = index >= 0 ? cashShiftsHistory.length - index : null;
  // Prefere a cópia fresca do banco; cai pro cache do contexto enquanto carrega.
  const shift = dbShift ?? (index >= 0 ? cashShiftsHistory[index] : null);

  useEffect(() => {
    if (!selectedCashShiftId) return;
    let cancelled = false;
    setLoading(true);
    setDbShift(null);
    supabase
      .from('cash_movements')
      .select('*')
      .eq('shift_id', selectedCashShiftId)
      .order('timestamp', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        setMovements(data ? data.map(mapMovementRow) : []);
        setLoading(false);
      });
    supabase
      .from('cash_shifts')
      .select('*')
      .eq('id', selectedCashShiftId)
      .single()
      .then(({ data }) => {
        if (!cancelled && data) setDbShift(mapCashShiftRow(data));
      });
    fetchShiftOrders(selectedCashShiftId).then((data) => { if (!cancelled) setShiftOrders(data); });
    // Esperado na gaveta pela MESMA conta do servidor (close_cash_shift):
    // todo dinheiro do livro-caixa, incluindo couvert e taxa de serviço pagos
    // em espécie — que o cálculo local (base salesCash) não enxerga.
    setServerExpectedCash(null);
    supabase.rpc('cash_shift_expected_cash', { p_shift_id: selectedCashShiftId })
      .then(({ data }) => { if (!cancelled && data != null) setServerExpectedCash(num(data)); });
    return () => { cancelled = true; };
  }, [selectedCashShiftId]);

  const goBack = () => setActiveView('caixas');

  if (!shift) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 min-h-screen">
        <button onClick={goBack} className="flex items-center gap-1.5 text-xs font-bold text-stone-500 hover:text-stone-800">
          <ArrowLeft className="w-4 h-4" /> Voltar para Caixas
        </button>
        <div className="bg-white p-8 rounded-2xl border border-stone-200 shadow-sm text-center text-stone-400 text-sm">
          Turno não encontrado.
        </div>
      </div>
    );
  }

  const isOpen = shift.status === 'aberto';
  const stats = computeShiftStats(shiftOrders, products, categories);

  // salesCash é bruto: desconta troco entregue e despesas pagas em dinheiro.
  // Fallback local (usado enquanto a RPC não respondeu ou em turno sem ledger).
  const liveExpectedTotal = shift.initialFloat + shift.salesCash + shift.additions
    - shift.withdrawals - (shift.cashChangeGiven ?? 0) - (shift.cashExpenses ?? 0);
  const expectedTotal = isOpen ? (serverExpectedCash ?? liveExpectedTotal) : shift.expectedTotal;

  // Conferência CEGA: os campos começam zerados — o operador conta e digita,
  // a diferença só aparece depois. (Não pré-preencher com o valor do sistema.)
  const startClosing = () => {
    setConferredCash(0);
    setConferredCredit(0);
    setConferredDebit(0);
    setConferredPix(0);
    setConferredMealVoucher(0);
    setConferredOther(0);
    setConferredTouched({});
    setCloseNotesInput('');
    setPinInput('');
    setPinError('');
    setPinStepOpen(false);
    setIsClosing(true);
  };

  const markTouched = (key: string, setter: (n: number) => void) => (n: number) => {
    setter(n);
    setConferredTouched((t) => ({ ...t, [key]: true }));
  };

  const paymentDefs = [
    // Dinheiro: o "sistema" é o esperado na GAVETA (fundo + vendas em dinheiro
    // − sangrias − troco − despesas), não só as vendas em dinheiro. Obrigatório.
    { key: 'cash', icon: Banknote, label: 'Dinheiro', system: expectedTotal, closedValue: shift.actualTotal, value: conferredCash, setValue: setConferredCash, optional: false },
    { key: 'credit', icon: CreditCard, label: 'Cartão de Crédito', system: shift.salesCredit, closedValue: shift.conferredCredit, value: conferredCredit, setValue: setConferredCredit, optional: true },
    { key: 'debit', icon: CreditCard, label: 'Cartão de Débito', system: shift.salesDebit, closedValue: shift.conferredDebit, value: conferredDebit, setValue: setConferredDebit, optional: true },
    { key: 'pix', icon: QrCode, label: 'Pix', system: shift.salesPix, closedValue: shift.conferredPix, value: conferredPix, setValue: setConferredPix, optional: true },
    { key: 'meal', icon: Ticket, label: 'Vale-refeição', system: shift.salesMealVoucher, closedValue: shift.conferredMealVoucher, value: conferredMealVoucher, setValue: setConferredMealVoucher, optional: true },
    { key: 'other', icon: MoreHorizontal, label: 'Outros', system: shift.salesOther, closedValue: shift.conferredOther, value: conferredOther, setValue: setConferredOther, optional: true },
  ];

  // Só a diferença do DINHEIRO força justificativa. As formas eletrônicas são
  // conferência opcional (conciliação manual contra extrato) e não bloqueiam.
  const cashDiff = conferredCash - expectedTotal;
  const needsJustification = Math.abs(cashDiff) > JUSTIFICATION_THRESHOLD;
  // O servidor (close_cash_shift) também recusa o fechamento se |diferença do
  // dinheiro| > limite e as observações estiverem vazias.
  const canConfirmClose = conferredCash > 0 && (!needsJustification || closeNotesInput.trim().length > 0);

  const requestPinConfirmation = () => {
    setPinError('');
    setPinInput('');
    setPinStepOpen(true);
  };

  const confirmClose = async () => {
    setPinError('');
    setPinChecking(true);
    const ok = await validateOwnPin(pinInput);
    setPinChecking(false);
    if (!ok) {
      setPinError(hasPin === false
        ? 'Você não tem um PIN cadastrado.'
        : 'PIN incorreto (ou muitas tentativas — aguarde 2 min).');
      return;
    }
    await closeCashShift({
      conferredCash,
      conferredCredit: conferredTouched.credit ? conferredCredit : null,
      conferredDebit: conferredTouched.debit ? conferredDebit : null,
      conferredPix: conferredTouched.pix ? conferredPix : null,
      conferredMealVoucher: conferredTouched.meal ? conferredMealVoucher : null,
      conferredOther: conferredTouched.other ? conferredOther : null,
      notes: closeNotesInput,
    });
    setPinStepOpen(false);
    setIsClosing(false);
    // Volta a ler o turno do contexto (que recebe o fechamento por realtime),
    // pra tela refletir o status 'fechado' na hora.
    setDbShift(null);
  };

  const reforcos = movements.filter((m) => m.type === 'reforco');
  const sangrias = movements.filter((m) => m.type === 'sangria');

  const cardLegacy = shift.salesCredit === 0 && shift.salesDebit === 0 && shift.salesCard > 0;
  const totalEntradas = shift.salesCash + shift.salesCredit + shift.salesDebit + shift.salesPix
    + shift.salesMealVoucher + shift.salesOther + (cardLegacy ? shift.salesCard : 0);
  const goodsOut = shift.goodsOut ?? 0;
  // Saídas = valor de mercadoria vendida (preço de menu) + sangrias.
  const totalSaidas = goodsOut + shift.withdrawals;

  return (
    <div className={`p-4 md:p-6 max-w-5xl mx-auto space-y-6 min-h-screen print:hidden ${isClosing ? 'pb-28' : ''}`}>
      <div className="flex items-center justify-between">
        <button onClick={goBack} className="flex items-center gap-1.5 text-xs font-bold text-stone-500 hover:text-stone-800">
          <ArrowLeft className="w-4 h-4" /> Voltar para Caixas
        </button>
        {can('caixas.imprimir') && (
        <button
          onClick={() => window.print()}
          className="px-3.5 py-2 rounded-xl text-xs font-bold border border-stone-300 text-stone-700 hover:bg-stone-100 flex items-center gap-1.5"
        >
          <Printer className="w-3.5 h-3.5" /> Imprimir Relatório
        </button>
        )}
      </div>

      {/* Header Banner */}
      <div className="bg-stone-900 text-stone-100 p-5 rounded-2xl border border-stone-800 flex flex-col sm:flex-row sm:items-start justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-800 text-white font-bold flex items-center justify-center shadow shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold tracking-tight">Turno #{turno}</h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                isClosing
                  ? 'bg-amber-950 text-amber-400 border-amber-800'
                  : isOpen
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                    : 'bg-stone-800 text-stone-300 border-stone-700'
              }`}>
                {isClosing ? 'EM CONFERÊNCIA' : shift.status.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-1">
              Aberto por <span className="text-stone-200 font-semibold">{shift.openedBy}</span> em {shift.openedAt}
            </p>
            {shift.status === 'fechado' && (
              <p className="text-xs text-stone-400">
                Fechado por <span className="text-stone-200 font-semibold">{shift.closedBy}</span> em {shift.closedAt}
              </p>
            )}
            {isClosing && (
              <p className="text-xs text-stone-400 flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> Fechando como: {currentUser.name} ({currentUser.role}) • Agora: {new Date().toLocaleString('pt-BR')}
              </p>
            )}
          </div>
        </div>

        {isOpen && (
          <div className="flex items-center gap-2">
            {can('caixas.movimentacao') && (
            <button
              onClick={() => setIsMovementModalOpen(true)}
              className="bg-amber-800 hover:bg-amber-900 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow flex items-center gap-1.5"
            >
              <DollarSign className="w-4 h-4" />
              <span>Nova Movimentação</span>
            </button>
            )}
            {!isClosing && can('caixas.fechar') && (
              <button
                onClick={startClosing}
                className="bg-rose-700 hover:bg-rose-800 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow flex items-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>Conferir e Fechar Caixa</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Composição das vendas */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
        <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider">Composição das Vendas</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-stone-500"><Scale className="w-3.5 h-3.5" /><span className="text-[10px] font-semibold uppercase">Fundo Inicial</span></div>
            <p className="text-base font-bold text-stone-900 mt-1">R$ {shift.initialFloat.toFixed(2)}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-emerald-700"><Banknote className="w-3.5 h-3.5" /><span className="text-[10px] font-semibold uppercase">Dinheiro</span></div>
            <p className="text-base font-bold text-emerald-800 mt-1">R$ {shift.salesCash.toFixed(2)}</p>
          </div>
          {cardLegacy ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-amber-700"><CreditCard className="w-3.5 h-3.5" /><span className="text-[10px] font-semibold uppercase">Cartão (turno anterior à separação)</span></div>
              <p className="text-base font-bold text-amber-800 mt-1">R$ {shift.salesCard.toFixed(2)}</p>
            </div>
          ) : (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-amber-700"><CreditCard className="w-3.5 h-3.5" /><span className="text-[10px] font-semibold uppercase">Crédito</span></div>
                <p className="text-base font-bold text-amber-800 mt-1">R$ {shift.salesCredit.toFixed(2)}</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-amber-700"><CreditCard className="w-3.5 h-3.5" /><span className="text-[10px] font-semibold uppercase">Débito</span></div>
                <p className="text-base font-bold text-amber-800 mt-1">R$ {shift.salesDebit.toFixed(2)}</p>
              </div>
            </>
          )}
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-sky-700"><QrCode className="w-3.5 h-3.5" /><span className="text-[10px] font-semibold uppercase">Pix</span></div>
            <p className="text-base font-bold text-sky-800 mt-1">R$ {shift.salesPix.toFixed(2)}</p>
          </div>
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-violet-700"><Ticket className="w-3.5 h-3.5" /><span className="text-[10px] font-semibold uppercase">Vale-refeição</span></div>
            <p className="text-base font-bold text-violet-800 mt-1">R$ {shift.salesMealVoucher.toFixed(2)}</p>
          </div>
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-stone-500"><MoreHorizontal className="w-3.5 h-3.5" /><span className="text-[10px] font-semibold uppercase">Outros</span></div>
            <p className="text-base font-bold text-stone-900 mt-1">R$ {shift.salesOther.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Resumo por forma de pagamento */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
        <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
          <Receipt className="w-3.5 h-3.5" /> Conferência por Forma de Pagamento
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-stone-100 text-stone-600 uppercase font-bold border-b">
              <tr>
                <th className="p-2.5">Forma</th>
                <th className="p-2.5 text-right">Valor do Sistema</th>
                <th className="p-2.5 text-right">Valor Conferido</th>
                <th className="p-2.5 text-right">Diferença</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paymentDefs.map((row) => {
                // Durante o fechamento: forma eletrônica só "conta" se o operador digitou nela.
                const isConferred = !isClosing ? row.closedValue != null : (!row.optional || conferredTouched[row.key]);
                const displayedConferred = isClosing ? (isConferred ? row.value : null) : row.closedValue;
                const diff = displayedConferred != null ? displayedConferred - row.system : undefined;
                const tone = diffTone(diff);
                return (
                  <tr key={row.label}>
                    <td className="p-2.5 font-semibold text-stone-800 flex items-center gap-1.5">
                      <row.icon className="w-3.5 h-3.5 text-stone-400" /> {row.label}
                      {row.key === 'cash'
                        ? <span className="text-[10px] font-normal text-stone-400">(esperado na gaveta)</span>
                        : isClosing && <span className="text-[10px] font-normal text-stone-400">(opcional)</span>}
                    </td>
                    <td className="p-2.5 text-right text-stone-600">R$ {row.system.toFixed(2)}</td>
                    <td className="p-2.5 text-right">
                      {isClosing ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.optional && !conferredTouched[row.key] ? '' : (row.value || '')}
                          placeholder={row.optional ? 'opcional' : '0,00'}
                          onChange={(e) => markTouched(row.key, row.setValue)(toBoundedNumber(e.target.value, 0, 10_000_000))}
                          className="w-28 border rounded-lg px-2 py-1 text-right font-bold"
                        />
                      ) : displayedConferred != null ? (
                        <span className="text-stone-600">R$ {displayedConferred.toFixed(2)}</span>
                      ) : (
                        <span className="text-stone-400">não conferido</span>
                      )}
                    </td>
                    <td className={`p-2.5 text-right font-bold ${diff !== undefined ? diffToneClasses[tone].value : 'text-stone-300'}`}>
                      {diff !== undefined ? `R$ ${diff.toFixed(2)}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-stone-400">
          Só o <strong>dinheiro</strong> é obrigatório (fundo de troco + vendas em dinheiro − sangrias − troco − despesas).
          Conferir cartão/pix/vale é opcional — deixe em branco se for conciliar depois pelo extrato.
        </p>
      </div>

      {/* Entradas vs Saidas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs uppercase tracking-wide">
              <ArrowUpCircle className="w-4 h-4" /> Total de Entradas
            </div>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
              {reforcos.length} reforço{reforcos.length !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-2xl font-bold text-emerald-800 mt-2">R$ {totalEntradas.toFixed(2)}</p>
          <p className="text-[10px] text-stone-500 mt-1">Vendas (todas as formas) + reforços de caixa</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-rose-800 font-bold text-xs uppercase tracking-wide">
              <ArrowDownCircle className="w-4 h-4" /> Total de Saídas
            </div>
            <span className="text-[10px] font-semibold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
              {sangrias.length} sangria{sangrias.length !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-2xl font-bold text-rose-800 mt-2">R$ {totalSaidas.toFixed(2)}</p>
          <p className="text-[10px] text-stone-500 mt-1">
            Mercadoria vendida (menu) R$ {goodsOut.toFixed(2)} + sangrias R$ {shift.withdrawals.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Taxa de serviço (garçom) & Couvert */}
      {((shift.salesServiceFee ?? 0) > 0 || (shift.salesCouvert ?? 0) > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm">
            <div className="flex items-center gap-1.5 text-amber-800 font-bold text-xs uppercase tracking-wide">
              <Percent className="w-4 h-4" /> Taxa de Serviço (Garçom)
            </div>
            <p className="text-2xl font-bold text-amber-900 mt-2">R$ {(shift.salesServiceFee ?? 0).toFixed(2)}</p>
            <p className="text-[10px] text-stone-500 mt-1">
              Total dos {companyProfile.serviceFeePercent}% cobrados no turno (a repassar aos garçons)
            </p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
            <div className="flex items-center gap-1.5 text-stone-700 font-bold text-xs uppercase tracking-wide">
              <Ticket className="w-4 h-4" /> Couvert
            </div>
            <p className="text-2xl font-bold text-stone-900 mt-2">R$ {(shift.salesCouvert ?? 0).toFixed(2)}</p>
            <p className="text-[10px] text-stone-500 mt-1">
              {companyProfile.couvertValue > 0
                ? `${Math.round((shift.salesCouvert ?? 0) / companyProfile.couvertValue)} couvert(s) × R$ ${companyProfile.couvertValue.toFixed(2)}`
                : 'Couvert cobrado no turno'}
            </p>
          </div>
        </div>
      )}

      {/* Vendas e pedidos do período */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
        <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
          <Receipt className="w-3.5 h-3.5" /> Vendas e Pedidos do Período
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
            <span className="text-[10px] font-semibold text-stone-500 uppercase">Total Bruto</span>
            <p className="text-base font-bold text-stone-900 mt-1">R$ {stats.totalBruto.toFixed(2)}</p>
          </div>
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
            <span className="text-[10px] font-semibold text-stone-500 uppercase">Nº Pedidos</span>
            <p className="text-base font-bold text-stone-900 mt-1">{stats.numPedidos}</p>
          </div>
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
            <span className="text-[10px] font-semibold text-stone-500 uppercase">Ticket Médio</span>
            <p className="text-base font-bold text-stone-900 mt-1">R$ {stats.ticketMedio.toFixed(2)}</p>
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
            <span className="text-[10px] font-semibold text-rose-700 uppercase flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Cancelamentos</span>
            <p className="text-base font-bold text-rose-800 mt-1">{stats.cancelamentos.qtd} / R$ {stats.cancelamentos.valor.toFixed(2)}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <span className="text-[10px] font-semibold text-amber-700 uppercase flex items-center gap-1"><Percent className="w-3 h-3" /> Descontos Concedidos</span>
            <p className="text-base font-bold text-amber-800 mt-1">{stats.descontos.qtd} / R$ {stats.descontos.valor.toFixed(2)}</p>
          </div>
          {stats.porCategoria.length > 0 && (
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
              <span className="text-[10px] font-semibold text-stone-500 uppercase">Vendas por Categoria</span>
              <div className="mt-1 space-y-0.5">
                {stats.porCategoria.slice(0, 4).map((c) => (
                  <div key={c.categoryId} className="flex justify-between text-[11px]">
                    <span className="text-stone-600">{c.categoryName}</span>
                    <span className="font-bold text-stone-900">R$ {c.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {shiftOrders.length === 0 && (
          <p className="text-[10px] text-stone-400">
            Sem pedidos vinculados a este turno (turnos anteriores à separação de vendas por turno não têm esse dado).
          </p>
        )}
      </div>

      {/* Movements */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
        <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
          Movimentações do Turno ({movements.length})
        </h4>
        <div className="overflow-x-auto border border-stone-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-stone-100 text-stone-600 uppercase font-bold border-b">
              <tr>
                <th className="p-2.5">Horário</th>
                <th className="p-2.5">Tipo</th>
                <th className="p-2.5">Nome</th>
                <th className="p-2.5">Observação</th>
                <th className="p-2.5">Operador</th>
                <th className="p-2.5 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-stone-400">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Carregando movimentações...
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-stone-400">
                    Nenhuma movimentação registrada neste turno.
                  </td>
                </tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id} className="hover:bg-stone-50">
                    <td className="p-2.5 font-medium text-stone-600">{m.timestamp}</td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        m.type === 'reforco' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {m.type === 'reforco' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td className="p-2.5 font-semibold text-stone-800">{m.name}</td>
                    <td className="p-2.5 text-stone-600">{m.reason}</td>
                    <td className="p-2.5 text-stone-600">{m.userName}</td>
                    <td className={`p-2.5 text-right font-bold ${m.type === 'reforco' ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {m.type === 'reforco' ? '+' : '-'} R$ {m.amount.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Observações do fechamento (durante a conferência) */}
      {isClosing && (
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-2">
          <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Observações do Fechamento
            {needsJustification && <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full normal-case">Obrigatório — diferença acima de R$ {JUSTIFICATION_THRESHOLD.toFixed(2)}</span>}
          </h4>
          <textarea
            placeholder="Justificativa para divergências (ex: erro de troco, pagamento a menor não percebido)..."
            maxLength={MAXLEN.notes}
            value={closeNotesInput}
            onChange={(e) => setCloseNotesInput(sanitizeText(e.target.value, MAXLEN.notes))}
            className={`w-full border rounded-xl p-2.5 text-xs ${needsJustification && !closeNotesInput.trim() ? 'border-rose-400' : ''}`}
            rows={2}
          />
        </div>
      )}

      {/* Notes (histórico) */}
      {!isClosing && shift.notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-2">
          <StickyNote className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wide block mb-0.5">Observações</span>
            <p className="text-xs text-amber-900">{shift.notes}</p>
          </div>
        </div>
      )}

      {/* Barra de ação fixa */}
      {isClosing && (
        <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-white border-t border-stone-200 p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] z-30">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            <button
              onClick={() => setIsClosing(false)}
              className="px-4 py-2.5 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-bold"
            >
              Cancelar Conferência
            </button>
            <button
              onClick={requestPinConfirmation}
              disabled={!canConfirmClose}
              className="bg-rose-700 hover:bg-rose-800 disabled:bg-stone-300 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow flex items-center gap-2"
            >
              <Lock className="w-4 h-4" />
              Confirmar Fechamento de Caixa
            </button>
          </div>
        </div>
      )}

      {/* Movement Modal */}
      {isMovementModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-stone-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-stone-900 text-base">Registrar Movimentação de Caixa</h3>
              <button onClick={() => setIsMovementModalOpen(false)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMovType('sangria')}
                className={`p-3 rounded-xl border text-center font-bold text-xs ${
                  movType === 'sangria' ? 'bg-rose-700 text-white border-rose-700' : 'bg-stone-50 border-stone-200 text-stone-700'
                }`}
              >
                Saída
              </button>
              <button
                onClick={() => setMovType('reforco')}
                className={`p-3 rounded-xl border text-center font-bold text-xs ${
                  movType === 'reforco' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-stone-50 border-stone-200 text-stone-700'
                }`}
              >
                Entrada
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Nome</label>
                <input
                  type="text"
                  maxLength={MAXLEN.shortNote}
                  placeholder="Ex: Troco extra, Compra de gás..."
                  value={movName}
                  onChange={(e) => setMovName(sanitizeText(e.target.value, MAXLEN.shortNote))}
                  className="w-full border rounded-xl p-2.5 font-bold"
                />
              </div>
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Valor (R$)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={movAmount}
                  onChange={(e) => setMovAmount(e.target.value === '' ? '' : String(toBoundedNumber(e.target.value, 0, 10_000_000)))}
                  className="w-full border rounded-xl p-2.5 font-bold"
                />
              </div>
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Observação</label>
                <input
                  type="text"
                  maxLength={MAXLEN.shortNote}
                  placeholder="Ex: Pagamento fornecedor hortifruti, troco extra..."
                  value={movReason}
                  onChange={(e) => setMovReason(sanitizeText(e.target.value, MAXLEN.shortNote))}
                  className="w-full border rounded-xl p-2.5"
                />
              </div>
            </div>

            <button
              onClick={() => {
                const amount = Number(movAmount);
                if (amount > 0 && movName.trim()) {
                  addCashMovement(movType, amount, movName.trim(), movReason);
                  setIsMovementModalOpen(false);
                  setMovName('');
                  setMovAmount('');
                  setMovReason('');
                  // Reforço/sangria mexem nos totais do turno no servidor —
                  // volta a ler do contexto (realtime) em vez do snapshot local.
                  setDbShift(null);
                }
              }}
              disabled={!(Number(movAmount) > 0 && movName.trim())}
              className="w-full bg-amber-800 text-white py-3 rounded-xl font-bold text-xs shadow disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Confirmar Movimento
            </button>
          </div>
        </div>
      )}

      {/* PIN Confirmation Step */}
      {pinStepOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-stone-200">
            <div className="flex items-center gap-2 text-stone-900">
              <KeyRound className="w-5 h-5 text-amber-800" />
              <h3 className="font-bold text-base">Confirmar Fechamento</h3>
            </div>
            <p className="text-xs text-stone-500">
              Digite seu PIN para confirmar o fechamento do caixa como <span className="font-semibold text-stone-800">{currentUser.name}</span>.
            </p>
            {hasPin === false && (
              <p className="text-xs text-rose-600 font-semibold bg-rose-50 border border-rose-200 rounded-lg p-2">
                Você não tem um PIN cadastrado. Peça a um administrador para definir um em Usuários & Permissões (só admin pode).
              </p>
            )}
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              maxLength={MAXLEN.pin}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, MAXLEN.pin))}
              onKeyDown={(e) => e.key === 'Enter' && confirmClose()}
              placeholder="PIN (4 a 6 dígitos)"
              className="w-full border rounded-xl p-3 text-center text-lg tracking-[0.3em] font-bold"
            />
            {pinError && <p className="text-xs text-rose-600 font-semibold">{pinError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setPinStepOpen(false)}
                className="flex-1 py-2.5 bg-stone-200 text-stone-700 font-bold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={confirmClose}
                disabled={pinChecking || pinInput.length < 4 || hasPin === false}
                className="flex-1 py-2.5 bg-rose-700 text-white font-bold rounded-xl text-xs shadow disabled:opacity-50"
              >
                {pinChecking ? 'Validando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="hidden print:block">
        <CashShiftPrintReport shift={shift} turno={turno || 0} movements={movements} stats={stats} />
      </div>
    </div>
  );
};
