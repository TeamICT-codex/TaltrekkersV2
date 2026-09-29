# Testomgeving — TALent voor Taal

## Wat is dit?

Een **aparte, lege Supabase-databank** (een "testproject") om nieuwe functies veilig uit te proberen.
Eerst de gedeelde opslag van Frayer-modellen (de "Frayer-cache"): een woord dat al eens gemaakt werd,
komt dan meteen uit de databank in plaats van opnieuw uit Gemini. Sneller en goedkoper.

De echte databank van de school (**live**) blijft onaangeroerd. Daar zorgen drie sloten voor:

- De AI-proxy schrijft **enkel in productie** (de echte site op Vercel) in de cache van de live databank.
  Op je eigen computer of in een voorbeeldversie staat de cache uit zodra de databank live is.
- `npm run test:api` **weigert te starten** zolang `.env.local` naar de live databank wijst.
- In deze map staan **geen sleutels**. Die zet je zelf in `.env.local` (dat bestand gaat nooit naar GitHub).

## Wat moet jij doen? (eenmalig)

### 1. Een nieuw Supabase-project maken (gratis)

Het testproject past ruim in het gratis plan (**Free**, $0 per maand). Maak het in een **aparte organisatie**:
zit de live app in een organisatie met een betalend plan, dan kost elk extra project daar ongeveer $10 per maand.
Een aparte gratis organisatie kost niets en houdt test en live ook in het dashboard netjes uit elkaar.

1. Ga naar supabase.com. Klik bovenaan op de naam van je organisatie → **New organization**.
   Naam: bijvoorbeeld `TALent testomgeving`. Plan: **Free**.
2. In die nieuwe organisatie: **New project**. Naam: bijvoorbeeld `talent-voor-taal-test`.
3. Regio: **in de EU**, bijvoorbeeld *Central EU (Frankfurt)*.
4. Kies een sterk databankwachtwoord en bewaar het in je wachtwoordbeheerder. Niemand anders heeft het nodig.

**Melding dat je al 2 gratis projecten hebt?** Supabase laat per persoon 2 actieve gratis projecten toe, over al je
organisaties samen. Gepauzeerde projecten tellen niet mee. Pauzeer dan een oud project dat je niet meer gebruikt,
maar **nooit het live-project** (`armszlatvhjyolbzasrc`): dan ligt de app in de klas plat.

**Na een week zonder gebruik** valt een gratis project in slaap. Klik dan in het dashboard op **Restore project**.
Is er toch iets weg, dan bouw je de testdatabank gewoon opnieuw op met stap 2.

### 2. De structuur aanmaken

1. Open in het **nieuwe testproject** de **SQL Editor** → **New query**.
2. Open `test-omgeving/opzet-testdatabank.sql` in Kladblok, kopieer **alles** en plak het in de editor.
3. Klik **Run**. Je ziet "Success. No rows returned".

Let op: doe dit **nooit** in het live-project. Opnieuw uitvoeren in het testproject mag: er verandert dan niets.

**Leerkrachtcode (optioneel).** Er staat bewust geen leerkrachtcode in de testdatabank.
Wil je in de test ook "leerkracht worden" uitproberen? Voer dan apart deze regel uit, **nadat** je
`VUL-IN` vervangen hebt door een zelfgekozen code van minstens 10 tekens (niet de code van live).
Ongewijzigd uitvoeren geeft gewoon een foutmelding ("minstens 10 tekens").

```sql
SELECT private.set_teacher_code('VUL-IN');
```

### 3. Aanmelden toelaten vanaf je computer

In het testproject:

1. **Authentication → URL Configuration**
   - Site URL: `http://localhost:8080`
   - Redirect URLs: voeg deze twee toe: `http://localhost:8080/**` en `http://localhost:8081/**`
2. **Authentication → Sign In / Providers → Email**: moet **aan** staan (standaard is dat zo).
   De test maakt er een tijdelijke testgebruiker mee aan en verwijdert die daarna weer.

Aanmelden met Microsoft werkt in het testproject niet (dat is enkel voor live ingesteld).
In de app meld je aan met de **e-maillink**. Het ingebouwde mailsysteem van Supabase heeft twee grenzen:

- het stuurt enkel naar **leden van de organisatie**, dus naar het adres waarmee jij bij Supabase aanmeldt;
- het stuurt hooguit **2 mails per uur**.

