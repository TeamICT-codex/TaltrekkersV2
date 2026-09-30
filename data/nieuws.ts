/**
 * "Wat is er nieuw?" — wat leerlingen en leerkrachten merken van de wijzigingen.
 *
 * Nieuwste bovenaan. Schrijf in gewone taal, vanuit wie de app gebruikt: wat
 * er anders is en waarom, niet hoe het gebouwd is. Geen technische details
 * over beveiliging.
 *
 * Bij een nieuwe versie: een blok bovenaan toevoegen met de dag waarop ze live
 * gaat. Wie het venster nog niet opende sinds dat blok, ziet een gouden stipje
 * bij de knop (zie components/NieuwsButton.tsx).
 */

export type NieuwsSoort = 'nieuw' | 'verbeterd' | 'opgelost';

export interface NieuwsItem {
    soort: NieuwsSoort;
    tekst: string;
    /** Kwam uit een melding van een leerkracht of een klas. */
    uitDeKlas?: boolean;
}

export interface NieuwsBlok {
    /** JJJJ-MM-DD: de dag waarop de wijziging live ging. */
    datum: string;
    titel: string;
    items: NieuwsItem[];
}

export const NIEUWS: NieuwsBlok[] = [
    {
        // Datum = dag van livegang van de juiste oefentijd; pas aan bij het live zetten.
        datum: '2026-09-30',
        titel: 'De juiste oefentijd',
        items: [
            {
                soort: 'opgelost',
                tekst: 'De oefentijd per sessie in het leerkrachtendashboard telde de tijd van de quiz dubbel. Nieuwe sessies tonen nu de echte tijd; oudere sessies blijven iets te lang.',
            },
        ],
    },
    {
        // Datum = dag van livegang van de cache en de snellere start; pas aan bij het live zetten.
        datum: '2026-09-29',
        titel: 'Sneller aan de slag',
        items: [
            {
                soort: 'verbeterd',
                tekst: 'Je kan meteen beginnen met de woorden te bestuderen. De quizvragen worden intussen klaargemaakt, zodat je er niet meer op hoeft te wachten.',
            },
            {
                soort: 'verbeterd',
                tekst: 'Een woordkaart die al eens gemaakt werd, komt voortaan meteen uit een gedeelde opslag. Oefent een klasgenoot dezelfde lijst, dan staan de kaarten voor jou dus sneller klaar.',
            },
            {
                soort: 'opgelost',
                tekst: 'Op 29 september werkten de AI-functies een ochtend niet, omdat de maandlimiet bij Google bereikt was. Die limiet is opgetrokken.',
            },
        ],
    },
    {
        datum: '2026-09-25',
        titel: 'Een woordentuin in Sneek',
        items: [
            {
                soort: 'nieuw',
                tekst: 'Sneek heeft een nieuw spel: de woordentuin. Het vervangt het oude beloningsspel.',
            },
            {
                soort: 'verbeterd',
                tekst: 'Het geluid in Sneek staat standaard uit, en er zijn nog maar drie zachte signalen.',
            },
            {
                soort: 'opgelost',
                tekst: 'Oefen je op meer dan één toestel? Een oudere stand op het ene toestel overschrijft niet langer je nieuwere voortgang.',
            },
            {
                soort: 'opgelost',
                tekst: 'Had je de laatste quizvraag fout en rondde je snel af, dan ging die fout soms verloren. Nu telt elk antwoord mee.',
            },
            {
                soort: 'verbeterd',
                tekst: 'Achter de schermen zijn de accounts en de toegang tot de AI extra beveiligd.',
            },
        ],
    },
    {
        datum: '2026-09-21',
        titel: 'Een nieuw introscherm',
        items: [
            {
                soort: 'nieuw',
                tekst: "Vóór het aanmelden verschijnt een kort introscherm: het woord 'talent' als Frayer-model, zoals je ze ook in de app bestudeert.",
            },
        ],
    },
    {
        datum: '2026-09-18',
        titel: 'Minder haperingen bij een volle klas',
        items: [
            {
                soort: 'opgelost',
                tekst: "Startte een hele klas tegelijk, dan lukten soms niet alle woorden en verscheen de gele melding 'Niet alle woorden konden gegenereerd worden'. Dat is opgelost.",
            },
        ],
    },
    {
        datum: '2026-09-08',
        titel: 'De grote taalteller',
        items: [
            {
                soort: 'nieuw',
                tekst: 'Hoeveel oefende de hele school al samen? De grote taalteller toont het. Tik op het handje naast je naam in de welkomsttitel.',
            },
        ],
    },
    {
        datum: '2026-09-07',
        titel: 'Typen in een schrijfvraag',
        items: [
            {
                soort: 'opgelost',
                uitDeKlas: true,
                tekst: 'Bij een schrijfvraag kon je soms pas typen nadat je in het vak had geklikt. Het invulvak staat nu altijd meteen klaar.',
            },
        ],
    },
];

/** Datum van het nieuwste blok (JJJJ-MM-DD), of '' als er nog niets is. */
export const LAATSTE_NIEUWS_DATUM: string = NIEUWS[0]?.datum ?? '';
