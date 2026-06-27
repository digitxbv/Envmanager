#!/usr/bin/env bash
# One-shot: wait for Postgres, apply EnvManager migrations in order, run bootstrap.
# Idempotent: tracks applied migration filenames in public._self_host_migrations.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"
PSQL=(psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 --quiet --no-psqlrc)

echo "db-init: waiting for database..."
for i in $(seq 1 60); do
  if psql "${DATABASE_URL}" -c 'SELECT 1' >/dev/null 2>&1; then break; fi
  sleep 2
  if [ "$i" -eq 60 ]; then echo "db-init: database never became ready" >&2; exit 1; fi
done

echo "db-init: ensuring migration tracking table..."
"${PSQL[@]}" -c "CREATE TABLE IF NOT EXISTS public._self_host_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);"

applied=0
for f in $(ls -1 /migrations/*.sql | sort); do
  name="$(basename "$f")"
  name_esc="${name//\'/\'\'}"   # double single-quotes → safe SQL string literal (filenames are repo-controlled; this is belt-and-suspenders)
  exists="$("${PSQL[@]}" -tAc "SELECT 1 FROM public._self_host_migrations WHERE filename = '${name_esc}'")"
  if [ "${exists}" = "1" ]; then continue; fi
  echo "db-init: applying ${name}"
  # Each migration runs in its own transaction; ON_ERROR_STOP aborts the job on failure.
  "${PSQL[@]}" -1 -f "${f}"
  "${PSQL[@]}" -c "INSERT INTO public._self_host_migrations (filename) VALUES ('${name_esc}')"
  applied=$((applied + 1))
done
echo "db-init: applied ${applied} new migrations"

echo "db-init: running self-host bootstrap..."
# The bootstrap sets a database-level custom GUC (app.self_hosted) via
# ALTER DATABASE, which PostgreSQL only permits for a SUPERUSER. On the bundled
# supabase/postgres image the connecting role ("postgres") is NOT a superuser —
# "supabase_admin" is. Derive a supabase_admin DSN from DATABASE_URL (same host
# and password) for the bootstrap, and fall back to the default connection where
# the connecting role is already a superuser (e.g. local supabase dev).
ADMIN_URL="$(printf '%s' "${DATABASE_URL}" | sed -E 's#://[^:@/]+:#://supabase_admin:#')"
if [ "${ADMIN_URL}" != "${DATABASE_URL}" ] && psql "${ADMIN_URL}" -c 'SELECT 1' >/dev/null 2>&1; then
  echo "db-init: bootstrap running as supabase_admin (superuser)"
  psql "${ADMIN_URL}" -v ON_ERROR_STOP=1 --quiet --no-psqlrc -1 -f /bootstrap/self-host-bootstrap.sql
else
  echo "db-init: supabase_admin not reachable; running bootstrap as the default role"
  "${PSQL[@]}" -1 -f /bootstrap/self-host-bootstrap.sql
fi

echo "db-init: Bootstrap complete"
