
import React, { useState, useEffect } from 'react';
import { FrayerModelData, PracticeSettings } from '../types';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { ArrowRightIcon } from './icons/ArrowRightIcon';
import { translateFrayerModel, playTextAsSpeech } from '../services/geminiService';
import Spinner from './Spinner';


interface FlashcardViewProps {
  models: FrayerModelData[];
  words: string[];
  onComplete: () => void;
  onRecordStudyTime: (word: string, seconds: number) => void;
  settings: PracticeSettings;
}

const FlashcardView: React.FC<FlashcardViewProps> = ({ models, words, onComplete, onRecordStudyTime, settings }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [hasCycledThrough, setHasCycledThrough] = useState(false);
  const [translatedModel, setTranslatedModel] = useState<FrayerModelData | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);

  const currentModel = models[currentIndex];
  const currentWord = words[currentIndex];

  useEffect(() => {
    // When the user reaches the last card, mark that they've seen them all
    if (currentIndex === words.length - 1) {
      setHasCycledThrough(true);
    }
  }, [currentIndex, words.length]);
  
  // Reset flip and translation state when card changes
  useEffect(() => {
    setIsFlipped(false);
    setTranslatedModel(null);
    setTranslationError(null);
    setPlayingAudioUrl(null);
  }, [currentIndex]);

  useEffect(() => {
    const startTime = Date.now();
    return () => {
        const endTime = Date.now();
        const seconds = (endTime - startTime) / 1000;
        onRecordStudyTime(currentWord, seconds);
    };
  }, [currentIndex, currentWord, onRecordStudyTime]);


  const nextCard = () => {
    if (currentIndex < words.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const prevCard = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleCardClick = () => {
    setIsFlipped(!isFlipped);
  };

  const handleTranslate = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card from flipping back
    if (!settings.nativeLanguage) return;

    setIsTranslating(true);
    setTranslationError(null);
    try {
        const translation = await translateFrayerModel(currentModel, settings.nativeLanguage, { aiModel: settings.aiModel });
        setTranslatedModel(translation);
    } catch (error) {
        setTranslationError('Vertaling mislukt.');
    } finally {
        setIsTranslating(false);
    }
  };
  
  // High Quality AI Speech (For Definitions only)
  const speakDefinition = async (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    if (playingAudioUrl) return;
    
    setPlayingAudioUrl('definition');
    try {
        await playTextAsSpeech(text);
    } catch (err) {
        speakRobotic(e, text); // Fallback
    } finally {
        setPlayingAudioUrl(null);
    }
  };

  // Standard Robotic Speech (For Words)
  const speakRobotic = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'nl-BE';
        const voices = window.speechSynthesis.getVoices();
        const dutchVoice = voices.find(v => v.lang.includes('nl-BE')) || voices.find(v => v.lang.includes('nl'));
        if (dutchVoice) utterance.voice = dutchVoice;
        window.speechSynthesis.speak(utterance);
    }
  };
  
  const isCompletionButtonVisible = hasCycledThrough && currentIndex === words.length - 1;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-8 space-y-6 animate-fade-in">
      <div className="text-center">
        <h2 className="text-3xl font-bold">Oefen met steekkaarten</h2>
        <p className="text-muted">Klik op een kaart om de definitie te zien.</p>
      </div>
      
      {/* Flashcard Container */}
      <div className="w-full h-80 perspective-1000">
        {/* Wrapper for Fade Animation & Remounting */}
        <div key={currentIndex} className="w-full h-full animate-fade-in relative">
            {/* Inner Card for Rotation */}
            <div 
                className={`absolute w-full h-full transform-style-preserve-3d transition-transform duration-500 ${isFlipped ? 'rotate-y-180' : ''}`}
                onClick={handleCardClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && handleCardClick()}
                aria-label={`Steekkaart voor ${currentWord}. ${isFlipped ? 'Achterkant wordt getoond.' : 'Voorkant wordt getoond. Klik om om te draaien.'}`}
            >
                {/* Front (Word) - Robotic Voice */}
                <div className="absolute w-full h-full backface-hidden bg-surface rounded-2xl shadow-lg flex flex-col items-center justify-center cursor-pointer border border-themed group">
                    <button 
                        onClick={(e) => speakRobotic(e, currentWord)}
                        className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full shadow text-tal-teal opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Spreek woord uit"
                    >
                         🔊
                    </button>
                    <h3 className="text-5xl font-bold text-primary tracking-tight">{currentWord}</h3>
                </div>
                
                {/* Back (Definition) - AI Voice for Def, Robotic for others */}
                <div className="absolute w-full h-full backface-hidden bg-surface-alt rounded-2xl shadow-lg flex flex-col justify-between p-6 cursor-pointer border border-themed rotate-y-180">
                    <div>
                        <div className="flex justify-between items-start">
                            <div className="flex-grow">
                                <div className="flex items-center gap-2 mb-2">
                                    <h4 className="font-semibold text-tal-teal">Definitie</h4>
                                    <button 
                                        onClick={(e) => speakDefinition(e, currentModel.definitie)} 
                                        disabled={!!playingAudioUrl}
                                        className="p-1.5 bg-tal-purple/10 hover:bg-tal-purple/20 text-tal-purple rounded-full transition-colors disabled:opacity-50" 
                                        aria-label="Luister naar natuurlijke uitspraak"
                                        title="Natuurlijke uitspraak"
                                    >
                                        {playingAudioUrl === 'definition' ? <Spinner className="w-4 h-4 text-tal-purple" /> : <span role="img" aria-label="Natuurlijke spraak">🗣️</span>}
                                    </button>
                                </div>
                                <p className="text-lg text-secondary">{currentModel.definitie}</p>
                            </div>
                            {settings.nativeLanguage && !translatedModel && (
                                <button 
                                    onClick={handleTranslate} 
                                    disabled={isTranslating}
                                    className="text-xs font-semibold px-2 py-1 bg-success/10 text-success-dark rounded-md hover:bg-success/20 disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    {isTranslating ? <Spinner className="text-success-dark h-4 w-4" /> : '🌍'}
                                    {isTranslating ? '...' : `Vertaal`}
                                </button>
                            )}
                        </div>
                        {translationError && <p className="text-xs text-danger mt-2">{translationError}</p>}
                        {translatedModel && (
                            <div className="mt-3 pt-3 border-t border-themed/20 animate-fade-in">
                                <h4 className="font-semibold text-tal-teal mb-1 text-sm capitalize">{settings.nativeLanguage}</h4>
                                <p className="text-md text-secondary italic">{translatedModel.definitie}</p>
                            </div>
                        )}
                    </div>
                    {settings.showSynonymsAntonyms && (
                        <div className="grid grid-cols-2 gap-4 text-sm pt-4 border-t border-themed">
                            <div>
                                <h5 className="font-semibold text-tal-teal mb-1">Synoniemen</h5>
                                <p className="text-muted italic">{currentModel.synoniemen.join(', ')}</p>
                                {translatedModel && <p className="text-tal-teal/80 italic text-xs mt-1">{translatedModel.synoniemen.join(', ')}</p>}
                            </div>
                            <div>
                                <h5 className="font-semibold text-tal-teal mb-1">Antoniemen</h5>
                                <p className="text-muted italic">{currentModel.antoniemen.join(', ')}</p>
                                {translatedModel && <p className="text-tal-teal/80 italic text-xs mt-1">{translatedModel.antoniemen.join(', ')}</p>}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center mt-6">
        <button 
          onClick={prevCard} 
          disabled={currentIndex === 0}
          className="flex items-center gap-2 px-4 py-2 bg-surface text-secondary font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-dark transition-colors"
          aria-label="Vorige kaart"
        >
          <ArrowLeftIcon className="h-5 w-5"/> Vorige
        </button>
        <div className="font-semibold text-muted">
            Kaart {currentIndex + 1} van {words.length}
        </div>
        <button 
          onClick={nextCard} 
          disabled={currentIndex === words.length - 1}
          className="flex items-center gap-2 px-4 py-2 bg-surface text-secondary font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-dark transition-colors"
          aria-label="Volgende kaart"
        >
          Volgende <ArrowRightIcon className="h-5 w-5"/>
        </button>
      </div>

      {isCompletionButtonVisible && (
        <div className="mt-8 text-center animate-fade-in">
             <button 
                onClick={onComplete}
                className="px-8 py-4 bg-tal-purple text-inverted font-bold text-lg rounded-xl shadow-lg hover:bg-tal-purple-dark transform active:scale-[0.98] transition-all duration-300"
            >
                Ik heb gestudeerd, start de quiz!
            </button>
        </div>
      )}

      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .transform-style-preserve-3d { transform-style: preserve-3d; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
      `}</style>
    </div>
  );
};

export default FlashcardView;
