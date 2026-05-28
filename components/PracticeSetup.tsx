import React, { useState, useMemo, useEffect } from 'react';
import { WordLevel, PracticeSettings, UserData, Finaliteit, Jaargang } from '../types';
import { WORD_LISTS_METADATA, loadWordList, LEVEL_DIFFICULTY_MAP, SESSION_LENGTH_OPTIONS, ONEDRIVE_URLS } from '../constants';
import { shuffleArray } from '../services/utils';
import { selectWordsForSession, getIncorrectWordsForList, prepareResumeList } from '../services/wordSelection';
import { useAuth } from '../contexts/AuthContext';
import CustomWordExtractor from './CustomWordExtractor';
import { getVakkenForUpload } from '../data/curriculumVakken';

interface CourseOption {
    id: string;
    name: string;
    url?: string;
}

// Design-keuze 2026-05: we tonen GEEN richting/vak-tussenstap meer.
// De leerling klikt door naar de OneDrive folder van zijn finaliteit/jaargang/vaktype
// en kiest daar zelf de juiste richting (bv. 5 ONOSA, 5 LOGIS, BORGA, APPDA, ...).
// Dit maakt onderhoud veel eenvoudiger: ~24 links te onderhouden i.p.v. 600+,
// en consistent voor alle finaliteiten (AF / DF / OKAN).
//
// Functie blijft bestaan in de signature zodat de bestaande UI-logica
// (availableCourses, selectedCourse) niet hoeft te wijzigen. Retourneert
// altijd een lege array → tussenstap 5 wordt overgeslagen.
function getCoursesForContext(
    _finaliteit: Finaliteit | null,
    _jaargang: Jaargang | null,
    _vakType: 'basisvorming' | 'specifiek' | '7HO' | '7KB' | null
): CourseOption[] {
    return [];
}

interface PracticeSetupProps {
    studentName: string;
    nativeLanguage: string;
    aiModel: PracticeSettings['aiModel'];
    currentUserData?: UserData;
    isStoryModeUnlocked: boolean;
    onStartPractice: (userName: string, words: string[], settings: PracticeSettings) => void;
    onStartStoryChallenge: (userName: string, aiModel: PracticeSettings['aiModel']) => void;
    onShowDashboard: () => void;
}

const modeDetails: Record<string, { emoji: string; tooltip: string }> = {
    [WordLevel.Woordenschat2DF]: { emoji: '📚', tooltip: 'Woordenschat 2e graad dubbele finaliteit' },
    [WordLevel.Woordenschat2AF]: { emoji: '🛠️', tooltip: 'Woordenschat 2e graad arbeidsfinaliteit' },
    [WordLevel.AcademischNederlands]: { emoji: '🎓', tooltip: 'Academisch taalgebruik voor hoger onderwijs' },
    [WordLevel.ProfessioneelNederlands]: { emoji: '💼', tooltip: 'Professioneel taalgebruik voor de werkvloer' },
    [WordLevel.Custom]: { emoji: '✏️', tooltip: 'Je eigen woordenlijst' },
};

const generalDisplayModes = [
    WordLevel.Woordenschat2DF,
    WordLevel.Woordenschat2AF,
    WordLevel.AcademischNederlands,
    WordLevel.ProfessioneelNederlands,
];

const finaliteiten: { id: Finaliteit, name: string }[] = [
    { id: 'AF', name: 'Arbeidsfinaliteit' },
    { id: 'DF', name: 'Dubbele finaliteit' },
    { id: 'OKAN', name: 'OKAN' }
];

const jaargangenPerFinaliteit: Record<Finaliteit, Jaargang[]> = {
    AF: ['3e', '4e', '5e', '5 Duaal', '6e', '6 Duaal', '7e'],
    DF: ['3e', '4e', '5e', '6e'],
    OKAN: ['Fase 1', 'Fase 2', 'Fase 3', 'Fase 4'],
};

