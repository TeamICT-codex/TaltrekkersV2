
import React, { useState } from 'react';
import { extractKeyTerms } from '../services/geminiService';
import { PracticeSettings, WordListProgress } from '../types';
import Spinner from './Spinner';
import { SESSION_LENGTH_OPTIONS, MAX_WORDS_PER_SESSION } from '../constants';

declare const pdfjsLib: any;
declare const mammoth: any;
declare const XLSX: any;

interface CustomWordExtractorProps {
    onWordsSelected: (words: string[], context: string, fileName?: string, allWords?: string[]) => void;
    aiModel: PracticeSettings['aiModel'];
    studentName: string;
    defaultContext?: string;
    hideContextInput?: boolean;
    existingProgress?: WordListProgress;  // Eerder geoefende woorden voor deze lijst
}

type Stage = 'input' | 'analyzing' | 'selection';

const cleanText = (text: string): string => {
    return text.replace(/\s+/g, ' ').trim();
};

// Fisher-Yates shuffle
const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

const CustomWordExtractor: React.FC<CustomWordExtractorProps> = ({
    onWordsSelected,
    aiModel,
    studentName,
    defaultContext,
    hideContextInput,
    existingProgress
}) => {
    const [stage, setStage] = useState<Stage>('input');
    const [inputText, setInputText] = useState('');
    const [extractedTerms, setExtractedTerms] = useState<string[]>([]);
    const [selectedLength, setSelectedLength] = useState(SESSION_LENGTH_OPTIONS[0].words); // Default: Basis (20)
    const [error, setError] = useState<string | null>(null);
    const [context, setContext] = useState('');
    const [fileName, setFileName] = useState<string | null>(null);
    const [showAllWords, setShowAllWords] = useState(false);

    const resetState = () => {
        setStage('input');
        setInputText('');
        setExtractedTerms([]);
        setSelectedLength(SESSION_LENGTH_OPTIONS[0].words);
        setError(null);
        setFileName(null);
        setShowAllWords(false);
    };

    const extractTextFromPdf = async (file: File): Promise<string> => {
        const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
        let fullText = '';
        const maxPages = Math.min(pdf.numPages, 20);

        for (let i = 1; i <= maxPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map((item: any) => item.str).join(' ') + ' ';
        }
        return cleanText(fullText);
    };

    const extractTextFromDocx = async (file: File): Promise<string> => {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return cleanText(result.value);
    };

    const extractTextFromXlsx = async (file: File): Promise<string> => {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);
        let fullText = '';
        workbook.SheetNames.forEach((sheetName: string) => {
            const worksheet = workbook.Sheets[sheetName];
            const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            fullText += data.flat().filter(cell => typeof cell === 'string' || typeof cell === 'number').join(' ') + ' ';
        });
        return cleanText(fullText);
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setError(null);
        setStage('analyzing');
        setFileName(file.name);

        try {
            let text = '';
            if (file.type === 'application/pdf') {
                text = await extractTextFromPdf(file);
            } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                text = await extractTextFromDocx(file);
            } else if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.name.endsWith('.xlsx')) {
                text = await extractTextFromXlsx(file);
            } else {
                throw new Error('Bestandstype niet ondersteund. Kies een .pdf, .docx of .xlsx bestand.');
            }

            if (text.length < 10) {
                throw new Error("Geen leesbare tekst gevonden in dit bestand.");
            }

            setInputText(text);
            handleAnalyze(text);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Kon het bestand niet lezen.');
            setStage('input');
        }
    };

    const handleAnalyze = async (textToAnalyze: string) => {
        if (!textToAnalyze.trim()) {
            setError("Voer tekst in om te analyseren.");
            return;
        }
        setError(null);
        setStage('analyzing');

        try {
            const terms = await extractKeyTerms(textToAnalyze, { aiModel });
            if (terms.length === 0) {
                throw new Error("Geen geschikte termen gevonden. Probeer een langere tekst.");
            }
            setExtractedTerms(terms);
            setStage('selection');
        } catch (err) {
            setError(err instanceof Error ? err.message : "Analyse mislukt. Probeer het opnieuw.");
            setStage('input');
        }
    };

    const handleStart = () => {
        const effectiveContext = (hideContextInput ? defaultContext : context) || 'Algemeen';

        // Bepaal welke woorden al geoefend zijn
        const practicedSet = new Set(
            (existingProgress?.practicedWords || []).map(w => w.toLowerCase())
        );

        // Splits woorden in ongeoefend en geoefend
        const unpracticedWords = extractedTerms.filter(
            word => !practicedSet.has(word.toLowerCase())
        );
        const practicedWords = extractedTerms.filter(
            word => practicedSet.has(word.toLowerCase())
        );

        let selectedWords: string[];

        if (unpracticedWords.length >= selectedLength) {
            // Genoeg ongeoefende woorden: random selectie daaruit
            selectedWords = shuffleArray(unpracticedWords).slice(0, selectedLength);
        } else {
            // Niet genoeg: pak alle ongeoefende + random uit geoefende
            const neededFromPracticed = selectedLength - unpracticedWords.length;
            selectedWords = [
                ...unpracticedWords,
                ...shuffleArray(practicedWords).slice(0, neededFromPracticed)
            ];
        }

        // Shuffle finale selectie
        selectedWords = shuffleArray(selectedWords);

        // Geef alle woorden door voor tracking
        onWordsSelected(selectedWords, effectiveContext, fileName || undefined, extractedTerms);
    };

    // Calculate statistics
    const practicedSet = new Set(
        (existingProgress?.practicedWords || []).map(w => w.toLowerCase())
    );
    const unpracticedCount = extractedTerms.filter(w => !practicedSet.has(w.toLowerCase())).length;
    const practicedCount = extractedTerms.length - unpracticedCount;

    if (stage === 'analyzing') {
        return (
            <div className="flex flex-col items-center justify-center h-[350px] text-center">
                <Spinner className="text-white h-12 w-12" />
                <p className="mt-4 text-lg font-semibold text-white">Tekst analyseren...</p>
                <p className="text-slate-300">De AI zoekt naar de belangrijkste woorden.</p>
            </div>
        );
    }

    if (stage === 'selection') {
        return (
            <div className="space-y-4 animate-fade-in">
                {/* Samenvatting */}
                <div className="bg-green-500/20 border border-green-500/30 p-4 rounded-xl">
                    <p className="font-bold text-white flex items-center gap-2">
                        <span className="text-xl">✅</span>
                        {extractedTerms.length} woorden gevonden
                        {fileName && <span className="text-slate-300 font-normal text-sm"> in "{fileName}"</span>}
                    </p>
                    {practicedCount > 0 && (
                        <p className="text-sm text-green-300 mt-1 flex items-center gap-2">
                            <span>📊</span>
                            {practicedCount} al geoefend, {unpracticedCount} nieuw
                        </p>
                    )}
                </div>

                {/* Sessielengte Selector */}
                <div>
                    <p className="font-semibold text-white mb-3">Kies hoeveel woorden je wilt oefenen:</p>
                    <div className="grid grid-cols-3 gap-3">
                        {SESSION_LENGTH_OPTIONS.map(option => (
                            <button
                                key={option.words}
                                onClick={() => setSelectedLength(option.words)}
                                className={`p-4 rounded-lg transition-all duration-200 font-medium flex flex-col items-center justify-center h-24 ${selectedLength === option.words
                                        ? 'bg-tal-purple ring-2 ring-white/50'
                                        : 'bg-black/20 hover:bg-black/40'
                                    }`}
                            >
                                <span className="text-2xl mb-1">{option.emoji}</span>
                                <span className="text-sm font-semibold">{option.name}</span>
                                <span className="text-xs text-slate-300">{option.words} w.</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Start knop */}
                <button
                    onClick={handleStart}
                    disabled={!studentName.trim()}
                    className="w-full px-8 py-4 bg-tal-purple text-white font-bold text-lg rounded-xl shadow-lg hover:bg-tal-purple-dark transform active:scale-[0.98] transition-all duration-300 focus:outline-none focus:ring-4 ring-tal-purple/50 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                    <span role="img" aria-label="Raket">🚀</span> Start met {selectedLength} woorden
                </button>

                {/* Bekijk alle woorden (verborgen) */}
                <div className="text-sm">
                    <button
                        onClick={() => setShowAllWords(!showAllWords)}
                        className="w-full text-left text-slate-300 hover:text-white flex items-center gap-2 py-2"
                    >
                        <span className={`transform transition-transform ${showAllWords ? 'rotate-90' : ''}`}>▶</span>
                        Bekijk alle {extractedTerms.length} woorden
                    </button>
                    {showAllWords && (
                        <div className="mt-2 max-h-48 overflow-y-auto bg-black/20 p-3 rounded-lg animate-fade-in">
                            <div className="flex flex-wrap gap-2">
                                {extractedTerms.map(term => (
                                    <span
                                        key={term}
                                        className={`px-2 py-1 rounded text-xs ${practicedSet.has(term.toLowerCase())
                                                ? 'bg-green-500/30 text-green-300'
                                                : 'bg-white/10 text-white'
                                            }`}
                                        title={practicedSet.has(term.toLowerCase()) ? 'Al geoefend' : 'Nog niet geoefend'}
                                    >
                                        {term}
                                    </span>
                                ))}
                            </div>
                            <p className="text-xs text-slate-400 mt-3">
                                <span className="inline-block w-3 h-3 bg-green-500/30 rounded mr-1"></span> = al geoefend
                            </p>
                        </div>
                    )}
                </div>

                <button onClick={resetState} className="w-full mt-2 text-center text-xs text-slate-300 hover:text-white underline">
                    Andere tekst analyseren
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fade-in">
            {!hideContextInput && (
                <div>
                    <label htmlFor="custom-context" className="font-semibold text-white mb-2 block">Context (optioneel):</label>
                    <input
                        id="custom-context"
                        type="text"
                        value={context}
                        onChange={(e) => setContext(e.target.value)}
                        placeholder="bv. Geschiedenis, Het menselijk lichaam..."
                        className="w-full p-3 border-2 border-white/20 bg-white/10 rounded-lg focus:ring-2 focus:ring-tal-purple transition placeholder:text-slate-300"
                    />
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Plak hier je tekst..."
                    className="w-full p-3 h-32 border-2 border-dashed border-white/30 bg-white/10 rounded-lg focus:ring-2 focus:ring-tal-purple transition placeholder:text-slate-300"
                />
                <div className="flex flex-col items-center justify-center p-3 h-32 border-2 border-dashed border-white/30 bg-white/10 rounded-lg">
                    <label htmlFor="file-upload" className="cursor-pointer text-center text-slate-300 hover:text-white">
                        <span className="text-3xl">📄</span>
                        <p className="font-semibold">Upload .docx, .pdf of .xlsx</p>
                        {fileName && <p className="text-xs mt-1 text-tal-gold truncate max-w-full">{fileName}</p>}
                    </label>
                    <input id="file-upload" type="file" accept=".pdf,.docx,.xlsx" className="hidden" onChange={handleFileChange} />
                </div>
            </div>
            {error && <p className="text-sm text-red-400 bg-red-900/50 p-2 rounded-md">{error}</p>}
            <button onClick={() => handleAnalyze(inputText)} disabled={!inputText.trim()} className="w-full px-8 py-3 bg-white/80 text-tal-teal-dark font-bold rounded-lg shadow-lg hover:bg-white disabled:bg-slate-400/50 disabled:text-slate-300 disabled:cursor-not-allowed transition">
                Analyseer Tekst
            </button>
        </div>
    );
};

export default CustomWordExtractor;
