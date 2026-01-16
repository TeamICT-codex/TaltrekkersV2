import React, { useContext, useState } from 'react';
import { ThemeContext, Theme } from './ThemeContext';
import { CheckIcon } from './icons/CheckIcon';

const themeOptions: { id: Theme; label: string }[] = [
  { id: 'default', label: 'Standaard' },
  { id: 'high-contrast', label: 'Hoog Contrast' },
  { id: 'dark', label: 'Nachtmodus' },
  { id: 'color-friendly', label: 'Kleurvriendelijk' },
];

interface HeaderProps {
  onLogoClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onLogoClick }) => {
  const { theme, setTheme } = useContext(ThemeContext);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    setIsMenuOpen(false);
  };

  return (
    <header className="bg-surface shadow-sm sticky top-0 z-40 border-b border-themed">
      <div className="container mx-auto px-4 md:px-8 py-3 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={onLogoClick}
            className="flex items-center gap-3 text-left transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-tal-purple rounded-lg p-1 -m-1"
            aria-label="Terug naar startscherm"
          >
            <img
              src="/logo-tal.png"
              alt="TALent achterna! - Technisch Atheneum Lokeren"
              className="h-12 sm:h-14"
            />
          </button>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-alt hover:bg-surface-dark transition-colors"
              aria-label="Kies een kleurenthema"
            >
              <span className="text-2xl" role="img" aria-label="Kleurenpalet">🎨</span>
            </button>
            {isMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-48 bg-surface rounded-lg shadow-xl border border-themed z-50 animate-fade-in"
                style={{ animationDuration: '150ms' }}
              >
                <div className="py-1">
                  {themeOptions.map(option => (
                    <button
                      key={option.id}
                      onClick={() => handleThemeChange(option.id)}
                      className="w-full text-left px-4 py-2 text-sm text-primary hover:bg-surface-alt flex items-center justify-between"
                    >
                      <span>{option.label}</span>
                      {theme === option.id && <CheckIcon className="h-5 w-5 text-brand" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
