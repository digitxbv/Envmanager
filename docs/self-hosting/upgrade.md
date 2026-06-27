# Self-hosting: Upgrading

EnvManager ships as a Docker image with database migrations under `supabase/migrations`. Upgrading means pulling a newer app image and applying any new migrations. Always back up first.

## Before you upgrade

1. **Read the release notes** for the target version (the GitHub Releases page). Note any breaking changes or required manual steps.
2. **Back up your database.** This is a full Postgres backup of your Supabase data, which includes the Vault-encrypted secrets.
   ```bash
   # Example for a Postgres backed by Compose; adapt to your setup.
   docker compose exec db pg_dump -U postgres postgres > backup-$(date +%F).sql
   ```
3. **Back up your encryption keys.** Losing them makes encrypted secrets unrecoverable even with a database backup. See [key-management.md](./key-management.md) and [vault-and-backups.md](./vault-and-backups.md) for full backup procedures.

## Upgrade steps

1. Pin the new version. If you use the published image, bump the tag in your Compose override:
   ```yaml
   services:
     app:
       image: ghcr.io/OWNER/envmanager:<NEW_TAG>
   ```
   If you build locally, pull the new source:
   ```bash
   git fetch --tags
   git checkout <NEW_TAG>
   ```
2. Pull / rebuild and restart:
   ```bash
   docker compose pull   # if using a published image
   docker compose up -d --build   # if building locally
   ```
3. **Apply database migrations.** New migrations in `supabase/migrations` must be applied to your database. The shipped Compose stack applies migrations on app startup; verify in the logs:
   ```bash
   docker compose logs -f app
   ```
   If your setup requires running migrations manually, follow the command documented in the release notes for that version.
4. **Verify.** Log in, confirm an existing project loads, and decrypt a known secret to confirm Vault is reachable and the keys are intact.

## Rolling back

If an upgrade fails:

1. Stop the stack: `docker compose down`.
2. Restore the database backup you took before upgrading.
3. Re-pin the previous image tag and `docker compose up -d`.

Because some migrations are not reversible, **the database backup is your real rollback path** — do not skip step 2 of "Before you upgrade".

## Version pinning

Always pin a specific version tag in production (e.g. `ghcr.io/OWNER/envmanager:v1.4.0`) rather than `latest`, so upgrades happen only when you choose. The CLI versions independently as [`@envmanager-cli/cli`](https://www.npmjs.com/package/@envmanager-cli/cli); upgrade it with `npm install -g @envmanager-cli/cli@latest`.
