// Sends a browser crash to /api/client-error. Fire and forget.
export function reportClientError(error: Error & { digest?: string }) {
  try {
    const body = JSON.stringify({
      message: error.message || String(error),
      stack: error.stack,
      digest: error.digest,
      url: window.location.pathname,
    });
    if (!navigator.sendBeacon?.('/api/client-error', new Blob([body], { type: 'application/json' }))) {
      fetch('/api/client-error', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true })
        .catch(() => {});
    }
  } catch {
    // Reporting must never throw.
  }
}
