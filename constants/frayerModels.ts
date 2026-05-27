import { FrayerModelData } from '../types';

// This object acts as a cache for specific, high-quality Frayer Models.
// For these words, the app will NOT call the AI, but use this data directly.
// This is perfect for curriculum-specific, teacher-approved definitions.
const PREDEFINED_NEDERLANDS_ALGEMEEN: Record<string, FrayerModelData> = {
    // Woordsoorten
    'zelfstandig naamwoord': {
        definitie: "Duidt een persoon, dier, ding, plaats, gevoel of begrip aan.",
        voorbeelden: [{ zin: "De hond loopt in het park.", gebruiktWoord: "hond" }],
        synoniemen: ["substantief", "nomen"],
        antoniemen: [],
    },
    'bijvoeglijk naamwoord': {
        definitie: "Geeft een eigenschap of kenmerk van een zelfstandig naamwoord.",
        voorbeelden: [{ zin: "De grote hond blaft hard.", gebruiktWoord: "grote" }],
        synoniemen: ["adjectief", "attribuut"],
        antoniemen: [],
    },
    'werkwoord': {
        definitie: "Geeft een handeling, toestand of gebeurtenis aan.",
        voorbeelden: [{ zin: "Hij loopt naar school.", gebruiktWoord: "loopt" }],
        synoniemen: ["verbum", "actiewoord"],
        antoniemen: [],
    },
    'lidwoord': {
        definitie: "Komt vóór een zelfstandig naamwoord; bepaald (de, het) of onbepaald (een).",
        voorbeelden: [{ zin: "De kat slaapt op de bank.", gebruiktWoord: "De" }],
        synoniemen: ["artikel"],
        antoniemen: [],
    },
    'voorzetsel': {
        definitie: "Geeft de relatie aan tussen woorden, meestal plaats, tijd of richting.",
        voorbeelden: [{ zin: "Het boek ligt op de tafel.", gebruiktWoord: "op" }],
        synoniemen: ["prepositie"],
        antoniemen: [],
    },
    'voornaamwoord': {
        definitie: "Verwijst naar personen, dingen of wordt gebruikt ter vervanging van een zelfstandig naamwoord. Soorten: persoonlijk (ik), bezittelijk (mijn), wederkerend (zich), aanwijzend (deze), vragend (wie).",
        voorbeelden: [{ zin: "Zij komt morgen.", gebruiktWoord: "Zij" }, { zin: "Dat is mijn fiets.", gebruiktWoord: "mijn" }],
        synoniemen: ["pronomen"],
        antoniemen: [],
    },
    'bijwoord': {
        definitie: "Zegt iets over een werkwoord, bijvoeglijk naamwoord of ander bijwoord.",
        voorbeelden: [{ zin: "Hij loopt snel naar huis.", gebruiktWoord: "snel" }],
        synoniemen: ["adverbium"],
        antoniemen: [],
    },
    'voegwoord': {
        definitie: "Verbindt woorden, woordgroepen of zinnen.",
        voorbeelden: [{ zin: "Ik blijf thuis, want het regent.", gebruiktWoord: "want" }],
        synoniemen: ["conjunctie"],
        antoniemen: [],
    },
    'telwoord': {
        definitie: "Duidt hoeveelheid of volgorde aan. Soorten: hoofdtelwoord (één, twee) en rangtelwoord (eerste, tweede).",
        voorbeelden: [{ zin: "Hij heeft drie appels.", gebruiktWoord: "drie" }],
        synoniemen: ["numerale"],
        antoniemen: [],
    },
    'tussenwerpsel': {
        definitie: "Uitroep of klank die een emotie, reactie of geluid weergeeft.",
        voorbeelden: [{ zin: "Au! Dat deed pijn.", gebruiktWoord: "Au" }],
        synoniemen: ["interjectie"],
        antoniemen: [],
    },
    // Zinsdelen
    'onderwerp': {
        definitie: "Het zinsdeel dat aangeeft wie of wat iets doet. Je vindt het door de vraag 'Wie/wat + gezegde?' te stellen.",
        voorbeelden: [{ zin: "De hond blaft hard.", gebruiktWoord: "De hond" }],
        synoniemen: ["subject"],
        antoniemen: [],
    },
    'persoonsvorm': {
        definitie: "De vervoegde werkwoordsvorm die in persoon en getal overeenkomt met het onderwerp.",
        voorbeelden: [{ zin: "De hond blaft hard.", gebruiktWoord: "blaft" }],
        synoniemen: ["verbum finitum"],
        antoniemen: [],
    },
    'werkwoordelijk gezegde': {
        definitie: "Bestaat uit alle werkwoorden in de zin.",
        voorbeelden: [{ zin: "Hij heeft in de tuin gewerkt.", gebruiktWoord: "heeft gewerkt" }],
        synoniemen: ["verbaal predicaat"],
        antoniemen: [],
    },
    'naamwoordelijk gezegde': {
        definitie: "Bestaat uit een koppelwerkwoord (zoals zijn, worden, blijven) en een naamwoordelijk deel dat een eigenschap van het onderwerp beschrijft.",
        voorbeelden: [{ zin: "Zij is dokter.", gebruiktWoord: "is dokter" }],
        synoniemen: ["nominaal predicaat"],
        antoniemen: [],
    },
    'lijdend voorwerp': {
        definitie: "Het zinsdeel dat de handeling van het gezegde ondergaat. Je vindt het door de vraag 'Wie/wat + gezegde + onderwerp?' te stellen.",
        voorbeelden: [{ zin: "Zij leest een boek.", gebruiktWoord: "een boek" }],
        synoniemen: ["direct object"],
        antoniemen: [],
    },
    'meewerkend voorwerp': {
        definitie: "Het zinsdeel dat aangeeft aan of voor wie de handeling wordt verricht. Je vindt het door de vraag 'Aan/voor wie + gezegde + onderwerp + lijdend voorwerp?' te stellen.",
        voorbeelden: [{ zin: "Hij geeft haar een cadeau.", gebruiktWoord: "haar" }],
        synoniemen: ["indirect object"],
        antoniemen: [],
    },
    'bijwoordelijke bepaling': {
        definitie: "Een zinsdeel dat meer informatie geeft over de handeling, zoals tijd, plaats, reden of wijze. Het kan meestal worden weggelaten.",
        voorbeelden: [{ zin: "Hij fietst snel naar school.", gebruiktWoord: "snel" }, { zin: "Hij fietst snel naar school.", gebruiktWoord: "naar school" }],
        synoniemen: ["adverbiale bepaling"],
        antoniemen: [],
    },
    // Literaire kenmerken
    'thema': {
        definitie: "Het centrale onderwerp of de diepere betekenis van een verhaal (liefde, dood, verraad, etc.).",
        voorbeelden: [{ zin: "Het thema van het boek is de zoektocht naar identiteit.", gebruiktWoord: "thema" }],
        synoniemen: ["hoofdgedachte", "grondidee"],
        antoniemen: [],
    },
    'motief': {
        definitie: "Een herhaald element (idee, voorwerp, gebeurtenis) dat het thema ondersteunt.",
        voorbeelden: [{ zin: "De terugkerende spiegel is een motief voor zelfreflectie.", gebruiktWoord: "motief" }],
        synoniemen: ["leidmotief", "patroon"],
        antoniemen: [],
    },
    'personages': {
        definitie: "De figuren in een verhaal, zoals de hoofdpersoon (protagonist) en tegenspeler (antagonist).",
        voorbeelden: [{ zin: "De personages in deze roman zijn zeer complex.", gebruiktWoord: "personages" }],
        synoniemen: ["karakters", "figuren"],
        antoniemen: [],
    },
};

