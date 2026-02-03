
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

// Placeholder word lists - user will provide actual words later
const WOORDENSCHAT_2DF_WORDS: string[] = [
    // Woordenschat 2e graad dubbele finaliteit (159 woorden)
    'aantonen', 'achterhalen', 'analyseren', 'argumenteren', 'benoemen', 'beoordelen', 'beschrijven', 'concluderen',
    'de conclusie', 'conclusie trekken', 'de context', 'definiëren', 'interpreteren', 'kritisch redeneren',
    'het perspectief', 'schetsen', 'situeren', 'staven met', 'toelichten', 'vergelijken',
    'aanpassen', 'aansluiten', 'aanvankelijk', 'aanvullen', 'de aanwijzing', 'aanzienlijk', 'achtereenvolgens',
    'de achtergrond', 'de actie', 'de activiteit', 'de administratie', 'het advies', 'afbakenen',
    'afhankelijk zijn van', 'afleiden', 'de afmeting', 'afronden', 'afsluiten', 'algemeen', 'de arbeidsmarkt',
    'het artikel', 'het aspect', 'de atmosfeer', 'automatiseren', 'de basis', 'het bedrag', 'de beoordeling',
    'bepalen', 'beperken', 'berekenen', 'de berekening', 'beschermen', 'beschikbaar', 'beschikken over',
    'beschouwen', 'beslissen', 'bestaan uit', 'de bestemming', 'betreffen', 'betrekking hebben op', 'bevatten',
    'het bewijs', 'bewust', 'bijbehorend', 'bijstellen', 'binnenlands', 'de bodem', 'de brandstof', 'bruikbaar',
    'het budget', 'centraal', 'de cirkel', 'de combinatie', 'de communicatie', 'compleet', 'constateren',
    'controleren', 'de cultuur', 'het dal', 'de daling', 'deelbaar', 'deelnemen aan', 'de definitie',
    'het detail', 'het diagram', 'de diepte', 'het doel', 'de doelstelling', 'doordat', 'door middel van',
    'de doorsnede', 'het effect', 'de eigenschap', 'de energie', 'enerzijds', 'eveneens', 'eventueel', 'exact',
    'het experiment', 'de factor', 'de functie', 'het gegeven', 'de gegevens', 'het geheel', 'het gemiddelde',
    'de grafiek', 'de grondstof', 'de hoeveelheid', 'de informatie', 'de invloed', 'invoeren', 'de isolatie',
    'de kwaliteit', 'kwalitatief', 'de kwantiteit', 'het klimaat', 'de kracht', 'de maatregel', 'het materiaal',
    'meten', 'de methode', 'het model', 'de mogelijkheid', 'het onderzoek', 'onderzoeken', 'ontwikkelen',
    'de ontwikkeling', 'de oplossing', 'de oppervlakte', 'de oorzaak', 'de overeenkomst', 'het proces',
    'het product', 'de productie', 'realiseren (zich)', 'het resultaat', 'de structuur', 'de techniek',
    'de theorie', 'toepassen', 'de toepassing', 'de toestand', 'veranderen', 'de verhouding', 'verklaren',
    'het verschil', 'verwerken', 'het volume'
];

