#!/bin/sh
# Create certs/cert.pem + certs/key.pem for HOST from .env (mkcert if available, else openssl).
# Skips if certs exist and were generated for the same HOST (see certs/.generated-for-host).
# Manual certs (no fingerprint): never overwritten.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
. "$SCRIPT_DIR/dotenv.sh"
dotenv_load "$ROOT/.env"

HOST="${HOST:-www.test.com,test.com}"
_host_list=$(printf '%s' "$HOST" | tr ',' ' ' | tr -s '[:space:]' ' ' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
if [ -z "$_host_list" ]; then
  echo "HOST is empty in .env" >&2
  exit 1
fi

CERT="$ROOT/certs/cert.pem"
KEY="$ROOT/certs/key.pem"
FINGERPRINT="$ROOT/certs/.generated-for-host"

_should_regen=0
if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
  _should_regen=1
elif [ -f "$FINGERPRINT" ]; then
  _old=$(cat "$FINGERPRINT")
  if [ "$_old" != "$HOST" ]; then
    echo "HOST changed; regenerating TLS certs..." >&2
    _should_regen=1
  fi
fi

if [ "$_should_regen" -eq 0 ]; then
  echo "TLS certs OK ($CERT)" >&2
  exit 0
fi

mkdir -p "$ROOT/certs"

if command -v mkcert >/dev/null 2>&1; then
  echo "Generating TLS with mkcert (installs local CA for browser trust)..." >&2
  if ! mkcert -install; then
    echo "Warning: mkcert -install failed or was cancelled. If HTTPS shows errors, run: mkcert -install" >&2
  fi
  mkcert -cert-file "$CERT" -key-file "$KEY" $_host_list
else
  echo "mkcert not found; generating self-signed cert with openssl (browser will warn until trusted or you install mkcert)." >&2
  _first=$(printf '%s' "$_host_list" | awk '{print $1}')
  _tmpdir=$(mktemp -d)
  trap 'rm -rf "$_tmpdir"' EXIT
  _cnf="$_tmpdir/openssl.cnf"
  {
    printf '%s\n' '[req]'
    printf '%s\n' 'distinguished_name = dn'
    printf '%s\n' 'x509_extensions = v3_req'
    printf '%s\n' 'prompt = no'
    printf '%s\n' '[dn]'
    printf 'CN=%s\n' "$_first"
    printf '%s\n' '[v3_req]'
    printf '%s\n' 'subjectAltName = @san'
    printf '%s\n' '[san]'
    _i=1
    for _h in $_host_list; do
      printf 'DNS.%s = %s\n' "$_i" "$_h"
      _i=$((_i + 1))
    done
  } >"$_cnf"
  openssl req -x509 -newkey rsa:2048 -sha256 -days 825 -nodes \
    -keyout "$KEY" -out "$CERT" \
    -config "$_cnf" \
    -extensions v3_req
fi

printf '%s\n' "$HOST" >"$FINGERPRINT"
echo "Wrote $CERT and $KEY (HOST=$HOST)" >&2
