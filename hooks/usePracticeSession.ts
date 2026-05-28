import { useState, useCallback } from 'react';
import { PracticeSettings, QuizResult, FrayerModelData, SessionSummaryData, SessionTimingData, UserData, WordListProgress, AllUsersData, WordMasteryInfo } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { saveSessionToSupabase, updateWordProgressInSupabase } from '../services/db';
import { shuffleArray } from '../services/utils';

type UserDataInput = UserData | ((prev: UserData | undefined) => UserData);

interface UsePracticeSessionOptions {
  allUsersData: AllUsersData;
  setUserData: (userName: string, input: UserDataInput) => void;
  onAchievementCheck: (
    currentUserData: UserData,
    listId: string,
    practicedWordSet: Set<string>,
    updatedLearnedWords: Record<string, WordMasteryInfo>,
  ) => Promise<{ achievementId: string; bonusPoints: number } | null>;
}

const DEFAULT_USER_DATA: UserData = {
  masteredWords: 0,
  totalScore: 0,
  sessionHistory: [],
  learnedWords: {},
  streak: 0,
  lastPracticeDate: null,
  points: 0,
  avatarId: 'default',
  wordListProgress: {},
};

/**
 * Hook voor het beheren van de oefensessie lifecycle:
 * starten, afronden, zwakke woorden herhalen, story challenge, en Supabase-sync.
 */
