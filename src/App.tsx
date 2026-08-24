import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { MobileNav } from './components/layout/MobileNav';
import { NotificationToast } from './components/common/NotificationToast';
import { SupportButton } from './components/common/SupportButton';
import { X, ChevronRight, LayoutDashboard, ShoppingBag, Smartphone, Grid2X2, ChefHat, Monitor, Wallet, Receipt, Package, Boxes, Truck, FileText, Printer, BarChart3, Building2, Users, Tags, History } from 'lucide-react';
import { hasPermission, SCREEN_ACCESS_PERMISSION } from './lib/permissions';

import { DashboardView } from './components/dashboard/DashboardView';
import { OnlineMenuCatalog } from './components/online-menu/OnlineMenuCatalog';
import { PublicOnlineMenu } from './components/online-menu/PublicOnlineMenu';
import { PdvView } from './components/pdv/PdvView';
import { WaiterApp } from './components/waiter/WaiterApp';
import { KitchenKDS } from './components/kitchen/KitchenKDS';
import { CashShiftsHistory } from './components/cashier/CashShiftsHistory';
import { CashShiftDetail } from './components/cashier/CashShiftDetail';
import { TableManagement } from './components/tables/TableManagement';
import { SalesManagement } from './components/sales/SalesManagement';
import { ProductManagement } from './components/products/ProductManagement';
import { InventoryManagement } from './components/inventory/InventoryManagement';
import { GroupManagement } from './components/groups/GroupManagement';
import { SupplierManagement } from './components/suppliers/SupplierManagement';
import { FinancialManagement } from './components/finance/FinancialManagement';
import { FiscalManagement } from './components/fiscal/FiscalManagement';
import { DeliveryManagement } from './components/delivery/DeliveryManagement';
import { ReportsView } from './components/reports/ReportsView';
import { SettingsManagement } from './components/settings/SettingsManagement';

