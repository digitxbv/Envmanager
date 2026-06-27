# check=skip=SecretsUsedInArgOrEnv
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/cli/package*.json ./packages/cli/
COPY packages/validate/package*.json ./packages/validate/

RUN npm ci --silent

COPY . .

ARG NODE_ENV=production
# Self-hosted builds set EM_SELF_HOSTED=true so nuxt.config bakes ssr:false (SPA).
ARG EM_SELF_HOSTED
ARG SUPABASE_URL
ARG SUPABASE_KEY
ARG NUXT_PUBLIC_SITE_URL
ARG POSTHOG_PUBLIC_KEY
ARG POSTHOG_HOST
ARG NUXT_PUBLIC_GITHUB_APP_NAME
ARG NUXT_PUBLIC_GITHUB_CLIENT_ID
ARG NUXT_PUBLIC_COOKIEBOT_CBID

ENV NODE_ENV=${NODE_ENV}
ENV EM_SELF_HOSTED=${EM_SELF_HOSTED}
ENV SUPABASE_URL=${SUPABASE_URL}
ENV SUPABASE_KEY=${SUPABASE_KEY}
ENV NUXT_PUBLIC_SITE_URL=${NUXT_PUBLIC_SITE_URL}
ENV POSTHOG_PUBLIC_KEY=${POSTHOG_PUBLIC_KEY}
ENV POSTHOG_HOST=${POSTHOG_HOST}
ENV NUXT_PUBLIC_GITHUB_APP_NAME=${NUXT_PUBLIC_GITHUB_APP_NAME}
ENV NUXT_PUBLIC_GITHUB_CLIENT_ID=${NUXT_PUBLIC_GITHUB_CLIENT_ID}
ENV NUXT_PUBLIC_COOKIEBOT_CBID=${NUXT_PUBLIC_COOKIEBOT_CBID}
ENV NODE_OPTIONS=--max-old-space-size=4096

RUN npm run build

FROM node:22-alpine AS production

WORKDIR /app

RUN apk add --no-cache curl

COPY --from=builder /app/.output /app/.output

RUN addgroup -g 1001 -S nodejs && adduser -S nuxt -u 1001
RUN chown -R nuxt:nodejs /app

USER nuxt

ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD curl -f -s -S http://localhost:3000/ -o /dev/null || exit 1

CMD ["node", ".output/server/index.mjs"]
