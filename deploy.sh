#!/bin/bash                                                                                                                                       
set -e

echo "Pulling latest changes..."
git pull origin develop

echo "Rebuilding and Redeploying..."
docker compose -f docker-compose.yml up --build -d

echo "✅ Deployment complete!"