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

// Mutable so phase-2 admin screens (activities/admins CRUD) behave
// sensibly when smoke-tested in dev mode without a real backend.
let mockActivities = [
  { id: 'shift1-skordemarknad', year: '2026', term: 'Höst', category: 'market-shift', label: 'Stå i marknadsstånd på skördemarknaden', date: '2026-09-27', startTime: '10:00', endTime: '13:00', location: 'Mjörnbotorget', capacity: null, active: true, sortOrder: 3 },
  { id: 'workday-ljungslatt', year: '2026', term: 'Höst', category: 'workday', label: 'Arbetsdag på Ljungslätt (utomhus och inomhus)', date: '2026-10-03', startTime: '10:00', endTime: '14:00', location: 'Ljungslätt', capacity: null, active: true, sortOrder: 5 },
  { id: 'market-group', year: '', term: '', category: 'standing-role', label: 'Gå med i marknadsgruppen som samordnar marknader på Mjörnbotorget', date: '', startTime: '', endTime: '', location: '', capacity: null, active: true, sortOrder: 11 },
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
  submissionDeadline: '2026-09-17',
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
    case 'submitApplication':
      return { ok: true, id: 'demo-mock', message: 'Demoläge: anmälan har sparats (inte skickad till Sheets).' };
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
    default:
      throw new Error(`Okänd åtgärd (demoläge): ${action}`);
  }
}

async function callAppsScript(action, params = {}) {
  if (!APPS_SCRIPT_URL) {
    if (import.meta.env.DEV) {
      return mockAction(action, params);
    }
    throw new Error('VITE_APPS_SCRIPT_URL är inte konfigurerad.');
  }

  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...params })
  });

  if (!response.ok) {
    throw new Error(`Nätverksfel (${response.status}) vid anrop till backend.`);
  }

  const result = await response.json();
  if (!result.ok) {
    throw new Error(result.error || 'Okänt fel från backend.');
  }
  return result.data;
}

export const api = {
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
    callAppsScript('copyActivities', { fromYear, fromTerm, toYear, toTerm, idToken })
};

export default api;
