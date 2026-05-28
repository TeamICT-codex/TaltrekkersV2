/**
 * Curriculum-vakken voor TALent voor Taal.
 *
 * Bron: OneDrive "TALENTVOORTAAL drive" (Het Leercollectief, alle finaliteiten
 * + OKAN, ~414 woordenlijsten verspreid over 73 mappen).
 *
 * Doel: ÉÉN bron-van-waarheid voor:
 *   1. UI-dropdown bij upload van een woordenlijst — "Welk vak hoort dit bij?"
 *   2. `subjectMap` in geminiService.ts — geeft Gemini de juiste vakcontext
 *      voor woord-extractie, Frayer-modellen en quiz-vragen.
 *
 * Conventie: elke `Vak` heeft een mensleesbare `id` die ook als context-string
 * naar Gemini gaat. Bij Frayer/Quiz wordt `id` opgezocht in subjectMap →
 * `domain` veld → instructie aan Gemini. Bij extractie idem.
 */

export interface Vak {
  /** Unieke ID — gebruikt als context-string voor Gemini én als opslag-key. */
  id: string;
  /** Mens-leesbare label voor de UI-dropdown. */
  label: string;
  /** Korte domein-omschrijving voor Gemini ("zin gaat over X, Y, Z"). */
  domain: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// BASISVORMING — vakken die in elke finaliteit/graad voorkomen
// ─────────────────────────────────────────────────────────────────────────────

export const BASISVORMING_VAKKEN: Vak[] = [
  { id: 'PAV', label: 'PAV (Project Algemene Vakken)', domain: 'maatschappelijke onderwerpen, burgerschap, mediawijsheid, gezondheid, werk en wonen — algemene vorming voor BSO/AF' },
  { id: 'PAV-Talent', label: 'PAV B (Talent voor Taal)', domain: 'taalvaardigheid, woordenschat, leesbegrip en schrijfvaardigheid binnen PAV thema\'s' },
  { id: 'Nederlands', label: 'Nederlands', domain: 'Nederlandse taal, grammatica, spelling, woordenschat, literatuur, taalbeschouwing' },
  { id: 'Engels', label: 'Engels', domain: 'Engelse taal, vocabulary, grammar — Engelse termen behouden hun originele spelling' },
  { id: 'Frans', label: 'Frans', domain: 'Franse taal, vocabulaire, grammaire — Franse termen behouden hun originele spelling' },
  { id: 'Duits', label: 'Duits', domain: 'Duitse taal, Wortschatz, Grammatik — Duitse termen behouden hun originele spelling' },
  { id: 'Lichamelijke opvoeding', label: 'Lichamelijke opvoeding (LO)', domain: 'sport, beweging, lichaamsbouw, fitness, spelvormen, atletiek, zwemmen en gymnastiek' },
  { id: 'Levensbeschouwing-RK', label: 'Rooms-Katholieke godsdienst', domain: 'rooms-katholieke godsdienst, theologie, kerkgeschiedenis, sacramenten, ethiek en spiritualiteit' },
  { id: 'Levensbeschouwing-Islam', label: 'Islamitische godsdienst', domain: 'islam, Koran, islamitische tradities, theologie en ethiek' },
  { id: 'Levensbeschouwing-NC', label: 'Niet-confessionele zedenleer', domain: 'filosofie, ethiek, mensenrechten, vrijzinnig humanisme en moraalwetenschap' },
  { id: 'Wiskunde', label: 'Wiskunde', domain: 'wiskundige begrippen, getallen, algebra, meetkunde, functies, statistiek en kansrekenen' },
  { id: 'Natuurwetenschappen', label: 'Natuurwetenschappen', domain: 'biologie (cellen, erfelijkheid, anatomie), chemie, fysica (energie, warmte, krachten) en wetenschappelijk redeneren' },
  { id: 'Aardrijkskunde', label: 'Aardrijkskunde', domain: 'fysische en menselijke geografie, klimaat, atmosfeer, bevolking, kaartlezen en aarderuimte' },
  { id: 'Geschiedenis', label: 'Geschiedenis en Burgerschap', domain: 'historische gebeurtenissen, periodes, samenleving, burgerschap, democratie en mensenrechten' },
  { id: 'Cultuurbeleving', label: 'Cultuurbeleving', domain: 'cultureel bewustzijn, kunst, literatuur, muziek, theater en culturele diversiteit' },
  { id: 'T-ART', label: 'T-ART (Technologie & ART)', domain: 'beeldende kunsten, plastiek, vormgeving, mediawijsheid en veilig online gedrag' },
  { id: 'Economie-FG', label: 'Economie — financiële geletterdheid', domain: 'persoonlijke financiën, budgetteren, sparen, lenen, banken en consumentengedrag' },
  { id: 'MAVO', label: 'MAVO (Maatschappelijke Vorming)', domain: 'maatschappelijke vorming, sociale vaardigheden, samenleving en actualiteit' },
  { id: 'Onderzoekscompetenties', label: 'Onderzoekscompetenties', domain: 'wetenschappelijk onderzoek, methodologie, bronnenkritiek en academisch schrijven' },
];

// ─────────────────────────────────────────────────────────────────────────────
// OKAN — Thema\'s per fase (geen "richting" — direct vak per fase)
// ─────────────────────────────────────────────────────────────────────────────

export const OKAN_THEMAS_PER_FASE: Record<string, Vak[]> = {
  'Fase 1': [
    { id: 'OKAN-Fase1-School', label: '1. De school', domain: 'het schoolleven: klaslokaal, leerkracht, materiaal, vakken en schoolregels — basis Nederlands voor anderstaligen (OKAN)' },
    { id: 'OKAN-Fase1-Lichaam', label: '2. Het lichaam', domain: 'lichaamsdelen, gezondheid en lichaamsverzorging — basiswoordenschat Nederlands (OKAN)' },
    { id: 'OKAN-Fase1-Familie', label: '3. Familie en vrienden', domain: 'familieleden, vriendschap, relaties en gevoelens — basiswoordenschat Nederlands (OKAN)' },
    { id: 'OKAN-Fase1-Eten', label: '4. Eten en drinken', domain: 'voedsel, maaltijden, dranken, koken en boodschappen — basiswoordenschat Nederlands (OKAN)' },
    { id: 'OKAN-Fase1-Kleding', label: '5. Kleding', domain: 'kledingstukken, kleuren, schoenen, accessoires en het aankleden — basiswoordenschat Nederlands (OKAN)' },
    { id: 'OKAN-Fase1-Huis', label: '6. Het huis', domain: 'het huis, kamers, meubilair, huishoudtoestellen en wonen — basiswoordenschat Nederlands (OKAN)' },
    { id: 'OKAN-Fase1-Omgeving', label: '7. Mijn omgeving', domain: 'de buurt, gebouwen, winkels, straten en transport in de directe omgeving — basiswoordenschat Nederlands (OKAN)' },
    { id: 'OKAN-Fase1-Seizoenen', label: '8. De seizoenen', domain: 'de vier seizoenen, weer, temperatuur, maanden en typische activiteiten per seizoen — basiswoordenschat Nederlands (OKAN)' },
  ],
  'Fase 2': [
    { id: 'OKAN-Fase2-Tijd', label: '1. Seizoenen en tijd', domain: 'tijdsaanduidingen, dagen, maanden, jaargetijden, klokkijken en agenda — Nederlands voor anderstaligen (OKAN)' },
    { id: 'OKAN-Fase2-Emoties', label: '2. Emoties en zintuigen', domain: 'gevoelens, emoties, zintuigen (zien, horen, ruiken, proeven, voelen) en gemoedstoestanden — Nederlands voor anderstaligen (OKAN)' },
    { id: 'OKAN-Fase2-VrijeTijd', label: '3. Vrije tijd', domain: 'hobby\'s, sporten, spelletjes, ontspanning, uitgaan en vakantie — Nederlands voor anderstaligen (OKAN)' },
    { id: 'OKAN-Fase2-Natuur', label: '4. Natuur en dieren', domain: 'natuur, planten, bomen, dieren (huisdieren, wilde dieren) en het landschap — Nederlands voor anderstaligen (OKAN)' },
    { id: 'OKAN-Fase2-Verkeer', label: '5. Verkeer', domain: 'verkeer, voertuigen, verkeersborden, verkeersregels en mobiliteit — Nederlands voor anderstaligen (OKAN)' },
    { id: 'OKAN-Fase2-Milieu', label: '6. Afval en milieu', domain: 'afvalsoorten, recyclage, milieubescherming, duurzaamheid en klimaat — Nederlands voor anderstaligen (OKAN)' },
    { id: 'OKAN-Fase2-Openbaar', label: '7. Openbare ruimte en diensten', domain: 'openbare gebouwen, instellingen, openbare diensten (post, bank, ziekenhuis) en publieke ruimtes — Nederlands voor anderstaligen (OKAN)' },
    { id: 'OKAN-Fase2-Beroepen', label: '8. Beroepen', domain: 'verschillende beroepen, werkomgeving, werkgerelateerde activiteiten en functies — Nederlands voor anderstaligen (OKAN)' },
    { id: 'OKAN-Fase2-Talenten', label: '9. Talenten en eigenschappen', domain: 'persoonlijke talenten, karaktertrekken, eigenschappen, vaardigheden en zelfbeschrijving — Nederlands voor anderstaligen (OKAN)' },
    { id: 'OKAN-Fase2-ICT', label: 'ICT', domain: 'informatica, computers, hardware, software, internet, apps, besturingssystemen (Windows, iOS, Android), digitale vaardigheden en cybersecurity (virussen, malware) — Nederlands voor anderstaligen (OKAN)' },
  ],
  'Fase 3': [
    { id: 'OKAN-Fase3-Gezondheid', label: 'Gezondheid (hygiëne, voeding)', domain: 'gezondheid, persoonlijke hygiëne, voeding, gezond eten en lichaamsverzorging — Nederlands voor anderstaligen (OKAN)' },
    { id: 'OKAN-Fase3-ICT', label: 'ICT', domain: 'informatica, computers, hardware, software, internet, apps, besturingssystemen (Windows, iOS, Android), digitale vaardigheden en cybersecurity (virussen, malware) — Nederlands voor anderstaligen (OKAN)' },
    { id: 'OKAN-Fase3-Schooltaal', label: 'Schooltaalwoorden', domain: 'algemene schooltaal: instructie-woorden, abstracte concepten, schoolvak-overstijgende termen die voorkomen in opdrachten en lesmateriaal — Nederlands voor anderstaligen (OKAN)' },
    { id: 'OKAN-Fase3-Wero', label: 'Wero (wereldoriëntatie)', domain: 'wereldoriëntatie: aardrijkskunde, geschiedenis, natuur, samenleving en cultuur op begrijpelijk niveau — Nederlands voor anderstaligen (OKAN)' },
  ],
  'Fase 4': [
    { id: 'OKAN-Fase4-Aardrijkskunde', label: 'Aardrijkskunde', domain: 'aardrijkskundige begrippen: klimaat, landschappen, bevolking, kaartlezen en aardrijkskunde — Nederlands voor anderstaligen (OKAN)' },
    { id: 'OKAN-Fase4-Economie', label: 'Economie en organisatie', domain: 'economische begrippen: vraag en aanbod, geld, ondernemen, arbeid en organisatie — Nederlands voor anderstaligen (OKAN)' },
    { id: 'OKAN-Fase4-Geschiedenis', label: 'Geschiedenis', domain: 'historische periodes, gebeurtenissen, personen en samenleving doorheen de tijd — Nederlands voor anderstaligen (OKAN)' },
    { id: 'OKAN-Fase4-Gezondheid', label: 'Gezondheid (genotsmiddelen, relaties)', domain: 'gezondheid, genotsmiddelen (alcohol, tabak, drugs), relaties en seksualiteit — Nederlands voor anderstaligen (OKAN)' },
    { id: 'OKAN-Fase4-MaatWelz', label: 'Maatschappij en welzijn', domain: 'samenleving, welzijn, sociale problemen, hulpverlening en burgerschap — Nederlands voor anderstaligen (OKAN)' },
    { id: 'OKAN-Fase4-Natuurwet', label: 'Natuurwetenschappen', domain: 'natuurwetenschappelijke begrippen: biologie, chemie, fysica — Nederlands voor anderstaligen (OKAN)' },
    { id: 'OKAN-Fase4-PAV', label: 'PAV', domain: 'maatschappelijke onderwerpen, burgerschap, mediawijsheid en algemene vorming — Nederlands voor anderstaligen (OKAN)' },
    { id: 'OKAN-Fase4-Schooltaal', label: 'Schooltaalwoorden', domain: 'algemene schooltaal: instructie-woorden, abstracte concepten en schoolvak-overstijgende termen — Nederlands voor anderstaligen (OKAN)' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// SPECIFIEKE RICHTINGEN — vakken per richtingscode (uit OneDrive)
// Key = richting-code (zonder graad-prefix, dus "APPDA" niet "5 APPDA").
// ─────────────────────────────────────────────────────────────────────────────

export const RICHTING_VAKKEN: Record<string, Vak[]> = {
  // ━━ 2e graad AF ━━
  'ELEK': [
    { id: 'ELEK-Elektriciteit', label: 'Elektriciteit', domain: 'elektriciteit, stroomkringen, spanning, vermogen, installaties en elektrotechnische basisbegrippen' },
  ],
  'HT': [
    { id: 'HT-Houtbewerking', label: 'Houtbewerking', domain: 'houtbewerking, schrijnwerkerij, gereedschappen, materialen, technieken en houtsoorten' },
  ],
  'MECH': [
    { id: 'MECH-Mechanica', label: 'Mechanica', domain: 'mechanische technieken, machines, gereedschappen, materialen en onderhoud' },
  ],
  'O&L': [
    { id: 'O&L-Economie-Logistiek', label: 'Toegepaste economie (logistiek)', domain: 'logistieke processen, transport, magazijnbeheer, voorraad en distributie' },
    { id: 'O&L-Economie-Organisatie', label: 'Toegepaste economie (organisatie)', domain: 'bedrijfsorganisatie, structuur, processen en kantoorbeheer' },
    { id: 'O&L-Economie-Sales', label: 'Toegepaste economie (sales)', domain: 'verkoop, klantencontact, sales-technieken en commerciële vaardigheden' },
    { id: 'O&L-Informatica', label: 'Toegepaste informatica (Office)', domain: 'informatica, Microsoft Office (Word, Excel), tekstverwerking en rekenbladen' },
    { id: 'O&L-Nederlands', label: 'Nederlands + (richting)', domain: 'professioneel Nederlands voor administratie, klantencontact en logistiek' },
  ],
  'Z&W': [
    { id: 'Z&W-IndirecteZorg', label: 'Indirecte zorg', domain: 'indirecte zorgtaken: huishoudelijke organisatie, hygiëne, linnenzorg en algemene zorgcontext (geen patiëntencontact)' },
    { id: 'Z&W-Opvoedkunde', label: 'Opvoedkunde / Pedagogisch handelen', domain: 'pedagogisch handelen, opvoeding, ontwikkeling van kinderen en jongeren, communicatieve vaardigheden' },
    { id: 'Z&W-Verzorging', label: 'Verzorging', domain: 'persoonlijke verzorging, hygiëne, dagelijkse zorgtaken voor verschillende doelgroepen' },
    { id: 'Z&W-Voeding', label: 'Voeding', domain: 'voeding, voedingsleer, dieet per levensfase (baby, peuter, kleuter, volwassene, oudere)' },
  ],
  // ━━ 2e graad DF ━━
  'B&O': [
    { id: 'B&O-HandelsEco', label: 'Toegepaste economie — (handels)economie', domain: 'handelseconomie, bedrijfseconomische kringloop, markten, internationale handel en verkoopprocessen' },
    { id: 'B&O-Boekhouden', label: 'Toegepaste economie — boekhouden', domain: 'boekhouden, balans, resultatenrekening, BTW, journaalposten, rekeningen en het MAR' },
    { id: 'B&O-Informatica', label: 'Toegepaste informatica (Office)', domain: 'Microsoft Office: Word (tekstverwerking) en Excel (rekenbladen, formules)' },
  ],
  'EMT': [
    { id: 'EMT-Elektromechanica', label: 'Elektromechanica', domain: 'elektromechanica, combinatie van elektriciteit en mechanica, machines, installaties en automatisering' },
  ],
  'M&W': [
    { id: 'M&W-Opvoedkunde', label: 'Opvoedkunde en Toegepaste biologie', domain: 'opvoedkunde, ontwikkelingspsychologie en menselijke biologie (anatomie, fysiologie) in welzijnscontext' },
    { id: 'M&W-Psychologie', label: 'Toegepaste psychologie', domain: 'toegepaste psychologie: levensfasen (baby, peuter, jongere, volwassene, ouderen), gedrag, emoties en communicatie' },
    { id: 'M&W-Verzorging', label: 'Verzorging', domain: 'verzorging, anatomie (het oog), hygiëne en zorgvaardigheden binnen Maatschappij & Welzijn' },
  ],
  'SPORT': [
    { id: 'SPORT-Bewegingswet', label: 'Bewegingswetenschappen en Toegepaste biologie', domain: 'bewegingswetenschappen, anatomie, fysiologie, biomechanica en trainingsleer' },
    { id: 'SPORT-Sport', label: 'Sport (zwemmen, spelregels)', domain: 'sportspecifieke termen, spelregels, technieken en sporttakken (bv. zwemmen, atletiek)' },
    { id: 'SPORT-Psychologie', label: 'Toegepaste psychologie', domain: 'sportpsychologie, mentale aspecten van presteren, motivatie en levensfasen' },
  ],
  'W&L': [
    { id: 'W&L-Psychologie', label: 'Toegepaste psychologie', domain: 'toegepaste psychologie binnen wellness-context: communicatie, klantbenadering, levensfasen' },
    { id: 'W&L-Wellness', label: 'Wellness — make-up, hand-, gelaats-, voetverzorging', domain: 'wellness, schoonheidszorg: make-up, gelaats-, hand-, voet- en manicure/pedicure-technieken' },
  ],

  // ━━ 3e graad AF ━━
  'ASWZW': [
    { id: 'ASWZW-Algemeen', label: 'Algemene Sociale Werker Zorg & Welzijn', domain: 'sociale werker zorg & welzijn: zorg voor linnen, ruimten, voeding en schoonmaaktechnieken in instellingen' },
  ],
  'BASON': [
    { id: 'BASON-Algemeen', label: 'Basisonderhoud zorginstellingen', domain: 'basisonderhoud in zorginstellingen: schoonmaaktechnieken, linnenzorg, zorg voor ruimten en keukenbasis' },
  ],
  'BBSCH': [
    { id: 'BBSCH-Schrijnwerk', label: 'Bouw / Schrijnwerkerij', domain: 'schrijnwerkerij: binnendeuren, buitendeuren, ramen, poorten, daken, houtskeletbouw, trappen, gevelbekleding en machines' },
    { id: 'BBSCH-VCA', label: 'VCA (veiligheid)', domain: 'veiligheid op de werkvloer: VCA-normen, persoonlijke beschermingsmiddelen, risicoanalyse en preventie' },
  ],
  'ELINS': [
    { id: 'ELINS-Elektriciteit', label: 'Elektrische installaties', domain: 'elektrische installaties 3e graad: schakelingen, verdeelborden, kabels, normen en installatietechniek' },
    { id: 'ELINS-VCA', label: 'VCA (veiligheid)', domain: 'veiligheid: VCA-normen, persoonlijke beschermingsmiddelen, risicoanalyse en preventie' },
  ],
  'LASCO': [
    { id: 'LASCO-Lassen', label: 'Lassen-Constructie', domain: 'lastechnieken, constructie, lasprocessen, materialen, lasapparatuur en technisch tekenen' },
    { id: 'LASCO-VCA', label: 'VCA (veiligheid)', domain: 'veiligheid: VCA-normen, persoonlijke beschermingsmiddelen, risicoanalyse en preventie' },
  ],
  'LOGIS': [
    { id: 'LOGIS-Logistiek', label: 'Logistiek', domain: 'logistieke processen: transport, magazijn, voorraad, distributie en supply chain' },
  ],
  'ONOSA': [
    { id: 'ONOSA-Economie', label: 'Toegepaste economie', domain: 'onthaal, verkoop, winkelbeheer, sales, administratie en klantenservice' },
    { id: 'ONOSA-Informatica', label: 'Toegepaste informatica (Office)', domain: 'Microsoft Office: Word (tekstverwerking) en Excel (rekenbladen, formules) voor onthaal en sales' },
  ],
  'SANVI': [
    { id: 'SANVI-Sanitair', label: 'Sanitair & verwarmingsinstallaties', domain: 'sanitaire installaties, verwarming, leidingen, ketels en installatietechniek' },
    { id: 'SANVI-VCA', label: 'VCA (veiligheid)', domain: 'veiligheid: VCA-normen, persoonlijke beschermingsmiddelen, risicoanalyse en preventie' },
  ],

  // ━━ 3e graad DF ━━
  'APPDA': [
    { id: 'APPDA-Informatica', label: 'Toegepaste informatica (algemeen)', domain: 'informatica met lidwoorden: algemene IT-termen, hardware, software, netwerken — basis voor APPDA' },
    { id: 'APPDA-Databanken', label: 'Databanken (Access)', domain: 'databanken: tabellen, relaties, queries, Microsoft Access, SQL-basics en data-modellering' },
    { id: 'APPDA-Programmeren', label: 'Softwareontwikkeling (C#)', domain: 'softwareontwikkeling met C#: variabelen, functies, klassen, OOP-principes en .NET' },
    { id: 'APPDA-SQL', label: 'SQL en databases', domain: 'SQL: queries, joins, indexen, normalisatie en relationele databanken' },
    { id: 'APPDA-Hardware', label: 'Hardware', domain: 'computer-hardware: CPU, RAM, opslag, randapparatuur, moederbord en componenten' },
    { id: 'APPDA-Netwerken', label: 'Netwerken', domain: 'netwerken: TCP/IP, routers, switches, OSI-model, Wi-Fi, internet en cybersecurity' },
    { id: 'APPDA-Webdesign', label: 'Webdesign', domain: 'webdesign: HTML, CSS, JavaScript, responsive design en gebruikersinterfaces' },
    { id: 'APPDA-Office', label: 'Microsoft Office (Word, Excel)', domain: 'Microsoft Office: Word (tekstverwerking) en Excel (rekenbladen, formules)' },
  ],
  'BORGA': [
    { id: 'BORGA-Bedrijfswet', label: 'Bedrijfswetenschappen', domain: 'bedrijfswetenschappen: organisatiekunde, management, bedrijfsprocessen en strategie' },
    { id: 'BORGA-Economie', label: 'Economie (algemeen)', domain: 'algemene economie: macro- en micro-economie, markten, conjunctuur en economisch beleid' },
    { id: 'BORGA-Boekhouden', label: 'Toegepaste economie — boekhouden', domain: 'boekhouden, balans, resultatenrekening, BTW, journaalposten en rekeningen' },
    { id: 'BORGA-HR', label: 'Toegepaste economie — HR', domain: 'HR (Human Resources Management): werving, selectie, evaluatie, opleiding, arbeidsovereenkomst en arbeidsreglement' },
    { id: 'BORGA-Informatica', label: 'Toegepaste informatica (Excel, Access)', domain: 'Microsoft Excel (rekenbladen, formules), Access (databanken) voor bedrijfsorganisatie' },
    { id: 'BORGA-Wiskunde', label: 'Wiskunde +', domain: 'toegepaste wiskunde: annuïteiten, financiële berekeningen, statistiek en kansrekenen' },
  ],
  'EMTEC': [
    { id: 'EMTEC-Elektromech', label: 'Elektromechanica', domain: 'elektromechanica 3e graad: combinatie elektriciteit en mechanica, automatisering, machines en installaties' },
  ],
  'GEZORG': [
    { id: 'GEZORG-Voeding', label: 'Voedingsleer', domain: 'voedingsleer, gezonde voeding, voedingsmodel, voedingsstoffen en dieetleer voor zorgcontext' },
    { id: 'GEZORG-Schoonmaak', label: 'Schoonmaaktechnieken', domain: 'schoonmaak- en hygiënetechnieken in zorginstellingen, materialen en procedures' },
    { id: 'GEZORG-Verzorging', label: 'Verzorging', domain: 'verpleegkundige verzorging, hygiëne, zorgtechnieken en zorg voor patiënten in ziekenhuis- of woonzorgcontext' },
    { id: 'GEZORG-LEF', label: 'Beeldwoordenboek LEF (zorg)', domain: 'visueel woordenboek voor zorg: alledaagse voorwerpen, situaties en handelingen in zorgcontext' },
  ],
  'INHAL': [
    { id: 'INHAL-Bedrijfswet', label: 'Bedrijfswetenschappen', domain: 'bedrijfswetenschappen binnen internationale handel: organisatie, management en strategie' },
    { id: 'INHAL-Economie', label: 'Economie', domain: 'algemene economie en internationale economie: handel, instellingen en globalisering' },
    { id: 'INHAL-Logistiek', label: 'Logistiek', domain: 'logistiek: tussenpersonen, internationaal handelsverkeer, magazijnbeheer, transport en supply chain' },
    { id: 'INHAL-Informatica', label: 'Toegepaste informatica (Excel, Access)', domain: 'Microsoft Excel (rekenbladen) en Access (databanken) voor logistiek en handel' },
  ],
  'OPBEG': [
    { id: 'OPBEG-Pedagogiek', label: 'Pedagogiek / Opvoedkunde', domain: 'pedagogiek, ontwikkelingspsychologie, opvoedkundig handelen en begeleiden van diverse doelgroepen (kinderen, jongeren, ouderen)' },
    { id: 'OPBEG-Voeding', label: 'Voedingsleer', domain: 'voedingsleer, voedingsmodel en gezonde voeding binnen pedagogische context' },
    { id: 'OPBEG-Schoonmaak', label: 'Schoonmaaktechnieken', domain: 'schoonmaak- en hygiënetechnieken in pedagogische instellingen (kinderopvang, scholen)' },
  ],
  'SPOBE': [
    { id: 'SPOBE-Bewegingswet', label: 'Bewegingswetenschappen', domain: 'bewegingswetenschappen 3e graad: biomechanica, trainingsleer, fysiologie van inspanning' },
    { id: 'SPOBE-Sportbegel', label: 'Sportbegeleiding', domain: 'sportbegeleiding: coaching, trainingsmethoden, animatie, lesgeven en sportorganisatie' },
    { id: 'SPOBE-Psychologie', label: 'Toegepaste psychologie', domain: 'sportpsychologie: motivatie, prestatiedruk, mentale training en communicatie' },
    { id: 'SPOBE-Biologie', label: 'Toegepaste biologie (anatomie, fysiologie)', domain: 'toegepaste biologie voor sport: anatomie, fysiologie, spiergroepen en lichaamssystemen' },
  ],
  'WESCH': [
    { id: 'WESCH-Gelaat', label: 'Gelaatsverzorging', domain: 'gelaatsverzorging: huidanalyse, reiniging, peeling, masker, gelaatsmassage en cosmetische producten' },
    { id: 'WESCH-Hand', label: 'Handverzorging (manicure)', domain: 'handverzorging: manicure-technieken, nagelverzorging, nagellak en handmassage' },
    { id: 'WESCH-Voet', label: 'Voetverzorging (pedicure)', domain: 'voetverzorging: pedicure-technieken, voetmassage en voetbehandelingen' },
    { id: 'WESCH-Makeup', label: 'Make-up', domain: 'make-up: technieken, producten, kleurleer en visagie' },
    { id: 'WESCH-Biologie', label: 'Toegepaste biologie (huid)', domain: 'toegepaste biologie voor wellness: anatomie van de huid, fysiologie en haar' },
  ],

  // ━━ 7e jaar AF ━━
  'HO': [
    { id: '7HO-Natuurwet', label: 'Natuurwetenschappen', domain: 'natuurwetenschappen 7e jaar: verdieping biologie, chemie en fysica' },
    { id: '7HO-Nederlands', label: 'Vaktaal Nederlands', domain: 'professionele Nederlandse vaktaal voor het zevende jaar en hoger onderwijs' },
  ],
  'KB': [
    { id: '7KB-Voedingsleer', label: 'Voedingsleer', domain: 'voedingsleer en voedingsmodel voor kinderbegeleider' },
    { id: '7KB-Pedagogiek', label: 'Pedagogiek / Opvoedkunde', domain: 'pedagogiek en opvoedkunde voor kinderbegeleider' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// ALGEMENE OPTIES — altijd beschikbaar als fallback
// ─────────────────────────────────────────────────────────────────────────────

export const ALGEMENE_VAKKEN: Vak[] = [
  { id: 'ICT-Algemeen', label: 'ICT / Informatica (algemeen)', domain: 'informatica, computerwetenschappen, software, hardware, besturingssystemen (Windows, macOS, iOS, Android, Linux), netwerken, internet, cybersecurity, malware (virussen, trojans), digitale vaardigheden en computertoepassingen' },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Levert alle vakken voor een gegeven (finaliteit, jaargang, richting)-combo.
 * Wordt gebruikt om de UI-dropdown bij upload te vullen.
 *
 *  - OKAN: enkel de thema's voor de gekozen fase (geen "richting" concept).
 *  - AF/DF basisvorming: alle basisvorming-vakken + algemene fallbacks.
 *  - AF/DF specifiek: basisvorming + richting-specifieke vakken.
 */
export function getVakkenForUpload({
  finaliteit,
  jaargang,
  richting,
  vakType,
}: {
  finaliteit?: string;
  jaargang?: string;
  richting?: string;
  vakType?: 'basisvorming' | 'specifiek' | string | null;
}): Vak[] {
  // OKAN: vakken per fase
  if (finaliteit === 'OKAN' && jaargang) {
    return OKAN_THEMAS_PER_FASE[jaargang] ?? [];
  }

  // AF/DF basisvorming: alle algemene vakken
  if (vakType === 'basisvorming') {
    return [...BASISVORMING_VAKKEN, ...ALGEMENE_VAKKEN];
  }

  // AF/DF specifiek: richting-specifieke vakken + ICT als fallback (vaak relevant)
  if (vakType === 'specifiek' && richting) {
    const code = extractRichtingCode(richting);
    const richtingVakken = code ? RICHTING_VAKKEN[code] : undefined;
    return [...(richtingVakken ?? []), ...ALGEMENE_VAKKEN];
  }

  // Onbekend / fallback: alles
  return [...BASISVORMING_VAKKEN, ...ALGEMENE_VAKKEN];
}

/**
 * Extraheert de richtingscode uit een UI-string.
 * Voorbeelden:
 *   "5 APPDA"                          → "APPDA"
 *   "Applicatie- & Databeheer (APPDA)" → "APPDA"
 *   "3 Z&W"                            → "Z&W"
 *   "AF 5 — Applicatie- & Databeheer (APPDA)" → "APPDA"
 */
function extractRichtingCode(richting: string): string | null {
  // Eerst proberen: code tussen haakjes
  const parenMatch = richting.match(/\(([A-Z&]+)\)\s*$/);
  if (parenMatch) return parenMatch[1];

  // Daarna: laatste woord (na eventuele graad-prefix)
  const trimmed = richting.replace(/^\d+\s+/, '').trim();
  const lastWord = trimmed.split(/\s+|—/).pop()?.trim();
  if (lastWord && /^[A-Z&]+$/.test(lastWord)) return lastWord;

  return null;
}

/**
 * Levert ALLE vakken (over alle finaliteiten + OKAN + richtingen) als platte lijst.
 * Wordt gebruikt om de subjectMap in geminiService.ts te bouwen.
 */
export function getAllVakken(): Vak[] {
  const all: Vak[] = [...BASISVORMING_VAKKEN, ...ALGEMENE_VAKKEN];
  Object.values(OKAN_THEMAS_PER_FASE).forEach(faseVakken => all.push(...faseVakken));
  Object.values(RICHTING_VAKKEN).forEach(richtingVakken => all.push(...richtingVakken));
  return all;
}

/**
 * Bouwt een Record<id, domain> uit alle vakken — handig voor subjectMap.
 */
export function getVakDomainMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const vak of getAllVakken()) {
    map[vak.id] = vak.domain;
  }
  return map;
}
