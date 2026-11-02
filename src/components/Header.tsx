import React from 'react';
import { CloudOff, Languages } from 'lucide-react';
import type { Language } from '../i18n';

interface HeaderProps {
  language: Language;
  onToggleLanguage: () => void;
  syncStatus?: 'synced' | 'local' | 'offline' | 'needs_attention';
  customTitle?: string;
  customSubtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({
  language,
  onToggleLanguage,
  syncStatus = 'local',
  customTitle,
  customSubtitle,
}) => {
  const isHi = language === 'hi';

  return (
    <header className="bg-mk-purple text-white px-4 pt-5 pb-4 shadow-md sticky top-0 z-30">
      <div className="flex items-center justify-between gap-3">
        {/* Brand & Dadaji Logo */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#FFF0D6] border-2 border-amber-300 text-mk-purple flex items-center justify-center font-bold text-2xl shadow-inner flex-shrink-0 overflow-hidden ring-2 ring-amber-400/40">
            <img
              src="/dadaji-photo.jpg"
              alt="श्री मुंशी सेठ जी (Shri Munshi Seth Ji)"
              className="w-full h-full object-cover object-top"
              onError={(e) => {
                // Fallback to SVG badge if photo fails
                (e.target as HTMLImageElement).src = '/favicon.svg';
              }}
            />
            <span className="font-extrabold text-mk-purple text-lg hidden">मुं</span>
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight leading-tight">
              {customTitle || (isHi ? 'मुंशी किराना स्टोर' : 'Munsi Kirana Store')}
            </h1>
            <p className="text-xs text-amber-200 font-semibold flex items-center gap-1">
              <span>{isHi ? 'श्री मुंशी सेठ जी का आशीर्वाद' : 'Blessings of Shri Munshi Seth Ji'}</span>
            </p>
          </div>
        </div>

        {/* Language & Sync Status */}
        <div className="flex items-center gap-2">
          {/* Sync indicator */}
          <div
            title={
              syncStatus === 'synced'
                ? 'क्लाउड सिंक पूरा हुआ'
                : syncStatus === 'offline'
                ? 'इंटरनेट बंद — केवल फोन में सुरक्षित'
                : 'इस फोन पर सुरक्षित'
            }
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
          >
            {syncStatus === 'synced' ? (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            ) : syncStatus === 'offline' ? (
              <CloudOff className="w-4 h-4 text-amber-300" />
            ) : (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            )}
          </div>

          {/* Language Switch */}
          <button
            type="button"
            onClick={onToggleLanguage}
            className="min-h-touch-sm px-3 py-1 rounded-xl bg-white/15 hover:bg-white/25 active:bg-white/30 text-white text-sm font-semibold border border-white/20 flex items-center gap-1.5 transition-all"
            aria-label="Switch language"
          >
            <Languages className="w-4 h-4" />
            <span>{isHi ? 'English' : 'हिन्दी'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
