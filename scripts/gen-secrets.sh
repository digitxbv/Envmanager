#!/usr/bin/env bash
#
# Generate the self-host secrets EnvManager needs and write them into .env.
#
#   cp .env.example .env
#   ./scripts/gen-secrets.sh
#   docker compose up
#
# Fills the 8 required secrets that ship as `replace-with-...` placeholders:
# POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY, SECRET_KEY_BASE,
# VAULT_ENC_KEY, DASHBOARD_PASSWORD, CRON_SECRET. ANON_KEY and SERVICE_ROLE_KEY
# are HS256 JWTs signed by the generated JWT_SECRET (role claim anon /
# service_role) — exactly what the Supabase gateway expects. Passwords are hex,
# not base64, so they never contain '/ + =' that would break Postgres DSNs.
#
# WARNING: rotating JWT_SECRET or VAULT_ENC_KEY on a LIVE instance logs everyone
# out and can make already-encrypted secrets unreadable. Run this ONCE, before
# first boot. Re-running on an already-configured .env requires --force.
set -euo pipefail

ENV_FILE=".env"
FORCE=0
[ "${1:-}" = "--force" ] && FORCE=1

[ -f "$ENV_FILE" ] || { echo "error: $ENV_FILE not found — run 'cp .env.example .env' first." >&2; exit 1; }
command -v openssl >/dev/null || { echo "error: openssl is required." >&2; exit 1; }
command -v node    >/dev/null || { echo "error: node is required to sign the API keys." >&2; exit 1; }

if ! grep -q '^JWT_SECRET=replace-with' "$ENV_FILE" && [ "$FORCE" -eq 0 ]; then
  echo "refusing: $ENV_FILE already has a real JWT_SECRET. Re-running rotates keys and can" >&2
  echo "make existing encrypted secrets unreadable. Pass --force only if you mean it." >&2
  exit 1
fi

JWT_SECRET=$(openssl rand -hex 32)

# Sign an HS256 JWT with JWT_SECRET for the given role. 10-year expiry.
mint() { JWT_SECRET="$JWT_SECRET" node -e '
const c=require("crypto"),s=process.env.JWT_SECRET,b=o=>Buffer.from(o).toString("base64url"),
n=Math.floor(Date.now()/1e3),
d=b(JSON.stringify({alg:"HS256",typ:"JWT"}))+"."+b(JSON.stringify({role:process.argv[1],iss:"supabase",iat:n,exp:n+315360000}));
process.stdout.write(d+"."+c.createHmac("sha256",s).update(d).digest("base64url"))' "$1"; }

# Replace `KEY=...` in $ENV_FILE in place (append if absent). Portable: awk, no
# `sed -i` (which differs between GNU and BSD/macOS). Values pass via env so awk
# never re-parses them.
set_var() {
  local tmp; tmp=$(mktemp)
  KEY="$1" VAL="$2" awk -F= 'BEGIN{k=ENVIRON["KEY"];v=ENVIRON["VAL"];d=0}
    $1==k&&!d{print k"="v;d=1;next}{print}END{if(!d)print k"="v}' "$ENV_FILE" >"$tmp"
  mv "$tmp" "$ENV_FILE"
}

set_var POSTGRES_PASSWORD  "$(openssl rand -hex 24)"
set_var JWT_SECRET         "$JWT_SECRET"
set_var ANON_KEY           "$(mint anon)"
set_var SERVICE_ROLE_KEY   "$(mint service_role)"
set_var SECRET_KEY_BASE    "$(openssl rand -hex 48)"
set_var VAULT_ENC_KEY      "$(openssl rand -hex 24)"
set_var DASHBOARD_PASSWORD "$(openssl rand -hex 16)"
set_var CRON_SECRET        "$(openssl rand -hex 32)"

echo "✓ Wrote 8 generated secrets into $ENV_FILE. Next: docker compose up"
