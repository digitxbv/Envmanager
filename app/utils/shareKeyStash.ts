// Holds the one-time-secret decryption key after it has been stripped out of the
// URL #fragment, so the reveal page can use it WITHOUT the key ever remaining in the
// address bar / browser history (where analytics — PostHog/Sentry/GTM — would capture it).
// Auto-imported by Nuxt.
export const shareKeyStash = { value: '' }
