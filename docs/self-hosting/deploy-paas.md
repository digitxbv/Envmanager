# Self-hosting: Deploy on Coolify or Dokploy

[Coolify](https://coolify.io) and [Dokploy](https://dokploy.com) are self-hosted PaaS layers over Docker + Traefik. This guide deploys EnvManager on either one. For plain Docker Compose, see [install.md](./install.md); for every environment variable, see [configuration.md](./configuration.md).

> **Read this first — do not use Nixpacks.** Both platforms default new git resources to the **Nixpacks** build pack. Nixpacks sees the repo and auto-detects it wrong (it builds the CLI, not the app) and the deploy fails with `Module not found ".../packages/cli/src/lib/client.js"`. You must pick **Docker Compose** or **Dockerfile** as the build pack — see below.

## Choose your shape

| Shape | What it deploys | Use when |
|---|---|---|
| **A — Docker Compose (recommended)** | The whole stack: bundled Supabase (Postgres, Auth, REST, Realtime, Storage, edge functions, Kong gateway) **+** the app, from `docker-compose.yml`. | You want a complete, self-contained instance. |
| **B — Dockerfile only** | Just the Nuxt app, from `Dockerfile`. You point it at an **external** Supabase (managed Supabase project, or a Supabase you already run). | You already have Supabase and only need the app. |

Both shapes need the same secrets generated once:

```bash
openssl rand -base64 32   # run several times: JWT_SECRET, SECRET_KEY_BASE, POSTGRES_PASSWORD, VAULT_ENC_KEY, CRON_SECRET
```

`ANON_KEY` and `SERVICE_ROLE_KEY` are JWTs signed with your `JWT_SECRET` — generate them with the Supabase self-host key tool (<https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys>) using the same `JWT_SECRET`.

---

## The one networking fact that bites everyone

The self-hosted app is a **SPA (`ssr: false`)** — the browser talks to Supabase directly. So the Supabase **gateway (Kong) must be reachable on a public URL**, not just the app. With Shape A you publish **two** domains:

| Service | Domain example | The env var that must equal it |
|---|---|---|
| `app` (port 3000) | `https://env.yourco.com` | `NUXT_PUBLIC_SITE_URL` |
| `kong` (port 8000) | `https://supabase.yourco.com` | `SUPABASE_PUBLIC_URL`, `API_EXTERNAL_URL` |

If `SUPABASE_PUBLIC_URL` points at an internal hostname (`http://kong:8000`), the browser can't reach it and login fails. It must be the public gateway domain.

---

## Shape A — Docker Compose

### Coolify

1. **New Resource → Docker Compose** (under "Git Based"). Connect your repo and pick the branch.
2. **Build Pack: Docker Compose.** Set **Docker Compose Location** to `/docker-compose.yml`. Coolify parses the services.
3. **Environment Variables** tab — add everything from `configuration.md` (Required groups + any optional integrations). These feed the `${...}` interpolation in the compose file, so the names must match exactly. Minimum: `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `POSTGRES_HOST`, `JWT_SECRET`, `SECRET_KEY_BASE`, `VAULT_ENC_KEY`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `CRON_SECRET`, `DASHBOARD_USERNAME`, `DASHBOARD_PASSWORD`, `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=3000`, `EM_SELF_HOSTED=true`, `NUXT_PUBLIC_APP_NAME`, plus the three URL vars below.
   - `NUXT_PUBLIC_SITE_URL` = app domain
   - `SUPABASE_PUBLIC_URL` = gateway domain
   - `API_EXTERNAL_URL` = gateway domain
   - `NUXT_PUBLIC_SITE_URL` is also a **build arg** (the app bakes the cookie `Secure` flag from it) — tick **"Build Variable"** on it so it's passed at build time.
4. **Domains** — assign the app domain to the `app` service and the gateway domain to the `kong` service (Coolify shows a domain field per service). Coolify/Traefik handles TLS via Let's Encrypt.
5. **Deploy.** First boot runs `db-init` (applies all migrations + the self-host bootstrap) before `app` starts; watch logs until `app` is healthy.

### Dokploy

1. **Create Project → Create Service → Compose.**
2. **Provider: Git**, connect the repo + branch, set **Compose Path** to `docker-compose.yml`.
3. **Environment** tab — paste the same variables as the Coolify list above (Dokploy injects them into compose interpolation).
4. **Domains** — add a domain for the `app` service (container port `3000`) and one for the `kong` service (container port `8000`).
5. **Deploy** and watch logs for `db-init` → `app` healthy.

> **Persistence (both):** the compose declares named volumes (`db-config`, `deno-cache`) and bind-mounts `./volumes/db/data` for Postgres. `db-config` and the DB data dir hold the **Vault encryption key material** — back them up together, or secrets become undecryptable. See [vault-and-backups.md](./vault-and-backups.md). On Coolify/Dokploy, confirm these map to persistent storage, not ephemeral container layers.

---

## Shape B — Dockerfile only (external Supabase)

Use this when Supabase already exists elsewhere. The repo's `Dockerfile` builds only the Nuxt app and **bakes the public Supabase config into the client bundle at build time**, so those vars must be set as **build args**, not just runtime env.

### Coolify

1. **New Resource → Private/Public Repository.** Connect repo + branch.
2. **Build Pack: Dockerfile** (Dockerfile path `/Dockerfile`).
3. **Port: `3000`** (the Dockerfile's `EXPOSE`/healthcheck port).
4. **Environment Variables** — add and tick **"Build Variable"** on the ones the Dockerfile consumes as `ARG`: `EM_SELF_HOSTED=true`, `SUPABASE_URL`, `SUPABASE_KEY`, `NUXT_PUBLIC_SITE_URL`, and any of `POSTHOG_PUBLIC_KEY`, `POSTHOG_HOST`, `NUXT_PUBLIC_GITHUB_APP_NAME`, `NUXT_PUBLIC_GITHUB_CLIENT_ID`, `NUXT_PUBLIC_COOKIEBOT_CBID` you use. Point `SUPABASE_URL`/`SUPABASE_KEY` at your external Supabase API URL + anon key.
5. Assign a domain to the resource and deploy.

### Dokploy

1. **Create Project → Create Service → Application.**
2. **Provider: Git** (repo + branch), **Build Type: Dockerfile**, path `Dockerfile`.
3. Add the same **build-time** args under the build/args section and runtime env as above; set the domain to container port `3000`.
4. Deploy.

---

## Upgrading

Push a new commit / pin a release tag and redeploy from the platform UI. Because client-facing vars are **baked at build time**, changing `NUXT_PUBLIC_*` or `SUPABASE_*` requires a **rebuild**, not just a restart. Migrations re-run via `db-init` (Shape A) on each deploy and are idempotent. Full procedure and rollback: [upgrade.md](./upgrade.md).

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Build fails on `deno cache .../packages/cli/...` | Build pack is **Nixpacks** (auto-detected Deno). | Switch build pack to **Docker Compose** or **Dockerfile**. |
| App loads but login/data calls fail in the browser | `SUPABASE_PUBLIC_URL` is an internal host. | Set it (and `API_EXTERNAL_URL`) to the **public** Kong gateway domain. |
| Secrets unreadable after a restart/redeploy | Vault key volume wasn't persisted. | Ensure `db-config` + DB data dir are on persistent storage; see [vault-and-backups.md](./vault-and-backups.md). |
| `app` never goes healthy | `db-init` didn't complete (bad `POSTGRES_PASSWORD`/`DATABASE_URL`). | Check `db-init` logs; it must exit successfully before `app` starts. |
