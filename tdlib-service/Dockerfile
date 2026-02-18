# ─── Build Stage ──────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Install system dependencies required by prebuilt-tdlib
RUN apt-get update && apt-get install -y \
    libssl-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# ─── Production Stage ─────────────────────────────────────────────────
FROM node:20-slim

WORKDIR /app

# Install runtime dependencies for TDLib
RUN apt-get update && apt-get install -y \
    libssl3 \
    zlib1g \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

# Create persistent directories for TDLib database and file cache
RUN mkdir -p /data/tdlib-db /data/tdlib-files

# Set environment defaults
ENV PORT=3001
ENV TDLIB_DATABASE_PATH=/data/tdlib-db
ENV TDLIB_FILES_PATH=/data/tdlib-files

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://localhost:3001/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
