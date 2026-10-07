// The backend is a Google Apps Script Web App exposing a JSON API
// (see Code.gs - doGet/doPost). We never use google.script.run here: it
// only exists inside pages Apps Script renders itself via HtmlService,
// not in a React app hosted on a separate origin (e.g. Netlify).
//
// Every call is a POST with a text/plain body (a JSON string). That
// keeps the request a CORS "simple request" - Apps Script Web Apps
// can't answer a preflight OPTIONS request, so an application/json
// content type (which forces a preflight) would fail cross-origin.

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL;
// Apps Script's redirect-based content delivery can occasionally hang
// rather than error outright - without a timeout, a stuck request leaves
// the UI showing "Laddar..." forever with no feedback.
const REQUEST_TIMEOUT_MS = 25000;

// Actions safe to silently retry on a transient failure (timeout, 404,
// network blip): plain reads, plus writes whose effect is naturally
// idempotent (upsert/set-style, or already keyed so a duplicate attempt
// just overwrites the same record). Deliberately excludes
// createManualApplication, upsertActivity (a brand-new activity with no id
// gets a fresh server-generated id each call), copyActivities,
// generatePaperForm (creates a brand-new Doc each call - a lost-response
// retry would leave an orphaned duplicate doc) and deletePaperForm (kept
// off the list for the same reason as deleteActivity) - each of those can
// create or hit a genuine inconsistency if the first attempt actually
// succeeded and only the response was lost.
// 'batch' is included too - every call site in this app only ever bundles
// actions already on this list (see the load() functions in
// AdminDashboard/ActivitiesManager/DataRetention/ActivityReport), so
// retrying a failed batch as a whole is exactly as safe as retrying each of
// its parts individually. If a future caller ever batches a non-idempotent
// write alongside these, 'batch' would need to come back off this list.
const RETRY_SAFE_ACTIONS = new Set([
  'getActivities', 'getActivitiesAdmin', 'getConfig', 'getApplications',
  'getAdmins', 'getPurgeLog',
  'submitApplication', 'updateApplicationStatus', 'updateApplicationNotes',
  'setAdminActive', 'addAdmin', 'purgeTermData', 'batch', 'getPaperForm'
]);
const RETRY_ATTEMPTS = 2;
const RETRY_DELAY_MS = 800;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callAppsScriptOnce(action, params) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...params }),
      signal: controller.signal
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Tidsgränsen överskreds vid anrop till backend. Försök igen.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Nätverksfel (${response.status}) vid anrop till backend.`);
  }

  const result = await response.json();
  if (!result.ok) {
    throw new Error(result.error || 'Okänt fel från backend.');
  }
  return result.data;
}

async function callAppsScript(action, params = {}) {
  if (!APPS_SCRIPT_URL) {
    throw new Error('VITE_APPS_SCRIPT_URL är inte konfigurerad.');
  }

  const retriesAllowed = RETRY_SAFE_ACTIONS.has(action) ? RETRY_ATTEMPTS : 0;
  let lastError;
  for (let attempt = 0; attempt <= retriesAllowed; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await callAppsScriptOnce(action, params);
    } catch (err) {
      lastError = err;
      if (attempt < retriesAllowed) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }
  throw lastError;
}

// Bundles several related calls into one request/one Apps Script
// execution instead of N separate round trips - meaningfully cuts both
// latency (each round trip carries real fixed overhead) and the number of
// chances for a transient failure. Returns one {ok, data|error} entry per
// request, in order; unwrapBatchResult() below turns one entry back into
// the normal "return data or throw" shape each api.* call already has.
function callBatch(requests) {
  return callAppsScript('batch', { requests });
}

export function unwrapBatchResult(results, index, label) {
  const entry = results[index];
  if (!entry || !entry.ok) {
    throw new Error((entry && entry.error) || `Fel vid ${label}.`);
  }
  return entry.data;
}

export const api = {
  batch: callBatch,

  getActivities: (year, term) => callAppsScript('getActivities', { year, term }),
  getConfig: () => callAppsScript('getConfig'),
  submitApplication: (payload) => callAppsScript('submitApplication', { payload }),

  getApplications: (idToken) => callAppsScript('getApplications', { idToken }),
  updateApplicationStatus: (id, status, idToken) => callAppsScript('updateApplicationStatus', { id, status, idToken }),
  updateApplicationNotes: (id, internalNotes, idToken) => callAppsScript('updateApplicationNotes', { id, internalNotes, idToken }),
  createManualApplication: (payload, idToken) => callAppsScript('createManualApplication', { payload, idToken }),
  purgeTermData: (year, term, idToken) => callAppsScript('purgeTermData', { year, term, idToken }),
  getPurgeLog: (idToken) => callAppsScript('getPurgeLog', { idToken }),
  getAdmins: (idToken) => callAppsScript('getAdmins', { idToken }),
  addAdmin: (email, idToken) => callAppsScript('addAdmin', { email, idToken }),
  setAdminActive: (email, active, idToken) => callAppsScript('setAdminActive', { email, active, idToken }),
  updateConfig: (updates, idToken) => callAppsScript('updateConfig', { updates, idToken }),

  getActivitiesAdmin: (idToken) => callAppsScript('getActivitiesAdmin', { idToken }),
  upsertActivity: (activity, idToken) => callAppsScript('upsertActivity', { activity, idToken }),
  deleteActivity: (id, idToken) => callAppsScript('deleteActivity', { id, idToken }),
  copyActivities: (fromYear, fromTerm, toYear, toTerm, idToken) =>
    callAppsScript('copyActivities', { fromYear, fromTerm, toYear, toTerm, idToken }),

  getPaperForm: (year, term, idToken) => callAppsScript('getPaperForm', { year, term, idToken }),
  generatePaperForm: (year, term, idToken) => callAppsScript('generatePaperForm', { year, term, idToken }),
  deletePaperForm: (year, term, idToken) => callAppsScript('deletePaperForm', { year, term, idToken })
};

export default api;
