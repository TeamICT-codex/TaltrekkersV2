
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, Theme } from './ThemeContext';
import { CheckIcon } from './icons/CheckIcon';

const themeOptions: { id: Theme; label: string }[] = [
  { id: 'default', label: 'Standaard' },
  { id: 'high-contrast', label: 'Hoog Contrast' },
  { id: 'dark', label: 'Nachtmodus' },
  { id: 'color-friendly', label: 'Kleurvriendelijk' },
];

interface HeaderProps {
  onLogoClick: () => void;
  onShowLogin: () => void;
  onShowTeacherDashboard?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onLogoClick, onShowLogin, onShowTeacherDashboard }) => {
  const { theme, setTheme } = useTheme();
  const { user, role, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

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
            <div>
              <div className="font-extrabold text-xl sm:text-2xl text-tal-purple-dark leading-none tracking-tight">
                TALtrekkers
              </div>
              <div className="font-medium text-xs sm:text-sm text-slate-500 hidden sm:block">
                onderdeel van <span className="font-bold text-slate-600">het leercollectief</span>
              </div>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Theme Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-lg hover:bg-black/5 flex items-center gap-2 text-sm font-medium transition-colors"
              aria-label="Thema instellingen"
            >
              <span className="text-xl">🎨</span>
              <span className="hidden md:inline">Thema</span>
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-surface rounded-xl shadow-lg border border-themed py-1 animate-fade-in z-50">
                {themeOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleThemeChange(option.id)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-black/5 transition-colors ${theme === option.id ? 'font-bold text-tal-purple' : ''
                      }`}
                  >
                    {option.label}
                    {theme === option.id && <CheckIcon />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Teacher Dashboard Button - Only visible for teachers */}
          {user && role === 'teacher' && onShowTeacherDashboard && (
            <button
              onClick={onShowTeacherDashboard}
              className="flex items-center gap-2 px-3 py-2 bg-tal-gold text-tal-teal-dark font-bold text-sm rounded-lg shadow-md hover:bg-yellow-400 transition active:transform active:scale-95"
              aria-label="Leerkracht Dashboard"
            >
              <span className="text-lg">👨‍🏫</span>
              <span className="hidden md:inline">Volg leerlingen</span>
            </button>
          )}

          {/* User / Login Section */}
          <div className="relative">
            {user ? (
              // Ingelogd
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 p-1 pr-3 bg-tal-purple/10 rounded-full hover:bg-tal-purple/20 transition border border-tal-purple/20"
                >
                  <div className="w-8 h-8 rounded-full bg-tal-purple text-white flex items-center justify-center font-bold text-sm">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium hidden md:block max-w-[100px] truncate">
                    {user.email?.split('@')[0]}
                  </span>
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-surface rounded-xl shadow-lg border border-themed py-1 animate-fade-in z-50">
                    <div className="px-4 py-2 border-b border-themed text-xs text-muted truncate">
                      {user.email}
                    </div>
                    <div className="px-4 py-2 text-xs font-semibold text-tal-purple uppercase tracking-wider">
                      Rol: {role === 'teacher' ? 'Leerkracht 👨‍🏫' : 'Student'}
                    </div>
                    {role === 'teacher' && onShowTeacherDashboard && (
                      <button
                        onClick={() => {
                          onShowTeacherDashboard();
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 text-tal-purple-dark hover:bg-tal-purple/5 flex items-center gap-2 transition-colors font-medium"
                      >
                        <span>📊</span> Dashboard
                      </button>
                    )}
                    <button
                      onClick={() => {
                        signOut();
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                    >
                      <span>🚪</span> Uitloggen
                    </button>
                  </div>
                )}
              </div>
            ) : (
              // Niet ingelogd
              <button
                onClick={onShowLogin}
                className="flex items-center gap-2 px-4 py-2 bg-tal-purple text-white font-bold rounded-lg shadow-md hover:bg-tal-purple-dark transition active:transform active:scale-95"
              >
                <span>👤</span>
                <span className="hidden sm:inline">Inloggen</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Mobile Overlay for closing menus when clicking outside */}
      {(isMenuOpen || isUserMenuOpen) && (
        <div
          className="fixed inset-0 z-30 bg-transparent"
          onClick={() => {
            setIsMenuOpen(false);
            setIsUserMenuOpen(false);
          }}
        />
      )}
    </header>
  );
};

export default Header;
