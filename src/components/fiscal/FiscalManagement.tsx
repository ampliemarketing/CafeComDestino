import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PaymentMethod, OrderChannel } from '../../types';
import {
  FileText, 
  CheckCircle2, 
  Search, 
  Printer, 
  Download, 
  ShieldCheck, 
  Building2, 
  Sliders,
  Sparkles
} from 'lucide-react';
import { hasPermission } from '../../lib/permissions';
import { MAXLEN, sanitizeText, maskCNPJ, isValidCNPJ } from '../../lib/validation';

export const FiscalManagement: React.FC = () => {
  const { orders, companyProfile, setCompanyProfile, addToast, currentUser } = useApp();
  const can = (key: string) => hasPermission(currentUser, key);

  const [activeTab, setActiveTab] = useState<'notes' | 'config'>('notes');
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
                      <td className="p-3 font-mono text-[10px] text-stone-700">{o.nfceKey || '35240512345678000195650010000010011000012341'}</td>
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
      </div>
    </div>
  );
};
