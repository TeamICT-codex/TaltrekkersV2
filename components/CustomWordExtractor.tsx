
import React, { useState } from 'react';
import { extractKeyTerms } from '../services/geminiService';
import { PracticeSettings } from '../types';
import Spinner from './Spinner';
import { MAX_WORDS_PER_SESSION } from '../constants';

declare const pdfjsLib: any;
declare const mammoth: any;
declare const XLSX: any;

interface CustomWordExtractorProps {
    onWordsSelected: (words: string[], context: string, fileName?: string) => void;
    aiModel: PracticeSettings['aiModel'];
    studentName: string;
    defaultContext?: string;
    hideContextInput?: boolean;
}

type Stage = 'input' | 'analyzing' | 'selection';

const cleanText = (text: string): string => {
    // Replace multiple spaces/newlines with single space, trim
    return text.replace(/\s+/g, ' ').trim();
};

const CustomWordExtractor: React.FC<CustomWordExtractorProps> = ({ onWordsSelected, aiModel, studentName, defaultContext, hideContextInput }) => {
    const [stage, setStage] = useState<Stage>('input');
    const [inputText, setInputText] = useState('');
    const [extractedTerms, setExtractedTerms] = useState<string[]>([]);
    const [selectedTerms, setSelectedTerms] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [context, setContext] = useState('');
    const [fileName, setFileName] = useState<string | null>(null);

    const resetState = () => {
        setStage('input');
        setInputText('');
        setExtractedTerms([]);
        setSelectedTerms(new Set());
        setError(null);
        setFileName(null);
    };

    const extractTextFromPdf = async (file: File): Promise<string> => {
        const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
        let fullText = '';
        // Limit page parsing to first 20 pages to prevent browser crashes on huge books
        const maxPages = Math.min(pdf.numPages, 20);
        
        for (let i = 1; i <= maxPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            // @ts-ignore
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
        // @ts-ignore
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
            setSelectedTerms(new Set(terms.slice(0, MAX_WORDS_PER_SESSION)));
            setStage('selection');
        } catch (err) {
            setError(err instanceof Error ? err.message : "Analyse mislukt. Probeer het opnieuw.");
            setStage('input');
        }
    };

    const toggleTermSelection = (term: string) => {
        setSelectedTerms(prev => {
            const newSet = new Set(prev);
            if (newSet.has(term)) {
                newSet.delete(term);
            } else if (newSet.size < MAX_WORDS_PER_SESSION) {
                newSet.add(term);
            } else {
                alert(`Je kunt maximaal ${MAX_WORDS_PER_SESSION} woorden tegelijk selecteren.`);
            }
            return newSet;
        });
    };
    
    const handleSelectAll = () => {
        setSelectedTerms(new Set(extractedTerms.slice(0, MAX_WORDS_PER_SESSION)));
    };

    const handleDeselectAll = () => {
        setSelectedTerms(new Set());
    };

    const handleStart = () => {
        // Determine effective context: use default if hidden/provided, otherwise user input
        const effectiveContext = (hideContextInput ? defaultContext : context) || 'Algemeen';
        onWordsSelected(Array.from(selectedTerms), effectiveContext, fileName || undefined);
    };

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
                <div>
                    <p className="font-semibold text-white mb-2">Selecteer de woorden die je wilt oefenen:</p>
                    <div className="flex gap-2 mb-2">
                        <button onClick={handleSelectAll} className="px-3 py-1 text-xs bg-white/20 rounded-md hover:bg-white/30">Selecteer alles</button>
                        <button onClick={handleDeselectAll} className="px-3 py-1 text-xs bg-white/20 rounded-md hover:bg-white/30">Deselecteer alles</button>
                    </div>
                    <div className="max-h-48 overflow-y-auto bg-black/20 p-3 rounded-lg space-y-2">
                        {extractedTerms.map(term => (
                            <label key={term} className="flex items-center gap-3 p-2 rounded-md hover:bg-white/20 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedTerms.has(term)}
                                    onChange={() => toggleTermSelection(term)}
                                    className="h-5 w-5 rounded bg-white/30 border-white/50 text-tal-purple focus:ring-tal-purple"
                                />
                                <span className="capitalize">{term}</span>
                            </label>
                        ))}
                    </div>
                     <p className="text-xs text-slate-300 mt-2 text-right font-semibold">{selectedTerms.size} / {MAX_WORDS_PER_SESSION} geselecteerd</p>
                </div>
                 <div>
                    <button onClick={handleStart} disabled={selectedTerms.size === 0 || !studentName.trim()} className="w-full px-8 py-4 bg-tal-purple text-white font-bold text-lg rounded-xl shadow-lg hover:bg-tal-purple-dark transform active:scale-[0.98] transition-all duration-300 focus:outline-none focus:ring-4 ring-tal-purple/50 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-3">
                        <span role="img" aria-label="Raket">🚀</span> Start met {selectedTerms.size} {selectedTerms.size === 1 ? 'woord' : 'woorden'}
                    </button>
                    <button onClick={resetState} className="w-full mt-2 text-center text-xs text-slate-300 hover:text-white underline">Andere tekst analyseren</button>
                 </div>
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
