export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-3 bg-zinc-50 p-8 dark:bg-zinc-950"
    >
      <div
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-50"
      />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</p>
    </div>
  );
}
