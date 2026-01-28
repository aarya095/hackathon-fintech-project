# =============================================================================
# Stage 1: Build Frontend
# =============================================================================
FROM node:20-alpine AS frontend-build

WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./

ENV VITE_API_URL=""
RUN npm run build

# =============================================================================
# Stage 2: Production
# =============================================================================
FROM node:20-alpine

WORKDIR /app

# Copy backend package files
COPY backend/package.json backend/package-lock.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy Prisma schema and generate client
COPY backend/prisma ./prisma
RUN npx prisma generate

# Copy backend source code
COPY backend/server.js ./
COPY backend/lib ./lib
COPY backend/.env ./

# Copy built frontend from build stage
COPY --from=frontend-build /frontend/dist ./public

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL="file:/app/data/dev.db"

# Run database migration and start server
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss 2>/dev/null || true && node server.js"]
