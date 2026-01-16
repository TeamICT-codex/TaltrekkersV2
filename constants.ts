
import { WordLevel, Finaliteit, Jaargang, SubjectSpecificCourse, ReadingStrategyItem, FrayerModelData } from './types';

// --- SESSION SETTINGS ---
export const DEFAULT_WORDS_PER_SESSION = 20;
export const MIN_WORDS_PER_SESSION = 20;
export const MAX_WORDS_PER_SESSION = 40;
export const STORY_MODE_UNLOCK_THRESHOLD = 1000;

// Session length options for UI (used in both Algemeen and Vakspecifiek modes)
export const SESSION_LENGTH_OPTIONS = [
    { name: 'Basis', words: 20, emoji: '📚' },
    { name: 'Standaard', words: 30, emoji: '💪' },
    { name: 'Intensief', words: 40, emoji: '🧠' },
];

// --- PREDEFINED FRAYER MODELS (CACHE) ---

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


// --- WORD LISTS ---

export const SCHOOLTAAL_WORDS: string[] = [
    'analyseren', 'interpreteren', 'concluderen', 'definiëren', 'illustreren', 'vergelijken', 'categoriseren', 'synthetiseren', 'evalueren', 'argumenteren', 'oorzaak', 'gevolg', 'verband', 'structuur', 'functie', 'kenmerk', 'aspect', 'factor', 'principe', 'theorie', 'hypothese', 'onderzoek', 'gegeven', 'bron', 'bewijs', 'context', 'perspectief', 'relevant', 'essentieel', 'significant', 'chronologisch', 'schematisch', 'grafisch', 'abstract', 'concreet', 'subjectief', 'objectief', 'kritisch', 'systematisch', 'logisch', 'toepassen', 'ontwikkelen', 'formuleren', 'beargumenteren', 'reflecteren', 'nuanceren', 'generaliseren', 'specificeren', 'reproduceren', 'construeren', 'procedure', 'methode', 'techniek', 'strategie', 'proces', 'cyclus', 'fase', 'stadium', 'component', 'element', 'variabele', 'constante', 'patroon', 'trend', 'afwijking', 'gemiddelde', 'mediaan', 'modus', 'frequentie', 'proportie', 'correlatie', 'causaliteit', 'validiteit', 'betrouwbaarheid', 'representatief', 'concept', 'model', 'paradigma', 'visie', 'standpunt', 'feit', 'mening', 'vooroordeel', 'stereotype', 'norm', 'waarde', 'cultuur', 'maatschappij', 'individu', 'collectief', 'interactie', 'communicatie', 'conflict', 'samenwerking', 'competentie', 'vaardigheid', 'attitude', 'kennis', 'inzicht', 'ervaring', 'doelstelling', 'resultaat', 'effect', 'impact', 'efficiëntie', 'effectiviteit', 'kwaliteit', 'kwantiteit', 'toename', 'afname'
];

const NEDERLANDS_ALGEMEEN_WORDS: string[] = Object.keys(PREDEFINED_NEDERLANDS_ALGEMEEN);
const ENGELS_ALGEMEEN_WORDS: string[] = Object.keys(PREDEFINED_ENGELS_ALGEMEEN);
const WISKUNDE_ALGEMEEN_WORDS: string[] = Object.keys(PREDEFINED_WISKUNDE_ALGEMEEN);
const PERIODIEK_SYSTEEM_WORDS: string[] = Object.keys(PREDEFINED_PERIODIEK_SYSTEEM);

const BIOLOGIE_WORDS: string[] = ['cel', 'ecosysteem', 'fotosynthese', 'DNA', 'evolutie', 'organisme', 'soort', 'populatie', 'genetica', 'metabolisme'];
const MENS_EN_MAATSCHAPPIJ_WORDS: string[] = ['democratie', 'globalisering', 'cultuur', 'migratie', 'samenleving', 'politiek', 'geschiedenis', 'geografie', 'identiteit', 'socialisatie'];
const ECONOMIE_WORDS: string[] = ['markt', 'inflatie', 'conjunctuur', 'bruto nationaal product', 'vraag en aanbod', 'monopolie', 'concurrentie', 'investering', 'productiviteit', 'globalisering'];
const NATUURKUNDE_WORDS: string[] = ['energie', 'kracht', 'snelheid', 'massa', 'atoom', 'molecuul', 'zwaartekracht', 'elektriciteit', 'magnetisme', 'straling'];
const ACADEMISCHE_WOORDENSCHAT_WORDS: string[] = ['ambigu', 'coherent', 'empirisch', 'intrinsiek', 'legitiem', 'pragmatisch', 'paradox', 'heuristiek', 'methodologie', 'paradigma'];

