
import React, { useState, useCallback, useMemo } from 'react';
import { AllUsersData, SessionRecord, WordLevel, UserData, WordListProgress } from '../types';
import { UserCircleIcon } from './icons/UserCircleIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { TrashIcon } from './icons/TrashIcon';
import { BookOpenIcon } from './icons/BookOpenIcon';
import LearnedWordsView from './LearnedWordsView';
import { generateDidacticAnalysis } from '../services/geminiService';
import Spinner from './Spinner';

interface DashboardProps {
    allUsersData: AllUsersData;
    onBack: () => void;
    onDeleteSession: (userName: string, sessionDate: string) => void;
    onDeleteUserData?: (userName: string) => void;
    onPracticeWeakWords?: (words: string[]) => void;
}

interface FeedbackSectionData {
    title: string;
    content: string;
}

const getSessionTags = (session: SessionRecord): string[] => {
    const tags = [];
    const { settings } = session;

    if (settings.finaliteit && settings.jaargang && settings.richting) {
        // Vakspecifiek
        tags.push(`${settings.finaliteit} ${settings.jaargang}`);
        tags.push(settings.richting);
    } else if (settings.context === WordLevel.Custom) {
        // Eigen lijst
        tags.push(WordLevel.Custom);
    } else if (settings.context && typeof settings.context === 'string') {
        // Algemeen
        tags.push(settings.context);
    } else {
        tags.push('Oefening');
    }

    tags.push(`${session.words.length} woorden`);
    return tags;
}


const tagColors: Record<string, string> = {
    // New categories
    [WordLevel.Woordenschat2DF]: 'bg-indigo-100 text-indigo-800',
    [WordLevel.Woordenschat2AF]: 'bg-orange-100 text-orange-800',
    [WordLevel.AcademischNederlands]: 'bg-purple-100 text-purple-800',
    [WordLevel.ProfessioneelNederlands]: 'bg-teal-100 text-teal-800',

    // Difficulty levels
    [WordLevel.Beginner]: 'bg-green-100 text-green-800',
    [WordLevel.Intermediate]: 'bg-cyan-100 text-cyan-800',
    [WordLevel.Advanced]: 'bg-pink-100 text-pink-800',

    // Custom & Default
    [WordLevel.Custom]: 'bg-orange-100 text-orange-800',
    'Oefening': 'bg-slate-200 text-slate-700',
    'default': 'bg-slate-200 text-slate-700',
};


const parseFeedback = (text: string): FeedbackSectionData[] => {
    const sections: FeedbackSectionData[] = [];
    const parts = text.split(/^(###\s+.*)$/m).filter(p => p.trim());

    if (parts.length === 0) return [];

    let currentIndex = 0;
    if (!parts[0].startsWith('###')) {
        sections.push({
            title: 'Feedback van de AI-leraar',
            content: parts[0].trim()
        });
        currentIndex = 1;
    }

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

    if (sections.length === 0 && text.trim()) {
        return [{ title: "Analyse", content: text.trim() }];
    }

    return sections;
};

// Renders text with **bold** segments as React nodes — no innerHTML, so React escapes everything.
const renderInline = (text: string): React.ReactNode[] => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
        const match = part.match(/^\*\*(.+)\*\*$/);
        if (match) return <strong key={i} className="text-tal-teal">{match[1]}</strong>;
        return <React.Fragment key={i}>{part}</React.Fragment>;
    });
};

const FeedbackContent: React.FC<{ text: string }> = React.memo(({ text }) => {
    if (!text) return null;
    const blocks = text.trim().split(/\n\s*\n/);
    return (
        <div className="text-slate-700 space-y-2">
            {blocks.map((block, idx) => {
                const lines = block.split('\n').filter(Boolean);
                const isUnordered = lines.length > 0 && lines.every(line => /^\s*[-*]\s/.test(line));
                if (isUnordered) {
                    return (
                        <ul key={idx} className="list-disc pl-5 space-y-1">
                            {lines.map((line, j) => (
                                <li key={j}>{renderInline(line.trim().replace(/^[*-]\s/, ''))}</li>
                            ))}
                        </ul>
                    );
                }
                return (
                    <p key={idx} className="leading-relaxed">
                        {lines.map((line, j) => (
                            <React.Fragment key={j}>
                                {j > 0 && <br />}
                                {renderInline(line)}
                            </React.Fragment>
                        ))}
                    </p>
                );
            })}
        </div>
    );
});

