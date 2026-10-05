import { describe, expect, it } from 'vitest';
import { buildActivityRosterCsv } from '../src/utils/csv.js';

const activities = [
  { id: 'a1', label: 'Pass 1', date: '2026-09-27', startTime: '10:00', endTime: '13:00', location: 'Mjörnbotorget', sortOrder: 1 },
  { id: 'a2', label: 'Pass 2', date: '2026-09-27', startTime: '13:00', endTime: '16:00', location: 'Mjörnbotorget', sortOrder: 2 }
];

describe('buildActivityRosterCsv', () => {
  it('emits one row per (activity, guardian) pair, sorted by activity order', () => {
    const applications = [
      { guardianName: 'Bea', guardianPhone: '2', scoutName: 'Y', avdelning: 'Spårare', selectedActivities: ['a2'] },
      { guardianName: 'Anna', guardianPhone: '1', scoutName: 'X', avdelning: 'Vildmark', selectedActivities: ['a1', 'a2'] }
    ];

    const csv = buildActivityRosterCsv(applications, activities);
    const rows = csv.split('\r\n');

    expect(rows[0]).toBe('Aktivitet,Datum,Tid,Plats,Vårdnadshavare,Telefon,Scout,Avdelning');
    // Three data rows total (Bea x1 + Anna x2), grouped/sorted by activity sortOrder.
    expect(rows).toHaveLength(4);
    expect(rows[1]).toContain('Pass 1');
    expect(rows[1]).toContain('Anna');
    expect(rows[2]).toContain('Pass 2');
    expect(rows[3]).toContain('Pass 2');
  });

  it('quotes cells containing commas, quotes or newlines', () => {
    const applications = [
      { guardianName: 'Anna, Admin "A"', guardianPhone: '1', scoutName: 'X', avdelning: 'Vildmark', selectedActivities: ['a1'] }
    ];

    const csv = buildActivityRosterCsv(applications, activities);
    expect(csv).toContain('"Anna, Admin ""A"""');
  });

  it('falls back to the raw activity id when the activity is unknown (e.g. deleted since)', () => {
    const applications = [
      { guardianName: 'Anna', guardianPhone: '1', scoutName: 'X', avdelning: 'Vildmark', selectedActivities: ['missing-id'] }
    ];

    const csv = buildActivityRosterCsv(applications, activities);
    expect(csv).toContain('missing-id');
  });

  it('returns just the header row when there are no applications', () => {
    const csv = buildActivityRosterCsv([], activities);
    expect(csv).toBe('Aktivitet,Datum,Tid,Plats,Vårdnadshavare,Telefon,Scout,Avdelning');
  });
});