export const WORD_LISTS: Record<string, string[]> = {
    // Algemene vakken
    [WordLevel.Beginner]: SCHOOLTAAL_WORDS.slice(0, 30),
    [WordLevel.Intermediate]: SCHOOLTAAL_WORDS.slice(30, 70),
    [WordLevel.Advanced]: [...SCHOOLTAAL_WORDS.slice(70, 100), ...ACADEMISCHE_WOORDENSCHAT_WORDS],
    [WordLevel.Schooltaal]: SCHOOLTAAL_WORDS,
    [WordLevel.Nederlands]: NEDERLANDS_ALGEMEEN_WORDS,
    [WordLevel.Engels]: ENGELS_ALGEMEEN_WORDS,
    [WordLevel.Biologie]: BIOLOGIE_WORDS,
    [WordLevel.MensEnMaatschappij]: MENS_EN_MAATSCHAPPIJ_WORDS,
    [WordLevel.Economie]: ECONOMIE_WORDS,
    [WordLevel.Wiskunde]: WISKUNDE_ALGEMEEN_WORDS,
    [WordLevel.Natuurkunde]: NATUURKUNDE_WORDS,
    [WordLevel.PeriodiekSysteem]: PERIODIEK_SYSTEEM_WORDS,
    [WordLevel.AcademischeWoordenschat]: ACADEMISCHE_WOORDENSCHAT_WORDS,
};

// --- DIFFICULTY MAPPING ---

export const LEVEL_DIFFICULTY_MAP: Record<string, WordLevel.Beginner | WordLevel.Intermediate | WordLevel.Advanced> = {
    [WordLevel.Beginner]: WordLevel.Beginner,
    [WordLevel.Intermediate]: WordLevel.Intermediate,
    [WordLevel.Advanced]: WordLevel.Advanced,
    [WordLevel.Schooltaal]: WordLevel.Intermediate,
    [WordLevel.Nederlands]: WordLevel.Intermediate,
    [WordLevel.Engels]: WordLevel.Intermediate,
    [WordLevel.Biologie]: WordLevel.Intermediate,
    [WordLevel.MensEnMaatschappij]: WordLevel.Intermediate,
    [WordLevel.Economie]: WordLevel.Advanced,
    [WordLevel.Wiskunde]: WordLevel.Intermediate,
    [WordLevel.Natuurkunde]: WordLevel.Advanced,
    [WordLevel.PeriodiekSysteem]: WordLevel.Intermediate,
    [WordLevel.AcademischeWoordenschat]: WordLevel.Advanced,
};

// --- READING STRATEGIES ---

export const STRATEGIES: ReadingStrategyItem[] = [
    { title: 'Voorspellen', explanation: 'Kijk naar de titel en de gemarkeerde woorden. Waar denk je dat dit verhaal over zal gaan? Goed voorspellen helpt je om de tekst beter te begrijpen.', question: 'Lees de titel en bekijk de vetgedrukte woorden. Schrijf in één of twee zinnen op waar jij denkt dat dit verhaal over zal gaan.' },
    { title: 'Visualiseren', explanation: 'Maak een beeld in je hoofd terwijl je leest. Dit helpt je om het verhaal beter te onthouden en de sfeer te voelen.', question: 'Kies een alinea uit het verhaal en beschrijf het beeld dat je in je hoofd ziet. Welke kleuren, geluiden en gevoelens komen er bij je op?' },
    { title: 'Verbanden leggen', explanation: 'Denk na over hoe de gebeurtenissen in het verhaal met elkaar te maken hebben, of hoe het verhaal lijkt op iets wat je zelf hebt meegemaakt.', question: 'Welk verband zie je tussen het begin en het einde van het verhaal? Is er iets veranderd voor de hoofdpersoon?' },
    { title: 'Vragen stellen', explanation: 'Stel jezelf vragen tijdens het lezen, zoals "Waarom gebeurt dit?" of "Wat zou ik doen?". Dit houdt je actief betrokken bij de tekst.', question: 'Bedenk één "waarom"-vraag over een gebeurtenis in het verhaal en probeer deze zelf te beantwoorden op basis van de tekst.' },
    { title: 'Samenvatten', explanation: 'Probeer na het lezen in je eigen woorden te vertellen wat het belangrijkste was. Dit is een goede test om te zien of je de kern hebt begrepen.', question: 'Wat is de allerbelangrijkste boodschap of gebeurtenis in dit verhaal? Vat het samen in één zin.' }
];

