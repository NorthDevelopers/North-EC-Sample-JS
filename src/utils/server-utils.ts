/**
 * Shared helpers for the Bun server (env, JSON responses, redaction).
 * Guide-aligned handlers live in `src/server.ts` (`createSession`, `confirmPayment`).
 */

/** North Checkout API host (production). */
export const NORTH_CHECKOUT_BASE = "https://checkout.north.com";

export type CheckoutType = "form" | "fields" | "post";

export function checkoutTypeFromEnv(): CheckoutType {
  const raw = (process.env.CHECKOUT_TYPE || "form").toLowerCase().trim();
  if (raw === "fields" || raw === "post" || raw === "form") return raw;
  return "form";
}

export function northSessionsBasePath(type: CheckoutType): string {
  void type;
  return "/api/sessions";
}

export function jsonNoStore(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export function redact(value: unknown): unknown {
  const SENSITIVE_KEYS = new Set([
    "cardNumber",
    "pan",
    "cvv",
    "cvc",
    "securityCode",
    "exp",
    "expiry",
    "expiration",
    "track1",
    "track2",
  ]);

  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  return value;
}
