# Embedded Checkout Sample

North **form** checkout in the browser. The sample app runs in **Docker** (Bun + static assets under `src/web/`); **`POST /api/session`** proxies to North’s API using `.env`.

## Layout

| Path | Purpose |
|------|---------|
| `src/` | Bun server (`server.ts`) and static `web/` |
| `scripts/` | `start.sh`, `setup-hosts.sh`, `ensure-certs.sh`, `dotenv.sh` |
| `certs/` | `cert.pem` and `key.pem` for HTTPS (Caddy) |
| `docker/` | `Dockerfile`, `docker-compose.yml`, generated `Caddyfile.docker.auto` |

## Quick start

1. Install **Docker** (with Compose v2 — the `docker compose` plugin).

2. **`.env`** lives in the **project root** (same folder as this README). Create it if missing, or edit the one you already have. Set `API_URL`, `PRIVATE_API_KEY`, and `HOST` (comma-separated hostnames, e.g. `www.test.com,test.com`), `CHECKOUT_ID`, and `PROFILE_ID`.

3. Run:

```bash
chmod +x scripts/start.sh scripts/setup-hosts.sh scripts/ensure-certs.sh
./scripts/start.sh
```

`./scripts/start.sh` updates **`/etc/hosts`** when needed (may ask for sudo), generates **`certs/cert.pem`** and **`certs/key.pem`** for every name in `HOST` (prefers **[mkcert](https://github.com/FiloSottile/mkcert)** if installed — runs **`mkcert -install`** so your OS/browser trusts the local CA; otherwise falls back to **openssl** self-signed, which may show a browser warning until you install mkcert or trust the cert yourself). It writes **`docker/Caddyfile.docker.auto`**, then starts the app plus HTTPS on **443**. If you change `HOST` later, certs are regenerated automatically; to use your own PEMs instead, place them in **`certs/`** and remove **`certs/.generated-for-host`** so the script does not overwrite them.

4. Open **`https://<first-host-in-HOST>/`** (e.g. `https://www.test.com/`). The app also listens on **`http://127.0.0.1:8000`** for direct access (e.g. debugging).

---

**Port 443 in use:** `sudo lsof -nP -iTCP:443 -sTCP:LISTEN` — something else must release 443 (e.g. host Caddy you ran with `sudo`: **`sudo killall caddy`**). Then `./scripts/start.sh` again.

**API:** `POST /api/session` with JSON `{ "amount", "products" }` — returns North session JSON (includes `token`).
