
import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { updateProfileKlas, updateProfileKlasInfo, updateProfileNativeLanguage, upgradeToTeacher as upgradeToTeacherService } from '../services/db';
import { Finaliteit, Jaargang } from '../types';
import { User, Session } from '@supabase/supabase-js';

const TEACHER_PENDING_KEY = 'taltrekkers_teacher_pending';
const NAME_PENDING_KEY = 'taltrekkers_pending_name';
export const SELECTED_STUDENT_KEY = 'taltrekkers_selected_student';

// Alleen MS-accounts uit dit domein zijn toegestaan voor leerlingen.
// Client-side vangnet — definitieve tenant-lock gebeurt server-side in
// Supabase Dashboard → Authentication → Providers → Azure (tenant URL).
const ALLOWED_EMAIL_DOMAIN = (
    (import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN as string | undefined) || 'gotalok.be'
).toLowerCase();

/**
 * Derive een nette display-naam uit email: "thomas.aelbrecht@gotalok.be" → "Thomas Aelbrecht".
 * Wordt gebruikt als fallback wanneer profile.full_name (nog) leeg is, zodat de UI
 * nooit een ruwe email als naam toont.
 */
const deriveDisplayName = (email: string | null | undefined): string => {
    if (!email) return '';
    const prefix = email.split('@')[0];
    if (!prefix) return '';
    return prefix
        .split(/[._\s-]+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
};

export interface SelectedStudent {
    name: string;
    klas?: string;
}

interface AuthContextType {
    session: Session | null;
    user: User | null;
    role: string | null;
    klas: string | null;
    finaliteit: Finaliteit | null;
    jaargang: Jaargang | null;
    nativeLanguage: string | null;
    loading: boolean;
    selectedStudent: SelectedStudent | null;
    authError: string | null;
    selectStudent: (student: SelectedStudent) => void;
    clearSelectedStudent: () => void;
    clearAuthError: () => void;
    setKlas: (klas: string) => Promise<{ success: boolean; error?: string }>;
    setKlasInfo: (finaliteit: Finaliteit, jaargang: Jaargang) => Promise<{ success: boolean; error?: string }>;
    setNativeLanguage: (nativeLanguage: string) => Promise<{ success: boolean; error?: string }>;
    upgradeToTeacher: (code: string) => Promise<{ success: boolean; error?: string; alreadyTeacher?: boolean }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    role: null,
    klas: null,
    finaliteit: null,
    jaargang: null,
    nativeLanguage: null,
    loading: true,
    selectedStudent: null,
    authError: null,
    selectStudent: () => {},
    clearSelectedStudent: () => {},
    clearAuthError: () => {},
    setKlas: async () => ({ success: false }),
    setKlasInfo: async () => ({ success: false }),
    setNativeLanguage: async () => ({ success: false }),
    upgradeToTeacher: async () => ({ success: false }),
    signOut: async () => { }
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [klas, setKlasState] = useState<string | null>(null);
    const [finaliteit, setFinaliteitState] = useState<Finaliteit | null>(null);
    const [jaargang, setJaargangState] = useState<Jaargang | null>(null);
    const [nativeLanguage, setNativeLanguageState] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState<string | null>(null);

    const clearAuthError = useCallback(() => setAuthError(null), []);

    // Leerling-selectie (zonder Supabase auth — persisteert in localStorage)
    const [selectedStudent, setSelectedStudent] = useState<SelectedStudent | null>(() => {
        try {
            const stored = localStorage.getItem(SELECTED_STUDENT_KEY);
            return stored ? JSON.parse(stored) : null;
        } catch { return null; }
    });

    const selectStudent = useCallback((student: SelectedStudent) => {
        localStorage.setItem(SELECTED_STUDENT_KEY, JSON.stringify(student));
        setSelectedStudent(student);
    }, []);

    const clearSelectedStudent = useCallback(() => {
        localStorage.removeItem(SELECTED_STUDENT_KEY);
        setSelectedStudent(null);
    }, []);

    // Voorkom dubbele verwerking
    const isProcessingRef = useRef(false);

    useEffect(() => {
        const processUserProfile = async (currentUser: User) => {
            // Voorkom dubbele verwerking
            if (isProcessingRef.current) {
                return;
            }
            isProcessingRef.current = true;

            try {
                const pendingTeacherEmail = localStorage.getItem(TEACHER_PENDING_KEY);
                const userEmail = currentUser.email?.toLowerCase();

                // Check of dit een teacher upgrade is
                if (pendingTeacherEmail && userEmail === pendingTeacherEmail) {
                    localStorage.removeItem(TEACHER_PENDING_KEY);

                    const { error: updateError } = await supabase
                        .from('profiles')
                        .update({ role: 'teacher' })
                        .eq('id', currentUser.id)
                        .select();

                    if (!updateError) {
                        setRole('teacher');
                    }
                }

                // Check of er een pending name is om op te slaan
                const pendingName = localStorage.getItem(NAME_PENDING_KEY);
                if (pendingName) {
                    localStorage.removeItem(NAME_PENDING_KEY);

                    const { error: nameError } = await supabase
                        .from('profiles')
                        .update({ full_name: pendingName })
                        .eq('id', currentUser.id);

                    if (nameError) {
                        console.error('Fout bij opslaan naam:', nameError);
                    }
                }

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role, full_name, klas, finaliteit, jaargang, native_language')
                    .eq('id', currentUser.id)
                    .single();

                setRole(profile?.role || 'student');
                setKlasState(profile?.klas ?? null);
                setFinaliteitState((profile?.finaliteit as Finaliteit | null) ?? null);
                setJaargangState((profile?.jaargang as Jaargang | null) ?? null);
                setNativeLanguageState(profile?.native_language ?? null);

                // Sync selectedStudent met een mens-leesbare naam.
                // Volgorde: DB full_name → OAuth metadata → derived uit email → email zelf
                const displayName = profile?.full_name
                    || currentUser.user_metadata?.full_name
                    || deriveDisplayName(currentUser.email)
                    || currentUser.email;
                if (displayName) {
                    selectStudent({ name: displayName });
                }

            } finally {
                isProcessingRef.current = false;
            }
        };

        // Domain enforcement helper: alleen @gotalok.be accounts toegestaan.
        // Bij mismatch: signOut + foutmelding tonen via authError state.
        const enforceEmailDomain = async (currentUser: User): Promise<boolean> => {
            const email = currentUser.email?.toLowerCase() ?? '';
            if (!email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
                console.warn(`Login geweigerd: ${email} is geen @${ALLOWED_EMAIL_DOMAIN} account`);
                setAuthError(
                    `Alleen schoolaccounts (@${ALLOWED_EMAIL_DOMAIN}) zijn toegestaan. ` +
                    `Je bent uitgelogd — log opnieuw in met je Office 365-schoolaccount.`
                );
                await supabase.auth.signOut();
                return false;
            }
            return true;
        };

        // Reageren op auth events
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            setSession(session);
            setUser(session?.user ?? null);

            if (event === 'SIGNED_IN' && session?.user) {
                const allowed = await enforceEmailDomain(session.user);
                if (!allowed) { setLoading(false); return; }
                processUserProfile(session.user);
            } else if (event === 'SIGNED_OUT') {
                setRole(null);
            } else if (session?.user) {
                supabase
                    .from('profiles')
                    .select('role, full_name, klas, finaliteit, jaargang, native_language')
                    .eq('id', session.user.id)
                    .single()
                    .then(({ data }) => {
                        setRole(data?.role || 'student');
                        setKlasState(data?.klas ?? null);
                        setFinaliteitState((data?.finaliteit as Finaliteit | null) ?? null);
                        setJaargangState((data?.jaargang as Jaargang | null) ?? null);
                        setNativeLanguageState(data?.native_language ?? null);
                        const fallbackName = data?.full_name
                            || session.user.user_metadata?.full_name
                            || deriveDisplayName(session.user.email);
                        if (fallbackName) {
                            selectStudent({ name: fallbackName });
                        }
                    });
            }

            setLoading(false);
        });

        // Initial session check
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                const allowed = await enforceEmailDomain(session.user);
                if (!allowed) { setLoading(false); return; }

                const pending = localStorage.getItem(TEACHER_PENDING_KEY);
                if (pending) {
                    processUserProfile(session.user);
                } else {
                    supabase
                        .from('profiles')
                        .select('role, klas, finaliteit, jaargang, native_language')
                        .eq('id', session.user.id)
                        .single()
                        .then(({ data }) => {
                            setRole(data?.role || 'student');
                            setKlasState(data?.klas ?? null);
                            setFinaliteitState((data?.finaliteit as Finaliteit | null) ?? null);
                            setJaargangState((data?.jaargang as Jaargang | null) ?? null);
                            setNativeLanguageState(data?.native_language ?? null);
                        });
                }
            }
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const setKlas = useCallback(async (newKlas: string) => {
        if (!user) return { success: false, error: 'Niet ingelogd.' };
        const result = await updateProfileKlas(user.id, newKlas);
        if (result.success) {
            setKlasState(newKlas.trim() || null);
        }
        return result;
    }, [user]);

    const setKlasInfo = useCallback(async (newFinaliteit: Finaliteit, newJaargang: Jaargang) => {
        if (!user) return { success: false, error: 'Niet ingelogd.' };
        const result = await updateProfileKlasInfo(user.id, newFinaliteit, newJaargang);
        if (result.success) {
            setFinaliteitState(newFinaliteit);
            setJaargangState(newJaargang);
            setKlasState(`${newFinaliteit} ${newJaargang}`);
        }
        return result;
    }, [user]);

    const setNativeLanguage = useCallback(async (newNativeLanguage: string) => {
        if (!user) return { success: false, error: 'Niet ingelogd.' };
        const result = await updateProfileNativeLanguage(user.id, newNativeLanguage);
        if (result.success) {
            setNativeLanguageState(newNativeLanguage.trim() || null);
        }
        return result;
    }, [user]);

    const upgradeToTeacher = useCallback(async (code: string) => {
        if (!user) return { success: false, error: 'Niet ingelogd.' };
        const result = await upgradeToTeacherService(code);
        if (result.success) {
            // Sync local state — RPC heeft de DB al gewijzigd, lokale role moet bij
            setRole('teacher');
        }
        return result;
    }, [user]);

    const signOut = useCallback(async () => {
        localStorage.removeItem(TEACHER_PENDING_KEY);
        localStorage.removeItem(NAME_PENDING_KEY);
        clearSelectedStudent();
        setKlasState(null);
        setFinaliteitState(null);
        setJaargangState(null);
        setNativeLanguageState(null);
        setAuthError(null);
        await supabase.auth.signOut();
    }, [clearSelectedStudent]);

    return (
        <AuthContext.Provider value={{ session, user, role, klas, finaliteit, jaargang, nativeLanguage, loading, selectedStudent, authError, selectStudent, clearSelectedStudent, clearAuthError, setKlas, setKlasInfo, setNativeLanguage, upgradeToTeacher, signOut }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
