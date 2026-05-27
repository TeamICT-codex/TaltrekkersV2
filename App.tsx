
import React, { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { AppState, PracticeSettings } from './types';
import { useUserData } from './hooks/useUserData';
import { usePracticeSession } from './hooks/usePracticeSession';
import { useAchievements } from './hooks/useAchievements';
import { useProfileStatsCloudSync } from './hooks/useProfileStatsCloudSync';
import { useAuth } from './contexts/AuthContext';
import Header from './components/Header';
import WelcomeScreen from './components/WelcomeScreen';
import Welcome from './components/Welcome';
import Spinner from './components/Spinner';
import { isTeacherLoggedIn } from './components/Login';
import AvatarSelectorModal, { getAvatarById } from './components/AvatarSelectorModal';
import WelcomeBonusToast from './components/WelcomeBonusToast';
import TokenEarnedCelebration from './components/TokenEarnedCelebration';

// Zware/secundaire componenten lazy laden — worden pas gedownload wanneer nodig.
// Welcome blijft eager omdat het de hoofdroute is en lazy daar de FCP vertraagt.
const Dashboard = lazy(() => import('./components/Dashboard'));
const TeacherDashboard = lazy(() => import('./components/TeacherDashboard'));
const StoryView = lazy(() => import('./components/StoryView'));
const SessionSummary = lazy(() => import('./components/SessionSummary'));
const PracticeSession = lazy(() => import('./components/PracticeSession'));
const Login = lazy(() => import('./components/Login'));
const ListCompletionCelebration = lazy(() => import('./components/ListCompletionCelebration'));
const OnboardingKlas = lazy(() => import('./components/OnboardingKlas'));


const App: React.FC = () => {
  // --- Hooks ---
  const {
    allUsersData,
    setUserData,
    updateUser,
    deleteSession,
    deleteUserData,
    updateAvatar,
  } = useUserData();

  const { celebration, checkAchievements, dismissCelebration } = useAchievements();

  const {
    currentUser,
    practiceWords,
    practiceSettings,
    sessionSummaryData,
    startPractice,
    finishPractice,
    startStoryChallenge,
    finishStoryChallenge,
    handlePracticeWeakWords,
    handleCloseSummary,
  } = usePracticeSession({
    allUsersData,
    setUserData,
    onAchievementCheck: checkAchievements,
  });

  const { user, selectedStudent, role, finaliteit, jaargang } = useAuth();

  // --- Navigatie ---
  const [appState, setAppState] = useState<AppState>(AppState.LandingChoice);
  const [showLogin, setShowLogin] = useState(false);
  const [loginInitialTab, setLoginInitialTab] = useState<'email' | 'teacher'>('email');

  // Iedereen behalve LandingChoice/TeacherDashboard vereist een ingelogde Microsoft-user.
  // Als de user uitlogt of de sessie verloopt: terug naar LandingChoice.
  // Dev-bypass: in lokale dev skippen we de auth-gate zodat de app vlot te testen is.
  const devBypass = import.meta.env.DEV;
  const teacherSessionActive = isTeacherLoggedIn();
  const isAuthenticated = !!user || teacherSessionActive || devBypass;

  // Leerlingen moeten bij eerste login eenmalig finaliteit + jaargang kiezen.
  // Leerkrachten zijn niet aan een klas gekoppeld → geen onboarding nodig.
  // Tijdens dev-bypass zonder echte user: ook overslaan (we hebben geen profile).
  const needsOnboarding = !!user && role === 'student' && (!finaliteit || !jaargang);

  useEffect(() => {
    // Leerling met ontbrekende klas-info → forceer onboarding
    if (needsOnboarding && appState !== AppState.Onboarding) {
      setAppState(AppState.Onboarding);
      return;
    }
    // Onboarding net afgerond (of niet meer nodig) → door naar Welcome
    if (!needsOnboarding && appState === AppState.Onboarding) {
      setAppState(AppState.Welcome);
      return;
    }
    if ((user || devBypass) && appState === AppState.LandingChoice && !needsOnboarding) {
      setAppState(AppState.Welcome);
    }
    if (!isAuthenticated && appState !== AppState.LandingChoice && appState !== AppState.TeacherDashboard) {
      setAppState(AppState.LandingChoice);
    }
  }, [user, isAuthenticated, appState, devBypass, needsOnboarding]);

  // --- Navigatie callbacks ---
  const showDashboard = useCallback(() => setAppState(AppState.Dashboard), []);
  const showWelcome = useCallback(() => setAppState(AppState.Welcome), []);

  const handleStartPractice = useCallback((userName: string, words: string[], settings: PracticeSettings) => {
    startPractice(userName, words, settings);
    setAppState(AppState.Practice);
  }, [startPractice]);

  const handleFinishPractice = useCallback((...args: Parameters<typeof finishPractice>) => {
    finishPractice(...args);
    setAppState(AppState.SessionSummary);
  }, [finishPractice]);

  const handleStartStoryChallenge = useCallback((userName: string, aiModel: PracticeSettings['aiModel']) => {
    const success = startStoryChallenge(userName, aiModel);
    if (success) setAppState(AppState.Story);
  }, [startStoryChallenge]);

  const handleFinishStoryChallenge = useCallback(() => {
    finishStoryChallenge();
    setAppState(AppState.Welcome);
  }, [finishStoryChallenge]);

  const handlePracticeWeakWordsNav = useCallback((words: string[]) => {
    handlePracticeWeakWords(words);
    setAppState(AppState.Practice);
  }, [handlePracticeWeakWords]);

  const handleCloseSummaryNav = useCallback((destination: 'welcome' | 'dashboard') => {
    handleCloseSummary();
    setAppState(destination === 'dashboard' ? AppState.Dashboard : AppState.Welcome);
  }, [handleCloseSummary]);

  // De "actieve" user voor reward-doeleinden: tijdens een sessie is dat currentUser,
  // daarbuiten kijken we naar de geselecteerde leerling (uit AuthContext, persistent
  // in localStorage). Zo blijven tokens ook in de Header zichtbaar buiten oefensessies.
  const activeUserName = currentUser ?? selectedStudent?.name?.toLowerCase().trim();

  // Reward token spend — trekt 1 token af van het juiste type op de actieve user.
  const handleSpendToken = useCallback((mode: 'snake' | 'dragon') => {
    if (!activeUserName) return;
    setUserData(activeUserName, prev => {
      if (!prev) return prev as never;
      const key = mode === 'snake' ? 'snakeTokens' : 'dragonTokens';
      return {
        ...prev,
        [key]: Math.max(0, (prev[key] ?? 0) - 1),
      };
    });
  }, [activeUserName, setUserData]);

  // Lees actuele token-counts voor de actieve user
  const activeUserData = activeUserName ? allUsersData[activeUserName] : undefined;
  const snakeTokens = activeUserData?.snakeTokens ?? 0;
  const dragonTokens = activeUserData?.dragonTokens ?? 0;

  // Cloud-sync van XP/streak/tokens/avatar tussen localStorage en Supabase profiles.
  // Bij login: DB wint (zodat cross-device werkt). Daarna debounced naar DB schrijven.
  // Returnt ook of we net een welkomstbonus hebben toegekend → toast tonen.
  const { welcomeBonusJustGranted, dismissWelcomeBonus } = useProfileStatsCloudSync(
    user, activeUserName, activeUserData, setUserData,
  );

  // Token-viering: detecteer wanneer snake_tokens stijgt (na sessie-einde).
  // Skip de eerste render (initial hydrate) zodat we niet vieren bij login,
  // EN skip de stijging die door de welkomstbonus komt — die heeft al z'n eigen
  // toast en dubbele full-screen confetti zou de toast overschaduwen.
  const prevSnakeTokensRef = useRef<number | undefined>(undefined);
  const [showTokenCelebration, setShowTokenCelebration] = useState(false);
  useEffect(() => {
    const prev = prevSnakeTokensRef.current;
    if (prev !== undefined && snakeTokens > prev && !welcomeBonusJustGranted) {
      setShowTokenCelebration(true);
    }
    prevSnakeTokensRef.current = snakeTokens;
  }, [snakeTokens, welcomeBonusJustGranted]);

  // Profielstats voor de Header — XP, streak, avatar emoji/naam.
  // Avatar wordt globaal in App.tsx beheerd zodat zowel Header (knop) als
  // de modal in dezelfde state hangen.
  const headerPoints = activeUserData?.points ?? 0;
  const headerStreak = activeUserData?.streak ?? 0;
  const currentAvatar = getAvatarById(activeUserData?.avatarId);
  const [isAvatarSelectorOpen, setIsAvatarSelectorOpen] = useState(false);

  // Dev-only: één keer per browsersessie, geef de actieve user 5 Sneek- en 5 Droak-tokens
  // zodat we de reward-flow vlot kunnen demonstreren zonder eerst een sessie te moeten doen.
  // sessionStorage als marker zodat de prefill niet steeds terugkeert wanneer je tokens
  // opmaakt — dan zie je de "geen tokens"-state ook netjes.
  // In productie volledig inactief omdat `devBypass = import.meta.env.DEV`.
  useEffect(() => {
    if (!devBypass || !activeUserName || !activeUserData) return;
    const flag = `taltrekkers_dev_token_prefill_${activeUserName}`;
    if (sessionStorage.getItem(flag)) return;
    sessionStorage.setItem(flag, '1');
    if ((activeUserData.snakeTokens ?? 0) === 0 && (activeUserData.dragonTokens ?? 0) === 0) {
      setUserData(activeUserName, prev => ({
        ...(prev ?? activeUserData),
        snakeTokens: 5,
        dragonTokens: 5,
      }));
    }
  }, [devBypass, activeUserName, activeUserData, setUserData]);

  const handleLogoClick = useCallback(() => {
    const inProgress = appState === AppState.Practice || appState === AppState.Story;
    if (inProgress) {
      if (window.confirm('Weet je zeker dat je terug wilt naar het startscherm? Je huidige oefening wordt dan gestopt.')) {
        setAppState(AppState.Welcome);
      }
    } else {
      setAppState(AppState.Welcome);
    }
  }, [appState]);

  // --- Render ---
  const renderContent = () => {
    switch (appState) {
      case AppState.LandingChoice:
        return (
          <WelcomeScreen
            onTeacherShortcut={() => {
              setLoginInitialTab('teacher');
              setShowLogin(true);
            }}
          />
        );
      case AppState.Onboarding:
        return <OnboardingKlas onComplete={() => setAppState(AppState.Welcome)} />;
      case AppState.Practice:
        if (practiceWords.length > 0 && practiceSettings) {
          return <PracticeSession words={practiceWords} settings={practiceSettings} onFinish={handleFinishPractice} />;
        }
        showWelcome();
        return null;
      case AppState.TeacherDashboard:
        return <TeacherDashboard onBack={showWelcome} />;
      case AppState.Dashboard:
        return (
          <Dashboard
            allUsersData={allUsersData}
            onBack={showWelcome}
            onDeleteSession={deleteSession}
            onDeleteUserData={deleteUserData}
            onPracticeWeakWords={handlePracticeWeakWordsNav}
          />
        );
      case AppState.Story:
        if (practiceWords.length > 0 && practiceSettings) {
          return <StoryView words={practiceWords} settings={practiceSettings} onFinish={handleFinishStoryChallenge} />;
        }
        showWelcome();
        return null;
      case AppState.SessionSummary:
        if (sessionSummaryData) {
          return (
            <SessionSummary
              summaryData={sessionSummaryData}
              onClose={handleCloseSummaryNav}
              snakeTokens={snakeTokens}
              dragonTokens={dragonTokens}
              onSpendToken={handleSpendToken}
            />
          );
        }
        showWelcome();
        return null;
      case AppState.Welcome:
      default:
        return (
          <Welcome
            onStartPractice={handleStartPractice}
            onShowDashboard={showDashboard}
            allUsersData={allUsersData}
            onStartStoryChallenge={handleStartStoryChallenge}
            onShowAvatarSelector={activeUserName ? () => setIsAvatarSelectorOpen(true) : undefined}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-app-bg text-color-text transition-colors duration-300 font-sans flex flex-col">
      <Header
        onLogoClick={handleLogoClick}
        onShowLogin={() => setShowLogin(true)}
        onShowTeacherDashboard={() => setAppState(AppState.TeacherDashboard)}
        snakeTokens={snakeTokens}
        dragonTokens={dragonTokens}
        onSpendToken={handleSpendToken}
        points={headerPoints}
        streak={headerStreak}
        avatarEmoji={currentAvatar.emoji}
        avatarName={currentAvatar.name}
        onShowAvatarSelector={activeUserName ? () => setIsAvatarSelectorOpen(true) : undefined}
      />

      <main className="container mx-auto px-4 py-8 md:py-12 flex-grow">
        <Suspense fallback={
          <div className="flex justify-center items-center py-24">
            <Spinner className="h-10 w-10 text-tal-purple" />
          </div>
        }>
          {!showLogin && renderContent()}
          
          {showLogin && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-surface w-full max-w-lg rounded-2xl shadow-2xl relative border border-themed overflow-hidden">
                <button
                  onClick={() => setShowLogin(false)}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-black/5 hover:bg-black/10 transition-colors z-10"
                  title="Sluiten"
                >
                  ✕
                </button>
                <Login
                  initialTab={loginInitialTab}
                  onBack={() => setShowLogin(false)}
                  onTeacherAccess={() => {
                    setShowLogin(false);
                    setAppState(AppState.TeacherDashboard);
                  }}
                />
              </div>
            </div>
          )}

          {/* List Completion Celebration Modal */}
          {celebration && celebration.show && (
            <ListCompletionCelebration
              listName={celebration.listName}
              achievementType={celebration.type}
              totalWords={celebration.totalWords}
              bonusPoints={celebration.bonusPoints}
              onClose={dismissCelebration}
            />
          )}

          {/* Avatar Selector — globaal beheerd zodat de Header-knop ook werkt
              wanneer Welcome.tsx niet geladen is. */}
          {activeUserName && (
            <AvatarSelectorModal
              isOpen={isAvatarSelectorOpen}
              onClose={() => setIsAvatarSelectorOpen(false)}
              points={headerPoints}
              currentAvatarId={activeUserData?.avatarId || 'default'}
              studentName={activeUserName}
              onUpdateAvatar={updateAvatar}
            />
          )}

          {/* Welkomstbonus toast — verschijnt éénmaal bij eerste login */}
          <WelcomeBonusToast
            show={welcomeBonusJustGranted}
            onDismiss={dismissWelcomeBonus}
          />

          {/* Sneek-token verdiend? Confetti-celebration na sessie-einde */}
          <TokenEarnedCelebration
            show={showTokenCelebration}
            onDismiss={() => setShowTokenCelebration(false)}
          />
        </Suspense>
      </main>
      <footer className="text-center text-xs text-muted p-4">
        Deze webapplicatie gebruikt AI. Technologie is niet onfeilbaar en maakt, net als mensen, af en toe fouten. Zie eventuele foutjes als een leerkans! :D
      </footer>
    </div>
  );
};

export default App;
