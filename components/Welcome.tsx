import React, { useState, useMemo, useEffect } from 'react';
import { PracticeSettings, AllUsersData } from '../types';
import { STORY_MODE_UNLOCK_THRESHOLD } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import PracticeSetup from './PracticeSetup';
import { getAvatarById } from './AvatarSelectorModal';

interface WelcomeProps {
    onStartPractice: (userName: string, words: string[], settings: PracticeSettings) => void;
    onShowDashboard: () => void;
    allUsersData: AllUsersData;
    onStartStoryChallenge: (userName: string, aiModel: PracticeSettings['aiModel']) => void;
    onShowAvatarSelector?: () => void;
    /** Snelkoppeling naar het Leerkracht Dashboard — alleen relevant voor leerkrachten. */
    onShowTeacherDashboard?: () => void;
}

const Welcome: React.FC<WelcomeProps> = ({ onStartPractice, onShowDashboard, allUsersData, onStartStoryChallenge, onShowAvatarSelector, onShowTeacherDashboard }) => {
    const {
        selectedStudent, clearSelectedStudent, selectStudent, user, signOut, role,
        klas, setKlas,
        nativeLanguage: profileNativeLanguage, setNativeLanguage: saveNativeLanguage,
    } = useAuth();
    // Leerkrachten/admins zien de leerling-kant ter preview — klas/moedertaal is voor hen niet relevant.
    const isTeacher = role === 'teacher' || role === 'admin';
    const [studentName, setStudentName] = useState(selectedStudent?.name ?? '');
    const [nativeLanguage, setNativeLanguage] = useState(profileNativeLanguage ?? '');
    const [nativeLangSaveState, setNativeLangSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [aiModel, setAiModel] = useState<PracticeSettings['aiModel']>('fast');
    const [klasInput, setKlasInput] = useState('');
    const [klasSaveState, setKlasSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    // Tutorial collapsed-state: standaard inklappen voor returning users (1+ sessie),
    // uitgeklapt voor first-timers zodat ze de uitleg meteen zien.
    const [showTutorial, setShowTutorial] = useState(true);

    // Sync moedertaal vanuit profile (bv. wanneer onboarding net is afgerond
    // en de async profile-fetch ná initial render binnenkomt)
    useEffect(() => {
        setNativeLanguage(profileNativeLanguage ?? '');
    }, [profileNativeLanguage]);

    const handleSaveNativeLanguage = async () => {
        const trimmed = nativeLanguage.trim();
        if (trimmed === (profileNativeLanguage ?? '')) return; // niets veranderd
        setNativeLangSaveState('saving');
        const result = await saveNativeLanguage(nativeLanguage);
        setNativeLangSaveState(result.success ? 'saved' : 'error');
        if (result.success) {
            setTimeout(() => setNativeLangSaveState('idle'), 1500);
        }
    };

    // Sync naam als leerling via selectie inlogt
    useEffect(() => {
        if (selectedStudent?.name) setStudentName(selectedStudent.name);
    }, [selectedStudent?.name]);

    // Andersom: zonder Microsoft-login (dev-bypass of vrije naam-input) syncen we
    // de ingetypte naam naar selectedStudent. Zo weet de rest van de app (Header
    // reward-badges, App.tsx) wie de actieve leerling is, ook buiten een sessie.
    useEffect(() => {
        const trimmed = studentName.trim();
        if (!user && trimmed && trimmed !== selectedStudent?.name) {
            selectStudent({ name: trimmed });
        }
    }, [studentName, user, selectedStudent?.name, selectStudent]);

    // Sync klas-veld vanuit AuthContext
    useEffect(() => {
        setKlasInput(klas ?? '');
    }, [klas]);

    const handleSaveKlas = async () => {
        if (klasInput.trim() === (klas ?? '')) return; // niets veranderd
        setKlasSaveState('saving');
        const result = await setKlas(klasInput);
        setKlasSaveState(result.success ? 'saved' : 'error');
        if (result.success) {
            setTimeout(() => setKlasSaveState('idle'), 1500);
        }
    };

    const currentUserData = useMemo(() => {
        const trimmedName = studentName.toLowerCase().trim();
        return allUsersData[trimmedName];
    }, [studentName, allUsersData]);

    const learnedWordsCount = currentUserData?.learnedWords ? Object.keys(currentUserData.learnedWords).length : 0;
    const progressPercentage = Math.min((learnedWordsCount / STORY_MODE_UNLOCK_THRESHOLD) * 100, 100);
    const isStoryModeUnlocked = progressPercentage >= 100;
    const currentAvatar = getAvatarById(currentUserData?.avatarId);
    const points = currentUserData?.points ?? 0;
    const streak = currentUserData?.streak ?? 0;
    const sessionCount = currentUserData?.sessionHistory?.length ?? 0;

    // Tutorial standaard inklappen voor returning users.
    useEffect(() => {
        setShowTutorial(sessionCount === 0);
    }, [sessionCount]);

    // Persoonlijke begroeting — alleen voornaam voor een warme touch
    const firstName = selectedStudent?.name?.split(' ')[0] || studentName.trim().split(' ')[0] || '';

    return (
        <>
            <div className="grid lg:grid-cols-2 gap-6 items-start bg-tal-teal text-white p-4 sm:p-6 rounded-2xl shadow-xl">
                {/* Left Column - Profile & Instructions */}
                <div className="space-y-4">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-bold">
                            {firstName ? `Welkom, ${firstName}! 👋` : 'Welkom bij TALent voor Taal! 🪄'}
                        </h2>
                        <p className="text-slate-200 text-sm mt-1">
                            Klaar om je woordenschat te verrijken? Kies een lijst rechts en start je oefening.
                        </p>
                    </div>

                    {/* Naam-input — alleen voor niet-ingelogde users (gast/dev-bypass).
                        Ingelogde leerlingen zien hun profiel rechtsboven in de Header. */}
                    {!selectedStudent && (
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
                        </div>
                    )}

                    {/* Profielcard — avatar + inputs samen, visueel gegroepeerd.
                        Alleen relevant voor ingelogde leerlingen. */}
                    {selectedStudent && (
                        <div className="bg-gradient-to-br from-white/12 to-white/5 border border-white/15 rounded-2xl p-4 sm:p-5 shadow-inner">
                            <div className="flex gap-4 items-start">
                                {/* Avatar + naam links als vaste kolom */}
                                <div className="flex flex-col items-center gap-1.5 flex-shrink-0 w-20">
                                    <button
                                        type="button"
                                        onClick={onShowAvatarSelector}
                                        disabled={!onShowAvatarSelector}
                                        title="Wijzig avatar"
                                        aria-label="Wijzig avatar"
                                        className="relative group w-20 h-20 rounded-full bg-gradient-to-br from-tal-purple to-tal-purple-dark flex items-center justify-center text-4xl border-4 border-white/30 hover:border-tal-gold hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        <span className="select-none">{currentAvatar.emoji}</span>
                                        {onShowAvatarSelector && (
                                            <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-tal-gold text-tal-teal-dark text-sm flex items-center justify-center font-bold border-2 border-tal-teal shadow-md opacity-90 group-hover:opacity-100">
                                                ✏️
                                            </span>
                                        )}
                                    </button>
                                    <span
                                        title="Jouw gekozen avatar"
                                        className="text-[11px] text-purple-100 font-semibold text-center truncate max-w-full"
                                    >
                                        {currentAvatar.name}
                                    </span>
                                </div>

                                {/* Inputs rechts — klas eerst (belangrijker), moedertaal eronder */}
                                <div className="flex-1 min-w-0 space-y-3">
                                    {isTeacher ? (
                                        /* Leerkracht-weergave: klas/moedertaal zijn niet relevant.
                                           Toon context + een snelkoppeling terug naar het dashboard. */
                                        <div className="space-y-2">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                                                <span>👩‍🏫 Leerkracht-weergave</span>
                                            </p>
                                            <p className="text-sm text-slate-200 leading-snug">
                                                Dit is de leerling-kant — handig om woordenlijsten te previewen of samen met de klas te oefenen.
                                                Wat jij hier oefent telt niet mee als leerling-voortgang.
                                            </p>
                                            {onShowTeacherDashboard && (
                                                <button
                                                    type="button"
                                                    onClick={onShowTeacherDashboard}
                                                    className="mt-1 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-tal-gold text-tal-teal-dark font-bold text-sm hover:scale-[1.02] active:scale-95 transition shadow"
                                                >
                                                    📊 Naar Leerkracht Dashboard
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                      <>
                                        {/* Klas-veld — alleen voor ingelogde leerlingen */}
                                        {user && (
                                            <div>
                                                <label htmlFor="student-klas" className="text-xs font-semibold flex items-center gap-2 uppercase tracking-wider text-slate-200">
                                                    <span>📚 Mijn klas</span>
                                                    {klasSaveState === 'saving' && <span className="text-[10px] text-amber-300 normal-case tracking-normal">opslaan…</span>}
                                                    {klasSaveState === 'saved' && <span className="text-[10px] text-green-300 normal-case tracking-normal">✓ opgeslagen</span>}
                                                    {klasSaveState === 'error' && <span className="text-[10px] text-red-300 normal-case tracking-normal">⚠ niet opgeslagen</span>}
                                                </label>
                                                <input
                                                    id="student-klas"
                                                    type="text"
                                                    value={klasInput}
                                                    onChange={(e) => setKlasInput(e.target.value)}
                                                    onBlur={handleSaveKlas}
                                                    placeholder="bv. AF 5e, OKAN Fase 2…"
                                                    className="w-full p-2.5 mt-1 border-2 border-white/20 bg-white/10 rounded-lg focus:ring-2 focus:ring-tal-purple transition placeholder:text-slate-400 text-white text-sm"
                                                    aria-label="Klas van de leerling"
                                                />
                                            </div>
                                        )}

                                        <div>
                                            <label htmlFor="native-language" className="text-xs font-semibold flex items-center gap-2 uppercase tracking-wider text-slate-200">
                                                <span>🌍 Moedertaal</span>
                                                <span className="text-[10px] text-slate-400 normal-case tracking-normal">(optioneel)</span>
                                                {nativeLangSaveState === 'saving' && <span className="text-[10px] text-slate-300 normal-case tracking-normal">opslaan…</span>}
                                                {nativeLangSaveState === 'saved' && <span className="text-[10px] text-green-300 normal-case tracking-normal">✓ opgeslagen</span>}
                                                {nativeLangSaveState === 'error' && <span className="text-[10px] text-red-300 normal-case tracking-normal">⚠ niet opgeslagen</span>}
                                            </label>
                                            <input
                                                id="native-language"
                                                type="text"
                                                value={nativeLanguage}
                                                onChange={(e) => setNativeLanguage(e.target.value)}
                                                onBlur={user ? handleSaveNativeLanguage : undefined}
                                                placeholder="bv. Frans, Arabisch, Turks…"
                                                className="w-full p-2.5 mt-1 border-2 border-white/20 bg-white/10 rounded-lg focus:ring-2 focus:ring-tal-purple transition placeholder:text-slate-400 text-white text-sm"
                                                aria-label="Moedertaal van de leerling"
                                                maxLength={50}
                                            />
                                        </div>
                                      </>
                                    )}
                                </div>
                            </div>

                        </div>
                    )}

                    {/* TUTORIAL SECTION — collapsible (default ingeklapt voor returning users) */}
                    <div className="bg-white/10 rounded-xl border border-white/10 mt-6 overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setShowTutorial(v => !v)}
                            aria-expanded={showTutorial}
                            className="w-full p-4 flex items-center justify-between gap-3 hover:bg-white/5 transition text-left"
                        >
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <span className="text-xl">🎓</span>
                                <span>Hoe werkt het?</span>
                                {!showTutorial && sessionCount > 0 && (
                                    <span className="text-[10px] font-normal text-slate-300">— klik om de uitleg te zien</span>
                                )}
                            </h3>
                            <span className={`text-slate-300 text-sm transition-transform ${showTutorial ? 'rotate-180' : ''}`} aria-hidden>▾</span>
                        </button>
                        {showTutorial && (
                            <ul className="space-y-4 px-6 pb-6 animate-fade-in">
                                <li className="flex items-start gap-4">
                                    <div className="bg-amber-500 rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0 shadow-sm text-white">!</div>
                                    <div>
                                        <h4 className="font-bold text-amber-300">Vul je profiel in</h4>
                                        <p className="text-sm text-slate-200">Vul hierboven je klas en eventueel moedertaal in zodat je leerkracht je voortgang kan volgen.</p>
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
                        )}
                    </div>
                </div>

                {/* Right Column - Extracted to PracticeSetup */}
                <PracticeSetup
                    studentName={studentName}
                    nativeLanguage={nativeLanguage}
                    aiModel={aiModel}
                    currentUserData={currentUserData}
                    isStoryModeUnlocked={isStoryModeUnlocked}
                    onStartPractice={onStartPractice}
                    onStartStoryChallenge={onStartStoryChallenge}
                    onShowDashboard={onShowDashboard}
                />
            </div>
        </>
    );
};

export default Welcome;
