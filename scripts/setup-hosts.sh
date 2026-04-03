#!/bin/sh
# Maps HOST names from .env → 127.0.0.1 in /etc/hosts (one line with all names).
# HOST can be comma- or space-separated, e.g. HOST=www.test.com,test.com
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
. "$SCRIPT_DIR/dotenv.sh"
dotenv_load "$ROOT/.env"

HOST="${HOST:-www.test.com,test.com}"

_host_list=$(printf '%s' "$HOST" | tr ',' ' ' | tr -s '[:space:]' ' ' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
[ -n "$_host_list" ] || {
  echo "HOST is empty in .env" >&2
  exit 1
}

_first=$(printf '%s' "$_host_list" | awk '{print $1}')
LINE="127.0.0.1 $_host_list"

# True if some non-comment line has 127.0.0.1 and every hostname in HOST
_line_ok() {
  _line="$1"
  case "$_line" in
    \#*) return 1 ;;
  esac
  case "$_line" in
    *127.0.0.1*) ;;
    *) return 1 ;;
  esac
  for _h in $_host_list; do
    _esc=$(printf '%s' "$_h" | sed 's/\./\\./g')
    echo "$_line" | grep -qE "[[:space:]]${_esc}([[:space:]]|$)" || return 1
  done
  return 0
}

while IFS= read -r _l || [ -n "$_l" ]; do
  if _line_ok "$_l"; then
    echo "OK — /etc/hosts already maps 127.0.0.1 → $_host_list" >&2
    exit 0
  fi
done < /etc/hosts

echo "Adding to /etc/hosts (sudo): $LINE" >&2
printf '%s\n' "$LINE" | sudo tee -a /etc/hosts >/dev/null
echo "Done." >&2
