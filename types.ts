export enum AppState {
  LandingChoice,
  Onboarding,
  Welcome,
  Dashboard,
  Practice,
  SessionSummary,
  Story,
  TeacherDashboard,
}

export enum WordLevel {
  // Internal difficulty levels (not shown to user)
  Beginner = 'Beginner',
  Intermediate = 'Gemiddeld',
  Advanced = 'Gevorderd',
  // New user-facing categories
  Woordenschat2DF = 'Woordenschat 2DF',
  Woordenschat2AF = 'Woordenschat 2AF',
  AcademischNederlands = 'Academisch Nederlands',
  ProfessioneelNederlands = 'Professioneel Nederlands',
  // Custom uploads
  Custom = 'Eigen Lijst',
}

export type Finaliteit = 'AF' | 'DF' | 'OKAN';
export type Jaargang = '3e' | '4e' | '5e' | '5 Duaal' | '6e' | '6 Duaal' | '7e' | 'Fase 1' | 'Fase 2' | 'Fase 3' | 'Fase 4';

export interface PracticeSettings {
  showSynonymsAntonyms: boolean;
  context?: WordLevel | string; // Kan een algemeen niveau zijn of een specifieke cursus-ID
  difficulty?: WordLevel.Beginner | WordLevel.Intermediate | WordLevel.Advanced;
  wordsPerSession: number;
  aiModel?: 'fast' | 'balanced' | 'quality';
  nativeLanguage?: string;

  // Velden voor vakspecifieke selectie
  finaliteit?: Finaliteit;
  jaargang?: Jaargang;
  richting?: string; // De volledige naam van de richting, bv. 'Elektriciteit'
  courseId?: string; // De unieke ID van de cursus, bv. 'AF-3e-ELEK'
  customFileName?: string; // De naam van het opgeladen bestand
  enableTTS?: boolean; // TTS audio vooraf genereren voor alle woorden

  /**
   * Intern: de VOLLEDIGE lijst van woorden uit een opgeladen woordenlijst
   * (PDF/DOCX/XLSX). Wordt door PracticeSetup.handleStartCustom gevuld bij
   * elke sessie-start, en gebruikt door usePracticeSession om WordListProgress.
   * allWords accuraat te houden — onafhankelijk van hoeveel woorden in deze
   * specifieke sessie zaten. Kritiek voor "Mijn lijsten" hervat-feature.
   *
   * Underscore-prefix = conventie voor "intern veld, niet voor UI-display".
   */
  _listAllWords?: string[];
}

export interface QuizResult {
  word: string;
  correct: boolean;
}

export interface WordMasteryInfo {
  definitie: string;
  correct: number;
  incorrect: number;
}

export interface StudyItemTiming {
  word: string;
  seconds: number;
}

export interface QuizItemTiming {
  word: string;
  seconds: number;
}

export interface SessionTimingData {
  studyPhaseSeconds: number;
  quizPhaseSeconds: number;
  studyItems: StudyItemTiming[];
  quizItems: QuizItemTiming[];
}

export interface SessionRecord {
  date: string;
  words: string[];
  score: number;
  quizResults: QuizResult[];
  settings: PracticeSettings;
  studyMode?: 'frayer' | 'flashcards';
  timingData?: SessionTimingData;
}

export interface SessionSummaryData {
  /**
   * Aantal Sneek-tokens dat in DEZE specifieke sessie verdiend werd (0 of 1).
   * Onderscheid van `currentUserData.snakeTokens` (accumulatieve teller) — voor
   * de UI om "🎁 Net vrijgespeeld!" te tonen i.p.v. "🎮 nog X klaar".
   */
  earnedSnakeTokens?: number;
  score: number;
  quizResults: QuizResult[];
  words: string[];
  settings: PracticeSettings;
  earnedXP?: number; // XP earned in this session (al inclusief eventuele bonus)
  /** True als deze sessie een "oefen zwakke woorden"-sessie was — dan kreeg
   *  speler 2x XP en gold een soepelere Sneek-drempel. Wordt door
   *  SessionSummary gebruikt om een speciale beloningsbadge te tonen. */
  weakWordsBonus?: boolean;
}

export interface UserData {
  masteredWords: number;
  totalScore: number;
  sessionHistory: SessionRecord[];
  learnedWords: Record<string, WordMasteryInfo>;
  // Gamification
  streak: number;
  lastPracticeDate: string | null; // ISO Date string (YYYY-MM-DD)
  points: number;
  avatarId: string;
  // Reward tokens — verdiend bij sessie ≥ 80% of per 100 XP, in te ruilen voor Sneek/Droak.
  snakeTokens?: number;
  dragonTokens?: number;
  // Drempel-tracker voor "elke 100 XP = 1 token van elk soort". Onthoudt het laatste
  // veelvoud van 100 waarop tokens zijn uitgekeerd, zodat we bij elke nieuwe sessie
  // alleen tokens toevoegen voor pas-overschreden drempels.
  lastXpRewardCheckpoint?: number;
  // Word list tracking (per file/context)
  wordListProgress?: Record<string, WordListProgress>;
  // Achievements already shown (to prevent duplicate celebrations)
  achievementsUnlocked?: string[];
}

// Tracking welke woorden al geoefend zijn per woordenlijst/bestand
export interface WordListProgress {
  listId: string;             // Identifier (fileName of contextId)
  allWords: string[];         // Alle woorden uit de lijst
  practicedWords: string[];   // Woorden die al geoefend zijn (lowercase)
  lastPracticed: string;      // ISO datum van laatste sessie
}

export type AllUsersData = Record<string, UserData>;

export interface FrayerModelExample {
  zin: string;
  gebruiktWoord: string;
}

export interface FrayerModelData {
  definitie: string;
  voorbeelden: FrayerModelExample[];
  synoniemen: string[];
  antoniemen: string[];
  topic?: string;
}

export enum QuestionType {
  MultipleChoice = 'MC',
  Writing = 'WRITE'
}

export interface QuizQuestion {
  type: QuestionType;
  vraag: string;
  opties: string[]; // Bij writing is dit leeg of bevat het hints
  correctAntwoordIndex: number; // -1 bij writing
  woord: string; // Het correcte antwoord (als string)
}

export interface ReadingStrategyItem {
  title: string;
  explanation: string;
  question: string;
}

export interface StoryData {
  title: string;
  story: string;
}

export interface Avatar {
  id: string;
  emoji: string;
  name: string;
  cost: number;
}
