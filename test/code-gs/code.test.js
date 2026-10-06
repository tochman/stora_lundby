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

describe('requireAdmin', () => {
  beforeEach(() => {
    ctx.spreadsheet.getSheetByName('Admins').appendRow(['admin@storalundby.se', 'admin', 'TRUE']);
    ctx.spreadsheet.getSheetByName('Admins').appendRow(['outsider@gmail.com', 'admin', 'TRUE']);
  });

  it('throws when no idToken is provided', () => {
    expect(() => ctx.context.requireAdmin({})).toThrow(/inloggning krävs/i);
  });

  it('grants access to an email on the Admins sheet within the required domain', () => {
    ctx.tokenInfo.email = 'admin@storalundby.se';
    expect(ctx.context.requireAdmin({ idToken: 'token' })).toBe('admin@storalundby.se');
  });

  it('rejects an email outside the configured admin domain even if it is on the Admins sheet', () => {
    // Defense in depth: domain enforcement happens before the Admins-sheet
    // lookup, so an accidental non-storalundby.se entry still can't get in.
    ctx.tokenInfo.email = 'outsider@gmail.com';
    expect(() => ctx.context.requireAdmin({ idToken: 'token' })).toThrow(/åtkomst nekad/i);
  });

  it('rejects an in-domain email that is not on the Admins sheet', () => {
    ctx.tokenInfo.email = 'nobody@storalundby.se';
    expect(() => ctx.context.requireAdmin({ idToken: 'token' })).toThrow(/åtkomst nekad/i);
  });

  it('respects a custom adminEmailDomain config value', () => {
    ctx.context.setConfigValue('adminEmailDomain', 'otherdomain.se');
    ctx.spreadsheet.getSheetByName('Admins').appendRow(['admin@otherdomain.se', 'admin', 'TRUE']);

    // Distinct tokens, as two different signed-in users would actually
    // have - verifyGoogleIdToken memoizes per token string, so reusing one
    // literal token for both would just replay the first lookup's result.
    ctx.tokenInfo.email = 'admin@otherdomain.se';
    expect(ctx.context.requireAdmin({ idToken: 'token-a' })).toBe('admin@otherdomain.se');

    ctx.tokenInfo.email = 'admin@storalundby.se';
    expect(() => ctx.context.requireAdmin({ idToken: 'token-b' })).toThrow(/åtkomst nekad/i);
  });
});

describe('verifyGoogleIdToken memoization', () => {
  beforeEach(() => {
    ctx.spreadsheet.getSheetByName('Admins').appendRow(['admin@storalundby.se', 'admin', 'TRUE']);
  });

  it('only calls out to Google once for repeated checks of the same token', () => {
    ctx.context.verifyGoogleIdToken('token-a');
    ctx.context.verifyGoogleIdToken('token-a');
    ctx.context.verifyGoogleIdToken('token-a');
    expect(ctx.urlFetchCalls.count).toBe(1);
  });

  it('still verifies separately for a different token', () => {
    ctx.context.verifyGoogleIdToken('token-a');
    ctx.context.verifyGoogleIdToken('token-b');
    expect(ctx.urlFetchCalls.count).toBe(2);
  });

  it('a batch of admin actions sharing one token verifies it only once', () => {
    ctx.context.requireAdmin({ idToken: 'shared-token' });
    ctx.context.requireAdmin({ idToken: 'shared-token' });
    ctx.context.requireAdmin({ idToken: 'shared-token' });
    expect(ctx.urlFetchCalls.count).toBe(1);
  });
});

describe('batch', () => {
  beforeEach(() => {
    ctx.spreadsheet.getSheetByName('Admins').appendRow(['admin@storalundby.se', 'admin', 'TRUE']);
    ctx.tokenInfo.email = 'admin@storalundby.se';
  });

  it('runs several actions and returns one ok/data or ok/error result per request, in order', () => {
    const results = ctx.context.handleAction('batch', {
      requests: [
        { action: 'getConfig' },
        { action: 'getApplications', params: { idToken: 'token' } },
        { action: 'thisActionDoesNotExist' }
      ]
    });

    expect(results).toHaveLength(3);
    expect(results[0].ok).toBe(true);
    expect(results[0].data.currentTerm).toBe('Höst');
    expect(results[1].ok).toBe(true);
    expect(results[1].data).toEqual([]);
    expect(results[2].ok).toBe(false);
    expect(results[2].error).toMatch(/okänd åtgärd/i);
  });

  it('only verifies the shared token once across multiple admin actions in the batch', () => {
    ctx.context.handleAction('batch', {
      requests: [
        { action: 'getApplications', params: { idToken: 'shared-token' } },
        { action: 'getAdminSummary', params: { idToken: 'shared-token' } },
        { action: 'getActivitiesAdmin', params: { idToken: 'shared-token' } }
      ]
    });
    expect(ctx.urlFetchCalls.count).toBe(1);
  });

  it("one failing request in a batch doesn't affect the others", () => {
    const results = ctx.context.handleAction('batch', {
      requests: [
        { action: 'getApplications', params: {} }, // missing idToken - should fail
        { action: 'getConfig' }
      ]
    });
    expect(results[0].ok).toBe(false);
    expect(results[0].error).toMatch(/inloggning krävs/i);
    expect(results[1].ok).toBe(true);
  });
});

