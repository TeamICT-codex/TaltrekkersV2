
import React, { useState, useEffect } from 'react';

const FACTS_AND_QUOTES = [
    // Taalweetjes
    "Wist je dat? Het Nederlands heeft meer dan 300.000 woorden!",
    "Wist je dat? Het langste Nederlandse woord in Van Dale is 'meervoudigepersoonlijkheidsstoornis'.",
    "Wist je dat? 'Herfst' een van de weinige woorden is waar geen enkel ander Nederlands woord op rijmt.",
    "Wist je dat? De meeste talen op aarde uitsterven, maar Nederlands groeit nog steeds!",
    "Taalfeitje: Het woord 'oké' wordt over de hele wereld begrepen.",
    
    // Motivatie
    "Fouten maken mag! Daar leer je het meeste van.",
    "Elk woord dat je leert, is een sleutel tot een nieuwe wereld.",
    "Oefening baart kunst. Je bent goed bezig!",
    "Stap voor stap word je een taalexpert.",
    "Niet opgeven, je hersenen zijn hard aan het werk!",
    
    // Loading messages
    "De AI schrijft momenteel jouw oefeningen...",
    "Even de woordenboeken afstoffen...",
    "Creativiteit wordt gebrouwen in de cloud...",
    "Jouw persoonlijke taalleraar start op..."
];

const LoadingIndicator: React.FC = () => {
    const [message, setMessage] = useState(FACTS_AND_QUOTES[0]);

    useEffect(() => {
        const initialIndex = Math.floor(Math.random() * FACTS_AND_QUOTES.length);
        setMessage(FACTS_AND_QUOTES[initialIndex]);

        const intervalId = setInterval(() => {
            setMessage(prevMessage => {
                let newIndex;
                do {
                    newIndex = Math.floor(Math.random() * FACTS_AND_QUOTES.length);
                } while (FACTS_AND_QUOTES[newIndex] === prevMessage);
                return FACTS_AND_QUOTES[newIndex];
            });
        }, 4000); // Rotate every 4 seconds so users can read it

        return () => clearInterval(intervalId);
    }, []);

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity duration-300">
            <div className="bg-tal-teal p-8 rounded-2xl shadow-2xl w-full max-w-lg mx-4 text-center border border-tal-purple/50 flex flex-col items-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-white/20">
                     <div className="h-full bg-tal-gold animate-progress-indeterminate"></div>
                </div>
                
                <div className="text-7xl mb-6 animate-pulse-bright" role="img" aria-label="AI is aan het denken">🧠</div>
                
                <div className="min-h-[80px] flex items-center justify-center">
                    <p key={message} className="text-xl font-medium text-white leading-relaxed animate-fade-in">
                        {message}
                    </p>
                </div>
                
                <p className="mt-6 text-sm text-tal-teal-dark font-semibold bg-white/10 px-3 py-1 rounded-full">
                    Even geduld aub...
                </p>
            </div>
        </div>
    );
};
export default LoadingIndicator;
