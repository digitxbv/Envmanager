# Bring Your Own Credentials (GitHub App, Google OAuth, SMTP)

**Version**: 1.0  
**Last Updated**: June 26, 2026

This guide explains how to configure optional integrations for a self-hosted EnvManager deployment: GitHub App authentication, Google OAuth, and email delivery via Mailgun. All three integrations are **optional** — the stack boots and runs with all of them blank. Functions read credentials lazily and only fail when an integration is actually invoked.

## Overview

EnvManager's self-hosted deployment supports three optional integrations:

| Integration | Purpose | Behavior When Blank | When Configured |
|---|---|---|---|
| **GitHub App** | OAuth login; webhook-based repo sync | Login and syncing are disabled | Users can login via GitHub; automatic syncing enabled |
| **Google OAuth** | Alternative OAuth login provider | Google login unavailable | Users can login via Google |
| **Mailgun SMTP** | Send invitation and lifecycle emails | Invitations created but not mailed; lifecycle emails skipped | Emails sent automatically to invitees and users |

All three integrations are **inert at boot** — if the environment variables are unset or blank, the services start successfully and log no errors. The code paths that use these credentials only execute when an operator explicitly invokes the corresponding feature (e.g., a user logs in with GitHub, an admin sends an invite).

---

## GitHub App Configuration

### Why GitHub App?

GitHub App enables:
- **OAuth login**: Users can sign into EnvManager using their GitHub account
- **Webhook-based repo sync**: EnvManager automatically syncs environment files from connected GitHub repositories

### Prerequisites

- A GitHub account with permissions to create apps
- Access to your repository settings
- Your EnvManager deployment's public URL (e.g., `https://envmanager.example.com`)

### Step 1: Create a GitHub App

