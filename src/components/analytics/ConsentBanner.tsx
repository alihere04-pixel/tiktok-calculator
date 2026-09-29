export function ConsentBanner() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      aria-labelledby="consent-banner"
    >
      <div
        className="bg-white rounded-lg p-6 max-w-sm w-full shadow-lg text-center"
        aria-label="Analytics consent"
      >
        <p className="text-zinc-600 mb-4" id="consent-banner">
          This site uses Vercel Web Analytics for anonymous, cookieless usage measurement.
        </p>
        <div className="mt-6 space-x-2">
          <button
            onClick={() => localStorage.setItem('analytics_consent', 'accepted')}
            className="bg-primary text-white px-4 py-2 rounded"
          >
            Accept analytics
          </button>
          <button
            onClick={() => localStorage.setItem('analytics_consent', 'declined')}
            className="bg-gray-200 text-gray-800 px-4 py-2 rounded"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}