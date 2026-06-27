# Vault Encryption & Backups

**Version**: 1.0  
**Last Updated**: June 26, 2026

This guide explains how EnvManager encrypts secrets, where the encryption keys are stored, and why backups are critical for self-hosted deployments.

## Overview

EnvManager uses **Supabase Vault** to encrypt secret environment variables. Vault is built on PostgreSQL's `pgsodium` extension and manages encryption key material within the Postgres database itself — not as a plain environment variable.

**Critical Point**: The Postgres data volume (`./volumes/db/data`) holds the Vault key material and is **required to decrypt existing secrets**. Losing this volume means losing access to all encrypted secrets.

## How Vault Encryption Works

### Encryption Flow

1. **When you create/update a secret variable**:
   - The app sends the plaintext secret value to the backend
   - A PostgreSQL trigger function calls `vault.create_secret()` or `vault.update_secret()`
   - Vault encrypts the value using its internal encryption key (managed by pgsodium)
   - The encrypted secret is stored in the `vault.secrets` table
   - The `variables` table stores only a reference (`vault_secret_id`) and metadata

2. **When you decrypt a secret**:
   - The app requests the variable via RPC function `decrypt_variable_value(variable_id)`
   - This function retrieves the encrypted secret from `vault.secrets` using the `vault_secret_id`
   - Vault decrypts it automatically using the stored key material
   - The plaintext value is returned only to authorized users (via RLS policies)

### Key Storage

- **Encryption key location**: Inside the Postgres data volume, managed by pgsodium
- **Key format**: Internal to Postgres; the operator does NOT manually manage this key
- **Access**: Only accessible from within the Postgres container; never exposed to the app or env vars

The pinned image `supabase/postgres:15.8.1.085` includes Vault and pgsodium pre-configured. Some image versions honor a `VAULT_ENC_KEY` environment variable to restore an existing key during startup — check your pinned image's documentation to verify whether it consumes this variable.

## Backup Requirements

### Why a Logical `pg_dump` is NOT Enough

A plain PostgreSQL logical dump (`pg_dump`) exports:
- Table schemas
- Non-secret variable values
- Encrypted secret rows from `vault.secrets` (but as opaque encrypted blobs)

**It does NOT export**:
- The pgsodium/Vault key material needed to decrypt those blobs
- Postgres system catalogs that Vault depends on

**Result**: If you restore a `pg_dump` into a fresh Postgres container, the `vault.secrets` table is there, but the encryption key is gone or different, and all secrets become unrecoverable.

### What You Must Back Up

Back up the **entire Postgres data volume** (`./volumes/db/data`) to ensure Vault's key material is included.

Two approaches:

#### 1. Filesystem Snapshot (Recommended for Self-Hosted)
- Stop the container: `docker compose down` (NOT `-v`)
- Take a snapshot of `./volumes/db/data` using your host's backup tool (e.g., `tar`, `rsync`, cloud snapshots)
- Keep snapshots in a secure, geographically separated location
- To restore: replace the volume with your snapshot and restart

**Example**:
```bash
# Back up the volume
docker compose down
tar -czf postgres_backup_$(date +%Y%m%d_%H%M%S).tar.gz ./volumes/db/data/
# Keep the tarball safe (e.g., upload to S3 with encryption)

# To restore from backup
docker compose down
rm -rf ./volumes/db/data/
tar -xzf postgres_backup_YYYYMMDD_HHMMSS.tar.gz
docker compose up -d
```

#### 2. PostgreSQL `pg_basebackup` (Streaming Backup)
- Use `pg_basebackup` from a running cluster to capture the entire data directory while Postgres is online
- This is more complex but allows continuous/incremental backups

For most self-hosted deployments, **filesystem snapshots are simpler and sufficient**.

### Backup Frequency

- **Daily automated snapshots** are recommended for production
- **Before major maintenance** (schema changes, upgrades, migrations)
- **After each significant data change** (e.g., bulk imports of secrets)

## Verification: Vault Round-Trip on First Deploy

After deploying EnvManager to a new environment, verify that the Vault encryption round-trip works correctly. **Run these checks on first deploy to confirm the setup is sound.**

### Step 1: Inspect Vault Extensions

Connect to the database and verify Vault and pgsodium are installed:

```bash
docker compose exec db psql -U postgres -d postgres -c "\dx" | grep -E 'vault|pgsodium'
```

You should see output like:
```
 public | pgsodium  | schema  | ...
 public | vault     | schema  | ...
```

### Step 2: Check Key Material is Present

Verify that pgsodium has initialized its key:

```bash
docker compose exec db psql -U postgres -d postgres -c "SELECT * FROM pgsodium.key LIMIT 1;"
```

You should see at least one row with a key ID and key material. If the result is empty, Vault is not properly initialized.

### Step 3: Create a Test Secret and Verify Persistence

