/**
 * Bun dev server: static files from src/web + POST /api/session (North token).
 */
import { join } from "node:path";
import { serveStaticFile, tlsFromEnv } from "./utils/static-serve";

const webRoot = join(import.meta.dir, "web");
const port = Number(process.env.PORT) || 8000;
const tls = tlsFromEnv();

async function handleSession(req: Request): Promise<Response> {
  const apiBase =
    process.env.API_URL || process.env.API_BASE_URL || "";
  const privateKey = process.env.PRIVATE_API_KEY || "";
  const checkoutId =
    process.env.CHECKOUT_ID ||
    "784eb47c-17cd-4c3e-a0b4-e23055d03841";
  const profileId =
    process.env.PROFILE_ID || "dd5eee52-cd36-4a02-8aa1-742bfc316974";

  if (!apiBase) {
    return Response.json(
      { error: "API_URL is not set in .env" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!privateKey) {
    return Response.json(
      { error: "PRIVATE_API_KEY is not set in .env" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: { amount?: number; products?: unknown };
  try {
    body = (await req.json()) as { amount?: number; products?: unknown };
  } catch {
    return Response.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const amount = body.amount ?? 0;
  const products = body.products ?? [];
  const northBody = JSON.stringify({
    checkoutId,
    profileId,
    amount,
    products,
  });

  const url = `${apiBase.replace(/\/$/, "")}/api/sessions`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60_000);

  let northRes: Response;
  try {
    northRes = await fetch(url, {
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
    if (json.token) {
      console.log("[api/session] session token:", json.token);
    }
  } catch {
    /* ignore */
  }

  return new Response(text, { status: 200, headers });
}

Bun.serve({
  port,
  tls,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/api/session" && req.method === "POST") {
      return handleSession(req);
    }
    return serveStaticFile(webRoot, url.pathname);
  },
});

console.log(
  `Bun http${tls ? "s" : ""} server on port ${port} — web root ${webRoot}`,
);
