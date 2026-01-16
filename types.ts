
export enum AppState {
  Welcome,
  Dashboard,
  Practice,
  SessionSummary,
  Story,
}

export enum WordLevel {
  Beginner = 'Beginner',
  Intermediate = 'Gemiddeld',
  Advanced = 'Gevorderd',
  Schooltaal = 'Algemene Schooltaal',
  Biologie = 'Biologie',
  MensEnMaatschappij = 'Mens en Maatschappij',
  Economie = 'Economie',
  Wiskunde = 'Wiskunde',
  Natuurkunde = 'Natuurkunde',
  PeriodiekSysteem = 'Periodiek systeem',
  Nederlands = 'Nederlands',
  Engels = 'Engels',
  AcademischeWoordenschat = 'Academische Woordenschat',
  Custom = 'Eigen Lijst',
}

export type Finaliteit = 'AF' | 'DF';
export type Jaargang = '3e' | '4e' | '5e' | '6e';

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
  score: number;
  quizResults: QuizResult[];
  words: string[];
  settings: PracticeSettings;
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
  // Word list tracking (per file/context)
  wordListProgress?: Record<string, WordListProgress>;
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

export interface SubjectSpecificCourse {
  id: string;
  name: string;
  url?: string;
}

export interface Avatar {
  id: string;
  emoji: string;
  name: string;
  cost: number;
}
