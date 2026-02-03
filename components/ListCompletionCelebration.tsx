import React, { useEffect, useState } from 'react';

interface ListCompletionCelebrationProps {
    listName: string;
    achievementType: 'practiced' | 'mastered';
    totalWords: number;
    bonusPoints: number;
    onClose: () => void;
}

const ListCompletionCelebration: React.FC<ListCompletionCelebrationProps> = ({
    listName,
    achievementType,
    totalWords,
    bonusPoints,
    onClose
}) => {
    const [confettiPieces, setConfettiPieces] = useState<Array<{ id: number; left: number; delay: number; color: string }>>([]);

    useEffect(() => {
        // Generate confetti particles
        const colors = achievementType === 'mastered'
            ? ['#FFD700', '#FFA500', '#FF6B35', '#FFE66D', '#4ECDC4'] // Gold/trophy colors
            : ['#3B82F6', '#60A5FA', '#93C5FD', '#A78BFA', '#C4B5FD']; // Blue/progress colors

        const pieces = Array.from({ length: 50 }, (_, i) => ({
            id: i,
            left: Math.random() * 100,
            delay: Math.random() * 2,
            color: colors[Math.floor(Math.random() * colors.length)]
        }));
        setConfettiPieces(pieces);
    }, [achievementType]);

    const isPracticed = achievementType === 'practiced';
    const emoji = isPracticed ? '🎯' : '🏆';
    const title = isPracticed ? 'Woordenlijst Doorlopen!' : 'Woordenlijst Gemeesterd!';
    const subtitle = isPracticed
        ? `Je hebt alle ${totalWords} woorden minstens één keer geoefend!`
        : `Je kent alle ${totalWords} woorden zonder fouten!`;
    const message = isPracticed
        ? 'Ga zo door! Blijf oefenen tot je alle woorden perfect kent.'
        : 'Fantastisch! Je bent een echte woordmeester! 🌟';

    return (
        <div
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in"
            style={{ animationDuration: '300ms' }}
        >
            {/* Confetti */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                {confettiPieces.map(piece => (
                    <div
                        key={piece.id}
                        className="absolute w-3 h-3 rounded-sm animate-confetti"
                        style={{
                            left: `${piece.left}%`,
                            top: '-20px',
                            backgroundColor: piece.color,
                            animationDelay: `${piece.delay}s`,
                            animationDuration: '3s',
                        }}
                    />
                ))}
            </div>

            {/* Modal */}
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md mx-4 text-center relative z-10 animate-bounce-in">
                {/* Trophy/Target emoji */}
                <div className="text-7xl mb-4 animate-pulse">
                    {emoji}
                </div>

                {/* Title */}
                <h2 className={`text-2xl font-bold mb-2 ${isPracticed ? 'text-blue-600' : 'text-amber-600'}`}>
                    {title}
                </h2>

                {/* List name */}
                <p className="text-lg text-slate-700 font-medium mb-2">
                    {listName}
                </p>

                {/* Subtitle */}
                <p className="text-slate-600 mb-4">
                    {subtitle}
                </p>

                {/* Bonus points */}
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 ${isPracticed ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                    <span className="text-xl">✨</span>
                    <span className="font-bold">+{bonusPoints} XP bonus!</span>
                </div>

                {/* Message */}
                <p className="text-slate-500 text-sm mb-6">
                    {message}
                </p>

                {/* Close button */}
                <button
                    onClick={onClose}
                    className={`w-full py-3 px-6 rounded-xl font-semibold text-white transition-all transform hover:scale-105 ${isPracticed
                            ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
                            : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700'
                        }`}
                >
                    {isPracticed ? 'Verder oefenen! 💪' : 'Geweldig! 🎉'}
                </button>
            </div>

            <style>{`
                @keyframes confetti {
                    0% {
                        transform: translateY(0) rotate(0deg);
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(100vh) rotate(720deg);
                        opacity: 0;
                    }
                }
                .animate-confetti {
                    animation: confetti 3s ease-out forwards;
                }
                @keyframes bounce-in {
                    0% {
                        transform: scale(0.3);
                        opacity: 0;
                    }
                    50% {
                        transform: scale(1.05);
                    }
                    70% {
                        transform: scale(0.95);
                    }
                    100% {
                        transform: scale(1);
                        opacity: 1;
                    }
                }
                .animate-bounce-in {
                    animation: bounce-in 0.5s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default ListCompletionCelebration;
