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
  activities: 'Activities'
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
    case 'getAdmins':
      requireAdmin(params);
      return getAdmins();
    case 'addAdmin':
      requireAdmin(params);
      return addAdmin(params.email);
    case 'updateConfig':
      requireAdmin(params);
      return updateConfigEntries(params.updates || {});
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
  if (!isAdmin(email)) {
    throw new Error('Åtkomst nekad.');
  }
  return email;
}

function verifyGoogleIdToken(idToken) {
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

function initializeProject() {
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

function getConfigValue(key, defaultValue) {
  var configSheet = getSheetByName(SHEET_NAMES.config);
  var values = configSheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i += 1) {
    var row = values[i];
    if (String(row[0]).trim().toLowerCase() === String(key).trim().toLowerCase()) {
      return row[1];
    }
  }
  return defaultValue;
}

function setConfigValue(key, value) {
  var configSheet = getSheetByName(SHEET_NAMES.config);
  var values = configSheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i += 1) {
    if (String(values[i][0]).trim().toLowerCase() === String(key).trim().toLowerCase()) {
      configSheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  configSheet.appendRow([key, value]);
}

function getPublicConfig() {
  var configSheet = getSheetByName(SHEET_NAMES.config);
  var values = configSheet.getDataRange().getValues();
  var config = {};
  for (var i = 1; i < values.length; i += 1) {
    config[values[i][0]] = values[i][1];
  }
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
  return sheetRowsAsObjects(SHEET_NAMES.activities).map(function (row) {
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

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

function submitApplication(payload) {
  var data = payload || {};
  var requiredFields = ['year', 'term', 'guardianName', 'guardianPhone', 'guardianEmail', 'scoutName', 'avdelning'];

  requiredFields.forEach(function (fieldName) {
    if (!data[fieldName]) {
      throw new Error('Fältet "' + fieldName + '" saknas eller är tomt.');
    }
  });

  if (String(data.consent).toLowerCase() !== 'true') {
    throw new Error('Du måste godkänna GDPR-samtycke för att skicka in anmälan.');
  }

  var selectedActivities = Array.isArray(data.selectedActivities) ? data.selectedActivities : [];
  if (selectedActivities.indexOf('own-suggestion') !== -1 && !data.ownSuggestionText) {
    throw new Error('Beskriv ditt eget förslag innan du skickar in anmälan.');
  }

  var applicationId = Utilities.getUuid();
  var now = new Date();
  var consentVersion = getConfigValue('consentVersion', 'v1');
  var consentText = getConfigValue('consentText', 'Jag godkänner att uppgifterna sparas.');

  var row = [
    applicationId,
    now,
    now,
    data.year,
    data.term,
    data.guardianName,
    data.guardianPhone,
    data.guardianEmail,
    data.scoutName,
    data.avdelning,
    JSON.stringify(selectedActivities),
    data.ownSuggestionText || '',
    data.comments || '',
    'Ny',
    '',
    'TRUE',
    now,
    consentVersion
  ];

  getSheetByName(SHEET_NAMES.applications).appendRow(row);

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

  return {
    ok: true,
    id: applicationId,
    message: 'Din anmälan har sparats.',
    selectedActivities: selectedActivities.map(function (id) { return activitiesById[id] || { id: id, label: id }; })
  };
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

  var row = [
    Utilities.getUuid(),
    now,
    now,
    data.year || getConfigValue('currentYear', '2026'),
    data.term || getConfigValue('currentTerm', 'Höst'),
    data.guardianName || '',
    data.guardianPhone || '',
    data.guardianEmail || '',
    data.scoutName || '',
    data.avdelning || '',
    JSON.stringify(selectedActivities),
    data.ownSuggestionText || '',
    data.comments || '',
    data.status || 'Ny',
    data.internalNotes || '',
    'TRUE',
    now,
    getConfigValue('consentVersion', 'v1')
  ];

  getSheetByName(SHEET_NAMES.applications).appendRow(row);
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

// ---------------------------------------------------------------------------
// Manual test helper (run from the Apps Script editor)
// ---------------------------------------------------------------------------

function testSetup() {
  initializeProject();
  Logger.log('Project initialized');
  Logger.log(JSON.stringify(getActivities()));
}
