import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Smartphone,
  Monitor,
  ChefHat,
  LayoutDashboard,
  ShoppingBag,
  Menu
} from 'lucide-react';
import { hasPermission, SCREEN_ACCESS_PERMISSION } from '../../lib/permissions';

export const MobileNav: React.FC<{ onOpenFullMenu: () => void }> = ({ onOpenFullMenu }) => {
  const { activeView, setActiveView, currentUser } = useApp();

  const navItems = [
    { id: 'waiter', label: 'Garçom', icon: Smartphone },
    { id: 'pdv', label: 'PDV', icon: Monitor },
    { id: 'kitchen', label: 'Cozinha', icon: ChefHat },
    { id: 'dashboard', label: 'Início', icon: LayoutDashboard },
    { id: 'online-menu', label: 'Cardápio', icon: ShoppingBag },
  ].filter((item) => hasPermission(currentUser, SCREEN_ACCESS_PERMISSION[item.id]));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-stone-900 border-t border-stone-800 text-stone-300 md:hidden flex items-center justify-around py-1.5 px-2 shadow-lg">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition min-w-[56px] ${
              isActive ? 'text-amber-400 font-bold' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'scale-110 text-amber-400' : ''}`} />
            <span className="text-[10px] mt-0.5">{item.label}</span>
          </button>
        );
      })}
      <button
        onClick={onOpenFullMenu}
        className="flex flex-col items-center justify-center py-1 px-2 rounded-lg text-stone-400 hover:text-stone-200"
      >
        <Menu className="w-5 h-5" />
        <span className="text-[10px] mt-0.5">Mais</span>
      </button>
    </nav>
  );
};
