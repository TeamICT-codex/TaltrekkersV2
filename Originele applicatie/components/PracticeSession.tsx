
import React, { useState, useEffect, useCallback } from 'react';
import { FrayerModelData, PracticeSettings, QuizQuestion, QuizResult, StudyItemTiming, QuizItemTiming, SessionTimingData } from '../types';
import { generateFrayerModel, generateQuizQuestions } from '../services/geminiService';
import LoadingIndicator from './LoadingIndicator';
import FrayerModelView from './FrayerModelView';
import QuizView from './QuizView';
import FlashcardView from './FlashcardView';
import { ALL_PREDEFINED_MODELS } from '../constants';

interface PracticeSessionProps {
  words: string[];
  settings: PracticeSettings;
  onFinish: (sessionScore: number, quizResults: QuizResult[], frayerModels: FrayerModelData[], studyMode: 'frayer' | 'flashcards', timingData: SessionTimingData) => void;
}

type StudyMode = 'frayer' | 'flashcards';
type SessionPhase = 'loading' | 'study_mode_selection' | 'studying' | 'quiz';

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

const PracticeSession: React.FC<PracticeSessionProps> = ({ words, settings, onFinish }) => {
  const [phase, setPhase] = useState<SessionPhase>('loading');
  const [frayerModels, setFrayerModels] = useState<FrayerModelData[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [studyMode, setStudyMode] = useState<StudyMode>('frayer');

  const [studyPhaseStart, setStudyPhaseStart] = useState<number | null>(null);
  const [quizPhaseStart, setQuizPhaseStart] = useState<number | null>(null);
  const [studyTimings, setStudyTimings] = useState<StudyItemTiming[]>([]);
  const [quizTimings, setQuizTimings] = useState<QuizItemTiming[]>([]);

  const setupSession = useCallback(async () => {
    try {
      setError(null);
      setPhase('loading');
      
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

      const generatedModels = await Promise.all(modelPromises);
      setFrayerModels(generatedModels);

      const generatedQuestions = await generateQuizQuestions(generatedModels, words, {
          aiModel: settings.aiModel,
          context: settings.context,
          difficulty: settings.difficulty
      });
      
      // Randomize quiz questions immediately upon generation
      setQuizQuestions(shuffleArray(generatedQuestions));
      setPhase('study_mode_selection');

    } catch (err) {
      console.error("Fout bij het opzetten van de sessie:", err);
      setError("Er is een fout opgetreden bij het voorbereiden van de oefening. De AI kon de data niet genereren.");
    }
  }, [words, settings]);

  useEffect(() => {
    if (words.length > 0) {
      setupSession();
    }
  }, [setupSession, words.length]);
  
  useEffect(() => {
    if (phase === 'studying') {
        setStudyPhaseStart(Date.now());
    }
  }, [phase]);

  const recordStudyTime = useCallback((word: string, seconds: number) => {
    setStudyTimings(prev => {
        const existingIndex = prev.findIndex(t => t.word === word);
        if (existingIndex > -1) {
            const updated = [...prev];
            updated[existingIndex].seconds += seconds;
            return updated;
        }
        return [...prev, { word, seconds }];
    });
  }, []);

  const recordQuizTime = useCallback((word: string, seconds: number) => {
    setQuizTimings(prev => [...prev, { word, seconds }]);
  }, []);

  const handleStudyComplete = () => {
    setQuizPhaseStart(Date.now());
    setPhase('quiz');
  };

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
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center p-8 bg-white border-2 border-red-100 shadow-xl rounded-2xl max-w-lg mx-auto">
                <div className="text-5xl mb-4">⚠️</div>
                <h3 className="font-bold text-xl text-slate-800 mb-2">Oeps, er ging iets mis!</h3>
                <p className="text-slate-600 mb-6">{error}</p>
                <button 
                    onClick={() => setupSession()} 
                    className="px-6 py-3 bg-tal-purple text-white font-bold rounded-lg hover:bg-tal-purple-dark transition-colors"
                >
                    Probeer opnieuw
                </button>
            </div>
        </div>
    );
  }

  if (phase === 'loading') {
    return <LoadingIndicator />;
  }

  return (
      <>
          {/* PDF/File Preview Header */}
          {settings.customFileName && (
              <div className="max-w-3xl mx-auto mb-4 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium animate-fade-in">
                  <span>📄</span>
                  <span>Je oefent nu met: <strong>{settings.customFileName}</strong></span>
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
