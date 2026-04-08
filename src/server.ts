/**
 * North Embedded Checkout — server-side guide steps implemented here:
 *
 * - Step 1: Create a Checkout Session → `POST /api/session` (`createSession`)
 * - Step 5: Verify payment completion (session status) → inside `confirmPayment` (`POST /api/complete`; do not call North from browser JS)
 */
import { join } from "node:path";
import { serveStaticFile, tlsFromEnv } from "./utils/static-serve";
import {
  NORTH_CHECKOUT_BASE,
  checkoutTypeFromEnv,
  northSessionsBasePath,
  jsonNoStore,
  redact,
} from "./utils/server-utils";

const webRoot = join(import.meta.dir, "web");
const port = Number(process.env.PORT) || 8000;
const tls = tlsFromEnv();

/**
 * Step 1 — Create a Checkout Session
 *
 * `POST /api/session` — browser calls this; server calls North with `PRIVATE_API_KEY`.
 *
 * Guides:
 * - https://developer.north.com/products/online/embedded-checkout/form-integration-guide
 * - https://developer.north.com/products/online/embedded-checkout/fields-integration-guide
 * - https://developer.north.com/products/online/embedded-checkout/post-integration-guide
 */
async function createSession(req: Request): Promise<Response> {
  const privateKey = process.env.PRIVATE_API_KEY || "";
  const checkoutId = process.env.CHECKOUT_ID || "";
  const profileId = process.env.PROFILE_ID || "";
  const checkoutType = checkoutTypeFromEnv();

  if (!privateKey) {
    return Response.json(
      { error: "PRIVATE_API_KEY is not set in .env" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!checkoutId) {
    return Response.json(
      { error: "CHECKOUT_ID is not set in .env" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!profileId) {
    return Response.json(
      { error: "PROFILE_ID is not set in .env" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: { amount?: number; products?: unknown } = {};
  try {
    body = (await req.json()) as { amount?: number; products?: unknown };
  } catch {
    // allow empty JSON body (e.g., direct post sessions may not require amount/products)
  }

  const amount = body.amount ?? 0;
  const products = body.products ?? [];
  // Form/Fields typically send amount and/or products; Direct Post may omit products (amount also
  // supplied at payment time). This demo still sends amount on the session for all types.
  const northBody = JSON.stringify(
    checkoutType === "post"
      ? { checkoutId, profileId, amount }
      : { checkoutId, profileId, amount, products },
  );

  const sessionUrl = `${NORTH_CHECKOUT_BASE.replace(/\/$/, "")}${northSessionsBasePath(checkoutType)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60_000);

  let northRes: Response;
  try {
    northRes = await fetch(sessionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${privateKey}`,
      },
      body: northBody,
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(t);
    const msg =
      e instanceof Error && e.name === "AbortError"
        ? "North API request timed out"
        : e instanceof Error
          ? e.message
          : "Network error calling North";
    console.error("[api/session]", msg);
    return Response.json(
      { error: msg },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
  clearTimeout(t);

  const text = await northRes.text();
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  });

  if (!northRes.ok) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return new Response(
        JSON.stringify({
          error: `North HTTP ${northRes.status}: ${text.slice(0, 500)}`,
        }),
        { status: 502, headers },
      );
    }
    return new Response(JSON.stringify(parsed), {
      status: northRes.status,
      headers,
    });
  }

  try {
    const json = JSON.parse(text) as { token?: string };
    void json;
  } catch {
    /* ignore */
  }

  return new Response(text, { status: 200, headers });
}

/**
 * Step 5 — Confirm payment (sample: `POST /api/complete` for `/complete/` page)
 *
 * Calls North’s session **status** endpoint for authoritative Approved/Declined (do not call that
 * URL from browser JS). Optionally logs a redacted copy of the client-side payment result for
 * debugging (do not trust it for fulfillment).
 *
 * Guides (Method 1: session status):
 * - https://developer.north.com/products/online/embedded-checkout/form-integration-guide
 * - https://developer.north.com/products/online/embedded-checkout/fields-integration-guide
 * - https://developer.north.com/products/online/embedded-checkout/post-integration-guide
 */
async function confirmPayment(req: Request): Promise<Response> {
  const privateKey = process.env.PRIVATE_API_KEY || "";
  const checkoutId = process.env.CHECKOUT_ID || "";
  const profileId = process.env.PROFILE_ID || "";
  const checkoutType = checkoutTypeFromEnv();

  if (!privateKey) return jsonNoStore({ error: "PRIVATE_API_KEY is not set in .env" }, 500);
  if (!checkoutId) return jsonNoStore({ error: "CHECKOUT_ID is not set in .env" }, 500);
  if (!profileId) return jsonNoStore({ error: "PROFILE_ID is not set in .env" }, 500);

  let body: { token?: string; clientResponse?: unknown };
  try {
    body = (await req.json()) as { token?: string; clientResponse?: unknown };
  } catch {
    return jsonNoStore({ error: "Invalid JSON body" }, 400);
  }

  const token = (body.token || "").trim();
  if (!token) return jsonNoStore({ error: "Missing session token" }, 400);

  const redactedClient = redact(body.clientResponse);
  console.log("[checkout/complete] clientResponse:", JSON.stringify(redactedClient));

  let verified: { ok: boolean; status: number; body?: unknown; raw?: string };
  try {
    const statusUrl = `${NORTH_CHECKOUT_BASE.replace(/\/$/, "")}${northSessionsBasePath(checkoutType)}/status`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 60_000);
    let northRes: Response;
    let statusText: string;
    try {
      northRes = await fetch(statusUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${privateKey}`,
          SessionToken: token,
          CheckoutId: checkoutId,
          ProfileId: profileId,
        },
        signal: ctrl.signal,
      });
      statusText = await northRes.text();
    } finally {
      clearTimeout(t);
    }

    if (!northRes.ok) {
      verified = { ok: false, status: northRes.status, raw: statusText.slice(0, 2000) };
    } else {
      try {
        verified = { ok: true, status: northRes.status, body: JSON.parse(statusText) };
      } catch {
        verified = { ok: true, status: northRes.status, raw: statusText.slice(0, 2000) };
      }
    }
  } catch (e) {
    const msg =
      e instanceof Error && e.name === "AbortError"
        ? "North API request timed out"
        : e instanceof Error
          ? e.message
          : "Network error calling North";
    verified = { ok: false, status: 502, raw: msg };
  }

  console.log("[checkout/complete] verified:", JSON.stringify(redact(verified)));

  return jsonNoStore(
    {
      received: {
        clientResponse: redactedClient,
      },
      verified,
    },
    200,
  );
}

Bun.serve({
  port,
  tls,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/api/session" && req.method === "POST") {
      return createSession(req);
    }
    if (url.pathname === "/api/complete" && req.method === "POST") {
      return confirmPayment(req);
    }
    return serveStaticFile(webRoot, url.pathname);
  },
});

console.log(
  `Bun http${tls ? "s" : ""} server on port ${port} — web root ${webRoot}`,
);
