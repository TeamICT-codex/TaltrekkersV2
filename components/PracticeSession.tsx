
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FrayerModelData, PracticeSettings, QuizQuestion, QuizResult, StudyItemTiming, QuizItemTiming, SessionTimingData } from '../types';
import { generateFrayerModel, generateQuizQuestions, preloadTTSBatch } from '../services/geminiService';
import { categorizeError, AppError } from '../services/errorHandling';
import { shuffleArray } from '../services/utils';
import LoadingIndicator from './LoadingIndicator';
import FrayerModelView from './FrayerModelView';
import QuizView from './QuizView';
import FlashcardView from './FlashcardView';
import ErrorBanner from './ErrorBanner';
import { ALL_PREDEFINED_MODELS } from '../constants';

interface PracticeSessionProps {
  words: string[];
  settings: PracticeSettings;
  onFinish: (sessionScore: number, quizResults: QuizResult[], frayerModels: FrayerModelData[], studyMode: 'frayer' | 'flashcards', timingData: SessionTimingData) => void;
}

type StudyMode = 'frayer' | 'flashcards';
type SessionPhase = 'loading' | 'study_mode_selection' | 'studying' | 'quiz_waiting' | 'quiz';
/** De quizvragen worden op de achtergrond gemaakt terwijl de leerling studeert. */
type QuizStatus = 'idle' | 'loading' | 'ready' | 'error';

