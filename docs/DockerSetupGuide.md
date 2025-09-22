# Docker Setup Guide for Next.js Project

This guide documents the complete Docker setup for the ThriftBales Next.js application, including both development and production configurations.

## Overview

This project uses a multi-environment Docker setup with:

- **Development Environment**: Hot reload, volume mounts, and Firebase emulator support
- **Production Environment**: Optimized multi-stage build with standalone output
- **Package Manager Agnostic**: Works with npm, yarn, or pnpm
- **Environment Variables**: Comprehensive configuration for Firebase, AWS S3, and Sentry

## Prerequisites

- Docker Desktop installed
- Node.js 18.18+ (as specified in package.json engines)
- Basic understanding of Docker and Docker Compose

## Project Structure

```
├── Dockerfile.dev              # Development Dockerfile
├── Dockerfile.prod             # Production Dockerfile
├── docker-compose.dev.yml     # Development compose configuration
├── docker-compose.prod.yml    # Production compose configuration
├── .env.development            # Development environment variables
└── next.config.mjs             # Must include output: 'standalone'
```

## File Configurations

### 1. Development Dockerfile (`Dockerfile.dev`)

```dockerfile
# syntax=docker.io/docker/dockerfile:1

FROM node:22-alpine

WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i; \
  else echo "Warning: Lockfile not found." && yarn install; \
  fi

# Copy source code
COPY app ./app
COPY components ./components
COPY hooks ./hooks
COPY lib ./lib
COPY public ./public
COPY next.config.mjs .
COPY tsconfig.json .
COPY tailwind.config.ts .
COPY postcss.config.mjs .
COPY components.json .

# Optional: Disable Next.js telemetry
# ENV NEXT_TELEMETRY_DISABLED 1

# Start development server
CMD \
  if [ -f yarn.lock ]; then yarn dev; \
  elif [ -f package-lock.json ]; then npm run dev; \
  elif [ -f pnpm-lock.yaml ]; then pnpm dev; \
  else npm run dev; \
  fi
```

### 2. Production Dockerfile (`Dockerfile.prod`)

```dockerfile
# syntax=docker.io/docker/dockerfile:1

FROM node:22-alpine AS base

# Builder stage
FROM base AS builder

WORKDIR /app

# Install dependencies
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i; \
  else echo "Warning: Lockfile not found." && yarn install; \
  fi

# Copy source files
COPY app ./app
COPY components ./components
COPY hooks ./hooks
COPY lib ./lib
COPY public ./public
COPY next.config.mjs .
COPY tsconfig.json .
COPY tailwind.config.ts .
COPY postcss.config.mjs .
COPY components.json .

# Environment variables for build time
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_API_KEY=${NEXT_PUBLIC_FIREBASE_API_KEY}
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=${NEXT_PUBLIC_FIREBASE_PROJECT_ID}
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ENV NEXT_PUBLIC_FIREBASE_APP_ID=${NEXT_PUBLIC_FIREBASE_APP_ID}
ARG NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
ENV NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=${NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID}

# Firebase Admin Configuration
ARG FIREBASE_CLIENT_EMAIL
ENV FIREBASE_CLIENT_EMAIL=${FIREBASE_CLIENT_EMAIL}
ARG FIREBASE_PRIVATE_KEY
ENV FIREBASE_PRIVATE_KEY=${FIREBASE_PRIVATE_KEY}
ARG FIREBASE_PROJECT_ID
ENV FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}

# AWS S3 Configuration
ARG AWS_REGION
ENV AWS_REGION=${AWS_REGION}
ARG AWS_ACCESS_KEY_ID
ENV AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
ARG AWS_SECRET_ACCESS_KEY
ENV AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
ARG S3_BUCKET
ENV S3_BUCKET=${S3_BUCKET}
ARG S3_PUBLIC_DOMAIN
ENV S3_PUBLIC_DOMAIN=${S3_PUBLIC_DOMAIN}

# Sentry Configuration
ARG SENTRY_DSN
ENV SENTRY_DSN=${SENTRY_DSN}
ARG SENTRY_TRACES_SAMPLE_RATE
ENV SENTRY_TRACES_SAMPLE_RATE=${SENTRY_TRACES_SAMPLE_RATE}

# Other Configuration
ARG NODE_ENV
ENV NODE_ENV=${NODE_ENV}
ARG NEXT_PUBLIC_FIREBASE_PHONE_TESTING
ENV NEXT_PUBLIC_FIREBASE_PHONE_TESTING=${NEXT_PUBLIC_FIREBASE_PHONE_TESTING}
ARG USE_FIREBASE_EMULATOR
ENV USE_FIREBASE_EMULATOR=${USE_FIREBASE_EMULATOR}
ARG CI
ENV CI=${CI}

# Build the application
RUN \
  if [ -f yarn.lock ]; then yarn build; \
  elif [ -f package-lock.json ]; then npm run build; \
  elif [ -f pnpm-lock.yaml ]; then pnpm build; \
  else npm run build; \
  fi

# Production runner stage
FROM base AS runner

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Runtime environment variables (redefined for runtime)
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_API_KEY=${NEXT_PUBLIC_FIREBASE_API_KEY}
# ... (repeat all environment variables as needed)

CMD ["node", "server.js"]
```

### 3. Development Docker Compose (`docker-compose.dev.yml`)