describe('submitApplication validation', () => {
  it('rejects a payload missing a required field', () => {
    const payload = validPayload();
    delete payload.guardianEmail;
    expect(() => ctx.context.submitApplication(payload)).toThrow(/guardianEmail/);
  });

  it('rejects a missing scoutName/avdelning when noScoutChild is not set', () => {
    const payload = validPayload();
    delete payload.scoutName;
    expect(() => ctx.context.submitApplication(payload)).toThrow(/Scoutens namn/);
  });

  it('accepts a missing scoutName/avdelning when noScoutChild is true - older members with no enrolled scout', () => {
    const payload = validPayload();
    delete payload.scoutName;
    delete payload.avdelning;
    payload.noScoutChild = 'true';
    expect(() => ctx.context.submitApplication(payload)).not.toThrow();
    expect(applicationRows()[0][applicationsHeaders().indexOf('scoutName')]).toBe('');
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

  it('preserves a leading zero in a digit-only phone number', () => {
    // No dashes/spaces - exactly the shape Sheets would otherwise
    // auto-convert to a Number, dropping the leading zero.
    ctx.context.submitApplication({ ...validPayload(), guardianPhone: '0701234567' });

    const headers = applicationsHeaders();
    const row = Object.fromEntries(headers.map((header, i) => [header, applicationRows()[0][i]]));
    expect(row.guardianPhone).toBe('0701234567');
  });

  it('preserves a leading zero in a digit-only phone number across an edit', () => {
    ctx.context.submitApplication({ ...validPayload(), guardianPhone: '0701234567' });
    ctx.context.submitApplication({ ...validPayload(), guardianPhone: '0709876543' });

    const headers = applicationsHeaders();
    const row = Object.fromEntries(headers.map((header, i) => [header, applicationRows()[0][i]]));
    expect(row.guardianPhone).toBe('0709876543');
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

  it('treats the same email in a different year/term as a separate submission, not an overwrite', () => {
    ctx.context.submitApplication(validPayload());
    ctx.context.submitApplication({ ...validPayload(), year: '2027', term: 'Vår' });

    const rows = applicationRows();
    expect(rows).toHaveLength(2);

    const headers = applicationsHeaders();
    const terms = rows.map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i]]))).map((r) => `${r.year}-${r.term}`);
    expect(terms).toEqual(['2026-Höst', '2027-Vår']);
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

describe('createManualApplication', () => {
  it('writes a row keyed by header, preserving a leading zero in the phone number', () => {
    ctx.context.createManualApplication({
      guardianName: 'Bea Berg',
      guardianPhone: '0731112233',
      guardianEmail: 'bea@example.com',
      scoutName: 'Bo',
      avdelning: 'Utmanare',
      selectedActivities: []
    });

    const headers = applicationsHeaders();
    const row = Object.fromEntries(headers.map((header, i) => [header, applicationRows()[0][i]]));
    expect(row.guardianName).toBe('Bea Berg');
    expect(row.guardianPhone).toBe('0731112233');
    expect(row.status).toBe('Ny');
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

  it('normalizes a Date-typed cell back to plain yyyy-MM-dd', () => {
    // Sheets auto-converts a date-like string ("2026-09-17") typed into a
    // cell into a real Date value even via Range.setValue - simulate that
    // happening to the submissionDeadline row directly, bypassing
    // setConfigValue (which only ever receives what Code.gs passes it).
    // Must be the vm context's own Date constructor, not the host's - Code.gs
    // runs in a separate realm, and `instanceof Date` is realm-specific.
    const configSheet = ctx.spreadsheet.getSheetByName('Config');
    const rowIndex = configSheet.rows.findIndex((row) => row[0] === 'submissionDeadline');
    configSheet.rows[rowIndex][1] = ctx.context.__makeDate('2026-09-17T00:00:00.000Z');

    expect(ctx.context.getConfigValue('submissionDeadline')).toBe('2026-09-17');
    expect(ctx.context.getPublicConfig().submissionDeadline).toBe('2026-09-17');
  });
});

describe('caching of config and activities reads', () => {
  it('getPublicConfig only hits the sheet once across repeated calls', () => {
    const configSheet = ctx.spreadsheet.getSheetByName('Config');
    const before = configSheet.getDataRangeCalls;
    ctx.context.getPublicConfig();
    ctx.context.getPublicConfig();
    ctx.context.getPublicConfig();
    expect(configSheet.getDataRangeCalls).toBe(before + 1);
  });

  it('setConfigValue invalidates the config cache, so the next read sees the new value', () => {
    ctx.context.getPublicConfig();
    ctx.context.setConfigValue('currentTerm', 'Vår');
    expect(ctx.context.getPublicConfig().currentTerm).toBe('Vår');
    expect(ctx.context.getConfigValue('currentTerm')).toBe('Vår');
  });

  it('getActivitiesRaw only hits the sheet once across repeated calls', () => {
    const activitiesSheet = ctx.spreadsheet.getSheetByName('Activities');
    const before = activitiesSheet.getDataRangeCalls;
    ctx.context.getActivitiesRaw();
    ctx.context.getActivitiesRaw();
    expect(activitiesSheet.getDataRangeCalls).toBe(before + 1);
  });

  it('upsertActivity invalidates the activities cache, so the next read sees the change', () => {
    ctx.context.getActivitiesRaw();
    ctx.context.upsertActivity({ id: 'new-activity', year: '2026', term: 'Höst', category: 'workday', label: 'Ny aktivitet', active: true, sortOrder: 99 });
    const labels = ctx.context.getActivitiesRaw().map((a) => a.label);
    expect(labels).toContain('Ny aktivitet');
  });

  it('deleteActivity invalidates the activities cache, so the next read no longer includes it', () => {
    ctx.context.upsertActivity({ id: 'temp-activity', year: '2026', term: 'Höst', category: 'workday', label: 'Tillfällig', active: true, sortOrder: 99 });
    ctx.context.getActivitiesRaw();
    ctx.context.deleteActivity('temp-activity');
    const ids = ctx.context.getActivitiesRaw().map((a) => a.id);
    expect(ids).not.toContain('temp-activity');
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
