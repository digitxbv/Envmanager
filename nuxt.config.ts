import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const vueSonnerCSS = resolve(__dirname, 'node_modules/vue-sonner/lib/index.css')

// Social crawlers (X/Twitter, LinkedIn, Slack) require ABSOLUTE og:image URLs
const siteUrl = process.env.NUXT_PUBLIC_SITE_URL || 'https://envmanager.com'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: false },

  // Self-hosted builds ship as a SPA (ssr: false): the OSS subset has no
  // marketing/SEO pages, the app is entirely client-side against Supabase, and
  // SPA mode lets the browser drive everything via the runtime public URL —
  // so the public image needs no build-time Supabase values. The SaaS build
  // (EM_SELF_HOSTED unset) keeps SSR for marketing/SEO.
  ssr: process.env.EM_SELF_HOSTED !== 'true',

  plugins: [
    '~/plugins/posthog.client.ts',
  ],
  
  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxtjs/supabase',
    '@vueuse/nuxt',
    '@nuxtjs/color-mode',
    '@nuxt/content',
    '@nuxt/icon',
    '@pinia/nuxt',
    '@nuxt/fonts',
    'vue-sonner/nuxt',
    '@sentry/nuxt/module',
    '@nuxtjs/sitemap',
  ],

  site: {
    url: process.env.NUXT_PUBLIC_SITE_URL || 'https://envmanager.com',
    name: 'EnvManager',
  },

  sitemap: {
    // Dynamic [platform] routes — keep in sync with app/pages/integrations/[platform].vue
    urls: [
      '/integrations/github',
      '/integrations/vercel',
      '/integrations/railway',
      '/integrations/render',
      '/integrations/dokploy',
      '/integrations/coolify',
    ],
    sources: [
      '/api/_sitemap-blog-urls',
    ],
    sitemaps: false,
    autoLastmod: true,
    xsl: false,
  },

  components: [
    {
      path: '~/components',
      pathPrefix: false,
    },
  ],
  
  colorMode: {
    classSuffix: '',
    preference: 'system',
    fallback: 'dark',
  },
  icon: {
    clientBundle: {
      scan: true,
      icons: [
        'logos:github-icon', 'logos:vercel-icon',
        'simple-icons:railway', 'simple-icons:render', 'simple-icons:vercel', 'simple-icons:github',
        'lucide:server', 'lucide:cloud', 'lucide:folder', 'lucide:layers', 'lucide:building',
        'lucide:sun', 'lucide:moon',
        'lucide:shield', 'lucide:check-square', 'lucide:scroll-text', 'lucide:target',
        'lucide:git-branch', 'lucide:users', 'lucide:eye-off', 'lucide:zap', 'lucide:refresh-cw',
        'lucide:grid-3x3', 'lucide:file-lock', 'lucide:app-window', 'lucide:link',
        'lucide:shield-check', 'lucide:container', 'lucide:network', 'lucide:lock',
        'lucide:file-code', 'lucide:eye', 'lucide:heart', 'lucide:code', 'lucide:plug',
        'lucide:user-check', 'lucide:smartphone', 'lucide:check-check', 'lucide:message-square',
        'lucide:database', 'lucide:search', 'lucide:terminal', 'lucide:git-fork',
        'lucide:text-cursor-input', 'lucide:file-check', 'lucide:alert-triangle',
        'lucide:key-round', 'lucide:camera', 'lucide:upload-cloud', 'lucide:key',
        'lucide:webhook', 'lucide:brain', 'lucide:file-up', 'lucide:variable',
        'lucide:check-circle', 'lucide:x-circle', 'lucide:circle', 'lucide:circle-dashed',
        'lucide:pencil', 'lucide:building-2', 'lucide:user', 'lucide:case-sensitive',
        'lucide:bell', 'lucide:file-text', 'lucide:box', 'lucide:file-cog',
      ],
    },
  },
  
  supabase: {
    redirectOptions: {
      login: '/auth/login',
      callback: '/auth/callback',
      exclude: ['/', '/auth/*'],
      include: ['/dashboard/**'],
      saveRedirectToCookie: false,
    },
    cookieOptions: {
      maxAge: 60 * 60 * 24 * 2, // 2 days
      sameSite: 'lax',
      // A Secure cookie is dropped by browsers over plain http. Self-hosters may
      // run over http (local/LAN trial), so only force Secure when the site URL
      // is NOT explicitly http:// (https or unknown -> secure). SaaS is always
      // https in production.
      secure: process.env.EM_SELF_HOSTED === 'true'
        ? !(process.env.NUXT_PUBLIC_SITE_URL || '').startsWith('http://')
        : process.env.NODE_ENV === 'production',
    },
    clientOptions: {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    },
  },
  
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'EnvManager - Secure Environment Variable Management',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Secure environment variable management for development teams' },
        // Open Graph defaults
        { property: 'og:site_name', content: 'EnvManager' },
        { property: 'og:type', content: 'website' },
        { property: 'og:image', content: `${siteUrl}/images/og/og-default.png` },
        { property: 'og:image:width', content: '1536' },
        { property: 'og:image:height', content: '1024' },
        // Twitter Card defaults
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:image', content: `${siteUrl}/images/og/og-default.png` },
        { name: 'theme-color', content: '#2cdd6d' },
      ],
      link: [
        { rel: 'manifest', href: '/site.webmanifest?v=20260219' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg?v=20260219' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png?v=20260219' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png?v=20260219' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico?v=20260219' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png?v=20260219' },
      ],
      script: [
        // Cookiebot must load BEFORE GTM to gate consent
        ...(process.env.NUXT_PUBLIC_COOKIEBOT_CBID ? [{
          id: 'Cookiebot',
          src: `https://consent.cookiebot.com/uc.js?cbid=${process.env.NUXT_PUBLIC_COOKIEBOT_CBID}`,
          'data-cbid': process.env.NUXT_PUBLIC_COOKIEBOT_CBID,
          'data-blockingmode': 'auto',
          type: 'text/javascript',
          async: true,
        }] : []),
        // GTM loads after Cookiebot; auto-blocking mode intercepts it pre-consent
        ...(process.env.NUXT_PUBLIC_GTM_ID ? [{
          innerHTML: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${process.env.NUXT_PUBLIC_GTM_ID}');`,
          'data-cookieconsent': 'statistics',
        }] : []),
      ],
      noscript: [
        ...(process.env.NUXT_PUBLIC_GTM_ID ? [{
          innerHTML: `<iframe src="https://www.googletagmanager.com/ns.html?id=${process.env.NUXT_PUBLIC_GTM_ID}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`,
          tagPosition: 'bodyOpen' as const
        }] : []),
      ]
    }
  },
  
  routeRules: {
    '/_nuxt/**': {
      headers: { 'cache-control': 'public, max-age=31536000, immutable' },
    },
    // Exclude private/protected areas from sitemap + search indexing
    '/dashboard/**': { robots: false },
    '/auth/**': { robots: false },
    '/admin/**': { robots: false },
    '/onboarding/**': { robots: false },
    '/api/**': { robots: false },
    // Blog consolidation 301s (cannibalization cleanup).
    // DEPLOY ONLY AFTER merging each source page's unique content into its canonical
    // target — deploying this redirects the old URL immediately, before the DB status flip.
    '/blog/python-env-files': { redirect: { to: '/blog/environment-variables-python', statusCode: 301 } },
    '/blog/python-read-environment-variables': { redirect: { to: '/blog/environment-variables-python', statusCode: 301 } },
    '/blog/policy-access-control': { redirect: { to: '/blog/access-control-best-practices', statusCode: 301 } },
  },

  experimental: {
    emitRouteChunkError: 'automatic-immediate',
  },

  vueSonner: {
    css: false,
  },

  css: [vueSonnerCSS, '~/assets/css/main.css'],
  
  sourcemap: {
    client: 'hidden',
  },

  sentry: {
    sourceMapsUploadOptions: {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
    },
  },

  runtimeConfig: {
    outrankWebhookSecret: process.env.OUTRANK_WEBHOOK_SECRET || '',
    public: {
      appName: 'EnvManager',
      selfHosted: process.env.EM_SELF_HOSTED === 'true',
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://envmanager.com',
      posthogPublicKey: process.env.POSTHOG_PUBLIC_KEY || '',
      posthogHost: process.env.POSTHOG_HOST || 'https://e.envmanager.com',
      githubAppName: process.env.NUXT_PUBLIC_GITHUB_APP_NAME || 'EnvManager',
      githubClientId: process.env.NUXT_PUBLIC_GITHUB_CLIENT_ID || '',
      // Self-hosted OAuth login toggles. SaaS ignores these (buttons always show);
      // self-hosted shows a provider's button only when its flag is 'true'.
      oauthGithubEnabled: process.env.NUXT_PUBLIC_OAUTH_GITHUB_ENABLED === 'true',
      oauthGoogleEnabled: process.env.NUXT_PUBLIC_OAUTH_GOOGLE_ENABLED === 'true',
      cookiebotCbid: process.env.NUXT_PUBLIC_COOKIEBOT_CBID || '',
      gtmId: process.env.NUXT_PUBLIC_GTM_ID || '',
      sentry: {
        dsn: process.env.NUXT_PUBLIC_SENTRY_DSN || '',
      },
    }
  }
})
