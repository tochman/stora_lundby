import { useEffect, useState } from 'react';

// Shown after waiting a while, in order - Apps Script round trips can
// genuinely take several seconds, and a loader that just sits still past
// ~3s reads as broken. Keeps the overlay itself unbroken by the backend's
// 25s request timeout (see googleAppsScriptApi.js) - it never gets here.
const PATIENCE_MESSAGES = [
  'Ha lite tålamod...',
  'Vi laddar fortfarande...',
  'En snabb databas är dyr...',
  'Google Sheets är gratis...',
  '..men långsamt...',
];
const MESSAGE_INTERVAL_MS = 3000;
// Cycles through the message list on repeat rather than stopping after one
// pass - with 5 messages at 3s apart that's 15s of coverage, leaving the
// overlay looking frozen for the remaining ~10s before the backend's 25s
// request timeout. 8 ticks (24s) keeps something visibly changing right up
// to just before that timeout fires.
const MESSAGE_TICKS = 8;

// A greyed-out, full-screen overlay with the troop's logo pulsing in the
// center, shown while waiting on the backend. Used instead of a plain
// "Laddar..." text swap so a slow response still reads as "the app is
// working on it", not "the page broke".
export default function LoadingOverlay({ label = 'Laddar...' }) {
  const [messageIndex, setMessageIndex] = useState(-1);

  useEffect(() => {
    setMessageIndex(-1);
    const timers = Array.from({ length: MESSAGE_TICKS }, (_, i) =>
      setTimeout(() => setMessageIndex(i % PATIENCE_MESSAGES.length), MESSAGE_INTERVAL_MS * (i + 1))
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
