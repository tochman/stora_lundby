# Stora Lundby - Föräldraengagemang

Ett system för att samla in och administrera föräldraengagemang (marknadspass, arbetsdagar, lotterigåvor,
stående roller m.m.) för Stora Lundby Scoutkår.

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

Se `Föräldraengagemang — Codebase Audit & User Stories`-dokumentet för bakgrunden till varför det ser ut
så här.

## Förutsättningar

- Node.js 18+ och npm
- Ett Google-konto för Apps Script-projektet och kalkylarket
- Ett OAuth 2.0-klient-ID från Google Cloud Console (för admin-inloggningen)
- Ett Netlify-konto (för deployment av klienten)

## Lokal utveckling

```bash
npm install
npm run dev
```

Appen körs på `http://localhost:5173` (publikt formulär) och `http://localhost:5173/admin.html`
(admin-dashboard).

Utan en `.env`-fil körs klienten i **demoläge**: den använder data i minnet istället för att anropa en
riktig backend, så du kan jobba med UI:t utan att ha satt upp Apps Script än. Så fort
`VITE_APPS_SCRIPT_URL` är satt (se nedan) pratar klienten med den riktiga backend-en, även i dev.

## Sätta upp backend (Google Apps Script)

1. **Skapa kalkylarket och Apps Script-projektet**
   - Gå till [script.google.com](https://script.google.com) och skapa ett nytt projekt (eller kör
     `clasp create` om ni föredrar CLI).
   - Klistra in innehållet i `Code.gs` och `appsscript.json` från det här repot.
2. **Peka ut kalkylarket**
   - Skapa en ny Google Sheet, kopiera dess ID från URL:en.
   - I Apps Script: Projektinställningar → Script Properties → lägg till `SPREADSHEET_ID`.
   - (Saknas `SPREADSHEET_ID` skapar backend-en ett nytt kalkylark automatiskt första gången den körs.)
3. **Skapa ett OAuth-klient-ID för admin-inloggningen**
   - I [Google Cloud Console](https://console.cloud.google.com/apis/credentials): skapa ett
     "OAuth 2.0 Client ID" av typen "Web application".
   - Lägg till er Netlify-domän (och `http://localhost:5173` för lokal utveckling) under
     "Authorized JavaScript origins".
   - I Apps Script: Script Properties → lägg till `GOOGLE_CLIENT_ID` med samma klient-ID. Det används för
     att verifiera att en inloggnings-token faktiskt var utfärdad till den här appen.
4. **Publicera som Web App**
   - Distribuera → Ny distribution → typ "Web app".
   - "Kör som": ditt konto. "Vem har åtkomst": "Alla" (appen autentiserar admin själv via ID-token, inte
     via Apps Scripts egen inloggningsmur).
   - Kopiera URL:en (slutar på `/exec`).
5. **Lägg till den första admin-användaren**
   - Öppna kalkylarket, fliken `Admins`, lägg till din e-postadress med `active = TRUE`.

## Konfigurera klienten

Skapa en `.env`-fil (se `.env.example`):

```
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/XXXXXXXXXXXXXXXXXXXXXXXXXXXX/exec
VITE_GOOGLE_CLIENT_ID=XXXXXXXXXXXX-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.apps.googleusercontent.com
```

## Build och deployment

```bash
npm run build
```

Bygger både `index.html` och `admin.html` till `dist/`. `netlify.toml` pekar Netlify på `npm run build`
och `dist` som publiceringskatalog, och redirectar `/admin` till `admin.html`.

Sätt `VITE_APPS_SCRIPT_URL` och `VITE_GOOGLE_CLIENT_ID` som miljövariabler i Netlifys build-inställningar
(Site settings → Environment variables) så att produktionsbygget pratar med rätt backend.

## Datastruktur (Google Sheets)

- **Activities**: det aktuella terminens händelser (marknadspass, arbetsdag, pysseldag,
  lotterigåvor, stående roller). `id, year, term, category, label, date, startTime, endTime, location,
  capacity, active, sortOrder`. Redigeras direkt i kalkylarket tills vidare - en admin-UI för detta är
  nästa steg (se användarberättelserna B1-B3).
- **Applications**: alla anmälningar. `id, createdAt, updatedAt, year, term, guardianName, guardianPhone,
  guardianEmail, scoutName, avdelning, selectedActivities (JSON-array av activity-id:n),
  ownSuggestionText, comments, status, internalNotes, consentGiven, consentAt, consentVersion`.
- **ConsentLog**: separat logg för GDPR-samtycke. `applicationId, personName, email, consentGivenAt,
  consentVersion, consentText, source`.
- **Config**: `currentYear, currentTerm, submissionDeadline, consentVersion, consentText`.
- **Admins**: `email, role, active`.

## Nästa steg

Se användarberättelserna i audit-dokumentet för resten av backloggen (B1-B3 admin-redigerbara
aktiviteter, C5-C7 manuell registrering/export/admin-hantering, A6-A7 bekräftelsemail och
redigera/återta anmälan, D2 gallringsrutin).

## Support

Kontakta projektledaren för frågor om setup eller integration.