const PracticeSession: React.FC<PracticeSessionProps> = ({ words, settings, onFinish }) => {
  const [phase, setPhase] = useState<SessionPhase>('loading');
  const [frayerModels, setFrayerModels] = useState<FrayerModelData[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizStatus, setQuizStatus] = useState<QuizStatus>('idle');
  const [quizError, setQuizError] = useState<AppError | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [studyMode, setStudyMode] = useState<StudyMode>('frayer');

  const [failedWords, setFailedWords] = useState<string[]>([]);
  const [studyPhaseStart, setStudyPhaseStart] = useState<number | null>(null);
  const [quizPhaseStart, setQuizPhaseStart] = useState<number | null>(null);
  const [studyTimings, setStudyTimings] = useState<StudyItemTiming[]>([]);
  const [quizTimings, setQuizTimings] = useState<QuizItemTiming[]>([]);

  // Elke opbouw en elke quizpoging krijgt een volgnummer. Een antwoord van een
  // oudere poging, of dat pas binnenkomt na het verlaten van de oefening, wordt genegeerd.
  const setupRun = useRef(0);
  const quizRun = useRef(0);
  useEffect(() => () => { setupRun.current++; quizRun.current++; }, []);

  /** Maakt de quizvragen op de achtergrond; de leerling kan intussen al studeren. */
  const startQuiz = useCallback((models: FrayerModelData[]) => {
    const run = ++quizRun.current;
    setQuizStatus('loading');
    setQuizError(null);
    generateQuizQuestions(models, words, {
      aiModel: settings.aiModel,
      context: settings.context,
      difficulty: settings.difficulty
    }).then(
      questions => {
        if (run !== quizRun.current) return;
        // Randomize quiz questions immediately upon generation
        setQuizQuestions(shuffleArray(questions));
        setQuizStatus('ready');
      },
      (err: unknown) => {
        if (run !== quizRun.current) return;
        console.error("Fout bij het maken van de quizvragen:", err);
        setQuizError(categorizeError(err, 'Quizvragen maken'));
        setQuizStatus('error');
      }
    );
  }, [words, settings]);

  const setupSession = useCallback(async () => {
    const run = ++setupRun.current;
    quizRun.current++; // een quiz van een vorige opbouw telt niet meer
    try {
      setError(null);
      setPhase('loading');
      setQuizStatus('idle');
      setQuizError(null);
      setQuizQuestions([]);

      const modelPromises = words.map(word => {
        const predefinedModel = ALL_PREDEFINED_MODELS[word.toLowerCase()];
        if (predefinedModel) {
          return Promise.resolve(predefinedModel);
        }
        return generateFrayerModel(word, {
          context: settings.context,
          difficulty: settings.difficulty,
          aiModel: settings.aiModel,
        });
      });

      // Promise.allSettled: één mislukt woord blokkeert de rest niet meer
      const results = await Promise.allSettled(modelPromises);
      if (run !== setupRun.current) return;
      const failed: string[] = [];
      const generatedModels: FrayerModelData[] = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        }
        // Fallback model voor woorden die niet gegenereerd konden worden
        failed.push(words[index]);
        return {
          definitie: '',
          voorbeelden: [],
          synoniemen: [],
          antoniemen: [],
        } satisfies FrayerModelData;
      });

      // Lukte geen enkele woordkaart (bv. geen verbinding), dan heeft studeren geen zin:
      // meteen de foutmelding, en "Opnieuw proberen" maakt alles opnieuw.
      if (failed.length > 0 && failed.length === words.length) {
        const eersteFout = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
        throw eersteFout?.reason ?? new Error('Geen enkele woordkaart kon gemaakt worden.');
      }

      setFailedWords(failed);
      setFrayerModels(generatedModels);

      // Niet meer wachten op de quizvragen (10 à 12 s voor 20 woorden): die
      // komen op de achtergrond, terwijl de leerling de woorden bestudeert.
      startQuiz(generatedModels);

      // Uitspraak vooraf laden kiest de leerling zelf; daarop wacht het laadscherm wel.
      if (settings.enableTTS) {
        await preloadTTSBatch(
          generatedModels.flatMap((model, i) => [
            { key: words[i], text: words[i] },
            { key: `${words[i]}:definitie`, text: model.definitie },
          ]).filter(item => item.text) // skip lege definities (failed words)
        );
        if (run !== setupRun.current) return;
      }

      setPhase('study_mode_selection');

    } catch (err) {
      if (run !== setupRun.current) return;
      console.error("Fout bij het opzetten van de sessie:", err);
      setError(categorizeError(err, 'Oefening voorbereiden'));
    }
  }, [words, settings, startQuiz]);

  useEffect(() => {
    if (words.length > 0) {
      setupSession();
    }
  }, [setupSession]);

  useEffect(() => {
    if (phase === 'studying') {
      setStudyPhaseStart(Date.now());
    }
  }, [phase]);

  const recordStudyTime = useCallback((word: string, seconds: number) => {
    setStudyTimings(prev => {
      const existingIndex = prev.findIndex(t => t.word === word);
      if (existingIndex > -1) {
        // Maak een nieuw object — niet inplace muteren — zodat React.memo correct werkt
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], seconds: updated[existingIndex].seconds + seconds };
        return updated;
      }
      return [...prev, { word, seconds }];
    });
  }, []);

  const recordQuizTime = useCallback((word: string, seconds: number) => {
    setQuizTimings(prev => [...prev, { word, seconds }]);
  }, []);

  const beginQuiz = useCallback(() => {
    setQuizPhaseStart(Date.now());
    setPhase('quiz');
  }, []);

  const handleStudyComplete = () => {
    if (quizStatus === 'ready') {
      beginQuiz();
    } else {
      // Vragen nog niet klaar (of mislukt): kort wachtscherm, daarna start de quiz vanzelf.
      setPhase('quiz_waiting');
    }
  };

  useEffect(() => {
    if (phase === 'quiz_waiting' && quizStatus === 'ready') {
      beginQuiz();
    }
  }, [phase, quizStatus, beginQuiz]);

  const handleQuizComplete = (score: number, results: QuizResult[]) => {
    const studyPhaseSeconds = studyPhaseStart ? (Date.now() - studyPhaseStart) / 1000 : 0;
    const quizPhaseSeconds = quizPhaseStart ? (Date.now() - quizPhaseStart) / 1000 : 0;

    const timingData: SessionTimingData = {
      studyPhaseSeconds,
      quizPhaseSeconds,
      studyItems: studyTimings,
      quizItems: quizTimings,
    };
    onFinish(score, results, frayerModels, studyMode, timingData);
  };

  if (error) {
    return (
      <ErrorBanner
        error={error}
        onRetry={() => setupSession()}
      />
    );
  }

  if (phase === 'loading') {
    return <LoadingIndicator />;
  }

  if (phase === 'quiz_waiting') {
    if (quizStatus === 'error' && quizError) {
      // Opnieuw proberen maakt enkel de quiz opnieuw en kan altijd; "Terug" brengt
      // de leerling naar de woorden, zodat dit scherm nooit een doodlopend straatje is.
      return (
        <ErrorBanner
          error={{ ...quizError, canRetry: true }}
          onRetry={() => startQuiz(frayerModels)}
          onBack={() => setPhase('studying')}
        />
      );
    }
    return <LoadingIndicator hint="Je quizvragen worden klaargemaakt..." />;
  }

  return (
    <>
      {/* Weak-words sessie? Speciale bonus-banner ipv de generieke filename-banner. */}
      {settings.customFileName === 'weak-words' ? (
        <div
          className="max-w-3xl mx-auto mb-4 px-4 py-3 rounded-xl flex items-center justify-center gap-3 text-white font-semibold shadow-md animate-fade-in"
          // Inline gradient — Tailwind CDN ondersteunt geen gradient utilities
          style={{ background: 'linear-gradient(90deg, #a855f7 0%, #ec4899 100%)' }}
        >
          <span className="text-2xl">🎯</span>
          <span>Je oefent nu je zwakke woorden — </span>
          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-white/25 text-xs font-extrabold tracking-wide">
            2× XP BONUS
          </span>
        </div>
      ) : settings.customFileName ? (
        <div className="max-w-3xl mx-auto mb-4 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium animate-fade-in">
          <span>📄</span>
          <span>Je oefent nu met: <strong>{settings.customFileName}</strong></span>
        </div>
      ) : null}

      {phase === 'study_mode_selection' && failedWords.length > 0 && (
        <div className="max-w-3xl mx-auto mb-4 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl flex items-start gap-3 text-sm animate-fade-in">
          <span className="text-xl shrink-0">⚠️</span>
          <div>
            <strong>Niet alle woorden konden gegenereerd worden:</strong>{' '}
            {failedWords.join(', ')}. De sessie gaat verder met de overige woorden.
          </div>
        </div>
      )}

      {phase === 'study_mode_selection' && (
        <div className="max-w-3xl mx-auto p-8 bg-surface rounded-2xl shadow-lg animate-fade-in">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-2">Klaar om te studeren?</h2>
            <p className="text-muted">Kies nu de beste strategie om de woorden te leren, voordat de quiz begint.</p>
          </div>

          <div className="bg-surface-alt p-6 rounded-lg border border-themed mb-8 space-y-4 text-left">
            <p>Denk even na over wat je wilt bereiken. Dit heet <strong>zelfregulatie</strong>: je kiest bewust de beste aanpak voor jezelf.</p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="text-2xl pt-1">📖</span>
                <div>
                  <strong className="text-primary">Frayer Model:</strong> Voor een <strong>uitgebreide en intensieve</strong> studie. Ideaal als de woorden helemaal nieuw voor je zijn.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-2xl pt-1">📇</span>
                <div>
                  <strong className="text-primary">Steekkaarten:</strong> Om je kennis <strong>snel te herhalen</strong> of te testen. Perfect als je de woorden al een beetje kent.
                </div>
              </li>
            </ul>
            <div className="flex items-center gap-3 p-3 bg-pro-tip text-pro-tip rounded-lg border-l-4 border-tal-gold mt-4">
              <span className="text-2xl">💡</span>
              <p className="font-semibold"><strong>Tip:</strong> Neem rustig de tijd. Reken op ongeveer <strong>2 minuten per woord</strong> voor het studeren en de quiz samen. Voor jouw selectie van {words.length} woorden is dat dus ongeveer <strong>{words.length * 2} minuten</strong>. Grondig leren is de sleutel tot succes!</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <button
              onClick={() => { setStudyMode('frayer'); setPhase('studying'); }}
              className="flex-1 p-6 bg-surface rounded-xl shadow-md hover:shadow-lg hover:-translate-y-1 transition-all transform border border-themed text-center"
            >
              <span role="img" aria-label="Boek" className="text-5xl mb-3 block">📖</span>
              <h3 className="font-bold text-xl">Start met Frayer Model</h3>
              <p className="text-sm text-muted mt-1">Diepgaand leren</p>
            </button>
            <button
              onClick={() => { setStudyMode('flashcards'); setPhase('studying'); }}
              className="flex-1 p-6 bg-surface rounded-xl shadow-md hover:shadow-lg hover:-translate-y-1 transition-all transform border border-themed text-center"
            >
              <span role="img" aria-label="Steekkaarten" className="text-5xl mb-3 block">📇</span>
              <h3 className="font-bold text-xl">Start met Steekkaarten</h3>
              <p className="text-sm text-muted mt-1">Snel herhalen</p>
            </button>
          </div>
        </div>
      )}

      {phase === 'studying' && (
        studyMode === 'frayer' ? (
          <FrayerModelView models={frayerModels} words={words} onComplete={handleStudyComplete} showSynonymsAntonyms={settings.showSynonymsAntonyms} settings={settings} onRecordStudyTime={recordStudyTime} />
        ) : (
          <FlashcardView models={frayerModels} words={words} onComplete={handleStudyComplete} onRecordStudyTime={recordStudyTime} settings={settings} />
        )
      )}

      {phase === 'quiz' && (
        <QuizView questions={quizQuestions} onComplete={handleQuizComplete} onRecordQuizTime={recordQuizTime} />
      )}
    </>
  );
};

export default PracticeSession;
