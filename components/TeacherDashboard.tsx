
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format, isToday, isThisWeek, differenceInDays } from 'date-fns';
import { nl } from 'date-fns/locale';

interface RegisteredStudent {
    id: string;
    full_name: string;
    klas: string | null;
    created_at: string;
}

/** Volledig leerling-profiel uit `profiles` — óók leerlingen zonder enkele sessie,
 *  zodat de leerkracht zijn hele klas ziet, niet enkel wie iets afmaakte (Onderdeel D). */
interface StudentProfile {
    id: string;
    email: string | null;
    full_name: string | null;
    klas: string | null;
    finaliteit: string | null;
    jaargang: string | null;
    points: number | null;
    created_at: string;
}

interface SessionQuizResult {
    word: string;
    correct: boolean;
}

interface SessionWithProfile {
    id: string;
    score: number;
    total_questions: number;
    duration_seconds: number;
    completed_at: string;
    context: string;
    file_name: string | null;
    course_id: string | null;
    finaliteit: string | null;
    jaargang: string | null;
    /** Per-woord resultaten — beschikbaar voor sessies vanaf 2026-05-28. Pre-migration sessies: leeg array. */
    quiz_results: SessionQuizResult[] | null;
    /** Totale grootte van de opgeladen lijst — voor X/Y progress stats. NULL voor pre-migration. */
    total_words: number | null;
    profiles: {
        full_name: string | null;
        email: string;
        klas: string | null;
        points: number | null;
    };
}

/** Geaggregeerde voortgang van één leerling op één opgeladen lijst, over alle sessies. */
interface StudentListProgress {
    /** UI-label voor de lijst: file_name als beschikbaar, anders context. */
    label: string;
    /** Aantal unieke woorden geoefend over alle sessies van deze lijst. */
    practicedCount: number;
    /** Totaal woorden in de lijst (MAX van total_words over sessies). NULL als geen sessie het rapporteert. */
    totalCount: number | null;
    /** Percentage geoefend, of null als totaal onbekend. */
    progressPercent: number | null;
}

interface StudentSummary {
    email: string;
    name: string;
    sessions: SessionWithProfile[];
    totalSessions: number;
    avgScore: number;
    lastActive: Date;
    isInactive: boolean;
    isStruggling: boolean;
    /** Totale XP-saldo van de leerling (uit profiles.points). 0 indien onbekend. */
    xp: number;
}

interface DashboardProps {
    onBack: () => void;
}

type DateFilter = 'today' | 'week' | 'all';
type ViewMode = 'sessions' | 'students' | 'roster' | 'leaderboard';

