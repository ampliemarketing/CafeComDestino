import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { PaymentMethod, OrderChannel, TaxGroup, FiscalInvoice } from '../../types';
import {
  FileText,
  Search,
  Download,
  ShieldCheck,
  ShieldAlert,
  Layers,
  Plus,
  Edit2,
  Trash2,
  X,
  FileCode2,
  Send,
  RefreshCw,
} from 'lucide-react';
import { hasPermission } from '../../lib/permissions';
import { MAXLEN, sanitizeText, maskCNPJ, isValidCNPJ } from '../../lib/validation';
import {
  emptyFiscalData, normalizeFiscalData, fiscalMissingFields,
  buildFiscalNoteRows, filterFiscalNoteRows, FiscalNoteStatus,
} from '../../lib/fiscal';
import { FiscalFieldsForm } from './FiscalFieldsForm';

export const FiscalManagement: React.FC = () => {
  const {
    orders, companyProfile, setCompanyProfile, addToast, currentUser,
    taxGroups, products, saveTaxGroup, deleteTaxGroup, confirmDialog,
    fiscalInvoices, issueNfce,
  } = useApp();
  const can = (key: string) => hasPermission(currentUser, key);
  const canEditFiscal = can('fiscal.editar_dados_empresa');
  const canEmit = can('vendas.emitir_nfce') || can('fiscal.editar_dados_empresa');

  const [emittingId, setEmittingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'todas' | FiscalNoteStatus>('todas');

  const handleEmit = async (orderId: string) => {
    setEmittingId(orderId);
    try {
      await issueNfce(orderId);
    } finally {
      setEmittingId(null);
    }
  };

  // base64 (do provedor) -> download de arquivo real
  const downloadBase64 = (base64: string, filename: string, mime: string) => {
    try {
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      addToast('error', 'Falha ao baixar', 'Arquivo fiscal inválido ou corrompido.');
    }
  };

  const STATUS_META: Record<FiscalNoteStatus, { label: string; cls: string }> = {
    sem_emissao: { label: 'SEM EMISSÃO', cls: 'bg-stone-200 text-stone-600' },
    processando: { label: 'PROCESSANDO', cls: 'bg-sky-100 text-sky-800' },
    autorizada: { label: 'AUTORIZADA', cls: 'bg-emerald-100 text-emerald-800' },
    rejeitada: { label: 'REJEITADA', cls: 'bg-rose-100 text-rose-800' },
    cancelada: { label: 'CANCELADA', cls: 'bg-stone-200 text-stone-600' },
    erro: { label: 'ERRO', cls: 'bg-amber-100 text-amber-800' },
  };

  const [activeTab, setActiveTab] = useState<'notes' | 'config' | 'grupos'>('notes');

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
    const ok = await confirmDialog({ title: 'Excluir grupo tributário', message: `Excluir o grupo tributário "${g.name}"?` });
    if (ok) await deleteTaxGroup(g.id);
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethod | 'todas'>('todas');
  const [channelFilter, setChannelFilter] = useState<OrderChannel | 'todos'>('todos');

  const [cnpjInput, setCnpjInput] = useState(companyProfile.cnpj);
  const [ieInput, setIeInput] = useState(companyProfile.ie);
  const [razaoSocialInput, setRazaoSocialInput] = useState(companyProfile.name);
  const [ambienteInput, setAmbienteInput] = useState<'homologation' | 'production'>(
    companyProfile.fiscalInfo?.environment || 'homologation',
  );
  const [cscIdInput, setCscIdInput] = useState(companyProfile.fiscalInfo?.cscId || '');
  const [ibgeInput, setIbgeInput] = useState(companyProfile.address?.codMunicipioIbge || '');
  const [nfceSerieInput, setNfceSerieInput] = useState(String(companyProfile.fiscalInfo?.nfceSeries ?? 1));

  // Ressincroniza o formulário quando o perfil chega/é atualizado do servidor.
  useEffect(() => {
    setCnpjInput(companyProfile.cnpj);
    setIeInput(companyProfile.ie);
    setRazaoSocialInput(companyProfile.name);
    setAmbienteInput(companyProfile.fiscalInfo?.environment || 'homologation');
    setCscIdInput(companyProfile.fiscalInfo?.cscId || '');
    setIbgeInput(companyProfile.address?.codMunicipioIbge || '');
    setNfceSerieInput(String(companyProfile.fiscalInfo?.nfceSeries ?? 1));
  }, [companyProfile]);

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

  const noteRows = React.useMemo(() => buildFiscalNoteRows(orders, fiscalInvoices), [orders, fiscalInvoices]);
  const filteredNoteRows = React.useMemo(
    () => filterFiscalNoteRows(noteRows, {
      status: statusFilter, payment: paymentFilter, channel: channelFilter, query: searchQuery,
    }),
    [noteRows, statusFilter, paymentFilter, channelFilter, searchQuery],
  );

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 min-h-screen">
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
          {companyProfile.fiscalInfo?.environment === 'production' ? (
            <div className="bg-emerald-950 text-emerald-400 border border-emerald-800 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>SEFAZ: PRODUÇÃO</span>
            </div>
          ) : (
            <div className="bg-amber-950 text-amber-400 border border-amber-800 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              <span>SEFAZ: HOMOLOGAÇÃO (teste)</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-4">
        <div className="flex gap-2 border-b pb-3 text-xs font-bold">
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === 'notes' ? 'bg-amber-800 text-white' : 'bg-stone-100 text-stone-700'
            }`}
          >
            Notas Fiscais ({fiscalInvoices.length})
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

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="border rounded-xl px-3 py-2 text-xs font-semibold text-stone-700 bg-white"
              >
                <option value="todas">Todos os status</option>
                <option value="sem_emissao">Sem emissão</option>
                <option value="autorizada">Autorizada</option>
                <option value="rejeitada">Rejeitada</option>
                <option value="erro">Erro</option>
                <option value="processando">Processando</option>
                <option value="cancelada">Cancelada</option>
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
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Valor Total</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredNoteRows.map(({ key, invoice: inv, order, status }) => {
                    const meta = STATUS_META[status];
                    const orderId = inv?.orderId ?? order?.id ?? '';
                    return (
                      <tr key={key} className={`hover:bg-stone-50 ${!inv ? 'bg-stone-50/60' : ''}`}>
                        <td className="p-3 font-bold font-mono text-stone-900">
                          {(inv?.serie ?? '—')} / {inv?.numero ? `#${inv.numero}` : `#${order?.orderNumber ?? '?'}`}
                        </td>
                        <td className="p-3 text-stone-600">
                          {inv?.createdAt ? new Date(inv.createdAt).toLocaleString('pt-BR') : (order?.createdAt || '—')}
                        </td>
                        <td className="p-3 font-mono text-[10px] text-stone-700">
                          {inv?.chave || <span className="text-stone-400 italic font-sans">{inv?.rejeicaoMotivo ? inv.rejeicaoMotivo.slice(0, 60) : (inv ? '— sem chave —' : 'Pedido ainda não emitido')}</span>}
                        </td>
                        <td className="p-3 font-semibold text-stone-800">{order?.customer?.name || '—'}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${meta.cls}`} title={inv?.rejeicaoMotivo || ''}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="p-3 text-right font-bold text-amber-800">R$ {(order?.total ?? 0).toFixed(2)}</td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1.5">
                            {inv ? (
                              <>
                                <button
                                  onClick={() => inv.xml && downloadBase64(inv.xml, `nfce-${inv.chave || inv.id}.xml`, 'application/xml')}
                                  disabled={!inv.xml || !can('fiscal.baixar_xml')}
                                  className="p-1.5 text-stone-600 hover:text-stone-900 border rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="Baixar XML"
                                >
                                  <FileCode2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => inv.danfeBase64 && downloadBase64(inv.danfeBase64, `danfce-${inv.chave || inv.id}.pdf`, 'application/pdf')}
                                  disabled={!inv.danfeBase64}
                                  className="p-1.5 text-stone-600 hover:text-stone-900 border rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="Baixar DANFCE (PDF)"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                {canEmit && (inv.status === 'rejeitada' || inv.status === 'erro') && order && (
                                  <button
                                    onClick={() => handleEmit(orderId)}
                                    disabled={emittingId === orderId}
                                    className="p-1.5 text-amber-700 hover:text-amber-900 border border-amber-300 rounded-lg disabled:opacity-40"
                                    title="Reenviar à SEFAZ"
                                  >
                                    <RefreshCw className={`w-3.5 h-3.5 ${emittingId === orderId ? 'animate-spin' : ''}`} />
                                  </button>
                                )}
                              </>
                            ) : (
                              canEmit && order && (
                                <button
                                  onClick={() => handleEmit(orderId)}
                                  disabled={emittingId === orderId}
                                  className="flex items-center gap-1.5 bg-amber-800 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg hover:bg-amber-900 disabled:opacity-50"
                                  title={`Emitir NFC-e do pedido #${order.orderNumber}`}
                                >
                                  <Send className={`w-3.5 h-3.5 ${emittingId === orderId ? 'animate-pulse' : ''}`} />
                                  Emitir
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredNoteRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-stone-400">
                        Nenhuma nota encontrada com os filtros atuais.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Ambiente SEFAZ</label>
                  <select
                    value={ambienteInput}
                    onChange={(e) => setAmbienteInput(e.target.value as 'homologation' | 'production')}
                    className="w-full border rounded-xl p-2.5 font-semibold text-stone-800"
                  >
                    <option value="homologation">Homologação (teste)</option>
                    <option value="production">Produção</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Série da NFC-e</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={3}
                    value={nfceSerieInput}
                    onChange={(e) => setNfceSerieInput(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    className="w-full border rounded-xl p-2.5 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">ID do CSC (token SEFAZ)</label>
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="000001"
                    value={cscIdInput}
                    onChange={(e) => setCscIdInput(e.target.value.replace(/\s/g, '').slice(0, 10))}
                    className="w-full border rounded-xl p-2.5 font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Código IBGE do município</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={7}
                    placeholder="3550308"
                    value={ibgeInput}
                    onChange={(e) => setIbgeInput(e.target.value.replace(/\D/g, '').slice(0, 7))}
                    className="w-full border rounded-xl p-2.5 font-mono"
                  />
                </div>
              </div>
            </fieldset>

            <p className="text-[11px] text-stone-500 bg-stone-50 border border-stone-200 rounded-xl p-3 leading-relaxed">
              O <b>valor do CSC</b>, o <b>Token/UserToken da Brasil NFe</b> e o <b>certificado digital A1</b> ficam
              guardados como <i>secrets</i> no servidor (Edge Function <code>emit-nfce</code>) — nunca no navegador.
              Aqui só se configura o identificador do CSC e os dados públicos do emitente.
            </p>

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
                if (ibgeInput && ibgeInput.length !== 7) {
                  addToast('error', 'Código IBGE inválido', 'O código do município tem 7 dígitos.');
                  return;
                }
                setCompanyProfile({
                  ...companyProfile,
                  name: razaoSocialInput.trim(),
                  cnpj: cnpjInput.trim(),
                  ie: ieInput.trim(),
                  address: { ...companyProfile.address, codMunicipioIbge: ibgeInput || undefined },
                  fiscalInfo: {
                    ...companyProfile.fiscalInfo,
                    environment: ambienteInput,
                    cscId: cscIdInput || undefined,
                    nfceSeries: Number(nfceSerieInput) || 1,
                  },
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
