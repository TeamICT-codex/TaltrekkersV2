import React, { useState, useEffect } from 'react';

const BETA_OVERLAY_KEY = 'taltrekkers-beta-seen';

const BetaOverlay: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Check if user has already seen the overlay
        const hasSeen = localStorage.getItem(BETA_OVERLAY_KEY);
        if (!hasSeen) {
            setIsVisible(true);
        }
    }, []);

    const handleDismiss = () => {
        localStorage.setItem(BETA_OVERLAY_KEY, 'true');
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden">
                {/* Header - prominent gradient with clear text */}
                <div className="bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 px-6 py-6">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3 drop-shadow-md">
                        🚀 Welkom bij TALtrekkers!
                    </h2>
                    <p className="text-white text-sm mt-2 font-medium opacity-90">
                        ✨ Proefversie — tot de krokusvakantie
                    </p>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4 max-h-[55vh] overflow-y-auto bg-gray-50">
                    {/* Beta notice box */}
                    <div className="bg-purple-100 border-2 border-purple-300 rounded-xl p-4">
                        <p className="text-purple-900 font-bold flex items-center gap-2 text-base">
                            <span className="text-xl">🔬</span>
                            Dit is een eerste "proef" van de software!
                        </p>
                        <p className="text-purple-800 text-sm mt-1">
                            Je feedback helpt ons om TALtrekkers nog beter te maken.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <h3 className="font-bold text-lg text-purple-700 flex items-center gap-2">
                            📋 Hoe ga je aan de slag?
                        </h3>

                        <div className="space-y-2 text-sm">
                            <div className="flex gap-3 items-start bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                                <span className="bg-purple-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0">1</span>
                                <div>
                                    <strong className="text-gray-900">Kies "Direct oefenen"</strong>
                                    <p className="text-gray-600">Je kunt meteen starten zonder in te loggen.</p>
                                </div>
                            </div>

                            <div className="flex gap-3 items-start bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                                <span className="bg-purple-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0">2</span>
                                <div>
                                    <strong className="text-gray-900">Vul altijd je naam in</strong>
                                    <p className="text-gray-600">Je naam is vereist om de oefening te kunnen starten.</p>
                                </div>
                            </div>

                            <div className="flex gap-3 items-start bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                                <span className="bg-purple-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0">3</span>
                                <div>
                                    <strong className="text-gray-900">Probeer de woordenlijsten onder "Algemeen"</strong>
                                    <p className="text-gray-600">Ervaar zelf hoe de oefeningen werken met bestaande lijsten.</p>
                                </div>
                            </div>

                            <div className="flex gap-3 items-start bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                                <span className="bg-purple-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0">4</span>
                                <div>
                                    <strong className="text-gray-900">Test met een eigen woordenlijst</strong>
                                    <p className="text-gray-600">Voeg een korte lijst toe (niet té lang) en pas de context aan naar wens.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Feedback callout */}
                    <div className="bg-gradient-to-r from-orange-100 to-amber-100 border-2 border-orange-300 rounded-xl p-4">
                        <p className="font-bold text-orange-900 flex items-center gap-2">
                            <span className="text-xl">💬</span>
                            Feedback welkom!
                        </p>
                        <p className="text-sm text-orange-800 mt-1">
                            Gebruik de feedback-knop in de header om je ervaringen, suggesties of problemen te delen.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-white border-t border-gray-200">
                    <button
                        onClick={handleDismiss}
                        className="w-full py-3.5 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white font-bold rounded-xl hover:opacity-90 transition-all active:transform active:scale-[0.98] shadow-lg text-lg"
                    >
                        🎯 Aan de slag!
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BetaOverlay;
