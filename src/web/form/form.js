/**
 * Embedded Checkout Form — code steps align to:
 * https://developer.north.com/products/online/embedded-checkout/form-integration-guide
 *
 * Step 1: Create a Checkout Session (server-side)
 * - This sample calls our backend `/api/session`, which uses your PRIVATE_API_KEY to create
 *   a North session and returns `{ token, ... }` to the browser.
 *
 * Step 2: Add the Checkout Script
 * - Done in `index.html` via `<script src="https://checkout.north.com/checkout.js"></script>`.
 *
 * Step 3: Render the Checkout Form
 * - Call `checkout.mount(sessionToken, containerId)`.
 *
 * Step 5: Handle Checkout Completion
 * - This sample stores the token and redirects to `/complete/` where the server verifies
 *   the session status (do not call North status endpoints from the browser).
 */

const MOUNT_TIMEOUT_MS = 10_000;

async function mountCheckoutForm() {
  try {
    if (typeof checkout === "undefined" || typeof checkout.mount !== "function") {
      throw new Error(
        "Global `checkout` is missing. Load https://checkout.north.com/checkout.js before this script.",
      );
    }

    // Step 1 (client -> server): Create a Checkout Session
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: 39.98,
        products: [
          {
            name: "Product 1",
            price: 19.99,
            quantity: 2,
            logoUrl: "https://example.com/logo1.png",
          },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      throw new Error(`Session HTTP ${response.status}: ${t.slice(0, 500)}`);
    }

    const text = await response.text();
    if (!text || !text.trim()) throw new Error("Empty body from /api/session");

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(
        `Invalid JSON from /api/session: ${e.message}. Body: ${text.slice(0, 300)}`,
      );
    }
    if (data.error) throw new Error(data.error);

    if (typeof northApplySessionPayloadForRequestId === "function") {
      northApplySessionPayloadForRequestId(data);
    }

    const sessionToken = data.token;
    if (!sessionToken) throw new Error("No token in session response: " + text.slice(0, 300));

    // Step 5: Handle Checkout Completion (store token for `/complete/`)
    try {
      sessionStorage.setItem("north_session_token", sessionToken);
    } catch {
      // ignore (Safari private mode, etc.)
    }

    // Optional sanity check (common cause of checkout.mount hanging)
    if (typeof northWarnIfOriginMismatch === "function") {
      northWarnIfOriginMismatch(sessionToken);
    }

    // Step 3: Render the Checkout Form
    await Promise.race([
      checkout.mount(sessionToken, "checkout-container"),
      new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `checkout.mount() did not finish within ${MOUNT_TIMEOUT_MS / 1000}s. ` +
                  "Check origin vs North dashboard, ad blockers, and DevTools Network for blocked scripts/iframes.",
              ),
            ),
          MOUNT_TIMEOUT_MS,
        ),
      ),
    ]);
  } catch (err) {
    console.error("[Embedded Checkout Form]", err);
  }
}

mountCheckoutForm();

