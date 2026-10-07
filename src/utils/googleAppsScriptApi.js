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

// Mutable so phase-2 admin screens (activities/admins CRUD) behave
// sensibly when smoke-tested in dev mode without a real backend.
// Mirrors Code.gs's DEFAULT_ACTIVITIES so local `npm run dev` demos reflect
// the real shape: two markets a term, gift drop-offs as their own category.
let mockActivities = [
  { id: 'gift-skordemarknad', year: '2026', term: 'Höst', category: 'gift', label: 'Gåva av lotterivinst till skördemarknad (inlämning 24 september kl 18-20 på Scoutgården)', date: '2026-09-24', startTime: '18:00', endTime: '20:00', location: 'Scoutgården', capacity: null, active: true, sortOrder: 1 },
  { id: 'prep-skordemarknad', year: '2026', term: 'Höst', category: 'prep', label: 'Förberedelse inför marknaden', date: '2026-09-24', startTime: '18:00', endTime: '20:00', location: 'Scoutgården', capacity: null, active: true, sortOrder: 2 },
  { id: 'shift1-skordemarknad', year: '2026', term: 'Höst', category: 'market-shift', label: 'Stå i marknadsstånd på skördemarknaden', date: '2026-09-27', startTime: '10:00', endTime: '13:00', location: 'Mjörnbotorget', capacity: null, active: true, sortOrder: 3 },
  { id: 'shift2-skordemarknad', year: '2026', term: 'Höst', category: 'market-shift', label: 'Stå i marknadsstånd på skördemarknaden', date: '2026-09-27', startTime: '13:00', endTime: '16:00', location: 'Mjörnbotorget', capacity: null, active: true, sortOrder: 4 },
  { id: 'workday-ljungslatt', year: '2026', term: 'Höst', category: 'workday', label: 'Arbetsdag på Ljungslätt (utomhus och inomhus)', date: '2026-10-03', startTime: '10:00', endTime: '14:00', location: 'Ljungslätt', capacity: null, active: true, sortOrder: 5 },
  { id: 'pyssel-julmarknad', year: '2026', term: 'Höst', category: 'baking', label: 'Pysseldag - vi bakar, pysslar och tillverkar vinster inför julmarknaden', date: '2026-11-28', startTime: '', endTime: '', location: 'Scoutgården', capacity: null, active: true, sortOrder: 6 },
  { id: 'gift-julmarknad', year: '2026', term: 'Höst', category: 'gift', label: 'Gåva av lotterivinst till julmarknad (inlämning 3 december kl 18-20 på Scoutgården)', date: '2026-12-03', startTime: '18:00', endTime: '20:00', location: 'Scoutgården', capacity: null, active: true, sortOrder: 7 },
  { id: 'prep-julmarknad', year: '2026', term: 'Höst', category: 'prep', label: 'Förberedelse inför marknaden', date: '2026-12-03', startTime: '18:00', endTime: '20:00', location: 'Scoutgården', capacity: null, active: true, sortOrder: 8 },
  { id: 'shift1-julmarknad', year: '2026', term: 'Höst', category: 'market-shift', label: 'Stå i marknadsstånd på julmarknaden', date: '2026-12-05', startTime: '10:00', endTime: '13:00', location: 'Mjörnbotorget', capacity: null, active: true, sortOrder: 9 },
  { id: 'shift2-julmarknad', year: '2026', term: 'Höst', category: 'market-shift', label: 'Stå i marknadsstånd på julmarknaden', date: '2026-12-05', startTime: '13:00', endTime: '16:00', location: 'Mjörnbotorget', capacity: null, active: true, sortOrder: 10 },
  { id: 'market-group', year: '', term: '', category: 'standing-role', label: 'Gå med i marknadsgruppen som samordnar marknader på Mjörnbotorget', date: '', startTime: '', endTime: '', location: '', capacity: null, active: true, sortOrder: 11 },
  { id: 'board-work', year: '', term: '', category: 'standing-role', label: 'Styrelsearbete eller annat administrativt uppdrag', date: '', startTime: '', endTime: '', location: '', capacity: null, active: true, sortOrder: 12 },
  { id: 'own-suggestion', year: '', term: '', category: 'standing-role', label: 'Eget förslag', date: '', startTime: '', endTime: '', location: '', capacity: null, active: true, sortOrder: 13 }
];

let mockAdmins = [{ email: 'admin@example.com', role: 'admin', active: 'TRUE' }];

