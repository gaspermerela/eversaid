# syntax=docker/dockerfile:1

# ===== Stage 1: Dependencies =====
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --ignore-scripts

# ===== Stage 2: Build =====
FROM node:22-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build arguments for environment variables needed at build time
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_DEMO_SL_DISPLAY_NAME
ARG NEXT_PUBLIC_DEMO_EN_DISPLAY_NAME
ARG NEXT_PUBLIC_DEMO_SL_SOURCE_URL
ARG NEXT_PUBLIC_DEMO_EN_SOURCE_URL
ARG NEXT_PUBLIC_ENABLE_MODEL_SELECTION
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_DEMO_SL_DISPLAY_NAME=${NEXT_PUBLIC_DEMO_SL_DISPLAY_NAME}
ENV NEXT_PUBLIC_DEMO_EN_DISPLAY_NAME=${NEXT_PUBLIC_DEMO_EN_DISPLAY_NAME}
ENV NEXT_PUBLIC_DEMO_SL_SOURCE_URL=${NEXT_PUBLIC_DEMO_SL_SOURCE_URL}
ENV NEXT_PUBLIC_DEMO_EN_SOURCE_URL=${NEXT_PUBLIC_DEMO_EN_SOURCE_URL}
ENV NEXT_PUBLIC_ENABLE_MODEL_SELECTION=${NEXT_PUBLIC_ENABLE_MODEL_SELECTION}

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN npm run build

# ===== Stage 3: Runner =====
FROM node:22-alpine AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application from builder
# Note: Using Next.js standalone output for minimal image size
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Set hostname to listen on all interfaces
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Start the application
CMD ["node", "server.js"]