De app laat bovendien enkel adressen op `@hetleercollectief.be` of `@gotalok.be` binnen.
Meld je bij Supabase aan met een ander adres (bijvoorbeeld via GitHub)? Laat het de architect weten.
Voor testen als leerling of als tweede gebruiker kan de architect aanmeldlinks klaarzetten die geen mail nodig hebben.

### 4. De sleutels in `.env.local` zetten — zelf, nooit in een chat plakken

1. In het testproject heb je drie dingen nodig:
   - de **Project URL** (`https://….supabase.co`) — op de startpagina van het project, of via de knop **Connect**
   - de **publishable key** (of *anon public*) — bij **Project Settings → API Keys**
   - de **secret key** (of *service_role*) — ook bij **Project Settings → API Keys**; dit is een geheime sleutel
2. Open `.env.local` in de map `TALTREKKERS-cache` met Kladblok.
3. Zet een `#` vóór de twee bestaande live-regels `VITE_SUPABASE_URL=…` en `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=…`
   (zo kun je later makkelijk terug).
4. Voeg onderaan toe (met jouw waarden, zonder de `<` en `>`):

   ```
   VITE_SUPABASE_URL=<Project URL van het testproject>
   VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=<publishable key van het testproject>
   SUPABASE_SERVICE_ROLE_KEY=<secret key van het testproject>
   ```

   - De geheime sleutel heet **`SUPABASE_SERVICE_ROLE_KEY`**, **zonder** `VITE_` ervoor.
     Alles met `VITE_` komt in de publieke app terecht; de build weigert zo'n sleutel ook.
   - `VITE_GEMINI_API_KEY` laat je gewoon staan.
5. Bewaar het bestand. Laat de architect weten dat het klaar is — **zonder** de sleutels door te sturen.

### Terug naar live (na het testen)

Haal in `.env.local` de drie test-regels weg (of zet er een `#` voor) en haal de `#` weg vóór de twee live-regels.
De banner van `npm run dev:api` toont altijd tegen welke databank je werkt.

## Wat de architect daarna draait

Alles in de werkmap `TALTREKKERS-cache`:

| Opdracht | Wat het doet | Databank nodig? |
|---|---|---|
| `npm run validate:sql` | SQL-bestanden controleren in een Postgres in het geheugen (PGlite) | nee |
| `npm run test:unit` | prompts byte-identiek met `main`, proxy-logica, browserkant | nee |
| `npm run test:rook` | 1 + 3 echte Gemini-aanroepen via de lokale proxy | nee |
| `npm run check:vercel` | de proxy bouwen met de echte Vercel-builder (± 3 min) en starten | nee |
| `npm run build` | productie-build + bundelbewaker (geen sleutels in de bundel) | nee |
| `npm run test:api` | de echte cachetest T0–T9 tegen de **testdatabank**; ruimt zelf op | **ja (test)** |

De app zelf via de lokale proxy, met cache, tegen de testdatabank:

1. Venster 1: `npm run dev:api` — controleer in de banner: *Frayer-cache AAN — testdatabank*.
2. Venster 2 (PowerShell): `$env:VITE_USE_PROXY='1'; npm run dev` en open http://localhost:8080.
3. Meld aan met de e-maillink. Oefen een woord twee keer: de tweede keer staat in venster 1 *— uit cache*.

## Wat zit er in deze map?

- **`opzet-testdatabank.sql`** — de volledige structuur van de live databank: `supabase-setup.sql` plus alle
  `migration-*.sql` op datum (zonder de verouderde `teacher-upgrade-rpc`), met `frayer_cache` als laatste.
  Zonder commentaar en in één transactie: lukt één stap niet, dan verandert er niets.
  Geen testgegevens en geen leerkrachtcode; enkel de lege standaardrij `global` in `game_settings`, die de app nodig heeft.
- **`frayer-cache-enkel.sql`** — enkel de tabel `frayer_cache`. Voor **later** op live, pas na akkoord. Nu niet uitvoeren.
- Beide bestanden worden gemaakt met `npm run validate:sql -- --schrijf`. Pas ze niet met de hand aan:
  `npm run validate:sql` meldt het wanneer ze niet meer overeenkomen met de migraties.
