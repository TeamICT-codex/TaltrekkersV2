import React, { useEffect, useState } from 'react';
import { SessionSummaryData } from '../types';
import RewardLauncher from './RewardLauncher';

const ScoreCircle: React.FC<{ score: number, total: number }> = ({ score, total }) => {
    const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
    const [displayPercentage, setDisplayPercentage] = useState(0);
    const radius = 90;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (displayPercentage / 100) * circumference;

    useEffect(() => {
        let start = 0;
        const end = percentage;
        if (start === end) return;
        const duration = 1500;
        const incrementTime = (duration / end) || 0;

        const timer = setInterval(() => {
            start += 1;
            setDisplayPercentage(start);
            if (start === end) clearInterval(timer);
        }, incrementTime);

        return () => clearInterval(timer);
    }, [percentage]);

    return (
        <div className="relative w-52 h-52">
            <svg className="w-full h-full" viewBox="0 0 200 200" role="img" aria-label={`Score: ${percentage}%`}>
                <circle
                    className="text-slate-200"
                    strokeWidth="10"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx="100"
                    cy="100"
                />
                <circle
                    className="text-tal-teal"
                    strokeWidth="10"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx="100"
                    cy="100"
                    style={{ transition: 'stroke-dashoffset 0.35s', transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                />
            </svg>
            <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center">
                <span className="text-5xl font-bold text-tal-teal">{displayPercentage}%</span>
                <span className="text-slate-500 font-semibold">{score}/{total} goed</span>
            </div>
        </div>
    );
};

interface SessionSummaryProps {
    summaryData: SessionSummaryData;
    onClose: (destination: 'welcome' | 'dashboard') => void;
    snakeTokens?: number;
    dragonTokens?: number;
    onSpendToken?: (mode: 'snake' | 'dragon') => void;
    /**
     * Optionele callback: "Volgende sessie uit deze lijst". Wordt aangeroepen
     * met de listId (= customFileName of context van de net-afgeronde sessie).
     * Implementatie zit in App.tsx en gebruikt prepareResumeList om de volgende
     * sessie direct te starten zonder PracticeSetup-tussenstap.
     */
    onContinueList?: (listId: string) => void;
    /** Voortgang voor de huidige lijst — gebruikt om de "Volgende sessie" knop te tonen + label. */
    listProgress?: { total: number; practiced: number };
}

const SessionSummary: React.FC<SessionSummaryProps> = ({ summaryData, onClose, snakeTokens = 0, dragonTokens = 0, onSpendToken, onContinueList, listProgress }) => {
    const { quizResults, earnedXP, weakWordsBonus, settings, earnedSnakeTokens = 0 } = summaryData;
    // ListId = customFileName voor opgeladen lijsten, of context voor algemene lijsten
    const listId = settings?.customFileName || settings?.context || null;
    const canContinueList = !!onContinueList && !!listId && !!listProgress && listProgress.total > 0;
    const remainingNew = listProgress ? Math.max(0, listProgress.total - listProgress.practiced) : 0;
    const correctCount = quizResults.filter(r => r.correct).length;
    const totalCount = quizResults.length;
    const accuracy = totalCount > 0 ? correctCount / totalCount : 0;
    // Toon de reward-sectie alleen als er minstens één token beschikbaar is.
    // Tokens worden in usePracticeSession.finishPractice toegekend, dus tegen de tijd dat we hier
    // renderen zit de net-verdiende token er al in.
    const showRewardSection = onSpendToken && (snakeTokens > 0 || dragonTokens > 0);
    // Onderscheid: net verdiend in DEZE sessie vs. accumulatief uit eerdere sessies.
    // Bepaalt of we "🎁 Beloning vrijgespeeld!" of "🎮 Je hebt nog X tokens klaar" tonen.
    const justEarnedToken = earnedSnakeTokens > 0;

    return (
        <div className="relative max-w-4xl mx-auto p-6 sm:p-8 bg-white rounded-2xl shadow-lg animate-fade-in overflow-hidden z-10">
            <div className="relative z-20 text-center">
                <div className="flex justify-center mb-4 text-7xl">
                    <span role="img" aria-label="Trofee">🏆</span>
                </div>
                <h2 className="text-3xl font-bold text-slate-800">Sessie voltooid!</h2>
                <p className="text-slate-500 mt-2">Goed gedaan! Elke oefening is een stap vooruit.</p>
            </div>

            <div className="flex justify-center my-8 relative z-20">
                <ScoreCircle score={correctCount} total={totalCount} />
            </div>

            {/* Prominent XP Earned Display */}
            {earnedXP && earnedXP > 0 && (
                <div className="flex flex-col items-center gap-2 mb-6 relative z-20">
                    <div
                        className="text-white px-6 py-3 rounded-full shadow-lg animate-bounce-in flex items-center gap-2"
                        // Inline gradient — Tailwind CDN ondersteunt geen gradient utilities
                        style={{
                            background: weakWordsBonus
                                ? 'linear-gradient(90deg, #a855f7 0%, #ec4899 100%)'
                                : 'linear-gradient(90deg, #fbbf24 0%, #f97316 100%)',
                        }}
                    >
                        <span className="text-2xl">{weakWordsBonus ? '🎯' : '⭐'}</span>
                        <span className="text-xl font-bold">+{earnedXP} XP verdiend!</span>
                        {weakWordsBonus && (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-white/25 text-xs font-extrabold tracking-wide">
                                2× BONUS
                            </span>
                        )}
                    </div>
                    {weakWordsBonus && (
                        <p className="text-sm font-semibold text-purple-700 animate-fade-in">
                            🔥 Knap! Zwakke woorden oefenen levert dubbel XP op.
                        </p>
                    )}
                </div>
            )}

            {/* Reward sectie — Sneek/Droak ontgrendeld bij goede sessie OF accumulatief beschikbaar.
                Onderscheid: net verdiend deze sessie (groot, viering) vs. nog beschikbaar uit
                eerdere sessies (subtieler, "vergeet niet te spelen"). */}
            {showRewardSection && (
                <div
                    className="relative z-20 my-6 p-4 rounded-2xl border border-white/10 shadow-lg"
                    style={{
                        background: justEarnedToken
                            ? 'linear-gradient(135deg, #4c1d95 0%, #134e4a 100%)'  // paars→teal: vol
                            : 'linear-gradient(135deg, #1e293b 0%, #0f766e 100%)', // slate→teal: rustiger
                    }}
                >
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">{justEarnedToken ? '🎁' : '🎮'}</span>
                        <div className="flex-1">
                            <h3 className="text-base font-bold text-white">
                                {justEarnedToken
                                    ? 'Beloning vrijgespeeld!'
                                    : `Je hebt nog ${snakeTokens} Sneek-token${snakeTokens === 1 ? '' : 's'} klaar`}
                            </h3>
                            <p className="text-xs text-white/70">
                                {justEarnedToken
                                    ? `Top sessie — je verdiende een nieuwe Sneek-token!`
                                    : 'Speel ze hieronder af, of klik later op de 🐍 chip in de header.'}
                            </p>
                        </div>
                    </div>
                    <RewardLauncher
                        snakeTokens={snakeTokens}
                        dragonTokens={dragonTokens}
                        onSpend={onSpendToken!}
                    />
                </div>
            )}

            <div className="relative z-20">
                <h3 className="text-lg font-semibold text-center mb-4 text-slate-700">Jouw antwoorden</h3>
                <div className="max-h-60 overflow-y-auto bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <ul className="divide-y divide-slate-200">
                        {quizResults.map(result => (
                            <li key={result.word} className="py-2 flex justify-between items-center">
                                <span className="font-medium text-slate-700">{result.word}</span>
                                <span className={`font-bold ${result.correct ? 'text-green-600' : 'text-red-600'}`}>
                                    {result.correct ? '✅ Correct' : '❌ Incorrect'}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Voortgang in deze lijst — alleen tonen als we een listId hebben */}
            {canContinueList && listProgress && (
                <div className="mt-6 relative z-20 mx-auto max-w-md text-center">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <p className="text-sm font-semibold text-slate-700 mb-2">
                            📚 Voortgang in deze lijst
                        </p>
                        <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
                            <span className="font-mono">{listProgress.practiced}/{listProgress.total}</span>
                            <span className="font-bold">{Math.round((listProgress.practiced / listProgress.total) * 100)}%</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                                className="h-full transition-all duration-700"
                                style={{
                                    width: `${(listProgress.practiced / listProgress.total) * 100}%`,
                                    background: remainingNew === 0
                                        ? 'linear-gradient(90deg, #a855f7 0%, #ec4899 100%)'
                                        : 'linear-gradient(90deg, #14b8a6 0%, #10b981 100%)',
                                }}
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            {remainingNew > 0
                                ? `Nog ${remainingNew} nieuw${remainingNew === 1 ? '' : 'e'} woord${remainingNew === 1 ? '' : 'en'} te ontdekken`
                                : '✨ Lijst helemaal doorlopen! Volgende sessie focust op woorden die nog fout zaten.'}
                        </p>
                    </div>
                </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3 relative z-20">
                {canContinueList && (
                    <button
                        onClick={() => onContinueList!(listId!)}
                        className="w-full sm:w-auto px-6 py-4 text-white font-bold text-base rounded-xl shadow-lg transform active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3"
                        style={{
                            background: remainingNew === 0
                                ? 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)'
                                : 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                        }}
                    >
                        <span role="img" aria-label="Vooruit">▶️</span>
                        {remainingNew === 0 ? 'Consolidatie-sessie' : 'Volgende sessie uit deze lijst'}
                    </button>
                )}
                <button
                    onClick={() => onClose('welcome')}
                    className="w-full sm:w-auto px-6 py-4 bg-tal-purple text-white font-bold text-base rounded-xl shadow-lg hover:bg-tal-purple-dark transform active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3"
                >
                    <span role="img" aria-label="Boek">📖</span>
                    {canContinueList ? 'Andere lijst' : 'Nieuwe Oefening'}
                </button>
                <button
                    onClick={() => onClose('dashboard')}
                    className="w-full sm:w-auto px-6 py-4 bg-white text-slate-700 font-bold text-base rounded-xl shadow-md hover:bg-slate-100 border border-slate-200 transform active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3"
                >
                    <span role="img" aria-label="Grafiek">📊</span> Dashboard
                </button>
            </div>
        </div>
    );
};

export default SessionSummary;