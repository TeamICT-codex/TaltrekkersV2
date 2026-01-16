
// import { Database } from '../types_db';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase URL of Key ontbreekt. Check je .env.local bestand.');
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '');
