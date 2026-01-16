
import React, { useState, useMemo, useEffect } from 'react';
import { FrayerModelData, PracticeSettings } from '../types';
import { translateFrayerModel, playTextAsSpeech } from '../services/geminiService';
import Spinner from './Spinner';

interface FrayerModelViewProps {
  models: FrayerModelData[];
  words: string[];
  onComplete: () => void;
  showSynonymsAntonyms: boolean;
  settings: PracticeSettings;
  onRecordStudyTime: (word: string, seconds: number) => void;
}

const HighlightedText: React.FC<{ text: string; highlight: string }> = React.memo(({ text, highlight }) => {
  const parts = useMemo(() => {
    if (!highlight || !text || highlight.trim() === '') {
      return [text];
    }
    
    const highlightParts = highlight.split(' ').map(p => p.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).filter(Boolean);
    
    if (highlightParts.length === 0) {
      return [text];
    }

    const regex = new RegExp(`\\b(${highlightParts.join('|')})\\b`, 'gi');
    return text.split(regex);
  }, [text, highlight]);

  const highlightWords = useMemo(() => new Set(highlight.toLowerCase().split(' ').filter(Boolean)), [highlight]);

  return (
    <span>
      {parts.map((part, i) => {
        if (part && highlightWords.has(part.toLowerCase())) {
          return (
            <strong key={i} className="text-tal-teal font-bold bg-surface-dark px-1 rounded">
              {part}
            </strong>
          );
        }
        return part;
      })}
    </span>
  );
});

const FrayerModelCard: React.FC<{ title: string; children: React.ReactNode; className?: string }> = React.memo(({ title, children, className = '' }) => (
  <div className={`bg-surface p-6 rounded-2xl shadow-lg flex flex-col ${className}`}>
    <h4 className="font-bold text-lg text-tal-teal mb-3">{title}</h4>
    <div className="text-secondary space-y-3">{children}</div>
  </div>
));


const getWordSizeClass = (word: string): string => {
  const length = word.length;
  if (length > 15) {
    return 'text-4xl'; // Voor zeer lange woorden
  }
  if (length > 11) {
    return 'text-5xl'; // Voor middellange woorden zoals 'geschiedenis'
  }
  return 'text-6xl'; // Voor kortere woorden
};