const PREDEFINED_ENGELS_ALGEMEEN: Record<string, FrayerModelData> = {
    'noun': {
        definitie: 'A word that names a person, place, thing, or idea. (Een zelfstandig naamwoord noemt een persoon, plaats, ding of idee.)',
        voorbeelden: [{ zin: 'The dog went to school to find happiness.', gebruiktWoord: 'dog' }, { zin: 'The dog went to school to find happiness.', gebruiktWoord: 'school' }, { zin: 'The dog went to school to find happiness.', gebruiktWoord: 'happiness' }],
        synoniemen: [],
        antoniemen: []
    },
    'pronoun': {
        definitie: 'A word that replaces a noun. (Een voornaamwoord vervangt een zelfstandig naamwoord.)',
        voorbeelden: [{ zin: 'He told her that it was their idea.', gebruiktWoord: 'He' }, { zin: 'He told her that it was their idea.', gebruiktWoord: 'her' }, { zin: 'He told her that it was their idea.', gebruiktWoord: 'it' }],
        synoniemen: [],
        antoniemen: []
    },
    'verb': {
        definitie: 'A word that shows an action or a state of being. (Een werkwoord drukt een handeling of toestand uit.)',
        voorbeelden: [{ zin: 'She can run, think, and be happy.', gebruiktWoord: 'run' }, { zin: 'She can run, think, and be happy.', gebruiktWoord: 'think' }, { zin: 'She can run, think, and be happy.', gebruiktWoord: 'be' }],
        synoniemen: [],
        antoniemen: []
    },
    'adjective': {
        definitie: 'A word that describes a noun or pronoun. (Een bijvoeglijk naamwoord beschrijft een zelfstandig naamwoord of voornaamwoord.)',
        voorbeelden: [{ zin: 'The beautiful, tall girl wore a green dress.', gebruiktWoord: 'beautiful' }, { zin: 'The beautiful, tall girl wore a green dress.', gebruiktWoord: 'tall' }, { zin: 'The beautiful, tall girl wore a green dress.', gebruiktWoord: 'green' }],
        synoniemen: [],
        antoniemen: []
    },
    'adverb': {
        definitie: 'A word that describes a verb, adjective, or another adverb. (Een bijwoord beschrijft een werkwoord, bijvoeglijk naamwoord of ander bijwoord.)',
        voorbeelden: [{ zin: 'He ran very quickly and finished well.', gebruiktWoord: 'very' }, { zin: 'He ran very quickly and finished well.', gebruiktWoord: 'quickly' }, { zin: 'He ran very quickly and finished well.', gebruiktWoord: 'well' }],
        synoniemen: [],
        antoniemen: []
    },
    'preposition': {
        definitie: 'A word that shows the relationship between a noun (or pronoun) and another word. (Een voorzetsel geeft de relatie aan tussen woorden.)',
        voorbeelden: [{ zin: 'The cat is on the table, under the lamp.', gebruiktWoord: 'on' }, { zin: 'The cat is on the table, under the lamp.', gebruiktWoord: 'under' }],
        synoniemen: [],
        antoniemen: []
    },
    'conjunction': {
        definitie: 'A word that connects words, phrases, or clauses. (Een voegwoord verbindt woorden of zinnen.)',
        voorbeelden: [{ zin: 'I wanted to go, but I was tired because I worked late.', gebruiktWoord: 'but' }, { zin: 'I wanted to go, but I was tired because I worked late.', gebruiktWoord: 'because' }],
        synoniemen: [],
        antoniemen: []
    },
    'interjection': {
        definitie: 'A short exclamation that expresses emotion. (Een tussenwerpsel drukt een emotie of reactie uit.)',
        voorbeelden: [{ zin: 'Wow, that is great news!', gebruiktWoord: 'Wow' }, { zin: 'Oh, I did not know that.', gebruiktWoord: 'Oh' }],
        synoniemen: [],
        antoniemen: []
    },
    'article': {
        definitie: 'A word that defines a noun as specific or unspecific. (Een lidwoord bepaalt of iets specifiek of algemeen is.)',
        voorbeelden: [{ zin: 'The boy saw a cat and an owl.', gebruiktWoord: 'The' }, { zin: 'The boy saw a cat and an owl.', gebruiktWoord: 'a' }, { zin: 'The boy saw a cat and an owl.', gebruiktWoord: 'an' }],
        synoniemen: ['determiner'],
        antoniemen: []
    },
};

