#!/bin/sh
set -eu

BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:1}"
PORT="${PORT:-8080}"

case "$BACKEND_URL" in
  http://*|https://*) ;;
  *)
    echo "BACKEND_URL must start with http:// or https://" >&2
    exit 1
    ;;
esac

BACKEND_URL="${BACKEND_URL%/}"
BACKEND_HOST="$(printf '%s' "$BACKEND_URL" | sed -E 's#^https?://([^/]+).*$#\1#')"

case "$PORT" in
  ''|*[!0-9]*)
    echo "PORT must be numeric" >&2
    exit 1
    ;;
esac

export BACKEND_URL BACKEND_HOST PORT

# Substitute only application variables. Nginx variables such as $scheme and
# $request_id must remain intact in the generated configuration.
envsubst '${BACKEND_URL} ${BACKEND_HOST} ${PORT}' \
  < /etc/nginx/render.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
