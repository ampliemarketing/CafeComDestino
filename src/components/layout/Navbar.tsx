import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  UtensilsCrossed, 
  UserCheck, 
  Store, 
  Bell, 
  ExternalLink, 
  ChevronDown, 
  ChefHat, 
  Coffee,
  Monitor, 
  Smartphone, 
  Search, 
  SlidersHorizontal,
  Power
} from 'lucide-react';
import { UserRole } from '../../types';

export const Navbar: React.FC = () => {
  const { 
    companyProfile, 
    setCompanyProfile, 
    currentUser, 
    setCurrentUser, 
    users, 
    orders, 
    setActiveView, 
    activeView,
    addToast
  } = useApp();

  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const isStoreOpen = companyProfile.operatingHours !== 'Fechado';

  const toggleStoreStatus = () => {
    const newStatus = isStoreOpen ? 'Fechado' : 'Terça a Domingo - 11:30 às 23:30';
    setCompanyProfile((prev) => ({
      ...prev,
      operatingHours: newStatus,
    }));
    addToast('info', 'Status da Loja Alterado', isStoreOpen ? 'Restaurante marcado como FECHADO' : 'Restaurante ABERTO para pedidos');
  };

  const handleRoleChange = (role: UserRole) => {
    const foundUser = users.find((u) => u.role === role) || {
      id: 'usr-' + role,
      name: `Usuário ${role.toUpperCase()}`,
      email: `${role}@cafecomdestino.com`,
      role,
      active: true,
    };
    setCurrentUser(foundUser);
    setIsRoleDropdownOpen(false);
    addToast('success', 'Perfil Alterado', `Agora você está navegando como ${role.toUpperCase()}`);
  };

  const pendingOrdersCount = orders.filter((o) => o.orderStatus === 'novo' || o.orderStatus === 'em_preparo').length;

  return (
    <header className="bg-stone-900 text-stone-100 border-b border-stone-800 sticky top-0 z-40 px-4 py-2.5 flex items-center justify-between shadow-md">
      {/* Brand & Store Status */}
      <div className="flex items-center gap-3">
        <div 
          onClick={() => setActiveView('dashboard')} 
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-700/80 border border-amber-600/50 flex items-center justify-center text-white shadow-sm group-hover:bg-amber-700 transition">
            <Coffee className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-base tracking-wide text-amber-100">{companyProfile.name || 'CAFÉ COM DESTINO'}</h1>
              <span className="text-[10px] bg-amber-900/60 text-amber-300 font-semibold px-1.5 py-0.5 rounded border border-amber-800">
                PRO
              </span>
            </div>
            <p className="text-[10px] text-stone-400 hidden sm:block">
              {companyProfile.tradeName || 'Cafeteria & Gastronomia'}
            </p>
          </div>
        </div>

        {/* Store Open/Closed Toggle */}
        <div className="hidden md:flex items-center gap-2 pl-4 border-l border-stone-800">
          <button
            onClick={toggleStoreStatus}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
              isStoreOpen
                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800 hover:bg-emerald-900/80'
                : 'bg-rose-950/60 text-rose-400 border-rose-800 hover:bg-rose-900/80'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{isStoreOpen ? 'Restaurante Aberto' : 'Restaurante Fechado'}</span>
          </button>
        </div>
      </div>

      {/* Center Quick View Launchers */}
      <div className="hidden lg:flex items-center gap-1.5 bg-stone-800/80 p-1 rounded-xl border border-stone-700/60 text-xs">
        <button
          onClick={() => setActiveView('waiter')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition font-medium ${
            activeView === 'waiter' ? 'bg-amber-700 text-white shadow-sm' : 'text-stone-300 hover:text-white'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>App Garçom</span>
        </button>
        <button
          onClick={() => setActiveView('kitchen')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition font-medium ${
            activeView === 'kitchen' ? 'bg-amber-700 text-white shadow-sm' : 'text-stone-300 hover:text-white'
          }`}
        >
          <UtensilsCrossed className="w-3.5 h-3.5" />
          <span>Painel Cozinha</span>
        </button>
        <button
          onClick={() => setActiveView('pdv')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition font-medium ${
            activeView === 'pdv' ? 'bg-amber-700 text-white shadow-sm' : 'text-stone-300 hover:text-white'
          }`}
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>PDV / Frente</span>
        </button>
        <button
          onClick={() => setActiveView('online-menu')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition font-medium ${
            activeView === 'online-menu' ? 'bg-emerald-700 text-white shadow-sm' : 'text-stone-300 hover:text-white'
          }`}
        >
          <Store className="w-3.5 h-3.5" />
          <span>Cardápio Cliente</span>
          <ExternalLink className="w-3 h-3 opacity-70" />
        </button>
      </div>

      {/* Right Controls: Role Switcher & User Profile */}
      <div className="flex items-center gap-2.5">
        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="p-2 rounded-xl bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700 border border-stone-700 transition relative"
            title="Notificações"
          >
            <Bell className="w-4 h-4" />
            {pendingOrdersCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-stone-950 font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                {pendingOrdersCount}
              </span>
            )}
          </button>

          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-stone-800 text-stone-100 rounded-xl shadow-2xl border border-stone-700 p-3 z-50 text-xs">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-700">
                <span className="font-semibold text-stone-200">Alertas Operacionais</span>
                <span className="text-[10px] bg-amber-900/50 text-amber-300 px-1.5 py-0.5 rounded">
                  {pendingOrdersCount} em andamento
                </span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {orders.slice(0, 4).map((o) => (
                  <div key={o.id} className="p-2 rounded-lg bg-stone-900/80 border border-stone-700/60 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-stone-200">Pedido #{o.orderNumber} ({o.channel.toUpperCase()})</p>
                      <p className="text-[10px] text-stone-400">{o.customer.name} - R$ {o.total.toFixed(2)}</p>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-200">
                      {o.orderStatus}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Role Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
            className="flex items-center gap-2 bg-stone-800 hover:bg-stone-700 border border-stone-700 px-3 py-1.5 rounded-xl transition text-left"
          >
            <div className="w-7 h-7 rounded-lg bg-amber-800 text-amber-200 font-bold text-xs flex items-center justify-center">
              {currentUser.name.charAt(0)}
            </div>
            <div className="hidden sm:block">
              <p className="font-semibold text-xs text-stone-100">{currentUser.name}</p>
              <p className="text-[10px] text-amber-400 uppercase tracking-wider font-mono">
                {currentUser.role}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
          </button>

          {isRoleDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-stone-800 text-stone-100 rounded-xl shadow-2xl border border-stone-700 p-2 z-50 text-xs">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase text-stone-400 tracking-wider">
                Alternar Perfil de Acesso
              </div>
              <div className="space-y-0.5">
                {[
                  { role: 'admin' as UserRole, label: 'Administrador (Geral)' },
                  { role: 'gerente' as UserRole, label: 'Gerente da Operação' },
                  { role: 'caixa' as UserRole, label: 'Caixa / PDV' },
                  { role: 'garcom' as UserRole, label: 'Garçom (Atendimento)' },
                  { role: 'cozinha' as UserRole, label: 'Cozinha (KDS)' },
                  { role: 'estoque' as UserRole, label: 'Estoque / Compras' },
                  { role: 'financeiro' as UserRole, label: 'Financeiro' },
                ].map((item) => (
                  <button
                    key={item.role}
                    onClick={() => handleRoleChange(item.role)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition flex items-center justify-between ${
                      currentUser.role === item.role
                        ? 'bg-amber-800/80 text-white font-semibold'
                        : 'hover:bg-stone-700 text-stone-300'
                    }`}
                  >
                    <span>{item.label}</span>
                    {currentUser.role === item.role && <UserCheck className="w-3.5 h-3.5 text-amber-300" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
