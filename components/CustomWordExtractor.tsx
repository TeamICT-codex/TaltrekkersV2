import React, { useState, useMemo } from 'react';
import { extractKeyTerms } from '../services/geminiService';
import { PracticeSettings, WordListProgress } from '../types';
import type { Vak } from '../data/curriculumVakken';
import { categorizeError, AppError, ERROR_ICONS } from '../services/errorHandling';
import { shuffleArray } from '../services/utils';
import { selectWordsForSession } from '../services/wordSelection';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import Spinner from './Spinner';
import { SESSION_LENGTH_OPTIONS, MAX_WORDS_PER_SESSION } from '../constants';

// Globale types voor CDN-bibliotheken: zie /types/cdn-libs.d.ts

interface CustomWordExtractorProps {
    onWordsSelected: (words: string[], context: string, fileName?: string, allWords?: string[]) => void;
    aiModel: PracticeSettings['aiModel'];
    studentName: string;
    defaultContext?: string;
    hideContextInput?: boolean;
    /**
     * Lookup-callback om eerdere voortgang voor een opgeladen lijst op te halen.
     * Wordt aangeroepen MET fileName (post-upload). PracticeSetup gebruikt
     * intern `wordListProgress[fileName]`. Voor opgeladen lijsten is dit de
     * enige manier om progress te tonen — `existingProgress` als directe prop
     * werkte niet omdat de fileName pas NA upload bekend is.
     */
    lookupProgress?: (listId: string) => WordListProgress | undefined;
    /**
     * Lijst van vakken waaruit de leerling NA upload mag kiezen ("welk vak is
     * dit?"). PracticeSetup berekent deze op basis van finaliteit/jaargang/
     * richting en levert hem hier. Bij empty/undefined → geen vak-dropdown
     * (bv. text-paste flow waar context handmatig wordt ingevuld).
     *
     * De gekozen vak.id wordt na keuze gebruikt als Gemini-context voor Frayer/
     * Quiz — kritiek voor correcte interpretatie van ambigue termen ("virus" =
     * computer-virus in ICT, niet ziekte).
     */
    availableVakken?: Vak[];
    /**
     * Callback om woorden op te halen die in eerdere sessies van een specifieke
     * lijst FOUT beantwoord werden. Wordt gebruikt voor consolidatie aan het eind
     * van een cyclus. Callback ontvangt de fileName (= listId), en PracticeSetup
     * gebruikt dat om door SessionRecords te filteren.
     *
     * Callback i.p.v. directe prop: de fileName is pas NA upload bekend, dus
     * PracticeSetup kan de set niet vooraf doorgeven.
     */
    getIncorrectWordsForFile?: (fileName: string) => string[];
}

type Stage = 'input' | 'analyzing' | 'selection';

const cleanText = (text: string): string => {
    return text.replace(/\s+/g, ' ').trim();
};

