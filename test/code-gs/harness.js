// A minimal in-memory stand-in for the Google Apps Script runtime, so
// Code.gs's actual logic (validation, admin checks, the resubmit-as-edit
// behavior, purge) can run and be asserted on under Node/Vitest instead of
// only ever being exercised by hand in the Apps Script editor.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CODE_GS_PATH = path.resolve(__dirname, '../../Code.gs');

// Mirrors real Google Sheets: a digit-only string written to a cell that
// hasn't been explicitly formatted as plain text ('@') gets silently
// auto-converted to a Number, dropping any leading zero. Without
// simulating this, the harness couldn't actually catch the phone-number
// bug (or prove the fix works) - a "fake" sheet that just stores whatever
// you hand it would make that test pass regardless of whether the real
// fix is correct.
function coerceForSheetCell(value, isTextFormatted) {
  if (isTextFormatted) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Number(value);
  }
  return value;
}

class FakeSheet {
  constructor(name) {
    this.name = name;
    this.rows = [];
    this.formats = {};
  }

  appendRow(row) {
    this.rows.push(row.map((value) => coerceForSheetCell(value, false)));
  }

  getDataRange() {
    const rows = this.rows;
    return { getValues: () => rows.map((row) => row.slice()) };
  }

  getLastRow() {
    return this.rows.length;
  }

  getRange(row, col, numRows = 1, numCols = 1) {
    const sheet = this;
    const formatKey = (r, c) => `${r},${c}`;
    return {
      setNumberFormat(format) {
        sheet.formats[formatKey(row, col)] = format;
      },
      setValue(value) {
        if (!sheet.rows[row - 1]) sheet.rows[row - 1] = [];
        const isText = sheet.formats[formatKey(row, col)] === '@';
        sheet.rows[row - 1][col - 1] = coerceForSheetCell(value, isText);
      },
      setValues(values) {
        for (let i = 0; i < values.length; i += 1) {
          if (!sheet.rows[row - 1 + i]) sheet.rows[row - 1 + i] = [];
          for (let j = 0; j < values[i].length; j += 1) {
            const isText = sheet.formats[formatKey(row, col + j)] === '@';
            sheet.rows[row - 1 + i][col - 1 + j] = coerceForSheetCell(values[i][j], isText);
          }
        }
      }
    };
  }

  deleteRow(row) {
    this.rows.splice(row - 1, 1);
  }
}

class FakeSpreadsheet {
  constructor() {
    this.sheets = new Map();
  }

  getSheetByName(name) {
    return this.sheets.get(name) || null;
  }

  insertSheet(name) {
    const sheet = new FakeSheet(name);
    this.sheets.set(name, sheet);
    return sheet;
  }
}

export function createCodeGsContext() {
  const spreadsheet = new FakeSpreadsheet();
  const scriptProperties = new Map([['SPREADSHEET_ID', 'fake-id']]);
  const sentEmails = [];
  // Mutable so tests can simulate signing in as a different Google account
  // before calling requireAdmin/verifyGoogleIdToken.
  const tokenInfo = { email: 'admin@storalundby.se', email_verified: 'true', aud: 'test-client' };

  const context = {
    console,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => (scriptProperties.has(key) ? scriptProperties.get(key) : null),
        setProperty: (key, value) => scriptProperties.set(key, value)
      })
    },
    SpreadsheetApp: {
      openById: () => spreadsheet,
      getActiveSpreadsheet: () => null,
      create: () => new FakeSpreadsheet()
    },
    Utilities: {
      getUuid: (() => {
        let counter = 0;
        return () => `uuid-${(counter += 1)}`;
      })(),
      // Duck-typed rather than `date instanceof Date`: this mock is defined
      // in the host realm, but dates passed in from Code.gs belong to the
      // vm context's own realm, so an instanceof check here would always
      // be false even for a real Date.
      formatDate: (date) => (date && typeof date.toISOString === 'function' ? date.toISOString().slice(0, 10) : String(date))
    },
    ContentService: {
      MimeType: { JSON: 'JSON' },
      createTextOutput: (text) => ({
        text,
        setMimeType() {
          return this;
        }
      })
    },
    MailApp: {
      sendEmail: (options) => sentEmails.push(options)
    },
    UrlFetchApp: {
      fetch: () => ({
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify(tokenInfo)
      })
    },
    Logger: { log: () => {} },
    CacheService: {
      getScriptCache: (() => {
        const store = new Map();
        return () => ({
          get: (key) => (store.has(key) ? store.get(key) : null),
          put: (key, value) => store.set(key, value)
        });
      })()
    }
  };

  vm.createContext(context);
  const source = fs.readFileSync(CODE_GS_PATH, 'utf-8');
  vm.runInContext(source, context, { filename: 'Code.gs' });

  // Exposed so tests can construct a Date belonging to this vm context's own
  // realm - `instanceof Date` inside Code.gs only matches dates created
  // with *this* context's Date constructor, not the host realm's.
  context.__makeDate = vm.runInContext('(function (iso) { return new Date(iso); })', context);

  return { context, spreadsheet, sentEmails, tokenInfo };
}
