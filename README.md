# Embedded Checkout Sample

North Embedded Checkout sample that supports **Form**, **Fields**, and **Direct Post** modes. The app runs in **Docker** (Bun + static assets under `src/web/`); **`POST /api/session`** creates a North session using `.env`, and **`POST /api/complete`** runs server-side payment verification for the sample `/complete/` page.

## Where each guide step lives

The [Form](https://developer.north.com/products/online/embedded-checkout/form-integration-guide), [Fields](https://developer.north.com/products/online/embedded-checkout/fields-integration-guide), and [Direct Post](https://developer.north.com/products/online/embedded-checkout/post-integration-guide) guides all share the same two **server-side** building blocks; the rest is browser UI.

| Guide step | What it is | In this repo |
|------------|------------|--------------|
| **Step 1 — Create a Checkout Session** | Server calls North with your private key; returns a short-lived token | `src/server.ts` → `createSession` → `POST /api/session` |
| **Steps 2–4 (varies)** | Load `checkout.js`, mount fields/form, submit / send payment | `src/web/form/`, `src/web/fields/`, `src/web/post/` (see comments in each `*.js` / `index.html`) |
| **Step 5 — Verify payment / completion** | Server calls North session **status** (do not call from browser JS) | `src/server.ts` → `confirmPayment` (`POST /api/complete`) |
| **Sample completion flow** | `/complete/` asks the server to verify and show JSON | `src/web/complete/` → `POST /api/complete` → `confirmPayment` in `src/server.ts` |
| **Shared browser helpers** | Request ID badge, digit cleanup, origin warning | `src/web/assets/` (`session-ui.js`, `helpers.js`, `session-meta.css`) |
| **Shared server helpers** | Env, JSON helpers, redaction for logs | `src/utils/server-utils.ts` |

## Layout

| Path | Purpose |
|------|---------|
| `src/` | Bun server (`server.ts`: `createSession`, `confirmPayment`) + `utils/server-utils.ts` (shared helpers) + static `web/` |
| `scripts/` | `start.sh`, `setup-hosts.sh`, `ensure-certs.sh`, `dotenv.sh` |
| `certs/` | `cert.pem` and `key.pem` for HTTPS (Caddy) |
| `docker/` | `Dockerfile`, `docker-compose.yml`, generated `Caddyfile.docker.auto` |

## Quick start

1. Install **Docker** (with Compose v2 — the `docker compose` plugin).

2. **`.env`** lives in the **project root** (same folder as this README). Create it if missing, or edit the one you already have. Set `PRIVATE_API_KEY`, `CHECKOUT_ID`, `PROFILE_ID`, and `CHECKOUT_TYPE` (`form`, `fields`, or `post`). There are **no default IDs** in the server — they must be provided per account.
   
   - To run with **HTTP-only** (default): keep `ENABLE_HTTPS=0` and use `http://127.0.0.1:8000`.
   - To run with **local HTTPS**: set `ENABLE_HTTPS=1` and set `HOST` (comma-separated hostnames, e.g. `www.test.com,test.com`).

3. Run:

```bash
chmod +x scripts/start.sh scripts/setup-hosts.sh scripts/ensure-certs.sh
./scripts/start.sh
```

`./scripts/start.sh` always starts the app on **`http://127.0.0.1:8000`**.

If `ENABLE_HTTPS=1`, it also updates **`/etc/hosts`** when needed (may ask for sudo), generates **`certs/cert.pem`** and **`certs/key.pem`** for every name in `HOST` (prefers **[mkcert](https://github.com/FiloSottile/mkcert)** if installed — runs **`mkcert -install`** so your OS/browser trusts the local CA; otherwise falls back to **openssl** self-signed, which may show a browser warning until you install mkcert or trust the cert yourself). It writes **`docker/Caddyfile.docker.auto`**, then starts Caddy with HTTPS on **443**. If you change `HOST` later, certs are regenerated automatically; to use your own PEMs instead, place them in **`certs/`** and remove **`certs/.generated-for-host`** so the script does not overwrite them.

4. Open **`http://127.0.0.1:8000/`**. The landing page links to each integration method.
   
   If you enabled HTTPS (`ENABLE_HTTPS=1`), you can also open **`https://<first-host-in-HOST>/`** (e.g. `https://www.test.com/`).

### Sample routes (one folder per method)

- **Form**: `http://127.0.0.1:8000/form/` (or `https://<host>/form/` with `ENABLE_HTTPS=1`)
- **Fields**: `http://127.0.0.1:8000/fields/` (or `https://<host>/fields/` with `ENABLE_HTTPS=1`)
- **Direct Post**: `http://127.0.0.1:8000/post/` (or `https://<host>/post/` with `ENABLE_HTTPS=1`)
- **Completion (server-verified)**: `http://127.0.0.1:8000/complete/` (or `https://<host>/complete/` with `ENABLE_HTTPS=1`)

The landing page `/` links to each method so developers can jump straight to the integration they care about.

---

**Port 443 in use:** `sudo lsof -nP -iTCP:443 -sTCP:LISTEN` — something else must release 443 (e.g. host Caddy you ran with `sudo`: **`sudo killall caddy`**). Then `./scripts/start.sh` again.

**API:**

- `POST /api/session` → **guide Step 1** (`createSession`): returns North session JSON (includes `token`). For Direct Post, an empty body is allowed.
- `POST /api/complete` → **guide Step 5** (`confirmPayment`): North session status fetch + redacted client-payload logging for `/complete/`.
