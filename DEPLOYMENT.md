# Stora Lundby - Deployment Guide

## 🌐 Netlify Deployment

### Automatisk deployment från GitHub

1. **Koppla GitHub-repot till Netlify**
   ```
   https://app.netlify.com/start
   ```

2. **Konfigurera build-inställningar**
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node version: 18 eller senare (rekommenderat)

3. **Lagra miljövariabler** (om du använder custom API-endpoint)
   - Gå till Site settings → Build & deploy → Environment
   - Lägg till `VITE_APPS_SCRIPT_URL` om nödvändigt

4. **Deploy**
   - Netlify bygger automatiskt vid varje push till `main`/`master`
   - Du får en unik URL efter deployment

### Manual deployment via CLI

```bash
# Installera Netlify CLI
npm install -g netlify-cli

# Logga in
netlify login

# Bygga lokalt
npm run build

# Deploya
netlify deploy --prod
```

## 🔗 Koppla Netlify till Google Apps Script

### Steg 1: Publicera Google Apps Script web app

1. Öppna ditt Apps Script-projekt på `script.google.com`
2. Klicka "Distribuera" → "Ny distribution"
3. Välj typ: **Web app**
4. Konfiguration:
   - "Kör som": Din Google-konto
   - "Vem som helst som har länken"
5. Klicka "Distribuera"
6. **Kopiera web app-URL:en** - den ser ut så här:
   ```
   https://script.google.com/macros/d/{SCRIPT_ID}/usercontent
   ```

### Steg 2: Uppdatera API-konfiguration

I `src/utils/googleAppsScriptApi.js`, ändra:

```javascript
const APPS_SCRIPT_URL = 'https://script.google.com/macros/d/{YOUR_SCRIPT_ID}/usercontent';
```

Eller använd environment-variabel:

```bash
# I Netlify site settings → Environment variables
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/d/{YOUR_SCRIPT_ID}/usercontent
```

### Steg 3: Testa kopplingen

1. Gå till din Netlify-URL
2. Fylla in test-formuläret
3. Kontrollera att data sparas i Google Sheets
4. Bekräfta att samtyckeslogg uppdateras

## 🔐 Admin-åtkomst

### Publicera admin-dashboard

1. **Skapa en separat web app för admin**
   - I Google Apps Script, lägg till fil `Admin.html`
   - I `doGet()`, lägg till en check:
   ```javascript
   if (page === 'admin') {
     if (!isAdmin(Session.getActiveUser().getEmail())) {
       return HtmlService.createHtmlOutput('<h1>Åtkomst nekad</h1>');
     }
     return HtmlService.createHtmlOutputFromFile('Admin');
   }
   ```

2. **Distribuera web app för admin**
   - URL: `https://script.google.com/macros/d/{SCRIPT_ID}/usercontent?page=admin`
   - Kräver Google-konto-inloggning
   - Admin-åtkomst kontrolleras via `Admins`-fliken i Sheets

## 📊 Övervaka deployment

### Netlify Analytics
- Gå till Site settings → Analytics
- Se trafik, builds och performance

### Google Apps Script Logs
- I Apps Script-editorn, klicka "Exekutioner"
- Se loggar för alla funktionsanrop

## 🔄 Uppdatering och rollback

### Uppdatera production

```bash
git push origin main
```

Netlify bygger och deployr automatiskt.

### Rollback till tidigare version

1. I Netlify Dashboard, gå till "Deploys"
2. Välj tidigare deploy
3. Klicka "Publish deploy"

## ⚠️ Troubleshooting

### "CORS error" eller "Script not found"

- Kontrollera att Google Apps Script-URL:en är rätt
- Säkerställ att web appen är publicerad (inte sparad som utkast)
- Testa i Google Apps Script-editorn:
  ```javascript
  function testSetup() {
    Logger.log(getConfig());
  }
  ```

### Data sparas inte

- Kontrollera Sheets-permissions (måste vara redigerbara)
- Se Google Apps Script-loggar för felanmälningar
- Bekräfta att `applicationId` är unik

### Admin kan inte logga in

- Kontrollera e-post i `Admins`-fliken
- Säkerställ `active` är `TRUE`
- Testa inloggning med samma Google-konto som skapad web appen

## 🎯 Production best practices

1. **Använd separate Google Sheets för dev/prod**
   - Dev: Testdata, mindre Sheet
   - Prod: Live-data, med backup

2. **Loggning och monitoring**
   - Lagra error-loggar i separat Sheets-tabell
   - Övervaka Google Apps Script execution-loggar

3. **Backup**
   - Google Drive autobackupar Sheets
   - Exportera data regelbundet till CSV

4. **Säkerhet**
   - Aldrig publicera Google API-nycklar i kod
   - Använd environment-variabler för känslig info
   - Revidera admin-lista regelbundet

## 📱 Mobil optimering

Netlify distribuerar redan en responsiv version. För att testa:

```bash
npm run build
npm run preview
```

Öppna på mobil via `http://<ditt-ip>:4173`

---

**Nästa steg**: Se till att GDPR-samtyckestexten är uppdaterad före launch!
