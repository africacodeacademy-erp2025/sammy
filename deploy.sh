#!/usr/bin/env bash
set -euo pipefail

# Simple deploy script for server `vader`.
# 1) Pull latest code
# 2) Ensure .env exists and contains required keys
# 3) Build image via buildx and load into local docker
# 4) Start containers via docker compose override (prod settings)

REQUIRED_VARS=(
  "MONGO_URI"
  "DATABASE_NAME"
  "JWT_SECRET"
  "OPENAI_API_KEY"
  "REDIS_URL"
  "JWT_EXPIRES_IN"
  "ENC_SECRET"
  "STRIPE_SECRET_KEY"
  "STRIPE_PRICE_ID"
  "NEXT_PUBLIC_BASE_URL"
)

echo "Pulling latest code..."
git pull --ff-only

if [ ! -f .env ]; then
  echo "ERROR: .env file not found. Create .env on the server with required vars." >&2
  exit 1
fi

# Export .env into the environment for docker-compose variable substitution
# but do not print values
set -o allexport
# shellcheck disable=SC2046
while IFS='=' read -r key value; do
  # skip comments/empty lines
  [[ "$key" =~ ^#.*$ ]] && continue
  [[ -z "$key" ]] && continue
  export "$key=$value"
done < .env
set +o allexport

# Validate required variables are present
for v in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!v-}" ]; then
    echo "ERROR: Required variable $v is not set in .env" >&2
    exit 2
  fi
done

# Some code expects OPEN_AI_API while others expect OPENAI_API_KEY; copy if only one is set
if [ -n "${OPEN_AI_API-}" ] && [ -z "${OPENAI_API_KEY-}" ]; then
  export OPENAI_API_KEY="$OPEN_AI_API"
fi
if [ -n "${OPENAI_API_KEY-}" ] && [ -z "${OPEN_AI_API-}" ]; then
  export OPEN_AI_API="$OPENAI_API_KEY"
fi

# Build args: safely convert env vars into --build-arg entries
build_args=()
for k in "${REQUIRED_VARS[@]}"; do
  # Use printf to avoid word-splitting
  build_args+=("--build-arg" "$k=${!k}")
done

IMAGE_TAG="sammy-prod:latest"

echo "Building Docker image ($IMAGE_TAG)..."
# Use buildx and --load so the resulting image is available to local docker
# If you prefer pushing to a registry, replace --load with --push and add registry tags
docker buildx build --platform linux/amd64 -f Dockerfile.prod -t "$IMAGE_TAG" "${build_args[@]}" --load .

echo "Starting containers via docker compose..."
# Use the override file which sets production build args and env_file
docker compose -f docker-compose.override.yml up -d --remove-orphans --build sammy-app

echo "✅ Deployment finished successfully!"
