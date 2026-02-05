
import React, { useState, useMemo, useEffect } from 'react';
import { WordLevel, PracticeSettings, AllUsersData, Finaliteit, Jaargang, SubjectSpecificCourse, Avatar } from '../types';
import { WORD_LISTS, LEVEL_DIFFICULTY_MAP, STORY_MODE_UNLOCK_THRESHOLD, SUBJECT_SPECIFIC_COURSES, SESSION_LENGTH_OPTIONS, AF_VAKKEN_STRUCTUUR, AFRichting, AFVak } from '../constants';
import CustomWordExtractor from './CustomWordExtractor';
import { CheckIcon } from './icons/CheckIcon';

interface WelcomeProps {
    onStartPractice: (userName: string, words: string[], settings: PracticeSettings) => void;
    onShowDashboard: () => void;
    allUsersData: AllUsersData;
    onStartStoryChallenge: (userName: string, aiModel: PracticeSettings['aiModel']) => void;
    onUpdateAvatar: (userName: string, avatarId: string) => void;
}

const AVATARS: Avatar[] = [
    { id: 'default', emoji: '👤', name: 'Starter', cost: 0 },
    { id: 'nerd', emoji: '🤓', name: 'Boekenwurm', cost: 100 },
    { id: 'rocket', emoji: '🚀', name: 'Raket', cost: 300 },
    { id: 'brain', emoji: '🧠', name: 'Breinbaas', cost: 500 },
    { id: 'wizard', emoji: '🧙', name: 'Taaltovenaar', cost: 1000 },
    { id: 'detective', emoji: '🕵️', name: 'Woordspeurder', cost: 1500 },
    { id: 'star', emoji: '⭐', name: 'Superster', cost: 2000 },
    { id: 'lion', emoji: '🦁', name: 'Taalleeuw', cost: 3000 },
];

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

