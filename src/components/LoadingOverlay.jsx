import { useEffect, useState } from 'react';

// Shown after waiting a while, in order - Apps Script round trips can
// genuinely take several seconds, and a loader that just sits still past
// ~5s reads as broken. Keeps the overlay itself unbroken by the backend's
// 25s request timeout (see googleAppsScriptApi.js) - it never gets here.
const PATIENCE_MESSAGES = [
  'Ha lite tålamod...',
  'Vi laddar fortfarande...',
  'En snabb databas är dyr...'
];
const MESSAGE_INTERVAL_MS = 5000;

// A greyed-out, full-screen overlay with the troop's logo pulsing in the
// center, shown while waiting on the backend. Used instead of a plain
// "Laddar..." text swap so a slow response still reads as "the app is
// working on it", not "the page broke".
export default function LoadingOverlay({ label = 'Laddar...' }) {
  const [messageIndex, setMessageIndex] = useState(-1);

  useEffect(() => {
    setMessageIndex(-1);
    const timers = PATIENCE_MESSAGES.map((_, i) =>
      setTimeout(() => setMessageIndex(i), MESSAGE_INTERVAL_MS * (i + 1))
    );
    return () => timers.forEach(clearTimeout);
  }, [label]);

  const displayedLabel = messageIndex === -1 ? label : PATIENCE_MESSAGES[messageIndex];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-slate-100/90 backdrop-blur-sm">
      <img src="/lily-blue.svg" alt="" className="h-16 w-auto animate-pulse" />
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-500">{displayedLabel}</p>
    </div>
  );
}
