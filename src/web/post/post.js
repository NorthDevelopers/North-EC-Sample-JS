/**
 * Embedded Checkout Direct Post — code steps align to:
 * https://developer.north.com/products/online/embedded-checkout/post-integration-guide
 *
 * Step 1 (Create Checkout and Get Credentials) is done in the North dashboard, not in code.
 *
 * Step 2: Create a Checkout Session (server-side)
 * - This sample calls `/api/session` to create a North session and get a token.
 *
 * Step 3: Add the Checkout Script
 * - Done in `index.html`.
 *
 * Step 4: Build Your Payment Form
 * - This page collects raw card input fields.
 *
 * Step 5: Submit the Payment
 * - `checkout.sendPayment(sessionToken, paymentRequest)`
 *
 * Step 6: Handle the Payment Response
 * - Redirect to `/complete/` for server-side verification.
 *
 * IMPORTANT: This method increases PCI scope because raw PAN/CVV touch your page.
 */

// Step 2: Create a Checkout Session (client -> server)
async function createSession({ amount }) {
  const response = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
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
  const form = document.getElementById("f");

  if (typeof checkout === "undefined" || typeof checkout.sendPayment !== "function") {
    throw new Error(
      "checkout.sendPayment() is not available. Ensure this checkout is a Direct Post checkout.",
    );
  }

  // Step 5: Submit the Payment
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    out.textContent = "Submitting…";

    const fd = new FormData(form);
    const amountRaw = Number(fd.get("amount"));
    if (!Number.isFinite(amountRaw)) throw new Error("Amount must be a number");
    const amount = Number(amountRaw.toFixed(2));

    const digits = typeof northOnlyDigits === "function" ? northOnlyDigits : onlyDigits;
    const cardNumber = digits(fd.get("cardNumber"));
    const exp = digits(fd.get("exp")); // guide uses MMYY
    const cvv = digits(fd.get("cvv"));
    const zip = digits(fd.get("zip"));

    // Payment request object: adapt field names if your North Direct Post configuration differs.
    const paymentRequest = {
      amount,
      cardNumber,
      exp,
      cvv,
      zip,

      // Some Direct Post configs expect gateway-style fields; keep as a compatibility shim.
      account_nbr: cardNumber,
      exp_date: exp,
      cvv2: cvv,
      payment_method: "credit",
    };

    try {
      const token = await createSession({ amount });

      // Store token for `/complete/`
      try {
        sessionStorage.setItem("north_session_token", token);
      } catch {
        // ignore
      }

      const resp = await checkout.sendPayment(token, paymentRequest);
      out.textContent = JSON.stringify(resp, null, 2);
      try {
        sessionStorage.setItem("north_client_response", JSON.stringify(resp));
      } catch {
        // ignore
      }

      // Step 6: Handle the Payment Response -> verify server-side
      location.href = "/complete/";
    } catch (err) {
      out.textContent = String(err && err.message ? err.message : err);
    }
  });
}

boot().catch((e) => {
  document.getElementById("out").textContent = String(e && e.message ? e.message : e);
});

