#!/bin/sh
set -e

echo "🚀 Starting SaMMy application..."

# Start the worker in the background
echo "📊 Starting schedule post worker..."
node --loader tsx workers/schedulePostWorker.ts &
WORKER_PID=$!

# Start Next.js server
echo "🌐 Starting Next.js server..."
npm start &
NEXTJS_PID=$!

# Wait for both processes
wait $WORKER_PID $NEXTJS_PID