const WOORDENSCHAT_2AF_WORDS: string[] = [
    // Woordenschat 2e graad arbeidsfinaliteit (113 woorden)
    'aantonen', 'achterhalen', 'analyseren', 'argumenteren', 'benoemen', 'beoordelen', 'beschrijven', 'concluderen',
    'de conclusie', 'de context', 'definiëren', 'interpreteren', 'schetsen', 'situeren', 'staven met', 'toelichten',
    'vergelijken', 'aanpassen', 'aansluiten', 'aanvullen', 'de aanwijzing', 'achtereenvolgens', 'de achtergrond',
    'de activiteit', 'het advies', 'afhankelijk zijn van', 'aflezen', 'de afmeting', 'afronden', 'afsluiten',
    'afspreken', 'het afval', 'algemeen', 'de arbeid', 'het artikel', 'de basis', 'het bedrag', 'het bedrijf',
    'het begrip', 'de behandeling', 'de behoefte', 'het belang', 'de beoordeling', 'bepalen', 'berekenen',
    'beschermen', 'beschikbaar', 'beslissen', 'bestaan uit', 'bestellen', 'betalen', 'betreffen', 'het bewijs',
    'bewust', 'bijhouden', 'de bodem', 'de brandstof', 'bruikbaar', 'het budget', 'centraal', 'de controle',
    'controleren', 'het deel', 'deelnemen aan', 'het detail', 'het diagram', 'het doel', 'doordat',
    'door middel van', 'duidelijk maken', 'het effect', 'de eigenschap', 'de energie', 'de ervaring', 'eventueel',
    'de functie', 'het gebruik', 'gebruik maken van', 'het gegeven', 'de gegevens', 'het geheel', 'gemiddeld',
    'het gewicht', 'de grafiek', 'de grondstof', 'de hoeveelheid', 'de informatie', 'de invloed', 'invullen',
    'de kwaliteit', 'de kracht', 'de maatregel', 'het materiaal', 'meten', 'het model', 'de mogelijkheid',
    'het onderzoek', 'de oplossing', 'de oorzaak', 'praktisch', 'het proces', 'het product', 'het resultaat',
    'de situatie', 'de techniek', 'toepassen', 'de toestand', 'veranderen', 'het verschil', 'verwerken',
    'de waarde', 'het volume'
];

const ACADEMISCH_NEDERLANDS_WORDS: string[] = [
    // Academisch Nederlands (136 woorden)
    'de analyse', 'analyseren', 'analytisch', 'het argument', 'de argumentatie', 'argumenteren', 'het aspect',
    'de autonomie', 'de causaliteit', 'chronologisch', 'de context', 'contextueel', 'de correlatie', 'het criterium',
    'de conclusie', 'concluderen', 'de consensus', 'consequent', 'consistent', 'de contradictie', 'controversieel',
    'de data', 'de deductie', 'de discrepantie', 'de diversiteit', 'het effect', 'effectief', 'de effectiviteit',
    'efficiënt', 'elementair', 'elimineren', 'empirisch', 'equivalent', 'de essentie', 'essentieel', 'ethisch',
    'expliciet', 'de factor', 'het fenomeen', 'frequent', 'de functionaliteit', 'generaliseren', 'de hypothese',
    'hypothetisch', 'de implicatie', 'impliciet', 'implementeren', 'de indicatie', 'inferieur', 'de innovatie',
    'integraal', 'de interpretatie', 'intrinsiek', 'relevant', 'de relevantie', 'de legitimiteit', 'de methode',
    'de methodiek', 'de nuance', 'objectief', 'operationeel', 'de perceptie', 'plausibel', 'de prioriteit',
    'de procedure', 'het proces', 'de rationalisatie', 'het referentiekader', 'de reflectie', 'de relatie',
    'relatief', 'representatief', 'de representatie', 'significant', 'de specificatie', 'de strategie', 'structureel',
    'subjectief', 'de synthese', 'systematisch', 'de tendens', 'de theorie', 'transparant', 'valide', 'de variabele',
    'de verificatie', 'verifiëren', 'de visie', 'het onderzoek', 'de ontwikkeling', 'de evaluatie', 'het perspectief',
    'abstract', 'expliciteren', 'structureren', 'positioneren', 'anticiperen', 'de generalisatie', 'kwantitatief',
    'kwalitatief', 'normatief', 'het concept', 'het model', 'het paradigma', 'de consistentie', 'het interpretatiekader',
    'academisch', 'de discipline', 'het discours', 'de evidentie', 'verantwoorden', 'de redenering', 'onderbouwen',
    'de coherentie', 'de samenhang', 'de betrouwbaarheid', 'de validiteit', 'de hypothesevorming', 'theoretisch',
    'empirische data', 'argumentatief', 'conceptueel', 'methodologisch', 'analytische vaardigheden', 'conclusief',
    'de probleemstelling', 'de onderzoeksvraag', 'de resultaten', 'de bevindingen', 'interpretatief', 'kritisch',
    'de systematiek', 'de variatie', 'de contextanalyse', 'de onderzoeksopzet', 'de generaliseerbaarheid'
];

