/**
 * Sample flow: POST /api/session for a token, then checkout.mount(token, containerId).
 */
const MOUNT_TIMEOUT_MS = 10_000;

/** Decode JWT payload (no verification) to compare session domain vs page origin */
function readTokenDomain(token) {
  try {
    const body = token.split('.')[1];
    if (!body) return null;
    const padded = body + '='.repeat((4 - (body.length % 4)) % 4);
    const json = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json);
    return payload.domain || (payload.session && payload.session.domain) || null;
  } catch {
    return null;
  }
}

async function mountCheckout() {
  try {
    if (typeof checkout === 'undefined' || typeof checkout.mount !== 'function') {
      throw new Error(
        'Global `checkout` is missing. Load https://checkout.north.com/checkout.js before this script.',
      );
    }

    const response = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 39.98,
        products: [
          {
            name: 'Product 1',
            price: 19.99,
            quantity: 2,
            logoUrl: 'https://example.com/logo1.png',
          },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      throw new Error(`Session HTTP ${response.status}: ${t.slice(0, 500)}`);
    }

    const text = await response.text();
    if (!text || !text.trim()) {
      throw new Error('Empty body from /api/session');
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`Invalid JSON from /api/session: ${e.message}. Body: ${text.slice(0, 300)}`);
    }

    if (data.error) {
      throw new Error(data.error);
    }

    const sessionToken = data.token;
    if (!sessionToken) {
      throw new Error('No token in session response: ' + text.slice(0, 300));
    }

    const configuredDomain = readTokenDomain(sessionToken);
    const origin = location.origin.replace(/\/$/, '');
    if (configuredDomain) {
      const cfg = configuredDomain.replace(/\/$/, '');
      if (cfg !== origin) {
        console.warn(
          '[Embedded Checkout] Origin mismatch: session domain is',
          JSON.stringify(cfg),
          'but page is',
          JSON.stringify(origin),
          '— align North embed settings with this origin or checkout.mount may hang.',
        );
      }
    }

    const instance = await Promise.race([
      checkout.mount(sessionToken, 'checkout-container'),
      new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `checkout.mount() did not finish within ${MOUNT_TIMEOUT_MS / 1000}s. ` +
                  'Check origin vs North dashboard, ad blockers, and Network tab for blocked scripts or iframe.',
              ),
            ),
          MOUNT_TIMEOUT_MS,
        ),
      ),
    ]);

    return instance;
  } catch (err) {
    console.error('[Embedded Checkout]', err);
  }
}

mountCheckout();
