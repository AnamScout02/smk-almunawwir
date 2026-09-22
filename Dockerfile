# ===== STAGE 1: Dependencies =====
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Tahan gangguan jaringan (21 Sep 2026): npm ci gagal ECONNRESET berulang saat cache build terhapus — puluhan koneksi
# serentak diputus jaringan sekolah. Koneksi dibatasi, percobaan ulang diperpanjang, dan unduhan disimpan di cache
# BuildKit sehingga build berikutnya tidak mengunduh ulang walau lapisan ini harus dibangun lagi.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps --prefer-offline --no-audit --no-fund \
      --maxsockets=6 --fetch-retries=6 --fetch-retry-mintimeout=15000 --fetch-retry-maxtimeout=120000

# ===== STAGE 2: Builder =====
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ===== STAGE 3: Runner (Production) =====
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
