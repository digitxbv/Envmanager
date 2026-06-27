<div align="center">

# EnvManager

**Secure environment variable & secrets management for teams.**

Self-host it, or use the managed cloud. Store regular config and Vault-encrypted secrets, share them with your team under fine-grained roles, sync them to your deploy platforms, and give AI agents access to secrets without ever exposing the values.

[![License: BSL 1.1](https://img.shields.io/badge/license-BSL%201.1-blue.svg)](./LICENSE)
[![CLI on npm](https://img.shields.io/npm/v/%40envmanager-cli%2Fcli?label=%40envmanager-cli%2Fcli)](https://www.npmjs.com/package/@envmanager-cli/cli)
[![Docker image](https://img.shields.io/badge/ghcr.io-envmanager-blue?logo=docker)](https://github.com/digitxbv/envmanager/pkgs/container/envmanager)
[![Built with Nuxt](https://img.shields.io/badge/built%20with-Nuxt%203-00DC82?logo=nuxt.js)](https://nuxt.com)
[![Powered by Supabase](https://img.shields.io/badge/powered%20by-Supabase-3FCF8E?logo=supabase)](https://supabase.com)

[Quickstart](#quickstart) · [Features](#features) · [Self-hosting docs](./docs/self-hosting/install.md) · [Hosted cloud](#hosted-vs-self-hosted) · [Security](./SECURITY.md) · [Contributing](./CONTRIBUTING.md)

</div>

---

<!--
SCREENSHOT PLACEHOLDER
Add a dashboard screenshot here once a public, scrubbed asset exists, e.g.:
![EnvManager dashboard](./docs/assets/screenshot-dashboard.png)
Do NOT use screenshots that contain real secrets, real customer emails, or any
value from a production tenant. See the launch-screenshots scripts for sanitized seed data.
-->

## What is EnvManager?

EnvManager is a multi-tenant web app for storing and distributing the configuration your applications need to run — both plain config values and sensitive secrets (API keys, database URLs, tokens). It gives a team one place to manage variables across projects and environments, with real access control, an audit trail, and one-click sync to the platforms you deploy on.

It is built on **Nuxt 3** (Vue 3 + TypeScript) for the app and **Supabase** (PostgreSQL, Auth, Vault) for storage, authentication, and encryption. Secrets are encrypted at rest server-side using Supabase Vault.

> **Security model — read this:** EnvManager uses **server-side encryption** via Supabase Vault. Secret values are encrypted at rest in the database and decrypted on the server when an authorized user or token requests them. This is **not** a zero-knowledge / end-to-end-encrypted system: the server (and therefore whoever operates it) can decrypt secrets to serve them. If you self-host, *you* are that operator. See [SECURITY.md](./SECURITY.md) and [docs/self-hosting/key-management.md](./docs/self-hosting/key-management.md) for the full threat model and key-handling guidance.

## Features

- **Multi-tenant orgs, projects & environments** — Organize variables by organization, then project, then environment (development / staging / production / custom). Each environment holds its own set of values.
- **Regular & secret variables** — Mark a variable as a secret to have its value encrypted at rest in Supabase Vault; plain config values are stored normally. Secrets are revealed only to authorized users and tokens.
- **Team collaboration with roles** — Invite members to an organization and grant access per environment. Role-based permissions control who can read, edit, or manage variables and who can administer the org.
- **Audit logging** — Every change to a variable is recorded so you can answer "who changed what, when" for compliance and incident response.
- **Row-Level Security data isolation** — Tenant isolation is enforced at the database layer with PostgreSQL RLS (dual-check: organization membership *and* per-environment access), not just in application code.
- **The `envmanager` CLI** — Pull variables into local development, push from `.env` files, run validations, and use templates — all from your terminal. Published as [`@envmanager-cli/cli`](https://www.npmjs.com/package/@envmanager-cli/cli).
- **Agent-safe secret access (`envmanager run`)** — Run a command with secrets injected into its environment (or substituted into `{{VAR}}` placeholders) so AI agents and scripts can *use* secrets without ever seeing the plaintext. Command output is scrubbed of secret values. See the [CLI `run` docs](https://docs.envmanager.com/docs/cli/run).
- **Secure proxy functions** — Generate hosted API proxies that hold a secret server-side and forward requests to a third-party API, so a static site or front-end can call protected endpoints without shipping the key to the browser. Includes config, CORS, rate limiting, testing, and usage analytics.
- **Platform integrations & sync** — Push variables to where you deploy: Vercel, Railway, Render, Dokploy, Coolify, GitHub (Actions secrets/variables), Google Cloud, Azure Key Vault, and AWS Secrets Manager.

> Full end-user documentation for every feature lives on the hosted docs site: **<https://docs.envmanager.com>**. This repository's `docs/` folder covers **operating a self-hosted instance** only.

## Quickstart

You need [Docker](https://docs.docker.com/get-docker/) with Compose v2 (`docker compose`). The bundled Compose stack runs the EnvManager app plus its Supabase dependencies.

```bash
# 1. Clone the repository
git clone https://github.com/digitxbv/envmanager.git
cd envmanager

# 2. Create your environment file from the template and fill in the required values
cp .env.example .env
# Edit .env — at minimum set the Supabase keys and a strong app secret.
# Make sure EM_SELF_HOSTED=true is set.

# 3. Start the stack
docker compose up
```

When the stack is healthy, open the app in your browser. The exact host port is defined in the Compose file shipped with the repo — see [docs/self-hosting/install.md](./docs/self-hosting/install.md) for the port and the first-run steps (creating your first organization and inviting your team).

The app image is published at `ghcr.io/digitxbv/envmanager`. To pin a specific release instead of building locally, set the image tag in your Compose override — see the install guide.

> **Heads-up:** `docker compose up` is the supported one-command path for self-hosting. The `npm run dev` workflow on port 4400 is for *developing EnvManager itself* and is documented in [CONTRIBUTING.md](./CONTRIBUTING.md), not for running it in production.

## Configuration

Configuration is entirely through environment variables. Copy `.env.example` to `.env` and fill it in. The self-host-relevant variables are:

- **Supabase core** — connection URL and keys for the Postgres/Auth/Vault backend.
- **App core** — the public site URL and `EM_SELF_HOSTED=true` (this flag disables SaaS-only behaviour such as billing gates and external telemetry).
- **Optional** — GitHub OAuth/App for the GitHub integration and social login; SMTP for transactional email (invitations, password resets).
- **Leave blank when self-hosting** — Stripe, PostHog, and Sentry variables are for the managed cloud only and are not required to self-host.

The authoritative, fully-commented list of every variable (with which are required vs optional) is in **[`.env.example`](./.env.example)** and explained in **[docs/self-hosting/configuration.md](./docs/self-hosting/configuration.md)**.

Additional operator docs:

- **[Vault encryption & backups](./docs/self-hosting/vault-and-backups.md)** — how Supabase Vault works, key rotation, and backup strategy.
- **[Bring your own credentials](./docs/self-hosting/bring-your-own-credentials.md)** — using your own OAuth apps, SMTP provider, and third-party keys.

## Hosted vs self-hosted

EnvManager is **source-available** — you can run the whole thing yourself. We also offer a **managed cloud** at <https://envmanager.com> for teams who would rather not operate the infrastructure.

| | **Self-hosted** | **Hosted cloud** |
|---|---|---|
| Cost | Free software; you pay for your own infra | Subscription |
| Setup & upgrades | You run `docker compose`, patch, and back up | Managed for you |
| Encryption key custody | You hold and back up the keys | Managed for you |
| Updates & security patches | You pull new images | Automatic |
| Support & SLA | Community (GitHub issues) | Supported |
| Best for | Teams who want full control / data residency | Teams who want it to just work |

Same product either way — the hosted plan is the convenient, supported, managed option (think how Coolify, Plausible, or Sentry offer a cloud alongside the open source). A detailed feature-by-feature comparison lives on our marketing site.

## Documentation

- **Self-hosting (this repo):** [Install](./docs/self-hosting/install.md) · [Configuration](./docs/self-hosting/configuration.md) · [Upgrading](./docs/self-hosting/upgrade.md) · [Key management](./docs/self-hosting/key-management.md) · [Vault & backups](./docs/self-hosting/vault-and-backups.md) · [Bring your own credentials](./docs/self-hosting/bring-your-own-credentials.md)
- **Using the product (hosted docs site):** <https://docs.envmanager.com> — getting started, variables & secrets, environments, team & roles, the CLI, proxy functions, and every platform integration.
- **CLI:** [`@envmanager-cli/cli` on npm](https://www.npmjs.com/package/@envmanager-cli/cli) — install with `npm install -g @envmanager-cli/cli`.

## Tech stack

- **Frontend / app:** Nuxt 3, Vue 3, TypeScript, Tailwind CSS
- **Backend:** Supabase — PostgreSQL, Auth, Vault (encryption), Edge Functions, Row-Level Security
- **CLI:** TypeScript, built with tsup, published to npm

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for the development setup (local Supabase, ports, running tests) and our contribution workflow. Security issues should follow the disclosure process in [SECURITY.md](./SECURITY.md) — please do not open public issues for vulnerabilities.

## License

EnvManager is licensed under the **Business Source License 1.1 (BSL 1.1)**. The source is available and you may run, modify, and self-host it for your own use. The license includes a usage limitation: **you may not offer EnvManager (or a derivative) to third parties as a hosted/managed service that competes with the hosted cloud.** On **2030-01-01** the license converts to **Apache License 2.0**.

See [LICENSE](./LICENSE) for the exact terms, including the Additional Use Grant and the Change Date.
