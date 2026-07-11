#!/bin/sh
# ============================================================
# 15-extract-backend-host.sh
# ============================================================
# Runs during container startup BEFORE 20-envsubst-on-templates.sh.
# 
# Does two things:
# 1. Strips trailing slash(es) from BACKEND_URL so we don't get
#    double slashes in proxy_pass (https://host//api/).
# 2. Extracts the hostname into BACKEND_HOST so nginx can send
#    the correct SNI (Server Name Indication) during the TLS
#    handshake with Render's load balancer. Without SNI, Render
#    doesn't know which backend to route to and the handshake
#    fails with "SSL alert number 40".
# ============================================================

if [ -n "$BACKEND_URL" ]; then
  # Strip trailing slash(es)
  BACKEND_URL=$(printf '%s' "$BACKEND_URL" | sed -E 's|/*$||')
  export BACKEND_URL

  # Extract hostname (strip protocol, path, port)
  BACKEND_HOST=$(printf '%s' "$BACKEND_URL" | sed -E 's|^https?://||; s|/.*$||; s|:.*$||')
  export BACKEND_HOST
fi
