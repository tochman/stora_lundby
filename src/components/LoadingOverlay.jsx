// A greyed-out, full-screen overlay with the troop's logo pulsing in the
// center, shown while waiting on the backend (which can genuinely take a
// few seconds - Apps Script cold starts, Sheets round-trips). Used instead
// of a plain "Laddar..." text swap so a slow response still reads as "the
// app is working on it", not "the page broke".
export default function LoadingOverlay({ label = 'Laddar...' }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-slate-100/90 backdrop-blur-sm">
      <img src="/lily-blue.svg" alt="" className="h-16 w-auto animate-pulse" />
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-500">{label}</p>
    </div>
  );
}
