FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY package.json ./
COPY . .
# better-sqlite3 requires native compilation tools
RUN apt-get update && apt-get install -y python3 make g++ --no-install-recommends && rm -rf /var/lib/apt/lists/*
RUN if [ -f pnpm-lock.yaml ]; then \
      pnpm install --frozen-lockfile; \
    else \
      echo "WARN: pnpm-lock.yaml not found in build context; running non-frozen install"; \
      pnpm install --no-frozen-lockfile; \
    fi

FROM base AS build
COPY --from=deps /app ./
RUN pnpm build
# Diagnostic: show standalone output structure for debugging deploys
RUN echo "=== Standalone root ===" && ls -la /app/.next/standalone/ && echo "=== server.js check ===" && ls -la /app/.next/standalone/server.js 2>/dev/null || echo "server.js not at root" && echo "=== Checking for nested paths ===" && find /app/.next/standalone/ -name "server.js" -maxdepth 4 2>/dev/null

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
# Standalone output is flat when WORKDIR=/app in Docker
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
# Copy public directory if it exists (may not exist in all setups)
COPY --from=build /app/public* ./public/
# Create data directories with correct ownership for SQLite
# .data is default, /data is for Railway volume mounts
RUN mkdir -p .data /data && chown nextjs:nodejs .data /data
RUN apt-get update && apt-get install -y curl --no-install-recommends && rm -rf /var/lib/apt/lists/*
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1
CMD ["node", "server.js"]
