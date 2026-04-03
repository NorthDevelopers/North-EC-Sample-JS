# POSIX: source from scripts/ —  . "$SCRIPT_DIR/dotenv.sh"
# Usage: dotenv_load "/path/to/.env"
dotenv_load() {
  _ef="$1"
  [ -f "$_ef" ] || return 0
  while IFS= read -r _line || [ -n "$_line" ]; do
    _line=$(printf '%s' "$_line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    case "$_line" in
      \#*|"") continue ;;
    esac
    _key="${_line%%=*}"
    _val="${_line#*=}"
    export "${_key}=${_val}"
  done < "$_ef"
}