const AppContent: React.FC = () => {
  const { activeView, setActiveView, currentUser } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Se a tela atual (ex.: o "dashboard" padrão do login) não é permitida
  // para este usuário, manda ele para a primeira tela que ele pode acessar.
  React.useEffect(() => {
    const requiredPermission = SCREEN_ACCESS_PERMISSION[activeView];
    if (requiredPermission && !hasPermission(currentUser, requiredPermission)) {
      const firstAllowed = Object.entries(SCREEN_ACCESS_PERMISSION).find(([, perm]) =>
        hasPermission(currentUser, perm)
      );
      if (firstAllowed) setActiveView(firstAllowed[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.id]);

  const renderView = () => {
    const requiredPermission = SCREEN_ACCESS_PERMISSION[activeView];
    if (requiredPermission && !hasPermission(currentUser, requiredPermission)) {
      return (
        <div className="p-8 text-center text-stone-500 text-sm">
          Você não tem permissão para acessar esta tela. Fale com um administrador.
        </div>
      );
    }

    switch (activeView) {
      case 'dashboard':
        return <DashboardView />;
      case 'online-menu':
      case 'online_menu':
        return <OnlineMenuCatalog />;
      case 'pdv':
        return <PdvView />;
      case 'waiter':
      case 'waiter_app':
        return <WaiterApp />;
      case 'kitchen':
      case 'kitchen_kds':
        return <KitchenKDS />;
      case 'cashier':
      case 'caixas':
        return <CashShiftsHistory />;
      case 'caixa-detalhe':
        return <CashShiftDetail />;
      case 'tables':
        return <TableManagement />;
      case 'sales':
        return <SalesManagement />;
      case 'products':
        return <ProductManagement />;
      case 'inventory':
        return <InventoryManagement />;
      case 'suppliers':
        return <SupplierManagement />;
      case 'groups':
        return <GroupManagement />;
      case 'finance':
      case 'financial':
        return <FinancialManagement />;
      case 'fiscal':
        return <FiscalManagement />;
      case 'deliveries':
      case 'delivery':
        return <DeliveryManagement />;
      case 'reports':
        return <ReportsView />;
      case 'settings':
      case 'company':
        return <SettingsManagement initialTab="profile" />;
      case 'users':
        return <SettingsManagement initialTab="users" />;
      case 'printers':
        return <SettingsManagement initialTab="printers" />;
      default:
        return <DashboardView />;
    }
  };

  const mobileMenuSections = [
    {
      title: 'ATENDIMENTO & VENDAS',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'online-menu', label: 'Cardápio Online', icon: ShoppingBag },
        { id: 'waiter', label: 'App do Garçom', icon: Smartphone },
        { id: 'tables', label: 'Mesas & Comandas', icon: Grid2X2 },
        { id: 'kitchen', label: 'Painel Cozinha (KDS)', icon: ChefHat },
        { id: 'pdv', label: 'PDV / Frente de Caixa', icon: Monitor },
        { id: 'caixas', label: 'Caixas', icon: History },
        { id: 'sales', label: 'Gestão de Vendas', icon: Receipt },
      ]
    },
    {
      title: 'ESTOQUE & OPERAÇÕES',
      items: [
        { id: 'products', label: 'Produtos', icon: Package },
        { id: 'inventory', label: 'Gestão de Estoque', icon: Boxes },
        { id: 'groups', label: 'Grupos', icon: Tags },
        { id: 'suppliers', label: 'Fornecedores', icon: Truck },
        { id: 'deliveries', label: 'Gestão de Entregas', icon: Truck },
        { id: 'fiscal', label: 'Emissão Fiscal NFC-e', icon: FileText },
        { id: 'finance', label: 'Financeiro', icon: Wallet },
        { id: 'reports', label: 'Relatórios', icon: BarChart3 },
        { id: 'company', label: 'Perfil do Restaurante', icon: Building2 },
        { id: 'users', label: 'Usuários & Equipe', icon: Users },
        { id: 'printers', label: 'Impressoras Térmicas', icon: Printer },
      ]
    }
  ]
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => hasPermission(currentUser, SCREEN_ACCESS_PERMISSION[item.id])),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="min-h-screen bg-[#F6F1EA] text-stone-900 flex flex-col font-sans selection:bg-amber-800 selection:text-white">
      <Navbar />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
        
        <main className="flex-1 overflow-y-auto pb-20 md:pb-8">
          {renderView()}
        </main>
      </div>

      <MobileNav onOpenFullMenu={() => setIsMobileMenuOpen(true)} />
      <NotificationToast />
      <SupportButton />

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-sm md:hidden flex justify-end">
          <div className="w-4/5 max-w-xs bg-stone-900 h-full p-4 flex flex-col justify-between overflow-y-auto border-l border-stone-800 text-stone-100">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-stone-800 mb-4">
                <h3 className="font-bold text-sm tracking-wide text-amber-200 uppercase">Menu de Navegação</h3>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 rounded-xl bg-stone-800 text-stone-300 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                {mobileMenuSections.map((sec, idx) => (
                  <div key={idx}>
                    <p className="text-[10px] font-bold tracking-wider text-stone-500 uppercase mb-2">
                      {sec.title}
                    </p>
                    <div className="space-y-1">
                      {sec.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeView === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              setActiveView(item.id);
                              setIsMobileMenuOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-medium transition ${
                              isActive
                                ? 'bg-amber-800 text-white font-bold'
                                : 'text-stone-300 hover:bg-stone-800'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <Icon className="w-4 h-4 text-amber-400 shrink-0" />
                              <span>{item.label}</span>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-stone-500" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-stone-800 text-center text-[10px] text-stone-500">
              CAFÉ COM DESTINO - v2.0
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  // /pedir é o cardápio público (cliente convidado, sem login) — roda fora
  // do AppProvider de propósito, pra não depender de sessão de funcionário
  // nem tocar na tabela profiles usada pelo login interno.
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/pedir')) {
    return <PublicOnlineMenu />;
  }

  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
