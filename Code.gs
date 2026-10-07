/**
 * Stora Lundby Scoutkar - Foraldraengagemang
 *
 * Pure JSON API over a Google Sheet. This project never renders HTML -
 * the client is a separate React/Vite app (see src/) that talks to this
 * Web App deployment via fetch(). doGet/doPost are the only entry points.
 */

var SHEET_NAMES = {
  applications: 'Applications',
  consentLog: 'ConsentLog',
  config: 'Config',
  admins: 'Admins',
  activities: 'Activities',
  purgeLog: 'PurgeLog',
  paperForms: 'PaperForms'
};

var DEFAULT_ACTIVITIES = [
  ['gift-skordemarknad', '2026', 'Höst', 'gift', 'Gåva av lotterivinst till skördemarknad (inlämning 24 september kl 18-20 på Scoutgården)', '2026-09-24', '18:00', '20:00', 'Scoutgården', '', 'TRUE', 1],
  ['prep-skordemarknad', '2026', 'Höst', 'prep', 'Förberedelse inför marknaden', '2026-09-24', '18:00', '20:00', 'Scoutgården', '', 'TRUE', 2],
  ['shift1-skordemarknad', '2026', 'Höst', 'market-shift', 'Stå i marknadsstånd på skördemarknaden', '2026-09-27', '10:00', '13:00', 'Mjörnbotorget', '', 'TRUE', 3],
  ['shift2-skordemarknad', '2026', 'Höst', 'market-shift', 'Stå i marknadsstånd på skördemarknaden', '2026-09-27', '13:00', '16:00', 'Mjörnbotorget', '', 'TRUE', 4],
  ['workday-ljungslatt', '2026', 'Höst', 'workday', 'Arbetsdag på Ljungslätt (utomhus och inomhus)', '2026-10-03', '10:00', '14:00', 'Ljungslätt', '', 'TRUE', 5],
  ['pyssel-julmarknad', '2026', 'Höst', 'baking', 'Pysseldag - vi bakar, pysslar och tillverkar vinster inför julmarknaden', '2026-11-28', '', '', 'Scoutgården', '', 'TRUE', 6],
  ['gift-julmarknad', '2026', 'Höst', 'gift', 'Gåva av lotterivinst till julmarknad (inlämning 3 december kl 18-20 på Scoutgården)', '2026-12-03', '18:00', '20:00', 'Scoutgården', '', 'TRUE', 7],
  ['prep-julmarknad', '2026', 'Höst', 'prep', 'Förberedelse inför marknaden', '2026-12-03', '18:00', '20:00', 'Scoutgården', '', 'TRUE', 8],
  ['shift1-julmarknad', '2026', 'Höst', 'market-shift', 'Stå i marknadsstånd på julmarknaden', '2026-12-05', '10:00', '13:00', 'Mjörnbotorget', '', 'TRUE', 9],
  ['shift2-julmarknad', '2026', 'Höst', 'market-shift', 'Stå i marknadsstånd på julmarknaden', '2026-12-05', '13:00', '16:00', 'Mjörnbotorget', '', 'TRUE', 10],
  ['market-group', '', '', 'standing-role', 'Gå med i marknadsgruppen som samordnar marknader på Mjörnbotorget', '', '', '', '', '', 'TRUE', 11],
  ['board-work', '', '', 'standing-role', 'Styrelsearbete eller annat administrativt uppdrag', '', '', '', '', '', 'TRUE', 12],
  ['own-suggestion', '', '', 'standing-role', 'Eget förslag', '', '', '', '', '', 'TRUE', 13]
];

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

function doGet(e) {
  return routeRequest(e, 'GET');
}

function doPost(e) {
  return routeRequest(e, 'POST');
}

function routeRequest(e, method) {
  initializeProject();
  try {
    var params = method === 'GET' ? (e && e.parameter ? e.parameter : {}) : parseRequestBody(e);
    var result = handleAction(params.action, params);
    return jsonResponse({ ok: true, data: result });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message || String(error) });
  }
}

function parseRequestBody(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }
  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    throw new Error('Ogiltig JSON i anropet.');
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function handleAction(action, params) {
  switch (action) {
    case 'batch':
      // Bundles several related calls (e.g. a dashboard's reads) into one
      // round trip and one Apps Script execution - each sub-request still
      // goes through its own case/requireAdmin check below, but repeated
      // token verifications within the batch are memoized (see
      // verifyGoogleIdToken), so this isn't N times the auth overhead.
      return (params.requests || []).map(function (request) {
        try {
          return { ok: true, data: handleAction(request.action, request.params || {}) };
        } catch (err) {
          return { ok: false, error: err.message || String(err) };
        }
      });
    case 'getActivities':
      return getActivities(params.year, params.term);
    case 'getConfig':
      return getPublicConfig();
    case 'submitApplication':
      return submitApplication(params.payload || params);
    case 'getApplications':
      requireAdmin(params);
      return getApplications();
    case 'getAdminSummary':
      requireAdmin(params);
      return getAdminSummary();
    case 'updateApplicationStatus':
      requireAdmin(params);
      return updateApplicationStatus(params.id, params.status);
    case 'updateApplicationNotes':
      requireAdmin(params);
      return updateApplicationNotes(params.id, params.internalNotes);
    case 'createManualApplication':
      requireAdmin(params);
      return createManualApplication(params.payload || params);
    case 'getConsentLog':
      requireAdmin(params);
      return getConsentLogEntries();
    case 'purgeTermData':
      var purgingAdmin = requireAdmin(params);
      return purgeTermData(params.year, params.term, purgingAdmin);
    case 'getPurgeLog':
      requireAdmin(params);
      return getPurgeLogEntries();
    case 'getAdmins':
      requireAdmin(params);
      return getAdmins();
    case 'addAdmin':
      requireAdmin(params);
      return addAdmin(params.email);
    case 'setAdminActive':
      requireAdmin(params);
      return setAdminActive(params.email, params.active);
    case 'updateConfig':
      requireAdmin(params);
      return updateConfigEntries(params.updates || {});
    case 'getActivitiesAdmin':
      requireAdmin(params);
      return getActivitiesRaw();
    case 'upsertActivity':
      requireAdmin(params);
      return upsertActivity(params.activity || {});
    case 'deleteActivity':
      requireAdmin(params);
      return deleteActivity(params.id);
    case 'copyActivities':
      requireAdmin(params);
      return copyActivities(params.fromYear, params.fromTerm, params.toYear, params.toTerm);
    case 'getPaperForm':
      requireAdmin(params);
      return getPaperFormRecord(params.year, params.term);
    case 'generatePaperForm':
      var generatingAdmin = requireAdmin(params);
      return generatePaperForm(params.year, params.term, generatingAdmin);
    case 'deletePaperForm':
      requireAdmin(params);
      return deletePaperForm(params.year, params.term);
    default:
      throw new Error('Okänd åtgärd: ' + action);
  }
}

