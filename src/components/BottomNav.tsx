import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, ReceiptText, BookOpenCheck, MoreHorizontal } from 'lucide-react';
import type { Language } from '../i18n';

interface BottomNavProps {
  language: Language;
}

export const BottomNav: React.FC<BottomNavProps> = ({ language }) => {
  const isHi = language === 'hi';

  const navItems = [
    {
      to: '/',
      labelHi: 'होम',
      labelEn: 'Home',
      icon: Home,
    },
    {
      to: '/billing',
      labelHi: 'बिल',
      labelEn: 'Bill',
      icon: ReceiptText,
    },
    {
      to: '/ledger',
      labelHi: 'खाता',
      labelEn: 'Khata',
      icon: BookOpenCheck,
    },
    {
      to: '/reports',
      labelHi: 'और',
      labelEn: 'More',
      icon: MoreHorizontal,
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-mk-line shadow-[0_-4px_16px_rgba(0,0,0,0.04)]"
      aria-label="Main Navigation"
    >
      <div className="max-w-md mx-auto grid grid-cols-4 px-2 py-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `min-h-[58px] flex flex-col items-center justify-center gap-1 rounded-2xl transition-all ${
                  isActive
                    ? 'text-mk-purple bg-mk-soft font-bold'
                    : 'text-mk-muted hover:text-mk-text active:bg-slate-100'
                }`
              }
            >
              <Icon className="w-6 h-6 stroke-[2]" />
              <span className="text-xs font-semibold tracking-wide">
                {isHi ? item.labelHi : item.labelEn}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
