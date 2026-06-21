#!/usr/bin/env bash
# Serve the site locally for testing. Cookies are blocked on file:// in most
# browsers, so always run through a real HTTP server like this one.
set -e
PORT="${1:-8000}"
cd "$(dirname "$0")"
echo "Hoa Sơn Tái Khởi → http://localhost:$PORT"
if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "$PORT"
elif command -v npx >/dev/null 2>&1; then
  exec npx --yes serve -l "$PORT" .
else
  echo "Cần python3 hoặc node để chạy server." >&2
  exit 1
fi
