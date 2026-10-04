# Stora Lundby - Föräldraengagemang

Ett flexibelt system för att hantera föräldraengagemang, volontärarbete och stödbehov för Stora Lundby Scoutkår.

## 🚀 Funktionalitet

- **Publikt formulär**: Wizard-baserat flöde för föräldrar och volontärer
- **Admin-dashboard**: Hantera anmälningar, uppdatera status, se samtyckeslogg
- **GDPR-compliant**: Separat samtyckeslogg, transparent datakälla
- **Flexibel**: Stöd för flera år och terminer
- **Google Sheets-integration**: Data lagras i Google Sheets via Google Apps Script

## 📋 Förutsättningar

- Node.js 16+ och npm
- Google-konto med Google Apps Script-projekt
- Netlify-konto (för deployment)

## 🛠️ Lokal utveckling

### 1. Installera dependencies

```bash
npm install
```

### 2. Starta utvecklingsserver

```bash
npm run dev
```

Appen körs på `http://localhost:5173`.

### 3. Google Apps Script - lokal setup

Om du vill testa mot riktig Google Sheets-data:

1. **Skapa ett Google Apps Script-projekt**
   - Gå till [script.google.com](https://script.google.com)
   - Klicka "Nytt projekt"
   - Koda in filen `src/utils/googleAppsScriptBackend.gs` (finns i repot)

2. **Skapa en Google Sheet**
   - Skapa en ny Google Sheet
   - Kopiera dess ID från URL:en
   - I Apps Script-projektet, gå till "Projektinställningar"
   - Spara Sheet-ID:t i script properties

3. **Publicera Apps Script som web app**
   - I Apps Script, klicka "Distribuera" → "Ny distribution"
   - Välj typ "Web app"
   - "Kör som": Din Google-konto
   - "Vem har åtkomst": "Vem som helst"
   - Kopiera URL:en för web appen

4. **Uppdatera API-wrapper** (valfritt för lokal test)
   - Ändra `src/utils/googleAppsScriptApi.js` för att peka på din web app-URL

## 📦 Build och deployment

### Bygga för produktion

```bash
npm run build
```

Det skapar en `dist/`-mapp med optimerad kod.

### Deploy till Netlify

#### Alternativ 1: Via CLI

```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

#### Alternativ 2: Via GitHub (rekommenderat)

1. Push koden till GitHub
2. Länka repot till Netlify
   - Gå till [app.netlify.com](https://app.netlify.com)
   - Klicka "Add new site" → "Import an existing project"
   - Välj GitHub-repot
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Netlify bygger och deployr automatiskt vid varje push

## 🔗 Koppla public och admin

### Public form (Netlify)

1. Din Netlify-deploy URL är den publika formulärsidan
2. Dela denna URL med föräldrar/volontärer
3. Formuläret skickar data till Google Apps Script

### Admin-dashboard (Google Apps Script web app)

1. Publisera admin-sidan i Google Apps Script
2. Admin-sidan kräver Google-konto-autentisering
3. Admin kan se alla inlämningar direkt i Google Sheets

## 🗄️ Datastruktur

Google Sheets innehåller följande flikar:

- **Applications**: Alla inlämningar
  - id, createdAt, year, term, engagementType, supportArea, name, phone, email, childName, childClass, comments, status, consentGiven, consentAt, consentVersion

- **ConsentLog**: Separat logg för GDPR-samtycke
  - applicationId, personName, email, consentGivenAt, consentVersion, consentText, source

- **Config**: Konfigurationsvärden
  - currentYear, currentTerm, consentVersion, consentText

- **Admins**: Admin-användare
  - email, role, active

## 📝 Environment-variabler (valfritt)

Om du vill anpassa API-endpoints, skapa en `.env`-fil:

```
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/d/.../usercontent
```

## 🚀 Nästa steg

1. **Miljö-specifika inställningar**
   - Skapa separate Google Apps Script-projekt för dev/prod
   - Använd environment-variabler för endpoints

2. **E-postbekräftelser** (valfritt)
   - Integrera Gmail API för att skicka bekräftelsemail

3. **Dataimport**
   - Skapa funktion för att importera befintliga anmälningar från gamla formulär

4. **Rapporter**
   - Lägg till möjlighet för admin att exportera till CSV/PDF

## 📞 Support

Kontakta projektledaren för frågor om setup eller integration.
