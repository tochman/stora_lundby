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
    this.getDataRangeCalls = 0;
  }

  appendRow(row) {
    this.rows.push(row.map((value) => coerceForSheetCell(value, false)));
  }

  getDataRange() {
    this.getDataRangeCalls += 1;
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
    this.id = 'fake-id'; // matches the SPREADSHEET_ID script property set below
  }

  getId() {
    return this.id;
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

// Minimal DocumentApp/DriveApp stand-ins - just enough surface for
// generatePaperForm to run end to end and for tests to assert on what was
// written (paragraph/list text, image presence, sharing, trashing), not a
// faithful recreation of the full Docs/Drive API.
//
// FakeText is stateful (bold/italic/color/size/font all start as null, not
// "inherited from whatever came before") specifically so tests can prove
// Code.gs sets every property explicitly on every element - that's the
// actual fix for the real Docs bug where an unset property silently carries
// forward from the previous paragraph's trailing style. A no-op mock
// would've passed even with that bug still present.
class FakeText {
  constructor() { this.bold = null; this.italic = null; this.color = null; this.fontSize = null; this.fontFamily = null; }
  setBold(v) { this.bold = v; return this; }
  setItalic(v) { this.italic = v; return this; }
  setFontSize(v) { this.fontSize = v; return this; }
  setForegroundColor(v) { this.color = v; return this; }
  setFontFamily(v) { this.fontFamily = v; return this; }
}

class FakeParagraph {
  constructor(text) {
    this.text = text;
    this.heading = null;
    this.spacingBefore = null;
    this.spacingAfter = null;
    this.lineSpacing = null;
    this.indentStart = null;
    this.textStyle = new FakeText();
  }
  setHeading(heading) { this.heading = heading; return this; }
  setSpacingBefore(v) { this.spacingBefore = v; return this; }
  setSpacingAfter(v) { this.spacingAfter = v; return this; }
  setLineSpacing(v) { this.lineSpacing = v; return this; }
  setIndentStart(v) { this.indentStart = v; return this; }
  editAsText() { return this.textStyle; }
}

class FakeListItem {
  constructor(text) {
    this.text = text;
    this.glyphType = null;
    this.spacingBefore = null;
    this.spacingAfter = null;
    this.lineSpacing = null;
    this.indentStart = null;
    this.textStyle = new FakeText();
  }
  setGlyphType(glyphType) { this.glyphType = glyphType; return this; }
  setSpacingBefore(v) { this.spacingBefore = v; return this; }
  setSpacingAfter(v) { this.spacingAfter = v; return this; }
  setLineSpacing(v) { this.lineSpacing = v; return this; }
  setIndentStart(v) { this.indentStart = v; return this; }
  editAsText() { return this.textStyle; }
}

class FakeImage {
  setWidth(width) { this.width = width; return this; }
  setHeight(height) { this.height = height; return this; }
}

class FakeTableCell {
  constructor() { this.images = []; this.paragraphs = []; }
  appendImage(blob) { const img = new FakeImage(); img.blob = blob; this.images.push(img); return img; }
  appendParagraph(text) { const p = new FakeParagraph(text); this.paragraphs.push(p); return p; }
}

class FakeTableRow {
  constructor() { this.cells = []; }
  appendTableCell() { const cell = new FakeTableCell(); this.cells.push(cell); return cell; }
}

class FakeTable {
  constructor() { this.rows = []; this.borderWidth = null; this.columnWidths = {}; }
  appendTableRow() { const row = new FakeTableRow(); this.rows.push(row); return row; }
  setBorderWidth(width) { this.borderWidth = width; return this; }
  setColumnWidth(index, width) { this.columnWidths[index] = width; return this; }
}

class FakeBody {
  constructor() {
    this.paragraphs = [];
    this.listItems = [];
    this.images = [];
    this.tables = [];
    this.pageBreaks = 0;
  }
  setMarginTop() { return this; }
  setMarginBottom() { return this; }
  setMarginLeft() { return this; }
  setMarginRight() { return this; }
  appendParagraph(text) { const p = new FakeParagraph(text); this.paragraphs.push(p); return p; }
  appendListItem(text) { const li = new FakeListItem(text); this.listItems.push(li); return li; }
  appendHorizontalRule() { this.paragraphs.push(new FakeParagraph('---')); return {}; }
  appendImage(blob) { const img = new FakeImage(); img.blob = blob; this.images.push(img); return img; }
  appendTable() { const t = new FakeTable(); this.tables.push(t); return t; }
  appendPageBreak() { this.pageBreaks += 1; return {}; }
}

class FakeDoc {
  constructor(name, id) { this.name = name; this.id = id; this.body = new FakeBody(); this.header = null; this.saved = false; }
  getBody() { return this.body; }
  getId() { return this.id; }
  // Reuses FakeBody wholesale (same appendTable/appendParagraph/appendImage
  // surface a real HeaderSection has) rather than a separate class - the
  // unused pageBreaks/listItems fields on it are harmless.
  addHeader() { this.header = new FakeBody(); return this.header; }
  saveAndClose() { this.saved = true; }
}

class FakeDriveFile {
  constructor(id) { this.id = id; this.trashed = false; this.sharing = null; this.parents = []; }
  setSharing(access, permission) { this.sharing = { access, permission }; return this; }
  setTrashed(value) { this.trashed = value; return this; }
  getUrl() { return 'https://docs.google.com/document/d/' + this.id + '/edit'; }
  getParents() {
    const parents = this.parents;
    let i = 0;
    return {
      hasNext: () => i < parents.length,
      next: () => {
        const value = parents[i];
        i += 1;
        return value;
      }
    };
  }
}

class FakeFolder {
  constructor(id) { this.id = id; this.fileIds = new Set(); }
  addFile(file) {
    this.fileIds.add(file.id);
    if (!file.parents.includes(this)) file.parents.push(this);
    return this;
  }
  removeFile(file) {
    this.fileIds.delete(file.id);
    file.parents = file.parents.filter((p) => p !== this);
    return this;
  }
}

export function createCodeGsContext() {
  const spreadsheet = new FakeSpreadsheet();
  const scriptProperties = new Map([['SPREADSHEET_ID', 'fake-id']]);
  const sentEmails = [];
  // Mutable so tests can simulate signing in as a different Google account
  // before calling requireAdmin/verifyGoogleIdToken.
  const tokenInfo = { email: 'admin@storalundby.se', email_verified: 'true', aud: 'test-client' };
  const urlFetchCalls = { count: 0 };
  const docs = new Map();
  const driveFiles = new Map();
  let docIdCounter = 0;
  const rootFolder = new FakeFolder('root');
  let folderIdCounter = 0;

  const context = {
    console,
    DocumentApp: {
      create: (name) => {
        docIdCounter += 1;
        const doc = new FakeDoc(name, `doc-${docIdCounter}`);
        docs.set(doc.id, doc);
        return doc;
      },
      ParagraphHeading: { NORMAL: 'NORMAL', TITLE: 'TITLE', SUBTITLE: 'SUBTITLE', HEADING1: 'HEADING1' },
      GlyphType: { BULLET: 'BULLET', HOLLOW_BULLET: 'HOLLOW_BULLET' }
    },
    DriveApp: {
      getFileById: (id) => {
        if (!driveFiles.has(id)) driveFiles.set(id, new FakeDriveFile(id));
        return driveFiles.get(id);
      },
      getRootFolder: () => rootFolder,
      createFolder: (name) => {
        folderIdCounter += 1;
        const folder = new FakeFolder(`folder-${folderIdCounter}`, name);
        return folder;
      },
      Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK' },
      Permission: { VIEW: 'VIEW' }
    },
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
      fetch: (url) => {
        urlFetchCalls.count += 1;
        if (String(url).indexOf('qrserver.com') !== -1 || String(url).indexOf('sl_logo.png') !== -1) {
          return {
            getResponseCode: () => 200,
            getBlob: () => ({ setName: (name) => ({ name }) })
          };
        }
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify(tokenInfo)
        };
      }
    },
    Logger: { log: () => {} },
    CacheService: {
      getScriptCache: (() => {
        const store = new Map();
        return () => ({
          get: (key) => (store.has(key) ? store.get(key) : null),
          put: (key, value) => store.set(key, value),
          remove: (key) => store.delete(key)
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

  return { context, spreadsheet, sentEmails, tokenInfo, urlFetchCalls, docs, driveFiles, rootFolder };
}
