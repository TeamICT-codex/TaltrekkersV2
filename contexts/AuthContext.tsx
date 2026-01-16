
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    role: string | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    role: null,
    loading: true,
    signOut: async () => { }
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAndSyncRole = async (currentUser: User) => {
            // Check of de gebruiker via leerkrachtcode is ingelogd
            const requestedRole = currentUser.user_metadata?.requested_role;

            // Haal huidige rol op uit database
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', currentUser.id)
                .single();

            // Als gebruiker 'teacher' heeft aangevraagd EN we hebben nog geen teacher-rol
            if (requestedRole === 'teacher' && profile?.role !== 'teacher') {
                // Update de rol naar teacher
                await supabase
                    .from('profiles')
                    .update({ role: 'teacher' })
                    .eq('id', currentUser.id);

                setRole('teacher');
                console.log('✅ Rol bijgewerkt naar teacher');
            } else {
                setRole(profile?.role || 'student');
            }
        };

        // 1. Haal de huidige sessie op bij start
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) fetchAndSyncRole(session.user);
            setLoading(false);
        });

        // 2. Luister naar veranderingen (inloggen/uitloggen)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchAndSyncRole(session.user);
            } else {
                setRole(null);
            }
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ session, user, role, loading, signOut }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