// ---------------------------------------------------------------------------
// Admin auth - verifies a Google ID token from the React admin app
// (Google Identity Services), then checks the verified email against the
// Admins sheet. Replaces Session.getActiveUser(), which only reflects a
// signed-in Google identity for pages rendered by HtmlService - not for a
// plain SPA calling this Web App over fetch().
// ---------------------------------------------------------------------------

function requireAdmin(params) {
  var idToken = params.idToken;
  if (!idToken) {
    throw new Error('Inloggning krävs.');
  }
  var email = verifyGoogleIdToken(idToken);

  var requiredDomain = getConfigValue('adminEmailDomain', 'storalundby.se');
  if (requiredDomain && !String(email).toLowerCase().endsWith('@' + String(requiredDomain).toLowerCase())) {
    throw new Error('Åtkomst nekad.');
  }

  if (!isAdmin(email)) {
    throw new Error('Åtkomst nekad.');
  }
  return email;
}

// Verifying a token means an outbound call from Apps Script to Google's own
// OAuth servers - real latency on top of everything else. A single page
// load commonly checks the same token 2-3 times (once per batched action);
// memoizing per-execution (this var resets on every fresh invocation, so
// nothing persists between requests) cuts that to one verification no
// matter how many admin-only actions run in the same call.
var tokenVerificationCache = {};

function verifyGoogleIdToken(idToken) {
  if (Object.prototype.hasOwnProperty.call(tokenVerificationCache, idToken)) {
    return tokenVerificationCache[idToken];
  }

  var response = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
    { muteHttpExceptions: true }
  );
  if (response.getResponseCode() !== 200) {
    throw new Error('Ogiltig inloggning.');
  }
  var payload = JSON.parse(response.getContentText());
  var expectedClientId = PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_ID');
  if (expectedClientId && payload.aud !== expectedClientId) {
    throw new Error('Ogiltig inloggning (fel klient).');
  }
  if (payload.email_verified !== 'true' && payload.email_verified !== true) {
    throw new Error('E-postadressen är inte verifierad.');
  }

  tokenVerificationCache[idToken] = payload.email;
  return payload.email;
}