const FrayerModelView: React.FC<FrayerModelViewProps> = ({ models, words, onComplete, showSynonymsAntonyms, settings, onRecordStudyTime }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [translatedModel, setTranslatedModel] = useState<FrayerModelData | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);

  const currentModel = models[currentIndex];
  const currentWord = words[currentIndex];

  useEffect(() => {
    // Reset states when the current word changes
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


  const nextWord = () => {
    if (currentIndex < words.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete();
    }
  };

  const prevWord = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleTranslate = async () => {
    if (!settings.nativeLanguage) return;
    
    setIsTranslating(true);
    setTranslationError(null);
    setTranslatedModel(null);
    try {
      const translation = await translateFrayerModel(currentModel, settings.nativeLanguage, { aiModel: settings.aiModel });
      setTranslatedModel(translation);
    } catch (error) {
      setTranslationError('Vertaling mislukt. Probeer het opnieuw.');
    } finally {
      setIsTranslating(false);
    }
  };

  // 1. High Quality AI Voice (Only for Definition)
  const speakDefinition = async (text: string) => {
    if (playingAudioUrl) return; 
    
    setPlayingAudioUrl('definitie');
    try {
        await playTextAsSpeech(text);
    } catch (e) {
        // Silent fallback to robotic if AI fails
        speakRobotic(text);
    } finally {
        setPlayingAudioUrl(null);
    }
  };

  // 2. Standard Browser Voice (For single words, examples, synonyms)
  // Fast, no latency, handles single words better than AI sometimes
  const speakRobotic = (text: string) => {
    if ('speechSynthesis' in window) {
        // Cancel any ongoing speech to prevent queue buildup
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'nl-BE'; 
        
        const voices = window.speechSynthesis.getVoices();
        // Try to find a Belgian or Dutch voice
        const dutchVoice = voices.find(v => v.lang.includes('nl-BE')) || voices.find(v => v.lang.includes('nl'));
        if (dutchVoice) {
            utterance.voice = dutchVoice;
        }
        window.speechSynthesis.speak(utterance);
    }
  };


  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-8 space-y-8 w-full">
      <div className="text-center">
        <h2 className="text-3xl font-bold">Bestudeer de woorden</h2>
        <p className="text-muted">Woord {currentIndex + 1} van {words.length}</p>
      </div>

       <div className="grid grid-cols-1 lg:grid-cols-[2fr_1.5fr_2fr] gap-6 items-start">
        {/* Left Column */}
        <div className="space-y-6">
            <FrayerModelCard title="Definitie">
                <div className="flex items-start gap-3">
                    <p className="flex-grow">{currentModel.definitie}</p>
                    <button 
                        onClick={() => speakDefinition(currentModel.definitie)} 
                        disabled={!!playingAudioUrl}
                        className="flex-shrink-0 p-2 bg-tal-purple/10 hover:bg-tal-purple/20 text-tal-purple rounded-full transition-colors disabled:opacity-50" 
                        aria-label="Luister naar natuurlijke uitspraak"
                        title="Klik voor natuurlijke uitspraak"
                    >
                        {playingAudioUrl === 'definitie' ? <Spinner className="w-5 h-5 text-tal-purple" /> : <span role="img" aria-label="Natuurlijke spraak" className="text-lg">🗣️</span>}
                    </button>
                </div>
                {translatedModel && <>
                    <hr className="my-2 border-themed opacity-20" />
                    <p className="text-tal-teal italic">{translatedModel.definitie}</p>
                </>}
            </FrayerModelCard>
            {showSynonymsAntonyms && (
                <FrayerModelCard title="Synoniemen">
                    <div className="flex items-start justify-between">
                        <p className="italic">{currentModel.synoniemen.join(', ')}</p>
                        <button 
                            onClick={() => speakRobotic(currentModel.synoniemen.join(', '))}
                            className="text-slate-400 hover:text-tal-teal p-1 ml-2"
                        >
                            🔊
                        </button>
                    </div>
                    {translatedModel && <>
                        <hr className="my-2 border-themed opacity-20" />
                        <p className="text-tal-teal italic">{translatedModel.synoniemen.join(', ')}</p>
                    </>}
                </FrayerModelCard>
            )}
        </div>

        {/* Center Column */}
        <div className="order-first lg:order-none bg-surface-alt p-6 rounded-2xl shadow-lg flex flex-col items-center justify-center min-h-[250px] lg:h-full text-center relative">
            <button 
                onClick={() => speakRobotic(currentWord)}
                className="absolute top-4 right-4 p-2 bg-white rounded-full shadow hover:bg-slate-100 text-tal-teal"
                aria-label="Spreek woord uit"
            >
                 🔊
            </button>
            <h2 className={`font-extrabold text-primary tracking-tight leading-tight ${getWordSizeClass(currentWord)}`}>
                {currentWord}
            </h2>
            {currentModel.topic && (
                <p className="text-sm font-semibold text-tal-purple bg-tal-purple/10 px-3 py-1 rounded-full mt-4">
                    {currentModel.topic}
                </p>
            )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
            <FrayerModelCard title="Voorbeelden">
                {currentModel.voorbeelden.map((ex, i) => (
                    <div key={i} className="flex items-start gap-2 mb-3 last:mb-0">
                        <div className="flex-grow">
                            <p><HighlightedText text={ex.zin} highlight={ex.gebruiktWoord} /></p>
                        </div>
                        <button 
                            onClick={() => speakRobotic(ex.zin)} 
                            className="text-slate-400 hover:text-tal-teal p-1 flex-shrink-0" 
                            aria-label="Luister"
                        >
                             🔊
                        </button>
                    </div>
                ))}
                {translatedModel && <>
                    <hr className="my-2 border-themed opacity-20" />
                    <div className="text-tal-teal italic space-y-2">
                        {translatedModel.voorbeelden.map((ex, i) => <p key={i}>{ex.zin}</p>)}
                    </div>
                </>}
            </FrayerModelCard>
            {showSynonymsAntonyms && (
                <FrayerModelCard title="Antoniemen">
                    <div className="flex items-start justify-between">
                         <p className="italic">{currentModel.antoniemen.join(', ')}</p>
                         <button 
                            onClick={() => speakRobotic(currentModel.antoniemen.join(', '))}
                            className="text-slate-400 hover:text-tal-teal p-1 ml-2"
                        >
                            🔊
                        </button>
                    </div>
                    {translatedModel && <>
                        <hr className="my-2 border-themed opacity-20" />
                        <p className="text-tal-teal italic">{translatedModel.antoniemen.join(', ')}</p>
                    </>}
                </FrayerModelCard>
            )}
        </div>
      </div>
      
      <div className="flex flex-wrap justify-between items-center mt-8 p-4 bg-surface rounded-xl gap-4">
        <button 
          onClick={prevWord} 
          disabled={currentIndex === 0}
          className="px-6 py-3 bg-surface-alt text-secondary font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-dark"
        >
          Vorige
        </button>
        <div className="flex-grow flex justify-center">
            {settings.nativeLanguage && (
                <button 
                  onClick={handleTranslate}
                  disabled={isTranslating}
                  className="px-5 py-3 bg-success text-inverted font-semibold rounded-lg shadow-md hover:bg-success-dark disabled:bg-surface-dark disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                  {isTranslating ? <Spinner /> : `🌍 Vertaal naar ${settings.nativeLanguage}`}
              </button>
            )}
        </div>
        <button 
          onClick={nextWord}
          className="px-6 py-3 bg-tal-purple text-inverted font-semibold rounded-lg hover:bg-tal-purple-dark"
        >
          {currentIndex === words.length - 1 ? 'Start de quiz!' : 'Volgende'}
        </button>
      </div>
      {translationError && <p className="text-danger text-center mt-2">{translationError}</p>}
    </div>
  );
};

export default FrayerModelView;