let mockApplications = [
  {
    id: 'demo-1',
    createdAt: new Date().toISOString(),
    year: '2026',
    term: 'Höst',
    guardianName: 'Anna Andersson',
    guardianPhone: '070-1234567',
    guardianEmail: 'anna@example.com',
    scoutName: 'Lina Andersson',
    avdelning: 'Spårare',
    selectedActivities: ['shift1-skordemarknad'],
    selectedActivityLabels: ['Stå i marknadsstånd på skördemarknaden'],
    ownSuggestionText: '',
    comments: 'Hjälper gärna till igen.',
    status: 'Ny',
    internalNotes: '',
    consentGiven: 'TRUE',
    consentAt: new Date().toISOString(),
    consentVersion: 'v1'
  }
];

let mockPurgeLog = [];

let mockPaperForms = [];

const mockConsentLog = [
  {
    applicationId: 'demo-1',
    personName: 'Anna Andersson',
    email: 'anna@example.com',
    consentGivenAt: new Date().toISOString(),
    consentVersion: 'v1',
    consentText: 'Jag godkänner att Stora Lundby sparar mina uppgifter.',
    source: 'public-form'
  }
];

const mockConfig = {
  currentYear: '2026',
  currentTerm: 'Höst',
  // Deliberately far out so local `npm run dev` demos show the live form
  // instead of the "deadline passed" screen; the real deadline always
  // comes from the Config sheet in production.
  submissionDeadline: '2099-12-31',
  consentVersion: 'v1',
  consentText: 'Jag godkänner att Stora Lundby sparar mina uppgifter för att hantera anmälan och kontakta mig i samband med verksamheten.'
};

