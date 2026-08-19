import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
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

export const FiscalManagement: React.FC = () => {
  const { orders, companyProfile, setCompanyProfile, addToast } = useApp();

  const [activeTab, setActiveTab] = useState<'notes' | 'config'>('notes');
  const [searchQuery, setSearchQuery] = useState('');

  // Config Form
  const [cnpjInput, setCnpjInput] = useState(companyProfile.cnpj);
  const [ieInput, setIeInput] = useState(companyProfile.ie);
  const [razaoSocialInput, setRazaoSocialInput] = useState(companyProfile.name);

  const fiscalOrders = orders.filter((o) => o.fiscalIssued);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
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
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Buscar nota por chave Sefaz ou cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border rounded-xl pl-10 pr-4 py-2 text-xs"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-stone-100 text-stone-600 uppercase font-bold border-b">
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
                  {fiscalOrders.map((o) => (
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
                            className="p-1.5 text-stone-600 hover:text-stone-900 border rounded-lg"
                            title="Baixar XML"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Company Config Tab */}
        {activeTab === 'config' && (
          <div className="max-w-xl space-y-4 text-xs">
            <h3 className="font-bold text-stone-900 text-sm border-b pb-2">Configuração Fiscal da Empresa</h3>

            <div className="space-y-3">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Razão Social Emitente</label>
                <input
                  type="text"
                  value={razaoSocialInput}
                  onChange={(e) => setRazaoSocialInput(e.target.value)}
                  className="w-full border rounded-xl p-2.5 font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">CNPJ</label>
                <input
                  type="text"
                  value={cnpjInput}
                  onChange={(e) => setCnpjInput(e.target.value)}
                  className="w-full border rounded-xl p-2.5 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Inscrição Estadual (IE)</label>
                <input
                  type="text"
                  value={ieInput}
                  onChange={(e) => setIeInput(e.target.value)}
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
            </div>

            <button
              onClick={() => {
                setCompanyProfile({
                  ...companyProfile,
                  name: razaoSocialInput,
                  cnpj: cnpjInput,
                  ie: ieInput,
                });
                addToast('success', 'Dados fiscais salvos');
              }}
              className="bg-amber-800 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow"
            >
              Salvar Dados Fiscais
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