function isAdmin(userEmail) {
  if (!userEmail) {
    return false;
  }
  var adminSheet = getSheetByName(SHEET_NAMES.admins);
  var values = adminSheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i += 1) {
    var row = values[i];
    if (String(row[0]).trim().toLowerCase() === String(userEmail).trim().toLowerCase()) {
      return String(row[2]).toLowerCase() === 'true' || String(row[2]).toLowerCase() === 'yes';
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Setup / sheet plumbing
// ---------------------------------------------------------------------------

// Bump this whenever SHEET_NAMES (or a seeded sheet's required header row)
// changes. The cache key below includes it, so a schema change is always a
// cache miss on the very next request after deploying - without this, a
// sheet added in code wouldn't actually get created on an already-warm
// deployment until the old cache entry expired up to 6 hours later (see
// the "Sheet ... could not be found" incident when PaperForms was added).
var PROJECT_SCHEMA_VERSION = 2;

function initializeProject() {
  // Every request calls this, but the sheets only ever need creating once.
  // Skip the repeated getSheetByName/getLastRow checks (each a Spreadsheet
  // service round trip) for 6 hours after the last successful run - this
  // is the single biggest latency cost on every call otherwise.
  var cache = CacheService.getScriptCache();
  var cacheKey = 'projectInitialized_v' + PROJECT_SCHEMA_VERSION;
  if (cache.get(cacheKey) === 'true') {
    return;
  }

  var ss = getSpreadsheet();

  Object.keys(SHEET_NAMES).forEach(function (key) {
    var name = SHEET_NAMES[key];
    if (!ss.getSheetByName(name)) {
      ss.insertSheet(name);
    }
  });

  var appSheet = ss.getSheetByName(SHEET_NAMES.applications);
  var consentSheet = ss.getSheetByName(SHEET_NAMES.consentLog);
  var configSheet = ss.getSheetByName(SHEET_NAMES.config);
  var adminSheet = ss.getSheetByName(SHEET_NAMES.admins);
  var activitiesSheet = ss.getSheetByName(SHEET_NAMES.activities);
  var purgeLogSheet = ss.getSheetByName(SHEET_NAMES.purgeLog);

  if (appSheet.getLastRow() === 0) {
    appSheet.appendRow([
      'id', 'createdAt', 'updatedAt', 'year', 'term',
      'guardianName', 'guardianPhone', 'guardianEmail',
      'scoutName', 'avdelning',
      'selectedActivities', 'ownSuggestionText', 'comments',
      'status', 'internalNotes', 'consentGiven', 'consentAt', 'consentVersion'
    ]);
  }

  if (consentSheet.getLastRow() === 0) {
    consentSheet.appendRow([
      'applicationId', 'personName', 'email', 'consentGivenAt', 'consentVersion', 'consentText', 'source'
    ]);
  }

  if (configSheet.getLastRow() === 0) {
    configSheet.appendRow(['key', 'value']);
    configSheet.appendRow(['currentYear', '2026']);
    configSheet.appendRow(['currentTerm', 'Höst']);
    configSheet.appendRow(['submissionDeadline', '2026-09-17']);
    configSheet.appendRow(['consentVersion', 'v1']);
    configSheet.appendRow(['consentText', 'Jag godkänner att Stora Lundby sparar mina uppgifter för att hantera anmälan och kontakta mig i samband med verksamheten.']);
    configSheet.appendRow(['retentionPeriodMonths', '24']);
    configSheet.appendRow(['adminEmailDomain', 'storalundby.se']);
    // Encoded into the QR code embedded in a generated paper form (see
    // generatePaperForm) - a Config row rather than a hardcoded constant so
    // it can be updated (e.g. to a custom domain) without a code deploy.
    configSheet.appendRow(['publicFormUrl', 'https://stora-lundby.netlify.app/']);
  }

  if (adminSheet.getLastRow() === 0) {
    adminSheet.appendRow(['email', 'role', 'active']);
  }

  if (activitiesSheet.getLastRow() === 0) {
    activitiesSheet.appendRow([
      'id', 'year', 'term', 'category', 'label', 'date', 'startTime', 'endTime', 'location', 'capacity', 'active', 'sortOrder'
    ]);
    DEFAULT_ACTIVITIES.forEach(function (row) {
      activitiesSheet.appendRow(row);
    });
  }

  if (purgeLogSheet.getLastRow() === 0) {
    purgeLogSheet.appendRow(['purgedAt', 'purgedBy', 'year', 'term', 'applicationsPurged', 'consentLogPurged']);
  }

  var paperFormsSheet = ss.getSheetByName(SHEET_NAMES.paperForms);
  if (paperFormsSheet.getLastRow() === 0) {
    paperFormsSheet.appendRow(['year', 'term', 'docId', 'docUrl', 'createdAt', 'createdBy']);
  }

  cache.put(cacheKey, 'true', 21600);
}

function getSpreadsheet() {
  var scriptProperties = PropertiesService.getScriptProperties();
  var spreadsheetId = scriptProperties.getProperty('SPREADSHEET_ID');

  if (spreadsheetId) {
    try {
      return SpreadsheetApp.openById(spreadsheetId);
    } catch (error) {
      console.warn('Stored spreadsheet ID is invalid. Creating a new spreadsheet.');
    }
  }

  try {
    var activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (activeSpreadsheet) {
      return activeSpreadsheet;
    }
  } catch (error) {
    // No active spreadsheet bound to the project.
  }

  var newSpreadsheet = SpreadsheetApp.create('Stora Lundby - Engagement');
  scriptProperties.setProperty('SPREADSHEET_ID', newSpreadsheet.getId());
  return newSpreadsheet;
}

function getSheetByName(name) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    throw new Error('Sheet "' + name + '" could not be found.');
  }
  return sheet;
}

function sheetRowsAsObjects(sheetName) {
  var sheet = getSheetByName(sheetName);
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return [];
  }
  var headers = data[0];
  var rows = data.slice(1).filter(function (row) {
    return row.some(function (cell) { return String(cell).trim() !== ''; });
  });
  return rows.map(function (row) {
    var item = {};
    headers.forEach(function (header, index) {
      item[header] = row[index];
    });
    return item;
  });
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// A value like "2026-09-17" typed into a Config row gets auto-converted to
// a real Date cell by Sheets (locale-aware date detection applies even
// through Range.setValue) - normalize it back to plain yyyy-MM-dd text so
// the frontend's date parsing never sees a Date-shaped value.
function normalizeConfigValue(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, 'Europe/Stockholm', 'yyyy-MM-dd');
  }
  return value;
}

// Config and activities are read on every public form load but change
// rarely (an admin editing them is a deliberate, occasional action) - cache
// them between executions the same way initializeProject's existence check
// already is. A 5-minute TTL bounds staleness even if an invalidation is
// ever missed; the mutation paths (setConfigValue, upsertActivity,
// deleteActivity) also clear the relevant entry immediately so admin edits
// show up on the next request rather than waiting out the TTL.
var CACHE_TTL_SECONDS = 300;

function getConfigValue(key, defaultValue) {
  var config = getPublicConfig();
  var wanted = String(key).trim().toLowerCase();
  var foundKey = Object.keys(config).filter(function (k) {
    return String(k).trim().toLowerCase() === wanted;
  })[0];
  return foundKey !== undefined ? config[foundKey] : defaultValue;
}

