
import React, { useState, useEffect } from 'react';
import { QuizQuestion, QuizResult, QuestionType, PracticeSettings } from '../types';
import { CheckIcon } from './icons/CheckIcon';
import { XIcon } from './icons/XIcon';
import { generateFeedbackForError } from '../services/geminiService';
import Spinner from './Spinner';

interface QuizViewProps {
  questions: QuizQuestion[];
  onComplete: (score: number, results: QuizResult[]) => void;
  onRecordQuizTime: (word: string, seconds: number) => void;
}

const QuizView: React.FC<QuizViewProps> = ({ questions, onComplete, onRecordQuizTime }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);

  const currentQuestion = questions?.[currentQuestionIndex];
  // Get list of all words for the word bank (for writing questions)
  const allWords = questions ? questions.map(q => q.woord).sort() : [];

  // State for Hints
  const [hintsRemaining, setHintsRemaining] = useState(5);
  const [eliminatedOptions, setEliminatedOptions] = useState<number[]>([]);
  const [simplifiedQuestions, setSimplifiedQuestions] = useState<Record<string, string>>({});
  const [isSimplifying, setIsSimplifying] = useState(false);
  const [showSimplified, setShowSimplified] = useState(false);

  useEffect(() => {
    setQuestionStartTime(Date.now());
    setFeedbackMessage(null);
    setTextAnswer('');
    // Reset hints
    setEliminatedOptions([]);
    setShowSimplified(false);
  }, [currentQuestionIndex]);

  if (!questions || questions.length === 0 || !currentQuestion) {
    return (
      <div className="text-center p-8 bg-yellow-900 border border-yellow-600 text-yellow-200 rounded-lg">
        <h3 className="text-xl font-bold">Quiz niet beschikbaar</h3>
        <p>De AI kon geen quiz genereren voor deze woorden. Probeer het opnieuw.</p>
        <button onClick={() => onComplete(0, [])} className="mt-4 px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600">
          Sessie overslaan
        </button>
      </div>
    );
  }

  const handle5050Hint = () => {
    if (hintsRemaining <= 0 || eliminatedOptions.length > 0 || currentQuestion.type !== QuestionType.MultipleChoice) return;

    setHintsRemaining(prev => prev - 1);

    const correctIndex = currentQuestion.correctAntwoordIndex;
    const incorrectIndices = currentQuestion.opties
      .map((_, idx) => idx)
      .filter(idx => idx !== correctIndex);

    // Shuffle and pick 2 to eliminate (or fewer if fewer options exist)
    const shuffled = incorrectIndices.sort(() => 0.5 - Math.random());
    const toEliminate = shuffled.slice(0, 2);
    setEliminatedOptions(toEliminate);
  };

  const handleSimplifyHint = async () => {
    if (showSimplified) {
      setShowSimplified(false);
      return;
    }

    if (simplifiedQuestions[currentQuestion.vraag]) {
      setShowSimplified(true);
      return;
    }

    if (hintsRemaining <= 0) return;

    setIsSimplifying(true);
    try {
      setHintsRemaining(prev => prev - 1);
      // Use 'fast' model for UI responsiveness
      const simplified = await import('../services/geminiService').then(m => m.simplifyQuestion(currentQuestion.vraag, { aiModel: 'fast' }));
      setSimplifiedQuestions(prev => ({ ...prev, [currentQuestion.vraag]: simplified }));
      setShowSimplified(true);
    } catch (error) {
      console.error("Failed to simplify:", error);
      setHintsRemaining(prev => prev + 1); // Refund on error
    } finally {
      setIsSimplifying(false);
    }
  };

  const processAnswer = async (isCorrect: boolean, userAnswerStr: string) => {
    const seconds = (Date.now() - questionStartTime) / 1000;
    onRecordQuizTime(currentQuestion.woord, seconds);

    setIsAnswered(true);

    if (isCorrect) {
      setScore(prevScore => prevScore + 1);
      // setFeedbackMessage(null); // Keep previous feedback if any? No, reset.
    } else {
      // Trigger Context-Aware Feedback
      setIsFeedbackLoading(true);
      try {
        const correctAnswer = currentQuestion.woord;
        const feedback = await generateFeedbackForError(currentQuestion.vraag, userAnswerStr, correctAnswer, { aiModel: 'fast' });
        setFeedbackMessage(feedback);
      } catch (e) {
        setFeedbackMessage("Jammer, dat was niet goed. Probeer het volgende keer opnieuw!");
      } finally {
        setIsFeedbackLoading(false);
      }
    }

    setQuizResults(prevResults => [
      ...prevResults,
      { word: currentQuestion.woord, correct: isCorrect }
    ]);
  };

  const handleMCAnswer = (answerIndex: number) => {
    if (isAnswered || eliminatedOptions.includes(answerIndex)) return;
    setSelectedAnswer(answerIndex);
    const isCorrect = answerIndex === currentQuestion.correctAntwoordIndex;
    const userAnswerStr = currentQuestion.opties[answerIndex];
    processAnswer(isCorrect, userAnswerStr);
  };

  const handleTextAnswer = () => {
    if (isAnswered || !textAnswer.trim()) return;
    const isCorrect = textAnswer.trim().toLowerCase() === currentQuestion.woord.toLowerCase();
    processAnswer(isCorrect, textAnswer);
  };

  const handleNext = () => {
    setIsAnswered(false);
    setSelectedAnswer(null);
    setFeedbackMessage(null); // Clear feedback
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      onComplete(score, quizResults);
    }
  };

  const getButtonClass = (index: number) => {
    if (eliminatedOptions.includes(index)) {
      return "invisible opacity-0 pointer-events-none"; // Hide eliminated options
    }

    if (!isAnswered) {
      return "bg-white/10 border-white/20 hover:bg-white/20 hover:border-white/30 text-slate-100";
    }
    if (index === currentQuestion.correctAntwoordIndex) {
      return "bg-green-500/30 border-green-500 text-white animate-pulse-once";
    }
    if (index === selectedAnswer) {
      return "bg-red-500/30 border-red-500 text-slate-300";
    }
    return "bg-black/20 border-transparent text-slate-400 cursor-not-allowed";
  };

  return (
    <div className="max-w-3xl mx-auto p-6 sm:p-8 bg-tal-teal text-slate-200 rounded-2xl shadow-2xl relative">
      <div className="flex justify-between items-baseline mb-8">
        <p className="font-semibold text-slate-300">Vraag {currentQuestionIndex + 1} van {questions.length}</p>

        <div className="flex items-center gap-4">
          <div className={`flex items-center px-3 py-1 rounded-full border ${hintsRemaining > 0 ? 'bg-indigo-900/40 border-indigo-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
            <span className="text-yellow-400 mr-2 text-sm">💡 Hints:</span>
            <span className={`font-bold ${hintsRemaining === 0 ? 'text-red-400' : 'text-white'}`}>{hintsRemaining}</span>
          </div>

          {/* Hint Buttons */}
          {!isAnswered && hintsRemaining > 0 && (
            <div className="flex gap-2">
              {currentQuestion.type === QuestionType.MultipleChoice && (
                <button
                  onClick={handle5050Hint}
                  disabled={eliminatedOptions.length > 0}
                  title="50/50: Streep 2 foute antwoorden weg (Kost 1 hint)"
                  className={`p-2 rounded-full bg-blue-500/20 text-blue-300 hover:bg-blue-500/40 border border-blue-500/50 transition-all ${eliminatedOptions.length > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className="text-xs font-bold">50/50</span>
                </button>
              )}

              <button
                onClick={handleSimplifyHint}
                disabled={isSimplifying}
                title={simplifiedQuestions[currentQuestion.vraag] ? "Toon vraag" : "Vereenvoudig de vraag (Kost 1 hint)"}
                className={`flex items-center gap-1 px-3 py-1 rounded-full border transition-all ${showSimplified ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700'}`}
              >
                {isSimplifying ? (
                  <Spinner className="h-3 w-3" />
                ) : (
                  <span className="text-lg">🗣️</span>
                )}
                <span className="text-xs font-medium">{isSimplifying ? 'Even vereenvoudigen...' : (showSimplified ? 'Originele vraag' : 'Taal te moeilijk?')}</span>
              </button>
            </div>
          )}
          <p className="font-bold text-lg text-tal-gold ml-2">Score: {score}</p>
        </div>
      </div>

      <div className="bg-black/20 p-6 rounded-xl mb-8 min-h-[120px] flex items-center justify-center flex-col transition-all duration-300">
        {currentQuestion.type === QuestionType.Writing && <span className="text-sm text-tal-gold font-bold uppercase mb-2 tracking-wider">✍️ Schrijfvraag</span>}

        {showSimplified && simplifiedQuestions[currentQuestion.vraag] ? (
          <div className="animate-fade-in text-center">
            <span className="text-xs text-amber-300 uppercase font-bold tracking-widest mb-1 block">Vereenvoudigde vraag</span>
            <p className="text-xl font-semibold text-white/90 italic">"{simplifiedQuestions[currentQuestion.vraag]}"</p>
          </div>
        ) : (
          <p className="text-xl font-semibold text-center text-white">{currentQuestion.vraag}</p>
        )}
      </div>

      {/* Multiple Choice Layout */}
      {currentQuestion.type === QuestionType.MultipleChoice && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentQuestion.opties.map((option, index) => (
            <button
              key={index}
              onClick={() => handleMCAnswer(index)}
              disabled={isAnswered || eliminatedOptions.includes(index)}
              className={`p-5 rounded-xl border text-center transition-all duration-300 transform focus:scale-[1.02] ${getButtonClass(index)}`}
            >
              <span className="font-medium text-lg">{option}</span>
            </button>
          ))}
        </div>
      )}

      {/* Writing Question Layout */}
      {currentQuestion.type === QuestionType.Writing && (
        <div className="space-y-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              disabled={isAnswered}
              placeholder="Typ het woord hier..."
              className="w-full p-4 rounded-xl bg-white/10 border border-white/30 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-tal-purple outline-none text-lg"
              onKeyDown={(e) => e.key === 'Enter' && handleTextAnswer()}
            />
            <button
              onClick={handleTextAnswer}
              disabled={isAnswered || !textAnswer.trim()}
              className="px-6 py-2 bg-tal-purple text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-tal-purple-dark transition"
            >
              Controleer
            </button>
          </div>

          {/* Word Bank Hint */}
          <div className="bg-white/5 p-4 rounded-xl border border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p className="text-xs text-slate-400 font-bold uppercase">Woordenbank (Hulp nodig?)</p>
              <p className="text-[11px] text-amber-300 font-medium">💡 Tip: Typ ook het lidwoord (de/het) als dat bij het woord hoort!</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {allWords.map(word => (
                <span key={word} className="px-2 py-1 bg-black/20 rounded text-sm text-slate-300 select-none">
                  {word}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {isAnswered && (
        <div className="mt-8 pt-6 border-t border-white/20 text-center animate-fade-in">
          {((currentQuestion.type === QuestionType.MultipleChoice && selectedAnswer === currentQuestion.correctAntwoordIndex) ||
            (currentQuestion.type === QuestionType.Writing && textAnswer.trim().toLowerCase() === currentQuestion.woord.toLowerCase())) ? (
            <div className="flex items-center justify-center text-green-400 mb-4">
              <CheckIcon className="h-8 w-8 mr-2" />
              <p className="font-bold text-xl">Correct!</p>
            </div>
          ) : (
            <div className="text-red-400 mb-4">
              <div className="flex items-center justify-center mb-2">
                <XIcon className="h-8 w-8 mr-2" />
                <p className="font-bold text-xl">Helaas!</p>
              </div>
              <p className="text-slate-200 mb-4">Het juiste antwoord was: <strong className="text-white">
                "{currentQuestion.type === QuestionType.MultipleChoice
                  ? currentQuestion.opties[currentQuestion.correctAntwoordIndex]
                  : currentQuestion.woord}"
              </strong></p>

              {/* Context Aware Feedback Area */}
              <div className="bg-red-900/30 p-4 rounded-lg border border-red-500/30 text-sm text-red-100 max-w-xl mx-auto">
                <p className="font-bold mb-1">💡 Feedback:</p>
                {isFeedbackLoading ? (
                  <div className="flex justify-center py-2"><Spinner className="h-4 w-4 text-red-200" /></div>
                ) : (
                  <p className="italic">{feedbackMessage}</p>
                )}
              </div>
            </div>
          )}
          <button onClick={handleNext} className="mt-6 w-full md:w-auto px-10 py-4 bg-tal-purple text-white font-bold text-lg rounded-xl shadow-lg hover:bg-tal-purple-dark transform hover:scale-105 active:scale-[0.98] transition-all duration-300">
            {currentQuestionIndex < questions.length - 1 ? 'Volgende vraag' : 'Sessie Afronden'}
          </button>
        </div>
      )}
    </div>
  );
};

export default QuizView;
