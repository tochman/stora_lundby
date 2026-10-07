# Stora Lundby - Föräldraengagemang

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Ett system för att samla in och administrera föräldraengagemang (marknadspass, arbetsdagar, lotterigåvor,
stående roller m.m.) för Stora Lundby Scoutkår - en digital ersättning för den årliga pappersblanketten.

Byggt specifikt för Stora Lundby, men tänkt att kunna återanvändas av andra föreningar - se
["Anpassa för en annan förening"](#anpassa-för-en-annan-förening) längst ner för vad som faktiskt behöver
bytas ut.

## Funktioner

**För föräldrar** (det publika formuläret):
- Ser terminens faktiska aktiviteter (marknadspass, arbetsdag, pysseldag) med datum, tid och plats - ingen
  hårdkodad lista i källkoden.
- Kan kryssa i flera aktiviteter, skänka en lotterivinst oberoende av pass, och/eller anmäla sig till en
  stående roll (marknadsgrupp, styrelsearbete, eget förslag).
- En aktivitet med en satt platsgräns visas som "Fullbokad" och går inte att kryssa i när gränsen är nådd.
- Får ett bekräftelsemail med vad de valt. Fyller de i formuläret igen med samma e-post uppdateras deras
  befintliga anmälan istället för att skapa en dubblett.
- Lämnar ett spårbart GDPR-samtycke vid varje anmälan/uppdatering.

**För administratörer** (adminpanelen på `/admin`, inloggning med Google-konto):
- Ser alla anmälningar, filtrerar på status/aktivitet/termin/sökterm, sätter status och interna
  anteckningar per anmälan.
- Ser hur många som anmält sig per aktivitet med en satt platsgräns ("Platser"-vyn).
- Lägger till/redigerar/tar bort terminens aktiviteter utan att röra kod, och kan kopiera föregående
  termins lista som utgångspunkt.
- Registrerar en pappersanmälan manuellt åt en förälder som hellre lämnar in den fysiska blanketten.
- Exporterar en CSV-lista grupperad per aktivitet, eller skriver ut ett kontaktblad (PDF via webbläsarens
  skriv ut) för en eller flera valda aktiviteter.
- Genererar en utskriven pappersblankett (Google Doc) med terminens aktiviteter, QR-kod till det digitala
  formuläret och föreningens logga.
- Hanterar vilka e-postadresser som har adminbehörighet, direkt i UI:t.
- Ser en logg över alla admin-inloggningar, och en logg över alla gallringar av gamla terminers data.
- Sätter gallringsperiod och raderar en specifik termins personuppgifter permanent, med loggad bekräftelse.

## Arkitektur

- **Klient**: React + Vite, två sidor i samma build - `index.html` (publikt formulär) och `admin.html`
  (admin-dashboard) - deployas till Netlify.
- **Backend**: Google Apps Script (`Code.gs`), som **bara** svarar med JSON via `doGet`/`doPost`. Den
  renderar aldrig HTML - `HtmlService` används inte.
- **Data**: Google Sheets, via Apps Script. Flikarna skapas och fylls med startdata automatiskt första
  gången backend körs (`initializeProject()`).
- **Transport**: `fetch()` mot den publicerade Apps Script Web App-URL:en, med JSON skickat som
  `text/plain` (för att undvika att Apps Script - som inte kan svara på en CORS-preflight - blockerar
  anropet).
- **Admin-inloggning**: Google Identity Services ("Sign in with Google") i admin-sidan. Den ID-token som
  webbläsaren får skickas med varje admin-anrop och verifieras i `Code.gs` mot `Admins`-fliken -
  `Session.getActiveUser()` används inte, eftersom det inte fungerar tillförlitligt för en fristående SPA.
- **Tester**: `test/code-gs/` körs i Node/Vitest mot en in-memory simulering av Apps Script-miljön (se
  `harness.js`), så backendlogiken (behörighet, validering, gallring, platsgränser m.m.) kan testas utan en
  riktig Google-miljö. `npm test` för att köra alla tester.

## Förutsättningar

- Node.js 18+ och npm
- Ett Google-konto för Apps Script-projektet och kalkylarket
- Ett OAuth 2.0-klient-ID från Google Cloud Console (för admin-inloggningen)
- Ett Netlify-konto (för deployment av klienten) - valfritt, allt annat fungerar utan Netlify specifikt

## Komma igång lokalt

```bash
npm install
npm run dev
```

Appen körs på `http://localhost:5173` (publikt formulär) och `http://localhost:5173/admin.html`
(admin-dashboard).

Klienten behöver en riktig backend även i dev - sätt `VITE_APPS_SCRIPT_URL` i `.env` (se
["Konfigurera klienten"](#konfigurera-klienten)). Det finns ingen mock-backend; `npm run dev` pratar med
samma Apps Script-deployment som produktion gör, om inte en separat dev-deployment satts upp.

```bash
npm test        # Vitest - backend-logiken i Code.gs
npm run build   # Produktionsbygge av båda sidorna till dist/
```

## Sätta upp backend (Google Apps Script)

Detta görs en gång per förening/deployment. Om du bara ska utveckla mot en redan uppsatt backend kan du
hoppa till ["Konfigurera klienten"](#konfigurera-klienten).

### 1. Skapa kalkylarket

Skapa en ny, tom Google Sheet (docs.new/spreadsheets, eller via Google Drive). Kopiera dess ID ur URL:en -
strängen mellan `/d/` och `/edit`, t.ex. `1AbCdEfGhIjKlMnOpQrStUvWxYz`. Flikarna (`Applications`,
`Config`, `Admins` osv.) och startdata skapas automatiskt av backend-en första gången den körs - du behöver
inte göra något mer i kalkylarket än att spara ID:t.

### 2. Skapa Apps Script-projektet

- Gå till [script.google.com](https://script.google.com) → "Nytt projekt".
- Döp projektet (t.ex. "Föräldraengagemang - backend").
- Ersätt det tomma `Code.gs`-innehållet med `Code.gs` från det här repot (klistra in allt).
- I vänstermenyn, klicka `+` bredvid "Filer" → "Skript" är redan skapat; `appsscript.json` ser du under
  Projektinställningar → "Visa filen "appsscript.json" i redigeraren" (kryssa i den rutan) - ersätt dess
  innehåll med `appsscript.json` från repot också (den sätter rätt OAuth-scopes och tidszon).

### 3. Peka ut kalkylarket

- Projektinställningar (kugghjulet) → Script Properties → "Lägg till skriptegenskap".
- Namn: `SPREADSHEET_ID`. Värde: ID:t du kopierade i steg 1.
- (Saknas `SPREADSHEET_ID` skapar backend-en ett helt nytt kalkylark automatiskt första gången den körs -
  bekvämt för en snabb test, men du vill nästan alltid peka ut ditt eget ark explicit.)

### 4. Skapa ett OAuth-klient-ID för admin-inloggningen

Detta är det steg som brukar kännas mest omständligt - här är det i detalj:

1. Gå till [Google Cloud Console](https://console.cloud.google.com/).
2. Skapa ett nytt projekt (eller återanvänd ett befintligt) via projektväljaren högst upp.
3. Sök upp **"OAuth consent screen"** i sidomenyn (API:er och tjänster → OAuth-samtyckesskärm).
   - User type: **External** (föreningens admins har oftast inte ett Google Workspace-organisationskonto
     kopplat till det här GCP-projektet).
   - Fyll i appens namn (t.ex. "Föräldraengagemang Admin"), din e-post som supportkontakt.
   - Scopes: inga extra behövs - admin-inloggningen använder bara den grundläggande profilen/e-posten
     Google Identity Services alltid delar.
   - Lägg till din egen e-post under "Test users" om samtyckesskärmen hamnar i "Testing"-läge (den
     behöver inte Googles granskning/publicering för det här användningsfallet - interna
     admin-användare räcker).
4. Gå till **"Credentials"** (Autentiseringsuppgifter) → "Skapa autentiseringsuppgifter" → "OAuth
   client ID".
   - Typ: **Web application**.
   - Namn: valfritt (t.ex. "Admin web client").
   - **Authorized JavaScript origins**: lägg till `http://localhost:5173` (för lokal utveckling). Lägg till
     er riktiga domän (t.ex. `https://er-forening.netlify.app`) senare, efter första deployen - se
     `DEPLOYMENT.md`.
   - Inga "Authorized redirect URIs" behövs - Google Identity Services' inloggningsknapp är
     popup-/token-baserad, inte en redirect-flow.
5. Skapa klienten. Kopiera **Client ID** (strängen som slutar på `.apps.googleusercontent.com`) - den
   behövs i två ställen: `.env` (klienten) och Script Properties (backend, nästa steg).

### 5. Koppla klient-ID:t till backend

- Tillbaka i Apps Script: Projektinställningar → Script Properties → "Lägg till skriptegenskap".
- Namn: `GOOGLE_CLIENT_ID`. Värde: samma Client ID som i steg 4.
- Detta används för att verifiera att en inloggnings-token faktiskt var utfärdad till just den här appen
  (`verifyGoogleIdToken` i `Code.gs` avvisar annars tokens med fel `aud`-claim).

### 6. Publicera som Web App

- I Apps Script-redigeraren: "Distribuera" (uppe till höger) → "Ny distribution".
- Typ: **Web app**.
- "Kör som": ditt konto (den identitet Apps Script faktiskt kör serversidans kod som - den har inget med
  vem som är inloggad i admin-panelen att göra). Detta är också avsändaradressen på bekräftelsemailet
  `submitApplication` skickar (`MailApp.sendEmail` i `Code.gs` - den skickar alltid som det här kontot,
  det finns inget separat "från"-fält) - distribuera med det Google-konto ni vill att föräldrarna ska se
  som avsändare, t.ex. en kårmail snarare än en privat adress, om ni har ett sådant konto tillgängligt.
- "Vem har åtkomst": **Alla** (appen autentiserar admin själv via ID-token i `requireAdmin`, inte via Apps
  Scripts egen inloggningsmur - "Alla" krävs för att det publika formuläret ska kunna skicka in svar utan
  att varje förälder behöver ett Google-konto).
- Klicka "Distribuera", godkänn behörigheterna (kalkylark, skicka e-post, Drive/Docs för pappersblanketten,
  extern hämtning för tokenverifiering och QR-koder).
- Kopiera URL:en som visas (slutar på `/exec`) - det är `VITE_APPS_SCRIPT_URL`.

**Viktigt**: varje gång du ändrar `Code.gs` efter detta måste du skapa en **ny distributionsversion**
(Distribuera → Hantera distributioner → redigera-pennan → "Ny version") för att ändringen ska synas på den
redan publicerade `/exec`-URL:en. Att bara spara filen i redigeraren uppdaterar inte en befintlig
distribution.

### 7. Lägg till den första admin-användaren

- Öppna kalkylarket (kör backend-en minst en gång först, t.ex. genom att öppna `/exec`-URL:en i
  webbläsaren, så att fliken skapas).
- Fliken `Admins` → lägg till en rad: din e-postadress, `role` = `admin`, `active` = `TRUE`.
- Utan en rad här kommer ingen - inklusive dig - in i adminpanelen, oavsett giltig Google-inloggning.

## Konfigurera klienten

Skapa en `.env`-fil (se `.env.example`):

```
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/XXXXXXXXXXXXXXXXXXXXXXXXXXXX/exec
VITE_GOOGLE_CLIENT_ID=XXXXXXXXXXXX-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.apps.googleusercontent.com
```

`VITE_ADMIN_EMAIL_DOMAIN` är valfri (se `.env.example`) - den styr bara vilken domän Googles kontoväljare
föreslår, inget säkerhetsbeslut i sig. Den faktiska behörighetskontrollen sker server-side i `Code.gs` mot
`Admins`-fliken och `Config`-värdet `adminEmailDomain`.

## Bygg och deployment

```bash
npm run build
```

Bygger både `index.html` och `admin.html` till `dist/`. `netlify.toml` pekar Netlify på `npm run build`
och `dist` som publiceringskatalog, och redirectar `/admin` till `admin.html`.

Se `DEPLOYMENT.md` för den fullständiga produktionsguiden (Netlify-steg, felsökning, driftrutiner).

## Datastruktur (Google Sheets)

Alla flikar skapas automatiskt av `initializeProject()` i `Code.gs` första gången backend-en körs.

- **Applications**: alla anmälningar. `id, createdAt, updatedAt, year, term, guardianName, guardianPhone,
  guardianEmail, scoutName, avdelning, selectedActivities (JSON-array av activity-id:n),
  ownSuggestionText, comments, status, internalNotes, consentGiven, consentAt, consentVersion`.
- **ConsentLog**: separat logg för GDPR-samtycke. `applicationId, personName, email, consentGivenAt,
  consentVersion, consentText, source`.
- **Config**: nyckel/värde-par. `currentYear, currentTerm, submissionDeadline, consentVersion,
  consentText, retentionPeriodMonths, adminEmailDomain, publicFormUrl`.
- **Admins**: `email, role, active`.
- **Activities**: terminens aktiviteter. `id, year, term, category, label, date, startTime, endTime,
  location, capacity, active, sortOrder`. `capacity` är valfri - lämnas den tom räknas ingen
  platsgräns ut. Är den satt returnerar backend-en även `signupCount`/`full` (beräknat vid varje läsning,
  inte lagrat) så både formuläret och adminpanelen kan visa/spärra en fullbokad aktivitet.
- **PurgeLog**: logg över gallring av gamla terminer (bara antal, aldrig de raderade uppgifterna).
  `purgedAt, purgedBy, year, term, applicationsPurged, consentLogPurged`.
- **PaperForms**: länk till varje genererad pappersblankett-Doc, en per termin.
  `year, term, docId, docUrl, createdAt, createdBy`.
- **LoginLog**: en rad per admin-inloggning (inte per API-anrop). `loggedInAt, email`.

## Anpassa för en annan förening

Koden är generell - formulärlogik, platsgränser, admin-dashboard, GDPR-loggning och gallring gäller för
vilken ideell förening som helst som samlar in föräldra-/medlemsengagemang per termin. Det som faktiskt är
hårdkodat för just Stora Lundby Scoutkår, och vad du behöver byta:

**Varumärke/grafik** (byt ut filerna, ingen kodändring krävs för själva bytet):
- `public/sl_logo.png` - wordmarken som visas i adminpanelen och på den genererade pappersblanketten.
- `public/lily-blue.svg`, `public/favicon.svg` - ikoner.
- `public/fonts/ScouternaRoundedPro.woff2` - **obs, licensierat typsnitt**: det används här under
  Stora Lundby Scoutkårs eget Scouterna-medlemskap, och ingår inte i MIT-licensen (se `LICENSE`). Byt ut
  det mot ett typsnitt du faktiskt har rätt att använda, eller ta bort `fontFamily.logo` i
  `tailwind.config.js` och låt `Logo.jsx` falla tillbaka på systemfonten.
- `tailwind.config.js` - `brand`/`accent`-färgerna är Stora Lundbys faktiska varumärkesblå/-grön.
- `src/components/Logo.jsx` och rubrikerna i `index.html`/`admin.html` - hårdkodad text "Stora Lundby".

**Text och innehåll** (kräver en kodändring, inte bara en konfig):
- `src/utils/constants.js` (`AVDELNINGAR`) - Scouternas åldersindelning. Byt till din förenings egna
  grupper/avdelningar.
- `Code.gs` → `DEFAULT_ACTIVITIES` - startdata för första körningen, kopierad från Stora Lundbys
  Höst 2026-blankett. Skriv om listan innan första körning, eller strunta i den och bygg upp terminens
  aktiviteter direkt i adminpanelens Aktiviteter-flik efteråt (det är precis vad den är till för).
- `Code.gs` → `generatePaperForm()` - brevtexten på pappersblankettens första sida ("Stora Lundby
  scoutkår drivs helt och hållet ideellt...", "Styrelsen i Stora Lundby Scoutkår") är Stora Lundbys egen
  text. Om din förening inte vill ha en utskriven pappersblankett alls går admin-knappen för det att bara
  lämnas oanvänd.
- `Config`-fliken → `consentText` och `publicFormUrl` är satta till Stora Lundbys egna standardvärden i
  `initializeProject()` i `Code.gs` - redigerbara direkt i adminpanelens Dataskydd-flik efter första
  körning, så det kräver ingen kodändring, bara en första omstart av konfigurationen.
- All UI-text och alla felmeddelanden är på svenska, rakt i källkoden (ingen i18n). En annan förening som
  vill ha ett annat språk behöver göra en sök-och-ersätt-insats i `src/` och `Code.gs` - det finns inget
  översättningslager att konfigurera.

**Domän/behörighet** (konfig, ingen kodändring):
- `adminEmailDomain` i `Config`-fliken (standard: `storalundby.se`) och motsvarande `.env`-värde
  `VITE_ADMIN_EMAIL_DOMAIN` - byt till din förenings e-postdomän, eller sätt till en tom sträng i `Config`
  för att tillåta admin-inloggning från vilken domän som helst (behörigheten styrs ändå av vem som faktiskt
  står i `Admins`-fliken).

## Support

Kontakta projektledaren för frågor om setup eller integration.

## Licens

Källkoden är licensierad under [MIT](LICENSE). Stora Lundby Scoutkårs logga, wordmark och det
Scouterna-licensierade typsnittet (se ["Anpassa för en annan förening"](#anpassa-för-en-annan-förening)
ovan) omfattas **inte** av MIT-licensen och ska bytas ut innan koden används av en annan förening.