function setConfigValue(key, value) {
  var configSheet = getSheetByName(SHEET_NAMES.config);
  var values = configSheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i += 1) {
    if (String(values[i][0]).trim().toLowerCase() === String(key).trim().toLowerCase()) {
      configSheet.getRange(i + 1, 2).setValue(value);
      CacheService.getScriptCache().remove('publicConfig');
      return;
    }
  }
  configSheet.appendRow([key, value]);
  CacheService.getScriptCache().remove('publicConfig');
}

function getPublicConfig() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('publicConfig');
  if (cached) {
    return JSON.parse(cached);
  }

  var configSheet = getSheetByName(SHEET_NAMES.config);
  var values = configSheet.getDataRange().getValues();
  var config = {};
  for (var i = 1; i < values.length; i += 1) {
    config[values[i][0]] = normalizeConfigValue(values[i][1]);
  }
  cache.put('publicConfig', JSON.stringify(config), CACHE_TTL_SECONDS);
  return config;
}

function updateConfigEntries(updates) {
  Object.keys(updates).forEach(function (key) {
    setConfigValue(key, updates[key]);
  });
  return getPublicConfig();
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

function getActivitiesRaw() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('activitiesRaw');
  if (cached) {
    return JSON.parse(cached);
  }

  var raw = sheetRowsAsObjects(SHEET_NAMES.activities).map(function (row) {
    return {
      id: String(row.id),
      year: String(row.year || ''),
      term: String(row.term || ''),
      category: String(row.category || ''),
      label: String(row.label || ''),
      date: row.date instanceof Date ? Utilities.formatDate(row.date, 'Europe/Stockholm', 'yyyy-MM-dd') : String(row.date || ''),
      startTime: String(row.startTime || ''),
      endTime: String(row.endTime || ''),
      location: String(row.location || ''),
      capacity: row.capacity === '' ? null : Number(row.capacity),
      active: String(row.active).toLowerCase() === 'true',
      sortOrder: Number(row.sortOrder) || 0
    };
  });
  cache.put('activitiesRaw', JSON.stringify(raw), CACHE_TTL_SECONDS);
  return raw;
}

function getActivities(year, term) {
  var activeYear = year || getConfigValue('currentYear', '2026');
  var activeTerm = term || getConfigValue('currentTerm', 'Höst');

  return getActivitiesRaw()
    .filter(function (activity) {
      if (!activity.active) {
        return false;
      }
      if (activity.category === 'standing-role') {
        return true;
      }
      return String(activity.year) === String(activeYear) && String(activity.term) === String(activeTerm);
    })
    .sort(function (a, b) { return a.sortOrder - b.sortOrder; });
}

function upsertActivity(activity) {
  if (!activity.label) {
    throw new Error('Aktiviteten måste ha en rubrik.');
  }
  var sheet = getSheetByName(SHEET_NAMES.activities);
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var idCol = headers.indexOf('id');
  var id = activity.id || Utilities.getUuid();

  var rowValues = headers.map(function (header) {
    if (header === 'id') return id;
    if (header === 'active') return activity.active === false ? 'FALSE' : 'TRUE';
    return activity[header] !== undefined && activity[header] !== null ? activity[header] : '';
  });

  for (var i = 1; i < values.length; i += 1) {
    if (String(values[i][idCol]) === String(id)) {
      sheet.getRange(i + 1, 1, 1, rowValues.length).setValues([rowValues]);
      CacheService.getScriptCache().remove('activitiesRaw');
      return { ok: true, id: id };
    }
  }

  sheet.appendRow(rowValues);
  CacheService.getScriptCache().remove('activitiesRaw');
  return { ok: true, id: id };
}

function deleteActivity(id) {
  if (!id) {
    throw new Error('Id krävs.');
  }
  var sheet = getSheetByName(SHEET_NAMES.activities);
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var idCol = headers.indexOf('id');

  for (var i = 1; i < values.length; i += 1) {
    if (String(values[i][idCol]) === String(id)) {
      sheet.deleteRow(i + 1);
      CacheService.getScriptCache().remove('activitiesRaw');
      return { ok: true };
    }
  }
  throw new Error('Hittade ingen aktivitet med id ' + id);
}

