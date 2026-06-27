# Self-hosting: Configuration Reference

EnvManager is configured entirely through environment variables. Copy `.env.example` to `.env` and fill it in. `.env.example` is the authoritative source — this page explains what each group of variables does and which are optional. If a name here differs from `.env.example`, trust `.env.example`.

> **Do not commit `.env`.** It holds the credentials that can read and decrypt your secrets.

## Required — Supabase core

EnvManager stores everything in Supabase (Postgres + Auth + Vault). These connect the app to your Supabase backend (self-hosted Supabase or a Supabase project).

| Variable | Purpose |
|---|---|
| `SUPABASE_PUBLIC_URL` | Base URL of your Supabase instance/project (used by browser clients). |
| `ANON_KEY` | Anon/public key the app uses for client-scoped requests under RLS. |
| `SERVICE_ROLE_KEY` | Service-role key for privileged server-side operations (migrations, admin RPCs). Keep this secret — it bypasses RLS. |

> The exact set/names of Supabase keys depend on your Supabase version; match them to `.env.example`.

## Required — App core

| Variable | Purpose |
|---|---|
| `EM_SELF_HOSTED` | Set to `true`. Marks this as a self-hosted instance and disables SaaS-only behaviour (billing gates, external telemetry, hosted-only nudges). |
| `NUXT_PUBLIC_SITE_URL` | The public URL where your instance is reachable (e.g. `https://env.yourcompany.com`). Used for absolute links, OAuth callbacks, and email links. |
| `JWT_SECRET` | Strong secret for session/JWT signing. Generate with `openssl rand -base64 32` or similar. Keep this secret. |
| `SECRET_KEY_BASE` | Strong secret for cookie signing and session encryption. Generate separately from `JWT_SECRET`. Keep this secret. |
| `HOST` | Network interface to bind to (e.g. `0.0.0.0` to listen on all interfaces). |
| `PORT` | Port the app listens on inside the container (mapped via docker-compose to the host). |
| `NODE_ENV` | Set to `production` for self-hosted deployments. |

## Required — Database

| Variable | Purpose |
|---|---|
| `POSTGRES_HOST` | Hostname of the Postgres server (e.g. `db` when using the bundled Postgres in Compose). |
| `POSTGRES_PORT` | Port Postgres listens on (e.g. `5432`). |
| `POSTGRES_DB` | Database name (e.g. `postgres`). |
| `POSTGRES_PASSWORD` | Strong password for the `postgres` user. Generate with `openssl rand -base64 32` or similar. Keep this secret. |

## Required — Vault encryption

| Variable | Purpose |
|---|---|
| `VAULT_ENC_KEY` | The pgsodium/Vault encryption key material. This encrypts all secrets at rest. See [key-management.md](./key-management.md) for backup and rotation details. Keep this secret and back it up separately from the database. |

## Required — App → Supabase wiring

These connect the app backend to Supabase. They are derived from the core Supabase keys above (`JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`) and are auto-set in the bundled `docker-compose.yml`. If you use an external Supabase or override `DATABASE_URL`, set them explicitly.

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Base URL of Supabase (internal service-to-service). For bundled setup: `http://kong:8000`. For external Supabase: your instance's API URL. |
| `SUPABASE_KEY` | Anon key for app client-side calls. Usually copied from `ANON_KEY`. |
| `SUPABASE_SECRET_KEY` | Service-role key for app server-side operations. Usually copied from `SERVICE_ROLE_KEY`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Same as `SUPABASE_SECRET_KEY` (kept for compatibility). |
| `SUPABASE_JWT_SECRET` | JWT signing secret. Usually copied from `JWT_SECRET`. |

## Required — App configuration

| Variable | Purpose |
|---|---|
| `NUXT_PUBLIC_APP_NAME` | Display name for the app (e.g. `EnvManager`). |

## Recommended — Cron / Webhook security

| Variable | Purpose |
|---|---|
| `CRON_SECRET` | Secret token for triggering cron jobs / webhooks. Generate with `openssl rand -base64 32`. Keep this secret. Recommended for security; leave blank only if you trust your network. |

## Optional — GitHub (integration + social login)

Needed only if you want the **GitHub integration** (sync to Actions secrets/variables) or GitHub social login. Leave blank otherwise. All GitHub variables must be set together; partial configuration will not work.

| Variable | Purpose | Type |
|---|---|---|
| `NUXT_PUBLIC_GITHUB_APP_NAME` | Name of your GitHub App (used in install URLs). | Public |
| `NUXT_PUBLIC_GITHUB_CLIENT_ID` | OAuth client ID of your GitHub App. | Public |
| `GITHUB_APP_ID` | GitHub App ID (server-side). | Private — Keep secret. |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App private key in PEM format (server-side). | Private — Keep secret. |
| `GITHUB_WEBHOOK_SECRET` | Secret for validating GitHub webhook signatures. | Private — Keep secret. |

For step-by-step credential setup (where to find these in the GitHub App settings, how to generate the private key), see [bring-your-own-credentials.md](./bring-your-own-credentials.md).

## Optional — Email / SMTP (transactional email)

Needed for invitation, password-reset, and notification emails. Without SMTP configured, these emails will not be delivered.

| Variable | Purpose |
|---|---|
| `MAILGUN_API_KEY` | API key for Mailgun (or your mail service). Keep secret. |
| `MAILGUN_DOMAIN` | Domain configured in your Mailgun account. |
| `MAILGUN_FROM_EMAIL` | The From address for outbound mail (e.g. `noreply@env.example.com`). |
| `MAILGUN_REGION` | Mailgun region (`us` or `eu`). |

For credential setup and configuration details, see [bring-your-own-credentials.md](./bring-your-own-credentials.md).

## Optional — OAuth providers

If you want social login beyond GitHub (e.g. Google, Microsoft), configure those providers in your Supabase Auth settings and set any matching public client IDs as documented in `.env.example`.

| Variable | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth client ID for Google Sign-In (client-side). |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret for Google Sign-In (server-side). Keep secret. |

## Leave blank when self-hosting — SaaS-only

These power the managed cloud and are **not required** to self-host. Leaving them blank is correct.

| Variable group | Why it's blank |
|---|---|
| `STRIPE_*` | Billing/subscriptions — hosted cloud only. |
| `POSTHOG_*` | Product analytics — hosted cloud only. Disabled when `EM_SELF_HOSTED=true`. |
| `SENTRY_*` | Error monitoring — hosted cloud only. |

## Applying changes

After editing `.env`, recreate the app container:

```bash
docker compose up -d
```

For environment variables that are baked at build time (any prefixed for the client bundle), you may need to rebuild the image rather than just restart — see [upgrade.md](./upgrade.md).
