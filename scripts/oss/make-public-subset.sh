#!/usr/bin/env bash
# Produce the PUBLIC OSS subset of EnvManager as a fresh, single-commit repo.
#
# Strategy (Approach A — public is upstream):
#   1. Clone the private repo into a scratch dir (never touch the source repo).
#   2. git filter-repo --invert-paths to DELETE every PRIVATE-ONLY path from
#      all history.
#   3. Replace app/pages/index.vue with a minimal redirect-to-login page and
#      app/layouts/default.vue with a chrome-free fallback layout (the real
#      marketing homepage and marketing-chrome layout stay private).
#   4. Squash to a single clean "Initial public release" commit.
#   5. Run gitleaks one more time on the result as a final gate.
#
# The OSS legal/docs files (LICENSE, SECURITY.md, CONTRIBUTING.md, README.md)
# and scripts/oss/* are KEPT (they were committed in Tasks 1-2 and are not in
# the exclusion list), so they survive into the public subset automatically.
#
# Usage:
#   scripts/oss/make-public-subset.sh [SOURCE_REPO] [OUTPUT_DIR]
# Defaults:
#   SOURCE_REPO = the current repo (git toplevel)
#   OUTPUT_DIR  = ../envmanager-public
set -euo pipefail

SRC="${1:-$(git rev-parse --show-toplevel)}"
OUT="${2:-$(dirname "$SRC")/envmanager-public}"
EXCLUDE_FILE="$SRC/scripts/oss/private-only-paths.txt"

command -v git-filter-repo >/dev/null 2>&1 || {
  echo "git-filter-repo not found. Install: brew install git-filter-repo" >&2; exit 127; }
[ -f "$EXCLUDE_FILE" ] || { echo "Missing $EXCLUDE_FILE" >&2; exit 1; }

if [ -e "$OUT" ]; then
  echo "Output dir $OUT already exists. Remove it first." >&2; exit 1
fi

echo "==> [1/6] Cloning private repo into scratch dir: $OUT"
git clone --no-local "$SRC" "$OUT"
cd "$OUT"

echo "==> [2/6] Building filter-repo path arguments from exclusion list"
ARGS=()
while IFS= read -r line; do
  line="${line%%#*}"            # strip inline comments
  line="$(echo "$line" | xargs)"  # trim whitespace
  [ -z "$line" ] && continue
  if [[ "$line" == */ ]]; then
    ARGS+=( --path "$line" )      # directory prefix match
  else
    ARGS+=( --path "$line" --path-glob "$line" )  # exact file (glob covers it too)
  fi
done < "$EXCLUDE_FILE"

echo "==> [3/6] Removing PRIVATE-ONLY paths from ALL history (git filter-repo)"
git filter-repo --force --invert-paths "${ARGS[@]}"

echo "==> [4/6] Writing public stubs for index.vue (redirect) + default.vue (chrome-free layout)"
mkdir -p app/pages app/layouts
cat > app/pages/index.vue <<'VUE'
<script setup lang="ts">
// Public/self-hosted build: the marketing homepage is not part of the OSS
// subset. Send visitors straight to the app.
const user = useSupabaseUser()
watchEffect(() => {
  navigateTo(user.value ? '/dashboard' : '/auth/login')
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center">
    <p class="text-sm text-muted-foreground">Redirecting…</p>
  </div>
</template>
VUE

# The private default.vue renders the marketing header/footer (MarketingFooter,
# nav to /features, /pricing, …) which are all excluded from the public subset.
# default.vue is the fallback layout for kept pages with no explicit layout
# (share/*, dashboard/profile), so it must exist and not reference excluded
# components. Replace it with a minimal chrome-free layout.
cat > app/layouts/default.vue <<'VUE'
<script setup lang="ts">
// Public/self-hosted build: the marketing chrome (header, nav, footer) is not
// part of the OSS subset. This minimal fallback layout just renders the page.
</script>

<template>
  <div class="flex min-h-screen flex-col bg-background">
    <main class="flex-1">
      <slot />
    </main>
  </div>
</template>
VUE

echo "==> [5/6] Squashing to a single 'Initial public release' commit"
# Drop all history: re-init so there is exactly one clean root commit.
rm -rf .git
git init -q
git checkout -q -b main
git add -A
git -c commit.gpgsign=false commit -q -s -m "Initial public release

EnvManager OSS subset under BSL 1.1. Hosted-only billing, marketing,
and internal docs are excluded; the full DB schema ships and is inert
when self-hosted (EM_SELF_HOSTED=true)."

echo "==> [6/6] Final secret scan on the public subset"
if command -v gitleaks >/dev/null 2>&1; then
  gitleaks detect --source "$OUT" --config "$OUT/.gitleaks.toml" --redact --verbose
else
  echo "WARN: gitleaks not installed; skipping final scan" >&2
fi

echo
echo "DONE. Public subset is at: $OUT"
echo "Next: verify excluded paths are gone, then create + push the GitHub repo."