function copyActivities(fromYear, fromTerm, toYear, toTerm) {
  if (!fromYear || !fromTerm || !toYear || !toTerm) {
    throw new Error('Alla fyra fält (från/till år och termin) krävs.');
  }
  var source = getActivitiesRaw().filter(function (activity) {
    return activity.category !== 'standing-role' &&
      String(activity.year) === String(fromYear) &&
      String(activity.term) === String(fromTerm);
  });

  if (source.length === 0) {
    throw new Error('Hittade inga aktiviteter för ' + fromTerm + ' ' + fromYear + ' att kopiera.');
  }

  source.forEach(function (activity) {
    upsertActivity({
      id: Utilities.getUuid(),
      year: toYear,
      term: toTerm,
      category: activity.category,
      label: activity.label,
      date: '',
      startTime: activity.startTime,
      endTime: activity.endTime,
      location: activity.location,
      capacity: activity.capacity === null ? '' : activity.capacity,
      active: true,
      sortOrder: activity.sortOrder
    });
  });

  return { ok: true, copied: source.length };
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

// Writes a full Applications row (new or in-place edit). Forces the phone
// column to plain-text format before writing: a digit-only string like
// "0701234567" would otherwise be auto-converted to a number by Sheets,
// silently dropping the leading zero - the same class of bug fixed for
// Config's date values (see normalizeConfigValue).
function writeApplicationRow(sheet, headers, rowValues, existingRowIndex) {
  var targetRow = existingRowIndex === -1 ? sheet.getLastRow() + 1 : existingRowIndex + 1;
  var phoneCol = headers.indexOf('guardianPhone');
  if (phoneCol !== -1) {
    sheet.getRange(targetRow, phoneCol + 1).setNumberFormat('@');
  }
  sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
}

function submitApplication(payload) {
  var data = payload || {};
  var requiredFields = ['year', 'term', 'guardianName', 'guardianPhone', 'guardianEmail'];

  requiredFields.forEach(function (fieldName) {
    if (!data[fieldName]) {
      throw new Error('Fältet "' + fieldName + '" saknas eller är tomt.');
    }
  });

  // scoutName/avdelning are only required for guardians of an enrolled
  // scout - older members of the association (board, Rover, adult leaders
  // with no child enrolled) check noScoutChild instead and skip them.
  var noScoutChild = String(data.noScoutChild).toLowerCase() === 'true';
  if (!noScoutChild && (!data.scoutName || !data.avdelning)) {
    throw new Error('Scoutens namn och avdelning är obligatoriska, eller ange att du inte har något barn i scouterna.');
  }

  if (String(data.consent).toLowerCase() !== 'true') {
    throw new Error('Du måste godkänna GDPR-samtycke för att skicka in anmälan.');
  }

  var selectedActivities = Array.isArray(data.selectedActivities) ? data.selectedActivities : [];
  if (selectedActivities.indexOf('own-suggestion') !== -1 && !data.ownSuggestionText) {
    throw new Error('Beskriv ditt eget förslag innan du skickar in anmälan.');
  }

  var deadline = getConfigValue('submissionDeadline', '');
  if (deadline && new Date() > new Date(deadline + 'T23:59:59')) {
    throw new Error('Anmälningstiden har gått ut (sista dag var ' + deadline + '). Kontakta en scoutledare om du ändå behöver anmäla dig.');
  }

  var now = new Date();
  var consentVersion = getConfigValue('consentVersion', 'v1');
  var consentText = getConfigValue('consentText', 'Jag godkänner att uppgifterna sparas.');

  // A guardian resubmitting for the same year/term is treated as editing
  // their existing response, not filing a duplicate one (story A7).
  var sheet = getSheetByName(SHEET_NAMES.applications);
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var emailCol = headers.indexOf('guardianEmail');
  var yearCol = headers.indexOf('year');
  var termCol = headers.indexOf('term');
  var idCol = headers.indexOf('id');
  var createdAtCol = headers.indexOf('createdAt');
  var statusCol = headers.indexOf('status');
  var notesCol = headers.indexOf('internalNotes');

  var existingRowIndex = -1;
  for (var i = 1; i < values.length; i += 1) {
    if (String(values[i][emailCol]).trim().toLowerCase() === String(data.guardianEmail).trim().toLowerCase() &&
        String(values[i][yearCol]) === String(data.year) &&
        String(values[i][termCol]) === String(data.term)) {
      existingRowIndex = i;
      break;
    }
  }

  var applicationId = existingRowIndex === -1 ? Utilities.getUuid() : values[existingRowIndex][idCol];
  var createdAt = existingRowIndex === -1 ? now : values[existingRowIndex][createdAtCol];
  var status = existingRowIndex === -1 ? 'Ny' : values[existingRowIndex][statusCol];
  var internalNotes = existingRowIndex === -1 ? '' : values[existingRowIndex][notesCol];

  var rowByHeader = {
    id: applicationId,
    createdAt: createdAt,
    updatedAt: now,
    year: data.year,
    term: data.term,
    guardianName: data.guardianName,
    guardianPhone: data.guardianPhone,
    guardianEmail: data.guardianEmail,
    scoutName: data.scoutName,
    avdelning: data.avdelning,
    selectedActivities: JSON.stringify(selectedActivities),
    ownSuggestionText: data.ownSuggestionText || '',
    comments: data.comments || '',
    status: status,
    internalNotes: internalNotes,
    consentGiven: 'TRUE',
    consentAt: now,
    consentVersion: consentVersion
  };
  var rowValues = headers.map(function (header) { return rowByHeader[header] !== undefined ? rowByHeader[header] : ''; });
  writeApplicationRow(sheet, headers, rowValues, existingRowIndex);

  getSheetByName(SHEET_NAMES.consentLog).appendRow([
    applicationId,
    data.guardianName,
    data.guardianEmail,
    now,
    consentVersion,
    consentText,
    'public-form'
  ]);

  var activitiesById = {};
  getActivitiesRaw().forEach(function (activity) { activitiesById[activity.id] = activity; });
  var selectedActivityObjects = selectedActivities.map(function (id) { return activitiesById[id] || { id: id, label: id }; });
  var wasUpdate = existingRowIndex !== -1;

  sendConfirmationEmail(data, selectedActivityObjects, wasUpdate);

  return {
    ok: true,
    id: applicationId,
    message: wasUpdate ? 'Din tidigare anmälan för den här terminen har uppdaterats.' : 'Din anmälan har sparats.',
    selectedActivities: selectedActivityObjects
  };
}

function sendConfirmationEmail(data, selectedActivityObjects, wasUpdate) {
  try {
    var lines = selectedActivityObjects.map(function (activity) {
      var when = [
        activity.date,
        activity.startTime && activity.endTime ? 'kl ' + activity.startTime + '-' + activity.endTime : '',
        activity.location
      ].filter(function (part) { return part; }).join(', ');
      return '- ' + activity.label + (when ? ' (' + when + ')' : '');
    });

    var body = 'Hej ' + data.guardianName + ',\n\n' +
      (wasUpdate ? 'Din anmälan har uppdaterats. Du har nu valt:' : 'Tack för din anmälan! Du har valt:') + '\n\n' +
      (lines.length ? lines.join('\n') : '(Inga aktiviteter valda)') +
      (data.ownSuggestionText ? '\n\nEget förslag: ' + data.ownSuggestionText : '') +
      (data.scoutName ? '\n\nScout: ' + data.scoutName + (data.avdelning ? ' (' + data.avdelning + ')' : '') : '') +
      '\n\nOm något är fel, fyll i formuläret igen med samma e-postadress så uppdateras din anmälan.' +
      '\n\nHälsningar,\nStora Lundby Scoutkår';

    MailApp.sendEmail({
      to: data.guardianEmail,
      subject: 'Bekräftelse - Föräldraengagemang Stora Lundby',
      body: body
    });
  } catch (error) {
    console.warn('Kunde inte skicka bekräftelsemail: ' + error.message);
  }
}

function getApplications() {
  var activitiesById = {};
  getActivitiesRaw().forEach(function (activity) { activitiesById[activity.id] = activity; });

  return sheetRowsAsObjects(SHEET_NAMES.applications).map(function (item) {
    var selectedIds = [];
    try {
      selectedIds = item.selectedActivities ? JSON.parse(item.selectedActivities) : [];
    } catch (error) {
      selectedIds = [];
    }
    item.selectedActivities = selectedIds;
    item.selectedActivityLabels = selectedIds.map(function (id) {
      return activitiesById[id] ? activitiesById[id].label : id;
    });
    return item;
  }).reverse();
}

function updateApplicationStatus(id, status) {
  return setApplicationField(id, 'status', status);
}

function updateApplicationNotes(id, internalNotes) {
  return setApplicationField(id, 'internalNotes', internalNotes || '');
}

function setApplicationField(id, fieldName, value) {
  var sheet = getSheetByName(SHEET_NAMES.applications);
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var idCol = headers.indexOf('id');
  var fieldCol = headers.indexOf(fieldName);
  var updatedAtCol = headers.indexOf('updatedAt');

  if (fieldCol === -1) {
    throw new Error('Okänt fält: ' + fieldName);
  }

  for (var i = 1; i < values.length; i += 1) {
    if (String(values[i][idCol]) === String(id)) {
      sheet.getRange(i + 1, fieldCol + 1).setValue(value);
      if (updatedAtCol !== -1) {
        sheet.getRange(i + 1, updatedAtCol + 1).setValue(new Date());
      }
      return { ok: true };
    }
  }
  throw new Error('Hittade ingen anmälan med id ' + id);
}

function createManualApplication(payload) {
  var data = payload || {};
  var now = new Date();
  var selectedActivities = Array.isArray(data.selectedActivities) ? data.selectedActivities : [];

  var sheet = getSheetByName(SHEET_NAMES.applications);
  var headers = sheet.getDataRange().getValues()[0];

  var rowByHeader = {
    id: Utilities.getUuid(),
    createdAt: now,
    updatedAt: now,
    year: data.year || getConfigValue('currentYear', '2026'),
    term: data.term || getConfigValue('currentTerm', 'Höst'),
    guardianName: data.guardianName || '',
    guardianPhone: data.guardianPhone || '',
    guardianEmail: data.guardianEmail || '',
    scoutName: data.scoutName || '',
    avdelning: data.avdelning || '',
    selectedActivities: JSON.stringify(selectedActivities),
    ownSuggestionText: data.ownSuggestionText || '',
    comments: data.comments || '',
    status: data.status || 'Ny',
    internalNotes: data.internalNotes || '',
    consentGiven: 'TRUE',
    consentAt: now,
    consentVersion: getConfigValue('consentVersion', 'v1')
  };
  var rowValues = headers.map(function (header) { return rowByHeader[header] !== undefined ? rowByHeader[header] : ''; });

  writeApplicationRow(sheet, headers, rowValues, -1);
  return { ok: true };
}

function getAdminSummary() {
  var apps = getApplications();
  var activitiesById = {};
  getActivitiesRaw().forEach(function (activity) { activitiesById[activity.id] = activity; });

  var summary = {
    total: apps.length,
    newCount: apps.filter(function (item) { return String(item.status).toLowerCase() === 'ny'; }).length,
    attendanceCount: 0,
    giftCount: 0,
    standingRoleCount: 0
  };

  apps.forEach(function (app) {
    (app.selectedActivities || []).forEach(function (id) {
      var activity = activitiesById[id];
      var category = activity ? activity.category : '';
      if (category === 'gift') {
        summary.giftCount += 1;
      } else if (category === 'standing-role') {
        summary.standingRoleCount += 1;
      } else {
        summary.attendanceCount += 1;
      }
    });
  });

  return summary;
}

// ---------------------------------------------------------------------------
// Consent log / admins
// ---------------------------------------------------------------------------

function getConsentLogEntries() {
  return sheetRowsAsObjects(SHEET_NAMES.consentLog).reverse();
}

// ---------------------------------------------------------------------------
// Data retention - deletes a term's personal data, keeping only a record
// that a purge happened (counts, who, when), never the purged data itself.
// ---------------------------------------------------------------------------

function purgeTermData(year, term, purgedBy) {
  if (!year || !term) {
    throw new Error('År och termin krävs för att gallra data.');
  }

  var appSheet = getSheetByName(SHEET_NAMES.applications);
  var appValues = appSheet.getDataRange().getValues();
  var appHeaders = appValues[0];
  var idCol = appHeaders.indexOf('id');
  var yearCol = appHeaders.indexOf('year');
  var termCol = appHeaders.indexOf('term');

  var idsToPurge = [];
  for (var i = appValues.length - 1; i >= 1; i -= 1) {
    if (String(appValues[i][yearCol]) === String(year) && String(appValues[i][termCol]) === String(term)) {
      idsToPurge.push(String(appValues[i][idCol]));
      appSheet.deleteRow(i + 1);
    }
  }

  var consentPurged = 0;
  if (idsToPurge.length > 0) {
    var consentSheet = getSheetByName(SHEET_NAMES.consentLog);
    var consentValues = consentSheet.getDataRange().getValues();
    var consentHeaders = consentValues[0];
    var consentIdCol = consentHeaders.indexOf('applicationId');
    for (var j = consentValues.length - 1; j >= 1; j -= 1) {
      if (idsToPurge.indexOf(String(consentValues[j][consentIdCol])) !== -1) {
        consentSheet.deleteRow(j + 1);
        consentPurged += 1;
      }
    }
  }

  getSheetByName(SHEET_NAMES.purgeLog).appendRow([
    new Date(),
    purgedBy || '',
    year,
    term,
    idsToPurge.length,
    consentPurged
  ]);

  return { ok: true, applicationsPurged: idsToPurge.length, consentLogPurged: consentPurged };
}

function getPurgeLogEntries() {
  return sheetRowsAsObjects(SHEET_NAMES.purgeLog).reverse();
}

function getAdmins() {
  return sheetRowsAsObjects(SHEET_NAMES.admins);
}

function addAdmin(email) {
  if (!email) {
    throw new Error('E-post krävs.');
  }
  var adminSheet = getSheetByName(SHEET_NAMES.admins);
  var values = adminSheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i += 1) {
    if (String(values[i][0]).trim().toLowerCase() === String(email).trim().toLowerCase()) {
      adminSheet.getRange(i + 1, 3).setValue('TRUE');
      return { ok: true };
    }
  }
  adminSheet.appendRow([email, 'admin', 'TRUE']);
  return { ok: true };
}

