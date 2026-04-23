/**
 * Embedded Checkout Fields — code steps align to:
 * https://developer.north.com/products/online/embedded-checkout/fields-integration-guide
 *
 * Step 1 (Create Checkout and Get Credentials) is done in the North dashboard, not in code.
 *
 * Step 2: Create a Checkout Session (server-side)
 * - This sample calls `/api/session` to create a North session and receive a token.
 *
 * Step 3: Add the Checkout Script
 * - Done in `index.html`.
 *
 * Step 4: Mount the Payment Fields
 * - `checkout.mount(sessionToken, mountElementId)`
 *
 * Step 5: Submit the Payment
 * - `checkout.submit()` (requires fields are mounted)
 *
 * Step 6: Handle the Payment Response
 * - After client response, redirect to `/complete/` for server-side verification.
 */

let sessionToken = null;

// Step 2: Create a Checkout Session (client -> server)
async function createSession() {
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

  const text = await response.text();
  if (!response.ok) throw new Error(`Session HTTP ${response.status}: ${text.slice(0, 500)}`);

  const data = JSON.parse(text);
  if (data.error) throw new Error(data.error);
  if (!data.token) throw new Error("No token in session response");

  if (typeof northApplySessionPayloadForRequestId === "function") {
    northApplySessionPayloadForRequestId(data);
  }

  return data.token;
}

async function boot() {
  const out = document.getElementById("out");
  const pay = document.getElementById("pay");

  if (typeof checkout === "undefined" || typeof checkout.mount !== "function") {
    throw new Error("Global `checkout` is missing. Load https://checkout.north.com/checkout.js.");
  }

  sessionToken = await createSession();

  // Store token for `/complete/`
  try {
    sessionStorage.setItem("north_session_token", sessionToken);
  } catch {
    // ignore
  }

  // Step 4: Mount the Payment Fields
  await checkout.mount(sessionToken, "fields-container");

  pay.addEventListener("click", async () => {
    out.textContent = "Submitting…";
    try {
      // Step 5: Submit the Payment
      if (typeof checkout.submit !== "function") {
        throw new Error("checkout.submit() is not available for this checkout type/config.");
      }
      const resp = await checkout.submit();

      // Step 6: Handle the Payment Response (client-side)
      out.textContent = JSON.stringify(resp, null, 2);
      try {
        sessionStorage.setItem("north_client_response", JSON.stringify(resp));
      } catch {
        // ignore
      }

      // Server-side verification page (do not call North /status directly from browser JS)
      location.href = "/complete/";
    } catch (e) {
      out.textContent = String(e && e.message ? e.message : e);
    }
  });
}

boot().catch((e) => {
  document.getElementById("out").textContent = String(e && e.message ? e.message : e);
});

