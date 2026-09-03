import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PaymentMethod, OrderChannel, TaxGroup } from '../../types';
import {
  FileText,
  Search,
  Download,
  ShieldCheck,
  Layers,
  Plus,
  Edit2,
  Trash2,
  X,
} from 'lucide-react';
import { hasPermission } from '../../lib/permissions';
import { MAXLEN, sanitizeText, maskCNPJ, isValidCNPJ } from '../../lib/validation';
import { emptyFiscalData, normalizeFiscalData, fiscalMissingFields } from '../../lib/fiscal';
import { FiscalFieldsForm } from './FiscalFieldsForm';

export const FiscalManagement: React.FC = () => {
  const {
    orders, companyProfile, setCompanyProfile, addToast, currentUser,
    taxGroups, products, saveTaxGroup, deleteTaxGroup,
  } = useApp();
  const can = (key: string) => hasPermission(currentUser, key);
  const canEditFiscal = can('fiscal.editar_dados_empresa');

  const [activeTab, setActiveTab] = useState<'notes' | 'config' | 'grupos'>('notes');

  // Editor de Grupo Tributário
  const [editingGroup, setEditingGroup] = useState<TaxGroup | null>(null);
  const [showGroupErrors, setShowGroupErrors] = useState(false);
  const [groupNameError, setGroupNameError] = useState(false);

  const productsPerGroup = (groupId: string) => products.filter((p) => p.taxGroupId === groupId).length;

  const openGroupEditor = (g: TaxGroup) => {
    setShowGroupErrors(false);
    setGroupNameError(false);
    setEditingGroup(g);
  };

  const handleNewGroup = () => openGroupEditor({
    id: 'taxg-' + Date.now(),
    name: '',
    description: '',
    active: true,
    fiscal: emptyFiscalData(),
  });

  const handleSaveGroup = () => {
    if (!editingGroup) return;
    const nameEmpty = !editingGroup.name.trim();
    const missing = fiscalMissingFields(editingGroup.fiscal);
    if (nameEmpty || missing.length > 0) {
      setGroupNameError(nameEmpty);
      setShowGroupErrors(true);
      addToast('error', 'Dados incompletos', 'Preencha os campos destacados em vermelho.');
      return;
    }
    saveTaxGroup({ ...editingGroup, name: editingGroup.name.trim(), fiscal: normalizeFiscalData(editingGroup.fiscal) });
    setEditingGroup(null);
  };

  const handleDeleteGroup = async (g: TaxGroup) => {
    const count = productsPerGroup(g.id);
    if (count > 0) {
      addToast('error', 'Grupo em uso', `${count} produto(s) ainda usam "${g.name}". Desvincule-os primeiro.`);
      return;
    }
    if (confirm(`Excluir o grupo tributário "${g.name}"?`)) {
      await deleteTaxGroup(g.id);
    }
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethod | 'todas'>('todas');
  const [channelFilter, setChannelFilter] = useState<OrderChannel | 'todos'>('todos');

  // Config Form
  const [cnpjInput, setCnpjInput] = useState(companyProfile.cnpj);
  const [ieInput, setIeInput] = useState(companyProfile.ie);
  const [razaoSocialInput, setRazaoSocialInput] = useState(companyProfile.name);

  const paymentLabels: Record<PaymentMethod, string> = {
    pix: 'Pix',
    cartao_credito: 'Cartão de Crédito',
    cartao_debito: 'Cartão de Débito',
    dinheiro: 'Dinheiro',
    boleto: 'Boleto',
    multiplo: 'Múltiplo',
    vale_refeicao: 'Vale-refeição',
  };

  const channelLabels: Record<OrderChannel, string> = {
    pdv: 'PDV',
    garcom: 'Garçom',
    online: 'Cardápio Online',
    balcao: 'Balcão',
    whatsapp: 'WhatsApp',
    telefone: 'Telefone',
  };

  const query = searchQuery.trim().toLowerCase();

  const fiscalOrders = orders.filter((o) => o.fiscalIssued);

  const filteredFiscalOrders = fiscalOrders
    .filter((o) => paymentFilter === 'todas' || o.paymentMethod === paymentFilter)
    .filter((o) => channelFilter === 'todos' || o.channel === channelFilter)
    .filter((o) => {
      if (!query) return true;
      return (
        (o.nfceKey || '').toLowerCase().includes(query) ||
        o.customer.name.toLowerCase().includes(query) ||
        String(o.orderNumber).includes(query)
      );
    });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 min-h-screen">
      {/* Header Banner */}
      <div className="bg-stone-900 text-stone-100 p-5 rounded-2xl border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-800 text-white font-bold flex items-center justify-center shadow">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Módulo Fiscal • NFC-e & NF-e</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Emissão autorizada de cupom fiscal do consumidor, chave Sefaz, DANFE e arquivo XML.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-emerald-950 text-emerald-400 border border-emerald-800 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Certificado A1: VÁLIDO (Sefaz Homologada)</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-4">
        <div className="flex gap-2 border-b pb-3 text-xs font-bold">
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === 'notes' ? 'bg-amber-800 text-white' : 'bg-stone-100 text-stone-700'
            }`}
          >
            Notas Fiscais Emitidas ({fiscalOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === 'config' ? 'bg-amber-800 text-white' : 'bg-stone-100 text-stone-700'
            }`}
          >
            Dados da Empresa Emitente
          </button>
          <button
            onClick={() => setActiveTab('grupos')}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 ${
              activeTab === 'grupos' ? 'bg-amber-800 text-white' : 'bg-stone-100 text-stone-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Grupos Tributários ({taxGroups.length})
          </button>
        </div>

        {/* Notes List Tab */}
        {activeTab === 'notes' && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  maxLength={60}
                  placeholder="Buscar por chave Sefaz, cliente ou nº do pedido..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value.slice(0, 60))}
                  className="w-full border rounded-xl pl-10 pr-4 py-2 text-xs"
                />
              </div>

              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value as PaymentMethod | 'todas')}
                className="border rounded-xl px-3 py-2 text-xs font-semibold text-stone-700 bg-white"
              >
                <option value="todas">Todas as formas de pagamento</option>
                {(Object.keys(paymentLabels) as PaymentMethod[]).map((pm) => (
                  <option key={pm} value={pm}>{paymentLabels[pm]}</option>
                ))}
              </select>

              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value as OrderChannel | 'todos')}
                className="border rounded-xl px-3 py-2 text-xs font-semibold text-stone-700 bg-white"
              >
                <option value="todos">Todos os canais</option>
                {(Object.keys(channelLabels) as OrderChannel[]).map((ch) => (
                  <option key={ch} value={ch}>{channelLabels[ch]}</option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[520px]">
              <table className="w-full text-xs text-left">
                <thead className="bg-stone-100 text-stone-600 uppercase font-bold border-b sticky top-0">
                  <tr>
                    <th className="p-3">Série/Número</th>
                    <th className="p-3">Data/Hora</th>
                    <th className="p-3">Chave de Acesso Sefaz</th>
                    <th className="p-3">Destinatário</th>
                    <th className="p-3 text-right">Valor Total</th>
                    <th className="p-3 text-center">Downloads</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredFiscalOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-stone-50">
                      <td className="p-3 font-bold font-mono text-stone-900">001 / #{o.orderNumber}</td>
                      <td className="p-3 text-stone-600">{o.createdAt}</td>
                      <td className="p-3 font-mono text-[10px] text-stone-700">{o.nfceKey || <span className="text-stone-400 italic font-sans">— sem chave —</span>}</td>
                      <td className="p-3 font-semibold text-stone-800">{o.customer.name}</td>
                      <td className="p-3 text-right font-bold text-amber-800">R$ {o.total.toFixed(2)}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => addToast('info', 'Download XML', 'Arquivo .xml gerado e baixado.')}
                            disabled={!can('fiscal.baixar_xml')}
                            className="p-1.5 text-stone-600 hover:text-stone-900 border rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Baixar XML"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredFiscalOrders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-stone-400">
                        Nenhuma nota encontrada com os filtros atuais.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Company Config Tab */}
        {activeTab === 'config' && (
          <div className="max-w-xl space-y-4 text-xs">
            <h3 className="font-bold text-stone-900 text-sm border-b pb-2">Configuração Fiscal da Empresa</h3>

            <fieldset disabled={!can('fiscal.editar_dados_empresa')} className="space-y-3 disabled:opacity-60">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Razão Social Emitente</label>
                <input
                  type="text"
                  maxLength={MAXLEN.tradeName}
                  value={razaoSocialInput}
                  onChange={(e) => setRazaoSocialInput(sanitizeText(e.target.value, MAXLEN.tradeName))}
                  className="w-full border rounded-xl p-2.5 font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">CNPJ</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={18}
                  value={cnpjInput}
                  onChange={(e) => setCnpjInput(maskCNPJ(e.target.value))}
                  className="w-full border rounded-xl p-2.5 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Inscrição Estadual (IE)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={20}
                  value={ieInput}
                  onChange={(e) => setIeInput(e.target.value.replace(/[^\dxX.\-/]/g, '').slice(0, 20))}
                  className="w-full border rounded-xl p-2.5 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Regime Tributário</label>
                <select className="w-full border rounded-xl p-2.5 font-semibold text-stone-800">
                  <option value="simples">Simples Nacional (ME / EPP)</option>
                  <option value="lucro_presumido">Lucro Presumido</option>
                  <option value="lucro_real">Lucro Real</option>
                </select>
              </div>
            </fieldset>

            {can('fiscal.editar_dados_empresa') && (
            <button
              onClick={() => {
                if (!razaoSocialInput.trim()) {
                  addToast('error', 'Razão social obrigatória', 'Informe a razão social do emitente.');
                  return;
                }
                if (cnpjInput.trim() && !isValidCNPJ(cnpjInput)) {
                  addToast('error', 'CNPJ inválido', 'Verifique os dígitos do CNPJ.');
                  return;
                }
                setCompanyProfile({
                  ...companyProfile,
                  name: razaoSocialInput.trim(),
                  cnpj: cnpjInput.trim(),
                  ie: ieInput.trim(),
                });
                addToast('success', 'Dados fiscais salvos');
              }}
              className="bg-amber-800 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow"
            >
              Salvar Dados Fiscais
            </button>
            )}
          </div>
        )}

        {/* Grupos Tributários Tab */}
        {activeTab === 'grupos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold text-stone-900 text-sm">Grupos Tributários</h3>
              {canEditFiscal && (
                <button
                  onClick={handleNewGroup}
                  className="bg-amber-800 hover:bg-amber-900 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow flex items-center gap-2 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Grupo</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-stone-100 text-stone-600 uppercase font-bold border-b">
                  <tr>
                    <th className="p-3">Grupo</th>
                    <th className="p-3">NCM</th>
                    <th className="p-3">CFOP</th>
                    <th className="p-3">CST/CSOSN</th>
                    <th className="p-3 text-center">Produtos</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {taxGroups.map((g) => (
                    <tr key={g.id} className="hover:bg-stone-50">
                      <td className="p-3">
                        <p className="font-bold text-stone-900">{g.name}</p>
                        {g.description && <p className="text-[10px] text-stone-400 font-normal">{g.description}</p>}
                      </td>
                      <td className="p-3 font-mono text-stone-700">{g.fiscal?.ncm || '—'}</td>
                      <td className="p-3 font-mono text-stone-700">{g.fiscal?.cfop || '—'}</td>
                      <td className="p-3 font-mono text-stone-700">{g.fiscal?.cstCsosn || '—'}</td>
                      <td className="p-3 text-center font-semibold text-stone-700">{productsPerGroup(g.id)}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          g.active ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'
                        }`}>
                          {g.active ? 'ATIVO' : 'INATIVO'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openGroupEditor({ ...g, fiscal: normalizeFiscalData(g.fiscal) })}
                            disabled={!canEditFiscal}
                            title="Editar grupo"
                            className="p-1.5 text-stone-600 hover:text-stone-900 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteGroup(g)}
                            disabled={!canEditFiscal}
                            title="Excluir grupo"
                            className="p-1.5 text-rose-600 hover:text-rose-800 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {taxGroups.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-stone-400">
                        Nenhum grupo tributário cadastrado ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Editor de Grupo Tributário */}
      {editingGroup && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 space-y-4 shadow-2xl border border-stone-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-stone-900 text-base flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-800" />
                {taxGroups.some((g) => g.id === editingGroup.id) ? 'Editar Grupo Tributário' : 'Novo Grupo Tributário'}
              </h3>
              <button onClick={() => setEditingGroup(null)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="font-medium text-stone-700 block mb-1">Nome do Grupo *</label>
                <input
                  type="text"
                  autoFocus
                  maxLength={MAXLEN.name}
                  value={editingGroup.name}
                  onChange={(e) => { setEditingGroup({ ...editingGroup, name: sanitizeText(e.target.value, MAXLEN.name) }); setGroupNameError(false); }}
                  className={`w-full border rounded-lg px-3 py-2${groupNameError ? ' border-rose-400 ring-2 ring-rose-200' : ''}`}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="font-medium text-stone-700 block mb-1">Descrição</label>
                <input
                  type="text"
                  maxLength={MAXLEN.shortNote}
                  value={editingGroup.description || ''}
                  onChange={(e) => setEditingGroup({ ...editingGroup, description: sanitizeText(e.target.value, MAXLEN.shortNote) })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={editingGroup.active}
                onChange={(e) => setEditingGroup({ ...editingGroup, active: e.target.checked })}
                className="rounded text-amber-800 w-4 h-4"
              />
              <span>Grupo ativo</span>
            </label>

            <FiscalFieldsForm
              value={editingGroup.fiscal}
              onChange={(fiscal) => setEditingGroup({ ...editingGroup, fiscal })}
              showErrors={showGroupErrors}
            />

            <div className="flex gap-2 pt-3 border-t">
              <button
                onClick={() => setEditingGroup(null)}
                className="flex-1 py-2.5 bg-stone-200 text-stone-700 font-bold rounded-xl text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveGroup}
                className="flex-1 py-2.5 bg-amber-800 text-white font-bold rounded-xl text-xs shadow"
              >
                Salvar Grupo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