function setAdminActive(email, active) {
  if (!email) {
    throw new Error('E-post krävs.');
  }
  var adminSheet = getSheetByName(SHEET_NAMES.admins);
  var values = adminSheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i += 1) {
    if (String(values[i][0]).trim().toLowerCase() === String(email).trim().toLowerCase()) {
      adminSheet.getRange(i + 1, 3).setValue(active ? 'TRUE' : 'FALSE');
      return { ok: true };
    }
  }
  throw new Error('Hittade ingen admin med e-post ' + email);
}

// ---------------------------------------------------------------------------
// Paper form (Google Doc) - some members prefer a printed sign-up sheet
// over the web form. Generates a Google Doc styled after the legacy paper
// flyer, populated with the given term's actual activities, and keeps a
// record of the link so the admin UI can show "already exists" instead of
// silently creating duplicates. One doc per (year, term); delete the
// existing one first to regenerate after activities change.
// ---------------------------------------------------------------------------

var SWEDISH_MONTHS = [
  'januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december'
];

function formatDocDate(isoDate) {
  if (!isoDate) return '';
  var parts = String(isoDate).split('T')[0].split('-').map(Number);
  var year = parts[0], month = parts[1], day = parts[2];
  if (!year || !month || !day) return String(isoDate);
  return day + ' ' + SWEDISH_MONTHS[month - 1];
}