const CustomWordExtractor: React.FC<CustomWordExtractorProps> = ({
    onWordsSelected,
    aiModel,
    studentName,
    defaultContext,
    hideContextInput,
    lookupProgress,
    availableVakken,
    getIncorrectWordsForFile,
}) => {
    const [stage, setStage] = useState<Stage>('input');
    const [inputText, setInputText] = useState('');
    const [extractedTerms, setExtractedTerms] = useState<string[]>([]);
    const [selectedLength, setSelectedLength] = useState(SESSION_LENGTH_OPTIONS[0].words);
    const [error, setError] = useState<AppError | null>(null);
    // Vak-keuze na upload — bepalend voor Gemini-context bij Frayer/Quiz.
    // Wordt gereset bij resetState zodat een volgende upload opnieuw vraagt.
    const [selectedVakId, setSelectedVakId] = useState<string | null>(null);
    const [context, setContext] = useState('');
    const [fileName, setFileName] = useState<string | null>(null);
    const [showAllWords, setShowAllWords] = useState(false);
    const [lastAnalyzedText, setLastAnalyzedText] = useState<string>(''); // Voor retry
    const [pdfTruncated, setPdfTruncated] = useState(false);

    const { isOnline } = useNetworkStatus();

    const MAX_FILE_SIZE_MB = 10;
    const ALLOWED_MIME_TYPES: Record<string, string> = {
        'application/pdf': '.pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    };

    const resetState = () => {
        setStage('input');
        setInputText('');
        setExtractedTerms([]);
        setSelectedLength(SESSION_LENGTH_OPTIONS[0].words);
        setError(null);
        setFileName(null);
        setShowAllWords(false);
        setPdfTruncated(false);
        setSelectedVakId(null);
    };

    const extractTextFromPdf = async (file: File): Promise<string> => {
        const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
        let fullText = '';
        const maxPages = Math.min(pdf.numPages, 20);

        if (pdf.numPages > 20) {
            setPdfTruncated(true);
        }

        for (let i = 1; i <= maxPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map((item) => item.str).join(' ') + ' ';
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
            const data = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });
            fullText += data.flat().filter(cell => typeof cell === 'string' || typeof cell === 'number').join(' ') + ' ';
        });
        return cleanText(fullText);
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Bestandsgrootte validatie
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            setError(categorizeError(
                new Error(`Bestand is te groot. Maximum is ${MAX_FILE_SIZE_MB} MB.`),
                'Bestandsvalidatie'
            ));
            event.target.value = '';
            return;
        }

        // MIME-type validatie
        const ext = file.name.split('.').pop()?.toLowerCase();
        const isValidMime = file.type in ALLOWED_MIME_TYPES;
        const isValidExt = ext === 'pdf' || ext === 'docx' || ext === 'xlsx';
        if (!isValidMime && !isValidExt) {
            setError(categorizeError(
                new Error('Bestandstype niet ondersteund. Kies een .pdf, .docx of .xlsx bestand.'),
                'Bestandsvalidatie'
            ));
            event.target.value = '';
            return;
        }

        setError(null);
        setPdfTruncated(false);
        setStage('analyzing');
        setFileName(file.name);

        try {
            let text = '';
            if (file.type === 'application/pdf' || ext === 'pdf') {
                text = await extractTextFromPdf(file);
            } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === 'docx') {
                text = await extractTextFromDocx(file);
            } else {
                text = await extractTextFromXlsx(file);
            }

            if (text.length < 10) {
                throw new Error("Geen leesbare tekst gevonden in dit bestand.");
            }

            setInputText(text);
            handleAnalyze(text);
        } catch (err) {
            setError(categorizeError(err, 'Bestand lezen'));
            event.target.value = '';
            setStage('input');
        }
    };

    const handleAnalyze = async (textToAnalyze: string) => {
        if (!textToAnalyze.trim()) {
            setError(categorizeError(new Error('Geen tekst'), 'Tekstinvoer'));
            return;
        }

        if (!isOnline) {
            setError(categorizeError(new Error('network'), 'Netwerkcontrole'));
            return;
        }

        setError(null);
        setStage('analyzing');
        setLastAnalyzedText(textToAnalyze); // Bewaar voor retry

        try {
            // Geef vakcontext mee aan extractie. Op dit moment is selectedVakId
            // nog null (vak wordt PAS na extractie gekozen — natuurlijke flow).
            // Fallback naar defaultContext (uploadContext.name) als hint voor
            // het traject/niveau — biedt zwakke maar nuttige context aan Gemini.
            // De échte vak-specifieke interpretatie komt later bij Frayer/Quiz
            // op basis van selectedVakId.
            const effectiveContext = (hideContextInput ? defaultContext : context) || undefined;
            const terms = await extractKeyTerms(textToAnalyze, {
                aiModel,
                context: effectiveContext,
            });
            if (terms.length === 0) {
                throw new Error("Geen geschikte termen gevonden. Probeer een langere tekst.");
            }
            setExtractedTerms(terms);
            setStage('selection');
        } catch (err) {
            setError(categorizeError(err, 'Tekst analyseren'));
            setStage('input');
        }
    };

    // Resolveer de werkelijke listId — moet OVEREENKOMEN met wat usePracticeSession
    // gebruikt: `customFileName || context || 'general'`. Voor file-uploads = de
    // bestandsnaam. Voor text-paste in 'Eigen woorden' tab = de context-string.
    const effectiveListId = fileName
        || selectedVakId
        || (hideContextInput ? defaultContext : context)
        || null;

    const effectiveProgress = useMemo(() => {
        if (!effectiveListId || !lookupProgress) return undefined;
        return lookupProgress(effectiveListId);
    }, [effectiveListId, lookupProgress]);

    const handleStart = () => {
        // Vak-keuze (in dropdown na upload) wint van uploadContext-fallback.
        // Voorbeeld: leerling uploadt ICT-lijst, kiest "ICT" → effectiveContext
        // = "ICT" → Frayer interpreteert "virus" als computer-virus.
        const effectiveContext = selectedVakId
            || (hideContextInput ? defaultContext : context)
            || 'Algemeen';

        // Sluitende-cyclus selectie: ongeoefend EERST (in PDF-volgorde), bij
        // cyclus-eind aangevuld met foute woorden uit eerdere sessies en (als
        // dat ook niet genoeg is) random uit overige geoefende.
        const incorrectWords = fileName
            ? (getIncorrectWordsForFile?.(fileName) ?? [])
            : [];
        const selection = selectWordsForSession({
            allWords: extractedTerms,
            practicedWords: effectiveProgress?.practicedWords,
            incorrectWords,
            sessionSize: selectedLength,
        });

        // Shuffle ENKEL voor presentatie — heeft geen invloed op WELKE woorden
        // gekozen zijn (helper heeft die al deterministisch bepaald).
        const presentedWords = shuffleArray(selection.words);

        // Geef alle woorden door voor tracking (extractedTerms is de volledige lijst,
        // presentedWords is de geselecteerde subset voor deze sessie).
        onWordsSelected(presentedWords, effectiveContext, fileName || undefined, extractedTerms);
    };

    // Calculate statistics
    const practicedSet = new Set(
        (effectiveProgress?.practicedWords || []).map(w => w.toLowerCase())
    );
    const unpracticedCount = extractedTerms.filter(w => !practicedSet.has(w.toLowerCase())).length;
    const practicedCount = extractedTerms.length - unpracticedCount;
    const progressPercent = extractedTerms.length > 0
        ? Math.round((practicedCount / extractedTerms.length) * 100)
        : 0;
    // Cyclus-eind = niet genoeg ongeoefende woorden over voor een volledige sessie
    const isCycleEnd = extractedTerms.length > 0 && unpracticedCount < selectedLength;
    const isFullyPracticed = extractedTerms.length > 0 && unpracticedCount === 0;

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
                {/* Samenvatting + voortgang */}
                <div className="bg-green-500/20 border border-green-500/30 p-4 rounded-xl">
                    <p className="font-bold text-white flex items-center gap-2">
                        <span className="text-xl">✅</span>
                        {extractedTerms.length} woorden gevonden
                        {fileName && <span className="text-slate-300 font-normal text-sm"> in "{fileName}"</span>}
                    </p>
                    {practicedCount > 0 && (
                        <>
                            <div className="mt-3 flex items-center gap-2 text-sm text-green-100">
                                <span className="font-semibold">{practicedCount}/{extractedTerms.length}</span>
                                <span>geoefend</span>
                                <span className="font-semibold ml-auto">{progressPercent}%</span>
                            </div>
                            <div className="mt-1 h-2 bg-black/30 rounded-full overflow-hidden">
                                <div
                                    className="h-full transition-all duration-500"
                                    style={{
                                        width: `${progressPercent}%`,
                                        background: 'linear-gradient(90deg, #34d399 0%, #10b981 100%)',
                                    }}
                                />
                            </div>
                            <p className="text-xs text-green-200/80 mt-2">
                                {unpracticedCount > 0
                                    ? `Nog ${unpracticedCount} nieuw${unpracticedCount === 1 ? '' : 'e'} woord${unpracticedCount === 1 ? '' : 'en'} te ontdekken`
                                    : '🎉 Je hebt elk woord uit deze lijst minstens 1× geoefend!'
                                }
                            </p>
                        </>
                    )}
                </div>

                {/* Cyclus-eind banner: bij volgende sessie minder dan N nieuwe woorden,
                    dus aanvulling met foute woorden uit eerdere sessies. */}
                {isCycleEnd && (
                    <div
                        className="p-3 rounded-xl border"
                        style={{
                            background: isFullyPracticed
                                ? 'linear-gradient(135deg, rgba(168,85,247,0.20) 0%, rgba(236,72,153,0.18) 100%)'
                                : 'rgba(251,191,36,0.15)',
                            borderColor: isFullyPracticed ? 'rgba(216,180,254,0.40)' : 'rgba(251,191,36,0.40)',
                        }}
                    >
                        <p className="text-sm text-white flex items-start gap-2 leading-snug">
                            <span className="text-base">{isFullyPracticed ? '🎯' : '🔄'}</span>
                            <span>
                                {isFullyPracticed ? (
                                    <>
                                        <strong>Consolidatie-sessie:</strong> je hebt deze lijst helemaal doorlopen.
                                        Deze sessie focust op woorden die je in eerdere rondes nog fout had.
                                    </>
                                ) : (
                                    <>
                                        <strong>Bijna rond!</strong> Nog {unpracticedCount} nieuwe woord{unpracticedCount === 1 ? '' : 'en'}.
                                        Deze sessie wordt aangevuld met woorden uit eerdere rondes die je fout had — extra oefening op je zwakke punten.
                                    </>
                                )}
                            </span>
                        </p>
                    </div>
                )}

                {/* Vak-keuze NA upload — natuurlijke flow: leerling ziet zijn woorden,
                    daarna vraagt de app "welk vak is dit?" om Gemini de juiste context
                    te geven voor Frayer/Quiz. Kritiek voor ambigue termen (ICT-virus
                    vs. ziekte). Verschijnt alleen als er vakken aangeleverd zijn. */}
                {availableVakken && availableVakken.length > 0 && (
                    <div
                        className="p-3 rounded-xl border"
                        style={{
                            background: selectedVakId
                                ? 'rgba(16,185,129,0.15)'
                                : 'rgba(251,191,36,0.15)',
                            borderColor: selectedVakId
                                ? 'rgba(110,231,183,0.40)'
                                : 'rgba(251,191,36,0.45)',
                        }}
                    >
                        <label htmlFor="post-upload-vak" className="block text-sm font-semibold text-white mb-2">
                            📚 Welk vak hoort deze lijst bij?
                            <span className="text-amber-200 text-xs font-normal ml-2">
                                (verbetert de AI-uitleg sterk)
                            </span>
                        </label>
                        <select
                            id="post-upload-vak"
                            value={selectedVakId ?? ''}
                            onChange={(e) => setSelectedVakId(e.target.value || null)}
                            className="w-full p-2.5 rounded-lg bg-black/30 border border-white/20 text-white text-sm focus:ring-2 focus:ring-amber-300 outline-none cursor-pointer"
                        >
                            <option value="">— Kies een vak (aanbevolen) —</option>
                            {availableVakken.map(vak => (
                                <option key={vak.id} value={vak.id} className="bg-tal-teal-dark text-white">
                                    {vak.label}
                                </option>
                            ))}
                        </select>
                        {!selectedVakId ? (
                            <p className="text-xs text-amber-200/90 mt-2 leading-snug">
                                💡 Tip: ICT-woorden zoals <strong>"virus"</strong> of <strong>"cookie"</strong> krijgen
                                dan de IT-betekenis i.p.v. de alledaagse uitleg.
                            </p>
                        ) : (
                            <p className="text-xs text-emerald-200 mt-2 leading-snug">
                                ✓ AI weet nu dat dit een {availableVakken.find(v => v.id === selectedVakId)?.label}-lijst is.
                            </p>
                        )}
                    </div>
                )}

                {/* PDF truncatie waarschuwing */}
                {pdfTruncated && (
                    <div className="bg-yellow-500/20 border border-yellow-500/30 p-3 rounded-xl">
                        <p className="text-sm text-yellow-300 flex items-center gap-2">
                            <span>⚠️</span>
                            Dit PDF heeft meer dan 20 pagina's. Alleen de eerste 20 pagina's zijn geanalyseerd.
                        </p>
                    </div>
                )}

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

            {/* Offline waarschuwing */}
            {!isOnline && (
                <div className="flex items-center gap-2 p-3 bg-amber-500/20 border border-amber-500/30 rounded-lg text-amber-200">
                    <span>📡</span>
                    <span className="text-sm">Geen internetverbinding gedetecteerd</span>
                </div>
            )}

            {/* Error display met retry optie */}
            {error && (
                <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-red-200 mb-2">
                        <span>{ERROR_ICONS[error.category]}</span>
                        <span className="font-semibold">{error.message}</span>
                    </div>
                    <p className="text-sm text-red-300/80 mb-3">{error.suggestion}</p>
                    {error.canRetry && lastAnalyzedText && (
                        <button
                            onClick={() => handleAnalyze(lastAnalyzedText)}
                            className="px-4 py-2 bg-red-500/30 hover:bg-red-500/50 rounded-lg text-sm font-medium transition"
                        >
                            🔄 Opnieuw proberen
                        </button>
                    )}
                </div>
            )}

            <button onClick={() => handleAnalyze(inputText)} disabled={!inputText.trim() || !isOnline} className="w-full px-8 py-3 bg-white/80 text-tal-teal-dark font-bold rounded-lg shadow-lg hover:bg-white disabled:bg-slate-400/50 disabled:text-slate-300 disabled:cursor-not-allowed transition">
                Analyseer Tekst
            </button>
        </div>
    );
};

export default CustomWordExtractor;
