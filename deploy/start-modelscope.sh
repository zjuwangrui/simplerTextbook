#!/bin/sh
set -eu

cd /app/src/backend
gunicorn -w "${GUNICORN_WORKERS:-2}" -b 127.0.0.1:5000 app:app &
BACKEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" 2>/dev/null || true
}

trap cleanup INT TERM

nginx -g 'daemon off;' &
NGINX_PID=$!

while kill -0 "$BACKEND_PID" 2>/dev/null && kill -0 "$NGINX_PID" 2>/dev/null; do
  sleep 5
done

kill "$BACKEND_PID" "$NGINX_PID" 2>/dev/null || true
wait "$BACKEND_PID" 2>/dev/null || true
wait "$NGINX_PID" 2>/dev/null || true
