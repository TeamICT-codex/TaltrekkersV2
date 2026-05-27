
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, Theme } from './ThemeContext';
import { CheckIcon } from './icons/CheckIcon';
import FeedbackButton from './FeedbackButton';
import FeedbackViewer from './FeedbackViewer';
import RewardLauncher from './RewardLauncher';
import KlasSettingsModal from './KlasSettingsModal';
import TeacherUpgradeModal from './TeacherUpgradeModal';
import GameSettingsModal from './GameSettingsModal';

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
  snakeTokens?: number;
  dragonTokens?: number;
  onSpendToken?: (mode: 'snake' | 'dragon') => void;
  // Profielinfo voor de avatar-chip en stats — vanuit App.tsx via useUserData.
  points?: number;
  streak?: number;
  avatarEmoji?: string;
  avatarName?: string;
  onShowAvatarSelector?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  onLogoClick, onShowLogin, onShowTeacherDashboard,
  snakeTokens = 0, dragonTokens = 0, onSpendToken,
  points = 0, streak = 0, avatarEmoji = '👤', avatarName, onShowAvatarSelector,
}) => {
  const { theme, setTheme } = useTheme();
  const { user, role, klas, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isKlasModalOpen, setIsKlasModalOpen] = useState(false);
  const [isTeacherUpgradeOpen, setIsTeacherUpgradeOpen] = useState(false);
  const [isGameSettingsOpen, setIsGameSettingsOpen] = useState(false);

  // Rol-helpers — admin is een super-teacher dus erft alle teacher-privileges.
  const isAdmin = role === 'admin';
  const isTeacherOrAdmin = role === 'teacher' || role === 'admin';
  const isStudent = role === 'student';

  const roleLabel =
    isAdmin ? 'Admin 🛡️' :
    role === 'teacher' ? 'Leerkracht 👨‍🏫' :
    'Student';

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
                TALent voor Taal
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
              title="Kleurthema wisselen"
            >
              <span className="text-xl" aria-hidden="true">🎨</span>
              <span>Thema</span>
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

          {/* Stats chips — vibrant gradients (inline style omdat Tailwind CDN
              geen bg-gradient utilities ondersteunt). Verborgen op smal scherm. */}
          {user && (points > 0 || streak > 0) && (
            <div className="hidden md:flex items-center gap-2">
              {points > 0 && (
                <span
                  title={`Jouw totale XP — ${points.toLocaleString()}`}
                  style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #f97316 100%)' }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-xs font-extrabold shadow-md hover:scale-105 active:scale-95 transition-transform cursor-default"
                >
                  <span className="text-sm">⭐</span>
                  <span>{points >= 1000 ? `${(points / 1000).toFixed(1)}k` : points}</span>
                </span>
              )}
              {streak > 0 && (
                <span
                  title={`${streak} dag${streak > 1 ? 'en' : ''} op rij geoefend`}
                  style={{ background: 'linear-gradient(135deg, #fb923c 0%, #f43f5e 100%)' }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-xs font-extrabold shadow-md hover:scale-105 active:scale-95 transition-transform cursor-default"
                >
                  <span className="text-sm">🔥</span>
                  <span>{streak}</span>
                </span>
              )}
            </div>
          )}

          {/* Reward tokens — compact badges, alleen als er een actieve user/oefenaar is met tokens of een spendcallback */}
          {onSpendToken && (snakeTokens > 0 || dragonTokens > 0) && (
            <RewardLauncher
              snakeTokens={snakeTokens}
              dragonTokens={dragonTokens}
              onSpend={onSpendToken}
              variant="compact"
            />
          )}

          {/* Feedback Button — alleen voor leerkrachten en admins.
              Leerlingen kunnen geen feedback geven om misbruik te voorkomen. */}
          {user && isTeacherOrAdmin && <FeedbackButton />}

          {/* Feedback Viewer — alleen voor admin (RLS in Supabase blokkeert ook
              server-side voor non-admins; deze guard verbergt de knop helemaal). */}
          {user && isAdmin && <FeedbackViewer />}

          {/* Teacher Dashboard Button - voor teacher en admin — vibrant pill (inline gradient) */}
          {user && isTeacherOrAdmin && onShowTeacherDashboard && (
            <button
              onClick={onShowTeacherDashboard}
              style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' }}
              className="flex items-center gap-2 px-4 py-2 text-tal-teal-dark font-extrabold text-sm rounded-full shadow-lg hover:scale-105 hover:shadow-xl active:scale-95 transition-all"
              aria-label="Leerkracht Dashboard"
              title="Bekijk leerling-sessies en voortgang"
            >
              <span className="text-lg" aria-hidden="true">👨‍🏫</span>
              <span>Volg leerlingen</span>
            </button>
          )}

          {/* User / Login Section */}
          <div className="relative">
            {user ? (
              // Ingelogd
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 p-1 pr-3 bg-tal-purple/10 rounded-full hover:bg-tal-purple/20 active:scale-95 transition-all border border-tal-purple/20"
                  aria-label="Open profielmenu"
                  title={user.email ?? 'Profielmenu'}
                >
                  <div
                    className="w-9 h-9 rounded-full bg-gradient-to-br from-tal-purple to-tal-purple-dark text-white flex items-center justify-center text-xl shadow-sm"
                    aria-hidden="true"
                  >
                    <span className="select-none">{avatarEmoji}</span>
                  </div>
                  <span className="text-sm font-medium max-w-[80px] sm:max-w-[120px] truncate">
                    {user.email?.split('@')[0]}
                  </span>
                  <span className="text-tal-purple/60 text-xs" aria-hidden="true">▾</span>
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-surface rounded-xl shadow-lg border border-themed py-1 animate-fade-in z-50">
                    <div className="px-4 py-2 border-b border-themed text-xs text-muted truncate">
                      {user.email}
                    </div>
                    <div className="px-4 py-2 text-xs font-semibold text-tal-purple uppercase tracking-wider flex items-center justify-between">
                      <span>Rol: {roleLabel}</span>
                      {klas && <span className="text-[10px] normal-case text-muted tracking-normal">{klas}</span>}
                    </div>
                    {isTeacherOrAdmin && onShowTeacherDashboard && (
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
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setIsGameSettingsOpen(true);
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 text-tal-purple-dark hover:bg-tal-purple/5 flex items-center gap-2 transition-colors font-medium"
                      >
                        <span>🎮</span> Game-instellingen
                      </button>
                    )}
                    {isStudent && (
                      <>
                        <button
                          onClick={() => {
                            setIsKlasModalOpen(true);
                            setIsUserMenuOpen(false);
                          }}
                          className="w-full text-left px-4 py-3 text-tal-purple-dark hover:bg-tal-purple/5 flex items-center gap-2 transition-colors font-medium"
                        >
                          <span>📚</span> Wijzig klas
                        </button>
                        {onShowAvatarSelector && (
                          <button
                            onClick={() => {
                              onShowAvatarSelector();
                              setIsUserMenuOpen(false);
                            }}
                            className="w-full text-left px-4 py-3 text-tal-purple-dark hover:bg-tal-purple/5 flex items-center gap-2 transition-colors font-medium"
                          >
                            <span>🎨</span> Wijzig avatar
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setIsTeacherUpgradeOpen(true);
                            setIsUserMenuOpen(false);
                          }}
                          className="w-full text-left px-4 py-3 text-tal-purple-dark hover:bg-tal-purple/5 flex items-center gap-2 transition-colors font-medium border-t border-themed/50"
                        >
                          <span>👨‍🏫</span> Ik ben leerkracht
                        </button>
                      </>
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
              // Niet ingelogd — vibrant pill (inline gradient), tekst altijd zichtbaar
              <button
                onClick={onShowLogin}
                title="Log in met je schoolmail"
                aria-label="Inloggen"
                style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #C026D3 100%)' }}
                className="flex items-center gap-2 px-5 py-2 text-white font-extrabold rounded-full shadow-lg hover:scale-105 hover:shadow-xl active:scale-95 transition-all"
              >
                <span aria-hidden="true">👤</span>
                <span>Inloggen</span>
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

      {/* Wijzig-klas modal — alleen relevant voor ingelogde leerlingen */}
      <KlasSettingsModal
        isOpen={isKlasModalOpen}
        onClose={() => setIsKlasModalOpen(false)}
      />

      {/* Teacher upgrade modal — leerling voert code in om teacher te worden */}
      <TeacherUpgradeModal
        isOpen={isTeacherUpgradeOpen}
        onClose={() => setIsTeacherUpgradeOpen(false)}
      />

      {/* Game-settings modal — admin past tekst en thema's aan */}
      <GameSettingsModal
        isOpen={isGameSettingsOpen}
        onClose={() => setIsGameSettingsOpen(false)}
      />
    </header>
  );
};

export default Header;
