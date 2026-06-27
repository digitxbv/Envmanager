# Security Policy

We take the security of EnvManager seriously. EnvManager is a secrets
management product, so we hold ourselves to a high bar.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report security issues privately through GitHub's coordinated
disclosure flow:

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability** (this opens a private GitHub Security
   Advisory visible only to you and the maintainers).
3. Include:
   - A description of the vulnerability and its impact.
   - Step-by-step reproduction instructions (or a proof of concept).
   - The affected version, commit, or deployment (self-hosted vs. hosted).
   - Any suggested remediation, if you have one.

If you are unable to use GitHub Security Advisories, email
**security@envmanager.com** with the same details. Encrypt sensitive
details if possible.

## Our Commitment / Response Window

| Stage | Target |
|-------|--------|
| Acknowledge receipt | within **3 business days** |
| Initial assessment & severity triage | within **7 business days** |
| Fix or mitigation for confirmed High/Critical issues | within **30 days** |
| Public disclosure | coordinated with you, after a fix ships |

We will keep you updated throughout, credit you in the advisory (unless you
prefer to remain anonymous), and let you know when a fix is released.

## Supported Versions

Security fixes are provided for the latest released version of the
application and for the two most recent minor releases of the CLI
(`@envmanager-cli/cli`). Older versions are not patched — please upgrade.

| Component | Supported |
|-----------|-----------|
| App (`main` / latest release) | Yes |
| App (older releases) | No — upgrade to latest |
| CLI — latest minor | Yes |
| CLI — previous minor | Yes |
| CLI — older | No — upgrade |

## Scope

In scope: the application, the CLI, the database schema/RLS policies, and
Supabase edge functions in this repository.

Out of scope: vulnerabilities in third-party dependencies that are already
publicly known (report those upstream), denial-of-service via resource
exhaustion on your own self-hosted instance, and findings that require a
compromised host or privileged local access you already control.

## Self-Hosting Note

When self-hosting (`EM_SELF_HOSTED=true`), you are responsible for securing
your own Supabase project, secrets/`.env`, network exposure, and backups.
The threat model assumes a correctly configured Supabase deployment with
Row-Level Security enabled.
