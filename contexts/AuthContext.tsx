
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabase';
import { User, Session } from '@supabase/supabase-js';

const TEACHER_PENDING_KEY = 'taltrekkers_teacher_pending';
const NAME_PENDING_KEY = 'taltrekkers_pending_name';

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

    // Voorkom dubbele verwerking
    const isProcessingRef = useRef(false);

    useEffect(() => {
        const processUserProfile = async (currentUser: User) => {
            // Voorkom dubbele verwerking
            if (isProcessingRef.current) {
                console.log('⏳ Already processing, skipping...');
                return;
            }
            isProcessingRef.current = true;

            try {
                const pendingTeacherEmail = localStorage.getItem(TEACHER_PENDING_KEY);
                const userEmail = currentUser.email?.toLowerCase();

                console.log('🔍 DEBUG - Processing user profile:');
                console.log('   Pending teacher email:', pendingTeacherEmail);
                console.log('   User email:', userEmail);

                // Check of dit een teacher upgrade is
                if (pendingTeacherEmail && userEmail === pendingTeacherEmail) {
                    console.log('🎓 Teacher code was used! Updating role...');
                    localStorage.removeItem(TEACHER_PENDING_KEY);

                    const { data, error: updateError } = await supabase
                        .from('profiles')
                        .update({ role: 'teacher' })
                        .eq('id', currentUser.id)
                        .select();

                    console.log('📝 Update result:', { data, error: updateError });

                    if (!updateError) {
                        console.log('✅ Rol succesvol bijgewerkt naar teacher!');
                        setRole('teacher');
                    }
                }

                // Check of er een pending name is om op te slaan
                const pendingName = localStorage.getItem(NAME_PENDING_KEY);
                if (pendingName) {
                    console.log('📝 Saving pending name to profile:', pendingName);
                    localStorage.removeItem(NAME_PENDING_KEY);

                    const { error: nameError } = await supabase
                        .from('profiles')
                        .update({ full_name: pendingName })
                        .eq('id', currentUser.id);

                    if (!nameError) {
                        console.log('✅ Naam succesvol opgeslagen!');
                    } else {
                        console.error('❌ Fout bij opslaan naam:', nameError);
                    }
                }

                // Haal huidige rol op uit database
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', currentUser.id)
                    .single();

                console.log('👤 Profile from DB:', profile, 'Error:', error);
                setRole(profile?.role || 'student');

            } finally {
                isProcessingRef.current = false;
            }
        };

        // Reageren op auth events
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('🔔 Auth event:', event);

            setSession(session);
            setUser(session?.user ?? null);

            if (event === 'SIGNED_IN' && session?.user) {
                console.log('✨ SIGNED_IN detected, processing...');
                processUserProfile(session.user);
            } else if (event === 'SIGNED_OUT') {
                setRole(null);
            } else if (session?.user) {
                supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single()
                    .then(({ data }) => {
                        setRole(data?.role || 'student');
                    });
            }

            setLoading(false);
        });

        // Initial session check
        supabase.auth.getSession().then(({ data: { session } }) => {
            console.log('🚀 Initial session check:', session?.user?.email);
            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                const pending = localStorage.getItem(TEACHER_PENDING_KEY);
                if (pending) {
                    processUserProfile(session.user);
                } else {
                    supabase
                        .from('profiles')
                        .select('role')
                        .eq('id', session.user.id)
                        .single()
                        .then(({ data }) => {
                            setRole(data?.role || 'student');
                        });
                }
            }
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signOut = async () => {
        localStorage.removeItem(TEACHER_PENDING_KEY);
        localStorage.removeItem(NAME_PENDING_KEY);
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ session, user, role, loading, signOut }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