const TeacherDashboard: React.FC<DashboardProps> = ({ onBack }) => {
    const { role } = useAuth();
    const [sessions, setSessions] = useState<SessionWithProfile[]>([]);
    // Volledige klaslijst (alle leerling-profielen, ook zonder sessie) — Onderdeel D.
    const [allStudents, setAllStudents] = useState<StudentProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // Default 'all': de leerkracht wil standaard zijn héle klas / alle sessies zien
    // (niet enkel vandaag of deze week — dat toonde vaak ten onrechte een leeg
    // dashboard). Inzoomen op een periode kan altijd via de knoppen.
    const [dateFilter, setDateFilter] = useState<DateFilter>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [viewMode, setViewMode] = useState<ViewMode>('sessions');
    const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
    /** Welke sessie-rij in de Sessies-tab is uitgeklapt voor de quiz-resultaten? */
    const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
    const [finaliteitFilter, setFinaliteitFilter] = useState<string>('all');
    // Snelstart-uitleg: standaard open de eerste keer, daarna onthouden we de keuze.
    const [showHelp, setShowHelp] = useState(() => {
        try { const v = localStorage.getItem('taltrekkers_teacher_help_open'); return v === null ? true : v === 'true'; }
        catch { return true; }
    });
    const toggleHelp = () => setShowHelp(prev => {
        const next = !prev;
        try { localStorage.setItem('taltrekkers_teacher_help_open', String(next)); } catch { /* storage geblokkeerd */ }
        return next;
    });
    const [jaargangFilter, setJaargangFilter] = useState<string>('all');
    const [klasFilter, setKlasFilter] = useState<string>('all');

    // Leerlingen beheer state
    const [roster, setRoster] = useState<RegisteredStudent[]>([]);
    const [rosterLoading, setRosterLoading] = useState(false);
    const [newName, setNewName] = useState('');
    const [newKlas, setNewKlas] = useState('');
    const [addingStudent, setAddingStudent] = useState(false);
    const [rosterMessage, setRosterMessage] = useState<string | null>(null);

    useEffect(() => {
        const fetchSessions = async () => {
            try {
                const { data, error } = await supabase
                    .from('practice_sessions')
                    .select(`
                        id,
                        score,
                        total_questions,
                        duration_seconds,
                        completed_at,
                        context,
                        file_name,
                        course_id,
                        finaliteit,
                        jaargang,
                        quiz_results,
                        total_words,
                        profiles (
                            email,
                            full_name,
                            klas,
                            points
                        )
                    `)
                    .order('completed_at', { ascending: false });

                if (error) throw error;
                setSessions(data as unknown as SessionWithProfile[]);
            } catch (err: unknown) {
                console.error("Fout bij ophalen sessies:", err);
                setError("Kon data niet ophalen. Ben je zeker dat je leerkracht bent?");
            } finally {
                setLoading(false);
            }
        };

        // Volledige klaslijst uit `profiles` — álle leerlingen, ook zonder
        // sessie. Zo ziet de leerkracht zijn hele klas, niet enkel wie iets
        // afmaakte (Onderdeel D). RLS staat teachers toe alle profielen te lezen.
        const fetchAllStudents = async () => {
            const { data } = await supabase
                .from('profiles')
                .select('id, email, full_name, klas, finaliteit, jaargang, points, created_at')
                .eq('role', 'student')
                .order('full_name', { ascending: true });
            if (data) setAllStudents(data as StudentProfile[]);
        };


        // Echte autorisatie loopt via Supabase RLS. We tonen de UI alleen aan
        // gebruikers met role='teacher' OF role='admin' in profiles. Admin is
        // een super-teacher en erft alle teacher-rechten via is_teacher() in DB.
        if (role === 'teacher' || role === 'admin') {
            fetchSessions();
            fetchRoster();
            fetchAllStudents();
        } else if (role === null) {
            // Auth state nog niet geladen — wacht
            return;
        } else {
            setLoading(false);
            setError('Geen toegang: log in met een leerkracht-account om dit dashboard te zien.');
        }
    }, [role]);

    const fetchRoster = async () => {
        setRosterLoading(true);
        const { data } = await supabase
            .from('registered_students')
            .select('id, full_name, klas, created_at')
            .order('klas', { ascending: true, nullsFirst: false })
            .order('full_name', { ascending: true });
        if (data) setRoster(data);
        setRosterLoading(false);
    };

    const handleAddStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setAddingStudent(true);
        setRosterMessage(null);
        const { error } = await supabase
            .from('registered_students')
            .insert({ full_name: newName.trim(), klas: newKlas.trim() || null });
        if (error) {
            setRosterMessage('❌ Fout bij toevoegen: ' + error.message);
        } else {
            setNewName('');
            setNewKlas('');
            setRosterMessage('✅ Leerling toegevoegd!');
            await fetchRoster();
            setTimeout(() => setRosterMessage(null), 3000);
        }
        setAddingStudent(false);
    };

    const handleDeleteStudent = async (id: string, name: string) => {
        if (!confirm(`Wil je ${name} verwijderen uit de lijst?`)) return;
        const { error } = await supabase.from('registered_students').delete().eq('id', id);
        if (!error) {
            setRoster(prev => prev.filter(s => s.id !== id));
        }
    };

    // Get unique categories
    const categories = useMemo(() => {
        const cats = new Set(sessions.map(s => s.file_name || s.context));
        return ['all', ...Array.from(cats)];
    }, [sessions]);

    // Beschikbare jaargangen op basis van geselecteerde finaliteit (uit feitelijke sessiedata)
    const availableJaargangen = useMemo(() => {
        const set = new Set<string>();
        sessions.forEach(s => {
            if (!s.jaargang) return;
            if (finaliteitFilter === 'all' || s.finaliteit === finaliteitFilter) {
                set.add(s.jaargang);
            }
        });
        return Array.from(set).sort();
    }, [sessions, finaliteitFilter]);

    // Alle klassen die voorkomen in de sessie-data (voor filter dropdown)
    const availableKlassen = useMemo(() => {
        const set = new Set<string>();
        sessions.forEach(s => {
            if (s.profiles.klas) set.add(s.profiles.klas);
        });
        return Array.from(set).sort();
    }, [sessions]);

    // Reset jaargangFilter als die niet meer beschikbaar is na finaliteit-wijziging
    useEffect(() => {
        if (jaargangFilter !== 'all' && !availableJaargangen.includes(jaargangFilter)) {
            setJaargangFilter('all');
        }
    }, [availableJaargangen, jaargangFilter]);

    // Filter sessies
    const filteredSessions = useMemo(() => {
        return sessions.filter(session => {
            const sessionDate = new Date(session.completed_at);
            const studentName = session.profiles.full_name || session.profiles.email;
            const category = session.file_name || session.context;

            // Date filter
            let matchesDate = true;
            if (dateFilter === 'today') matchesDate = isToday(sessionDate);
            else if (dateFilter === 'week') matchesDate = isThisWeek(sessionDate, { weekStartsOn: 1 });

            // Search filter
            const matchesSearch = searchQuery === '' ||
                studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                session.profiles.email.toLowerCase().includes(searchQuery.toLowerCase());

            // Category filter
            const matchesCategory = categoryFilter === 'all' || category === categoryFilter;

            // Finaliteit + jaargang filters (skippen sessies zonder structurele context bij actief filter)
            const matchesFinaliteit = finaliteitFilter === 'all' || session.finaliteit === finaliteitFilter;
            const matchesJaargang = jaargangFilter === 'all' || session.jaargang === jaargangFilter;

            // Klas filter (gebaseerd op profiles.klas)
            const matchesKlas = klasFilter === 'all' || session.profiles.klas === klasFilter;

            return matchesDate && matchesSearch && matchesCategory && matchesFinaliteit && matchesJaargang && matchesKlas;
        });
    }, [sessions, dateFilter, searchQuery, categoryFilter, finaliteitFilter, jaargangFilter, klasFilter]);

    // Statistics
    const stats = useMemo(() => {
        const uniqueStudents = new Set(filteredSessions.map(s => s.profiles.email));
        const totalScore = filteredSessions.reduce((sum, s) => sum + s.score, 0);
        const totalQuestions = filteredSessions.reduce((sum, s) => sum + s.total_questions, 0);
        // Cap op 100% — oude data kan score > total_questions hebben door bugs in vorige scoring-logica.
        const avgPercent = totalQuestions > 0 ? Math.min(100, Math.round((totalScore / totalQuestions) * 100)) : 0;

        // Most practiced category
        const categoryCount: Record<string, number> = {};
        filteredSessions.forEach(s => {
            const cat = s.file_name || s.context;
            categoryCount[cat] = (categoryCount[cat] || 0) + 1;
        });
        const topCategory = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0];

        return {
            totalSessions: filteredSessions.length,
            uniqueStudents: uniqueStudents.size,
            avgScore: avgPercent,
            topCategory: topCategory ? topCategory[0] : '-'
        };
    }, [filteredSessions]);

    // Group by students
    const studentSummaries = useMemo((): StudentSummary[] => {
        const studentMap = new Map<string, SessionWithProfile[]>();

        filteredSessions.forEach(session => {
            const email = session.profiles.email;
            if (!studentMap.has(email)) {
                studentMap.set(email, []);
            }
            studentMap.get(email)!.push(session);
        });

        return Array.from(studentMap.entries()).map(([email, studentSessions]) => {
            const totalScore = studentSessions.reduce((sum, s) => sum + s.score, 0);
            const totalQuestions = studentSessions.reduce((sum, s) => sum + s.total_questions, 0);
            // Cap op 100% — bescherming tegen historische data corruption (score > total_questions).
            const avgScore = totalQuestions > 0 ? Math.min(100, Math.round((totalScore / totalQuestions) * 100)) : 0;
            const lastActive = new Date(Math.max(...studentSessions.map(s => new Date(s.completed_at).getTime())));
            const daysInactive = differenceInDays(new Date(), lastActive);

            // XP komt uit het profiel (zelfde voor elke sessie van de leerling).
            // Neem de hoogste waarde die we zien, robuust tegen oudere rijen.
            const xp = Math.max(0, ...studentSessions.map(s => s.profiles.points ?? 0));

            return {
                email,
                name: studentSessions[0].profiles.full_name || email.split('@')[0],
                sessions: studentSessions,
                totalSessions: studentSessions.length,
                avgScore,
                lastActive,
                isInactive: daysInactive >= 7,
                isStruggling: avgScore < 50,
                xp,
            };
        }).sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime());
    }, [filteredSessions]);

    // Ranglijst: leerlingen gesorteerd op XP (hoogste eerst). Leerkracht-only.
    const leaderboard = useMemo(
        () => [...studentSummaries].sort((a, b) => b.xp - a.xp),
        [studentSummaries]
    );

    // ── Volledige klas (Onderdeel D) ───────────────────────────────────
    // De Leerlingen-view toonde enkel leerlingen mét een sessie in de gekozen
    // periode, waardoor wie niets (of niets deze week) afmaakte "verdween".
    // We tonen nu de héle klas, met status per leerling.

    // All-time activiteit per leerling (los van het datumfilter) — om
    // "nog nooit iets afgewerkt" te onderscheiden van "wel geoefend, maar
    // niet in deze periode".
    const allTimeActivity = useMemo(() => {
        const map = new Map<string, { count: number; lastActive: number }>();
        sessions.forEach(s => {
            const email = s.profiles?.email;
            if (!email) return;
            const prev = map.get(email);
            map.set(email, {
                count: (prev?.count ?? 0) + 1,
                lastActive: Math.max(prev?.lastActive ?? 0, new Date(s.completed_at).getTime()),
            });
        });
        return map;
    }, [sessions]);

    // Leerlingen zónder sessie in de huidige periode — de "ontbrekende"
    // leerlingen die je collega miste.
    const inactiveStudents = useMemo(() => {
        const activeEmails = new Set(studentSummaries.map(s => s.email));
        return allStudents
            .filter(p => !p.email || !activeEmails.has(p.email))
            .map(p => {
                const activity = p.email ? allTimeActivity.get(p.email) : undefined;
                return {
                    id: p.id,
                    email: p.email,
                    name: p.full_name || (p.email ? p.email.split('@')[0] : 'Onbekend'),
                    klas: p.klas,
                    onboarded: !!(p.finaliteit && p.jaargang),
                    totalSessions: activity?.count ?? 0,
                    lastActive: activity ? new Date(activity.lastActive) : null,
                };
            })
            .sort((a, b) => {
                if (a.lastActive && b.lastActive) return b.lastActive.getTime() - a.lastActive.getTime();
                if (a.lastActive) return -1;
                if (b.lastActive) return 1;
                return a.name.localeCompare(b.name);
            });
    }, [allStudents, studentSummaries, allTimeActivity]);

    // Tellers voor de overzichtsregel bovenaan de Leerlingen-view.
    const rosterCounts = useMemo(() => ({
        total: allStudents.length,
        activeThisPeriod: studentSummaries.length,
        neverStarted: inactiveStudents.filter(s => s.onboarded && s.totalSessions === 0).length,
        notOnboarded: inactiveStudents.filter(s => !s.onboarded).length,
    }), [allStudents.length, studentSummaries.length, inactiveStudents]);

    const formatDuration = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}m ${secs}s`;
    };

    /**
     * Aggregeer per leerling de voortgang per opgeladen woordenlijst.
     * Gebruikt:
     *   - quiz_results uit alle sessies → unieke geoefende woorden per lijst
     *   - total_words (MAX over sessies) → grootte van de lijst
     * Beide velden zijn JSONB/INT-kolommen op practice_sessions (sinds 28 mei 2026).
     * Voor sessies van vóór die datum zijn ze leeg/NULL → fallback "X / ?".
     */
    const getStudentListProgress = (sessions: SessionWithProfile[]): StudentListProgress[] => {
        // Group per listId (file_name of context). file_name heeft voorrang voor
        // opgeladen lijsten — context is fallback voor algemene niveau-modi.
        const listMap = new Map<string, { label: string; words: Set<string>; total: number }>();

        sessions.forEach(s => {
            const listId = s.file_name || s.context;
            if (!listId) return;
            const label = s.file_name || s.context;
            const entry = listMap.get(listId) ?? { label, words: new Set<string>(), total: 0 };
            // Verzamel unieke woorden uit alle quiz_results van deze lijst
            (s.quiz_results ?? []).forEach(r => entry.words.add(r.word.toLowerCase()));
            // Houd het hoogste rapporteerde totaal aan
            if (s.total_words && s.total_words > entry.total) entry.total = s.total_words;
            listMap.set(listId, entry);
        });

        return Array.from(listMap.values())
            .map(({ label, words, total }) => {
                const practicedCount = words.size;
                const totalCount = total > 0 ? total : null;
                const progressPercent = totalCount ? Math.round((practicedCount / totalCount) * 100) : null;
                return { label, practicedCount, totalCount, progressPercent };
            })
            // Sorteer: lijsten met meeste voortgang eerst, daarna onbekend totaal achteraan
            .sort((a, b) => {
                if (a.progressPercent === null && b.progressPercent === null) return b.practicedCount - a.practicedCount;
                if (a.progressPercent === null) return 1;
                if (b.progressPercent === null) return -1;
                return b.progressPercent - a.progressPercent;
            });
    };

    const exportToCSV = () => {
        const headers = ['Datum', 'Leerling', 'Email', 'Oefening', 'Score', 'Totaal', 'Percentage', 'Duur (sec)'];
        const rows = filteredSessions.map(s => [
            format(new Date(s.completed_at), "yyyy-MM-dd HH:mm"),
            s.profiles.full_name || s.profiles.email.split('@')[0],
            s.profiles.email,
            s.file_name || s.context,
            s.score,
            s.total_questions,
            Math.round((s.score / s.total_questions) * 100) + '%',
            s.duration_seconds
        ]);

        const csv = [headers, ...rows].map(row => row.join(';')).join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `taltrekkers_export_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    // ── Lege-staat hint ────────────────────────────────────────────────
    // Verduidelijkt dat een leeg dashboard ≠ "niemand heeft geoefend":
    // (a) je bekijkt mogelijk maar een deel van de periode, en
    // (b) enkel volledig afgeronde oefeningen belanden hier.
    const periodNoun = dateFilter === 'today' ? 'vandaag' : dateFilter === 'week' ? 'deze week' : null;
    const emptyStateContent = (
        <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-slate-400">
                {periodNoun
                    ? `Geen afgeronde oefeningen ${periodNoun} met deze filters.`
                    : 'Geen afgeronde oefeningen gevonden met deze filters.'}
            </p>
            {dateFilter !== 'all' && (
                <>
                    <button
                        onClick={() => setDateFilter('all')}
                        className="px-4 py-2 rounded-lg bg-tal-purple text-white text-sm font-medium hover:bg-tal-purple-dark transition"
                    >
                        📊 Toon alle sessies
                    </button>
                    <p className="text-xs text-slate-400 max-w-md">
                        💡 Een lege lijst betekent niet automatisch dat er niet geoefend is: enkel <strong>volledig afgeronde</strong> oefeningen verschijnen hier, en je bekijkt nu enkel <strong>{periodNoun}</strong>.
                    </p>
                </>
            )}
        </div>
    );

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tal-purple"></div>
        </div>
    );

    return (
        <div className="animate-fade-in max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-tal-purple-dark">👨‍🏫 Leerkracht Dashboard</h1>
                    <p className="text-slate-600">Volg de vooruitgang van je leerlingen in realtime.</p>
                </div>
                <button
                    onClick={onBack}
                    className="px-4 py-2 text-slate-500 hover:text-slate-700 font-medium transition"
                >
                    Terug naar App
                </button>
            </div>

            {/* Snelstart — compacte, inklapbare uitleg voor leerkrachten */}
            <div className="bg-tal-purple/5 border border-tal-purple/20 rounded-xl mb-6 overflow-hidden">
                <button
                    type="button"
                    onClick={toggleHelp}
                    aria-expanded={showHelp}
                    className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-tal-purple/10 transition text-left"
                >
                    <span className="font-semibold text-tal-purple-dark flex items-center gap-2">
                        <span>ℹ️</span> Snelstart — hoe werkt dit dashboard?
                    </span>
                    <span className={`text-tal-purple text-sm transition-transform ${showHelp ? 'rotate-180' : ''}`} aria-hidden>▾</span>
                </button>
                {showHelp && (
                    <ul className="px-5 pb-4 pt-1 space-y-2 text-sm text-slate-600 animate-fade-in">
                        <li><strong className="text-slate-700">📋 Sessies</strong> — elke afgewerkte oefening. Klik een rij open (▶) om te zien welke woorden goed of fout waren.</li>
                        <li><strong className="text-slate-700">👥 Leerlingen</strong> — per leerling de gemiddelde score + voortgang per opgeladen woordenlijst.</li>
                        <li><strong className="text-slate-700">📝 Klaslijst</strong> — beheer welke leerlingen tot je klas behoren.</li>
                        <li><strong className="text-slate-700">🔍 Filters</strong> — beperk op datum, klas, finaliteit of jaargang, of zoek een leerling op naam.</li>
                        <li><strong className="text-slate-700">📅 Periode</strong> — standaard zie je <strong>alle sessies</strong>. Wil je inzoomen op vandaag of deze week? Gebruik de periode-knoppen. Let op: enkel <strong>volledig afgeronde</strong> oefeningen verschijnen hier.</li>
                        <li><strong className="text-slate-700">📤 Export CSV</strong> — download de resultaten voor je puntenboek.</li>
                        <li className="text-slate-500">💡 Via <strong>"Terug naar App"</strong> kan je zelf woordenlijsten uittesten zoals een leerling ze ziet.</li>
                    </ul>
                )}
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                    <div className="text-3xl font-bold text-tal-purple">{stats.totalSessions}</div>
                    <div className="text-sm text-slate-500">Sessies</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                    <div className="text-3xl font-bold text-tal-teal">{stats.uniqueStudents}</div>
                    <div className="text-sm text-slate-500">Leerlingen</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                    <div className={`text-3xl font-bold ${stats.avgScore >= 70 ? 'text-green-600' : stats.avgScore >= 50 ? 'text-orange-500' : 'text-red-500'}`}>
                        {stats.avgScore}%
                    </div>
                    <div className="text-sm text-slate-500">Gem. score</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                    <div className="text-lg font-bold text-slate-700 truncate">{stats.topCategory}</div>
                    <div className="text-sm text-slate-500">Populairste</div>
                </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap gap-3 mb-6 items-center">
                {/* Date Filters */}
                <div className="flex gap-2">
                    {(['today', 'week', 'all'] as DateFilter[]).map((filter) => (
                        <button
                            key={filter}
                            onClick={() => setDateFilter(filter)}
                            className={`px-4 py-2 rounded-lg font-medium transition text-sm ${dateFilter === filter
                                ? 'bg-tal-purple text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            {filter === 'today' ? '📅 Vandaag' : filter === 'week' ? '📆 Week' : '📊 Alles'}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <input
                    type="text"
                    placeholder="🔍 Zoek leerling..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-tal-purple focus:border-transparent outline-none text-sm w-48"
                />

                {/* Category Filter */}
                <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-tal-purple focus:border-transparent outline-none text-sm"
                >
                    {categories.map(cat => (
                        <option key={cat} value={cat}>
                            {cat === 'all' ? '📚 Alle categorieën' : cat}
                        </option>
                    ))}
                </select>

                {/* Finaliteit Filter */}
                <select
                    value={finaliteitFilter}
                    onChange={(e) => setFinaliteitFilter(e.target.value)}
                    className="px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-tal-purple focus:border-transparent outline-none text-sm"
                >
                    <option value="all">🎯 Alle finaliteiten</option>
                    <option value="AF">AF — Arbeidsfinaliteit</option>
                    <option value="DF">DF — Dubbele finaliteit</option>
                    <option value="OKAN">OKAN</option>
                </select>

                {/* Jaargang Filter (alleen tonen als er jaargangen beschikbaar zijn) */}
                {availableJaargangen.length > 0 && (
                    <select
                        value={jaargangFilter}
                        onChange={(e) => setJaargangFilter(e.target.value)}
                        className="px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-tal-purple focus:border-transparent outline-none text-sm"
                    >
                        <option value="all">📚 Alle jaargangen</option>
                        {availableJaargangen.map(j => (
                            <option key={j} value={j}>{j}</option>
                        ))}
                    </select>
                )}

                {/* Klas Filter (alleen tonen als er klassen bekend zijn) */}
                {availableKlassen.length > 0 && (
                    <select
                        value={klasFilter}
                        onChange={(e) => setKlasFilter(e.target.value)}
                        className="px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-tal-purple focus:border-transparent outline-none text-sm"
                    >
                        <option value="all">👥 Alle klassen</option>
                        {availableKlassen.map(k => (
                            <option key={k} value={k}>{k}</option>
                        ))}
                    </select>
                )}

                {/* View Mode Toggle */}
                <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                    <button
                        onClick={() => setViewMode('sessions')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${viewMode === 'sessions' ? 'bg-white shadow-sm' : 'hover:bg-slate-200'}`}
                    >
                        📋 Sessies
                    </button>
                    <button
                        onClick={() => setViewMode('students')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${viewMode === 'students' ? 'bg-white shadow-sm' : 'hover:bg-slate-200'}`}
                    >
                        👥 Leerlingen
                    </button>
                    <button
                        onClick={() => setViewMode('roster')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${viewMode === 'roster' ? 'bg-white shadow-sm' : 'hover:bg-slate-200'}`}
                    >
                        📝 Klaslijst
                    </button>
                    <button
                        onClick={() => setViewMode('leaderboard')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${viewMode === 'leaderboard' ? 'bg-white shadow-sm' : 'hover:bg-slate-200'}`}
                    >
                        🏆 Ranglijst
                    </button>
                </div>

                {/* Export Button */}
                <button
                    onClick={exportToCSV}
                    className="ml-auto px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition text-sm"
                >
                    📥 Export CSV
                </button>
            </div>

            {error ? (
                <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl">
                    ⛔ {error}
                </div>
            ) : viewMode === 'sessions' ? (
                /* SESSIONS VIEW */
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-slate-500 font-semibold text-sm uppercase tracking-wider border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 w-8"></th>
                                    <th className="px-6 py-4">Datum</th>
                                    <th className="px-6 py-4">Leerling</th>
                                    <th className="px-6 py-4">Oefening</th>
                                    <th className="px-6 py-4">Score</th>
                                    <th className="px-6 py-4">Tijd</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredSessions.map((session) => {
                                    const isExpanded = expandedSessionId === session.id;
                                    const quizResults = session.quiz_results ?? [];
                                    const correctWords = quizResults.filter(r => r.correct);
                                    const incorrectWords = quizResults.filter(r => !r.correct);
                                    return (
                                        <React.Fragment key={session.id}>
                                            <tr
                                                onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
                                                className={`hover:bg-slate-50 transition cursor-pointer ${isExpanded ? 'bg-tal-teal/5' : ''}`}
                                            >
                                                <td className="pl-6 pr-1 py-4 w-8 text-slate-400">
                                                    <span className={`inline-block text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                                                    {format(new Date(session.completed_at), "d MMM yyyy HH:mm", { locale: nl })}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-slate-800">
                                                        {session.profiles.full_name || session.profiles.email.split('@')[0]}
                                                    </div>
                                                    <div className="text-xs text-slate-400">
                                                        {session.profiles.email}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-tal-teal/10 text-tal-teal-dark border border-tal-teal/20">
                                                        {session.file_name || session.context}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-bold ${(session.score / session.total_questions) >= 0.7 ? 'text-green-600' :
                                                            (session.score / session.total_questions) >= 0.5 ? 'text-orange-500' : 'text-red-500'
                                                            }`}>
                                                            {session.score}/{session.total_questions}
                                                        </span>
                                                        <span className="text-xs text-slate-400">
                                                            ({Math.round((session.score / session.total_questions) * 100)}%)
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-500 text-sm font-mono">
                                                    {formatDuration(session.duration_seconds)}
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className="bg-slate-50/70 border-b border-slate-200">
                                                    <td colSpan={6} className="px-6 py-5">
                                                        {quizResults.length === 0 ? (
                                                            <p className="text-sm text-slate-500 italic">
                                                                Geen per-woord data beschikbaar voor deze sessie (oudere sessie van vóór 28 mei 2026).
                                                            </p>
                                                        ) : (
                                                            <div className="space-y-4">
                                                                <div className="flex items-center gap-4 text-xs">
                                                                    <span className="flex items-center gap-1.5 text-green-700 font-medium">
                                                                        <span>✅</span> {correctWords.length} correct
                                                                    </span>
                                                                    <span className="flex items-center gap-1.5 text-red-700 font-medium">
                                                                        <span>❌</span> {incorrectWords.length} fout
                                                                    </span>
                                                                </div>
                                                                {incorrectWords.length > 0 && (
                                                                    <div>
                                                                        <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-2">
                                                                            ❌ Fout beantwoord ({incorrectWords.length})
                                                                        </p>
                                                                        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1 text-sm text-slate-700">
                                                                            {incorrectWords.map(r => (
                                                                                <li key={r.word} className="flex items-center gap-2 min-w-0">
                                                                                    <span className="shrink-0 text-red-500">❌</span>
                                                                                    <span className="truncate" title={r.word}>{r.word}</span>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )}
                                                                {correctWords.length > 0 && (
                                                                    <details className="group">
                                                                        <summary className="cursor-pointer text-xs font-semibold text-green-700 uppercase tracking-wider mb-2 inline-flex items-center gap-1.5 select-none">
                                                                            <span className="inline-block text-[10px] group-open:rotate-90 transition-transform">▶</span>
                                                                            <span>✅ Correct beantwoord ({correctWords.length})</span>
                                                                        </summary>
                                                                        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1 text-sm text-slate-600 mt-2">
                                                                            {correctWords.map(r => (
                                                                                <li key={r.word} className="flex items-center gap-2 min-w-0">
                                                                                    <span className="shrink-0 text-green-500">✅</span>
                                                                                    <span className="truncate" title={r.word}>{r.word}</span>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </details>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                                {filteredSessions.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12">
                                            {emptyStateContent}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : viewMode === 'roster' ? (
                /* KLASLIJST VIEW */
                <div className="space-y-6">
                    {/* Toevoegen form */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <h2 className="text-lg font-bold text-slate-800 mb-4">➕ Leerling toevoegen</h2>
                        <form onSubmit={handleAddStudent} className="flex flex-wrap gap-3 items-end">
                            <div className="flex-1 min-w-[180px]">
                                <label className="block text-sm font-semibold text-slate-600 mb-1">Naam *</label>
                                <input
                                    type="text"
                                    required
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    placeholder="Voornaam Achternaam"
                                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-tal-purple focus:border-transparent outline-none text-sm"
                                />
                            </div>
                            <div className="w-36">
                                <label className="block text-sm font-semibold text-slate-600 mb-1">Klas <span className="font-normal text-slate-400">(optioneel)</span></label>
                                <input
                                    type="text"
                                    value={newKlas}
                                    onChange={e => setNewKlas(e.target.value)}
                                    placeholder="bv. 3AF"
                                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-tal-purple focus:border-transparent outline-none text-sm"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={addingStudent || !newName.trim()}
                                className="px-5 py-2.5 bg-tal-purple text-white font-bold rounded-lg hover:bg-tal-purple-dark transition disabled:opacity-50 text-sm"
                            >
                                {addingStudent ? 'Toevoegen...' : 'Toevoegen'}
                            </button>
                        </form>
                        {rosterMessage && (
                            <p className={`mt-3 text-sm font-medium ${rosterMessage.startsWith('✅') ? 'text-green-700' : 'text-red-600'}`}>
                                {rosterMessage}
                            </p>
                        )}
                    </div>

                    {/* Leerlingenlijst */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-slate-800">📋 Geregistreerde leerlingen ({roster.length})</h2>
                        </div>
                        {rosterLoading ? (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tal-purple" />
                            </div>
                        ) : roster.length === 0 ? (
                            <div className="text-center py-12 text-slate-400">
                                Nog geen leerlingen toegevoegd.
                            </div>
                        ) : (
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-slate-500 font-semibold text-xs uppercase tracking-wider border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-3">Naam</th>
                                        <th className="px-6 py-3">Klas</th>
                                        <th className="px-6 py-3">Toegevoegd</th>
                                        <th className="px-6 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {roster.map(s => (
                                        <tr key={s.id} className="hover:bg-slate-50/50 transition">
                                            <td className="px-6 py-3 font-medium text-slate-800">{s.full_name}</td>
                                            <td className="px-6 py-3">
                                                {s.klas ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-tal-purple/10 text-tal-purple-dark">{s.klas}</span>
                                                ) : <span className="text-slate-400 text-xs">—</span>}
                                            </td>
                                            <td className="px-6 py-3 text-slate-400 text-sm">
                                                {format(new Date(s.created_at), 'd MMM yyyy', { locale: nl })}
                                            </td>
                                            <td className="px-6 py-3 text-right">
                                                <button
                                                    onClick={() => handleDeleteStudent(s.id, s.full_name)}
                                                    className="text-red-400 hover:text-red-600 text-sm font-medium transition"
                                                >
                                                    Verwijderen
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            ) : viewMode === 'leaderboard' ? (
                /* RANGLIJST VIEW — leerlingen gesorteerd op XP (leerkracht-only).
                   Respecteert de actieve filters (datum/klas/zoeken), zodat je
                   bv. ook per klas een ranglijst krijgt. */
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200">
                        <h2 className="text-lg font-bold text-slate-800">🏆 XP-ranglijst</h2>
                        <p className="text-sm text-slate-500">
                            Leerlingen gerangschikt op totale XP. Alleen zichtbaar voor jou als leerkracht.
                        </p>
                    </div>
                    {leaderboard.length === 0 ? (
                        <div className="px-6 py-12 text-center text-slate-400">
                            Nog geen leerlingen met activiteit voor deze filters.
                        </div>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {leaderboard.map((s, idx) => {
                                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                                return (
                                    <li key={s.email} className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50/60 transition">
                                        <div className="w-9 text-center text-lg font-bold text-slate-500 shrink-0">
                                            {medal ?? <span className="text-sm">#{idx + 1}</span>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-slate-800 truncate">{s.name}</div>
                                            <div className="text-xs text-slate-400 truncate">{s.email}</div>
                                        </div>
                                        {s.sessions[0]?.profiles.klas && (
                                            <span className="hidden sm:inline-flex text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                                                {s.sessions[0].profiles.klas}
                                            </span>
                                        )}
                                        <div className="text-right shrink-0 w-20">
                                            <span className="font-bold text-tal-purple">{s.xp.toLocaleString('nl-BE')}</span>
                                            <span className="text-xs text-slate-400 ml-1">XP</span>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            ) : (
                /* STUDENTS VIEW — volledige klas met status (Onderdeel D) */
                <div className="space-y-6">
                    {/* Overzichtsregel: hoeveel van de klas is actief? */}
                    {allStudents.length > 0 && (
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 text-sm text-slate-600">
                            <strong className="text-slate-800">{rosterCounts.activeThisPeriod}</strong> van <strong className="text-slate-800">{rosterCounts.total}</strong> leerlingen actief{periodNoun ? ` ${periodNoun}` : ''}
                            {rosterCounts.neverStarted > 0 && <> · <strong className="text-slate-800">{rosterCounts.neverStarted}</strong> nog niet gestart</>}
                            {rosterCounts.notOnboarded > 0 && <> · <strong className="text-slate-800">{rosterCounts.notOnboarded}</strong> onboarding niet afgerond</>}
                        </div>
                    )}

                    {studentSummaries.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {studentSummaries.map((student) => (
                        <div
                            key={student.email}
                            className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
                        >
                            <div
                                className="p-4 cursor-pointer hover:bg-slate-50 transition"
                                onClick={() => setExpandedStudent(expandedStudent === student.email ? null : student.email)}
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="font-semibold text-slate-800 flex items-center gap-2">
                                            {student.name}
                                            {student.isStruggling && (
                                                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full" title="Gem. score < 50%">
                                                    ⚠️ Hulp nodig
                                                </span>
                                            )}
                                            {student.isInactive && (
                                                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full" title="7+ dagen inactief">
                                                    💤 Inactief
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-400">{student.email}</div>
                                    </div>
                                    <div className={`text-2xl font-bold ${student.avgScore >= 70 ? 'text-green-600' : student.avgScore >= 50 ? 'text-orange-500' : 'text-red-500'}`}>
                                        {student.avgScore}%
                                    </div>
                                </div>
                                <div className="flex gap-4 mt-3 text-sm text-slate-500">
                                    <span>📝 {student.totalSessions} sessies</span>
                                    <span>🕐 {format(student.lastActive, 'd MMM', { locale: nl })}</span>
                                </div>
                            </div>

                            {/* Expanded — twee secties: lijst-voortgang (NIEUW) + laatste sessies */}
                            {expandedStudent === student.email && (() => {
                                const listProgress = getStudentListProgress(student.sessions);
                                return (
                                    <div className="border-t border-slate-100 bg-slate-50 p-3 max-h-96 overflow-y-auto space-y-3">
                                        {/* Per-lijst voortgang */}
                                        {listProgress.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                    📚 Voortgang per lijst
                                                </p>
                                                {listProgress.map((p) => (
                                                    <div key={p.label} className="bg-white rounded-lg border border-slate-200 p-2.5">
                                                        <div className="flex items-center justify-between gap-2 mb-1.5">
                                                            <span className="text-xs font-semibold text-slate-700 truncate" title={p.label}>
                                                                {p.label}
                                                            </span>
                                                            <span className="text-[10px] font-mono shrink-0 text-slate-500">
                                                                {p.totalCount !== null
                                                                    ? `${p.practicedCount}/${p.totalCount}`
                                                                    : `${p.practicedCount} / ?`}
                                                            </span>
                                                        </div>
                                                        {p.progressPercent !== null ? (
                                                            <>
                                                                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full transition-all"
                                                                        style={{
                                                                            width: `${p.progressPercent}%`,
                                                                            background: p.progressPercent >= 100
                                                                                ? 'linear-gradient(90deg, #a855f7 0%, #ec4899 100%)'
                                                                                : 'linear-gradient(90deg, #14b8a6 0%, #10b981 100%)',
                                                                        }}
                                                                    />
                                                                </div>
                                                                <p className="text-[10px] text-slate-400 mt-1">
                                                                    {p.progressPercent >= 100
                                                                        ? '✨ Volledig doorlopen'
                                                                        : `${p.progressPercent}% geoefend`}
                                                                </p>
                                                            </>
                                                        ) : (
                                                            <p className="text-[10px] text-slate-400 italic">
                                                                Lijst-grootte onbekend (oude sessies van vóór 28 mei 2026)
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Laatste 5 sessies */}
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                                🗓️ Laatste sessies
                                            </p>
                                            {student.sessions.slice(0, 5).map(s => (
                                                <div key={s.id} className="flex justify-between text-xs py-1.5 border-b border-slate-100 last:border-0">
                                                    <span className="text-slate-500">{format(new Date(s.completed_at), 'd MMM HH:mm', { locale: nl })}</span>
                                                    <span className="text-slate-600 truncate mx-2 flex-1">{s.file_name || s.context}</span>
                                                    <span className={`font-medium ${(s.score / s.total_questions) >= 0.7 ? 'text-green-600' : 'text-orange-500'}`}>
                                                        {s.score}/{s.total_questions}
                                                    </span>
                                                </div>
                                            ))}
                                            {student.sessions.length > 5 && (
                                                <div className="text-xs text-slate-400 text-center pt-2">
                                                    + {student.sessions.length - 5} meer sessies
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    ))}
                    </div>
                    )}

                    {/* Leerlingen zonder activiteit in deze periode — de "ontbrekende"
                        leerlingen. Compacte kaart met status. (Onderdeel D) */}
                    {inactiveStudents.length > 0 && (
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                Nog geen activiteit{periodNoun ? ` ${periodNoun}` : ''} ({inactiveStudents.length})
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {inactiveStudents.map(s => (
                                    <div key={s.id} className="bg-white/70 rounded-xl border border-dashed border-slate-200 p-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="font-semibold text-slate-700 truncate">{s.name}</div>
                                                <div className="text-xs text-slate-400 truncate">{s.email || '—'}</div>
                                            </div>
                                            {s.klas && (
                                                <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{s.klas}</span>
                                            )}
                                        </div>
                                        <div className="mt-3 text-xs">
                                            {!s.onboarded ? (
                                                <span className="text-orange-600">🚧 Onboarding niet afgerond</span>
                                            ) : s.totalSessions === 0 ? (
                                                <span className="text-slate-500">💤 Nog geen sessie afgewerkt</span>
                                            ) : (
                                                <span className="text-slate-500">
                                                    🕐 Laatst actief {s.lastActive ? format(s.lastActive, 'd MMM', { locale: nl }) : '—'} · {s.totalSessions} sessie{s.totalSessions === 1 ? '' : 's'} totaal
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {allStudents.length === 0 && studentSummaries.length === 0 && (
                        <div className="py-12">
                            {emptyStateContent}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TeacherDashboard;