```yaml
services:
  next-app:
    container_name: next-app
    build:
      context: .
      dockerfile: Dockerfile.dev

    # Load development environment variables
    env_file:
      - .env.development

    # Enable hot reload with volume mounts
    volumes:
      - ./app:/app/app
      - ./components:/app/components
      - ./lib:/app/lib
      - ./public:/app/public

    restart: always
    ports:
      - 3000:3000
    networks:
      - my_network

# Network for container communication
networks:
  my_network:
```

### 4. Production Docker Compose (`docker-compose.prod.yml`)

```yaml
services:
  next-app:
    container_name: next-app-prod
    build:
      context: .
      dockerfile: Dockerfile.prod
      args:
        # Pass all environment variables as build args
        NEXT_PUBLIC_FIREBASE_API_KEY: ${NEXT_PUBLIC_FIREBASE_API_KEY}
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: ${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: ${NEXT_PUBLIC_FIREBASE_PROJECT_ID}
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: ${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: ${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}
        NEXT_PUBLIC_FIREBASE_APP_ID: ${NEXT_PUBLIC_FIREBASE_APP_ID}
        NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: ${NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID}
        FIREBASE_CLIENT_EMAIL: ${FIREBASE_CLIENT_EMAIL}
        FIREBASE_PRIVATE_KEY: ${FIREBASE_PRIVATE_KEY}
        AWS_REGION: ${AWS_REGION}
        AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
        AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
        S3_BUCKET: ${S3_BUCKET}
        NEXT_PUBLIC_FIREBASE_PHONE_TESTING: ${NEXT_PUBLIC_FIREBASE_PHONE_TESTING}
        USE_FIREBASE_EMULATOR: ${USE_FIREBASE_EMULATOR}

    restart: unless-stopped
    ports:
      - "3000:3000"
    networks:
      - production_network

networks:
  production_network:
```

## Environment Configuration

### Development Environment (`.env.development`)

```env
NODE_ENV=development
USE_FIREBASE_EMULATOR=true

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_dev_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Firebase Admin
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_PROJECT_ID=your-project-id

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET=your-bucket-name
S3_PUBLIC_DOMAIN=https://your-bucket.s3.amazonaws.com

# Sentry
SENTRY_DSN=your_sentry_dsn
SENTRY_TRACES_SAMPLE_RATE=0.1

# Other
NEXT_PUBLIC_FIREBASE_PHONE_TESTING=true
```

## Usage Instructions

### Development Mode

1. **Start the development environment:**

   ```bash
   docker-compose -f docker-compose.dev.yml up --build
   ```

2. **Access the application:**

   - Main app: http://localhost:3000
   - Hot reload is enabled through volume mounts

3. **Stop the development environment:**
   ```bash
   docker-compose -f docker-compose.dev.yml down
   ```

### Production Mode

1. **Build and start production environment:**

   ```bash
   docker-compose -f docker-compose.prod.yml up --build
   ```

2. **Run in detached mode:**

   ```bash
   docker-compose -f docker-compose.prod.yml up -d --build
   ```

3. **Stop production environment:**
   ```bash
   docker-compose -f docker-compose.prod.yml down
   ```

## Package Manager Support

The Docker setup automatically detects and uses the appropriate package manager:

- **pnpm** (detected via `pnpm-lock.yaml`) - Currently used by this project
- **yarn** (detected via `yarn.lock`)
- **npm** (detected via `package-lock.json`)

## Important Configuration Notes

### Next.js Configuration

Ensure your `next.config.mjs` includes:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone", // Required for Docker production builds
  // ... other configurations
};

export default nextConfig;
```

### Docker Ignore

Create `.dockerignore` to exclude unnecessary files:

```
node_modules
npm-debug.log
.next
.git
.gitignore
README.md
Dockerfile*
docker-compose*
.dockerignore
.env*
```

## Advanced Features

### Firebase Emulator Integration

The development setup supports Firebase emulators. Start them with:

```bash
firebase emulators:start --debug
```

### Volume Mounts for Hot Reload

Development mode mounts source directories for instant code changes:

- `./app:/app/app`
- `./components:/app/components`
- `./lib:/app/lib`
- `./public:/app/public`

### Multi-Stage Production Build

The production Dockerfile uses a multi-stage build:

1. **Builder stage**: Installs dependencies and builds the application
2. **Runner stage**: Creates optimized runtime image with minimal footprint

## Security Considerations

1. **Non-root user**: Production container runs as `nextjs` user (UID 1001)
2. **Environment variables**: Sensitive data passed through Docker secrets or env files
3. **Minimal runtime**: Production image only contains necessary files

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure port 3000 is available
2. **Environment variables**: Verify all required env vars are set
3. **Volume permissions**: Check file permissions for mounted volumes
4. **Build failures**: Ensure `output: 'standalone'` is set in Next.js config

### Debugging

1. **Check container logs:**

   ```bash
   docker-compose -f docker-compose.dev.yml logs -f
   ```

2. **Access container shell:**

   ```bash
   docker exec -it next-app /bin/sh
   ```

3. **Rebuild without cache:**
   ```bash
   docker-compose -f docker-compose.dev.yml build --no-cache
   ```

## Integration with Development Tools

This setup integrates well with:

- **Storybook**: Runs on port 6006
- **Firebase Emulators**: Local development and testing
- **VS Code Tasks**: Pre-configured tasks available
- **Sentry**: Error monitoring and performance tracking
- **AWS S3**: File storage and management
