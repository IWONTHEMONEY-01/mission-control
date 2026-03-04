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

# Collect native deps that pnpm symlinks might hide from standalone trace
FROM build AS native-collector
RUN mkdir -p /native/node_modules && \
    cp -rL /app/node_modules/better-sqlite3 /native/node_modules/better-sqlite3 && \
    BINDINGS_DIR=$(find /app/node_modules/.pnpm -path "*/bindings@*/node_modules/bindings" -maxdepth 4 -type d | head -1) && \
    cp -rL "$BINDINGS_DIR" /native/node_modules/bindings && \
    FUTP_DIR=$(find /app/node_modules/.pnpm -path "*/file-uri-to-path@*/node_modules/file-uri-to-path" -maxdepth 4 -type d | head -1) && \
    cp -rL "$FUTP_DIR" /native/node_modules/file-uri-to-path && \
    echo "=== Native deps collected ===" && \
    ls -la /native/node_modules/ && \
    ls -la /native/node_modules/better-sqlite3/build/Release/ 2>/dev/null || true

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
# Standalone output is flat when WORKDIR=/app in Docker
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
# Copy public directory if it exists (may not exist in all setups)
COPY --from=build /app/public* ./public/
# Remove standalone-traced native deps so COPY overlay doesn't conflict
RUN rm -rf node_modules/better-sqlite3 node_modules/bindings node_modules/file-uri-to-path
# Overlay native deps — standalone trace can miss pnpm-symlinked native addons
COPY --from=native-collector /native/node_modules/ ./node_modules/
# Create data directories with correct ownership for SQLite
# .data is default, /data is for Railway volume mounts
RUN mkdir -p .data /data && chown nextjs:nodejs .data /data
RUN apt-get update && apt-get install -y curl --no-install-recommends && rm -rf /var/lib/apt/lists/*
# Verify better-sqlite3 loads in the runtime image
RUN node -e "const db = require('better-sqlite3')(':memory:'); db.exec('SELECT 1'); db.close(); console.log('better-sqlite3: OK')"
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1
# Startup wrapper: log diagnostics to Railway deploy logs, then exec server
CMD ["sh", "-c", "echo '=== Mission Control starting ===' && echo \"Node $(node --version) | PORT=$PORT | HOSTNAME=$HOSTNAME\" && echo \"DB: ${MISSION_CONTROL_DB_PATH:-'.data/mission-control.db (default)'}\" && exec node server.js 2>&1"]
