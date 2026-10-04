function initializeProject() {
  const ss = getSpreadsheet();

  const sheetNames = {
    applications: 'Applications',
    consentLog: 'ConsentLog',
    config: 'Config',
    admins: 'Admins'
  };

  const sheets = Object.values(sheetNames);
  sheets.forEach((name) => {
    if (!ss.getSheetByName(name)) {
      ss.insertSheet(name);
    }
  });

  const appSheet = ss.getSheetByName(sheetNames.applications);
  const consentSheet = ss.getSheetByName(sheetNames.consentLog);
  const configSheet = ss.getSheetByName(sheetNames.config);
  const adminSheet = ss.getSheetByName(sheetNames.admins);

  if (appSheet.getLastRow() === 0) {
    appSheet.appendRow([
      'id',
      'createdAt',
      'year',
      'term',
      'engagementType',
      'supportArea',
      'name',
      'phone',
      'email',
      'childName',
      'childClass',
      'comments',
      'status',
      'consentGiven',
      'consentAt',
      'consentVersion'
    ]);
  }

  if (consentSheet.getLastRow() === 0) {
    consentSheet.appendRow([
      'applicationId',
      'personName',
      'email',
      'consentGivenAt',
      'consentVersion',
      'consentText',
      'source'
    ]);
  }

  if (configSheet.getLastRow() === 0) {
    configSheet.appendRow(['key', 'value']);
    configSheet.appendRow(['currentYear', '2026']);
    configSheet.appendRow(['currentTerm', 'Höst']);
    configSheet.appendRow(['consentVersion', 'v1']);
    configSheet.appendRow([
      'consentText',
      'Jag godkänner att Stora Lundby sparar mina uppgifter för att hantera anmälan och kontakta mig i samband med verksamheten.'
    ]);
  }

  if (adminSheet.getLastRow() === 0) {
    adminSheet.appendRow(['email', 'role', 'active']);
    const activeUserEmail = Session.getActiveUser() ? Session.getActiveUser().getEmail() : '';
    if (activeUserEmail) {
      adminSheet.appendRow([activeUserEmail, 'admin', 'TRUE']);
    }
  }
}

function getSpreadsheet() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const spreadsheetId = scriptProperties.getProperty('SPREADSHEET_ID');

  if (spreadsheetId) {
    try {
      return SpreadsheetApp.openById(spreadsheetId);
    } catch (error) {
      console.warn('Stored spreadsheet ID is invalid. Creating a new spreadsheet.');
    }
  }

  try {
    const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (activeSpreadsheet) {
      return activeSpreadsheet;
    }
  } catch (error) {
    // No active spreadsheet bound to the project.
  }

  const newSpreadsheet = SpreadsheetApp.create('Stora Lundby - Engagement');
  scriptProperties.setProperty('SPREADSHEET_ID', newSpreadsheet.getId());
  return newSpreadsheet;
}

function getSheetByName(name) {
  initializeProject();
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) {
    throw new Error('Sheet "' + name + '" could not be found.');
  }
  return sheet;
}

function getConfigValue(key, defaultValue) {
  const configSheet = getSheetByName('Config');
  const values = configSheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i += 1) {
    if (String(values[i][0]).trim().toLowerCase() === String(key).trim().toLowerCase()) {
      return values[i][1];
    }
  }

  return defaultValue;
}

function setConfigValue(key, value) {
  const configSheet = getSheetByName('Config');
  const values = configSheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i += 1) {
    if (String(values[i][0]).trim().toLowerCase() === String(key).trim().toLowerCase()) {
      configSheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }

  configSheet.appendRow([key, value]);
}

function isAdmin(userEmail) {
  if (!userEmail) {
    return false;
  }

  const adminSheet = getSheetByName('Admins');
  const values = adminSheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i += 1) {
    const row = values[i];
    if (String(row[0]).trim().toLowerCase() === String(userEmail).trim().toLowerCase()) {
      return String(row[2]).trim().toLowerCase() === 'true' || String(row[2]).trim().toLowerCase() === 'yes';
    }
  }

  return false;
}

function getConfig() {
  return {
    currentYear: getConfigValue('currentYear', '2026'),
    currentTerm: getConfigValue('currentTerm', 'Höst'),
    consentVersion: getConfigValue('consentVersion', 'v1'),
    consentText: getConfigValue(
      'consentText',
      'Jag godkänner att Stora Lundby sparar mina uppgifter för att hantera anmälan och kontakta mig i samband med verksamheten.'
    )
  };
}

function doGet(e) {
  initializeProject();
  const page = e && e.parameter && e.parameter.page ? e.parameter.page : 'public';

  if (page === 'admin') {
    const activeUser = Session.getActiveUser() ? Session.getActiveUser().getEmail() : '';
    if (!isAdmin(activeUser)) {
      return HtmlService.createHtmlOutput('<h2>Access denied</h2><p>Du måste vara inloggad som admin för att komma åt denna sida.</p>');
    }
    return HtmlService.createHtmlOutputFromFile('Admin');
  }

  return HtmlService.createHtmlOutputFromFile('Public');
}

