import React from 'react';
import { useApp } from '../../context/AppContext';
import { hasPermission, SCREEN_ACCESS_PERMISSION } from '../../lib/permissions';
import {
  LayoutDashboard, 
  ShoppingBag, 
  Smartphone, 
  Grid2X2, 
  ChefHat, 
  Monitor,
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
  Sparkles,
  Tags,
  History,
  BookOpen,
  ShieldCheck
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
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      ]
    },
    {
      title: 'ATENDIMENTO & VENDAS',
      items: [
        { id: 'online-menu', label: 'Cardápio Online', icon: ShoppingBag },
        { id: 'waiter', label: 'App do Garçom', icon: Smartphone },
        { id: 'tables', label: 'Mesas & Comandas', icon: Grid2X2 },
        { id: 'kitchen', label: 'Painel da Cozinha (KDS)', icon: ChefHat },
        { id: 'pdv', label: 'PDV / Frente de Caixa', icon: Monitor },
        { id: 'caixas', label: 'Caixas', icon: History },
        { id: 'livro-caixa', label: 'Livro-Caixa', icon: BookOpen },
        { id: 'sales', label: 'Gestão de Vendas', icon: Receipt },
      ]
    },
    {
      title: 'PRODUTOS & ESTOQUE',
      items: [
        { id: 'products', label: 'Produtos', icon: Package },
        { id: 'inventory', label: 'Gestão de Estoque', icon: Boxes },
        { id: 'groups', label: 'Grupos', icon: Tags },
        { id: 'suppliers', label: 'Fornecedores', icon: Truck },
      ]
    },
    {
      title: 'OPERACIONAL & GESTÃO',
      items: [
        { id: 'deliveries', label: 'Gestão de Entregas', icon: Truck },
        { id: 'fiscal', label: 'Emissão Fiscal NFC-e', icon: FileText },
        { id: 'printers', label: 'Impressoras Térmicas', icon: Printer },
        { id: 'reports', label: 'Relatórios Gerenciais', icon: BarChart3 },
        { id: 'company', label: 'Perfil da Empresa', icon: Building2 },
        { id: 'users', label: 'Usuários & Permissões', icon: Users },
        { id: 'audit', label: 'Auditoria', icon: ShieldCheck },
      ]
    }
  ];

  return (
    <aside
      className={`bg-stone-900 text-stone-300 border-r border-stone-800 transition-all duration-300 shrink-0 flex flex-col hidden md:flex ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="py-3 px-2 overflow-y-auto flex-1 custom-scrollbar">
        {menuSections.map((section, idx) => {
          // Filter items based on the user's permissions
          const allowedItems = section.items.filter((item) =>
            hasPermission(currentUser, SCREEN_ACCESS_PERMISSION[item.id])
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

        {/* Collapse Button — logo abaixo do último item do menu (Usuários & Permissões) */}
        <div className="p-2 border-t border-stone-800">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition"
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </aside>
  );
};
