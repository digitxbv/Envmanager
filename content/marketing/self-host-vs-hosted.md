---
title: Self-Hosted vs Hosted EnvManager
description: EnvManager is open and source-available — run it yourself for free, or let us run it for you. Here's how the self-hosted and hosted cloud options compare.
navigation:
  title: Self-host vs Hosted
---

# Self-Hosted vs Hosted EnvManager

EnvManager is **source-available** — the full application is on GitHub under the Business Source License, and you can run it yourself at no software cost. We also offer a **fully managed cloud** so teams who would rather not run infrastructure can get the same product without the operational work.

Same product, two ways to run it. This page helps you pick.

## At a glance

| | **Self-hosted** | **Hosted cloud** |
|---|---|---|
| **Software cost** | Free (source-available) | Subscription |
| **Who runs it** | You | We do |
| **Setup** | `docker compose up` + your own Supabase | Sign up, start in minutes |
| **Upgrades & patches** | You pull new images and apply migrations | Automatic |
| **Backups** | Your responsibility | Managed, with redundancy |
| **Encryption key custody** | You hold and back up the keys | Managed for you |
| **Uptime / SLA** | Whatever you run | Monitored, supported |
| **Support** | Community (GitHub issues) | Direct support |
| **Data location** | Wherever you host it | Our cloud region |
| **New features** | When you upgrade | As they ship |

## When self-hosting is the right call

Choose self-hosting if you:

- Need full control over where your data lives (data residency / sovereignty).
- Already run Docker and a database and are comfortable operating another service.
- Want to keep the encryption keys entirely in your own custody.
- Want to evaluate, audit, or extend the source.

You get the whole product: orgs, projects, environments, Vault-encrypted secrets, team roles, audit logging, the CLI (including `envmanager run` for agent-safe secret access), proxy functions, and the platform integrations.

> **One thing to understand:** EnvManager uses **server-side encryption** (Supabase Vault), not zero-knowledge encryption. When you self-host, *you* operate the server that can decrypt secrets — so protecting and backing up the encryption keys is on you. We document exactly how to do that.

## When the hosted cloud is the right call

Choose the hosted cloud if you:

- Want it to just work — no Docker, no migrations, no backup strategy to design.
- Prefer automatic upgrades and security patches.
- Want monitored uptime and direct support.
- Would rather spend your time using secrets than operating a secrets manager.

This is the same model you see from Coolify, Plausible, Sentry, and others: the open source is genuinely yours to run, and the cloud is the convenient, supported, managed option.

## Can I move between them?

Yes. The CLI and import/export tooling let you move variables in and out, so you can start self-hosted and migrate to the cloud (or the reverse) without being locked in.

## A note on the license

The self-hosted source is under the **Business Source License 1.1**. You can run, modify, and self-host it for your own team. The license includes one limitation: you may **not** offer EnvManager (or a derivative) to third parties as a hosted service that competes with our cloud. On **2030-01-01** the license converts to **Apache 2.0**. Full terms are in the repository's `LICENSE` file.

---

**Ready to self-host?** Start with the [README and install guide on GitHub](https://github.com/OWNER/envmanager).
**Want it managed?** [Start with the hosted cloud →](/)
