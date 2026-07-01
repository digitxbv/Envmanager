#!/usr/bin/env sh
# One-shot: create the initial admin user via GoTrue's admin API, if configured.
#
#   - No-op when ADMIN_EMAIL / ADMIN_PASSWORD are unset (so it's safe to always run).
#   - Idempotent: an already-existing user is treated as success, not an error.
#   - Talks to GoTrue directly (auth:9999), authenticating with the service-role
#     key (a JWT whose role=service_role, which GoTrue's admin API requires).
#
# The created user is a normal account with a confirmed email. On first login it
# completes onboarding and becomes the org owner — same path as a first registrant.
set -eu

if [ -z "${ADMIN_EMAIL:-}" ] || [ -z "${ADMIN_PASSWORD:-}" ]; then
  echo "create-admin: ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping."
  exit 0
fi
: "${SERVICE_ROLE_KEY:?SERVICE_ROLE_KEY must be set}"

GOTRUE_URL="${GOTRUE_ADMIN_URL:-http://auth:9999}"

# JSON-escape backslash and double-quote so odd passwords don't break the body.
# ponytail: doesn't escape literal control chars (newlines) in a password — env
# passwords don't contain those; switch to jq if that ever changes.
esc() { printf '%s' "$1" | sed 's/[\\"]/\\&/g'; }
payload=$(printf '{"email":"%s","password":"%s","email_confirm":true}' \
  "$(esc "$ADMIN_EMAIL")" "$(esc "$ADMIN_PASSWORD")")

echo "create-admin: ensuring admin user ${ADMIN_EMAIL} ..."
code=$(curl -s -o /tmp/create-admin-body -w '%{http_code}' \
  -X POST "${GOTRUE_URL}/admin/users" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  --data "${payload}") \
  || { echo "create-admin: could not reach GoTrue at ${GOTRUE_URL}" >&2; exit 1; }

case "${code}" in
  2*)
    echo "create-admin: created admin user ${ADMIN_EMAIL}."
    ;;
  409|422)
    # GoTrue returns 422 (older builds 409) with an "email_exists"/"already
    # registered" message when the user is already present — that's success.
    if grep -qiE 'exist|registered' /tmp/create-admin-body; then
      echo "create-admin: admin user already exists — nothing to do."
    else
      echo "create-admin: unexpected ${code}: $(cat /tmp/create-admin-body)" >&2
      exit 1
    fi
    ;;
  *)
    echo "create-admin: failed (HTTP ${code}): $(cat /tmp/create-admin-body)" >&2
    exit 1
    ;;
esac
