/**
 * Shared browser helpers used by multiple samples.
 *
 * Kept as globals (attached to window) to avoid bundling and keep the sample easy to follow.
 */

/**
 * Strip all non-digit characters.
 * Useful for card/exp/cvv/zip cleanup in Direct Post demos.
 */
function northOnlyDigits(s) {
  return String(s || "").replace(/[^\d]/g, "");
}

/**
 * Decode JWT payload (no verification) to read the configured domain.
 * Used only for a developer-facing sanity check (origin mismatch is a common mount issue).
 */
function northReadTokenDomain(token) {
  try {
    const body = String(token || "").split(".")[1];
    if (!body) return null;
    const padded = body + "=".repeat((4 - (body.length % 4)) % 4);
    const json = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json);
    return payload.domain || (payload.session && payload.session.domain) || null;
  } catch {
    return null;
  }
}

/**
 * Warn if the session's configured domain doesn't match the current page origin.
 * This does not block anything; it's only to help developers debug mount hangs.
 */
function northWarnIfOriginMismatch(sessionToken) {
  const configuredDomain = northReadTokenDomain(sessionToken);
  const origin = location.origin.replace(/\/$/, "");
  if (!configuredDomain) return;

  const cfg = String(configuredDomain).replace(/\/$/, "");
  if (cfg !== origin) {
    console.warn(
      "[Embedded Checkout] Origin mismatch: session domain is",
      JSON.stringify(cfg),
      "but page is",
      JSON.stringify(origin),
      "— align North embed settings with this origin or checkout.mount may hang.",
    );
  }
}

// Expose as globals for other scripts.
window.northOnlyDigits = northOnlyDigits;
window.northReadTokenDomain = northReadTokenDomain;
window.northWarnIfOriginMismatch = northWarnIfOriginMismatch;

