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
}

const SessionSummary: React.FC<SessionSummaryProps> = ({ summaryData, onClose, snakeTokens = 0, dragonTokens = 0, onSpendToken }) => {
    const { quizResults, earnedXP, weakWordsBonus } = summaryData;
    const correctCount = quizResults.filter(r => r.correct).length;
    const totalCount = quizResults.length;
    const accuracy = totalCount > 0 ? correctCount / totalCount : 0;
    // Toon de reward-sectie alleen als er minstens één token beschikbaar is.
    // Tokens worden in usePracticeSession.finishPractice toegekend, dus tegen de tijd dat we hier
    // renderen zit de net-verdiende token er al in.
    const showRewardSection = onSpendToken && (snakeTokens > 0 || dragonTokens > 0);

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

            {/* Reward sectie — Sneek/Droak ontgrendeld bij goede sessie of XP-mijlpaal */}
            {showRewardSection && (
                <div className="relative z-20 my-6 p-4 rounded-2xl bg-gradient-to-br from-tal-purple to-tal-teal-dark border border-white/10 shadow-lg">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">🎁</span>
                        <div>
                            <h3 className="text-base font-bold text-white">Beloning vrijgespeeld!</h3>
                            <p className="text-xs text-white/70">
                                {accuracy >= 0.8 ? 'Top score — pak je Sneek-token. ' : ''}
                                {dragonTokens > 0 ? 'Een Droak-mijlpaal staat klaar.' : ''}
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

            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4 relative z-20">
                <button
                    onClick={() => onClose('welcome')}
                    className="w-full sm:w-auto px-8 py-4 bg-tal-purple text-white font-bold text-lg rounded-xl shadow-lg hover:bg-tal-purple-dark transform active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3"
                >
                    <span role="img" aria-label="Boek">📖</span> Nieuwe Oefening
                </button>
                <button
                    onClick={() => onClose('dashboard')}
                    className="w-full sm:w-auto px-8 py-4 bg-white text-slate-700 font-bold text-lg rounded-xl shadow-md hover:bg-slate-100 border border-slate-200 transform active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3"
                >
                    <span role="img" aria-label="Grafiek">📊</span> Dashboard
                </button>
            </div>
        </div>
    );
};

export default SessionSummary;