function formatActivityLineForDoc(activity) {
  var when = [
    formatDocDate(activity.date),
    activity.startTime && activity.endTime ? 'kl ' + activity.startTime + '-' + activity.endTime : ''
  ].filter(function (part) { return part; }).join(', ');
  var parts = [activity.label];
  if (activity.location) parts.push(activity.location);
  var line = parts.join(', ');
  return when ? when + ', ' + line : line;
}

function getPaperFormRecord(year, term) {
  year = year || getConfigValue('currentYear', '2026');
  term = term || getConfigValue('currentTerm', 'Höst');

  var rows = sheetRowsAsObjects(SHEET_NAMES.paperForms);
  for (var i = 0; i < rows.length; i += 1) {
    if (String(rows[i].year) === String(year) && String(rows[i].term) === String(term)) {
      return rows[i];
    }
  }
  return null;
}

// Best-effort: a generated doc without the QR code is still useful (it's
// the whole sign-up sheet, the QR is a convenience shortcut), so a failure
// fetching it from the external QR service shouldn't block doc creation.
function fetchQrCodeBlob(url) {
  try {
    var qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&color=4-58-99&data=' + encodeURIComponent(url);
    var response = UrlFetchApp.fetch(qrUrl, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) return null;
    return response.getBlob().setName('qr.png');
  } catch (error) {
    console.warn('Kunde inte hämta QR-kod: ' + error.message);
    return null;
  }
}

