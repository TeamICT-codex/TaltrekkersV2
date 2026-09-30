/**
 * Vangnet bij een nieuwe versie van de app.
 *
 * De app laadt sommige onderdelen pas wanneer ze nodig zijn (oefenscherm,
 * dashboards, aanmelden). Na een update bestaan de bestanden van de vorige versie
 * niet meer: een tabblad dat nog de oude versie draait, kan zo'n onderdeel dan niet
 * meer laden (Vercel stuurt de startpagina terug) en zou een leeg scherm tonen.
 * Vite meldt dat met het event `vite:preloadError`. Dan herladen we de pagina één
 * keer, zodat de leerling gewoon verdergaat in de nieuwe versie.
 *
 * Tegen een herlaadlus: gebeurt het binnen een minuut opnieuw, dan laten we de fout
 * door, want dan is er iets anders mis (bv. geen verbinding). Kan de tijd van het
 * vorige herladen niet bewaard worden, dan herladen we niet: liever een foutmelding
 * dan een lus.
 */
const SLEUTEL = 'taltrekkers_herladen_na_update';
const MIN_TUSSENTIJD_MS = 60_000;

export function installeerHerladenNaUpdate(): void {
    window.addEventListener('vite:preloadError', (event) => {
        try {
            const vorige = Number(sessionStorage.getItem(SLEUTEL)) || 0;
            if (Date.now() - vorige < MIN_TUSSENTIJD_MS) return;
            sessionStorage.setItem(SLEUTEL, String(Date.now()));
        } catch {
            return;
        }
        event.preventDefault();
        window.location.reload();
    });
}
