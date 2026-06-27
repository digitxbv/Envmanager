# Self-hosting: Install & Quickstart

This guide gets a self-hosted EnvManager instance running with Docker Compose. For the product user guide (how to use variables, secrets, integrations, etc.), see the hosted docs at <https://docs.envmanager.com>.

## Prerequisites

- A Linux host (or any machine) with **Docker** and **Docker Compose v2** (`docker compose`, not the legacy `docker-compose`).
- ~2 vCPU / 2 GB RAM is enough for a small team; scale up for larger orgs.
- A domain name and TLS termination (reverse proxy such as Caddy, Traefik, or nginx) if you expose it publicly. Run it behind HTTPS — secrets are served over this connection.

## 1. Get the code

```bash
git clone https://github.com/OWNER/envmanager.git
cd envmanager
```

## 2. Configure the environment

```bash
cp .env.example .env
```

Open `.env` and fill in the required values. At minimum you must set:

- The **Supabase** connection URL and keys.
- A strong **app secret** for session/JWT signing.
- `EM_SELF_HOSTED=true`.

The full variable reference (required vs optional, and which SaaS-only variables to leave blank) is in [configuration.md](./configuration.md). Never commit your filled-in `.env` to version control — it contains the credentials that can decrypt your secrets.

## 3. Start the stack

```bash
docker compose up -d
```

This starts the EnvManager app together with its Supabase dependencies as defined in the repository's `docker-compose.yml`. Use `docker compose logs -f` to watch startup.

By default the app is exposed on port **`8080`** (see the `ports:` mapping in `docker-compose.yml`). Point your reverse proxy at that port, or open `http://localhost:8080` for a local trial.

## 4. Use a published image (optional)

The Compose file builds the app locally by default. To run a pinned release instead, override the service image with the published one:

```yaml
# docker-compose.override.yml
services:
  app:
    image: ghcr.io/OWNER/envmanager:<TAG>
```

Browse available tags at `https://github.com/OWNER/envmanager/pkgs/container/envmanager`. Pin a specific version tag in production rather than `latest` so upgrades are deliberate — see [upgrade.md](./upgrade.md).

## 5. First run

1. Open the app and create the first account. The first user creates the first **organization**.
2. Create a **project**, then add **environments** (e.g. development, staging, production).
3. Add variables — mark sensitive ones as **secrets** so they are encrypted in Vault.
4. Invite your team and grant per-environment access. See the role model on the hosted docs site.

If invitations and password-reset emails should be delivered, configure **SMTP** in `.env` (see [configuration.md](./configuration.md)); without it, those emails will not be sent.

## Next steps

- [Configuration reference](./configuration.md) — every environment variable explained.
- [Upgrading](./upgrade.md) — pulling new versions and applying database migrations safely.
- [Key management](./key-management.md) — backing up and protecting the encryption keys that protect your secrets.