const FeedbackSectionView: React.FC<{ section: FeedbackSectionData }> = React.memo(({ section }) => {
    const getIcon = (title: string) => {
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes('oordeel')) return '🦉';
        if (lowerTitle.includes('samenvatting')) return '📝';
        if (lowerTitle.includes('analyse')) return '🔬';
        if (lowerTitle.includes('inzichten')) return '🧠';
        if (lowerTitle.includes('tips')) return '💡';
        return null;
    };
    return (
        <div className="p-4 border-l-4 border-slate-300 bg-slate-100 rounded-r-lg">
            <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl" role="img" aria-label={section.title}>{getIcon(section.title)}</span>
                <h4 className="font-bold text-lg text-slate-800">{section.title}</h4>
            </div>
            <FeedbackContent text={section.content} />
        </div>
    );
});


const SessionDetails: React.FC<{
    session: SessionRecord;
    studentName: string;
    onDelete: () => void;
    /** Voortgang voor deze lijst — gebruikt om "nog niet aan bod"-woorden te tonen. */
    wordListProgress?: Record<string, WordListProgress>;
}> = React.memo(({ session, studentName, onDelete, wordListProgress }) => {
    const correctAnswers = session.quizResults.filter(r => r.correct).length;
    const totalQuestions = session.quizResults.length;
    const scorePercentage = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    const tags = getSessionTags(session);

    // Voor opgeladen lijsten (customFileName) bouwen we de "nog niet aan bod"
    // set: alle woorden uit de hele lijst MINUS de woorden die ooit in ENIGE
    // sessie geoefend zijn (uit wordListProgress.practicedWords). Geeft leerling
    // overzicht: wat is al langsgekomen vs. wat staat nog op de wachtlijst.
    const listId = session.settings.customFileName || session.settings.context;
    const listProgress = listId ? wordListProgress?.[String(listId)] : undefined;
    const notPracticedWords = useMemo(() => {
        if (!listProgress || listProgress.allWords.length === 0) return [];
        const practicedSet = new Set(listProgress.practicedWords.map(w => w.toLowerCase()));
        return listProgress.allWords.filter(w => !practicedSet.has(w.toLowerCase()));
    }, [listProgress]);

    const [analysis, setAnalysis] = useState<FeedbackSectionData[] | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    const handleAnalyze = async () => {
        if (!session.timingData) {
            setAnalysisError("Deze sessie bevat geen data voor analyse.");
            return;
        }
        setIsAnalyzing(true);
        setAnalysisError(null);
        try {
            const result = await generateDidacticAnalysis(session, studentName);
            setAnalysis(parseFeedback(result));
        } catch (error) {
            console.error(error);
            setAnalysisError("De analyse kon niet worden gegenereerd. Probeer het later opnieuw.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const protectedHandleAnalyze = () => {
        if (analysis) return; // Don't re-analyze
        if (!window.confirm('Een AI-analyse maken kost een API-credit. Wil je doorgaan?')) return;
        handleAnalyze();
    };

    return (
        <div className="flex flex-col p-3 border-b border-slate-200 last:border-b-0">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                <div className="md:col-span-1 flex flex-col items-start gap-2 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                        {tags.map((tag, i) => {
                            const isVakspecifiekTag = tag.startsWith('AF') || tag.startsWith('DF');
                            const colorClass = tagColors[tag] || (isVakspecifiekTag ? 'bg-fuchsia-100 text-fuchsia-800' : tagColors.default);
                            return <span key={i} className={`text-xs font-medium px-2 py-0.5 rounded-full ${colorClass}`}>{tag}</span>
                        })}
                    </div>
                    {session.settings.customFileName && (
                        <div
                            className="flex items-center gap-1 text-xs text-slate-500 w-full min-w-0"
                            title={session.settings.customFileName}
                        >
                            <span role="img" aria-label="Bestand" className="shrink-0">📄</span>
                            <span className="truncate font-medium">
                                {session.settings.customFileName}
                            </span>
                        </div>
                    )}
                </div>
                <div className="text-sm text-slate-500">{new Date(session.date).toLocaleString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                <div className="text-sm font-semibold">
                    <span className={scorePercentage >= 80 ? 'text-green-600' : 'text-orange-600'}>
                        {scorePercentage}% ({correctAnswers}/{totalQuestions})
                    </span>
                </div>
                <div className="flex items-center justify-start md:justify-end gap-2">
                    {/*
                      "Analyseer"-knop tijdelijk verborgen — kostte AI-credits
                      en leerlingen mochten dit nooit kunnen triggeren.
                      TODO: later terug tonen voor leerkrachten/admin via
                            useAuth().isTeacher || isAdmin gate. State + handler
                            (handleAnalyze / analysis / analysisError) blijven
                            staan zodat herinschakelen een 1-line JSX-paste is.
                    */}
                    <button onClick={onDelete} className="text-slate-400 hover:text-red-600" aria-label="Verwijder sessie"><TrashIcon className="h-4 w-4" /></button>
                </div>
            </div>

            {/* Expand-secties op VOLLE breedte i.p.v. ingedrukt in de smalle 1/4-kolom.
                Responsive grid: 2 kolommen op mobiel → 4 op desktop voor overzichtelijke
                weergave van lange woordenlijsten (bv. 55 woorden zonder lange scroll). */}
            <div className="mt-2 space-y-1.5">
                <details className="text-xs w-full group">
                    <summary className="cursor-pointer text-slate-500 hover:text-slate-700 select-none inline-flex items-center gap-1.5 py-1">
                        <span className="text-[10px] text-slate-400 group-open:rotate-90 transition-transform inline-block">▶</span>
                        <span>Toon woorden & resultaten ({session.words.length})</span>
                    </summary>
                    <ul className="text-slate-600 pt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1">
                        {session.words.map(word => {
                            const result = session.quizResults.find(r => r.word.toLowerCase() === word.toLowerCase());
                            const isCorrect = result ? result.correct : false;
                            return (
                                <li key={word} className="flex items-center gap-2 min-w-0">
                                    <span className="shrink-0" title={isCorrect ? 'Correct' : 'Incorrect'}>
                                        {isCorrect ? '✅' : '❌'}
                                    </span>
                                    <span className="truncate" title={word}>{word}</span>
                                </li>
                            );
                        })}
                    </ul>
                </details>
                {notPracticedWords.length > 0 && listProgress && (
                    <details className="text-xs w-full group">
                        <summary className="cursor-pointer text-slate-500 hover:text-slate-700 select-none inline-flex items-center gap-1.5 py-1">
                            <span className="text-[10px] text-slate-400 group-open:rotate-90 transition-transform inline-block">▶</span>
                            <span>⭕</span>
                            <span>Nog niet aan bod ({notPracticedWords.length} van {listProgress.allWords.length})</span>
                        </summary>
                        <ul className="text-slate-400 pt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1 opacity-80">
                            {notPracticedWords.map(word => (
                                <li key={word} className="flex items-center gap-2 min-w-0">
                                    <span className="shrink-0" title="Nog niet geoefend">⭕</span>
                                    <span className="truncate" title={word}>{word}</span>
                                </li>
                            ))}
                        </ul>
                        <p className="text-[10px] text-slate-400 mt-2 italic">
                            Deze woorden komen aan bod in een volgende sessie van dezelfde lijst.
                        </p>
                    </details>
                )}
            </div>

            {analysisError && <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{analysisError}</div>}
            {analysis && (
                <div className="mt-4 p-4 bg-slate-50 rounded-lg animate-fade-in border border-slate-200 space-y-4">
                    <h3 className="text-base font-bold text-slate-700">Didactische Analyse</h3>
                    {analysis.map((section, index) => (
                        <FeedbackSectionView key={index} section={section} />
                    ))}
                </div>
            )}
        </div>
    );
});


