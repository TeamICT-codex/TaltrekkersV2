
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format, isToday, isThisWeek, differenceInDays } from 'date-fns';
import { nl } from 'date-fns/locale';

interface SessionWithProfile {
    id: string;
    score: number;
    total_questions: number;
    duration_seconds: number;
    completed_at: string;
    context: string;
    file_name: string | null;
    profiles: {
        full_name: string | null;
        email: string;
    };
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
}

interface DashboardProps {
    onBack: () => void;
}

type DateFilter = 'today' | 'week' | 'all';
type ViewMode = 'sessions' | 'students';

const TeacherDashboard: React.FC<DashboardProps> = ({ onBack }) => {
    const { role } = useAuth();
    const [sessions, setSessions] = useState<SessionWithProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dateFilter, setDateFilter] = useState<DateFilter>('today');
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [viewMode, setViewMode] = useState<ViewMode>('sessions');
    const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

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
                        profiles (
                            email,
                            full_name
                        )
                    `)
                    .order('completed_at', { ascending: false });

                if (error) throw error;
                setSessions(data as unknown as SessionWithProfile[]);
            } catch (err: any) {
                console.error("Fout bij ophalen sessies:", err);
                setError("Kon data niet ophalen. Ben je zeker dat je leerkracht bent?");
            } finally {
                setLoading(false);
            }
        };

        if (role === 'teacher') {
            fetchSessions();
        } else {
            setLoading(false);
            setError("Geen toegang: Je bent ingelogd als student.");
        }
    }, [role]);

    // Get unique categories
    const categories = useMemo(() => {
        const cats = new Set(sessions.map(s => s.file_name || s.context));
        return ['all', ...Array.from(cats)];
    }, [sessions]);

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

            return matchesDate && matchesSearch && matchesCategory;
        });
    }, [sessions, dateFilter, searchQuery, categoryFilter]);

    // Statistics
    const stats = useMemo(() => {
        const uniqueStudents = new Set(filteredSessions.map(s => s.profiles.email));
        const totalScore = filteredSessions.reduce((sum, s) => sum + s.score, 0);
        const totalQuestions = filteredSessions.reduce((sum, s) => sum + s.total_questions, 0);
        const avgPercent = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;

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
            const avgScore = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;
            const lastActive = new Date(Math.max(...studentSessions.map(s => new Date(s.completed_at).getTime())));
            const daysInactive = differenceInDays(new Date(), lastActive);

            return {
                email,
                name: studentSessions[0].profiles.full_name || email.split('@')[0],
                sessions: studentSessions,
                totalSessions: studentSessions.length,
                avgScore,
                lastActive,
                isInactive: daysInactive >= 7,
                isStruggling: avgScore < 50
            };
        }).sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime());
    }, [filteredSessions]);

    const formatDuration = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}m ${secs}s`;
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
                                    <th className="px-6 py-4">Datum</th>
                                    <th className="px-6 py-4">Leerling</th>
                                    <th className="px-6 py-4">Oefening</th>
                                    <th className="px-6 py-4">Score</th>
                                    <th className="px-6 py-4">Tijd</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredSessions.map((session) => (
                                    <tr key={session.id} className="hover:bg-slate-50/50 transition">
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
                                ))}
                                {filteredSessions.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                            Geen oefeningen gevonden met deze filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* STUDENTS VIEW */
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

                            {/* Expanded sessions */}
                            {expandedStudent === student.email && (
                                <div className="border-t border-slate-100 bg-slate-50 p-3 max-h-48 overflow-y-auto">
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
                            )}
                        </div>
                    ))}
                    {studentSummaries.length === 0 && (
                        <div className="col-span-full text-center py-12 text-slate-400">
                            Geen leerlingen gevonden met deze filters.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TeacherDashboard;
