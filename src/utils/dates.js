// "24 september" from a yyyy-MM-dd string. Tolerates a full ISO datetime
// (if a value ever comes back as a serialized Date) by only reading the
// date portion before any "T"; anything unparseable is returned as-is.
export function formatActivityDate(isoDate) {
  if (!isoDate) return '';
  const date = new Date(`${String(isoDate).split('T')[0]}T00:00`);
  if (Number.isNaN(date.getTime())) return String(isoDate);
  return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' });
}

export function formatActivityWhen(activity) {
  const timePart = activity.startTime && activity.endTime ? `kl ${activity.startTime}-${activity.endTime}` : '';
  return [formatActivityDate(activity.date), timePart, activity.location].filter(Boolean).join(', ');
}