export function usePracticeSession({
  allUsersData,
  setUserData,
  onAchievementCheck,
}: UsePracticeSessionOptions) {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [practiceWords, setPracticeWords] = useState<string[]>([]);
  const [practiceSettings, setPracticeSettings] = useState<PracticeSettings | null>(null);
  const [sessionSummaryData, setSessionSummaryData] = useState<SessionSummaryData | null>(null);

  const { user } = useAuth();

  // --- Starten ---

  const startPractice = useCallback((userName: string, words: string[], settings: PracticeSettings) => {
    setCurrentUser(userName.toLowerCase().trim());
    setPracticeWords(words);
    setPracticeSettings(settings);
  }, []);

  const startStoryChallenge = useCallback((userName: string, aiModel: PracticeSettings['aiModel']) => {
    const userData = allUsersData[userName.toLowerCase().trim()];
    if (!userData || !userData.learnedWords) return false;

    const learnedWordsList = Object.keys(userData.learnedWords).filter(w => !w.startsWith('test_woord_'));
    const wordsPool = learnedWordsList.length > 5 ? learnedWordsList : Object.keys(userData.learnedWords);
    const storyWordsSample = shuffleArray(wordsPool).slice(0, 15);

    if (storyWordsSample.length < 5) {
      alert("Je hebt nog niet genoeg verschillende woorden geleerd voor de verhaaluitdaging. Ga zo door!");
      return false;
    }

    const storySettings: PracticeSettings = {
      showSynonymsAntonyms: false,
      wordsPerSession: storyWordsSample.length,
      aiModel,
    };

    setCurrentUser(userName.toLowerCase().trim());
    setPracticeWords(storyWordsSample);
    setPracticeSettings(storySettings);
    return true;
  }, [allUsersData]);

  const handlePracticeWeakWords = useCallback((words: string[]) => {
    if (words.length === 0) return;
    const settings: PracticeSettings = {
      wordsPerSession: words.length,
      showSynonymsAntonyms: false,
      context: 'Zwakke woorden',
      richting: undefined,
      courseId: undefined,
      customFileName: 'weak-words',
    };
    setPracticeWords(words);
    setPracticeSettings(settings);
  }, []);

  // --- Afronden ---

  const finishPractice = useCallback(async (
    sessionScore: number,
    quizResults: QuizResult[],
    frayerModels: FrayerModelData[],
    studyMode: 'frayer' | 'flashcards',
    timingData: SessionTimingData,
  ) => {
    if (!currentUser || !practiceWords || !practiceSettings) return;

    const currentUserData = allUsersData[currentUser] || { ...DEFAULT_USER_DATA };

    // _listAllWords is een intern transport-veld (kan honderden woorden zijn).
    // Niet opslaan in SessionRecord — bloat én lekt naar Supabase. We gebruiken
    // de waarde lokaal voor WordListProgress.allWords (zie verder in deze functie).
    const { _listAllWords: listAllWordsForProgress, ...settingsForStorage } = practiceSettings;

    // --- Sessie + geleerde woorden ---
    const newSession: UserData['sessionHistory'][0] = {
      date: new Date().toISOString(),
      score: sessionScore,
      words: practiceWords,
      quizResults,
      settings: settingsForStorage,
      studyMode,
      timingData,
    };

    const updatedLearnedWords = { ...(currentUserData.learnedWords || {}) };

    frayerModels.forEach((model, index) => {
      const wordKey = practiceWords[index].toLowerCase();
      if (!updatedLearnedWords[wordKey] && model.definitie) {
        updatedLearnedWords[wordKey] = { definitie: model.definitie, correct: 0, incorrect: 0 };
      }
    });

    quizResults.forEach(result => {
      const wordKey = result.word.toLowerCase();
      const wordInfo = updatedLearnedWords[wordKey];
      if (wordInfo) {
        wordInfo[result.correct ? 'correct' : 'incorrect'] += 1;
      }
    });

    // --- Streak ---
    const today = new Date().toISOString().split('T')[0];
    const lastDate = currentUserData.lastPracticeDate?.split('T')[0] ?? null;
    let newStreak = currentUserData.streak || 0;

    if (lastDate !== today) {
      if (lastDate) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        newStreak = lastDate === yesterday.toISOString().split('T')[0] ? newStreak + 1 : 1;
      } else {
        newStreak = 1;
      }
    }

    // --- Word list progress ---
    const listId = String(practiceSettings.customFileName || practiceSettings.context || 'general');
    const existingListProgress = currentUserData.wordListProgress?.[listId];

    // Bepaal de VOLLEDIGE woordenlijst voor deze lijst.
    // Precedentie:
    //   1. _listAllWords uit settings (gevuld bij upload-flows in PracticeSetup
    //      en CustomWordExtractor) — de meest accurate bron
    //   2. Bestaande allWords uit eerdere sessies — voorkomt dat een korte
    //      sessie de eerder vastgelegde volledige lijst overschrijft
    //   3. practiceWords (fallback voor lijsten zonder voorkennis, bv. eerste
    //      sessie van een algemene lijst zonder _listAllWords)
    //
    // Bij re-upload met gewijzigde inhoud (#60.3 was robuuste listId, voor nu
    // skippen we dat): we filtersen oude practicedWords zodat enkel woorden
    // die nog in de NIEUWE allWords zitten behouden blijven. Voorkomt phantom-
    // progress als de lijst inhoudelijk veranderd is.
    const finalAllWords = listAllWordsForProgress && listAllWordsForProgress.length > 0
      ? listAllWordsForProgress
      : (existingListProgress?.allWords && existingListProgress.allWords.length >= practiceWords.length
          ? existingListProgress.allWords
          : practiceWords);

    const finalAllWordsLower = new Set(finalAllWords.map(w => w.toLowerCase()));
    const oldPracticedFiltered = (existingListProgress?.practicedWords || [])
      .filter(w => finalAllWordsLower.has(w.toLowerCase()));

    const newPracticedWords = new Set<string>([
      ...oldPracticedFiltered,
      ...practiceWords.map(w => w.toLowerCase()),
    ]);

    const updatedListProgress: WordListProgress = {
      listId,
      allWords: finalAllWords,
      practicedWords: Array.from(newPracticedWords),
      lastPracticed: new Date().toISOString(),
    };

    // ─── Weak-words sessie? Dan extra beloning ──────────────
    // Practice van zwakke woorden is exact het gedrag dat we willen stimuleren:
    // de leerling kiest bewust om terug te gaan naar wat moeilijk was. Belonen
    // we extra zodat het ook in XP/tokens voelbaar wordt:
    //   - XP-bonus van 2x op de behaalde score
    //   - Sneek-drempel verlaagd naar ≥80% + ≥5 woorden (vs default ≥90% + ≥10)
    //     omdat weak-word lijsten vaak kort zijn én de woorden moeilijker.
    // Detectie via customFileName-marker die handlePracticeWeakWords zet.
    const isWeakWordsSession = practiceSettings.customFileName === 'weak-words';
    const xpMultiplier = isWeakWordsSession ? 2 : 1;
    const earnedXP = sessionScore * xpMultiplier;
    const newPoints = (currentUserData.points || 0) + earnedXP;

    // Reward tokens — voor MVP enkel Sneek-tokens.
    // Default drempel: ≥90% accuracy + ≥10 vragen. Bewust streng zodat de game
    // écht voelt als een verdiende beloning, niet als consumptie-artikel.
    //
    // Droak-tokens worden voorlopig NIET meer uitgekeerd (game heeft geen echte
    // gameplay-loop). DB-velden blijven bestaan voor een mogelijke v2-feature.
    const accuracy = quizResults.length > 0 ? sessionScore / quizResults.length : 0;
    const snakeAccuracyThreshold = isWeakWordsSession ? 0.8 : 0.9;
    const snakeMinQuestions = isWeakWordsSession ? 5 : 10;
    const earnedSnakeTokens = accuracy >= snakeAccuracyThreshold && quizResults.length >= snakeMinQuestions ? 1 : 0;
    const lastCheckpoint = currentUserData.lastXpRewardCheckpoint ?? 0;
    const newCheckpoint = Math.floor(newPoints / 100) * 100;
    const earnedDragonTokens = 0; // tijdelijk: geen Droak-tokens meer

    const updatedUser: UserData = {
      masteredWords: Object.keys(updatedLearnedWords).length,
      totalScore: currentUserData.totalScore + sessionScore,
      sessionHistory: [newSession, ...currentUserData.sessionHistory],
      learnedWords: updatedLearnedWords,
      streak: newStreak,
      lastPracticeDate: new Date().toISOString(),
      points: newPoints,
      avatarId: currentUserData.avatarId || 'default',
      snakeTokens: (currentUserData.snakeTokens ?? 0) + earnedSnakeTokens,
      dragonTokens: (currentUserData.dragonTokens ?? 0) + earnedDragonTokens,
      lastXpRewardCheckpoint: newCheckpoint,
      wordListProgress: {
        ...(currentUserData.wordListProgress || {}),
        [listId]: updatedListProgress,
      },
    };

    // Sla op
    setUserData(currentUser, updatedUser);

    // Sessie-samenvatting
    setSessionSummaryData({
      score: sessionScore,
      quizResults,
      words: practiceWords,
      settings: practiceSettings,
      earnedXP, // al inclusief 2x bonus bij weak-words
      weakWordsBonus: isWeakWordsSession,
      // Onderscheid tussen "net verdiend deze sessie" en "accumulatief beschikbaar"
      // — kritiek voor SessionSummary om niet onterecht "Beloning vrijgespeeld!"
      // te tonen bij brakke sessies waar de leerling nog wel oude tokens heeft.
      earnedSnakeTokens,
    });

    // --- Achievement detection ---
    // Gebruik de updater-vorm zodat we de actuele state (na de eerste setUserData)
    // krijgen — geen risico op stale state als er ondertussen nog updates plaatsvonden.
    const achievement = await onAchievementCheck(updatedUser, listId, newPracticedWords, updatedLearnedWords);
    if (achievement) {
      setUserData(currentUser, prev => {
        const base = prev ?? updatedUser;
        return {
          ...base,
          achievementsUnlocked: [...(base.achievementsUnlocked || []), achievement.achievementId],
          points: (base.points || 0) + achievement.bonusPoints,
        };
      });
    }

    // --- Supabase sync ---
    if (user) {
      // context = primaire weergave-naam in dashboards (filename heeft voorrang voor backwards-compat).
      // course_id/finaliteit/jaargang worden apart bewaard zodat de leerkracht structureel kan filteren
      // ook al uploadt elke leerling z'n eigen bestand met een afwijkende naam.
      let context = 'custom';
      let syncListId = 'custom-list';

      if (practiceSettings.customFileName) {
        context = practiceSettings.customFileName;
        syncListId = practiceSettings.customFileName;
      } else if (practiceSettings.courseId) {
        context = practiceSettings.courseId;
        syncListId = practiceSettings.courseId;
      } else if (practiceSettings.context) {
        context = practiceSettings.context.toString();
        syncListId = practiceSettings.context.toString();
      }

      const totalDuration = (timingData?.studyPhaseSeconds || 0) + (timingData?.quizPhaseSeconds || 0);

      // Fire-and-forget maar mét observability: faalt één van de twee, log dat
      // én houd lokale data intact. Volledige offline queue staat in PLAN.md (5.1).
      Promise.allSettled([
        saveSessionToSupabase({
          userId: user.id,
          context,
          fileName: practiceSettings.customFileName,
          courseId: practiceSettings.courseId,
          finaliteit: practiceSettings.finaliteit,
          jaargang: practiceSettings.jaargang,
          score: sessionScore,
          quizResults,
          durationSeconds: totalDuration,
          // Totale lijst-grootte: gebruikt door TeacherDashboard voor X/Y stats.
          // Komt uit _listAllWords (PracticeSetup zet dit bij elke sessie-start).
          totalWords: listAllWordsForProgress?.length,
        }),
        updateWordProgressInSupabase(user.id, syncListId, practiceWords),
      ]).then(results => {
        results.forEach((r, i) => {
          if (r.status === 'rejected') {
            console.warn(`Supabase sync ${i === 0 ? 'session' : 'word progress'} failed:`, r.reason);
          }
        });
      });
    }
  }, [allUsersData, currentUser, practiceWords, practiceSettings, user, setUserData, onAchievementCheck]);

  const finishStoryChallenge = useCallback(() => {
    setCurrentUser(null);
    setPracticeWords([]);
    setPracticeSettings(null);
  }, []);

  const handleCloseSummary = useCallback(() => {
    setSessionSummaryData(null);
    setCurrentUser(null);
    setPracticeWords([]);
    setPracticeSettings(null);
  }, []);

  return {
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
  };
}
