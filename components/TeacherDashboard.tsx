
import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
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

interface DashboardProps {
    onBack: () => void;
}

const TeacherDashboard: React.FC<DashboardProps> = ({ onBack }) => {
    const { role } = useAuth();
    const [sessions, setSessions] = useState<SessionWithProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchSessions = async () => {
            try {
                // Fetch sessies en join met profiles om naam/email te hebben
                // Supabase join syntax: select('*, profiles(email, full_name)')
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

                // Type casting omdat Supabase joins soms lastig zijn met Typescript types
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

    const formatDuration = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}m ${secs}s`;
    };

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tal-purple"></div>
        </div>
    );

    return (
        <div className="animate-fade-in max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
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

            {error ? (
                <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl">
                    ⛔ {error}
                </div>
            ) : (
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
                                {sessions.map((session) => (
                                    <tr key={session.id} className="hover:bg-slate-50/50 transition">
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                                            {format(new Date(session.completed_at), "d MMM yyyy HH:mm", { locale: nl })}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-800">
                                                {session.profiles.full_name || 'Naamloos'}
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
                                {sessions.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                            Nog geen oefeningen gemaakt door leerlingen.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeacherDashboard;
