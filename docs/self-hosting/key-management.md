# Self-hosting: Key Management

EnvManager encrypts secret values **at rest** using **Supabase Vault** (built on `pgsodium`). This page explains what that protects, what it does not, and how to handle the keys responsibly when you operate your own instance.

## What the encryption does and does not protect

- **Encryption at rest:** Secret values are stored encrypted in the database. A raw dump of the secrets table does not reveal plaintext without the Vault encryption key.
- **Server-side decryption:** When an authorized user, token, or proxy requests a secret, the **server decrypts it** to serve it. This is server-side encryption, **not** zero-knowledge or end-to-end encryption — the operator of the instance (you, when self-hosting) can decrypt any secret. Do not represent self-hosted EnvManager to your users as having zero-knowledge or client-side encryption.
- **Access control on top of encryption:** Who can request decryption is governed by authentication and Row-Level Security (organization membership + per-environment access), plus the audit log. Encryption protects the data at rest; RLS controls who can ask for it.

## The keys you must protect

Supabase Vault holds the master encryption key material for your instance. Whoever has that key material plus a database backup can decrypt every secret. Treat it with the same care as the secrets themselves:

- Store the Vault/`pgsodium` key material and your Supabase service-role key out of band — not in the same place as your database backups.
- Restrict access to the host, the database, and the `.env` file. Anyone with the service-role key and database access can read secrets.
- Run the instance over HTTPS so decrypted secrets are not exposed in transit.

## Backups

A database backup is only useful if you can decrypt it later, so **back up the encryption key material together with — but stored separately from — your database backups.**

- If you lose the database but keep the keys: you lose the data.
- If you lose the keys but keep the database: the encrypted secrets are **unrecoverable**.
- Test a restore at least once: restore a backup into a throwaway instance with the key material and confirm a secret decrypts.

For detailed Vault backup and recovery procedures, see [vault-and-backups.md](./vault-and-backups.md). Follow Supabase's documentation for your version on exporting and restoring Vault key material along with the database — see <https://supabase.com/docs/guides/database/vault>.

## Key rotation

Rotating the encryption key is a Supabase Vault / `pgsodium` operation, not an EnvManager-specific feature. Plan rotation as a maintenance window:

1. Back up the database and current key material.
2. Follow the Supabase Vault rotation procedure for your version.
3. Verify that existing secrets still decrypt after rotation before removing old key material.

## Incident response

If you suspect the host, database, or key material is compromised:

1. Treat **all stored secrets as exposed** and rotate them at their source (the third-party providers), not just inside EnvManager.
2. Use the **audit log** to review what was accessed and changed.
3. Rotate the EnvManager Supabase service-role key and any OAuth/App credentials.

See [SECURITY.md](../../SECURITY.md) for the project's overall threat model and how to report a vulnerability in EnvManager itself.
