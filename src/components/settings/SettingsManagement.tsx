import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Settings, 
  Users, 
  Building2, 
  Printer, 
  ShieldCheck, 
  Plus, 
  CheckCircle2, 
  Edit2, 
  Trash2,
  Sparkles,
  Upload,
  Image,
  Camera,
  Globe,
  KeyRound
} from 'lucide-react';
import { UserRole } from '../../types';

interface SettingsManagementProps {
  initialTab?: 'profile' | 'users' | 'printers';
}

export const SettingsManagement: React.FC<SettingsManagementProps> = ({ initialTab = 'profile' }) => {
  const { companyProfile, setCompanyProfile, products, saveProduct, users, updateUserProfile, currentUser, addToast } = useApp();

  const [activeTab, setActiveTab] = useState<'profile' | 'users' | 'printers'>(initialTab);
  const [pinDrafts, setPinDrafts] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Company Profile Form State
  const [nameInput, setNameInput] = useState(companyProfile.name);
  const [tradeNameInput, setTradeNameInput] = useState(companyProfile.tradeName);
  const [phoneInput, setPhoneInput] = useState(companyProfile.phone);
  const [addressInput, setAddressInput] = useState(companyProfile.address.street + ', ' + companyProfile.address.number);
  const [primaryColorInput, setPrimaryColorInput] = useState(companyProfile.primaryColor || '#92400e');

  // Media / Cardápio Online State
  const [logoUrlInput, setLogoUrlInput] = useState(companyProfile.logoUrl || '');
  const [coverUrlInput, setCoverUrlInput] = useState(companyProfile.coverUrl || '');

  // Buffet / Quilo State
  const [lunchPriceInput, setLunchPriceInput] = useState<number>(companyProfile.buffetPrices?.lunchPricePerKg ?? 80.00);
  const [breakfastPriceInput, setBreakfastPriceInput] = useState<number>(companyProfile.buffetPrices?.breakfastPricePerKg ?? 54.99);
  const [tareInput, setTareInput] = useState<number>(companyProfile.buffetPrices?.plateTareGrams ?? 200);

  // File upload handlers
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setLogoUrlInput(reader.result);
          addToast('success', 'Foto de Perfil Carregada', 'A nova foto de perfil foi selecionada.');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setCoverUrlInput(reader.result);
          addToast('success', 'Banner de Capa Carregado', 'O novo banner de fundo foi selecionado.');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-stone-900 text-stone-100 p-5 rounded-2xl border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-800 text-white font-bold flex items-center justify-center shadow">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Configurações & Administração</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Personalize a identidade do restaurante, impressoras térmicas e gestão de equipe.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-4">
        <div className="flex gap-2 border-b pb-3 text-xs font-bold">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === 'profile' ? 'bg-amber-800 text-white' : 'bg-stone-100 text-stone-700'
            }`}
          >
            Perfil do Restaurante
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === 'users' ? 'bg-amber-800 text-white' : 'bg-stone-100 text-stone-700'
            }`}
          >
            Gestão de Equipe & Usuários
          </button>
          <button
            onClick={() => setActiveTab('printers')}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === 'printers' ? 'bg-amber-800 text-white' : 'bg-stone-100 text-stone-700'
            }`}
          >
            Impressoras Térmicas
          </button>
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="max-w-2xl space-y-6 text-xs">
            <div>
              <h3 className="font-bold text-stone-900 text-sm border-b pb-2 mb-3">Identidade Visual & Dados Gerais</h3>

              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-stone-700 block mb-1">Nome do Estabelecimento *</label>
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="w-full border rounded-xl p-2.5 font-bold"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-stone-700 block mb-1">Nome Fantasia</label>
                    <input
                      type="text"
                      value={tradeNameInput}
                      onChange={(e) => setTradeNameInput(e.target.value)}
                      className="w-full border rounded-xl p-2.5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-stone-700 block mb-1">Telefone / WhatsApp</label>
                    <input
                      type="text"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      className="w-full border rounded-xl p-2.5"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-stone-700 block mb-1">Endereço Completo</label>
                    <input
                      type="text"
                      value={addressInput}
                      onChange={(e) => setAddressInput(e.target.value)}
                      className="w-full border rounded-xl p-2.5"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Cor Primária do Tema</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={primaryColorInput}
                      onChange={(e) => setPrimaryColorInput(e.target.value)}
                      className="w-10 h-10 rounded-xl cursor-pointer border p-1"
                    />
                    <span className="font-mono text-stone-700">{primaryColorInput}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Fotos de Perfil e Banner de Capa do Cardápio Online */}
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-800 text-white rounded-lg">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900 text-sm">Foto de Perfil & Banner de Fundo (Cardápio Online)</h4>
                    <p className="text-[11px] text-stone-500">Aparecem no topo do seu catálogo e do aplicativo do cliente</p>
                  </div>
                </div>
              </div>

              {/* Logo / Foto de Perfil */}
              <div className="space-y-2">
                <label className="font-bold text-stone-800 block">1. Foto de Perfil / Logomarca da Empresa:</label>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white p-3 rounded-xl border border-stone-200">
                  <div className="relative group shrink-0">
                    <img
                      src={logoUrlInput || 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=300&q=80'}
                      alt="Logo do Restaurante"
                      className="w-20 h-20 rounded-2xl object-cover border-2 border-amber-800/40 shadow-sm"
                    />
                    <label className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition rounded-2xl flex items-center justify-center cursor-pointer">
                      <Upload className="w-5 h-5" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="space-y-2 flex-1 w-full">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={logoUrlInput}
                        onChange={(e) => setLogoUrlInput(e.target.value)}
                        placeholder="Link da imagem (URL) ou escolha um arquivo..."
                        className="w-full border rounded-xl p-2 font-mono text-[11px]"
                      />
                      <label className="px-3 py-2 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-xl cursor-pointer font-bold text-stone-700 flex items-center gap-1.5 shrink-0 transition">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Arquivo</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {/* Presets for Logo */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-stone-400 font-semibold">Sugestões:</span>
                      {[
                        { label: 'Café & Coa', url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=300&q=80' },
                        { label: 'Gourmet', url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=300&q=80' },
                        { label: 'Buffet', url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&q=80' },
                      ].map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setLogoUrlInput(preset.url)}
                          className="px-2 py-0.5 bg-stone-100 hover:bg-amber-100 hover:text-amber-900 rounded-md text-[10px] text-stone-600 border transition font-medium"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Banner de Capa */}
              <div className="space-y-2">
                <label className="font-bold text-stone-800 block">2. Banner de Fundo / Capa do Cardápio:</label>
                <div className="bg-white p-3 rounded-xl border border-stone-200 space-y-3">
                  <div className="relative h-28 w-full rounded-xl overflow-hidden bg-stone-900 border">
                    <img
                      src={coverUrlInput || 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=1200&q=80'}
                      alt="Capa do Restaurante"
                      className="w-full h-full object-cover opacity-75"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-3">
                      <span className="text-white font-bold text-xs flex items-center gap-1.5">
                        <Image className="w-4 h-4 text-amber-400" />
                        Pré-visualização da Capa do Cardápio
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={coverUrlInput}
                      onChange={(e) => setCoverUrlInput(e.target.value)}
                      placeholder="Link do banner de capa (URL)..."
                      className="w-full border rounded-xl p-2 font-mono text-[11px]"
                    />
                    <label className="px-3 py-2 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-xl cursor-pointer font-bold text-stone-700 flex items-center gap-1.5 shrink-0 transition">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Arquivo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCoverUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Presets for Cover */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-stone-400 font-semibold">Galeria de Capas:</span>
                    {[
                      { label: 'Cafeteria Aconchegante', url: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=1200&q=80' },
                      { label: 'Buffet & Saladas', url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80' },
                      { label: 'Churrasco & Grelhados', url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80' },
                      { label: 'Bistrô Elegante', url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80' },
                    ].map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCoverUrlInput(preset.url)}
                        className="px-2 py-1 bg-stone-100 hover:bg-amber-100 hover:text-amber-900 rounded-lg text-[10px] text-stone-700 border transition font-medium"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Valores de Comida por Quilo (Buffet / Balança) */}
            <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-800 text-white rounded-lg">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-stone-900 text-sm">Valores da Comida por Quilo (Buffet)</h4>
                </div>
                <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full border border-amber-300">
                  Valores Globais
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-stone-800 block mb-1">Almoço por Quilo (R$/kg)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 font-bold text-stone-500">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={lunchPriceInput}
                      onChange={(e) => setLunchPriceInput(parseFloat(e.target.value) || 0)}
                      className="w-full border border-amber-300 bg-white rounded-xl p-2.5 pl-9 font-bold text-amber-900"
                    />
                  </div>
                  <p className="text-[10px] text-stone-500 mt-1">Preço padrão: R$ 80,00</p>
                </div>

                <div>
                  <label className="font-semibold text-stone-800 block mb-1">Café da Manhã por Quilo (R$/kg)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 font-bold text-stone-500">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={breakfastPriceInput}
                      onChange={(e) => setBreakfastPriceInput(parseFloat(e.target.value) || 0)}
                      className="w-full border border-amber-300 bg-white rounded-xl p-2.5 pl-9 font-bold text-amber-900"
                    />
                  </div>
                  <p className="text-[10px] text-stone-500 mt-1">Preço padrão: R$ 54,99</p>
                </div>

                <div>
                  <label className="font-semibold text-stone-800 block mb-1">Tara Padrão do Prato (g)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="5"
                      value={tareInput}
                      onChange={(e) => setTareInput(parseFloat(e.target.value) || 0)}
                      className="w-full border border-stone-300 bg-white rounded-xl p-2.5 pr-8 font-bold text-stone-800"
                    />
                    <span className="absolute right-3 top-2.5 font-bold text-stone-500">g</span>
                  </div>
                  <p className="text-[10px] text-stone-500 mt-1">Peso a descontar na balança</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                const updatedProfile = {
                  ...companyProfile,
                  name: nameInput,
                  tradeName: tradeNameInput,
                  phone: phoneInput,
                  primaryColor: primaryColorInput,
                  logoUrl: logoUrlInput,
                  coverUrl: coverUrlInput,
                  buffetPrices: {
                    lunchPricePerKg: lunchPriceInput,
                    breakfastPricePerKg: breakfastPriceInput,
                    plateTareGrams: tareInput,
                  }
                };
                setCompanyProfile(updatedProfile);

                // Also update matching products in catalog
                products.forEach((p) => {
                  if (p.id === 'prod-kg-almoco' || p.name.toLowerCase().includes('almoço por quilo')) {
                    saveProduct({ ...p, price: lunchPriceInput, name: `Almoço Por Quilo (R$ ${lunchPriceInput.toFixed(2).replace('.', ',')}/kg)` });
                  }
                  if (p.id === 'prod-kg-cafe' || p.name.toLowerCase().includes('café da manhã por quilo')) {
                    saveProduct({ ...p, price: breakfastPriceInput, name: `Café da Manhã Por Quilo (R$ ${breakfastPriceInput.toFixed(2).replace('.', ',')}/kg)` });
                  }
                });

                addToast('success', 'Configurações Salvas', 'Perfil, foto de perfil, banner e valores por quilo atualizados!');
              }}
              className="bg-amber-800 hover:bg-amber-900 text-white px-6 py-3 rounded-xl font-bold text-xs shadow transition flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Salvar Alterações
            </button>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-4 text-xs">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-stone-900 text-sm">Usuários Cadastrados no Sistema</h3>
              <p className="text-[10px] text-stone-500">Novos funcionários criam a própria conta na tela de login ("Criar conta").</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {users.map((u) => (
                <div key={u.id} className="p-3 bg-stone-50 rounded-xl border space-y-2">
                  <div>
                    <p className="font-bold text-stone-900">{u.name}</p>
                    <p className="text-[10px] text-stone-500">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={u.role}
                      onChange={(e) => updateUserProfile(u.id, { role: e.target.value as UserRole })}
                      disabled={u.id === currentUser.id}
                      className="flex-1 border rounded-lg px-2 py-1 text-[10px] font-bold uppercase disabled:opacity-50"
                    >
                      {(['admin', 'gerente', 'caixa', 'garcom', 'cozinha', 'estoque', 'financeiro'] as UserRole[]).map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => updateUserProfile(u.id, { active: !u.active })}
                      disabled={u.id === currentUser.id}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border disabled:opacity-50 ${
                        u.active ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-stone-200 text-stone-600 border-stone-300'
                      }`}
                    >
                      {u.active ? 'Ativo' : 'Inativo'}
                    </button>
                  </div>

                  {currentUser.role === 'admin' && (
                    <div>
                      <label className="text-[10px] font-bold text-stone-500 uppercase flex items-center gap-1 mb-1">
                        <KeyRound className="w-3 h-3" /> PIN de Fechamento de Caixa
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="Sem PIN"
                          value={pinDrafts[u.id] ?? u.code ?? ''}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, '');
                            setPinDrafts((prev) => ({ ...prev, [u.id]: digits }));
                          }}
                          className="flex-1 border rounded-lg px-2 py-1 text-[10px] font-mono tracking-widest"
                        />
                        <button
                          onClick={() => {
                            const value = (pinDrafts[u.id] ?? u.code ?? '').trim();
                            updateUserProfile(u.id, { code: value });
                            setPinDrafts((prev) => {
                              const next = { ...prev };
                              delete next[u.id];
                              return next;
                            });
                          }}
                          disabled={(pinDrafts[u.id] ?? u.code ?? '') === (u.code ?? '')}
                          className="px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-800 text-white disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Printers Tab */}
        {activeTab === 'printers' && (
          <div className="max-w-xl space-y-4 text-xs">
            <h3 className="font-bold text-stone-900 text-sm border-b pb-2">Configuração de Impressoras Térmicas</h3>

            <div className="space-y-3">
              <div className="p-3 bg-stone-50 rounded-xl border flex items-center justify-between">
                <div>
                  <p className="font-bold text-stone-900">Impressora da Cozinha (KDS / Comandas)</p>
                  <p className="text-[10px] text-stone-500">Impressora Térmica 80mm - IP: 192.168.1.200</p>
                </div>
                <span className="text-emerald-700 font-bold">Conectada ✅</span>
              </div>

              <div className="p-3 bg-stone-50 rounded-xl border flex items-center justify-between">
                <div>
                  <p className="font-bold text-stone-900">Impressora do Bar / Bebidas</p>
                  <p className="text-[10px] text-stone-500">Impressora Térmica 58mm - USB</p>
                </div>
                <span className="text-emerald-700 font-bold">Conectada ✅</span>
              </div>

              <div className="p-3 bg-stone-50 rounded-xl border flex items-center justify-between">
                <div>
                  <p className="font-bold text-stone-900">Impressora do Caixa (Pré-conta e NFC-e)</p>
                  <p className="text-[10px] text-stone-500">Bematech MP-4200 TH 80mm</p>
                </div>
                <span className="text-emerald-700 font-bold">Conectada ✅</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
