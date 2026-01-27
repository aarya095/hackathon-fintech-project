# -----------------------------------------------------------------------------
# Stage 1: Build frontend
# -----------------------------------------------------------------------------
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./

# Use relative /api/v1 so same-origin in production (no CORS for same host)
ENV VITE_API_URL=""
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Production
# -----------------------------------------------------------------------------
FROM node:20-alpine AS app

WORKDIR /app

# Backend deps
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# Prisma
COPY backend/prisma ./prisma
RUN npx prisma generate

# Backend source
COPY backend/server.js ./
COPY backend/lib ./lib
COPY backend/prisma.config.ts ./

# Frontend static (from stage 1)
COPY --from=frontend-build /app/frontend/dist ./public

RUN mkdir -p /app/data

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
# Persist SQLite in /app/data; override DATABASE_URL to change location
ENV DATABASE_URL="file:/app/data/dev.db"

CMD ["sh", "-c", "npx prisma db push --accept-data-loss 2>/dev/null || true && node server.js"]
