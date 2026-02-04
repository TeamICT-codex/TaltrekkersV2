import React, { useState } from 'react';
import { getFeedback } from '../services/db';

interface FeedbackItem {
    id: string;
    user_name: string;
    user_email: string;
    message: string;
    created_at: string;
}

const FeedbackViewer: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadFeedback = async () => {
        setLoading(true);
        setError(null);
        const result = await getFeedback();
        setLoading(false);

        if (result.error) {
            setError(result.error);
        } else if (result.data) {
            setFeedback(result.data);
        }
    };

    const handleOpen = () => {
        setIsOpen(true);
        loadFeedback();
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('nl-BE', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <>
            {/* Subtle icon - visible for everyone */}
            <button
                onClick={handleOpen}
                className="p-2 rounded-lg hover:bg-black/5 transition-colors text-muted hover:text-color-text"
                aria-label="Bekijk feedback"
                title="Bekijk feedback"
            >
                <span className="text-lg">📋</span>
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-surface w-full max-w-2xl max-h-[80vh] rounded-2xl shadow-2xl border border-themed overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-6 py-4 flex items-center justify-between shrink-0">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                📋 Feedback overzicht
                            </h2>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={loadFeedback}
                                    className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-sm rounded-lg transition-colors"
                                    disabled={loading}
                                >
                                    🔄 Vernieuwen
                                </button>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                                    title="Sluiten"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-y-auto flex-1">
                            {loading ? (
                                <div className="text-center py-8 text-muted">
                                    <span className="animate-spin inline-block text-2xl">⏳</span>
                                    <p className="mt-2">Laden...</p>
                                </div>
                            ) : error ? (
                                <div className="text-center py-8 text-red-500">
                                    <p>⚠️ {error}</p>
                                </div>
                            ) : feedback.length === 0 ? (
                                <div className="text-center py-8 text-muted">
                                    <span className="text-4xl">📭</span>
                                    <p className="mt-2">Nog geen feedback ontvangen.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {feedback.map((item) => (
                                        <div
                                            key={item.id}
                                            className="bg-black/5 rounded-xl p-4 border border-themed"
                                        >
                                            <div className="flex items-start justify-between gap-4 mb-2">
                                                <div className="font-semibold text-tal-purple">
                                                    {item.user_name}
                                                </div>
                                                <div className="text-xs text-muted whitespace-nowrap">
                                                    {formatDate(item.created_at)}
                                                </div>
                                            </div>
                                            <p className="text-sm whitespace-pre-wrap">
                                                {item.message}
                                            </p>
                                            <div className="text-xs text-muted mt-2">
                                                {item.user_email}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-3 bg-black/5 border-t border-themed text-xs text-muted text-center shrink-0">
                            {feedback.length} feedback item{feedback.length !== 1 ? 's' : ''}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default FeedbackViewer;
