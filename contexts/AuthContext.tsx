
import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { updateProfileKlas, updateProfileKlasInfo, updateProfileNativeLanguage, upgradeToTeacher as upgradeToTeacherService } from '../services/db';
import { Finaliteit, Jaargang } from '../types';
import { User, Session } from '@supabase/supabase-js';

// Verouderde sleutels van een vroegere flow. Ze werden nergens meer gezet, maar
// wie ze zelf in localStorage zette kon zo zijn rol of naam laten aanpassen.
// We lezen ze niet meer; bij uitloggen ruimen we eventuele restjes op.
const LEGACY_KEYS = ['taltrekkers_teacher_pending', 'taltrekkers_pending_name'];
export const SELECTED_STUDENT_KEY = 'taltrekkers_selected_student';

// Toegestane email-domeinen voor zowel magic-link als Microsoft OAuth.
// Tenant 'Het leercollectief' bevat beide domeinen — leerlingen krijgen
// typisch een @gotalok.be account, leerkrachten/coördinatoren soms ook
// @hetleercollectief.be. Client-side vangnet — definitieve tenant-lock
// gebeurt server-side in Supabase Dashboard → Authentication → Providers
// → Azure (tenant URL = login.microsoftonline.com/{TENANT_ID}/v2.0).
// GO! Mira (gomira.be) heeft geen Microsoft-tenant: daar enkel de e-maillink.
//
// Override via env: VITE_ALLOWED_EMAIL_DOMAINS=domein1,domein2,...
// Legacy: VITE_ALLOWED_EMAIL_DOMAIN (singular) blijft werken voor backwards-compat.
export const ALLOWED_EMAIL_DOMAINS: string[] = (
    (import.meta.env.VITE_ALLOWED_EMAIL_DOMAINS as string | undefined)
    || (import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN as string | undefined)
    || 'gotalok.be,hetleercollectief.be,gomira.be'
).toLowerCase().split(',').map(s => s.trim()).filter(Boolean);

/** True als email eindigt op één van de toegestane domeinen. */
export const isEmailDomainAllowed = (email: string | null | undefined): boolean => {
    if (!email) return false;
    const lower = email.toLowerCase();
    return ALLOWED_EMAIL_DOMAINS.some(domain => lower.endsWith(`@${domain}`));
};

/** De zin bij een account van een school (of een adres) die niet meedoet. */
export const MELDING_ANDER_DOMEIN = 'Dit adres hoort niet bij een school die meedoet. Meld je aan met het e-mailadres van je school.';

/** Mens-leesbare lijst voor foutmeldingen: "@gotalok.be of @hetleercollectief.be" */
export const formatAllowedDomains = (): string =>
    ALLOWED_EMAIL_DOMAINS.map(d => `@${d}`).join(' of ');

// ── Afmelden met een vangnet (hotfix EIGEN-E1) ─────────────────────────────
// supabase.auth.signOut() wist de sessie NIET als het verzoek mislukt (netwerk,
// serverfout): het geeft enkel { error } terug. Hangt het verzoek, dan komt er
// nooit een antwoord. Op een gedeeld toestel bleef de volgende leerling zo in het
// account van de vorige. Daarom: hoogstens AFMELD_TIJDSLIMIET_MS wachten, en lukte
// het niet, dan de aanmelding op dit toestel zelf wissen en dat ook zeggen.
// Zelfde sleutels en tijdslimiet als 2.0 (v2/features/auth/signOut.ts).

/** Zo lang wachten we hoogstens op het afmeldverzoek. */
export const AFMELD_TIJDSLIMIET_MS = 5_000;

/** De sleutels waarin supabase-js de aanmelding bewaart: sb-<project>-auth-token, met -code-verifier en -user. */
export const AANMELD_SLEUTEL = /^sb-.+-auth-token(-code-verifier|-user)?$/;

/** De zin als het afmelden bij de server niet lukte. Nooit doen alsof het lukte. */
export const MELDING_AFMELDEN_MISLUKT = 'Afmelden bij de server lukte niet. Op dit toestel ben je wel afgemeld.';

export type AfmeldUitkomst = 'gelukt' | 'fout' | 'tijdslimiet';

/**
 * Na een afmeldpoging: welke sleutels moeten op dit toestel weg, en welke zin tonen we?
 * Gelukt: niets (supabase-js wiste de sessie zelf). Een fout, een serverfout of geen antwoord:
 * elke aanmeldsleutel die er nog staat, en de zin. Zuiver: krijgt de sleutels van localStorage.
 */
