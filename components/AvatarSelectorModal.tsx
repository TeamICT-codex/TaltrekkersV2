import React from 'react';
import { Avatar } from '../types';
import { CheckIcon } from './icons/CheckIcon';

// Avatars centraal gedefinieerd hier; eerder zaten ze in Welcome.tsx.
// Wordt gebruikt door zowel de modal als door de Header (om huidige
// avatar emoji/naam te tonen).
export const AVATARS: Avatar[] = [
    { id: 'default', emoji: '👤', name: 'Starter', cost: 0 },
    { id: 'nerd', emoji: '🤓', name: 'Boekenwurm', cost: 100 },
    { id: 'rocket', emoji: '🚀', name: 'Raket', cost: 300 },
    { id: 'brain', emoji: '🧠', name: 'Breinbaas', cost: 500 },
    { id: 'wizard', emoji: '🧙', name: 'Taaltovenaar', cost: 1000 },
    { id: 'detective', emoji: '🕵️', name: 'Woordspeurder', cost: 1500 },
    { id: 'star', emoji: '⭐', name: 'Superster', cost: 2000 },
    { id: 'lion', emoji: '🦁', name: 'Taalleeuw', cost: 3000 },
];

export const getAvatarById = (avatarId: string | undefined): Avatar => {
    return AVATARS.find(a => a.id === avatarId) || AVATARS[0];
};

interface AvatarSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    points: number;
    currentAvatarId: string;
    studentName: string;
    onUpdateAvatar: (userName: string, avatarId: string) => void;
}

const AvatarSelectorModal: React.FC<AvatarSelectorModalProps> = ({
    isOpen, onClose, points, currentAvatarId, studentName, onUpdateAvatar,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-2xl font-bold text-slate-800">Kies je avatar</h3>
                    <button
                        onClick={onClose}
                        aria-label="Sluiten"
                        className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                    >
                        ✕
                    </button>
                </div>
                <p className="text-slate-600 mb-6">Gebruik je XP om nieuwe avatars vrij te spelen!</p>
                <div className="grid grid-cols-4 gap-4 mb-6">
                    {AVATARS.map(avatar => {
                        const isUnlocked = points >= avatar.cost;
                        const isSelected = currentAvatarId === avatar.id;
                        return (
                            <button
                                key={avatar.id}
                                type="button"
                                onClick={() => {
                                    if (isUnlocked && studentName) {
                                        onUpdateAvatar(studentName, avatar.id);
                                        onClose();
                                    }
                                }}
                                disabled={!isUnlocked}
                                title={isUnlocked ? `Kies ${avatar.name}` : `Vrijspelen vanaf ${avatar.cost} XP`}
                                className={`relative p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2
                                    ${isSelected ? 'border-tal-purple bg-tal-purple/10' : 'border-slate-200'}
                                    ${!isUnlocked ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:border-tal-purple/50 cursor-pointer hover:scale-105'}
                                `}
                            >
                                <div className="text-4xl">{avatar.emoji}</div>
                                <div className="text-xs font-bold text-slate-600 text-center">{avatar.name}</div>
                                {!isUnlocked && (
                                    <div className="absolute top-1 right-1 text-xs bg-slate-600 text-white px-1.5 rounded-full">🔒 {avatar.cost}</div>
                                )}
                                {isSelected && (
                                    <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full p-0.5">
                                        <CheckIcon className="w-3 h-3" />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
                <div className="text-center text-sm text-slate-500">
                    Jouw saldo: <span className="font-bold text-tal-gold">{points} XP</span>
                </div>
            </div>
        </div>
    );
};

export default AvatarSelectorModal;