function submitApplication(formData) {
  initializeProject();

  const payload = formData || {};
  const requiredFields = ['year', 'term', 'engagementType', 'name', 'phone', 'email', 'consent'];

  for (let i = 0; i < requiredFields.length; i += 1) {
    const fieldName = requiredFields[i];
    if (!payload[fieldName]) {
      throw new Error('Fältet "' + fieldName + '" saknas eller är tomt.');
    }
  }

  if (String(payload.consent).toLowerCase() !== 'true') {
    throw new Error('Du måste godkänna GDPR-samtycke för att skicka in anmälan.');
  }

  const applicationId = Utilities.getUuid();
  const now = new Date();
  const consentVersion = getConfigValue('consentVersion', 'v1');
  const consentText = getConfigValue(
    'consentText',
    'Jag godkänner att Stora Lundby sparar mina uppgifter för att hantera anmälan och kontakta mig i samband med verksamheten.'
  );

  const appSheet = getSheetByName('Applications');
  appSheet.appendRow([
    applicationId,
    now,
    payload.year,
    payload.term,
    payload.engagementType,
    payload.supportArea || '',
    payload.name,
    payload.phone,
    payload.email,
    payload.childName || '',
    payload.childClass || '',
    payload.comments || '',
    'Ny',
    'TRUE',
    now,
    consentVersion
  ]);

  const consentSheet = getSheetByName('ConsentLog');
  consentSheet.appendRow([
    applicationId,
    payload.name,
    payload.email,
    now,
    consentVersion,
    consentText,
    'public-form'
  ]);

  return {
    ok: true,
    id: applicationId,
    message: 'Din anmälan har sparats.'
  };
}

function getApplications() {
  const sheet = getSheetByName('Applications');
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    return [];
  }

  const headers = data[0];
  const rows = data.slice(1).filter((row) => row.some((cell) => String(cell).trim() !== ''));

  return rows.map((row) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row[index] || '';
    });
    return item;
  }).reverse();
}

function getAdminDashboard() {
  const apps = getApplications();
  const summary = {
    total: apps.length,
    newCount: apps.filter((item) => String(item.status).toLowerCase() === 'ny').length,
    volunteerCount: apps.filter((item) => String(item.engagementType).toLowerCase() === 'volunteer').length,
    helpCount: apps.filter((item) => String(item.engagementType).toLowerCase() === 'need-help').length
  };

  return {
    summary,
    rows: apps
  };
}

function updateApplicationStatus(id, status) {
  const sheet = getSheetByName('Applications');
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i += 1) {
    if (String(values[i][0]) === String(id)) {
      sheet.getRange(i + 1, 13).setValue(status);
      return { ok: true };
    }
  }

  throw new Error('Hittade ingen anmälning med id ' + id);
}

function createManualApplication(data) {
  const payload = data || {};
  const now = new Date();
  const applicationId = Utilities.getUuid();

  const appSheet = getSheetByName('Applications');
  appSheet.appendRow([
    applicationId,
    now,
    payload.year || getConfigValue('currentYear', '2026'),
    payload.term || getConfigValue('currentTerm', 'Höst'),
    payload.engagementType || 'volunteer',
    payload.supportArea || '',
    payload.name || '',
    payload.phone || '',
    payload.email || '',
    payload.childName || '',
    payload.childClass || '',
    payload.comments || '',
    payload.status || 'Ny',
    'TRUE',
    now,
    getConfigValue('consentVersion', 'v1')
  ]);

  const consentSheet = getSheetByName('ConsentLog');
  consentSheet.appendRow([
    applicationId,
    payload.name || '',
    payload.email || '',
    now,
    getConfigValue('consentVersion', 'v1'),
    getConfigValue('consentText', 'Jag godkänner att uppgifterna sparas.'),
    'admin-manual'
  ]);

  return { ok: true };
}

function getConsentLog() {
  const sheet = getSheetByName('ConsentLog');
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    return [];
  }

  const headers = data[0];
  return data.slice(1).filter((row) => row.some((cell) => String(cell).trim() !== '')).map((row) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row[index] || '';
    });
    return item;
  }).reverse();
}

function getAdmins() {
  const sheet = getSheetByName('Admins');
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    return [];
  }

  const headers = data[0];
  return data.slice(1).filter((row) => row.some((cell) => String(cell).trim() !== '')).map((row) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row[index] || '';
    });
    return item;
  });
}

function addAdmin(email) {
  if (!email) {
    throw new Error('E-post krävs.');
  }

  const adminSheet = getSheetByName('Admins');
  adminSheet.appendRow([email, 'admin', 'TRUE']);
  return { ok: true };
}

function updateConfig(key, value) {
  setConfigValue(key, value);
  return { ok: true };
}

function testSetup() {
  initializeProject();
  Logger.log('Project initialized');
}
