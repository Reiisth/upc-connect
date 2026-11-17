/** A generic Back/Cancel link can restore filters only for its existing destination. */
export function listContextReturnHref(fallback: string, search: string) {
  const candidate = new URLSearchParams(search).get("returnTo");
  return safeListReturnHref(fallback, candidate);
}

export function safeListReturnHref(fallback: string, candidate: unknown) {
  if (typeof candidate !== "string") return fallback;
  if (!candidate || candidate.length > 8000 || /[\\\r\n#]/.test(candidate)) return fallback;
  if (!candidate.startsWith("/portal/") || candidate.split("?")[0] !== fallback.split("?")[0]) return fallback;
  return candidate;
}
