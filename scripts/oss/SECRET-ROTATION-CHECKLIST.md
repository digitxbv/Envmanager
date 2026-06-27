# Secret Rotation Checklist — OSS Cutover

`.env` is gitignored and not tracked, so it will never enter the public repo.
However, `.env` currently holds LIVE production credentials. Anyone with prior
access to this private repo (or its backups) may have seen them. Before the repo
goes public, ROTATE every credential below and update the deployed environment.

| # | Env var | Where to rotate | Where to update after rotation | Done |
|---|---------|-----------------|-------------------------------|------|
| 1 | `GOOGLE_CLIENT_SECRET` | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client → Reset secret | Supabase Auth → Providers → Google; deploy env | [ ] |
| 2 | `SUPABASE_KEY` (anon) | Supabase Dashboard → Project Settings → API → Rotate anon key | App deploy env (`SUPABASE_KEY`), CI secrets | [ ] |
| 3 | `SUPABASE_SECRET_KEY` (service_role) | Supabase Dashboard → Project Settings → API → Rotate service_role key | Server-side deploy env, edge function secrets, CI | [ ] |
| 4 | `POSTHOG_PUBLIC_KEY` | PostHog → Project Settings → rotate project API key (note: public key; lower risk, rotate anyway) | App deploy env, `nuxt.config.ts` runtime config source | [ ] |
| 5 | `POSTHOG_PERSONAL_API_KEY` | PostHog → Account → Personal API Keys → revoke + recreate | CI/scripts that call PostHog API; deploy env | [ ] |
| 6 | `NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → Developers → API keys → roll publishable key | App deploy env (private repo only; not in public) | [ ] |

## Rotation procedure (per credential)
1. Generate the new value in the source system.
2. Update the deployed environment (production secret store / CI secrets) FIRST.
3. Verify the app still works with the new value.
4. Revoke / invalidate the OLD value in the source system.
5. Tick the "Done" box above.

## Sign-off
- [ ] All 6 credentials rotated and verified.
- [ ] `secret-audit.sh` re-run after rotation, exits 0.
- [ ] Approved to proceed with public split: __________ (name / date)
