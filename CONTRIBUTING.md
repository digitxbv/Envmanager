# Contributing to EnvManager

Thanks for your interest in contributing! EnvManager's **core is developed in
public** in this repository. The maintainers also run a private superset that
adds hosted-only code (billing, marketing, internal tooling); that private
repo merges this public repository as `upstream`. In practice this means: all
core features, bug fixes, and improvements happen here, in the open, and flow
downstream to the hosted product.

## License of Contributions

EnvManager is licensed under the Business Source License 1.1 (see `LICENSE`).
By contributing, you agree your contributions are licensed under the same
terms, and you certify the Developer Certificate of Origin (below).

## Developer Certificate of Origin (DCO)

We use the [DCO](https://developercertificate.org/) instead of a CLA. Every
commit must be signed off, certifying you wrote the code (or have the right to
submit it). Sign off by adding a `Signed-off-by` trailer to each commit:

```
git commit -s -m "fix: correct decrypt RPC error handling"
```

This appends:

```
Signed-off-by: Your Name <your.email@example.com>
```

Use your real name and a real email. PRs with unsigned commits will be asked
to amend (`git rebase --signoff` fixes a whole branch).

## Development Setup

**Prerequisites:** Node 18+ (see `.nvmrc`), the Supabase CLI, Docker (for
local Supabase), and Deno (for edge functions).

```bash
# 1. Clone and install
git clone https://github.com/digitxbv/envmanager.git
cd envmanager
npm install

# 2. Configure env
cp .env.example .env   # fill in local Supabase + (optional) self-host values

# 3. Start local Supabase (Postgres, Auth, Studio)
supabase start

# 4. Apply migrations
supabase db reset

# 5. Serve edge functions locally (required for integrations/validation)
supabase functions serve --no-verify-jwt

# 6. Run the app (frontend on http://localhost:4400)
npm run dev
```

Self-hosting uses the operator flag `EM_SELF_HOSTED=true`. The full database
schema (including billing tables) ships in this public repo but is inert when
self-hosted; Stripe edge functions and billing UI are not part of the public
repo.

Local development ports:

| Service | Port | URL |
|---------|------|-----|
| Nuxt Frontend | 4400 | http://localhost:4400 |
| Supabase API | 54431 | http://127.0.0.1:54431 |
| Postgres | 54432 | postgresql://postgres:postgres@127.0.0.1:54432/postgres |
| Supabase Studio | 54433 | http://127.0.0.1:54433 |
| Mailpit | 54434 | http://127.0.0.1:54434 |

## Pull Request Rules

1. **Open an issue first** for anything non-trivial, so we can align on
   approach before you build.
2. **One logical change per PR.** Keep diffs focused and reviewable.
3. **Sign off every commit** (DCO, above).
4. **Tests pass.** Run `npm test` and, for changes affecting the core flow,
   the baseline E2E test:
   `npx playwright test tests/e2e/full-flow-signup-onboarding-variables.spec.ts`.
   The baseline E2E test must pass and must not be modified.
5. **Follow existing patterns.** Use the Supabase JS client composables for
   all DB/auth/storage operations — do not add custom API endpoints for
   Supabase resources. Match the existing code style (factory functions,
   Pinia, Tailwind design tokens).
6. **Update docs** for user-facing changes.
7. **Database changes** go through migrations (`supabase migration new`), not
   `db push`. Regenerate types after schema changes:
   `supabase gen types --local > types/database.types.ts`.
8. **No secrets in commits.** A gitleaks check runs in CI; never commit real
   credentials.

## Commit Messages

We use Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`,
`test:`). The scope is optional, e.g. `feat(cli): add run command`.

## Reporting Bugs / Requesting Features

Use GitHub Issues. For security vulnerabilities, follow `SECURITY.md` instead
(private disclosure) — do not file public issues for security problems.
