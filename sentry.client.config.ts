import * as Sentry from '@sentry/nuxt'

const dsn = useRuntimeConfig().public.sentry.dsn as string

const stripFragment = (url?: unknown) =>
  typeof url === 'string' ? url.replace(/#.*$/, '') : url

Sentry.init({
  dsn,
  environment: import.meta.dev ? 'development' : 'production',
  enabled: !import.meta.dev && !!dsn,
  // Never let the URL #fragment reach Sentry — on /share/<id>#<key> it is the secret
  // decryption key. Scrub it from events and navigation breadcrumbs.
  beforeSend(event) {
    if (event.request?.url) event.request.url = stripFragment(event.request.url) as string
    return event
  },
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.data) {
      if (breadcrumb.data.to) breadcrumb.data.to = stripFragment(breadcrumb.data.to)
      if (breadcrumb.data.from) breadcrumb.data.from = stripFragment(breadcrumb.data.from)
      if (breadcrumb.data.url) breadcrumb.data.url = stripFragment(breadcrumb.data.url)
    }
    return breadcrumb
  },
})