async function mockAction(action, params) {
  switch (action) {
    case 'getActivities':
      return mockActivities.filter((a) => a.active);
    case 'getActivitiesAdmin':
      return mockActivities;
    case 'getConfig':
      return mockConfig;
    case 'submitApplication': {
      const payload = params.payload || {};
      const selectedIds = payload.selectedActivities || [];
      return {
        ok: true,
        id: 'demo-mock',
        message: 'Demoläge: anmälan har sparats (inte skickad till Sheets).',
        selectedActivities: mockActivities.filter((a) => selectedIds.includes(a.id))
      };
    }
    case 'getApplications':
      return mockApplications;
    case 'getAdminSummary':
      return { total: mockApplications.length, newCount: 1, attendanceCount: 1, giftCount: 0, standingRoleCount: 0 };
    case 'updateApplicationStatus':
      mockApplications = mockApplications.map((app) => (app.id === params.id ? { ...app, status: params.status } : app));
      return { ok: true };
    case 'updateApplicationNotes':
      mockApplications = mockApplications.map((app) => (app.id === params.id ? { ...app, internalNotes: params.internalNotes } : app));
      return { ok: true };
    case 'createManualApplication': {
      const payload = params.payload || {};
      const labelsById = Object.fromEntries(mockActivities.map((a) => [a.id, a.label]));
      mockApplications = [
        ...mockApplications,
        {
          id: `demo-manual-${Date.now()}`,
          createdAt: new Date().toISOString(),
          year: payload.year || mockConfig.currentYear,
          term: payload.term || mockConfig.currentTerm,
          guardianName: payload.guardianName || '',
          guardianPhone: payload.guardianPhone || '',
          guardianEmail: payload.guardianEmail || '',
          scoutName: payload.scoutName || '',
          avdelning: payload.avdelning || '',
          selectedActivities: payload.selectedActivities || [],
          selectedActivityLabels: (payload.selectedActivities || []).map((id) => labelsById[id] || id),
          ownSuggestionText: payload.ownSuggestionText || '',
          comments: payload.comments || '',
          status: payload.status || 'Ny',
          internalNotes: '',
          consentGiven: 'TRUE',
          consentAt: new Date().toISOString(),
          consentVersion: mockConfig.consentVersion
        }
      ];
      return { ok: true };
    }
    case 'getConsentLog':
      return mockConsentLog;
    case 'purgeTermData': {
      const before = mockApplications.length;
      const purgedIds = mockApplications
        .filter((a) => a.year === params.year && a.term === params.term)
        .map((a) => a.id);
      mockApplications = mockApplications.filter((a) => !purgedIds.includes(a.id));
      const applicationsPurged = before - mockApplications.length;
      mockPurgeLog = [
        { purgedAt: new Date().toISOString(), purgedBy: 'admin@example.com', year: params.year, term: params.term, applicationsPurged, consentLogPurged: applicationsPurged },
        ...mockPurgeLog
      ];
      return { ok: true, applicationsPurged, consentLogPurged: applicationsPurged };
    }
    case 'getPurgeLog':
      return mockPurgeLog;
    case 'getAdmins':
      return mockAdmins;
    case 'addAdmin':
      if (!mockAdmins.some((a) => a.email === params.email)) {
        mockAdmins = [...mockAdmins, { email: params.email, role: 'admin', active: 'TRUE' }];
      }
      return { ok: true };
    case 'setAdminActive':
      mockAdmins = mockAdmins.map((a) => (a.email === params.email ? { ...a, active: params.active ? 'TRUE' : 'FALSE' } : a));
      return { ok: true };
    case 'upsertActivity': {
      const activity = params.activity || {};
      const id = activity.id || `demo-activity-${Date.now()}`;
      const exists = mockActivities.some((a) => a.id === id);
      const normalized = { ...activity, id, active: activity.active !== false };
      mockActivities = exists
        ? mockActivities.map((a) => (a.id === id ? { ...a, ...normalized } : a))
        : [...mockActivities, normalized];
      return { ok: true, id };
    }
    case 'deleteActivity':
      mockActivities = mockActivities.filter((a) => a.id !== params.id);
      return { ok: true };
    case 'copyActivities': {
      const source = mockActivities.filter(
        (a) => a.category !== 'standing-role' && a.year === params.fromYear && a.term === params.fromTerm
      );
      const copies = source.map((a) => ({ ...a, id: `demo-activity-${Date.now()}-${Math.random()}`, year: params.toYear, term: params.toTerm, date: '' }));
      mockActivities = [...mockActivities, ...copies];
      return { ok: true, copied: copies.length };
    }
    case 'updateConfig':
      Object.assign(mockConfig, params.updates || {});
      return { ...mockConfig };
    case 'getPaperForm': {
      const year = params.year || mockConfig.currentYear;
      const term = params.term || mockConfig.currentTerm;
      return mockPaperForms.find((f) => f.year === year && f.term === term) || null;
    }
    case 'generatePaperForm': {
      const year = params.year || mockConfig.currentYear;
      const term = params.term || mockConfig.currentTerm;
      if (mockPaperForms.some((f) => f.year === year && f.term === term)) {
        throw new Error(`Det finns redan en pappersblankett för ${term} ${year}. Ta bort den först om du vill skapa en ny version.`);
      }
      const record = {
        year,
        term,
        docId: `demo-doc-${Date.now()}`,
        docUrl: 'https://docs.google.com/document/d/demo/edit',
        createdAt: new Date().toISOString(),
        createdBy: 'admin@example.com'
      };
      mockPaperForms = [...mockPaperForms, record];
      return { ok: true, docUrl: record.docUrl, docId: record.docId };
    }
    case 'deletePaperForm': {
      const year = params.year || mockConfig.currentYear;
      const term = params.term || mockConfig.currentTerm;
      if (!mockPaperForms.some((f) => f.year === year && f.term === term)) {
        throw new Error(`Hittade ingen pappersblankett för ${term} ${year}`);
      }
      mockPaperForms = mockPaperForms.filter((f) => !(f.year === year && f.term === term));
      return { ok: true };
    }
    case 'batch': {
      const results = [];
      for (const request of params.requests || []) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const data = await mockAction(request.action, request.params || {});
          results.push({ ok: true, data });
        } catch (err) {
          results.push({ ok: false, error: err.message });
        }
      }
      return results;
    }
    default:
      throw new Error(`Okänd åtgärd (demoläge): ${action}`);
  }
}

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
  'getAdminSummary', 'getConsentLog', 'getAdmins', 'getPurgeLog',
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
    if (import.meta.env.DEV) {
      return mockAction(action, params);
    }
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
  getAdminSummary: (idToken) => callAppsScript('getAdminSummary', { idToken }),
  updateApplicationStatus: (id, status, idToken) => callAppsScript('updateApplicationStatus', { id, status, idToken }),
  updateApplicationNotes: (id, internalNotes, idToken) => callAppsScript('updateApplicationNotes', { id, internalNotes, idToken }),
  createManualApplication: (payload, idToken) => callAppsScript('createManualApplication', { payload, idToken }),
  getConsentLog: (idToken) => callAppsScript('getConsentLog', { idToken }),
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