function generatePaperForm(year, term, createdBy) {
  year = year || getConfigValue('currentYear', '2026');
  term = term || getConfigValue('currentTerm', 'Höst');

  if (getPaperFormRecord(year, term)) {
    throw new Error('Det finns redan en pappersblankett för ' + term + ' ' + year + '. Ta bort den först om du vill skapa en ny version.');
  }

  var deadline = getConfigValue('submissionDeadline', '');
  var publicFormUrl = getConfigValue('publicFormUrl', 'https://stora-lundby.netlify.app/');
  var allActivities = getActivities(year, term);
  var signupActivities = allActivities.filter(function (a) { return a.category !== 'standing-role'; });
  var standingRoles = allActivities.filter(function (a) { return a.category === 'standing-role'; });

  var doc = DocumentApp.create('Föräldralapp ' + term + ' ' + year);
  var body = doc.getBody();
  body.setMarginTop(40).setMarginBottom(40).setMarginLeft(56).setMarginRight(56);

  body.appendParagraph('STORA LUNDBY SCOUTKÅR').editAsText().setBold(true).setFontSize(11);
  body.appendParagraph('Vi behöver din hjälp!').setHeading(DocumentApp.ParagraphHeading.TITLE);

  body.appendParagraph(
    'Stora Lundby scoutkår drivs helt och hållet ideellt av ledare, funktionärer och styrelse. Kåren är en ' +
    'partipolitiskt och religiöst obunden organisation. Om vi ska kunna fortsätta att ha en scoutkår så behöver ' +
    'vi hjälp av er scoutföräldrar med vissa aktiviteter.'
  );
  body.appendParagraph('Du som förälder förväntas hjälpa till vid minst ett, gärna två tillfällen varje termin. Det handlar om att:')
    .editAsText().setBold(true);

  [
    'Få inkomster från marknader på Mjörnbotorget och från annan försäljning. Här behövs det dels skänkta vinster ' +
      'till lotteri, men också praktisk hjälp att samordna marknadsståndet, tre marknader per år.',
    'Sköta om scoutlokalerna Scoutgården och Ljungslätt med reparationer, städning etc.',
    'Ibland behöver vi också praktisk hjälp för en enstaka insats. Det kommer vi att efterlysa i månadsbreven ' +
      'som vi skickar ut.'
  ].forEach(function (text) {
    body.appendListItem(text).setGlyphType(DocumentApp.GlyphType.BULLET);
  });

  body.appendParagraph('Du får gärna komma med helt egna idéer om insatser också. Välkommen med förslag!');
  body.appendParagraph('Styrelsen i Stora Lundby Scoutkår').editAsText().setItalic(true);

  body.appendHorizontalRule();

  body.appendParagraph(term + ' ' + year).setHeading(DocumentApp.ParagraphHeading.HEADING1);

  if (deadline) {
    var deadlineText = body.appendParagraph('Lämnas till scoutledare senast ' + deadline).editAsText();
    deadlineText.setBold(true).setForegroundColor('#B3005E');
  }

  // Scan to sign up digitally instead - placed early since it's the single
  // most useful shortcut for a reader skimming a printed page.
  var qrBlob = fetchQrCodeBlob(publicFormUrl);
  if (qrBlob) {
    var qrImage = body.appendImage(qrBlob);
    qrImage.setWidth(120).setHeight(120);
    body.appendParagraph('Eller skanna QR-koden för att anmäla dig digitalt: ' + publicFormUrl)
      .editAsText().setFontSize(9).setForegroundColor('#64748b');
  }

  body.appendParagraph('Kryssa i vad du kan hjälpa till med:').editAsText().setBold(true);
  signupActivities.forEach(function (activity) {
    body.appendListItem(formatActivityLineForDoc(activity)).setGlyphType(DocumentApp.GlyphType.HOLLOW_BULLET);
  });

  if (standingRoles.length > 0) {
    body.appendParagraph('Jag kan ställa upp till följande:').editAsText().setBold(true);
    standingRoles.forEach(function (activity) {
      var label = activity.id === 'own-suggestion' ? activity.label + ':' : activity.label;
      body.appendListItem(label).setGlyphType(DocumentApp.GlyphType.HOLLOW_BULLET);
    });
  }

  body.appendParagraph('');
  body.appendParagraph('Uppgifter om mig som vårdnadshavare:').editAsText().setBold(true);
  body.appendParagraph('Namn ________________________________________________________');
  body.appendParagraph('Telefon ________________________________________________');
  body.appendParagraph('E-post ________________________________________________________');

  body.appendParagraph('');
  body.appendParagraph('Jag är vårdnadshavare till följande scout:').editAsText().setBold(true);
  body.appendParagraph('Namn ________________________________________________________');
  body.appendParagraph('Avdelning ________________________________________________________');

  doc.saveAndClose();

  var file = DriveApp.getFileById(doc.getId());
  // Printed/handed-out docs are meant to be openable by anyone holding the
  // link (an admin without edit access, or a parent asking to see it) -
  // view-only, not editable by just anyone with the URL.
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var docUrl = file.getUrl();
  getSheetByName(SHEET_NAMES.paperForms).appendRow([year, term, doc.getId(), docUrl, new Date(), createdBy || '']);

  return { ok: true, docUrl: docUrl, docId: doc.getId() };
}

function deletePaperForm(year, term) {
  year = year || getConfigValue('currentYear', '2026');
  term = term || getConfigValue('currentTerm', 'Höst');

  var sheet = getSheetByName(SHEET_NAMES.paperForms);
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var yearCol = headers.indexOf('year');
  var termCol = headers.indexOf('term');
  var docIdCol = headers.indexOf('docId');

  for (var i = 1; i < values.length; i += 1) {
    if (String(values[i][yearCol]) === String(year) && String(values[i][termCol]) === String(term)) {
      var docId = values[i][docIdCol];
      try {
        DriveApp.getFileById(docId).setTrashed(true);
      } catch (error) {
        console.warn('Kunde inte flytta dokumentet till papperskorgen: ' + error.message);
      }
      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  throw new Error('Hittade ingen pappersblankett för ' + term + ' ' + year);
}

// ---------------------------------------------------------------------------
// Manual test helper (run from the Apps Script editor)
// ---------------------------------------------------------------------------

function testSetup() {
  initializeProject();
  Logger.log('Project initialized');
  Logger.log(JSON.stringify(getActivities()));
}