const PROFESSIONEEL_NEDERLANDS_WORDS: string[] = [
    // Professioneel Nederlands (102 woorden)
    'de soft skills', 'de arbeidsattitude', 'de beroepsattitude', 'de verantwoordelijkheid', 'de autonomie',
    'de motivatie', 'de veerkracht', 'de flexibiliteit', 'het eigenaarschap', 'de zelfreflectie', 'de proactiviteit',
    'de betrouwbaarheid', 'de punctualiteit', 'de betrokkenheid', 'het initiatief', 'de communicatie', 'de feedback',
    'de feedbackcultuur', 'de samenwerking', 'het vertrouwen', 'het overleg', 'de instructie', 'de begeleiding',
    'het loopbaangesprek', 'het sollicitatiegesprek', 'de ontwikkeling', 'de groei', 'de professionalisering',
    'de competentieontwikkeling', 'de talentontwikkeling', 'de leeromgeving', 'de leeropportuniteit', 'de evaluatie',
    'de evaluatieprocedure', 'de zelfevaluatie', 'de remediëring', 'de reflectie', 'de stage', 'de administratie',
    'het werkplekleren', 'de leerling-stagiair', 'de stageplaats', 'het stagebedrijf', 'de stagegever',
    'de stagementor', 'de stagebegeleider', 'de stagecoördinator', 'de stage-overeenkomst', 'de stage-activiteitenlijst',
    'de stage-uitvoering', 'de stageduur', 'de werkvloer', 'de aanwezigheid', 'de afwezigheid', 'het uurrooster',
    'de verzekering', 'de aansprakelijkheid', 'de arbeidsovereenkomst', 'het uittreksel uit het strafregister',
    'de gezondheidsbeoordeling', 'het beschermingsmateriaal', 'de overmacht', 'de jobinhoud', 'de tewerkstelling',
    'de werkgever', 'de werkdruk', 'de werkervaring', 'de studentenjob', 'de loopbaan', 'het perspectief',
    'het netwerk', 'de sollicitatie', 'het curriculum vitae', 'de vacature', 'de vacaturedatabank', 'het profiel',
    'de beschikbaarheid', 'de referentie', 'de connectie', 'het ondernemerschap', 'het statuut (student-zelfstandige)',
    'de onderneming', 'de innovatie', 'de cashflow', 'de budgetraming', 'de inclusie', 'de integratie',
    'de maatschappelijke verantwoordelijkheid', 'het psychologisch contract', 'het empathisch leiderschap',
    'het duurzaam loopbaanbeleid', 'de context', 'het overlegmoment', 'de planning', 'de taak', 'de opdracht',
    'de deadline', 'de prioriteit', 'de opvolging', 'de rapportering', 'de afspraak', 'de werkcontext', 'het solliciteren'
];

export const WORD_LISTS: Record<string, string[]> = {
    [WordLevel.Woordenschat2DF]: WOORDENSCHAT_2DF_WORDS,
    [WordLevel.Woordenschat2AF]: WOORDENSCHAT_2AF_WORDS,
    [WordLevel.AcademischNederlands]: ACADEMISCH_NEDERLANDS_WORDS,
    [WordLevel.ProfessioneelNederlands]: PROFESSIONEEL_NEDERLANDS_WORDS,
};

// --- DIFFICULTY MAPPING ---

export const LEVEL_DIFFICULTY_MAP: Record<string, WordLevel.Beginner | WordLevel.Intermediate | WordLevel.Advanced> = {
    [WordLevel.Beginner]: WordLevel.Beginner,
    [WordLevel.Intermediate]: WordLevel.Intermediate,
    [WordLevel.Advanced]: WordLevel.Advanced,
    [WordLevel.Woordenschat2DF]: WordLevel.Intermediate,
    [WordLevel.Woordenschat2AF]: WordLevel.Beginner,
    [WordLevel.AcademischNederlands]: WordLevel.Advanced,
    [WordLevel.ProfessioneelNederlands]: WordLevel.Intermediate,
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
    },
    OKAN: {
        'Fase 1': [
            { id: 'OKAN-F1', name: 'OKAN Fase 1' },
        ],
        'Fase 2': [
            { id: 'OKAN-F2', name: 'OKAN Fase 2' },
        ],
        'Fase 3': [
            { id: 'OKAN-F3', name: 'OKAN Fase 3' },
        ],
        'Fase 4': [
            { id: 'OKAN-F4', name: 'OKAN Fase 4' },
        ],
    }
};

