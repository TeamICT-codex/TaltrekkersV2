import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { generateStory, generateFunnyTheme, evaluateComprehension, evaluateReadingAnswer } from '../services/geminiService';
import Spinner from './Spinner';
import Wheel from './Wheel';
import { ReadingStrategyItem, StoryData, WordLevel, PracticeSettings } from '../types';
import { STRATEGIES } from '../constants';
import LoadingIndicator from './LoadingIndicator';


interface StoryViewProps {
  words: string[];
  settings: PracticeSettings;
  onFinish: () => void;
}

type StoryStep = 'theme_selection' | 'generating' | 'comprehension' | 'wheel_spin' | 'strategy_test' | 'challenge_complete';

interface FeedbackSectionData {
    title: string;
    content: string;
}

const formatFeedbackContent = (text: string) => {
    if (!text) return { __html: '' };

    // Process bolding globally first
    const boldedText = text.trim().replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Split text into major blocks based on one or more empty lines
    const blocks = boldedText.split(/\n\s*\n/);

    const html = blocks.map(block => {
        const lines = block.split('\n');
        
        // Check if the entire block is a list
        const isUnordered = lines.every(line => /^\s*[-*]\s/.test(line.trim()));
        const isOrdered = lines.every(line => /^\s*\d+\.\s/.test(line.trim()));

        if (isUnordered) {
            const listItems = lines.map(line => `<li>${line.trim().replace(/^[*-]\s/, '')}</li>`).join('');
            return `<ul>${listItems}</ul>`;
        }
        
        if (isOrdered) {
            const listItems = lines.map(line => `<li>${line.trim().replace(/^\d+\.\s/, '')}</li>`).join('');
            return `<ol>${listItems}</ol>`;
        }

        // Otherwise, it's a paragraph block. Re-join lines with <br> for intra-paragraph line breaks.
        return `<p>${block.replace(/\n/g, '<br />')}</p>`;
    }).join('');

    return { __html: html };
};


const FeedbackSectionView: React.FC<{ section: FeedbackSectionData }> = React.memo(({ section }) => {
    const { title, content } = section;

    const getIcon = (title: string) => {
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes('oordeel')) return <span className="text-2xl" role="img" aria-label="Oordeel">🦉</span>;
        if (lowerTitle.includes('analyse')) return <span className="text-2xl" role="img" aria-label="Analyse">🔬</span>;
        if (lowerTitle.includes('tips')) return <span className="text-2xl" role="img" aria-label="Tips">💡</span>;
        return null;
    };

    return (
        <div className="p-4 border-l-4 border-slate-300 bg-slate-100 rounded-r-lg">
            <div className="flex items-center gap-3 mb-2">
                {getIcon(title)}
                <h4 className="font-bold text-lg text-slate-800">{title}</h4>
            </div>
            <div
                className="prose text-slate-700 max-w-none prose-strong:text-tal-teal-dark prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1"
                dangerouslySetInnerHTML={formatFeedbackContent(content)}
            />
        </div>
    );
});


