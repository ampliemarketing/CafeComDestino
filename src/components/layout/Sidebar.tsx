import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Smartphone, 
  Grid2X2, 
  ChefHat, 
  Monitor, 
  Wallet, 
  Receipt, 
  Package, 
  Boxes, 
  Truck, 
  FileText, 
  Printer, 
  BarChart3, 
  Building2, 
  Users, 
  ChevronLeft, 
  ChevronRight,
  Sparkles
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, setCollapsed }) => {
  const { activeView, setActiveView, currentUser } = useApp();

  const menuSections = [
    {
      title: 'INÍCIO',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'gerente', 'financeiro'] },
      ]
    },
    {
      title: 'ATENDIMENTO & VENDAS',
      items: [
        { id: 'online-menu', label: 'Cardápio Online', icon: ShoppingBag, roles: ['admin', 'gerente', 'caixa', 'garcom'] },
        { id: 'waiter', label: 'App do Garçom', icon: Smartphone, roles: ['admin', 'gerente', 'garcom'] },
        { id: 'tables', label: 'Mesas & Comandas', icon: Grid2X2, roles: ['admin', 'gerente', 'caixa', 'garcom'] },
        { id: 'kitchen', label: 'Painel da Cozinha (KDS)', icon: ChefHat, roles: ['admin', 'gerente', 'cozinha'] },
        { id: 'pdv', label: 'PDV / Frente de Caixa', icon: Monitor, roles: ['admin', 'gerente', 'caixa'] },
        { id: 'cashier', label: 'Controle de Caixa', icon: Wallet, roles: ['admin', 'gerente', 'caixa', 'financeiro'] },
        { id: 'sales', label: 'Gestão de Vendas', icon: Receipt, roles: ['admin', 'gerente', 'caixa', 'financeiro'] },
      ]
    },
    {
      title: 'PRODUTOS & ESTOQUE',
      items: [
        { id: 'products', label: 'Produtos & Ficha Técnica', icon: Package, roles: ['admin', 'gerente', 'estoque'] },
        { id: 'inventory', label: 'Gestão de Estoque', icon: Boxes, roles: ['admin', 'gerente', 'estoque'] },
        { id: 'suppliers', label: 'Fornecedores', icon: Truck, roles: ['admin', 'gerente', 'estoque'] },
      ]
    },
    {
      title: 'OPERACIONAL & GESTÃO',
      items: [
        { id: 'deliveries', label: 'Gestão de Entregas', icon: Truck, roles: ['admin', 'gerente', 'caixa'] },
        { id: 'fiscal', label: 'Emissão Fiscal NFC-e', icon: FileText, roles: ['admin', 'gerente', 'caixa', 'financeiro'] },
        { id: 'printers', label: 'Impressoras Térmicas', icon: Printer, roles: ['admin', 'gerente'] },
        { id: 'reports', label: 'Relatórios Gerenciais', icon: BarChart3, roles: ['admin', 'gerente', 'financeiro'] },
        { id: 'company', label: 'Perfil da Empresa', icon: Building2, roles: ['admin'] },
        { id: 'users', label: 'Usuários & Permissões', icon: Users, roles: ['admin'] },
      ]
    }
  ];

  return (
    <aside
      className={`bg-stone-900 text-stone-300 border-r border-stone-800 transition-all duration-300 shrink-0 flex flex-col justify-between hidden md:flex ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="py-3 px-2 overflow-y-auto flex-1 custom-scrollbar">
        {menuSections.map((section, idx) => {
          // Filter items based on active role
          const allowedItems = section.items.filter(
            (item) => currentUser.role === 'admin' || item.roles.includes(currentUser.role)
          );

          if (allowedItems.length === 0) return null;

          return (
            <div key={idx} className="mb-4">
              {!collapsed && (
                <div className="px-3 mb-1 text-[10px] font-bold tracking-wider text-stone-500 uppercase">
                  {section.title}
                </div>
              )}
              <div className="space-y-1">
                {allowedItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeView === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveView(item.id)}
                      title={collapsed ? item.label : undefined}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition font-medium text-xs ${
                        isActive
                          ? 'bg-amber-800 text-white shadow-sm font-semibold'
                          : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/80'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-200' : 'text-stone-400'}`} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Collapse Button */}
      <div className="p-2 border-t border-stone-800">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>
    </aside>
  );
};
