/**
 * Show North session requestId for support (from create-session response).
 * Tries common shapes: top-level requestId or session.requestId.
 */
function northSessionRequestIdFromPayload(data) {
  if (!data || typeof data !== "object") return "";
  const s = data.session;
  const id =
    data.requestId ??
    data.request_id ??
    (s && typeof s === "object" ? s.requestId ?? s.request_id : undefined) ??
    "";
  return String(id).trim();
}

function northShowSessionRequestId(id) {
  const el = document.getElementById("session-request-id");
  if (!el) return;
  if (id) {
    el.textContent = "Request ID (support): " + id;
  } else {
    el.textContent = "Request ID (support): —";
  }
}

function northStoreSessionRequestId(id) {
  if (!id) return;
  try {
    sessionStorage.setItem("north_request_id", id);
  } catch {
    /* ignore */
  }
}

function northApplySessionPayloadForRequestId(data) {
  const rid = northSessionRequestIdFromPayload(data);
  northShowSessionRequestId(rid);
  northStoreSessionRequestId(rid);
}