1. Go to GitHub Settings → **Developer Settings** → **GitHub Apps** (or visit `https://github.com/settings/apps`)
2. Click **New GitHub App**
3. Fill in the form:
   - **App name**: `EnvManager` (or your choice)
   - **Homepage URL**: `${NUXT_PUBLIC_SITE_URL}` (e.g., `https://envmanager.example.com`)
   - **Webhook URL**: `${API_EXTERNAL_URL}/functions/v1/github-webhook` (e.g., `https://api.envmanager.example.com/functions/v1/github-webhook`)
   - **Webhook secret**: Generate a strong random string and save it (you'll use it as `GITHUB_WEBHOOK_SECRET`)
   - **Permissions** (minimum required):
     - Repository contents: `Read`
     - Repository webhooks: `Read & write`
   - **Subscribe to events**: Check `Push`, `Repository`
4. Click **Create GitHub App**
5. On the App page, copy:
   - **App ID** → use as `GITHUB_APP_ID`
   - **Client ID** → use as `NUXT_PUBLIC_GITHUB_CLIENT_ID`
   - **Client Secret** → save temporarily (you'll need it for OAuth callback setup)

### Step 2: Generate and Configure Private Key

1. On your GitHub App page, scroll to **Private keys** → **Generate a private key**
2. GitHub downloads a `.pem` file
3. Open the `.pem` file and extract the key content (from `-----BEGIN RSA PRIVATE KEY-----` to `-----END RSA PRIVATE KEY-----`)
4. **Convert the PEM to single-line format** by replacing literal newlines with `\n`:
   ```bash
   # Linux/macOS
   cat your_private_key.pem | sed ':a;N;$!ba;s/\n/\\n/g' | pbcopy
   # The output is copied to clipboard; paste into GITHUB_APP_PRIVATE_KEY
   ```
   Or use a simple find-replace in your editor to replace actual newlines with `\n`
5. Set `GITHUB_APP_PRIVATE_KEY` to this single-line value in `.env`

### Step 3: Configure OAuth Callback

GitHub needs to know where to send users after they authorize. The callback is typically handled by GoTrue (Supabase Auth):

- **Authorized callback URL**: `${API_EXTERNAL_URL}/auth/v1/callback` (e.g., `https://api.envmanager.example.com/auth/v1/callback`)
  - This is configured in the GitHub App settings under **OAuth** → **Authorization callback URL**

### Step 4: Set Environment Variables

In your `.env` file, set:

```bash
# GitHub App credentials (all required for GitHub integration to work)
NUXT_PUBLIC_GITHUB_APP_NAME=EnvManager                    # Your app name (used in UI)
NUXT_PUBLIC_GITHUB_CLIENT_ID=<your-client-id>            # From GitHub App page
GITHUB_APP_ID=<your-app-id>                              # From GitHub App page
GITHUB_APP_PRIVATE_KEY=<single-line-pem-with-\n>         # Converted to single line
GITHUB_WEBHOOK_SECRET=<your-webhook-secret>              # From Step 1
```

### Verification

After deployment:
1. Navigate to EnvManager's login page
2. You should see a "Login with GitHub" button
3. Click it and confirm the GitHub OAuth flow completes without errors
4. If you see an error page, check the edge functions logs:
   ```bash
   docker compose logs functions | grep -i github
   ```

---

## Google OAuth Configuration

### Why Google OAuth?

Google OAuth provides an alternative login provider, allowing users who prefer their Google account to authenticate without creating separate credentials.

### Prerequisites

- A Google Cloud account
- Access to Google Cloud Console
- Your EnvManager deployment's public URL

### Step 1: Create a Google OAuth App

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Navigate to **Credentials** → **Create Credentials** → **OAuth client ID**
4. Choose **Web application**
5. Add authorized redirect URIs:
   - `${API_EXTERNAL_URL}/auth/v1/callback` (e.g., `https://api.envmanager.example.com/auth/v1/callback`)
6. Click **Create**
7. Copy:
   - **Client ID** → use as `GOOGLE_CLIENT_ID`
   - **Client Secret** → use as `GOOGLE_CLIENT_SECRET`

### Step 2: Set Environment Variables

In your `.env` file, set:

```bash
# Google OAuth credentials (both required for Google login to work)
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>
```

### How It Works

When `GOOGLE_CLIENT_ID` is set (non-empty), GoTrue automatically enables the Google provider:
- `GOTRUE_EXTERNAL_GOOGLE_ENABLED: ${GOOGLE_CLIENT_ID:+true}` (shell expansion in compose)
- If `GOOGLE_CLIENT_ID` is blank, this evaluates to empty and Google login is disabled
- The value of the secret is ignored for this boolean check; only the presence of the client ID matters

### Verification

After deployment:
1. Navigate to EnvManager's login page
2. You should see a "Login with Google" button
3. Click it and confirm the Google OAuth flow completes without errors
4. If you see an error, check the auth service logs:
   ```bash
   docker compose logs auth | grep -i google
   ```

---

## Email Configuration (Mailgun)

### Why Email?

Email delivery enables:
- **Invitation notifications**: When an admin invites a user, the invitee receives an email with the invitation link
- **Lifecycle emails**: Onboarding emails, usage alerts, and other transactional messages
- **Contact form**: Automated responses to inquiries sent via your website

**Without Mailgun configured**, invitations are still created, but they must be shared manually (the operator copies the link from the UI and sends it). Lifecycle emails are skipped silently.

### Prerequisites

- A Mailgun account (free tier available)
- A verified domain or Mailgun sandbox domain
- SMTP credentials from Mailgun

### Step 1: Set Up Mailgun

1. Go to [Mailgun Dashboard](https://app.mailgun.com)
2. Verify or create a domain (e.g., `noreply.envmanager.example.com`)
3. Navigate to **Domain Settings** → **SMTP Credentials** (or **API Keys**)
4. Copy:
   - **API Key** → use as `MAILGUN_API_KEY`
   - **Domain** → use as `MAILGUN_DOMAIN` (e.g., `mg.envmanager.example.com`)

### Step 2: Determine Your Region

Mailgun provides separate API endpoints for US and EU regions:
- **EU**: `api.eu.mailgun.net` (use `MAILGUN_REGION=eu`)
- **US**: `api.mailgun.net` (use `MAILGUN_REGION=us`)

Choose the region closest to your data residency requirements or Mailgun account.

### Step 3: Set Environment Variables

In your `.env` file, set:

```bash
# Mailgun SMTP configuration (all required for email delivery)
MAILGUN_API_KEY=<your-api-key>                           # From Mailgun Dashboard
MAILGUN_DOMAIN=<your-domain>                             # e.g., mg.envmanager.example.com
MAILGUN_FROM_EMAIL=EnvManager <noreply@example.com>     # Sender address (must match domain)
MAILGUN_REGION=eu                                        # 'eu' or 'us'
```

**Important**: The `MAILGUN_FROM_EMAIL` must use a domain that matches your verified Mailgun domain, otherwise Mailgun will reject the emails as unauthenticated.

### Verification

After deployment, invite a user:
1. Navigate to Settings → Team → Invite User
2. Enter an email address and click **Send Invite**
3. Check the invitee's inbox (and spam folder) for the invitation email
4. If no email arrives, check the edge function logs:
   ```bash
   docker compose logs functions | grep -i mailgun
   ```

---

## All-Optional Bootstrap: Blank = Inert

### Why All Three Are Optional

The EnvManager stack is designed for operators who may not need all integrations immediately. For example:

- A self-hosted deployment in a private network may only use local password authentication and manual invitation links
- A deployment may use GitHub OAuth but not Mailgun (invitations shared manually via links)
- An operator might enable Mailgun later after initial testing

### How Blank Variables Are Handled

1. **At boot time**: Services check only that their required non-optional variables are set (e.g., database password, JWT secret). Optional variables like `GITHUB_APP_ID` are NOT checked.
2. **At runtime**: When an edge function needs an optional credential (e.g., `GITHUB_APP_PRIVATE_KEY`), it calls `Deno.env.get('VARIABLE_NAME')`, which returns `undefined` if unset.
3. **In the function**: The function checks if the credential is present:
   ```typescript
   const appId = Deno.env.get('GITHUB_APP_ID')
   const privateKey = Deno.env.get('GITHUB_APP_PRIVATE_KEY')
   
   if (!appId || !privateKey) {
     // GitHub integration is not configured; return a user-friendly error
     return errorResponse('GitHub integration not configured')
   }
   ```

This approach ensures:
- **No boot failures** from missing optional credentials
- **Graceful degradation**: Features depending on missing credentials fail at invocation time with helpful error messages
- **No silent failures**: Logs show `[GitHub integration not configured]` when a user tries to login with GitHub but the app is unconfigured

### Example: Starting with No Integrations

1. Deploy with blanks for `GITHUB_APP_ID`, `GOOGLE_CLIENT_ID`, and `MAILGUN_API_KEY`
2. The stack starts normally
3. Users can still:
   - Sign up / login with email/password
   - Create projects and add variables
   - Invite team members (invitations created, but not emailed)
4. Later, configure GitHub OAuth and redeploy — users can then login with GitHub
5. Even later, configure Mailgun — invitations are now automatically emailed

---

## Verification Checklist: First Deploy

After deploying EnvManager with any credentials configured, run these checks:

### 1. Services Are Healthy

```bash
docker compose ps
# Expected: all services show "healthy" or "running"
```

### 2. Check for Startup Errors (Optional Variables)

```bash
docker compose logs functions | head -50
# Should NOT show crashes related to missing GITHUB_APP_ID, MAILGUN_API_KEY, etc.
# Only errors if you set a variable to a malformed value
```

### 3. Test One Authentication Path (Cheapest Option)

Choose **one** of these based on what you've configured:

#### Option A: Email/Password Signup (Always Works)
1. Open EnvManager in your browser
2. Click **Sign Up**
3. Fill in email and password
4. Confirm signup succeeds
5. You should see the dashboard

#### Option B: GitHub OAuth (If Configured)
1. Open EnvManager in your browser
2. Click **Login** → **Login with GitHub**
3. Authorize the GitHub App when prompted
4. You should be redirected back to EnvManager and logged in
5. If you see an error, check: `docker compose logs functions | grep github-oauth-callback`

#### Option C: Invitation Link (If Mailgun Configured)
1. Create a second test user via email/password
2. Log in as the first user
3. Go to Settings → Team → Invite User
4. Invite the second user's email
5. Check the invitee's inbox for the invitation email
6. Click the link and accept the invitation
7. Verify the invitee can now see the organization

**You only need to test one path.** If it works, the integration layer is correctly wired.

### 4. Check Logs If Something Fails

Most failures appear in the edge functions logs:
```bash
docker compose logs functions -f  # Follow logs; press Ctrl+C to stop
```

Or check auth logs for Google OAuth issues:
```bash
docker compose logs auth -f
```

---

## Troubleshooting

### GitHub OAuth: "GitHub integration not configured"

**Cause**: `GITHUB_APP_ID` or `GITHUB_APP_PRIVATE_KEY` is missing or malformed.

**Fix**:
1. Verify both variables are set in `.env`
2. Check that `GITHUB_APP_PRIVATE_KEY` is single-line (no literal newlines, only `\n` escapes)
3. Redeploy: `docker compose down && docker compose up -d`
4. Check logs: `docker compose logs functions | grep github`

### Google OAuth: "Google login not available" or blank button

**Cause**: `GOOGLE_CLIENT_ID` is blank or `GOOGLE_CLIENT_SECRET` doesn't match.

**Fix**:
1. Verify `GOOGLE_CLIENT_ID` is set and non-empty
2. Check `GOOGLE_CLIENT_SECRET` matches your Google Cloud Console
3. Verify the redirect URI in Google Cloud is exactly `${API_EXTERNAL_URL}/auth/v1/callback`
4. Redeploy: `docker compose down && docker compose up -d`
5. Check logs: `docker compose logs auth | grep google`

### Invitations Not Emailing

**Cause**: `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, or `MAILGUN_FROM_EMAIL` is missing/malformed, or the domain isn't verified in Mailgun.

**Fix**:
1. Verify all four variables are set in `.env`
2. Ensure `MAILGUN_FROM_EMAIL` uses a domain you've verified in Mailgun
3. Test your Mailgun credentials via curl:
   ```bash
   curl --user "api:YOUR_MAILGUN_API_KEY" \
     https://api.eu.mailgun.net/v3/YOUR_DOMAIN/messages \
     -F from='Test <noreply@yourdomain>' \
     -F to='your-email@example.com' \
     -F subject='Test' \
     -F text='Hello'
   ```
4. Check logs: `docker compose logs functions | grep mailgun`

### Email Sent But Not Received

1. Check invitee's **spam folder** (emails may be flagged as spam initially)
2. Verify the sender address is your Mailgun domain
3. Ask Mailgun support to verify your domain isn't on spam lists

---

## Reference: Environment Variables

Below is the complete list of optional integration variables. Unset these in `.env` to disable the corresponding feature:

```bash
# ==========================================
# GITHUB APP (All optional; leave blank to disable)
# ==========================================
NUXT_PUBLIC_GITHUB_APP_NAME=EnvManager
NUXT_PUBLIC_GITHUB_CLIENT_ID=<your-client-id>
GITHUB_APP_ID=<your-app-id>
GITHUB_APP_PRIVATE_KEY=<single-line-pem-with-\n>
GITHUB_WEBHOOK_SECRET=<your-webhook-secret>

# ==========================================
# GOOGLE OAUTH (All optional; leave blank to disable)
# ==========================================
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>

# ==========================================
# MAILGUN SMTP (All optional; leave blank to disable)
# ==========================================
MAILGUN_API_KEY=<your-api-key>
MAILGUN_DOMAIN=<your-domain>
MAILGUN_FROM_EMAIL=EnvManager <noreply@example.com>
MAILGUN_REGION=eu  # or 'us'
```

---

## See Also

- [Vault Encryption & Backups](./vault-and-backups.md) — Protecting secret values at rest
- [Self-Hosting Deployment](./README.md) — Full setup guide (if available)