1. **Create a secret via the app or database**:
   ```bash
   docker compose exec db psql -U postgres -d postgres -c "
   INSERT INTO vault.secrets (secret) VALUES (pgp_sym_encrypt('test-secret-value', pgsodium.crypto_pwhash_str('test')));
   "
   ```
   Note the returned UUID (e.g., `1234-5678-90ab-cdef`).

2. **Decrypt immediately** (should work):
   ```bash
   docker compose exec db psql -U postgres -d postgres -c "
   SELECT pgp_sym_decrypt(secret::bytea, pgsodium.crypto_pwhash_str('test')) 
   FROM vault.secrets 
   WHERE id = '1234-5678-90ab-cdef';
   "
   ```
   You should see `test-secret-value`.

3. **Stop and restart the stack** (preserving the volume):
   ```bash
   docker compose down
   docker compose up -d
   ```

4. **Decrypt again** (should still work):
   ```bash
   docker compose exec db psql -U postgres -d postgres -c "
   SELECT pgp_sym_decrypt(secret::bytea, pgsodium.crypto_pwhash_str('test')) 
   FROM vault.secrets 
   WHERE id = '1234-5678-90ab-cdef';
   "
   ```
   If you see `test-secret-value` again, **the Vault round-trip is working correctly** ✓

### Step 4: Verify the Negative (Data Volume is Required)

This test confirms that a fresh volume cannot decrypt old secrets:

1. **Delete the data volume**:
   ```bash
   docker compose down -v
   ```
   ⚠️ **WARNING**: This deletes all data. Only run on a test/staging environment.

2. **Restart the stack** (fresh volume is created):
   ```bash
   docker compose up -d
   ```

3. **Try to decrypt the old secret** (will fail):
   ```bash
   docker compose exec db psql -U postgres -d postgres -c "
   SELECT pgp_sym_decrypt(secret::bytea, pgsodium.crypto_pwhash_str('test')) 
   FROM vault.secrets 
   WHERE id = '1234-5678-90ab-cdef';
   "
   ```
   You should see an error like `pgp_sym_decrypt: corrupt data` or `key not found`. This proves the old key is gone.

4. **Restore from your backup**:
   ```bash
   docker compose down
   rm -rf ./volumes/db/data/
   tar -xzf postgres_backup_YYYYMMDD_HHMMSS.tar.gz
   docker compose up -d
   ```

5. **Decrypt the old secret again** (should work after restore):
   ```bash
   docker compose exec db psql -U postgres -d postgres -c "
   SELECT pgp_sym_decrypt(secret::bytea, pgsodium.crypto_pwhash_str('test')) 
   FROM vault.secrets 
   WHERE id = '1234-5678-90ab-cdef';
   "
   ```
   You should see `test-secret-value` again ✓

## Pinned Image & Key Environment Variables

The docker-compose file pins `supabase/postgres:15.8.1.085` and passes `VAULT_ENC_KEY` to the container:

```yaml
db:
  image: supabase/postgres:15.8.1.085
  environment:
    VAULT_ENC_KEY: ${VAULT_ENC_KEY}
```

**Check your pinned image's documentation** to confirm:
- Whether it consumes `VAULT_ENC_KEY` or `PGSODIUM_KEY` or another variable name
- Whether it uses this variable only at initialization (first startup) or on every restart
- Whether you need to pre-generate and inject this variable, or if pgsodium auto-initializes it

Not all images honor these environment variables. If your pinned image does not support key injection via env var, the key is generated and stored internally on first startup — in this case, **the data volume backup is your only recovery path**.

## Key Rotation (Advanced)

Key rotation for Supabase Vault depends on your pinned image's pgsodium version and capabilities. Supabase's documented key rotation process involves:

1. Creating a new key in pgsodium
2. Decrypting all existing secrets with the old key
3. Re-encrypting them with the new key
4. Switching pgsodium to use the new key as primary

**This is complex and should only be done on a backup copy for testing.** Refer to your pinned image's documentation and Supabase's pgsodium guides before attempting key rotation in production.

## Disaster Recovery Checklist

- [ ] **Weekly**: Verify backup process runs and test restore on a staging copy
- [ ] **Monthly**: Confirm backup snapshots are geographically separated from production
- [ ] **Quarterly**: Perform a full disaster recovery drill (restore to fresh environment, verify all secrets decrypt)
- [ ] **Before any major upgrade**: Create a fresh backup before updating image tags
- [ ] **Never** run `docker compose down -v` in production without an immediately preceding verified backup

## References

- Docker Compose volumes: `./volumes/db/data/` is the Postgres data directory
- Vault RPC function: See `/supabase/migrations/20251020140000_add_vault_encryption.sql`
- Supabase Vault docs: https://supabase.com/docs/guides/database/vault (cloud; self-hosted may vary)
- PostgreSQL pgsodium: https://github.com/michelp/pgsodium