const PREDEFINED_WISKUNDE_ALGEMEEN: Record<string, FrayerModelData> = {
    'accolade': { definitie: 'Soort haakje { } gebruikt bij wiskundige notaties, bijvoorbeeld om een verzameling aan te duiden.', voorbeelden: [{ zin: 'De verzameling van even getallen onder de 10 wordt genoteerd met een accolade: {2, 4, 6, 8}.', gebruiktWoord: 'accolade' }], synoniemen: ['krulhaakje'], antoniemen: ['rond haakje', 'vierkant haakje'], topic: 'Wiskunde Algemeen' },
    'aftrekken': { definitie: 'Een rekenkundige bewerking waarbij een hoeveelheid van een andere hoeveelheid wordt weggenomen.', voorbeelden: [{ zin: 'Als je 5 van 12 moet aftrekken, is het resultaat 7.', gebruiktWoord: 'aftrekken' }], synoniemen: ['verminderen', 'in mindering brengen'], antoniemen: ['optellen', 'toevoegen'], topic: 'Wiskunde Algemeen' },
    'breuk': { definitie: 'Een getal dat een deel van een geheel voorstelt, bestaande uit een teller en een noemer.', voorbeelden: [{ zin: 'De breuk 3/4 betekent drie van de vier gelijke delen.', gebruiktWoord: 'breuk' }], synoniemen: ['fractie'], antoniemen: ['geheel getal'], topic: 'Wiskunde Algemeen' },
};