// --- AF VAKKEN STRUCTUUR (Meerlaags: Basisvorming = vakken, Specifiek = richtingen → vakken) ---

export interface AFVak {
    id: string;
    name: string;
    url?: string;
}

export interface AFRichting {
    id: string;
    name: string;
    vakken: AFVak[];
}

export interface AFJaargangStructuur {
    basisvorming: AFVak[];
    specifiek: AFRichting[];
}

export const AF_VAKKEN_STRUCTUUR: Partial<Record<Jaargang, AFJaargangStructuur>> = {
    '3e': {
        basisvorming: [
            { id: 'AF-3e-BV-ENG', name: 'Engels', url: 'https://sgr18-my.sharepoint.com/personal/tal-trekkers_gotalok_be/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Ftal%2Dtrekkers%5Fgotalok%5Fbe%2FDocuments%2FTALtrekkers%2FArbeidsmarktgerichte%20finaliteit%20%28AF%29%2F3AF%2F3AF%20Basisvorming%2FEngels&viewid=fdf20b93%2D32d4%2D4441%2Da769%2D6d39b308fcd6' },
            { id: 'AF-3e-BV-LB', name: 'Levensbeschouwing', url: 'https://sgr18-my.sharepoint.com/personal/tal-trekkers_gotalok_be/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Ftal%2Dtrekkers%5Fgotalok%5Fbe%2FDocuments%2FTALtrekkers%2FArbeidsmarktgerichte%20finaliteit%20%28AF%29%2F3AF%2F3AF%20Basisvorming%2FLevensbeschouwing&viewid=fdf20b93%2D32d4%2D4441%2Da769%2D6d39b308fcd6' },
            { id: 'AF-3e-BV-LO', name: 'Lichamelijke opvoeding', url: 'https://sgr18-my.sharepoint.com/personal/tal-trekkers_gotalok_be/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Ftal%2Dtrekkers%5Fgotalok%5Fbe%2FDocuments%2FTALtrekkers%2FArbeidsmarktgerichte%20finaliteit%20%28AF%29%2F3AF%2F3AF%20Basisvorming%2FLichamelijke%20opvoeding&viewid=fdf20b93%2D32d4%2D4441%2Da769%2D6d39b308fcd6' },
            { id: 'AF-3e-BV-PAVA', name: 'PAV A', url: 'https://sgr18-my.sharepoint.com/personal/tal-trekkers_gotalok_be/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Ftal%2Dtrekkers%5Fgotalok%5Fbe%2FDocuments%2FTALtrekkers%2FArbeidsmarktgerichte%20finaliteit%20%28AF%29%2F3AF%2F3AF%20Basisvorming%2FPAV%20A&viewid=fdf20b93%2D32d4%2D4441%2Da769%2D6d39b308fcd6' },
            { id: 'AF-3e-BV-PAVB', name: 'PAV B + Talent voor Taal', url: 'https://sgr18-my.sharepoint.com/personal/tal-trekkers_gotalok_be/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Ftal%2Dtrekkers%5Fgotalok%5Fbe%2FDocuments%2FTALtrekkers%2FArbeidsmarktgerichte%20finaliteit%20%28AF%29%2F3AF%2F3AF%20Basisvorming%2FPAV%20B%20%2B%20Talent%20voor%20Taal&viewid=fdf20b93%2D32d4%2D4441%2Da769%2D6d39b308fcd6' },
        ],
        specifiek: [
            {
                id: 'AF-3e-SG-ELEK',
                name: '3 ELEK (Elektriciteit)',
                vakken: [
                    { id: 'AF-3e-SG-ELEK-INST', name: 'Elektriciteit installatieleer', url: 'https://sgr18-my.sharepoint.com/personal/tal-trekkers_gotalok_be/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Ftal%2Dtrekkers%5Fgotalok%5Fbe%2FDocuments%2FTALtrekkers%2FArbeidsmarktgerichte%20finaliteit%20%28AF%29%2F3AF%2F3AF%20Specifiek%20gedeelte%2F3%20ELEK%2FElektriciteit%20installatieleer&viewid=fdf20b93%2D32d4%2D4441%2Da769%2D6d39b308fcd6' },
                    { id: 'AF-3e-SG-ELEK-PRAK', name: 'Elektriciteit praktijk', url: 'https://sgr18-my.sharepoint.com/personal/tal-trekkers_gotalok_be/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Ftal%2Dtrekkers%5Fgotalok%5Fbe%2FDocuments%2FTALtrekkers%2FArbeidsmarktgerichte%20finaliteit%20%28AF%29%2F3AF%2F3AF%20Specifiek%20gedeelte%2F3%20ELEK%2FElektriciteit%20praktijk&viewid=fdf20b93%2D32d4%2D4441%2Da769%2D6d39b308fcd6' },
                    { id: 'AF-3e-SG-ELEK-TECH', name: 'Elektriciteit technisch tekenen', url: 'https://sgr18-my.sharepoint.com/personal/tal-trekkers_gotalok_be/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Ftal%2Dtrekkers%5Fgotalok%5Fbe%2FDocuments%2FTALtrekkers%2FArbeidsmarktgerichte%20finaliteit%20%28AF%29%2F3AF%2F3AF%20Specifiek%20gedeelte%2F3%20ELEK%2FElektriciteit%20technisch%20tekenen&viewid=fdf20b93%2D32d4%2D4441%2Da769%2D6d39b308fcd6' },
                    { id: 'AF-3e-SG-ELEK-THEO', name: 'Elektriciteit theorie', url: 'https://sgr18-my.sharepoint.com/personal/tal-trekkers_gotalok_be/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Ftal%2Dtrekkers%5Fgotalok%5Fbe%2FDocuments%2FTALtrekkers%2FArbeidsmarktgerichte%20finaliteit%20%28AF%29%2F3AF%2F3AF%20Specifiek%20gedeelte%2F3%20ELEK%2FElektriciteit%20theorie&viewid=fdf20b93%2D32d4%2D4441%2Da769%2D6d39b308fcd6' },
                ],
            },
            {
                id: 'AF-3e-SG-HT',
                name: '3 HT (Haartechnieken)',
                vakken: [
                    { id: 'AF-3e-SG-HT-PRAK', name: 'Haartechnieken praktijk', url: undefined },
                    { id: 'AF-3e-SG-HT-THEO', name: 'Haartechnieken theorie', url: undefined },
                ],
            },
            {
                id: 'AF-3e-SG-MECH',
                name: '3 MECH (Mechanica)',
                vakken: [
                    { id: 'AF-3e-SG-MECH-PRAK', name: 'Mechanica praktijk', url: undefined },
                    { id: 'AF-3e-SG-MECH-THEO', name: 'Mechanica theorie', url: undefined },
                ],
            },
            {
                id: 'AF-3e-SG-OL',
                name: '3 O&L (Organisatie & Logistiek)',
                vakken: [
                    { id: 'AF-3e-SG-OL-PRAK', name: 'O&L praktijk', url: undefined },
                    { id: 'AF-3e-SG-OL-THEO', name: 'O&L theorie', url: undefined },
                ],
            },
            {
                id: 'AF-3e-SG-ZW',
                name: '3 Z&W (Zorg & Welzijn)',
                vakken: [
                    { id: 'AF-3e-SG-ZW-PRAK', name: 'Zorg & Welzijn praktijk', url: undefined },
                    { id: 'AF-3e-SG-ZW-THEO', name: 'Zorg & Welzijn theorie', url: undefined },
                ],
            },
        ],
    },
};