// --- SUBJECT-SPECIFIC COURSE DATA ---

export const SUBJECT_SPECIFIC_COURSES: Record<Finaliteit, Partial<Record<Jaargang, SubjectSpecificCourse[]>>> = {
    AF: {
        '3e': [
            { id: 'AF-3e-ORGLOG', name: 'Organisatie & Logistiek' },
        ],
        '4e': [
            { id: 'AF-4e-ORGLOG', name: 'Organisatie & Logistiek' },
        ],
        '5e': [
            { id: 'AF-5e-ONTSAL', name: 'Onthaal, Organisatie & Sales (ONOSA)', url: 'https://sgr18-my.sharepoint.com/:f:/g/personal/info_gotalok_be/IgA52Xp_YYb2Rq5HTF6ZDvSdAbWPUhHpmjtWahJYy-pBNUo?e=kgfzf1' },
            { id: 'AF-5e-ONTSALDU', name: 'Onthaal, Organisatie & Sales (Duaal)' },
            { id: 'AF-5e-LOG', name: 'Logistiek' },
            { id: 'AF-5e-LOGDU', name: 'Logistiek (Duaal)' },
        ],
        '6e': [
            { id: 'AF-6e-ONTSAL', name: 'Onthaal, Organisatie & Sales (ONOSA)', url: 'https://sgr18-my.sharepoint.com/:f:/g/personal/info_gotalok_be/IgBo7GjkwePTQYK4Jy_fiNxMARmqR8I7mRXQvpNa5rLIW48?e=K1Ueub' },
            { id: 'AF-6e-ONTSALDU', name: 'Onthaal, Organisatie & Sales (Duaal)' },
            { id: 'AF-6e-LOG', name: 'Logistiek' },
            { id: 'AF-6e-LOGDU', name: 'Logistiek (Duaal)' },
        ],
    },
    DF: {
        '3e': [
            { id: 'DF-3e-BEDORG', name: 'Bedrijf & Organisatie' },
        ],
        '4e': [
            { id: 'DF-4e-BEDORG', name: 'Bedrijf & Organisatie' },
        ],
        '5e': [
            { id: 'DF-5e-APPDAT', name: 'Applicatie- & Databeheer (APPDA)', url: 'https://sgr18-my.sharepoint.com/:f:/g/personal/info_gotalok_be/IgCCWltomdUTR4oJZ_9n3ohpAWegha-7K5yxSan53p-Yr5w?e=qMxchD' },
            { id: 'DF-5e-BEDORG', name: 'Bedrijfsorganisatie (BORGA)', url: 'https://sgr18-my.sharepoint.com/:f:/g/personal/info_gotalok_be/IgC513i0j2POTZ2ealyE84S5AZyblu_e9gQ90XaEpIHRlzQ?e=DTKL1Y' },
            { id: 'DF-5e-EMTEC', name: 'Elektromechanische technieken (EMTEC)', url: 'https://sgr18-my.sharepoint.com/:f:/g/personal/info_gotalok_be/IgC2NQWegAm9Q5xvNwGr8OslATmyX35ufeVPlyp0qPXaln0?e=qhfW56' },
            { id: 'DF-5e-GEZORG', name: 'Gezondheidszorg (GEZORG)', url: 'https://sgr18-my.sharepoint.com/:f:/g/personal/info_gotalok_be/IgDmbiO_bF-PQrNT9hhIkZ9MAYCVFJJ1pE5va9wn8H2InP4?e=HeBFwz' },
            { id: 'DF-5e-INHAL', name: 'Internationale Handel & Logistiek (INHAL)', url: 'https://sgr18-my.sharepoint.com/:f:/g/personal/info_gotalok_be/IgDFZgqQt5tqRpmWAg8oVZRnAdyqCQZPryofdFvy06o9Dts?e=dFkxdV' },
            { id: 'DF-5e-OPBEG', name: 'Opvoeden en Begeleiden (OPBEG)', url: 'https://sgr18-my.sharepoint.com/:f:/g/personal/info_gotalok_be/IgDmbiO_bF-PQrNT9hhIkZ9MAYCVFJJ1pE5va9wn8H2InP4?e=qFxU1e' },
            { id: 'DF-5e-SPOBE', name: 'Sportbegeleider (SPOBE)', url: 'https://sgr18-my.sharepoint.com/:f:/g/personal/info_gotalok_be/IgCPSnoXwkHGRaS9_aTEcqi-ASQ9KAuccXdLMC3aRM2wiRo?e=ZHEgB9' },
            { id: 'DF-5e-WESCH', name: 'Wellness & Schoonheid (WESCH)', url: 'https://sgr18-my.sharepoint.com/:f:/g/personal/info_gotalok_be/IgCEtO03GdIiRqOyQ_cYmQgKAY5LLkd4wf3sWvaFHZJYGrA?e=dbyn6G' },
        ],
        '6e': [
            { id: 'DF-6e-APPDAT', name: 'Applicatie- & Databeheer (APPDA)', url: 'https://sgr18-my.sharepoint.com/:f:/g/personal/info_gotalok_be/IgAQG8-3xhwESLbAPYoZ92y2AU2rSKPb0QZB6SDUp-FcHA8?e=RHuLpj' },
            { id: 'DF-6e-BEDORG', name: 'Bedrijfsorganisatie (BORGA)', url: 'https://sgr18-my.sharepoint.com/:f:/g/personal/info_gotalok_be/IgBEDgMmkALkQr38D06L4YRxAQlGCv3GRMWvJYwIrNTT7Sw?e=A3M9g8' },
            { id: 'DF-6e-EMTEC', name: 'Elektromechanische technieken (EMTEC)', url: 'https://sgr18-my.sharepoint.com/:f:/g/personal/info_gotalok_be/IgDPCZ_S2uXxQ6lTi4hnRVIVAUZIPCHqXnPpC1T-0r8enDc?e=6a7a8v' },
            { id: 'DF-6e-GEZORG', name: 'Gezondheidszorg (GEZORG)', url: 'https://sgr18-my.sharepoint.com/:f:/g/personal/info_gotalok_be/IgBlYtupGFNBQbYPmZIuWS5EAXaVw5zy57_BWi9pyz86qCs?e=y9qrho' },
            { id: 'DF-6e-INHAL', name: 'Internationale Handel & Logistiek (INHAL)', url: 'https://sgr18-my.sharepoint.com/:f:/g/personal/info_gotalok_be/IgCZoh98jXl_TILIwkOc87F1ATD5ruyNt5Pt4a3O-ZYsB5g?e=ORWOac' },
            { id: 'DF-6e-OPBEG', name: 'Opvoeden en Begeleiden (OPBEG)', url: 'https://sgr18-my.sharepoint.com/:f:/g/personal/info_gotalok_be/IgDhhIfdoBYAQb_ATQc9OCKLAXTUOP-Jwf6UWC6Z2ttlTXQ?e=DUaXSL' },
            { id: 'DF-6e-SPOBE', name: 'Sportbegeleider (SPOBE)', url: 'https://sgr18-my.sharepoint.com/:f:/g/personal/info_gotalok_be/IgAaxmW2h8X0ToNyug3zYwzgAac6S5DeY4dv58eKA9x11Yo?e=huje5d' },
            { id: 'DF-6e-WESCH', name: 'Wellness & Schoonheid (WESCH)', url: 'https://sgr18-my.sharepoint.com/:f:/g/personal/info_gotalok_be/IgAwAOV3WQeYRp1cC7Kb51TvAYeoIJQhSrtQudHzvXBFRu4?e=kmiOid' },
        ],
    }
};
