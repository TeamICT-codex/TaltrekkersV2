import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { submitFeedback } from '../services/db';

// Feedback wachtwoord voor niet-ingelogde leerkrachten
const FEEDBACK_PASSWORD = import.meta.env.VITE_FEEDBACK_PASSWORD || 'TALFEEDBACK';

interface FeedbackButtonProps {
    className?: string;
}

const FeedbackButton: React.FC<FeedbackButtonProps> = ({ className = '' }) => {
    const { user, role } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [passwordError, setPasswordError] = useState('');

    // Form state
    const [name, setName] = useState('');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const isTeacher = role === 'teacher';

    const handleOpenModal = () => {
        if (isTeacher) {
            // Ingelogde teachers mogen direct door
            setIsAuthorized(true);
            if (user?.email) {
                setName(user.email.split('@')[0]);
            }
        }
        setIsModalOpen(true);
    };

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordInput === FEEDBACK_PASSWORD) {
            setIsAuthorized(true);
            setPasswordError('');
        } else {
            setPasswordError('Onjuist wachtwoord.');
        }
    };

    const handleFeedbackSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || !name.trim()) return;

        setIsSubmitting(true);
        setSubmitStatus('idle');

        const result = await submitFeedback(
            user?.id || null,
            user?.email || `${name.trim()}@feedback.local`,
            name.trim(),
            message.trim()
        );

        setIsSubmitting(false);

        if (result.success) {
            setSubmitStatus('success');
            setTimeout(() => {
                setIsModalOpen(false);
                setMessage('');
                setSubmitStatus('idle');
                setIsAuthorized(isTeacher);
                setPasswordInput('');
            }, 2000);
        } else {
            setSubmitStatus('error');
        }
    };

    const handleClose = () => {
        setIsModalOpen(false);
        setMessage('');
        setPasswordInput('');
        setPasswordError('');
        setSubmitStatus('idle');
        setIsAuthorized(isTeacher);
    };

    return (
        <>
            <button
                onClick={handleOpenModal}
                className={`flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-amber-400 to-orange-400 text-white font-semibold text-sm rounded-lg shadow-md hover:from-amber-500 hover:to-orange-500 transition-all duration-200 active:transform active:scale-95 ${className}`}
                aria-label="Feedback geven"
                title="Geef feedback over de app"
            >
                <span className="text-lg">💬</span>
                <span className="hidden md:inline">Feedback</span>
            </button>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-surface w-full max-w-md rounded-2xl shadow-2xl border border-themed overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-6 py-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                💬 Feedback geven
                            </h2>
                            <button
                                onClick={handleClose}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                                title="Sluiten"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6">
                            {!isAuthorized ? (
                                // Password gate voor niet-ingelogde leerkrachten
                                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                                    <p className="text-muted text-sm">
                                        Ben je leerkracht en wil je feedback geven? Voer het leerkracht-wachtwoord in om door te gaan.
                                    </p>
                                    <input
                                        type="password"
                                        value={passwordInput}
                                        onChange={(e) => setPasswordInput(e.target.value)}
                                        placeholder="Leerkracht-wachtwoord..."
                                        className="w-full px-4 py-3 border border-themed rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 bg-surface"
                                        autoFocus
                                    />
                                    {passwordError && (
                                        <p className="text-red-500 text-sm">{passwordError}</p>
                                    )}
                                    <button
                                        type="submit"
                                        className="w-full py-3 bg-gradient-to-r from-amber-400 to-orange-400 text-white font-bold rounded-xl hover:from-amber-500 hover:to-orange-500 transition-all"
                                    >
                                        Doorgaan →
                                    </button>
                                </form>
                            ) : submitStatus === 'success' ? (
                                // Success state
                                <div className="text-center py-8">
                                    <div className="text-6xl mb-4">🎉</div>
                                    <h3 className="text-xl font-bold text-green-600 mb-2">
                                        Bedankt voor je feedback!
                                    </h3>
                                    <p className="text-muted">
                                        We waarderen je input en gebruiken het om de app te verbeteren.
                                    </p>
                                </div>
                            ) : (
                                // Feedback form
                                <form onSubmit={handleFeedbackSubmit} className="space-y-4">
                                    <p className="text-muted text-sm mb-4">
                                        Heb je suggesties, problemen gemeld, of ideeën om TALtrekkers te verbeteren? Laat het ons weten!
                                    </p>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">
                                            Je naam
                                        </label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Voornaam of volledige naam..."
                                            className="w-full px-4 py-3 border border-themed rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 bg-surface"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">
                                            Je feedback
                                        </label>
                                        <textarea
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            placeholder="Wat werkt goed? Wat kan beter? Heb je een suggestie?"
                                            rows={4}
                                            className="w-full px-4 py-3 border border-themed rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 bg-surface resize-none"
                                            required
                                        />
                                    </div>

                                    {submitStatus === 'error' && (
                                        <p className="text-red-500 text-sm">
                                            Er ging iets mis. Probeer het opnieuw.
                                        </p>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={isSubmitting || !message.trim() || !name.trim()}
                                        className="w-full py-3 bg-gradient-to-r from-amber-400 to-orange-400 text-white font-bold rounded-xl hover:from-amber-500 hover:to-orange-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <span className="animate-spin">⏳</span>
                                                Verzenden...
                                            </>
                                        ) : (
                                            <>
                                                <span>📨</span>
                                                Verstuur feedback
                                            </>
                                        )}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default FeedbackButton;
