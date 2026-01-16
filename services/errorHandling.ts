
// Error handling utilities for TALtrekkers

export type ErrorCategory =
    | 'network'      // Geen internet
    | 'api_limit'    // Rate limit of quota overschreden
    | 'api_error'    // AI generatie mislukt
    | 'parse_error'  // Ongeldige JSON response
    | 'file_error'   // Bestandslees fout
    | 'unknown';

export interface AppError {
    category: ErrorCategory;
    message: string;           // User-friendly bericht in het Nederlands
    suggestion: string;        // Wat kan de gebruiker doen?
    technicalDetails?: string; // Voor logging/debugging
    canRetry: boolean;
}

// Error berichten per categorie
const ERROR_MESSAGES: Record<ErrorCategory, { message: string; suggestion: string; canRetry: boolean }> = {
    network: {
        message: 'Geen internetverbinding',
        suggestion: 'Controleer je wifi of mobiele data en probeer het opnieuw.',
        canRetry: true
    },
    api_limit: {
        message: 'De AI is tijdelijk overbelast',
        suggestion: 'Wacht even en probeer het over een minuutje opnieuw.',
        canRetry: true
    },
    api_error: {
        message: 'De AI kon de opdracht niet voltooien',
        suggestion: 'Dit kan gebeuren bij complexe teksten. Probeer met minder woorden of een kortere tekst.',
        canRetry: true
    },
    parse_error: {
        message: 'Er ging iets mis bij het verwerken van de data',
        suggestion: 'Probeer het opnieuw. Als het probleem aanhoudt, kies dan andere woorden.',
        canRetry: true
    },
    file_error: {
        message: 'Kon het bestand niet lezen',
        suggestion: 'Controleer of het bestand niet beschadigd is en probeer een ander bestandsformaat (.pdf, .docx, .xlsx).',
        canRetry: false
    },
    unknown: {
        message: 'Er is een onverwachte fout opgetreden',
        suggestion: 'Probeer het opnieuw of herlaad de pagina.',
        canRetry: true
    }
};

// Iconen per categorie
export const ERROR_ICONS: Record<ErrorCategory, string> = {
    network: '📡',
    api_limit: '⏳',
    api_error: '⚠️',
    parse_error: '🔧',
    file_error: '📄',
    unknown: '❓'
};

/**
 * Categoriseer een error op basis van de foutmelding of type
 */
export const categorizeError = (error: unknown, context?: string): AppError => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorLower = errorMessage.toLowerCase();

    let category: ErrorCategory = 'unknown';

    // Network errors
    if (
        errorLower.includes('network') ||
        errorLower.includes('fetch') ||
        errorLower.includes('failed to fetch') ||
        errorLower.includes('net::err') ||
        !navigator.onLine
    ) {
        category = 'network';
    }
    // Rate limit / quota errors
    else if (
        errorLower.includes('rate limit') ||
        errorLower.includes('quota') ||
        errorLower.includes('429') ||
        errorLower.includes('too many requests') ||
        errorLower.includes('overbelast')
    ) {
        category = 'api_limit';
    }
    // Parse errors
    else if (
        errorLower.includes('json') ||
        errorLower.includes('parse') ||
        errorLower.includes('unexpected token') ||
        errorLower.includes('syntax')
    ) {
        category = 'parse_error';
    }
    // File errors
    else if (
        errorLower.includes('file') ||
        errorLower.includes('bestand') ||
        errorLower.includes('read') ||
        errorLower.includes('lezen')
    ) {
        category = 'file_error';
    }
    // API errors (generiek)
    else if (
        errorLower.includes('api') ||
        errorLower.includes('genereren') ||
        errorLower.includes('generate') ||
        errorLower.includes('500') ||
        errorLower.includes('503')
    ) {
        category = 'api_error';
    }

    const baseError = ERROR_MESSAGES[category];

    return {
        category,
        message: baseError.message,
        suggestion: baseError.suggestion,
        technicalDetails: context ? `${context}: ${errorMessage}` : errorMessage,
        canRetry: baseError.canRetry
    };
};

/**
 * Maak een AppError van een specifieke categorie
 */
export const createAppError = (
    category: ErrorCategory,
    technicalDetails?: string
): AppError => {
    const baseError = ERROR_MESSAGES[category];
    return {
        category,
        ...baseError,
        technicalDetails
    };
};
