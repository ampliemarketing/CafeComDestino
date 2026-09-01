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
  Globe
} from 'lucide-react';
import { User } from '../../types';
import { hasPermission } from '../../lib/permissions';
import { UserFormModal } from './UserFormModal';
import { MAXLEN, sanitizeText, maskPhone, toBoundedNumber, validateImageFile } from '../../lib/validation';

interface SettingsManagementProps {
  initialTab?: 'profile' | 'users' | 'printers';
}

export const SettingsManagement: React.FC<SettingsManagementProps> = ({ initialTab = 'profile' }) => {
  const { companyProfile, setCompanyProfile, products, saveProduct, users, currentUser, addToast } = useApp();

  const [activeTab, setActiveTab] = useState<'profile' | 'users' | 'printers'>(initialTab);
  const [userModalTarget, setUserModalTarget] = useState<User | 'new' | null>(null);

  const canEditCompanyProfile = hasPermission(currentUser, 'empresa.editar_perfil');
  const canEditCompanyMedia = hasPermission(currentUser, 'empresa.editar_midia');
  const canEditBuffetPrices = hasPermission(currentUser, 'empresa.editar_precos_buffet');

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

  // Cardápio Online / Entrega State
  const [deliveryFeeInput, setDeliveryFeeInput] = useState<number>(companyProfile.deliveryFee ?? 0);
  const [minOrderValueInput, setMinOrderValueInput] = useState<number>(companyProfile.minOrderValue ?? 0);

  // Taxa de serviço / couvert / conferência de caixa / teto de desconto
  const [serviceFeeEnabledInput, setServiceFeeEnabledInput] = useState<boolean>(companyProfile.serviceFeeEnabled ?? false);
  const [serviceFeePercentInput, setServiceFeePercentInput] = useState<number>(companyProfile.serviceFeePercent ?? 0);
  const [couvertEnabledInput, setCouvertEnabledInput] = useState<boolean>(companyProfile.couvertEnabled ?? false);
  const [couvertValueInput, setCouvertValueInput] = useState<number>(companyProfile.couvertValue ?? 0);
  const [blindThresholdInput, setBlindThresholdInput] = useState<number>(companyProfile.blindConferenceThreshold ?? 10);
  const [discCaixaInput, setDiscCaixaInput] = useState<number>(companyProfile.discountLimits?.caixa ?? 5);
  const [discGerenteInput, setDiscGerenteInput] = useState<number>(companyProfile.discountLimits?.gerente ?? 20);
  const [discFinanceiroInput, setDiscFinanceiroInput] = useState<number>(companyProfile.discountLimits?.financeiro ?? 10);

  // File upload handlers
  const readImageInto = (
    file: File,
    setter: (v: string) => void,
    successTitle: string,
    successMsg: string,
  ) => {
    const problem = validateImageFile(file);
    if (problem) {
      addToast('error', 'Imagem inválida', problem);
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        // A imagem é embutida como data URI. O banco limita a URL a 2048 chars
        // (constraint company_profile_*_url_len), então arquivo grande não cabe.
        if (reader.result.length > MAXLEN.url) {
          addToast('error', 'Imagem grande demais',
            'O arquivo não cabe no cadastro. Hospede a imagem em algum lugar e cole o link (URL) no campo, ou use um dos modelos.');
          return;
        }
        setter(reader.result);
        addToast('success', successTitle, successMsg);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readImageInto(file, setLogoUrlInput, 'Foto de Perfil Carregada', 'A nova foto de perfil foi selecionada.');
    e.target.value = '';
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readImageInto(file, setCoverUrlInput, 'Banner de Capa Carregado', 'O novo banner de fundo foi selecionado.');
    e.target.value = '';
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

              <fieldset disabled={!canEditCompanyProfile} className="space-y-3 disabled:opacity-60">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-stone-700 block mb-1">Nome do Estabelecimento *</label>
                    <input
                      type="text"
                      maxLength={MAXLEN.tradeName}
                      value={nameInput}
                      onChange={(e) => setNameInput(sanitizeText(e.target.value, MAXLEN.tradeName))}
                      className="w-full border rounded-xl p-2.5 font-bold disabled:bg-stone-100 disabled:text-stone-500"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-stone-700 block mb-1">Nome Fantasia</label>
                    <input
                      type="text"
                      maxLength={MAXLEN.tradeName}
                      value={tradeNameInput}
                      onChange={(e) => setTradeNameInput(sanitizeText(e.target.value, MAXLEN.tradeName))}
                      className="w-full border rounded-xl p-2.5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-stone-700 block mb-1">Telefone / WhatsApp</label>
                    <input
                      type="tel"
                      inputMode="tel"
                      maxLength={MAXLEN.phone}
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(maskPhone(e.target.value))}
                      className="w-full border rounded-xl p-2.5"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-stone-700 block mb-1">Endereço Completo</label>
                    <input
                      type="text"
                      maxLength={MAXLEN.address}
                      value={addressInput}
                      onChange={(e) => setAddressInput(sanitizeText(e.target.value, MAXLEN.address))}
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
              </fieldset>
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

              <fieldset disabled={!canEditCompanyMedia} className="space-y-4 disabled:opacity-60">
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
                        maxLength={MAXLEN.url}
                        value={logoUrlInput}
                        onChange={(e) => setLogoUrlInput(e.target.value.slice(0, MAXLEN.url))}
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
                      maxLength={MAXLEN.url}
                      value={coverUrlInput}
                      onChange={(e) => setCoverUrlInput(e.target.value.slice(0, MAXLEN.url))}
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
              </fieldset>
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

              <fieldset disabled={!canEditBuffetPrices} className="grid grid-cols-1 sm:grid-cols-3 gap-3 disabled:opacity-60">
                <div>
                  <label className="font-semibold text-stone-800 block mb-1">Almoço por Quilo (R$/kg)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 font-bold text-stone-500">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={lunchPriceInput}
                      onChange={(e) => setLunchPriceInput(toBoundedNumber(e.target.value, 0, 100_000))}
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
                      onChange={(e) => setBreakfastPriceInput(toBoundedNumber(e.target.value, 0, 100_000))}
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
                      onChange={(e) => setTareInput(toBoundedNumber(e.target.value, 0, 5_000))}
                      className="w-full border border-stone-300 bg-white rounded-xl p-2.5 pr-8 font-bold text-stone-800"
                    />
                    <span className="absolute right-3 top-2.5 font-bold text-stone-500">g</span>
                  </div>
                  <p className="text-[10px] text-stone-500 mt-1">Peso a descontar na balança</p>
                </div>
              </fieldset>
            </div>

            {/* Configurações de Entrega (Cardápio Online) */}
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-800 text-white rounded-lg">
                    <Globe className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-stone-900 text-sm">Configurações de Entrega (Cardápio Online)</h4>
                </div>
              </div>

              <fieldset disabled={!canEditCompanyProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-3 disabled:opacity-60">
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Taxa de Entrega (R$)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 font-bold text-stone-500">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={deliveryFeeInput}
                      onChange={(e) => setDeliveryFeeInput(toBoundedNumber(e.target.value, 0, 100_000))}
                      className="w-full border rounded-xl p-2.5 pl-9 font-bold"
                    />
                  </div>
                  <p className="text-[10px] text-stone-500 mt-1">Cobrada nos pedidos com entrega, no Cardápio Online.</p>
                </div>

                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Pedido Mínimo (R$)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 font-bold text-stone-500">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={minOrderValueInput}
                      onChange={(e) => setMinOrderValueInput(toBoundedNumber(e.target.value, 0, 100_000))}
                      className="w-full border rounded-xl p-2.5 pl-9 font-bold"
                    />
                  </div>
                  <p className="text-[10px] text-stone-500 mt-1">Mostrado como referência no cabeçalho do cardápio.</p>
                </div>
              </fieldset>
            </div>

            {/* Taxa de serviço, couvert e regras de caixa */}
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 border-b border-stone-200 pb-2">
                <div className="p-1.5 bg-amber-800 text-white rounded-lg"><Building2 className="w-4 h-4" /></div>
                <h4 className="font-bold text-stone-900 text-sm">Taxa de Serviço, Couvert e Regras de Caixa</h4>
              </div>

              <fieldset disabled={!canEditCompanyProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-3 disabled:opacity-60 text-xs">
                <label className="flex items-center gap-2 font-semibold text-stone-700">
                  <input type="checkbox" checked={serviceFeeEnabledInput} onChange={(e) => setServiceFeeEnabledInput(e.target.checked)} />
                  Cobrar taxa de serviço nas comandas
                </label>
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Taxa de serviço (%)</label>
                  <input type="number" step="0.5" min="0" max="100" value={serviceFeePercentInput}
                    onChange={(e) => setServiceFeePercentInput(toBoundedNumber(e.target.value, 0, 100))}
                    className="w-full border rounded-xl p-2.5 font-bold" />
                </div>

                <label className="flex items-center gap-2 font-semibold text-stone-700">
                  <input type="checkbox" checked={couvertEnabledInput} onChange={(e) => setCouvertEnabledInput(e.target.checked)} />
                  Cobrar couvert nas comandas
                </label>
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Valor do couvert por comanda (R$)</label>
                  <input type="number" step="0.01" min="0" value={couvertValueInput}
                    onChange={(e) => setCouvertValueInput(toBoundedNumber(e.target.value, 0, 100_000))}
                    className="w-full border rounded-xl p-2.5 font-bold" />
                </div>

                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Diferença de fechamento que exige justificativa (R$)</label>
                  <input type="number" step="1" min="0" value={blindThresholdInput}
                    onChange={(e) => setBlindThresholdInput(toBoundedNumber(e.target.value, 0, 100_000))}
                    className="w-full border rounded-xl p-2.5 font-bold" />
                </div>
                <div />

                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Teto de desconto — Caixa (%)</label>
                  <input type="number" step="1" min="0" max="100" value={discCaixaInput}
                    onChange={(e) => setDiscCaixaInput(toBoundedNumber(e.target.value, 0, 100))}
                    className="w-full border rounded-xl p-2.5 font-bold" />
                </div>
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Teto de desconto — Gerente (%)</label>
                  <input type="number" step="1" min="0" max="100" value={discGerenteInput}
                    onChange={(e) => setDiscGerenteInput(toBoundedNumber(e.target.value, 0, 100))}
                    className="w-full border rounded-xl p-2.5 font-bold" />
                </div>
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Teto de desconto — Financeiro (%)</label>
                  <input type="number" step="1" min="0" max="100" value={discFinanceiroInput}
                    onChange={(e) => setDiscFinanceiroInput(toBoundedNumber(e.target.value, 0, 100))}
                    className="w-full border rounded-xl p-2.5 font-bold" />
                </div>
              </fieldset>
              <p className="text-[10px] text-stone-500">Descontos acima do teto do cargo exigem motivo e PIN de gerente. Admin não tem teto.</p>
            </div>

            {(canEditCompanyProfile || canEditCompanyMedia || canEditBuffetPrices) && (
            <button
              onClick={() => {
                if (logoUrlInput.length > MAXLEN.url || coverUrlInput.length > MAXLEN.url) {
                  addToast('error', 'Logo/Capa muito longa',
                    'O link da logo ou da capa passou de 2048 caracteres (provavelmente uma imagem embutida). Cole uma URL de imagem no campo e salve de novo.');
                  return;
                }
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
                  },
                  deliveryFee: deliveryFeeInput,
                  minOrderValue: minOrderValueInput,
                  serviceFeeEnabled: serviceFeeEnabledInput,
                  serviceFeePercent: serviceFeePercentInput,
                  couvertEnabled: couvertEnabledInput,
                  couvertValue: couvertValueInput,
                  blindConferenceThreshold: blindThresholdInput,
                  discountLimits: {
                    ...(companyProfile.discountLimits || {}),
                    caixa: discCaixaInput,
                    gerente: discGerenteInput,
                    financeiro: discFinanceiroInput,
                    admin: 100,
                  },
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

                addToast('success', 'Configurações Salvas', 'Perfil, foto de perfil, banner, valores por quilo e entrega atualizados!');
              }}
              className="bg-amber-800 hover:bg-amber-900 text-white px-6 py-3 rounded-xl font-bold text-xs shadow transition flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Salvar Alterações
            </button>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-4 text-xs">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-stone-900 text-sm">Usuários Cadastrados no Sistema</h3>
              {hasPermission(currentUser, 'usuarios.criar') && (
                <button
                  onClick={() => setUserModalTarget('new')}
                  className="bg-amber-800 hover:bg-amber-900 text-white px-3 py-1.5 rounded-lg font-bold text-[10px] flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Novo Usuário
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {users.map((u) => (
                <div key={u.id} className="p-3 bg-stone-50 rounded-xl border space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-stone-900">{u.name}</p>
                      <p className="text-[10px] text-stone-500">{u.email}</p>
                    </div>
                    {hasPermission(currentUser, 'usuarios.editar_permissoes') && (
                      <button
                        onClick={() => setUserModalTarget(u)}
                        className="p-1.5 rounded-lg text-stone-500 hover:text-amber-800 hover:bg-amber-50"
                        title="Editar usuário"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 border rounded-lg px-2 py-1 text-[10px] font-bold uppercase bg-white text-center">
                      {u.role}
                    </span>
                    <span
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                        u.active ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-stone-200 text-stone-600 border-stone-300'
                      }`}
                    >
                      {u.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {userModalTarget && (
          <UserFormModal
            user={userModalTarget === 'new' ? undefined : userModalTarget}
            onClose={() => setUserModalTarget(null)}
          />
        )}

        {/* Printers Tab */}
        {activeTab === 'printers' && (
          <div className="max-w-xl space-y-4 text-xs">
            <h3 className="font-bold text-stone-900 text-sm border-b pb-2">Impressão de Comprovantes e Comandas</h3>

            <div className="p-4 bg-stone-50 rounded-xl border border-dashed border-stone-300 text-center space-y-2">
              <Printer className="w-8 h-8 text-stone-400 mx-auto" />
              <p className="font-bold text-stone-800">Nenhuma impressora dedicada configurada</p>
              <p className="text-[11px] text-stone-500 leading-relaxed">
                As pré-contas, comprovantes de caixa e relatórios de fechamento são enviados
                pela <span className="font-semibold">caixa de diálogo de impressão do navegador</span>,
                que usa a impressora padrão do sistema operacional (incluindo impressoras
                térmicas 58/80&nbsp;mm instaladas via driver do Windows).
              </p>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-1.5">
              <p className="font-bold text-amber-900">Como conectar uma impressora térmica</p>
              <ol className="list-decimal list-inside text-[11px] text-amber-800 space-y-1 leading-relaxed">
                <li>Instale a impressora no Windows pelo driver do fabricante (USB ou rede/IP).</li>
                <li>Defina-a como impressora padrão ou selecione-a na janela de impressão do navegador.</li>
                <li>Nas preferências do driver, ajuste o tamanho de papel (58&nbsp;mm ou 80&nbsp;mm) e margens mínimas.</li>
              </ol>
              <p className="text-[10px] text-amber-700 pt-1">
                Impressão direta via ESC/POS (WebUSB / Web Serial) e roteamento por setor
                (cozinha, bar, caixa) dependem de um agente de impressão local e ainda não
                estão disponíveis neste ambiente.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
