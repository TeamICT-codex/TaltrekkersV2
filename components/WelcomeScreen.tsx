
import React from 'react';

interface WelcomeScreenProps {
    onLoginClick: () => void;
    onAnonymousClick: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onLoginClick, onAnonymousClick }) => {
    return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 animate-fade-in">
            {/* Hero Section */}
            <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-bold text-tal-purple-dark mb-4">
                    Welkom bij TALtrekkers! 🎯
                </h1>
                <p className="text-lg text-slate-600 max-w-md mx-auto">
                    Verbeter je woordenschat met slimme oefeningen
                </p>
            </div>

            {/* Choice Cards */}
            <div className="w-full max-w-lg space-y-4">
                {/* Login Option */}
                <button
                    onClick={onLoginClick}
                    className="w-full p-6 bg-white rounded-2xl shadow-lg border-2 border-tal-purple hover:border-tal-purple-dark hover:shadow-xl transition-all duration-300 group text-left"
                >
                    <div className="flex items-start gap-4">
                        <div className="w-14 h-14 bg-tal-purple/10 rounded-xl flex items-center justify-center text-2xl group-hover:bg-tal-purple/20 transition">
                            📧
                        </div>
                        <div className="flex-1">
                            <h2 className="text-xl font-bold text-tal-purple-dark mb-1">
                                Inloggen met email
                            </h2>
                            <p className="text-slate-500 text-sm">
                                Je voortgang wordt opgeslagen en je leerkracht kan je resultaten zien.
                            </p>
                            <span className="inline-block mt-3 text-sm font-semibold text-tal-purple group-hover:underline">
                                Start met inloggen →
                            </span>
                        </div>
                    </div>
                </button>

                {/* Anonymous Option */}
                <button
                    onClick={onAnonymousClick}
                    className="w-full p-6 bg-white rounded-2xl shadow-lg border-2 border-slate-200 hover:border-slate-300 hover:shadow-xl transition-all duration-300 group text-left"
                >
                    <div className="flex items-start gap-4">
                        <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center text-2xl group-hover:bg-slate-200 transition">
                            ⚡
                        </div>
                        <div className="flex-1">
                            <h2 className="text-xl font-bold text-slate-700 mb-1">
                                Direct oefenen
                            </h2>
                            <p className="text-slate-500 text-sm">
                                Geen login nodig. Ideaal voor snel even oefenen thuis.
                            </p>
                            <span className="inline-block mt-3 text-sm font-semibold text-slate-600 group-hover:underline">
                                Meteen beginnen →
                            </span>
                        </div>
                    </div>
                </button>
            </div>

            {/* Footer hint */}
            <p className="mt-8 text-xs text-slate-400 text-center max-w-sm">
                💡 Tip: Vraagt je leerkracht om in te loggen? Kies dan "Inloggen met email" zodat je resultaten worden opgeslagen.
            </p>
        </div>
    );
};

export default WelcomeScreen;