const PracticeSetup: React.FC<PracticeSetupProps> = ({
    studentName,
    nativeLanguage,
    aiModel,
    currentUserData,
    isStoryModeUnlocked,
    onStartPractice,
    onStartStoryChallenge,
    onShowDashboard
}) => {
    // Profile-defaults voor finaliteit/jaargang — opgeslagen bij eerste-login onboarding.
    // Zo hoeft de leerling deze niet bij elke vakspecifieke sessie opnieuw te kiezen.
    const { finaliteit: profileFinaliteit, jaargang: profileJaargang } = useAuth();

    const [practiceMode, setPracticeMode] = useState<'general' | 'subjectSpecific' | 'custom' | 'myLists'>('general');
    const [wordsPerSession, setWordsPerSession] = useState(20);
    const [enableTTS, setEnableTTS] = useState(false);

    // State for 'general' mode
    const [selectedGeneralMode, setSelectedGeneralMode] = useState<WordLevel>(WordLevel.Woordenschat2DF);

    // State for 'subjectSpecific' mode — pre-filled vanuit profile bij eerste mount.
    const [selectedFinaliteit, setSelectedFinaliteit] = useState<Finaliteit | null>(profileFinaliteit);
    const [selectedJaargang, setSelectedJaargang] = useState<Jaargang | null>(profileJaargang);
    const [selectedVakType, setSelectedVakType] = useState<'basisvorming' | 'specifiek' | '7HO' | '7KB' | null>(null);
    const [selectedCourse, setSelectedCourse] = useState<CourseOption | null>(null);

    useEffect(() => {
        setSelectedJaargang(null);
        setSelectedVakType(null);
        setSelectedCourse(null);
    }, [selectedFinaliteit]);

    // Wanneer de huidige finaliteit overeenkomt met het profiel, herstel ook de
    // profile-jaargang (de bovenstaande reset-useEffect heeft die zojuist gewist).
    // Effect: leerling ziet bij mount én bij terugkeer naar zijn eigen finaliteit
    // automatisch zijn jaargang ingevuld, zonder dat user-keuzes anders overschreven worden.
    useEffect(() => {
        if (selectedFinaliteit && selectedFinaliteit === profileFinaliteit && profileJaargang) {
            setSelectedJaargang(profileJaargang);
        }
    }, [selectedFinaliteit, profileFinaliteit, profileJaargang]);

    // Bij switch naar subjectSpecific (vanuit general/custom) gehéél lege state hervullen.
    useEffect(() => {
        if (practiceMode === 'subjectSpecific' && !selectedFinaliteit && profileFinaliteit) {
            setSelectedFinaliteit(profileFinaliteit);
        }
    }, [practiceMode, profileFinaliteit, selectedFinaliteit]);

    useEffect(() => {
        setSelectedVakType(null);
        setSelectedCourse(null);
    }, [selectedJaargang]);

    useEffect(() => {
        setSelectedCourse(null);
    }, [selectedVakType]);

    useEffect(() => {
        if (practiceMode !== 'subjectSpecific') {
            setSelectedFinaliteit(null);
            setSelectedJaargang(null);
            setSelectedVakType(null);
            setSelectedCourse(null);
        }
    }, [practiceMode]);

    // Beschikbare vakken/richtingen voor de huidige selectie (uit schoolStructure.ts)
    const availableCourses = useMemo(
        () => getCoursesForContext(selectedFinaliteit, selectedJaargang, selectedVakType),
        [selectedFinaliteit, selectedJaargang, selectedVakType]
    );

    const showUploadScreen = useMemo(() => {
        if (practiceMode !== 'subjectSpecific' || !selectedFinaliteit) return false;
        if (selectedFinaliteit === 'OKAN') return selectedJaargang !== null;
        if (!(selectedJaargang !== null && selectedVakType !== null)) return false;
        // Als er courses zijn, eerst een course laten kiezen voordat we naar upload gaan
        if (availableCourses.length > 0 && !selectedCourse) return false;
        return true;
    }, [practiceMode, selectedFinaliteit, selectedJaargang, selectedVakType, availableCourses, selectedCourse]);

    const uploadContext = useMemo(() => {
        if (!selectedFinaliteit) return null;
        if (selectedFinaliteit === 'OKAN' && selectedJaargang) {
            const key = `OKAN-${selectedJaargang}`;
            return { id: key, name: `OKAN — ${selectedJaargang}`, url: (ONEDRIVE_URLS[key] ?? null) as string | null };
        }
        if (selectedJaargang && selectedVakType) {
            const typeName = selectedVakType === 'basisvorming' ? 'Basisvorming'
                : selectedVakType === 'specifiek' ? 'Specifiek gedeelte'
                : selectedVakType;
            const baseKey = `${selectedFinaliteit}-${selectedJaargang}-${selectedVakType}`;
            const baseUrl = (ONEDRIVE_URLS[baseKey] ?? null) as string | null;
            // Als de leerling een specifiek vak/richting koos, prefer die naam + URL
            if (selectedCourse) {
                return {
                    id: selectedCourse.id,
                    name: `${selectedFinaliteit} ${selectedJaargang} — ${selectedCourse.name}`,
                    url: (selectedCourse.url ?? baseUrl) as string | null,
                };
            }
            return { id: baseKey, name: `${selectedFinaliteit} ${selectedJaargang} — ${typeName}`, url: baseUrl };
        }
        return null;
    }, [selectedFinaliteit, selectedJaargang, selectedVakType, selectedCourse]);

    // Beschikbare vakken voor de huidige (finaliteit + jaargang + richting)-combo.
    // OKAN: per fase een eigen lijst thema's (incl. ICT, Schooltaalwoorden, ...).
    // AF/DF basisvorming: alle algemene vakken (Nederlands, Wiskunde, ...).
    // AF/DF specifiek: vakken voor de gekozen richting (bv. APPDA → SQL, Hardware, ...).
    const availableVakken = useMemo(() => {
        return getVakkenForUpload({
            finaliteit: selectedFinaliteit ?? undefined,
            jaargang: selectedJaargang ?? undefined,
            richting: selectedCourse?.name,
            vakType: selectedVakType,
        });
    }, [selectedFinaliteit, selectedJaargang, selectedVakType, selectedCourse]);

    const getExistingProgress = (contextId: string) => {
        return currentUserData?.wordListProgress?.[contextId];
    };

    const getWordListStats = (listId: string) => {
        const metadata = WORD_LISTS_METADATA[listId];
        const totalWords = metadata?.length || 0;
        if (totalWords === 0) return null;

        const existingProgress = getExistingProgress(listId);
        const practicedWords = new Set(existingProgress?.practicedWords?.map(w => w.toLowerCase()) || []);
        const practicedCount = practicedWords.size;

        const learnedWords = currentUserData?.learnedWords || {};
        
        // Let op: we hebben hier geen toegang tot de volledige lijst zonder deze in te laden.
        // Voor de voortgangsbalk in de setup gebruiken we een schatting of we laden de lijst in als we echt nauwkeurig willen zijn.
        // Gegeven de performance goal, gebruiken we hier een simpelere check of we slaan masteredCount op per lijst in de toekomst.
        // Voor nu: we tonen alleen de practiced progress.
        
        // mastered tracking per lijst zit nog niet in WordListProgress — toon 0 tot dat veld bestaat
        return {
            total: totalWords,
            practiced: practicedCount,
            mastered: 0,
            practicedPercent: Math.round((practicedCount / totalWords) * 100),
            masteredPercent: 0,
            isFullyPracticed: practicedCount >= totalWords,
            isFullyMastered: false,
        };
    };

    const handleStartGeneral = async () => {
        if (!studentName.trim()) {
            alert("Vul alsjeblieft een naam in.");
            return;
        }

        // Dynamisch inladen van de gekozen lijst
        const allWords = await loadWordList(selectedGeneralMode);
        const existingProgress = getExistingProgress(selectedGeneralMode);
        // Foute woorden uit eerdere sessies van DEZELFDE algemene lijst — voor consolidatie
        const incorrectWords = getIncorrectWordsForList(currentUserData?.sessionHistory, selectedGeneralMode);

        // Sluitende-cyclus selectie: ongeoefend EERST in PDF-volgorde, bij
        // cyclus-eind aangevuld met incorrect-woorden + random aanvulling.
        const selection = selectWordsForSession({
            allWords,
            practicedWords: existingProgress?.practicedWords,
            incorrectWords,
            sessionSize: wordsPerSession,
        });

        // Shuffle ENKEL voor presentatie — selectie is al deterministisch.
        const selectedWords = shuffleArray(selection.words);

        let settings: PracticeSettings = {
            showSynonymsAntonyms: true,
            wordsPerSession: wordsPerSession,
            aiModel,
            nativeLanguage: nativeLanguage.trim(),
            context: selectedGeneralMode,
            difficulty: LEVEL_DIFFICULTY_MAP[selectedGeneralMode],
            enableTTS,
            // VOLLEDIGE algemene lijst voor accurate WordListProgress.
            // Zonder dit zou allWords beperkt zijn tot de N woorden uit deze sessie.
            _listAllWords: allWords,
        };

        onStartPractice(studentName, selectedWords, settings);
    };

    const handleStartCustom = (words: string[], context: string, fileName?: string, allWords?: string[]) => {
        if (!studentName.trim()) {
            alert("Vul alsjeblieft een naam in.");
            return;
        }
        if (words.length === 0) {
            alert("Selecteer alsjeblieft woorden om te oefenen.");
            return;
        }

        // CustomWordExtractor levert al de juiste context: selectedVakId (na
        // post-upload vak-keuze) → defaultContext (uploadContext.name) → 'Algemeen'.
        // Hier hoeven we niets meer te overschrijven.
        const activeContext = context;

        const settings: PracticeSettings = {
            showSynonymsAntonyms: true,
            wordsPerSession: words.length,
            aiModel,
            nativeLanguage: nativeLanguage.trim(),
            context: activeContext,
            difficulty: WordLevel.Intermediate,
            customFileName: fileName,
            enableTTS,
            // De VOLLEDIGE woordenlijst — kritiek voor accurate WordListProgress.
            // Anders denkt de app dat allWords = de 20 woorden uit deze sessie.
            _listAllWords: allWords,
        };

        if (practiceMode === 'subjectSpecific' && selectedFinaliteit && selectedJaargang && uploadContext) {
            settings.finaliteit = selectedFinaliteit;
            settings.jaargang = selectedJaargang;
            settings.richting = uploadContext.name;
            settings.courseId = uploadContext.id;
        }

        onStartPractice(studentName, words, settings);
    };

    /**
     * Hervat een eerder opgeladen lijst zonder re-upload — kernfeature van #59.
     *
     * Gebruikt de opgeslagen `wordListProgress.allWords` (van de oorspronkelijke
     * upload) en `practicedWords` om via de selectie-helper de volgende sessie
     * te bouwen. De PracticeSettings worden overgenomen van de meest recente
     * sessie van deze lijst — zo behoudt de leerling zijn vak-keuze, AI-model,
     * etc. zonder opnieuw te moeten kiezen.
     */
    const handleResumeList = (listId: string) => {
        if (!studentName.trim()) {
            alert("Vul alsjeblieft een naam in.");
            return;
        }
        const progress = currentUserData?.wordListProgress?.[listId];
        const resumed = prepareResumeList({
            listId,
            progress,
            sessions: currentUserData?.sessionHistory,
        });
        if (!resumed) {
            alert("Deze lijst heeft geen opgeslagen woorden. Upload de lijst opnieuw.");
            return;
        }

        // Bouw settings: hergebruik vorige sessie's settings (vak-context, finaliteit
        // etc.), of fallback naar minimale defaults. Huidige UI-keuzes (aiModel,
        // nativeLanguage, enableTTS) winnen — die kunnen tussentijds veranderd zijn.
        // _listAllWords expliciet uit progress, NIET via lastSettings spread —
        // legacy sessies (pre-#59) hebben dit veld niet, en dan zou allWords
        // krimpen tot de N woorden van deze sessie.
        const lastSettings = resumed.lastSettings;
        const settings: PracticeSettings = lastSettings ? {
            ...lastSettings,
            wordsPerSession: resumed.words.length,
            aiModel,
            nativeLanguage: nativeLanguage.trim(),
            enableTTS,
            _listAllWords: progress?.allWords,
        } : {
            showSynonymsAntonyms: true,
            wordsPerSession: resumed.words.length,
            aiModel,
            nativeLanguage: nativeLanguage.trim(),
            context: listId,
            difficulty: WordLevel.Intermediate,
            customFileName: listId,
            enableTTS,
            _listAllWords: progress?.allWords,
        };

        onStartPractice(studentName, resumed.words, settings);
    };

    /** Alle wordListProgress entries gesorteerd op laatst-geoefend (meest recent eerst).
     *
     *  Filtert:
     *   - lege/legacy entries (allWords leeg)
     *   - 'weak-words' marker (interne flag voor zwakke-woorden sessies, niet voor UI)
     *   - algemene WordLevel listIds (die hebben hun eigen progress-tegel in de "Algemeen" tab)
     *
     *  Resultaat: enkel échte opgeladen woordenlijsten (file uploads + custom text-pastes). */
    const myListsEntries = useMemo(() => {
        const wordLevelIds = new Set(Object.values(WordLevel) as string[]);
        const entries = Object.entries(currentUserData?.wordListProgress ?? {})
            .filter(([listId, p]) =>
                p.allWords.length > 0
                && listId !== 'weak-words'
                && !wordLevelIds.has(listId)
            );
        entries.sort((a, b) => (b[1].lastPracticed || '').localeCompare(a[1].lastPracticed || ''));
        return entries;
    }, [currentUserData?.wordListProgress]);

    const isStartDisabled = !studentName.trim() ||
        (practiceMode === 'general' && !selectedGeneralMode);

    return (
        <div className="bg-white/10 p-4 rounded-2xl border border-white/20 space-y-4">
            <div>
                <p className="text-sm font-semibold text-white mb-2">1. Kies je woordenlijst:</p>
                <div className={`bg-black/20 p-1 rounded-xl grid gap-1 ${myListsEntries.length > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
                    <button onClick={() => setPracticeMode('general')} className={`px-2 py-1.5 rounded-lg font-semibold text-xs sm:text-sm transition-colors ${practiceMode === 'general' ? 'bg-white text-tal-teal shadow-md' : 'text-slate-200 hover:bg-white/10'}`}>Algemeen</button>
                    <button onClick={() => setPracticeMode('subjectSpecific')} className={`px-2 py-1.5 rounded-lg font-semibold text-xs sm:text-sm transition-colors ${practiceMode === 'subjectSpecific' ? 'bg-white text-tal-teal shadow-md' : 'text-slate-200 hover:bg-white/10'}`}>Vakspecifiek</button>
                    <button onClick={() => setPracticeMode('custom')} className={`px-2 py-1.5 rounded-lg font-semibold text-xs sm:text-sm transition-colors ${practiceMode === 'custom' ? 'bg-white text-tal-teal shadow-md' : 'text-slate-200 hover:bg-white/10'}`}>Eigen woorden</button>
                    {myListsEntries.length > 0 && (
                        <button
                            onClick={() => setPracticeMode('myLists')}
                            className={`px-2 py-1.5 rounded-lg font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1 ${practiceMode === 'myLists' ? 'bg-white text-tal-teal shadow-md' : 'text-slate-200 hover:bg-white/10'}`}
                        >
                            <span>📚 Mijn lijsten</span>
                            <span className="bg-tal-purple/80 text-white text-[10px] px-1.5 py-0.5 rounded-full">{myListsEntries.length}</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="min-h-[220px]">
                {practiceMode === 'general' && (
                    <div className="animate-fade-in space-y-6">
                        <div>
                            <p className="font-semibold text-white mb-2 text-sm">2. Kies je uitdaging:</p>
                            <div className="grid grid-cols-2 gap-2">
                                {generalDisplayModes.map(level => {
                                    const stats = getWordListStats(level);
                                    const hasProgress = stats && stats.practiced > 0;
                                    return (
                                        <button
                                            key={level}
                                            onClick={() => setSelectedGeneralMode(level)}
                                            title={modeDetails[level]?.tooltip}
                                            className={`p-3 rounded-lg transition-all duration-200 font-medium flex flex-col items-center justify-center min-h-[5rem] text-center relative ${selectedGeneralMode === level ? 'bg-tal-purple ring-2 ring-white/50' : 'bg-black/20 hover:bg-black/40'}`}
                                        >
                                            <span className="text-2xl mb-1">{modeDetails[level]?.emoji}</span>
                                            <span className="text-xs leading-tight">{level}</span>

                                            {hasProgress && stats && (
                                                <div className="mt-1 w-full">
                                                    <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-blue-400 to-green-400 transition-all duration-300"
                                                            style={{ width: `${stats.practicedPercent}%` }}
                                                        />
                                                    </div>
                                                    <div className="text-[9px] text-slate-300 mt-0.5 flex items-center justify-center gap-1">
                                                        <span>👁️ {stats.practiced}/{stats.total}</span>
                                                        {stats.isFullyPracticed && <span>🎯</span>}
                                                        {stats.isFullyMastered && <span>🏆</span>}
                                                    </div>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div>
                            <p className="font-semibold text-white mb-2 text-sm">3. Kies de lengte:</p>
                            <div className="grid grid-cols-3 gap-2">
                                {SESSION_LENGTH_OPTIONS.map(session => (
                                    <button
                                        key={session.name}
                                        onClick={() => setWordsPerSession(session.words)}
                                        className={`p-2 rounded-lg transition-all duration-200 font-medium flex flex-col items-center justify-center h-20 ${wordsPerSession === session.words ? 'bg-tal-purple ring-2 ring-white/50' : 'bg-black/20 hover:bg-black/40'}`}
                                    >
                                        <span className="text-xl mb-0.5">{session.emoji}</span>
                                        <span className="text-xs font-semibold">{session.name}</span>
                                        <span className="text-[10px] text-slate-300">{session.words}w.</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                {practiceMode === 'subjectSpecific' && (
                    <div className="animate-fade-in space-y-4">
                        {!showUploadScreen ? (
                            <>
                                <div>
                                    <p className="font-semibold text-white mb-2 text-sm">2. Kies je focus of finaliteit:</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {finaliteiten.map(f => (
                                            <button key={f.id} onClick={() => setSelectedFinaliteit(f.id)} className={`px-3 py-2 rounded-lg font-semibold text-sm transition-colors ${selectedFinaliteit === f.id ? 'bg-tal-purple ring-2 ring-white/50' : 'bg-black/20 hover:bg-black/40'}`}>{f.name} ({f.id})</button>
                                        ))}
                                    </div>
                                </div>

                                {selectedFinaliteit && (
                                    <div className="animate-fade-in">
                                        <p className="font-semibold text-white mb-2 text-sm">
                                            3. Kies je {selectedFinaliteit === 'OKAN' ? 'fase' : 'jaargang'}:
                                        </p>
                                        <div className="grid grid-cols-4 gap-2">
                                            {jaargangenPerFinaliteit[selectedFinaliteit].map(j => (
                                                <button
                                                    key={j}
                                                    onClick={() => setSelectedJaargang(j)}
                                                    className={`px-2 py-1.5 rounded-lg font-semibold text-sm transition-colors ${selectedJaargang === j ? 'bg-tal-purple ring-2 ring-white/50' : 'bg-black/20 hover:bg-black/40'}`}
                                                >{j}</button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {selectedFinaliteit && selectedFinaliteit !== 'OKAN' && selectedJaargang && (
                                    <div className="animate-fade-in">
                                        <p className="font-semibold text-white mb-2 text-sm">4. Kies je vaktype:</p>
                                        {selectedJaargang === '7e' ? (
                                            <div className="grid grid-cols-2 gap-3">
                                                {(['7HO', '7KB'] as const).map(type => (
                                                    <button
                                                        key={type}
                                                        onClick={() => setSelectedVakType(type)}
                                                        className={`p-4 rounded-xl text-center transition-all duration-200 flex flex-col items-center justify-center gap-2 ${
                                                            selectedVakType === type
                                                                ? 'bg-tal-purple ring-2 ring-white shadow-lg'
                                                                : 'bg-tal-purple/30 hover:bg-tal-purple/50 border border-tal-purple/30'
                                                        }`}
                                                    >
                                                        <span className="text-3xl">{type === '7HO' ? '🎓' : '🔧'}</span>
                                                        <span className="font-bold text-white">{type}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    onClick={() => setSelectedVakType('basisvorming')}
                                                    className={`p-4 rounded-xl text-center transition-all duration-200 flex flex-col items-center justify-center gap-2 ${
                                                        selectedVakType === 'basisvorming'
                                                            ? 'bg-blue-600 ring-2 ring-white shadow-lg'
                                                            : 'bg-blue-500/30 hover:bg-blue-500/50 border border-blue-400/30'
                                                    }`}
                                                >
                                                    <span className="text-3xl">📚</span>
                                                    <span className="font-bold text-white">Basisvorming</span>
                                                    <span className="text-xs text-blue-200">Algemene vakken</span>
                                                </button>
                                                <button
                                                    onClick={() => setSelectedVakType('specifiek')}
                                                    className={`p-4 rounded-xl text-center transition-all duration-200 flex flex-col items-center justify-center gap-2 ${
                                                        selectedVakType === 'specifiek'
                                                            ? 'bg-tal-purple ring-2 ring-white shadow-lg'
                                                            : 'bg-tal-purple/30 hover:bg-tal-purple/50 border border-tal-purple/30'
                                                    }`}
                                                >
                                                    <span className="text-3xl">🎯</span>
                                                    <span className="font-bold text-white">Specifiek gedeelte</span>
                                                    <span className="text-xs text-purple-200">Richtingsvakken</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Stap 5: vak/richting kiezen — alleen als er voor deze combo bekende vakken zijn
                                    in schoolStructure.ts. Anders skippen we direct naar het upload-screen. */}
                                {selectedVakType && availableCourses.length > 0 && (
                                    <div className="animate-fade-in">
                                        <p className="font-semibold text-white mb-2 text-sm">5. Kies je vak of richting:</p>
                                        <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
                                            {availableCourses.map(course => (
                                                <button
                                                    key={course.id}
                                                    onClick={() => setSelectedCourse(course)}
                                                    className={`px-3 py-2 rounded-lg text-left transition-all duration-200 text-sm ${
                                                        selectedCourse?.id === course.id
                                                            ? 'bg-tal-purple ring-2 ring-white/50 text-white'
                                                            : 'bg-black/20 hover:bg-black/40 text-slate-100'
                                                    }`}
                                                >
                                                    <span className="font-medium">{course.name}</span>
                                                    {course.url && <span className="text-[10px] text-tal-gold ml-2">📁 link</span>}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            uploadContext && (
                                <div className="animate-fade-in">
                                    <div className="flex justify-between items-center mb-3">
                                        <p className="font-semibold text-white text-sm">📂 Voeg je woordenlijst toe:</p>
                                        <button
                                            onClick={() => {
                                                if (selectedFinaliteit === 'OKAN') {
                                                    setSelectedJaargang(null);
                                                } else if (selectedCourse) {
                                                    setSelectedCourse(null);
                                                } else {
                                                    setSelectedVakType(null);
                                                }
                                            }}
                                            className="text-xs text-slate-300 hover:text-white underline"
                                        >← Terug</button>
                                    </div>

                                    <div className="bg-tal-teal-dark/40 p-4 rounded-xl border border-white/20 mb-4 text-sm text-slate-200">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="font-bold text-white text-base">{uploadContext.name}</span>
                                            <span className="text-xs bg-tal-purple px-2 py-0.5 rounded text-white">{selectedFinaliteit}</span>
                                        </div>

                                        {uploadContext.url ? (
                                            <ol className="list-none space-y-3">
                                                <li className="flex items-center gap-3">
                                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-tal-gold text-tal-teal-dark font-bold flex items-center justify-center text-xs">1</span>
                                                    <a
                                                        href={uploadContext.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex-grow text-center bg-white text-tal-teal font-bold px-4 py-2 rounded-lg hover:bg-tal-gold hover:text-tal-teal-dark transition-colors flex items-center justify-center gap-2 shadow-sm"
                                                    >
                                                        <span role="img" aria-label="Map">📁</span> Ga naar woordenlijsten
                                                    </a>
                                                </li>
                                                <li className="flex items-start gap-3">
                                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 text-white font-bold flex items-center justify-center text-xs mt-0.5">2</span>
                                                    <span>Kies de juiste woordenlijst voor je vak, download het bestand en <strong>upload</strong> het hieronder, of <strong>kopieer en plak</strong> de tekst.</span>
                                                </li>
                                            </ol>
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 text-amber-300 text-xs font-medium">
                                                    <span>⏳</span>
                                                    <span>De OneDrive-link voor deze categorie wordt binnenkort toegevoegd.</span>
                                                </div>
                                                <p className="text-slate-300">Upload voorlopig zelf je cursusmateriaal of plak de tekst hieronder.</p>
                                            </div>
                                        )}
                                    </div>

                                    <CustomWordExtractor
                                        onWordsSelected={handleStartCustom}
                                        aiModel={aiModel}
                                        studentName={studentName}
                                        defaultContext={uploadContext.name}
                                        hideContextInput={true}
                                        lookupProgress={(listId) => currentUserData?.wordListProgress?.[listId]}
                                        availableVakken={availableVakken}
                                        getIncorrectWordsForFile={(fname) =>
                                            getIncorrectWordsForList(currentUserData?.sessionHistory, fname)
                                        }
                                    />
                                </div>
                            )
                        )}
                    </div>
                )}
                {practiceMode === 'custom' && (
                    <div className="animate-fade-in">
                        <p className="font-semibold text-white mb-2">2. Voeg je eigen materiaal toe:</p>
                        <CustomWordExtractor
                            onWordsSelected={handleStartCustom}
                            aiModel={aiModel}
                            studentName={studentName}
                            lookupProgress={(listId) => currentUserData?.wordListProgress?.[listId]}
                            availableVakken={availableVakken}
                            getIncorrectWordsForFile={(fname) =>
                                getIncorrectWordsForList(currentUserData?.sessionHistory, fname)
                            }
                        />
                    </div>
                )}
                {practiceMode === 'myLists' && (
                    <div className="animate-fade-in space-y-3">
                        <div className="flex items-center justify-between mb-1">
                            <p className="font-semibold text-white">📚 Hervat een eerder opgeladen lijst</p>
                            <span className="text-xs text-slate-300">{myListsEntries.length} {myListsEntries.length === 1 ? 'lijst' : 'lijsten'}</span>
                        </div>
                        <p className="text-xs text-slate-300 mb-3 leading-snug">
                            Klik op een lijst om door te gaan waar je gebleven was — geen nieuwe upload nodig.
                        </p>
                        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                            {myListsEntries.map(([listId, progress]) => {
                                const total = progress.allWords.length;
                                const practiced = progress.practicedWords.length;
                                const percent = total > 0 ? Math.round((practiced / total) * 100) : 0;
                                const isFullyPracticed = practiced >= total;
                                const sessionsForList = (currentUserData?.sessionHistory ?? []).filter(
                                    s => (s.settings.customFileName || s.settings.context) === listId
                                );
                                const latestSession = sessionsForList.sort((a, b) => b.date.localeCompare(a.date))[0];
                                const displayName = latestSession?.settings.customFileName || listId;
                                const lastDate = progress.lastPracticed
                                    ? new Date(progress.lastPracticed).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })
                                    : null;
                                return (
                                    <button
                                        key={listId}
                                        onClick={() => handleResumeList(listId)}
                                        disabled={!studentName.trim()}
                                        className="w-full text-left bg-black/25 hover:bg-black/40 disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 hover:border-white/30 p-3 rounded-lg transition-all"
                                    >
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <span className="text-sm font-semibold text-white truncate" title={displayName}>
                                                {isFullyPracticed && '🎯 '}
                                                {displayName}
                                            </span>
                                            <span className="text-xs text-slate-300 shrink-0 font-mono">
                                                {practiced}/{total}
                                            </span>
                                        </div>
                                        <div className="h-2 bg-black/30 rounded-full overflow-hidden mb-2">
                                            <div
                                                className="h-full transition-all duration-500"
                                                style={{
                                                    width: `${percent}%`,
                                                    background: isFullyPracticed
                                                        ? 'linear-gradient(90deg, #a855f7 0%, #ec4899 100%)'
                                                        : 'linear-gradient(90deg, #34d399 0%, #10b981 100%)',
                                                }}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-slate-300">
                                            <span>
                                                {isFullyPracticed
                                                    ? '✨ Volledig doorlopen — consolidatie'
                                                    : `▶ ${percent}% klaar · ${total - practiced} nieuw te gaan`
                                                }
                                            </span>
                                            {lastDate && <span className="text-slate-400">{lastDate}</span>}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            <div className="pt-2 space-y-2">
                <label
                    className="w-full px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-between cursor-pointer bg-white/5 hover:bg-white/10 transition-colors"
                    title="Genereert de stem voor elk woord vooraf, zodat de quiz vlotter klinkt. Duurt iets langer bij het laden van de oefening."
                >
                    <span className="flex items-center gap-2">
                        <span>🗣️</span>
                        <span>AI-uitspraak vooraf laden</span>
                        <span
                            aria-label="Meer info"
                            title="Genereert de stem voor elk woord vooraf, zodat de quiz vlotter klinkt. Duurt iets langer bij het laden van de oefening."
                            className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/15 text-[10px] text-slate-200 font-bold cursor-help"
                        >
                            ⓘ
                        </span>
                    </span>
                    <input type="checkbox" checked={enableTTS} onChange={() => setEnableTTS(!enableTTS)} className="sr-only peer" />
                    <span className="w-9 h-5 rounded-full bg-white/20 peer-checked:bg-tal-purple relative transition-colors duration-200 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:rounded-full after:bg-white after:shadow after:transition-transform after:duration-200 peer-checked:after:translate-x-4" />
                </label>
                {enableTTS && (
                    <p className="text-xs text-amber-300 px-2">De AI-stem wordt voor elk woord op voorhand gegenereerd. Dit duurt iets langer bij het laden, maar klinkt nadien direct.</p>
                )}

                {practiceMode === 'general' && (
                    <button
                        onClick={handleStartGeneral}
                        disabled={isStartDisabled}
                        className="w-full px-6 py-3 bg-tal-purple text-white font-bold text-base rounded-xl shadow-lg hover:bg-tal-purple-dark transform active:scale-[0.98] transition-all duration-300 focus:outline-none focus:ring-4 ring-tal-purple/50 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <span role="img" aria-label="Raket" className="text-xl">🚀</span> Start Oefening
                    </button>
                )}
                {isStoryModeUnlocked && (
                    <button
                        onClick={() => onStartStoryChallenge(studentName, aiModel)}
                        disabled={!studentName.trim()}
                        className="w-full px-6 py-2 bg-tal-gold text-tal-teal-dark font-bold text-sm rounded-xl shadow-lg hover:opacity-90 transform active:scale-[0.98] transition-all duration-300 focus:outline-none focus:ring-4 ring-tal-gold/50 disabled:bg-slate-400 disabled:text-slate-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <span role="img" aria-label="Ster">⭐</span>
                        Start Verhaaluitdaging
                    </button>
                )}
                {/* Subtiele tekst-link naar persoonlijk dashboard — niet meer dominant naast Start Oefening. */}
                <button
                    onClick={onShowDashboard}
                    className="block mx-auto mt-2 text-xs text-white/70 hover:text-white underline underline-offset-2 transition"
                >
                    📊 Mijn voortgang bekijken →
                </button>
            </div>
        </div>
    );
};

export default PracticeSetup;
