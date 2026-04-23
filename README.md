# Accept Payments with North Embedded Checkout

[North Embedded Checkout](https://developer.north.com/products/online/embedded-checkout) supports three integration types—[Form](https://developer.north.com/products/online/embedded-checkout/form-integration-guide), [Fields](https://developer.north.com/products/online/embedded-checkout/fields-integration-guide), and [Direct Post](https://developer.north.com/products/online/embedded-checkout/post-integration-guide)—that allow you to balance speed of implementation, control over the UI, and PCI scope based on your business needs. See the [comparison table](https://developer.north.com/products/online/embedded-checkout#integration-types) for a side-by-side summary of the flexibility, PCI scope, and implementation effort.

The overall integration path is the same across each integration type. You configure a checkout in the [Embedded Checkout Designer](/dashboard/embedded-checkouts/designer), store your private API Key, Checkout ID, and Profile ID from the [Embedded Checkout dashboard](/dashboard/embedded-checkouts), and create short-lived checkout sessions from your server.

<img width="500" height="250" alt="blog-embedded-checkout-comparison-body" src="https://github.com/user-attachments/assets/c5b958b5-7f76-47a3-8cf2-716773bb5429" />


## What You'll Build

This sample code enables you to quickly integrate **North Embedded Checkout** with your app, whether you in three modes—**Form**, **Fields**, and **Direct Post**—using a small **Docker** stack (Bun serves the API and static assets under `src/web/`). The server exposes **`POST /api/session`** to create a North session from your `.env` credentials and **`POST /api/complete`** for server-side payment verification on the sample `/complete/` page.

Building a payment flow from scratch means handling validation, errors, and security boundaries. This repo focuses on the **server-side** pieces every guide shares, plus minimal browser pages so you can see each mode end-to-end.

<img width="1326" height="875" alt="blog-ec-tutorial-2" src="https://github.com/user-attachments/assets/3335546c-cabe-45f5-bcdc-087ca9421eee" />


## Features

- **Three integration modes** — Form, Fields, and Direct Post, each with its own route under `src/web/`.
- **Shared server flow** — Create session and verify completion in one Bun app.
- **Docker-first** — Compose, Caddy for optional HTTPS, scripts for certs and hosts.
- **Developer-oriented** — Landing page links to each mode; comments in `*.js` / `index.html` tie steps to the guides.

## Where each guide step lives

The [Form](https://developer.north.com/products/online/embedded-checkout/form-integration-guide), [Fields](https://developer.north.com/products/online/embedded-checkout/fields-integration-guide), and [Direct Post](https://developer.north.com/products/online/embedded-checkout/post-integration-guide) guides all share the same two **server-side** building blocks; the rest is browser UI.

| Guide step | What it is | In this repo |
|------------|------------|--------------|
| **Step 1 — Create Checkout and Get Credentials** | Done in the North dashboard (Checkout Designer); not a code step | `.env` holds the resulting `PRIVATE_API_KEY`, `CHECKOUT_ID`, `PROFILE_ID` |
| **Step 2 — Create a Checkout Session** | Server calls North with your private key; returns a short-lived token | `src/server.ts` → `createSession` → `POST /api/session` |
| **Steps 3–5 (varies)** | Load `checkout.js`, mount/build form, submit / send payment | `src/web/form/`, `src/web/fields/`, `src/web/post/` (see comments in each `*.js` / `index.html`) |
| **Step 6 — Handle completion / payment response** | Server calls North session **status** (do not call from browser JS) | `src/server.ts` → `confirmPayment` (`POST /api/complete`) |
| **Sample completion flow** | `/complete/` asks the server to verify and show JSON | `src/web/complete/` → `POST /api/complete` → `confirmPayment` in `src/server.ts` |
| **Shared browser helpers** | Request ID badge, digit cleanup, origin warning | `src/web/assets/` (`session-ui.js`, `helpers.js`, `session-meta.css`) |
| **Shared server helpers** | Env, JSON helpers, redaction for logs | `src/utils/server-utils.ts` |

## How to run locally

**1. Prerequisites**

Install **Docker** with **Compose v2** (the `docker compose` plugin).

**2. Configure environment**

`.env` lives in the **project root** (next to this README). Create or edit it and set:

- `PRIVATE_API_KEY`
- `CHECKOUT_ID`
- `PROFILE_ID`
- `CHECKOUT_TYPE` — one of `form`, `fields`, or `post`

There are **no default IDs** in the server; values must match your North account.

- **HTTP only (default):** `ENABLE_HTTPS=0` → use `http://127.0.0.1:8000`.
- **Local HTTPS:** `ENABLE_HTTPS=1` and set `HOST` to comma-separated hostnames (e.g. `www.test.com,test.com`).

**3. Start the app**

```bash
chmod +x scripts/start.sh scripts/setup-hosts.sh scripts/ensure-certs.sh
./scripts/start.sh
```

`./scripts/start.sh` always serves the app at **`http://127.0.0.1:8000`**.

**4. HTTPS details (optional)**

When `ENABLE_HTTPS=1`, the script may update **`/etc/hosts`** (sudo), generate **`certs/cert.pem`** and **`certs/key.pem`** for every name in `HOST` (prefers **[mkcert](https://github.com/FiloSottile/mkcert)** if installed—including `mkcert -install` so your OS trusts the local CA; otherwise falls back to **openssl** self-signed certs, which may trigger browser warnings until you trust them). It writes **`docker/Caddyfile.docker.auto`** and starts Caddy with HTTPS on **443**. If you change `HOST`, certs are regenerated. To use your own PEMs, put them in **`certs/`** and remove **`certs/.generated-for-host`** so the script does not overwrite them.

**5. Open in the browser**

- Default: **`http://127.0.0.1:8000/`** — landing page links each integration.
- With HTTPS: **`https://<first-host-in-HOST>/`** (e.g. `https://www.test.com/`).


## Get support

For North product and API questions, [contact Sales Engineering](https://developer.north.com/contact) or your usual North support channels.

If you find a bug in this sample, open an issue on this repository.
