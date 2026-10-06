// A transient backend error (timeout, 404, etc.) shouldn't be a dead end -
// every screen that can fail on load offers a way to retry right there,
// instead of making the admin reload the whole page or switch tabs and back.
export default function ErrorBanner({ message, onRetry }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <span>{message}</span>
      {onRetry && (
        <button
          type="button"
          className="shrink-0 whitespace-nowrap font-semibold text-red-700 underline hover:no-underline"
          onClick={onRetry}
        >
          Försök igen
        </button>
      )}
    </div>
  );
}
