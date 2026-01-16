
import React, { useState } from 'react';
import { AppError, ERROR_ICONS } from '../services/errorHandling';

interface ErrorBannerProps {
    error: AppError;
    onRetry?: () => void;
    onDismiss?: () => void;
    onBack?: () => void;
}

/**
 * Herbruikbare error banner component
 * Toont user-friendly foutmeldingen met iconen en actieknoppen
 */
const ErrorBanner: React.FC<ErrorBannerProps> = ({ error, onRetry, onDismiss, onBack }) => {
    const [showDetails, setShowDetails] = useState(false);

    const icon = ERROR_ICONS[error.category];

    // Kleur schema per categorie
    const colorClasses = error.category === 'network'
        ? 'bg-amber-50 border-amber-200 text-amber-800'
        : 'bg-red-50 border-red-200 text-red-800';

    const buttonClass = error.category === 'network'
        ? 'bg-amber-600 hover:bg-amber-700'
        : 'bg-tal-purple hover:bg-tal-purple-dark';

    return (
        <div className="flex items-center justify-center min-h-[300px] p-4">
            <div className={`w-full max-w-lg p-6 rounded-2xl border-2 shadow-lg ${colorClasses}`}>
                {/* Header met icoon */}
                <div className="flex items-center gap-3 mb-3">
                    <span className="text-4xl">{icon}</span>
                    <h3 className="font-bold text-xl">{error.message}</h3>
                </div>

                {/* Suggestie */}
                <p className="mb-6 opacity-90">{error.suggestion}</p>

                {/* Actieknoppen */}
                <div className="flex flex-wrap gap-3">
                    {error.canRetry && onRetry && (
                        <button
                            onClick={onRetry}
                            className={`px-5 py-2.5 text-white font-semibold rounded-lg transition-colors flex items-center gap-2 ${buttonClass}`}
                        >
                            <span>🔄</span> Opnieuw proberen
                        </button>
                    )}

                    {onBack && (
                        <button
                            onClick={onBack}
                            className="px-5 py-2.5 bg-white border border-current font-semibold rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                        >
                            <span>←</span> Terug
                        </button>
                    )}

                    {onDismiss && (
                        <button
                            onClick={onDismiss}
                            className="px-5 py-2.5 bg-white border border-current font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Sluiten
                        </button>
                    )}
                </div>

                {/* Technische details (optioneel) */}
                {error.technicalDetails && (
                    <div className="mt-4 pt-4 border-t border-current/20">
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            className="text-sm opacity-70 hover:opacity-100 flex items-center gap-1"
                        >
                            <span className={`transform transition-transform ${showDetails ? 'rotate-90' : ''}`}>▶</span>
                            Technische details
                        </button>
                        {showDetails && (
                            <pre className="mt-2 text-xs bg-black/5 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                                {error.technicalDetails}
                            </pre>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ErrorBanner;
