import { beforeEach, describe, expect, it } from 'vitest';
import { createCodeGsContext } from './harness.js';

let ctx;

beforeEach(() => {
  ctx = createCodeGsContext();
  ctx.context.initializeProject();
  // The seeded default deadline is in the past by now; push it out so tests
  // that aren't specifically about the deadline can submit freely.
  ctx.context.setConfigValue('submissionDeadline', '2099-01-01');
});

function applicationsHeaders() {
  return ctx.spreadsheet.getSheetByName('Applications').rows[0];
}

function applicationRows() {
  return ctx.spreadsheet.getSheetByName('Applications').rows.slice(1);
}

const validPayload = () => ({
  year: '2026',
  term: 'Höst',
  guardianName: 'Anna Andersson',
  guardianPhone: '070-1234567',
  guardianEmail: 'anna@example.com',
  scoutName: 'Lina',
  avdelning: 'Spårare',
  consent: 'true',
  selectedActivities: ['shift1-skordemarknad']
});

describe('isAdmin', () => {
  it('is false for an email not on the Admins sheet', () => {
    expect(ctx.context.isAdmin('nobody@example.com')).toBe(false);
  });

  it('is true only for an active admin, case-insensitively', () => {
    ctx.spreadsheet.getSheetByName('Admins').appendRow(['Admin@Example.com', 'admin', 'TRUE']);
    expect(ctx.context.isAdmin('admin@example.com')).toBe(true);
  });

  it('is false for a deactivated admin', () => {
    ctx.spreadsheet.getSheetByName('Admins').appendRow(['admin@example.com', 'admin', 'FALSE']);
    expect(ctx.context.isAdmin('admin@example.com')).toBe(false);
  });
});

describe('submitApplication validation', () => {
  it('rejects a payload missing a required field', () => {
    const payload = validPayload();
    delete payload.scoutName;
    expect(() => ctx.context.submitApplication(payload)).toThrow(/scoutName/);
  });

  it('rejects a payload without consent', () => {
    const payload = { ...validPayload(), consent: 'false' };
    expect(() => ctx.context.submitApplication(payload)).toThrow(/samtycke/i);
  });

  it('rejects "own-suggestion" selected without accompanying text', () => {
    const payload = { ...validPayload(), selectedActivities: ['own-suggestion'] };
    expect(() => ctx.context.submitApplication(payload)).toThrow(/eget förslag/i);
  });

  it('accepts "own-suggestion" when text is provided', () => {
    const payload = { ...validPayload(), selectedActivities: ['own-suggestion'], ownSuggestionText: 'Jag bakar bullar' };
    expect(() => ctx.context.submitApplication(payload)).not.toThrow();
  });

  it('rejects a submission after the configured deadline', () => {
    ctx.context.setConfigValue('submissionDeadline', '2000-01-01');
    expect(() => ctx.context.submitApplication(validPayload())).toThrow(/gått ut/i);
  });
});

describe('submitApplication writes', () => {
  it('appends a new Applications row and its matching ConsentLog row', () => {
    ctx.context.submitApplication(validPayload());

    const headers = applicationsHeaders();
    const rows = applicationRows();
    expect(rows).toHaveLength(1);

    const row = Object.fromEntries(headers.map((header, i) => [header, rows[0][i]]));
    expect(row.guardianName).toBe('Anna Andersson');
    expect(JSON.parse(row.selectedActivities)).toEqual(['shift1-skordemarknad']);
    expect(row.status).toBe('Ny');

    const consentRows = ctx.spreadsheet.getSheetByName('ConsentLog').rows.slice(1);
    expect(consentRows).toHaveLength(1);
    expect(consentRows[0][0]).toBe(row.id);
  });

  it('treats a second submission with the same email/year/term as an edit, not a duplicate', () => {
    ctx.context.submitApplication(validPayload());
    ctx.context.submitApplication({ ...validPayload(), scoutName: 'Lina (uppdaterad)', selectedActivities: [] });

    const rows = applicationRows();
    expect(rows).toHaveLength(1);

    const headers = applicationsHeaders();
    const row = Object.fromEntries(headers.map((header, i) => [header, rows[0][i]]));
    expect(row.scoutName).toBe('Lina (uppdaterad)');
    // Two submissions, two consent records - consent is logged on every edit.
    expect(ctx.spreadsheet.getSheetByName('ConsentLog').rows.slice(1)).toHaveLength(2);
  });

  it('preserves status and internal notes across an edit', () => {
    ctx.context.submitApplication(validPayload());
    const idCol = applicationsHeaders().indexOf('id');
    const id = applicationRows()[0][idCol];
    ctx.context.updateApplicationStatus(id, 'Behandlas');
    ctx.context.updateApplicationNotes(id, 'Ring och bekräfta');

    ctx.context.submitApplication({ ...validPayload(), comments: 'uppdaterad kommentar' });

    const headers = applicationsHeaders();
    const row = Object.fromEntries(headers.map((header, i) => [header, applicationRows()[0][i]]));
    expect(row.status).toBe('Behandlas');
    expect(row.internalNotes).toBe('Ring och bekräfta');
  });

  it('sends a confirmation email summarizing the selected activities', () => {
    ctx.context.submitApplication(validPayload());
    expect(ctx.sentEmails).toHaveLength(1);
    expect(ctx.sentEmails[0].to).toBe('anna@example.com');
    expect(ctx.sentEmails[0].body).toContain('marknadsstånd');
  });
});

describe('config round trip', () => {
  it('setConfigValue updates an existing key; getConfigValue reads it back', () => {
    ctx.context.setConfigValue('currentTerm', 'Vår');
    expect(ctx.context.getConfigValue('currentTerm')).toBe('Vår');
  });

  it('setConfigValue appends a new key that did not exist before', () => {
    ctx.context.setConfigValue('brandNewKey', 'hello');
    expect(ctx.context.getConfigValue('brandNewKey')).toBe('hello');
  });
});

describe('purgeTermData', () => {
  it('deletes matching Applications and ConsentLog rows and logs only counts', () => {
    ctx.context.submitApplication(validPayload());
    ctx.context.submitApplication({ ...validPayload(), guardianEmail: 'lars@example.com', scoutName: 'Lars Jr' });
    ctx.context.submitApplication({ ...validPayload(), year: '2027', guardianEmail: 'other@example.com' });

    const result = ctx.context.purgeTermData('2026', 'Höst', 'admin@example.com');

    expect(result).toEqual({ ok: true, applicationsPurged: 2, consentLogPurged: 2 });
    expect(applicationRows()).toHaveLength(1); // only the 2027 one remains
    expect(ctx.spreadsheet.getSheetByName('ConsentLog').rows.slice(1)).toHaveLength(1);

    const purgeLogRows = ctx.spreadsheet.getSheetByName('PurgeLog').rows.slice(1);
    expect(purgeLogRows).toHaveLength(1);
    expect(purgeLogRows[0][1]).toBe('admin@example.com');
    expect(purgeLogRows[0][4]).toBe(2);
  });
});
