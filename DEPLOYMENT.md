# Stora Lundby - Deployment Guide

See `README.md` for the full local-setup walkthrough. This doc covers production deployment and
troubleshooting.

## 1. Deploy the backend (Google Apps Script)

Follow "Sätta upp backend" in `README.md` to create the Apps Script project, point it at a spreadsheet,
create the `GOOGLE_CLIENT_ID` OAuth client, and publish the Web App deployment. Keep the `/exec` URL
handy for the next step.

Every time you change `Code.gs`, you need to create a **new deployment version** (Distribuera → Hantera
distributioner → redigera → ny version) - editing the script alone does not update the live `/exec` URL.

## 2. Deploy the client (Netlify)

### Via GitHub (recommended)

1. Push the repo to GitHub.
2. In [app.netlify.com](https://app.netlify.com): "Add new site" → "Import an existing project" → pick
   the repo. `netlify.toml` already declares the build command (`npm run build`) and publish directory
   (`dist`), so the defaults Netlify suggests should match.
3. Under Site settings → Environment variables, add:
   - `VITE_APPS_SCRIPT_URL` - the Apps Script `/exec` URL from step 1.
   - `VITE_GOOGLE_CLIENT_ID` - the OAuth client ID from step 1.
4. Trigger a deploy. Netlify rebuilds automatically on every push to `main` afterwards.

### Via CLI

```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

(Set the same two environment variables in the Netlify site settings first - the CLI doesn't read your
local `.env`.)

## 3. Finish the OAuth client setup

Google Identity Services checks the page's origin against the client ID's "Authorized JavaScript
origins". After the first Netlify deploy, go back to the OAuth client in Google Cloud Console and add the
real Netlify URL (e.g. `https://stora-lundby.netlify.app`) alongside `http://localhost:5173`.

## 4. Smoke-test

1. Open the Netlify URL, fill in the public form, submit, and confirm a new row appears in the
   `Applications` and `ConsentLog` sheets.
2. Open `<netlify-url>/admin`, sign in with an email listed in the `Admins` sheet, and confirm the
   submission shows up with the right activities.
3. Try signing in with an email **not** on the `Admins` sheet and confirm you're bounced back to the
   sign-in screen rather than seeing data.

## Troubleshooting

### "VITE_APPS_SCRIPT_URL är inte konfigurerad" in production

The env var wasn't set at build time. Netlify only bakes `VITE_*` vars in at build time, so set it and
**redeploy** (an existing build won't pick it up retroactively).

### Fetch fails with a CORS error on submit

Apps Script Web Apps can't answer a CORS preflight. The client always sends `Content-Type:
text/plain;charset=utf-8` specifically to keep requests as CORS "simple requests" (no preflight) - if
you've modified `googleAppsScriptApi.js` and started setting `Content-Type: application/json` or adding
custom headers, that's almost certainly why it broke.

### Admin sign-in button doesn't appear, or sign-in fails

- Confirm `VITE_GOOGLE_CLIENT_ID` is set for the build.
- Confirm the page's exact origin is in the OAuth client's "Authorized JavaScript origins".
- Confirm the Apps Script project's `GOOGLE_CLIENT_ID` script property matches the same client ID -
  `requireAdmin` rejects tokens whose `aud` claim doesn't match.

### Signed in, but still see "Åtkomst nekad"

Your email isn't in the `Admins` sheet, or `active` isn't `TRUE`. Add it directly in the sheet for now
(story C7 - an in-app admin-management screen - hasn't been built yet).

### Data not saving / "Hittade ingen anmälan"

- Make sure you deployed a **new version** of the Apps Script after your last edit (see step 1).
- Check Apps Script → Exekutioner for the actual server-side error.

## Production best practices

1. Use separate Apps Script projects (and spreadsheets) for dev/test vs. production, each with its own
   `.env` values.
2. Review the `Admins` sheet periodically and remove anyone who shouldn't have access anymore.
3. Google Drive backs up the spreadsheet automatically; export to CSV before a major schema change
   regardless.