const StudentRow: React.FC<{ name: string; data: UserData, onDeleteSession: DashboardProps['onDeleteSession'], onViewWords: (name: string, data: UserData) => void }> = React.memo(({ name, data, onDeleteSession, onViewWords }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const avgScore = data.sessionHistory.length > 0
        ? Math.round(data.sessionHistory.reduce((acc, session) => {
            const correct = session.quizResults.filter(r => r.correct).length;
            const total = session.quizResults.length;
            return acc + (total > 0 ? (correct / total) * 100 : 0);
        }, 0) / data.sessionHistory.length)
        : 0;
    const learnedWordsCount = Object.keys(data.learnedWords || {}).length;

    return (
        <div className="bg-white rounded-xl shadow-sm transition-shadow hover:shadow-md">
            <div className="p-4 flex items-center">
                <UserCircleIcon className="h-8 w-8 text-slate-400 mr-3 flex-shrink-0" />
                <div className="flex-grow">
                    <p className="font-bold text-slate-800 capitalize">{name}</p>
                    <p className="text-sm text-slate-500">{data.sessionHistory.length} sessies</p>
                </div>
                <div className="ml-auto flex items-center gap-4 sm:gap-6 text-right flex-shrink-0">
                    <div>
                        <p className="text-xs text-slate-500">Gemiddeld</p>
                        <p className="font-semibold text-tal-teal">{avgScore}%</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500">Woorden geleerd</p>
                        <p className="font-semibold text-tal-teal">{learnedWordsCount}</p>
                    </div>
                    <button onClick={() => onViewWords(name, data)} className="hidden sm:flex items-center gap-2 px-3 py-2 bg-white text-slate-600 text-sm font-semibold rounded-lg shadow-sm hover:bg-slate-50 border border-slate-200 transition-all" aria-label={`Woordenlijst van ${name} bekijken`}>
                        <BookOpenIcon className="h-4 w-4" />
                        Woordenlijst
                    </button>
                    <button onClick={() => setIsExpanded(!isExpanded)} className="p-1 rounded-full hover:bg-slate-100" aria-label="Toon sessies">
                        <ChevronDownIcon className={`h-5 w-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>
            <div className="px-4 pb-4 sm:hidden">
                <button onClick={() => onViewWords(name, data)} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 text-slate-600 text-sm font-semibold rounded-lg shadow-sm hover:bg-slate-100 border border-slate-200 transition-all" aria-label={`Woordenlijst van ${name} bekijken`}>
                    <BookOpenIcon className="h-4 w-4" />
                    Bekijk woordenlijst
                </button>
            </div>
            {isExpanded && (
                <div className="bg-slate-50/70 border-t border-slate-200">
                    <div className="hidden md:grid grid-cols-4 gap-4 items-center px-3 py-2 text-xs font-bold text-slate-500 uppercase">
                        <div className="col-span-1">Sessie details</div>
                        <div>Datum</div>
                        <div>Score</div>
                        <div className="text-right">Acties</div>
                    </div>
                    {data.sessionHistory.map(session => (
                        <SessionDetails
                            key={session.date}
                            session={session}
                            studentName={name}
                            wordListProgress={data.wordListProgress}
                            onDelete={() => {
                                if (window.confirm(`Sessie van ${new Date(session.date).toLocaleDateString('nl-BE')} verwijderen?`)) {
                                    onDeleteSession(name, session.date);
                                }
                            }}
                        />
                    ))}
                    {data.sessionHistory.length === 0 && <p className="p-4 text-center text-sm text-slate-500">Deze leerling heeft nog geen sessies voltooid.</p>}
                </div>
            )}
        </div>
    )
});


const Dashboard: React.FC<DashboardProps> = ({ allUsersData, onBack, onDeleteSession, onDeleteUserData, onPracticeWeakWords }) => {
    const [viewingUser, setViewingUser] = useState<[string, UserData] | null>(null);

    const users = Object.entries(allUsersData);

    const handleViewWords = useCallback((name: string, data: UserData) => {
        setViewingUser([name, data]);
    }, []);

    if (viewingUser) {
        return <LearnedWordsView
            userName={viewingUser[0]}
            userData={viewingUser[1]}
            onBack={() => setViewingUser(null)}
            onDeleteUserData={onDeleteUserData}
            onPracticeWeakWords={onPracticeWeakWords}
        />;
    }

    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-slate-800">Resultaten dashboard</h2>
                <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 bg-tal-purple text-white font-semibold rounded-lg shadow-md hover:bg-tal-purple-dark transition-all">
                    <ArrowLeftIcon className="h-5 w-5" />
                    Nieuwe toets
                </button>
            </div>
            <div className="space-y-4">
                {users.length > 0 ? (
                    users.map(([name, data]) => <StudentRow key={name} name={name} data={data} onDeleteSession={onDeleteSession} onViewWords={handleViewWords} />)
                ) : (
                    <div className="text-center bg-white rounded-xl shadow-sm p-12">
                        <p className="text-slate-500">Er zijn nog geen resultaten. Start een nieuwe toets om te beginnen!</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;