export function afmeldBeslissing(uitkomst: AfmeldUitkomst, sleutels: readonly string[]): { wissen: string[]; melding: string | null } {
    if (uitkomst === 'gelukt') return { wissen: [], melding: null };
    return { wissen: sleutels.filter(k => AANMELD_SLEUTEL.test(k)), melding: MELDING_AFMELDEN_MISLUKT };
}

/** Afmeldverzoek met tijdslimiet. Gooit nooit. */
async function afmeldenMetTijdslimiet(): Promise<AfmeldUitkomst> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tijdslimiet = new Promise<AfmeldUitkomst>(ok => { timer = setTimeout(() => ok('tijdslimiet'), AFMELD_TIJDSLIMIET_MS); });
    try {
        return await Promise.race([
            supabase.auth.signOut().then(({ error }): AfmeldUitkomst => (error ? 'fout' : 'gelukt'), (): AfmeldUitkomst => 'fout'),
            tijdslimiet,
        ]);
    } finally {
        clearTimeout(timer);
    }
}

/** Afmelden; lukte het niet, dan de aanmelding op dit toestel wissen. Geeft de zin terug (null = gelukt). */
async function afmeldenMetVangnet(): Promise<string | null> {
    const uitkomst = await afmeldenMetTijdslimiet();
    let sleutels: string[] = [];
    try {
        sleutels = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter((k): k is string => k !== null);
    } catch { /* geen localStorage: supabase-js bewaarde de sessie enkel in het geheugen */ }
    const { wissen, melding } = afmeldBeslissing(uitkomst, sleutels);
    for (const k of wissen) {
        try { localStorage.removeItem(k); } catch { /* niets meer aan te doen */ }
    }
    if (melding) console.warn(`Afmelden bij de server mislukt (${uitkomst}); ${wissen.length} aanmeldsleutel(s) op dit toestel gewist.`);
    return melding;
}

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
    signInWithMicrosoft: () => Promise<{ success: boolean; error?: string }>;
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
    signInWithMicrosoft: async () => ({ success: false }),
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
                // Rol en naam worden NOOIT vanuit de browser gezet. Leerkracht worden
                // kan enkel via de server-side RPC upgrade_to_teacher (leerkrachtcode).
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

        // Email-extractie: Microsoft OAuth zet de echte school-email niet altijd op
        // `currentUser.email`. Bij Azure-tokens uit Het Leercollectief tenant zit
        // het soms in `user_metadata.email`, `preferred_username` (UPN-format), of
        // `upn`. We proberen alle bekende locaties; eerste hit met een geldig email
        // (bevat '@') wint. Lowercase voor consistente domein-check.
        const extractUserEmail = (currentUser: User): string => {
            const meta = (currentUser.user_metadata ?? {}) as Record<string, unknown>;
            const candidates: Array<unknown> = [
                currentUser.email,
                meta.email,
                meta.preferred_username,
                meta.upn,
            ];
            const found = candidates.find(
                (c): c is string => typeof c === 'string' && c.includes('@')
            );
            return (found ?? '').toLowerCase();
        };

        // Domain enforcement: alleen accounts uit ALLOWED_EMAIL_DOMAINS mogen door.
        // Wordt zowel toegepast op Microsoft OAuth callback als magic-link callback.
        // Bij mismatch: signOut + foutmelding tonen via authError state.
        // Belangrijke veiligheidslaag: Supabase Azure-provider laat alle users uit
        // de tenant toe (Het Leercollectief = meerdere domeinen). Wij beperken hier
        // tot de scholen die meedoen (ALLOWED_EMAIL_DOMAINS).
        const enforceEmailDomain = async (currentUser: User): Promise<boolean> => {
            const email = extractUserEmail(currentUser);
            // Diagnose-log — ook zichtbaar in productie zodat we bij login-issues
            // direct zien wat Supabase als email aanlevert. Zonder dit kwamen we
            // het Dries-issue (email in metadata i.p.v. currentUser.email) niet
            // op het spoor. Niet privacy-gevoelig: email staat al in browser memory.
            console.log('[TalentVoorTaal Auth]', {
                extractedEmail: email,
                allowedDomains: ALLOWED_EMAIL_DOMAINS,
                passes: isEmailDomainAllowed(email),
                rawUser: {
                    id: currentUser.id,
                    email: currentUser.email,
                    metadata: currentUser.user_metadata,
                },
            });
            if (!isEmailDomainAllowed(email)) {
                console.warn(`Login geweigerd: "${email}" valt niet binnen toegestane domeinen (${ALLOWED_EMAIL_DOMAINS.join(', ')})`);
                setAuthError(MELDING_ANDER_DOMEIN);
                // NIET wachten op de afmelding (hotfix "leeg scherm"). Deze functie loopt ook
                // binnen de callback van onAuthStateChange, en bij het opstarten wacht supabase-js
                // op die callback (SIGNED_IN uit de bewaarde sessie). signOut() wacht op zijn beurt
                // op dat opstarten: met een await bleef alles hangen (loading altijd true, een
                // lege pagina, en de sessie bleef staan voor iedereen op dat toestel).
                setTimeout(() => { void afmeldenMetVangnet(); }, 0);
                return false;
            }
            return true;
        };

        // Reageren op auth events
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            // Een geweigerd account geldt bij geen enkel event als aangemeld (ook niet bij
            // INITIAL_SESSION of TOKEN_REFRESHED, die nog komen vóór de afmelding rond is).
            if (session?.user) {
                const allowed = event === 'SIGNED_IN'
                    ? await enforceEmailDomain(session.user)
                    : isEmailDomainAllowed(extractUserEmail(session.user));
                if (!allowed) {
                    setSession(null);
                    setUser(null);
                    setLoading(false);
                    return;
                }
            }

            setSession(session);
            setUser(session?.user ?? null);

            if (event === 'SIGNED_IN' && session?.user) {
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
            if (session?.user && !(await enforceEmailDomain(session.user))) {
                setSession(null);
                setUser(null);
                setLoading(false);
                return;
            }
            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
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

    /**
     * Start Microsoft Entra ID (Azure AD) OAuth flow via Supabase.
     *
     * Configuratie vereist in Supabase Dashboard → Authentication → Providers → Azure:
     *   - Enabled: true
     *   - Client ID + Client Secret van de Entra app-registration
     *   - Azure Tenant URL: https://login.microsoftonline.com/{TENANT_ID}/v2.0
     *
     * In de Entra app-registration (door admin / Dries):
     *   - Redirect URI: https://<supabase-project>.supabase.co/auth/v1/callback
     *   - API permissions: openid, profile, email (delegated)
     *
     * Vlow: browser → Supabase → Microsoft → Supabase callback → terug naar app
     * met sessie. `onAuthStateChange` vangt 'SIGNED_IN' op en `enforceEmailDomain`
     * blokkeert eventuele tenant-users buiten onze toegestane domeinen.
     *
     * prompt: 'select_account' dwingt account-picker — handig wanneer een gebruiker
     * meerdere MS-accounts heeft (privé + school).
     */
    const signInWithMicrosoft = useCallback(async () => {
        clearAuthError();
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'azure',
                options: {
                    scopes: 'openid profile email',
                    queryParams: { prompt: 'select_account' },
                    // redirectTo niet expliciet zetten — Supabase gebruikt Site URL,
                    // dat is configureerbaar in dashboard zonder code-change nodig.
                },
            });
            if (error) {
                // Meestal: "Unsupported provider: provider is not enabled"
                // wanneer Azure-provider nog niet aanstaat in Supabase dashboard.
                const friendly = /not enabled|unsupported provider/i.test(error.message)
                    ? 'Microsoft-login is nog niet geactiveerd. Vraag de beheerder om Azure provider aan te zetten in Supabase, of gebruik je schoolmail om in te loggen.'
                    : `Microsoft-login mislukte: ${error.message}`;
                setAuthError(friendly);
                return { success: false, error: friendly };
            }
            // signInWithOAuth redirect de browser zelf — code hieronder loopt
            // typisch niet meer, behalve in popup-modes (die wij niet gebruiken).
            return { success: true };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Onbekende fout bij Microsoft-login.';
            setAuthError(msg);
            return { success: false, error: msg };
        }
    }, [clearAuthError]);

    const signOut = useCallback(async () => {
        LEGACY_KEYS.forEach(k => localStorage.removeItem(k));
        clearSelectedStudent();
        setKlasState(null);
        setFinaliteitState(null);
        setJaargangState(null);
        setNativeLanguageState(null);
        setAuthError(null);
        const melding = await afmeldenMetVangnet();
        if (melding) {
            // Het afmeldverzoek lukte niet: de aanmelding op dit toestel is gewist
            // (supabase-js meldt dan geen SIGNED_OUT), dus de app zelf afmelden en het zeggen.
            setSession(null);
            setUser(null);
            setRole(null);
            setAuthError(melding);
        }
    }, [clearSelectedStudent]);

    return (
        <AuthContext.Provider value={{ session, user, role, klas, finaliteit, jaargang, nativeLanguage, loading, selectedStudent, authError, selectStudent, clearSelectedStudent, clearAuthError, setKlas, setKlasInfo, setNativeLanguage, upgradeToTeacher, signInWithMicrosoft, signOut }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