const InteractiveFeedbackBlock: React.FC<{
    title: string;
    question: string;
    story: string;
    onEvaluate: (story: string, question: string, answer: string) => Promise<string>;
    onComplete?: () => void;
    buttonText?: string;
}> = ({ title, question, story, onEvaluate, onComplete, buttonText = "Volgende Stap" }) => {
    const [answer, setAnswer] = useState('');
    const [feedback, setFeedback] = useState<FeedbackSectionData[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const parseFeedback = (text: string): FeedbackSectionData[] => {
        const sections: FeedbackSectionData[] = [];
        // This regex splits the string by the ### headers, keeping the headers in the result.
        // The /m flag is crucial for ^ to match the start of a line.
        const parts = text.split(/^(###\s+.*)$/m).filter(p => p.trim());

        if (parts.length === 0) {
            return [];
        }

        let currentIndex = 0;
        // Check if the first part is content (an introduction) before the first header.
        if (!parts[0].startsWith('###')) {
            sections.push({
                title: 'Feedback van de AI-leraar', // Provide a generic title for the intro
                content: parts[0].trim()
            });
            currentIndex = 1; // Start looking for header-content pairs from the next part.
        }

        // Loop through the rest of the parts, which should be in [header, content, header, content, ...] format.
        for (let i = currentIndex; i < parts.length; i += 2) {
            const titlePart = parts[i];
            const contentPart = parts[i + 1];

            if (titlePart && contentPart) {
                sections.push({
                    title: titlePart.replace('###', '').trim(),
                    content: contentPart.trim()
                });
            }
        }
        
        // Fallback for unstructured response
        if (sections.length === 0 && text.trim()) {
            return [{ title: "Feedback", content: text.trim() }];
        }
        
        return sections;
    };


    const handleCheckAnswer = async () => {
        if (!answer.trim()) {
            alert('Geef eerst je antwoord in het tekstvak.');
            return;
        }
        setIsLoading(true);
        setFeedback(null);
        try {
            const result = await onEvaluate(story, question, answer);
            setFeedback(parseFeedback(result));
        } catch (error) {
            setFeedback([{ title: "Fout", content: "Sorry, er is iets misgegaan bij het controleren van je antwoord." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-4 animate-fade-in">
             <h3 className="font-bold text-xl text-tal-teal">{title}</h3>
            <p className="text-slate-600 italic">{question}</p>
            <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Typ hier je antwoord..."
                className="w-full p-2 border border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 rounded-lg focus:ring-2 focus:ring-tal-purple transition"
                rows={4}
            />
            <button onClick={handleCheckAnswer} disabled={isLoading} className="px-4 py-2 bg-tal-purple text-white font-semibold rounded-lg shadow-md hover:bg-tal-purple-dark disabled:bg-slate-500 flex items-center justify-center">
                {isLoading ? <Spinner/> : "Controleer mijn antwoord"}
            </button>
            {feedback && (
                <div className="mt-4 p-4 border-t border-slate-200 space-y-4 animate-fade-in">
                    <h5 className="font-bold text-slate-700">Feedback van de AI-leraar:</h5>
                    <div className="space-y-4">
                        {feedback.map((section, index) => (
                            <FeedbackSectionView key={index} section={section} />
                        ))}
                    </div>
                    {onComplete && (
                        <button onClick={onComplete} className="mt-4 px-6 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700">
                           {buttonText}
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

const StoryParagraph: React.FC<{ text: string; showLabel: boolean }> = React.memo(({ text, showLabel }) => {
    const labelRegex = /^(Alinea \d+\s*:|Inleiding\s*:|Midden(?:\s+\d+)?\s*:|Slot\s*:)\s*/i;
    let label: string | null = null;
    let content = text;

    const match = text.match(labelRegex);
    if (match) {
        label = match[0];
        content = text.substring(label.length);
    }

    const htmlContent = content.replace(/\*\*(.*?)\*\*/g, '<strong class="text-tal-gold font-bold">$1</strong>');

    return (
        <p className="text-slate-700">
            {label && showLabel && <strong className="text-tal-purple font-semibold mr-2">{label.trim()}</strong>}
            <span dangerouslySetInnerHTML={{ __html: htmlContent }} />
        </p>
    );
});

const StoryView: React.FC<StoryViewProps> = ({ words, settings, onFinish }) => {
  const [step, setStep] = useState<StoryStep>('theme_selection');
  const [theme, setTheme] = useState('');
  const [storyData, setStoryData] = useState<StoryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<ReadingStrategyItem | null>(null);
  const [showLabels, setShowLabels] = useState(true);

  const handleGenerateStory = async (chosenTheme: string) => {
    if (!chosenTheme) return;
    setStep('generating');
    setError(null);
    setStoryData(null);
    try {
      const generatedStory = await generateStory(words, chosenTheme, { context: settings.context, difficulty: settings.difficulty, aiModel: settings.aiModel });
      setStoryData(generatedStory);
      setStep('comprehension');
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kon het verhaal niet genereren.");
      setStep('theme_selection');
    }
  };
  
  const handleAIGenerateTheme = async () => {
    setStep('generating');
    setError(null);
    try {
        const funnyTheme = await generateFunnyTheme(words, { context: settings.context, difficulty: settings.difficulty, aiModel: settings.aiModel });
        setTheme(funnyTheme);
        await handleGenerateStory(funnyTheme);
    } catch (e) {
        setError(e instanceof Error ? e.message : "Kon geen thema bedenken.");
        setStep('theme_selection');
    }
  };
  
  const handleEvaluateComprehension = useCallback((story: string, question: string, answer: string) => {
    return evaluateComprehension(story, answer, { aiModel: settings.aiModel });
  }, [settings.aiModel]);

  const handleEvaluateReading = useCallback((story: string, question: string, answer: string) => {
    return evaluateReadingAnswer(story, question, answer, { aiModel: settings.aiModel });
  }, [settings.aiModel]);


  const storyParagraphs = useMemo(() => {
    if (!storyData?.story) return [];

    const storyText = storyData.story.replace(/\r\n/g, '\n');
    
    // Regex to find all occurrences of labels. The `g` flag is for 'replace all'.
    const labelRegex = /(Alinea \d+\s*:|Inleiding\s*:|Midden(?:\s+\d+)?\s*:|Slot\s*:)/gi;
    
    // Create a version of the regex without the global flag for testing, to avoid state issues with `test()`.
    const testRegex = /(Alinea \d+\s*:|Inleiding\s*:|Midden(?:\s+\d+)?\s*:|Slot\s*:)/i;

    if (!testRegex.test(storyText)) {
        // No labels found, fall back to splitting by double newlines.
        return storyText
            .split(/\n\s*\n/)
            .map(p => p.trim())
            .filter(p => p.length > 0);
    }

    // Labels exist, so we use them as the primary splitting mechanism.
    const separator = '|||';
    const processedStory = storyText.replace(labelRegex, `${separator}$1`);
      
    return processedStory
      .split(separator)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }, [storyData]);
  
  return (
    <div className="max-w-4xl mx-auto space-y-8">
        <div className="p-4 sm:p-8 bg-white rounded-2xl shadow-lg border border-slate-200">
            
            {step === 'theme_selection' && (
                 <div className="text-center animate-fade-in">
                    <div className="flex items-center justify-center gap-3 mb-4 text-4xl text-yellow-400">
                        <span role="img" aria-label="Ster">⭐</span>
                        <h2 className="text-4xl font-bold text-slate-400">De Verhaaluitdaging!</h2>
                        <span role="img" aria-label="Ster">⭐</span>
                    </div>
                    <p className="text-slate-600 mt-4 max-w-2xl mx-auto">
                        🎉 Gefeliciteerd! Je hebt genoeg woorden geleerd om deze uitdaging vrij te spelen. Hier brengen we je kennis tot leven door samen een uniek verhaal te creëren.
                    </p>
                    <div className="mt-8 space-y-6">
                        <p className="text-lg font-semibold text-tal-purple">Vertel de AI waar jouw verhaal over moet gaan:</p>
                        <div className="flex flex-col sm:flex-row gap-4 items-center">
                            <input
                            type="text"
                            value={theme}
                            onChange={(e) => setTheme(e.target.value)}
                            placeholder="bv. Een episch ruimte-avontuur... 🚀"
                            className="flex-grow w-full p-4 border border-slate-300 bg-white rounded-lg focus:ring-2 focus:ring-tal-purple text-lg text-slate-800 placeholder:text-slate-400 transition"
                            />
                            <button 
                                onClick={() => handleGenerateStory(theme)}
                                disabled={!theme}
                                className="w-full sm:w-auto px-6 py-4 bg-slate-700 text-white font-bold rounded-lg shadow-lg hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-transform transform hover:scale-105"
                            >
                                <span role="img" aria-label="Potlood">✏️</span>
                                <span>Genereer Verhaal</span>
                            </button>
                        </div>
                        <div className="relative my-2">
                            <div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-slate-200" /></div>
                            <div className="relative flex justify-center"><span className="px-3 bg-white text-lg text-slate-500">of</span></div>
                        </div>
                        <button onClick={handleAIGenerateTheme} className="w-full px-6 py-4 bg-tal-gold text-tal-teal-dark font-bold text-lg rounded-lg shadow-lg hover:opacity-90 flex items-center justify-center gap-3 transition-transform transform hover:scale-105">
                            <span role="img" aria-label="Toverstaf">🪄</span>
                            <span>Verras me, AI!</span>
                        </button>
                    </div>
                </div>
            )}

            {step === 'challenge_complete' && (
                 <div className="text-center animate-fade-in p-8">
                    <div className="text-8xl animate-pulse-bright" role="img" aria-label="Trofee">🏆</div>
                    <h2 className="text-4xl font-bold text-slate-800 mt-4">Uitdaging Voltooid!</h2>
                    <p className="text-slate-600 mt-4 max-w-md mx-auto">
                        Fantastisch werk! Je hebt het verhaal geanalyseerd en alle opdrachten voltooid. Blijf oefenen om nog meer woorden te leren!
                    </p>
                    <button
                        onClick={onFinish}
                        className="mt-8 w-full sm:w-auto px-8 py-4 bg-tal-purple text-white font-bold text-lg rounded-xl shadow-lg hover:bg-tal-purple-dark transform hover:scale-105 active:scale-[0.98] transition-all duration-300"
                    >
                        Terug naar het hoofdmenu
                    </button>
                </div>
            )}
            
            {step === 'generating' && <LoadingIndicator />}

            {error && <p className="text-red-500 text-center">{error}</p>}
            
            {storyData && (step === 'comprehension' || step === 'wheel_spin' || step === 'strategy_test') && (
              <div className="space-y-6">
                 <h2 className="text-3xl font-bold text-center text-slate-800 mb-2">Jouw unieke verhaal 📖</h2>
                 <p className="text-slate-600 text-center">Lees het verhaal en voltooi de opdrachten.</p>
                <div className="p-4 sm:p-6 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                        <h3 className="text-2xl font-bold text-tal-teal text-center sm:text-left">{storyData.title}</h3>
                        <div className="flex items-center flex-shrink-0">
                          <label htmlFor="labels-toggle" className="mr-3 text-sm text-slate-600 whitespace-nowrap">Alinea-labels:</label>
                          <button
                            id="labels-toggle"
                            onClick={() => setShowLabels(!showLabels)}
                            className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${showLabels ? 'bg-tal-purple' : 'bg-slate-400'}`}
                          >
                            <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${showLabels ? 'translate-x-6' : 'translate-x-1'}`} />
                          </button>
                        </div>
                    </div>
                    <div className="prose max-w-none space-y-4">
                        {storyParagraphs.map((p, i) => (
                            <StoryParagraph key={i} text={p} showLabel={showLabels} />
                        ))}
                    </div>
                </div>
                
                {step === 'comprehension' && (
                    <>
                        <div className="flex items-start gap-4 p-4 bg-yellow-50 border-l-4 border-tal-gold rounded-r-lg animate-fade-in">
                            <div className="flex-shrink-0 pt-1 text-2xl" role="img" aria-label="Schrijvende hand">
                                ✍️
                            </div>
                            <div>
                                <h4 className="font-bold text-yellow-800">Pro Tip: Versterk je kennis! 🧠</h4>
                                <p className="text-yellow-700 mt-1 text-sm">
                                    Pak pen en papier! Schrijf de <strong className="font-bold text-yellow-900">gemarkeerde woorden</strong> op. Let goed op de spelling en probeer voor elk woord een eigen, nieuwe voorbeeldzin te bedenken. Dit helpt je de woorden nog beter te onthouden!
                                </p>
                            </div>
                        </div>

                        <InteractiveFeedbackBlock
                            title="Stap 1: Begrijpend lezen"
                            question="Vat in je eigen woorden samen waar dit verhaal over gaat. Wat is de hoofdgedachte?"
                            story={storyData.story}
                            onEvaluate={handleEvaluateComprehension}
                            onComplete={() => setStep('wheel_spin')}
                            buttonText='Ga naar de leesstrategie-uitdaging'
                        />
                    </>
                )}

                {step === 'wheel_spin' && (
                    <div className="text-center space-y-4 animate-fade-in">
                        <h3 className="text-2xl font-bold text-slate-800">Stap 2: Leesstrategie-uitdaging</h3>
                        <p className="text-slate-600">Draai aan het rad om een willekeurige leesstrategie te oefenen!</p>
                        <div className="flex flex-col md:flex-row items-center justify-center gap-8 mt-4">
                            <Wheel 
                                items={STRATEGIES}
                                onSpinEnd={(strategy) => {
                                    setSelectedStrategy(strategy);
                                    setTimeout(() => setStep('strategy_test'), 500);
                                }}
                            />
                            <div className="w-full md:w-auto p-6 bg-slate-50 rounded-lg border border-slate-200">
                                <h4 className="font-bold text-lg mb-4 text-center text-tal-teal">Legende</h4>
                                <ol className="list-decimal list-inside space-y-2 text-left">
                                    {STRATEGIES.map((strategy, index) => (
                                        <li key={index} className="text-slate-700">
                                            <span className="font-semibold">{strategy.title}</span>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        </div>
                    </div>
                )}
                
                {step === 'strategy_test' && selectedStrategy && (
                     <div className="animate-fade-in space-y-4">
                        <div className="p-4 bg-slate-50 rounded-lg">
                             <h3 className="text-2xl font-bold text-center text-tal-teal">Jouw uitdaging: {selectedStrategy.title}</h3>
                             <p className="text-center text-slate-600 mt-2">{selectedStrategy.explanation}</p>
                        </div>
                        <InteractiveFeedbackBlock
                            title="Voer de opdracht uit"
                            question={selectedStrategy.question}
                            story={storyData.story}
                            onEvaluate={handleEvaluateReading}
                            onComplete={() => setStep('challenge_complete')}
                            buttonText="Voltooi de uitdaging!"
                        />
                    </div>
                )}
              </div>
            )}
        </div>
    </div>
  );
};

export default StoryView;