// Lijst met algemene vakken die aan de vakspecifieke lijst worden toegevoegd
const EXTRA_GENERAL_SUBJECTS: SubjectSpecificCourse[] = [
    { id: 'GEN-NED', name: 'Nederlands' },
    { id: 'GEN-ENG', name: 'Engels' },
    { id: 'GEN-WIS', name: 'Wiskunde' },
    { id: 'GEN-AARD', name: 'Aardrijkskunde' },
    { id: 'GEN-GES', name: 'Geschiedenis' },
    { id: 'GEN-NAT', name: 'Natuurwetenschappen' },
    { id: 'GEN-ECO', name: 'Economie' },
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

// Using SESSION_LENGTH_OPTIONS from constants (20-30-40)

const Welcome: React.FC<WelcomeProps> = ({ onStartPractice, onShowDashboard, allUsersData, onStartStoryChallenge, onUpdateAvatar }) => {
    const [studentName, setStudentName] = useState('');
    const [nativeLanguage, setNativeLanguage] = useState('');
    const [practiceMode, setPracticeMode] = useState<'general' | 'subjectSpecific' | 'custom'>('general');
    const [aiModel, setAiModel] = useState<PracticeSettings['aiModel']>('fast');
    const [wordsPerSession, setWordsPerSession] = useState(20);
    const [showAvatarSelector, setShowAvatarSelector] = useState(false);

    // State for 'general' mode
    const [selectedGeneralMode, setSelectedGeneralMode] = useState<WordLevel>(WordLevel.Woordenschat2DF);

    // State for 'subjectSpecific' mode
    const [selectedFinaliteit, setSelectedFinaliteit] = useState<Finaliteit | null>(null);
    const [selectedJaargang, setSelectedJaargang] = useState<Jaargang | null>(null);
    const [selectedVakType, setSelectedVakType] = useState<'basisvorming' | 'specifiek' | null>(null);
    const [selectedAFRichting, setSelectedAFRichting] = useState<AFRichting | null>(null); // For AF specifiek gedeelte
    const [selectedRichting, setSelectedRichting] = useState<SubjectSpecificCourse | null>(null);

    // Reset lower-level selections when a higher-level one changes to prevent invalid states
    useEffect(() => {
        setSelectedJaargang(null);
        setSelectedVakType(null);
        setSelectedAFRichting(null);
        setSelectedRichting(null);
    }, [selectedFinaliteit]);

    useEffect(() => {
        setSelectedVakType(null);
        setSelectedAFRichting(null);
        setSelectedRichting(null);
    }, [selectedJaargang]);

    useEffect(() => {
        setSelectedAFRichting(null);
        setSelectedRichting(null);
    }, [selectedVakType]);

    useEffect(() => {
        if (practiceMode !== 'subjectSpecific') {
            setSelectedFinaliteit(null);
            setSelectedJaargang(null);
            setSelectedVakType(null);
            setSelectedAFRichting(null);
            setSelectedRichting(null);
        }
    }, [practiceMode]);

    const currentUserData = useMemo(() => {
        const trimmedName = studentName.toLowerCase().trim();
        return allUsersData[trimmedName];
    }, [studentName, allUsersData]);

    const learnedWordsCount = currentUserData?.learnedWords ? Object.keys(currentUserData.learnedWords).length : 0;
    const progressPercentage = Math.min((learnedWordsCount / STORY_MODE_UNLOCK_THRESHOLD) * 100, 100);
    const isStoryModeUnlocked = progressPercentage >= 100;
    const streak = currentUserData?.streak || 0;
    const points = currentUserData?.points || 0;
    const currentAvatarId = currentUserData?.avatarId || 'default';
    const currentAvatar = AVATARS.find(a => a.id === currentAvatarId) || AVATARS[0];

    // Get existing progress for a specific word list context
    const getExistingProgress = (contextId: string) => {
        return currentUserData?.wordListProgress?.[contextId];
    };

    // Calculate word list statistics for progress display
    const getWordListStats = (listId: string) => {
        const allWords = WORD_LISTS[listId] || [];
        const totalWords = allWords.length;
        if (totalWords === 0) return null;

        const existingProgress = getExistingProgress(listId);
        const practicedWords = new Set(existingProgress?.practicedWords?.map(w => w.toLowerCase()) || []);
        const practicedCount = practicedWords.size;

        // Count mastered words (correct > 0, incorrect === 0)
        const learnedWords = currentUserData?.learnedWords || {};
        let masteredCount = 0;
        allWords.forEach(word => {
            const wordKey = word.toLowerCase();
            const wordInfo = learnedWords[wordKey];
            if (wordInfo && wordInfo.correct > 0 && wordInfo.incorrect === 0) {
                masteredCount++;
            }
        });

        return {
            total: totalWords,
            practiced: practicedCount,
            mastered: masteredCount,
            practicedPercent: Math.round((practicedCount / totalWords) * 100),
            masteredPercent: Math.round((masteredCount / totalWords) * 100),
            isFullyPracticed: practicedCount >= totalWords,
            isFullyMastered: masteredCount >= totalWords,
        };
    };

    const handleStartGeneral = () => {
        if (!studentName.trim()) {
            alert("Vul alsjeblieft een naam in.");
            return;
        }

        const allWords = WORD_LISTS[selectedGeneralMode];

        // Smart word rotation: prioritize unpracticed words
        const existingProgress = getExistingProgress(selectedGeneralMode);
        const practicedWords = new Set(existingProgress?.practicedWords?.map(w => w.toLowerCase()) || []);

        // Separate into practiced and unpracticed
        const unpracticedWords = allWords.filter(w => !practicedWords.has(w.toLowerCase()));
        const previouslyPracticedWords = allWords.filter(w => practicedWords.has(w.toLowerCase()));

        let selectedWords: string[] = [];

        // First fill with unpracticed words (shuffled)
        const shuffledUnpracticed = [...unpracticedWords].sort(() => 0.5 - Math.random());
        selectedWords = shuffledUnpracticed.slice(0, wordsPerSession);

        // If we need more, add from previously practiced (shuffled)
        if (selectedWords.length < wordsPerSession) {
            const shuffledPracticed = [...previouslyPracticedWords].sort(() => 0.5 - Math.random());
            const needed = wordsPerSession - selectedWords.length;
            selectedWords = [...selectedWords, ...shuffledPracticed.slice(0, needed)];
        }

        // Final shuffle to mix them up
        selectedWords = selectedWords.sort(() => 0.5 - Math.random());

        let settings: PracticeSettings = {
            showSynonymsAntonyms: true,
            wordsPerSession: wordsPerSession,
            aiModel,
            nativeLanguage: nativeLanguage.trim(),
            context: selectedGeneralMode,
            difficulty: LEVEL_DIFFICULTY_MAP[selectedGeneralMode],
        };

        onStartPractice(studentName, selectedWords, settings);
    };

    const handleStartCustom = (words: string[], context: string, fileName?: string) => {
        if (!studentName.trim()) {
            alert("Vul alsjeblieft een naam in.");
            return;
        }
        if (words.length === 0) {
            alert("Selecteer alsjeblieft woorden om te oefenen.");
            return;
        }

        // Determine the context. In subjectSpecific mode, the selected "richting" name IS the context.
        // This works for both vocational courses (e.g., "Onthaal") and general subjects (e.g., "Aardrijkskunde")
        let activeContext = context;
        if (practiceMode === 'subjectSpecific' && selectedRichting) {
            activeContext = selectedRichting.name;
        }

        const settings: PracticeSettings = {
            showSynonymsAntonyms: true,
            wordsPerSession: words.length,
            aiModel,
            nativeLanguage: nativeLanguage.trim(),
            context: activeContext,
            difficulty: WordLevel.Intermediate,
            customFileName: fileName,
        };

        if (practiceMode === 'subjectSpecific' && selectedFinaliteit && selectedJaargang && selectedRichting) {
            settings.finaliteit = selectedFinaliteit;
            settings.jaargang = selectedJaargang;
            settings.richting = selectedRichting.name;
            settings.courseId = selectedRichting.id;
        }

        onStartPractice(studentName, words, settings);
    };

    const isStartDisabled = !studentName.trim() ||
        (practiceMode === 'general' && !selectedGeneralMode);

    const availableCoursesData = useMemo(() => {
        if (selectedFinaliteit && selectedJaargang) {
            const specific = SUBJECT_SPECIFIC_COURSES[selectedFinaliteit]?.[selectedJaargang] || [];

            // Algemene vakken voorbereiden
            let general = [...EXTRA_GENERAL_SUBJECTS];

            // SPECIFIEKE LOGICA VOOR DF 6e JAAR
            if (selectedFinaliteit === 'DF' && selectedJaargang === '6e') {
                const df6GeneralUrl = "https://sgr18-my.sharepoint.com/:f:/g/personal/info_gotalok_be/IgDppRs0T7f1QJdrWP7UAujBAc2QU2ZR8jx-akasRfeKb_o?e=Y9mj7q";
                general = general.map(subj => ({
                    ...subj,
                    url: df6GeneralUrl
                }));
            }

            // SPECIFIEKE LOGICA VOOR DF 5e JAAR
            if (selectedFinaliteit === 'DF' && selectedJaargang === '5e') {
                const df5GeneralUrl = "https://sgr18-my.sharepoint.com/:f:/g/personal/info_gotalok_be/IgDPnWCXj9tRT5rwVX59bTEEAZjGU_1-3xbt92SI6X2lnBk?e=s7e2RX";
                general = general.map(subj => ({
                    ...subj,
                    url: df5GeneralUrl
                }));
            }

            return {
                specific,
                general
            };
        }
        return { specific: [], general: [] };
    }, [selectedFinaliteit, selectedJaargang]);

    return (
        <>


            <div className="grid lg:grid-cols-2 gap-6 items-start bg-tal-teal text-white p-4 sm:p-6 rounded-2xl shadow-xl">
                {/* Left Column - Profile & Instructions */}
                <div className="space-y-4">
                    <h2 className="text-2xl font-bold">
                        Welkom bij de TALtrekkers webapplicatie 🪄
                    </h2>
                    <p className="text-slate-200 text-sm">
                        Een AI-gestuurde tool om je te helpen met de belangrijkste schooltaalwoorden. Kies een vak, stel je oefening samen en word een TALent in taal!
                    </p>
                    <div className="space-y-3 pt-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="student-name" className="text-sm font-semibold">Wie gaat er oefenen?</label>
                                <input
                                    id="student-name"
                                    type="text"
                                    value={studentName}
                                    onChange={(e) => setStudentName(e.target.value)}
                                    placeholder="Vul hier je naam in"
                                    className="w-full p-3 mt-1 border-2 border-white/20 bg-white/10 rounded-lg focus:ring-2 focus:ring-tal-purple transition placeholder:text-slate-300 text-white text-sm"
                                    aria-label="Naam van de leerling"
                                />
                                {/* Subtiele XP en streak indicator wanneer gebruiker bekend is */}
                                {studentName && currentUserData && (points > 0 || streak > 0) && (
                                    <div className="flex items-center gap-3 mt-2 text-xs text-amber-300">
                                        {points > 0 && (
                                            <span title="Jouw totale XP" className="flex items-center gap-1">
                                                ⭐ {points.toLocaleString()} XP
                                            </span>
                                        )}
                                        {streak > 0 && (
                                            <span title="Dagen op rij geoefend" className="flex items-center gap-1">
                                                🔥 {streak} dag{streak > 1 ? 'en' : ''} streak
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label htmlFor="native-language" className="text-sm font-semibold">Moedertaal (optioneel)</label>
                                <input
                                    id="native-language"
                                    type="text"
                                    value={nativeLanguage}
                                    onChange={(e) => setNativeLanguage(e.target.value)}
                                    placeholder="bv. Frans, Arabisch..."
                                    className="w-full p-3 mt-1 border-2 border-white/20 bg-white/10 rounded-lg focus:ring-2 focus:ring-tal-purple transition placeholder:text-slate-300 text-white text-sm"
                                    aria-label="Moedertaal van de leerling"
                                />
                            </div>
                        </div>

                        {/* RESTORED TUTORIAL SECTION */}
                        <div className="bg-white/10 p-6 rounded-xl border border-white/10 mt-6">
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                <span className="text-2xl">🎓</span> Hoe werkt het?
                            </h3>
                            <ul className="space-y-4">
                                <li className="flex items-start gap-4">
                                    <div className="bg-amber-500 rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0 shadow-sm text-white">!</div>
                                    <div>
                                        <h4 className="font-bold text-amber-300">Eerst: vul je naam in</h4>
                                        <p className="text-sm text-slate-200">Vul hierboven je naam en eventueel moedertaal in, daarna kan je op "Start Oefening" klikken.</p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-4">
                                    <div className="bg-tal-purple rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0 shadow-sm">1</div>
                                    <div>
                                        <h4 className="font-bold">Kies je woorden</h4>
                                        <p className="text-sm text-slate-200">Kies 'Algemeen' voor schoolvakken, 'Vakspecifiek' voor je richting, of upload je eigen tekst.</p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-4">
                                    <div className="bg-tal-gold text-tal-teal-dark rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0 shadow-sm">2</div>
                                    <div>
                                        <h4 className="font-bold">Oefen & Studeer</h4>
                                        <p className="text-sm text-slate-200">Gebruik Frayer-modellen (diepgaand) of steekkaarten (snel) om de betekenis te leren.</p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-4">
                                    <div className="bg-green-500 rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0 shadow-sm">3</div>
                                    <div>
                                        <h4 className="font-bold">Groei naar meesterschap</h4>
                                        <p className="text-sm text-slate-200">Doe de quiz, verdien XP en speel de unieke Verhaaluitdaging vrij!</p>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Right Column - Selection */}
                <div className="bg-white/10 p-4 rounded-2xl border border-white/20 space-y-4">
                    <div>
                        <p className="text-sm font-semibold text-white mb-2">1. Kies je woordenlijst:</p>
                        <div className="bg-black/20 p-1 rounded-xl grid grid-cols-3 gap-1">
                            <button onClick={() => setPracticeMode('general')} className={`px-2 py-1.5 rounded-lg font-semibold text-sm transition-colors ${practiceMode === 'general' ? 'bg-white text-tal-teal shadow-md' : 'text-slate-200 hover:bg-white/10'}`}>Algemeen</button>
                            <button onClick={() => setPracticeMode('subjectSpecific')} className={`px-2 py-1.5 rounded-lg font-semibold text-sm transition-colors ${practiceMode === 'subjectSpecific' ? 'bg-white text-tal-teal shadow-md' : 'text-slate-200 hover:bg-white/10'}`}>Vakspecifiek</button>
                            <button onClick={() => setPracticeMode('custom')} className={`px-2 py-1.5 rounded-lg font-semibold text-sm transition-colors ${practiceMode === 'custom' ? 'bg-white text-tal-teal shadow-md' : 'text-slate-200 hover:bg-white/10'}`}>Eigen woorden</button>
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

                                                    {/* Progress indicator - only show if user has some progress */}
                                                    {hasProgress && stats && (
                                                        <div className="mt-1 w-full">
                                                            {/* Progress bar */}
                                                            <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-gradient-to-r from-blue-400 to-green-400 transition-all duration-300"
                                                                    style={{ width: `${stats.practicedPercent}%` }}
                                                                />
                                                            </div>
                                                            {/* Stats tooltip trigger */}
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
                                {!selectedRichting ? (
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
                                                        <button key={j} onClick={() => setSelectedJaargang(j)} className={`px-2 py-1.5 rounded-lg font-semibold text-sm transition-colors ${selectedJaargang === j ? 'bg-tal-purple ring-2 ring-white/50' : 'bg-black/20 hover:bg-black/40'}`}>{j}</button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {selectedFinaliteit && selectedJaargang && (
                                            <div className="animate-fade-in">
                                                <p className="font-semibold text-white mb-2 text-sm">4. Kies je vaktype:</p>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button
                                                        onClick={() => setSelectedVakType('basisvorming')}
                                                        className={`p-4 rounded-xl text-center transition-all duration-200 flex flex-col items-center justify-center gap-2 ${selectedVakType === 'basisvorming'
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
                                                        className={`p-4 rounded-xl text-center transition-all duration-200 flex flex-col items-center justify-center gap-2 ${selectedVakType === 'specifiek'
                                                            ? 'bg-tal-purple ring-2 ring-white shadow-lg'
                                                            : 'bg-tal-purple/30 hover:bg-tal-purple/50 border border-tal-purple/30'
                                                            }`}
                                                    >
                                                        <span className="text-3xl">🎯</span>
                                                        <span className="font-bold text-white">Specifiek gedeelte</span>
                                                        <span className="text-xs text-purple-200">Richtingsvakken</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* AF Basisvorming: Toon vakkenlijst */}
                                        {selectedFinaliteit === 'AF' && selectedJaargang && selectedVakType === 'basisvorming' && AF_VAKKEN_STRUCTUUR[selectedJaargang]?.basisvorming && (
                                            <div className="animate-fade-in mt-4">
                                                <div className="flex justify-between items-center mb-2">
                                                    <p className="font-semibold text-white text-sm">5. Kies je vak:</p>
                                                    <button onClick={() => setSelectedVakType(null)} className="text-xs text-slate-300 hover:text-white underline">← Terug</button>
                                                </div>
                                                <div className="max-h-48 overflow-y-auto bg-black/20 p-2 rounded-lg space-y-1">
                                                    {AF_VAKKEN_STRUCTUUR[selectedJaargang]!.basisvorming.map(vak => (
                                                        <button
                                                            key={vak.id}
                                                            onClick={() => setSelectedRichting({ id: vak.id, name: vak.name, url: vak.url })}
                                                            className="w-full text-left px-3 py-3 rounded-md text-sm transition-colors bg-blue-500/20 hover:bg-blue-500/40 flex justify-between items-center"
                                                        >
                                                            <span>{vak.name}</span>
                                                            {vak.url && <span className="text-xs text-green-300">🔗</span>}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* AF Specifiek: Toon richtingenlijst */}
                                        {selectedFinaliteit === 'AF' && selectedJaargang && selectedVakType === 'specifiek' && !selectedAFRichting && AF_VAKKEN_STRUCTUUR[selectedJaargang]?.specifiek && (
                                            <div className="animate-fade-in mt-4">
                                                <div className="flex justify-between items-center mb-2">
                                                    <p className="font-semibold text-white text-sm">5. Kies je richting:</p>
                                                    <button onClick={() => setSelectedVakType(null)} className="text-xs text-slate-300 hover:text-white underline">← Terug</button>
                                                </div>
                                                <div className="max-h-48 overflow-y-auto bg-black/20 p-2 rounded-lg space-y-1">
                                                    {AF_VAKKEN_STRUCTUUR[selectedJaargang]!.specifiek.map(richting => (
                                                        <button
                                                            key={richting.id}
                                                            onClick={() => setSelectedAFRichting(richting)}
                                                            className="w-full text-left px-3 py-3 rounded-md text-sm transition-colors bg-tal-purple/20 hover:bg-tal-purple/40 flex justify-between items-center"
                                                        >
                                                            <span>{richting.name}</span>
                                                            <span className="text-xs bg-tal-purple/30 px-2 py-0.5 rounded">{richting.vakken.length} vakken</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* AF Specifiek: Toon vakkenlijst na richting selectie */}
                                        {selectedFinaliteit === 'AF' && selectedJaargang && selectedVakType === 'specifiek' && selectedAFRichting && (
                                            <div className="animate-fade-in mt-4">
                                                <div className="flex justify-between items-center mb-2">
                                                    <p className="font-semibold text-white text-sm">6. Kies je vak ({selectedAFRichting.name}):</p>
                                                    <button onClick={() => setSelectedAFRichting(null)} className="text-xs text-slate-300 hover:text-white underline">← Terug</button>
                                                </div>
                                                <div className="max-h-48 overflow-y-auto bg-black/20 p-2 rounded-lg space-y-1">
                                                    {selectedAFRichting.vakken.map(vak => (
                                                        <button
                                                            key={vak.id}
                                                            onClick={() => setSelectedRichting({ id: vak.id, name: vak.name, url: vak.url })}
                                                            className="w-full text-left px-3 py-3 rounded-md text-sm transition-colors bg-tal-purple/20 hover:bg-tal-purple/40 flex justify-between items-center"
                                                        >
                                                            <span>{vak.name}</span>
                                                            {vak.url && <span className="text-xs text-green-300">🔗</span>}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="animate-fade-in">
                                        <div className="flex justify-between items-center mb-4">
                                            <p className="font-semibold text-white">5. Voeg je woordenlijst toe:</p>
                                            <button onClick={() => setSelectedRichting(null)} className="text-xs text-slate-300 hover:text-white underline">Terug naar vakselectie</button>
                                        </div>

                                        <div className="bg-tal-teal-dark/40 p-4 rounded-xl border border-white/20 mb-4 text-sm text-slate-200">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="font-bold text-white text-lg">{selectedRichting.name}</span>
                                                {selectedRichting.id.startsWith('GEN-') ? (
                                                    <span className="text-xs bg-slate-600 px-2 py-0.5 rounded text-white">Algemeen</span>
                                                ) : (
                                                    <span className="text-xs bg-tal-purple px-2 py-0.5 rounded text-white">{selectedFinaliteit}</span>
                                                )}
                                            </div>

                                            {selectedRichting.url ? (
                                                <>
                                                    <p className="mb-3">Volg deze stappen:</p>
                                                    <ol className="list-none space-y-3">
                                                        <li className="flex items-center gap-3">
                                                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-tal-gold text-tal-teal-dark font-bold flex items-center justify-center text-xs">1</span>
                                                            <a
                                                                href={selectedRichting.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex-grow text-center bg-white text-tal-teal font-bold px-4 py-2 rounded-lg hover:bg-tal-gold hover:text-tal-teal-dark transition-colors flex items-center justify-center gap-2 shadow-sm"
                                                            >
                                                                <span role="img" aria-label="Download">📥</span> Download woordenlijst
                                                            </a>
                                                        </li>
                                                        <li className="flex items-start gap-3">
                                                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 text-white font-bold flex items-center justify-center text-xs mt-0.5">2</span>
                                                            <span>Open het gedownloade bestand en <strong>upload</strong> het hieronder, of <strong>kopieer en plak</strong> de tekst.</span>
                                                        </li>
                                                    </ol>
                                                </>
                                            ) : (
                                                <div className="flex items-start gap-3">
                                                    <span className="text-xl">ℹ️</span>
                                                    <p>
                                                        {selectedRichting.id.startsWith('GEN-')
                                                            ? "Voor algemene vakken upload je best je eigen cursusmateriaal of woordenlijst."
                                                            : "Voor deze richting is nog geen specifieke woordenlijst beschikbaar. Je kunt zelf je cursusmateriaal uploaden of tekst plakken."}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <CustomWordExtractor
                                            onWordsSelected={handleStartCustom}
                                            aiModel={aiModel}
                                            studentName={studentName}
                                            defaultContext={selectedRichting.name}
                                            hideContextInput={true}
                                            existingProgress={getExistingProgress(selectedRichting.name)}
                                        />
                                    </div>
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
                                    existingProgress={getExistingProgress('custom')}
                                />
                            </div>
                        )}
                    </div>

                    <div className="pt-2 space-y-2">
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
                        <button onClick={onShowDashboard} className="w-full px-6 py-2 bg-white/10 border-2 border-white/20 text-white font-bold text-sm rounded-xl shadow-lg hover:bg-white/20 transform active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2">
                            <span role="img" aria-label="Grafiek">📊</span>
                            Bekijk Dashboard
                        </button>
                    </div>
                </div>
            </div>

            {/* Avatar Selector Modal */}
            {showAvatarSelector && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full mx-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-2xl font-bold text-slate-800">Kies je Avatar</h3>
                            <button onClick={() => setShowAvatarSelector(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        <p className="text-slate-600 mb-6">Gebruik je XP om nieuwe avatars vrij te spelen!</p>
                        <div className="grid grid-cols-4 gap-4 mb-6">
                            {AVATARS.map(avatar => {
                                const isUnlocked = points >= avatar.cost;
                                const isSelected = currentAvatarId === avatar.id;
                                return (
                                    <button
                                        key={avatar.id}
                                        onClick={() => {
                                            if (isUnlocked) {
                                                onUpdateAvatar(studentName, avatar.id);
                                                setShowAvatarSelector(false);
                                            }
                                        }}
                                        className={`relative p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2
                                    ${isSelected ? 'border-tal-purple bg-tal-purple/10' : 'border-slate-200'}
                                    ${!isUnlocked ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:border-tal-purple/50 cursor-pointer'}
                                `}
                                    >
                                        <div className="text-4xl">{avatar.emoji}</div>
                                        <div className="text-xs font-bold text-slate-600 text-center">{avatar.name}</div>
                                        {!isUnlocked && (
                                            <div className="absolute top-1 right-1 text-xs bg-slate-600 text-white px-1.5 rounded-full">🔒 {avatar.cost}</div>
                                        )}
                                        {isSelected && (
                                            <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full p-0.5"><CheckIcon className="w-3 h-3" /></div>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                        <div className="text-center text-sm text-slate-500">
                            Jouw saldo: <span className="font-bold text-tal-gold">{points} XP</span>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Welcome;
