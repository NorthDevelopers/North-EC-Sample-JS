/**
 * Checkout completion + server-side verification.
 *
 * This intentionally calls *our server* (`/api/complete`), not North directly.
 * The North docs recommend server-side verification via the session status endpoint:
 * - The status endpoint rejects browser requests with an Origin header
 * - The session token should not be used from browser JS for status lookup
 */

function getTokenFromUrl() {
  const url = new URL(location.href);
  const qp = url.searchParams.get("token");
  if (qp) return qp;
  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  const hp = new URLSearchParams(hash).get("token");
  return hp || null;
}

async function verify() {
  const stateEl = document.getElementById("state");
  const outEl = document.getElementById("out");

  if (typeof northShowSessionRequestId === "function") {
    try {
      northShowSessionRequestId(sessionStorage.getItem("north_request_id") || "");
    } catch {
      northShowSessionRequestId("");
    }
  }

  const token =
    getTokenFromUrl() ||
    (() => {
      try {
        return sessionStorage.getItem("north_session_token");
      } catch {
        return null;
      }
    })();

  if (!token) {
    stateEl.textContent =
      "Missing session token. If your North checkout redirects here, " +
      "pass it as ?token=... (or store it in sessionStorage before redirect).";
    outEl.textContent = "";
    return;
  }

  let clientResponse = null;
  try {
    const raw = sessionStorage.getItem("north_client_response");
    if (raw) clientResponse = JSON.parse(raw);
  } catch {
    clientResponse = null;
  }

  const res = await fetch("/api/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, clientResponse }),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!res.ok) stateEl.textContent = `Completion call failed (HTTP ${res.status}).`;
  else stateEl.textContent = "Completion processed (HTTP 200).";

  outEl.textContent = JSON.stringify(json, null, 2);
}

verify().catch((e) => {
  const stateEl = document.getElementById("state");
  const outEl = document.getElementById("out");
  stateEl.textContent = "Unexpected error verifying status.";
  outEl.textContent = String(e && e.message ? e.message : e);
});

