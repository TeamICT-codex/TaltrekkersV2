
import React, { useState, useCallback, useEffect } from 'react';
import { AllUsersData, AppState, QuizResult, PracticeSettings, UserData, FrayerModelData, SessionSummaryData, SessionTimingData, WordListProgress } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import Dashboard from './components/Dashboard';
import Welcome from './components/Welcome';
import PracticeSession from './components/PracticeSession';
import StoryView from './components/StoryView';
import { SCHOOLTAAL_WORDS, STORY_MODE_UNLOCK_THRESHOLD } from './constants';
import SessionSummary from './components/SessionSummary';
import Header from './components/Header';
// import { ThemeProvider } from './components/ThemeContext'; // Removed, moved to index.tsx
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import TeacherDashboard from './components/TeacherDashboard';
import { saveSessionToSupabase, updateWordProgressInSupabase } from './services/db';


const App: React.FC = () => {
  const [allUsersData, setAllUsersData] = useLocalStorage<AllUsersData>('taaltrekkers-data-v2', {});

  const [appState, setAppState] = useState<AppState>(AppState.Welcome);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [practiceWords, setPracticeWords] = useState<string[]>([]);
  const [practiceSettings, setPracticeSettings] = useState<PracticeSettings | null>(null);
  const [sessionSummaryData, setSessionSummaryData] = useState<SessionSummaryData | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const { user } = useAuth(); // Haal ingelogde gebruiker op

  useEffect(() => {
    // Test/Seed data logic
    setAllUsersData(prevData => {
      const testUserKey = 'test';
      const testUserData = prevData[testUserKey];

      // Check of de test user bestaat EN of hij genoeg woorden heeft voor de story mode
      // We voegen een veilige marge toe (+50) om zeker te zijn dat de threshold gehaald wordt
      if (!testUserData || Object.keys(testUserData.learnedWords || {}).length < STORY_MODE_UNLOCK_THRESHOLD) {
        const learnedWordsObject: UserData['learnedWords'] = { ...(testUserData?.learnedWords || {}) };

        // 1. Voeg eerst de echte woorden toe
        SCHOOLTAAL_WORDS.forEach(word => {
          if (!learnedWordsObject[word.toLowerCase()]) {
            learnedWordsObject[word.toLowerCase()] = {
              definitie: `Definitie van ${word}`,
              correct: 1,
              incorrect: 0
            };
          }
        });

        // 2. Vul aan met dummy data tot we boven de threshold zitten
        const currentCount = Object.keys(learnedWordsObject).length;
        const needed = STORY_MODE_UNLOCK_THRESHOLD - currentCount + 50;

        for (let i = 0; i < needed; i++) {
          const dummyWord = `test_woord_${i}`;
          learnedWordsObject[dummyWord] = {
            definitie: `Dit is een automatisch gegenereerd testwoord nummer ${i}`,
            correct: 5,
            incorrect: 0
          };
        }

        const updatedTestUser: UserData = {
          ...(testUserData || { sessionHistory: [], streak: 0, lastPracticeDate: null, points: 0, avatarId: 'default' }),
          learnedWords: learnedWordsObject,
          masteredWords: Object.keys(learnedWordsObject).length,
          totalScore: testUserData?.totalScore || 5000, // Geef ook wat punten voor avatars
          points: testUserData?.points || 5000,
        };

        return {
          ...prevData,
          [testUserKey]: updatedTestUser,
        };
      }
      return prevData;
    });
  }, [setAllUsersData]);

  const startPractice = useCallback((userName: string, words: string[], settings: PracticeSettings) => {
    setCurrentUser(userName.toLowerCase().trim());
    setPracticeWords(words);
    setPracticeSettings(settings);
    setAppState(AppState.Practice);
  }, []);

  const finishPractice = useCallback(async (sessionScore: number, quizResults: QuizResult[], frayerModels: FrayerModelData[], studyMode: 'frayer' | 'flashcards', timingData: SessionTimingData) => {
    if (!currentUser || !practiceWords || !practiceSettings) return;

    setAllUsersData(prevData => {
      const userToUpdate = prevData[currentUser] || {
        masteredWords: 0,
        totalScore: 0,
        sessionHistory: [],
        learnedWords: {},
        streak: 0,
        lastPracticeDate: null,
        points: 0,
        avatarId: 'default',
        wordListProgress: {}
      };

      const newSession: UserData['sessionHistory'][0] = {
        date: new Date().toISOString(),
        score: sessionScore,
        words: practiceWords,
        quizResults: quizResults,
        settings: practiceSettings,
        studyMode: studyMode,
        timingData: timingData,
      };

      const updatedHistory = [newSession, ...userToUpdate.sessionHistory];
      const updatedLearnedWords = { ...(userToUpdate.learnedWords || {}) };

      frayerModels.forEach((model, index) => {
        const wordKey = practiceWords[index].toLowerCase();
        if (!updatedLearnedWords[wordKey] && model.definitie) {
          updatedLearnedWords[wordKey] = {
            definitie: model.definitie,
            correct: 0,
            incorrect: 0
          };
        }
      });

      quizResults.forEach(result => {
        const wordKey = result.word.toLowerCase();
        const wordInfo = updatedLearnedWords[wordKey];
        if (wordInfo) {
          if (result.correct) {
            wordInfo.correct += 1;
          } else {
            wordInfo.incorrect += 1;
          }
        }
      });

      // --- GAMIFICATION LOGIC ---
      const today = new Date().toISOString().split('T')[0];
      const lastDate = userToUpdate.lastPracticeDate ? userToUpdate.lastPracticeDate.split('T')[0] : null;
      let newStreak = userToUpdate.streak || 0;

      if (lastDate !== today) {
        if (lastDate) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayString = yesterday.toISOString().split('T')[0];

          if (lastDate === yesterdayString) {
            newStreak += 1;
          } else {
            newStreak = 1; // Reset streak if missed a day
          }
        } else {
          newStreak = 1; // First time ever
        }
      }

      const newPoints = (userToUpdate.points || 0) + sessionScore;

      // --- WORD LIST PROGRESS TRACKING ---
      const listId = practiceSettings.customFileName || practiceSettings.context || 'general';
      const existingListProgress = userToUpdate.wordListProgress?.[listId];

      // Merge praktische woorden (lowercase) met bestaande geoefende woorden
      const newPracticedWords = new Set<string>([
        ...(existingListProgress?.practicedWords || []),
        ...practiceWords.map(w => w.toLowerCase())
      ]);

      const updatedListProgress: WordListProgress = {
        listId,
        allWords: existingListProgress?.allWords || practiceWords,
        practicedWords: Array.from(newPracticedWords),
        lastPracticed: new Date().toISOString()
      };

      const updatedUser: UserData = {
        masteredWords: Object.keys(updatedLearnedWords).length,
        totalScore: userToUpdate.totalScore + sessionScore,
        sessionHistory: updatedHistory,
        learnedWords: updatedLearnedWords,
        streak: newStreak,
        lastPracticeDate: new Date().toISOString(),
        points: newPoints,
        avatarId: userToUpdate.avatarId || 'default',
        wordListProgress: {
          ...(userToUpdate.wordListProgress || {}),
          [listId]: updatedListProgress
        }
      };

      return {
        ...prevData,
        [currentUser]: updatedUser,
      };
    });

    setSessionSummaryData({
      score: sessionScore,
      quizResults: quizResults,
      words: practiceWords,
      settings: practiceSettings,
    });
    setAppState(AppState.SessionSummary);

    // ONLINE: Sync naar Supabase als ingelogd
    if (user) {
      // Wat is de context? Filename of cursusID?
      let context = 'custom';
      let listId = 'custom-list';

      if (practiceSettings.customFileName) {
        context = practiceSettings.customFileName;
        listId = practiceSettings.customFileName;
      } else if (practiceSettings.courseId) {
        context = practiceSettings.courseId;
        listId = practiceSettings.courseId;
      } else if (practiceSettings.context) {
        context = practiceSettings.context.toString();
        listId = practiceSettings.context.toString();
      }

      // Bereken totale duur (studie + quiz)
      const totalDuration = (timingData?.studyPhaseSeconds || 0) + (timingData?.quizPhaseSeconds || 0);

      saveSessionToSupabase(
        user.id,
        context,
        practiceSettings.customFileName,
        sessionScore,
        quizResults,
        totalDuration
      );

      // Update word progress (enkel de woorden die in de quiz zaten of alle practiceWords?)
      // practiceWords zijn alle woorden. quizResults zijn enkel de vragen.
      // We nemen alle woorden uit practiceWords als "geoefend".
      updateWordProgressInSupabase(
        user.id,
        listId,
        practiceWords
      );
    }

  }, [setAllUsersData, currentUser, practiceWords, practiceSettings, user]);

  const showDashboard = useCallback(() => {
    setAppState(AppState.Dashboard);
  }, []);

  const showWelcome = useCallback(() => {
    setAppState(AppState.Welcome);
  }, []);

  const deleteSession = useCallback((userName: string, sessionDate: string) => {
    setAllUsersData(prevData => {
      const userToUpdate = prevData[userName];
      if (!userToUpdate) return prevData;

      const updatedHistory = userToUpdate.sessionHistory.filter(session => session.date !== sessionDate);

      const updatedUser = {
        ...userToUpdate,
        sessionHistory: updatedHistory,
      };

      return {
        ...prevData,
        [userName]: updatedUser,
      };
    });
  }, [setAllUsersData]);

  const startStoryChallenge = useCallback((userName: string, aiModel: PracticeSettings['aiModel']) => {
    const user = allUsersData[userName.toLowerCase().trim()];
    if (!user || !user.learnedWords) return;

    // Filter out dummy words for the story challenge to ensure quality
    const learnedWordsList = Object.keys(user.learnedWords).filter(w => !w.startsWith('test_woord_'));

    // If user ONLY has dummy words (edge case), allow dummy words but warn
    const wordsPool = learnedWordsList.length > 5 ? learnedWordsList : Object.keys(user.learnedWords);

    const storyWordsSample = [...wordsPool].sort(() => 0.5 - Math.random()).slice(0, 15);

    if (storyWordsSample.length < 5) {
      alert("Je hebt nog niet genoeg verschillende woorden geleerd voor de verhaaluitdaging. Ga zo door!");
      return;
    }

    const storySettings: PracticeSettings = {
      showSynonymsAntonyms: false,
      wordsPerSession: storyWordsSample.length,
      aiModel: aiModel,
    };

    setCurrentUser(userName.toLowerCase().trim());
    setPracticeWords(storyWordsSample);
    setPracticeSettings(storySettings);
    setAppState(AppState.Story);
  }, [allUsersData]);

  const finishStoryChallenge = useCallback(() => {
    setAppState(AppState.Welcome);
    setCurrentUser(null);
    setPracticeWords([]);
    setPracticeSettings(null);
  }, []);

  const updateAvatar = useCallback((userName: string, avatarId: string) => {
    setAllUsersData(prevData => {
      const user = prevData[userName.toLowerCase().trim()];
      if (!user) return prevData;
      return {
        ...prevData,
        [userName.toLowerCase().trim()]: { ...user, avatarId }
      };
    });
  }, [setAllUsersData]);

  const handleCloseSummary = useCallback((destination: 'welcome' | 'dashboard') => {
    setSessionSummaryData(null);
    setCurrentUser(null);
    setPracticeWords([]);
    setPracticeSettings(null);
    if (destination === 'dashboard') {
      setAppState(AppState.Dashboard);
    } else {
      setAppState(AppState.Welcome);
    }
  }, []);

  const handleLogoClick = useCallback(() => {
    const inProgress = appState === AppState.Practice || appState === AppState.Story;
    if (inProgress) {
      if (window.confirm('Weet je zeker dat je terug wilt naar het startscherm? Je huidige oefening wordt dan gestopt.')) {
        setCurrentUser(null);
        setPracticeWords([]);
        setPracticeSettings(null);
        setAppState(AppState.Welcome);
      }
    } else {
      setAppState(AppState.Welcome);
    }
  }, [appState]);

  const renderContent = () => {
    switch (appState) {
      case AppState.Practice:
        if (practiceWords.length > 0 && practiceSettings) {
          return <PracticeSession words={practiceWords} settings={practiceSettings} onFinish={finishPractice} />;
        }
        showWelcome();
        return null;
      case AppState.TeacherDashboard:
        return <TeacherDashboard onBack={showWelcome} />;
      case AppState.Dashboard:
        return <Dashboard allUsersData={allUsersData} onBack={showWelcome} onDeleteSession={deleteSession} />;
      case AppState.Story:
        if (practiceWords.length > 0 && practiceSettings) {
          return <StoryView words={practiceWords} settings={practiceSettings} onFinish={finishStoryChallenge} />;
        }
        showWelcome();
        return null;
      case AppState.SessionSummary:
        if (sessionSummaryData) {
          return <SessionSummary summaryData={sessionSummaryData} onClose={handleCloseSummary} />;
        }
        showWelcome();
        return null;
      case AppState.Welcome:
      default:
        return <Welcome onStartPractice={startPractice} onShowDashboard={showDashboard} allUsersData={allUsersData} onStartStoryChallenge={startStoryChallenge} onUpdateAvatar={updateAvatar} />;
    }
  };

  return (
    // <AuthProvider> Moved to index.tsx
    //   <ThemeProvider>
    <div className="min-h-screen bg-app-bg text-color-text transition-colors duration-300 font-sans flex flex-col">
      <Header
        onLogoClick={() => setAppState(AppState.Welcome)}
        onShowLogin={() => setShowLogin(true)}
        onShowTeacherDashboard={() => setAppState(AppState.TeacherDashboard)}
      />

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
            <Login />
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8 md:py-12 flex-grow">
        {!showLogin && renderContent()}
      </main>
      <footer className="text-center text-xs text-muted p-4">
        Deze webapplicatie gebruikt AI. Technologie is niet onfeilbaar en maakt, net als mensen, af en toe fouten. Zie eventuele foutjes als een leerkans! :D
      </footer>
    </div>
    //   </ThemeProvider>
    // </AuthProvider>
  );
};

export default App;