const PREDEFINED_PERIODIEK_SYSTEEM: Record<string, FrayerModelData> = {
    'aluminium (al)': { definitie: 'Licht metaal, gebruikt in drankblikjes en vliegtuigonderdelen.', voorbeelden: [], synoniemen: ['n.v.t.'], antoniemen: ['n.v.t.'], topic: 'Periodiek Systeem' },
    'argon (ar)': { definitie: 'Edelgas dat in gloeilampen zit, zodat de draad niet verbrandt.', voorbeelden: [], synoniemen: ['n.v.t.'], antoniemen: ['n.v.t.'], topic: 'Periodiek Systeem' },
    'calcium (ca)': { definitie: 'Belangrijk voor sterke botten; zit in melk en yoghurt.', voorbeelden: [], synoniemen: ['n.v.t.'], antoniemen: ['n.v.t.'], topic: 'Periodiek Systeem' },
    'chloor (cl)': { definitie: 'Wordt gebruikt om zwembadwater te ontsmetten.', voorbeelden: [], synoniemen: ['n.v.t.'], antoniemen: ['n.v.t.'], topic: 'Periodiek Systeem' },
    'goud (au)': { definitie: 'Edelmetaal voor sieraden en zeer goede geleider voor microchips.', voorbeelden: [], synoniemen: ['n.v.t.'], antoniemen: ['n.v.t.'], topic: 'Periodiek Systeem' },
    'helium (he)': { definitie: 'Gas dat ballonnen laat zweven; lichter dan lucht.', voorbeelden: [], synoniemen: ['n.v.t.'], antoniemen: ['n.v.t.'], topic: 'Periodiek Systeem' },
    'ijzer (fe)': { definitie: 'Sterk metaal in bouwconstructies en in je bloed (hemoglobine).', voorbeelden: [], synoniemen: ['n.v.t.'], antoniemen: ['n.v.t.'], topic: 'Periodiek Systeem' },
    'koolstof (c)': { definitie: 'Bouwsteen van alle levende wezens; zit ook in houtskool.', voorbeelden: [], synoniemen: ['n.v.t.'], antoniemen: ['n.v.t.'], topic: 'Periodiek Systeem' },
    'koper (cu)': { definitie: 'Goede geleider; gebruikt in elektriciteitskabels.', voorbeelden: [], synoniemen: ['n.v.t.'], antoniemen: ['n.v.t.'], topic: 'Periodiek Systeem' },
    'waterstof (h)': { definitie: 'Lichtste gas, mogelijk toekomstige brandstof (waterstofauto’s).', voorbeelden: [], synoniemen: ['n.v.t.'], antoniemen: ['n.v.t.'], topic: 'Periodiek Systeem' },
    'zuurstof (o)': { definitie: 'Nodig om te ademen en om dingen te laten verbranden.', voorbeelden: [], synoniemen: ['n.v.t.'], antoniemen: ['n.v.t.'], topic: 'Periodiek Systeem' },
};


export const ALL_PREDEFINED_MODELS: Record<string, FrayerModelData> = {
    ...PREDEFINED_NEDERLANDS_ALGEMEEN,
    ...PREDEFINED_ENGELS_ALGEMEEN,
    ...PREDEFINED_WISKUNDE_ALGEMEEN,
    ...PREDEFINED_PERIODIEK_SYSTEEM,
};
