function escapeCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function rowsToCsv(rows) {
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
}

// One row per (activity, participant) pair, sorted by activity so the sheet
// can be printed as a roster per market shift / workday / etc.
export function buildActivityRosterCsv(applications, activities) {
  const activityById = Object.fromEntries(activities.map((a) => [a.id, a]));
  const header = ['Aktivitet', 'Datum', 'Tid', 'Plats', 'Deltagare', 'Telefon', 'Scout', 'Avdelning'];

  const rows = applications.flatMap((app) =>
    (app.selectedActivities || []).map((activityId) => {
      const activity = activityById[activityId];
      return {
        sortKey: activity ? `${activity.sortOrder}`.padStart(6, '0') : '999999',
        row: [
          activity ? activity.label : activityId,
          activity ? activity.date : '',
          activity && activity.startTime ? `${activity.startTime}-${activity.endTime}` : '',
          activity ? activity.location : '',
          app.guardianName,
          app.guardianPhone,
          app.scoutName,
          app.avdelning
        ]
      };
    })
  );

  rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  return rowsToCsv([header, ...rows.map((r) => r.row)]);
}

export function downloadCsv(filename, csvContent) {
  const blob = new Blob([`﻿${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
