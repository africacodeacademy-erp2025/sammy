# SaMMy – Social Media Content Generator & Posting Orchestrator

SaMMy drafts, schedules, and posts AI‑generated social media content to Twitter/X and Facebook, with groundwork for Slack-based context ingestion using MongoDB vector search and LangGraph state machines.

## Key Features
- AI drafting with context enrichment (vector search over user-scoped Slack messages and past posts)
- Draft → Review → Approve → Post workflow
- Schedule time extraction via LLM (ISO 8601 UTC)
- Multi‑platform posting (Twitter/X & Facebook)
- Per‑user credential encryption (AES‑256-GCM)
- JWT authentication
- BullMQ + Redis worker for delayed scheduled jobs → drafts ready for review
- LangGraph state machines for generation & posting
- Post review UI with approve / reject
- TypeScript + Next.js (App Router) + Turbopack
- Tailwind CSS
- Jest + Testing Library

## Stack
| Layer | Tech |
|-------|------|
| UI / App | Next.js 15 (App Router), React 19 |
| State Machines | @langchain/langgraph (StateGraph) |
| AI | OpenAI (chat + embeddings) |
| DB | MongoDB Atlas (vector index `vector_index`) |
| Auth | JWT (bcrypt) |
| Crypto | AES-256-GCM |
| Integrations | Twitter API v2, Facebook Graph API, Slack Web API |
| Worker | BullMQ + Redis (tsx worker, delayed jobs) |
| Tests | Jest + @testing-library/react |

## High-Level Architecture
1. User authenticates → receives JWT.
2. User POSTs a natural language prompt to `/api/agent`.
3. Platform detection + schedule time extraction (LLM). If schedule found → enqueue delayed job.
4. Otherwise perform vector search over `messages` and `past_posts` → generate a draft for review.
5. User approves draft via `/api/agent` PUT → platform‑specific posting node runs (Twitter or Facebook).
6. Worker processes scheduled posts at their time, generating drafts and marking them `ready_for_review`.

Notes:
- Agent applies a pre‑generation relevance check. If no relevant context/style is found, it returns 400.

## LangGraph Workflows
- Generation graph: `extractScheduleTime` → if scheduled END else `generatePost`
- Posting graph: conditional edge → `twitterPosting` or `facebookPosting`

## Main API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/agent` | Generate draft or schedule post |
| PUT | `/api/agent` | Approve & publish a draft (optionally clears scheduled row) |
| POST | `/api/postings/x-posting` | Internal Twitter relay |
| POST | `/api/postings/fb-posting` | Internal Facebook relay |
| POST | `/api/auth/signup` | Create user |
| POST | `/api/auth/signin` | Login (returns JWT) |
| GET  | `/api/auth/me` | Current user profile |
| POST | `/api/integrations/twitter/connect` | Store Twitter creds (encrypted) |
| POST | `/api/integrations/facebook/connect` | Store Facebook creds (encrypted) |
| POST | `/api/integrations/slack/connect` | Store Slack creds (encrypted) |
| GET  | `/api/scheduledposts` | List scheduled posts (basic/placeholder) |
| POST | `/api/sources/slack` | Ingest Slack messages for embeddings (user-scoped) |
| POST | `/api/sources/slack/events` | Slack Events endpoint (ingestion) |
| POST | `/api/pulling/x-pulling` | Pull/embedding helper for Twitter |
| POST | `/api/pulling/fb-pulling` | Pull/embedding helper for Facebook |

## Scripts
```bash
# package.json scripts
npm run dev        # Start Next.js (Turbopack)
npm run build      # Production build
npm start          # Start production server
npm run lint       # ESLint
npm test           # Jest test suite
npm run test:watch # Jest watch
```

Worker (no npm script by default):
```bash
# run the scheduled-posts worker
npx tsx workers/schedulePostWorker.ts

# optionally add to package.json:
# "worker": "tsx workers/schedulePostWorker.ts"
# then: npm run worker
```

## Environment Variables
Minimum required (.env):
```bash
# Core
MONGO_URI=mongodb+srv://...
DATABASE_NAME=sammy
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
ENC_SECRET=32_byte_key____________32_byte_key__   # 32 bytes for AES-256-GCM

# OpenAI
OPEN_AI_API=sk-...

# App
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Redis (BullMQ worker)
REDIS_URL=rediss://:<password>@<host>:<port>

# (Optional) Platform defaults / bootstrap
TWITTER_API_KEY=...
TWITTER_API_SECRET=...
TWITTER_ACCESS_TOKEN=...
TWITTER_ACCESS_SECRET=...

FACEBOOK_PAGE_ID=...
FACEBOOK_PAGE_ACCESS_TOKEN=...

# Slack (optional)
SLACK_BOT_TOKEN=xoxb-...
SLACK_USER_TOKEN=xoxp-...
```
Notes:
- `ENC_SECRET` must be exactly 32 bytes. If omitted, code falls back to `JWT_SECRET`.
- `NEXT_PUBLIC_BASE_URL` is used by posting helpers to call internal relay endpoints.
- `REDIS_URL` is required for the BullMQ worker. The worker config enables TLS by default; use a `rediss://` URL or adjust the worker connection if your Redis is plaintext.

## Data Model (Simplified)
```typescript
// collection: users
{
  _id: ObjectId,
  email: string,
  passwordHash: string,
  twitter?: { appKey, appSecret, accessToken(enc), accessSecret(enc) },
  facebook?: { pageId, accessToken(enc) },
  slack?: { workspaceId?, botToken(enc)?, userToken(enc)?, channels? },
  createdAt, updatedAt
}

// collection: messages (context source for embeddings)
{
  _id, userId, text, channel, ts, embedding: number[]
}

// collection: past_posts (style examples)
{
  _id, userId, platform: "twitter" | "facebook", message, embedding: number[]
}

// collection: scheduledPosts
{
  _id, userId, prompt, platform, scheduleTime,
  status: "scheduled" | "ready_for_review" | "posted",
  post?, threadId?, isScheduled?, createdAt, updatedAt
}
```

## Scheduling Flow
1. POST `/api/agent` with a prompt containing a time expression (e.g. “tomorrow 10:00 UTC”).
2. LLM normalizes to ISO 8601 UTC `scheduleTime`.
3. A Redis delayed job is enqueued via BullMQ for that time.
4. The worker picks up the job at execution time:
   - Runs generation using user context/style.
   - Updates the Mongo row with generated `post` + `threadId`.
   - Sets `status = "ready_for_review"` and `isScheduled = true`.

## Example Requests
Draft or schedule:
```bash
curl -X POST http://localhost:3000/api/agent \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Draft a facebook post about our new AI course tomorrow at 09:30 UTC"}'
```

Response (scheduled):
```json
{
  "success": true,
  "scheduled": true,
  "message": "Post scheduled for 2025-09-18T09:30:00Z"
}
```

Immediate draft (no time expression or not resolved):
```json
{
  "success": true,
  "review": {
    "post": "...generated text...",
    "threadId": "ab12cd34ef",
    "platform": "facebook",
    "userId": "<id>"
  }
}
```

Approve draft (optionally clear scheduled row):
```bash
curl -X PUT http://localhost:3000/api/agent \
  -H "Authorization: Bearer <JWT)" \
  -H "Content-Type: application/json" \
  -d '{
    "post":"<draft text>",
    "platform":"facebook",
    "threadId":"ab12cd34ef",
    "isScheduled": true,
    "_id": "<scheduledPostId>"
  }'
```

## Local Development
```bash
npm install
npm run dev
# start worker in another terminal
npx tsx workers/schedulePostWorker.ts
```
Open http://localhost:3000.

Docker notes are in `docs/DockerSetupGuide.md`.

## Docker

This repo includes Dockerfiles and Compose files for development and production.

Files:
- `Dockerfile.dev` – dev image that runs `npm run dev` (Turbopack, hot reload).
- `Dockerfile.prod` – multi-stage build producing a minimal standalone runner.
- `docker-compose.dev.yml` – dev Compose with hot-reload volume mounts.
- `docker-compose.yml` – base Compose (prod).
- `docker-compose.override.yml` – prod overrides (build args/env, restart policy).

Important OpenAI env note:
- The code uses `OPEN_AI_API` (see `src/app/api/*`). `Dockerfile.prod` currently references `OPENAI_API_KEY`. To avoid confusion, either:
  - Set both vars (map `OPEN_AI_API` in your `.env` and pass `OPENAI_API_KEY=$OPEN_AI_API` at build/run), or
  - Update `Dockerfile.prod` to use `OPEN_AI_API` instead of `OPENAI_API_KEY`.

### Dev (hot reload)
```bash
# build & run
docker compose -f docker-compose.dev.yml up --build

# app available at
http://localhost:3000
```
- The Compose file mounts `src`, `lib`, `models`, `workers`, `public` and `.env` (read-only).
- To run the worker inside the container:
```bash
docker compose -f docker-compose.dev.yml exec sammy-app npx tsx workers/schedulePostWorker.ts
```

### Prod
```bash
# build & run (uses base + override)
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build

# logs
docker compose -f docker-compose.yml -f docker-compose.override.yml logs -f
```
- Exposes port `3000:3000`.
- Reads env from `.env` (see Environment Variables section).
- Next.js is configured to bind to `0.0.0.0` in the runner image.

### Redis for the Worker
You need a reachable Redis for BullMQ. The worker code currently configures TLS unconditionally and expects a `rediss://` URL:
```ts
new IORedis(process.env.REDIS_URL!, { tls: {}, maxRetriesPerRequest: null })
```
- Use a managed Redis with TLS (set `REDIS_URL=rediss://...`), or
- If running a local/plain Redis without TLS, update the worker connection (remove `tls: {}`) or ensure `REDIS_URL` points to a TLS-enabled endpoint.

Example local Redis service (optional):
```yaml
# add to your compose file(s)
services:
  redis:
    image: redis/redis-stack-server:latest
    ports:
      - "6379:6379"
    networks:
      - sammy_network
# Then use: REDIS_URL=redis://redis:6379
```

### Running the worker as a service (optional)
You can add a worker service to Compose so it runs alongside the app:
```yaml
services:
  worker:
    build:
      context: .
      dockerfile: Dockerfile.dev  # or Dockerfile.prod
    command: npx tsx workers/schedulePostWorker.ts
    env_file:
      - .env
    depends_on:
      - sammy-app
      # - redis  # if you added a Redis service
    networks:
      - sammy_network
```

More details and tips are available in `docs/DockerSetupGuide.md`.

## Testing

The project includes comprehensive UI tests covering components, pages, and user interactions.

### Test Structure
```
__tests__/
├── ui.test.tsx          # Core UI components (Badge, PasswordInput, InputGroup, Login, Register)
├── components.test.tsx  # UI library components (Button, Card, Input, Label, MessageBubble)
└── pages.test.tsx       # Page components (Home, Chatbot)
```

### Test Commands
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test __tests__/ui.test.tsx

# Run with coverage (if configured)
npm test -- --coverage
```

### Test Coverage
- **32 passing tests** across all components
- **UI Components**: Badge, PasswordInput, InputGroup with visibility toggles
- **Authentication**: Login/Register forms with validation and API calls
- **Core Components**: Button variants, Card styling, Input focus/blur, Label associations
- **Complex Components**: MessageBubble with edit mode, approval workflow, status indicators
- **Pages**: Home landing page content, Chatbot interface elements

### Test Configuration
- **Framework**: Jest + Testing Library React
- **Environment**: jsdom for DOM testing
- **Mocking**: Next.js router, fetch API, localStorage, scrollIntoView
- **TypeScript**: Full type safety without 'any' usage
- **ESM Support**: Jest configured for ES modules via `jest.config.cjs`

### Key Testing Features
- User interaction testing (clicks, typing, form submissions)
- API call mocking and verification
- Component state changes and side effects
- Error handling and validation flows
- Accessibility testing with proper ARIA labels
- Responsive behavior and conditional rendering

### Adding New Tests
1. Create test files in `__tests__/` directory
2. Import components using relative paths (e.g., `'../src/app/Components/MyComponent'`)
3. Mock external dependencies (router, APIs) as needed
4. Use Testing Library queries (`getByRole`, `getByText`, etc.)
5. Test user interactions with `userEvent.setup()`
6. Verify state changes with `waitFor()` for async operations

### Test Utilities
- **Mocks**: Global mocks in `jest.setup.ts` (scrollIntoView)
- **File Mocks**: Static assets mocked via `__mocks__/fileMock.js`
- **Router Mocking**: Next.js navigation mocked for isolated testing
- **API Mocking**: Fetch calls mocked with Jest functions

Example test:
```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyComponent from '../src/app/Components/MyComponent';

it('handles user interaction', async () => {
  const user = userEvent.setup();
  render(<MyComponent />);

  await user.click(screen.getByRole('button', { name: 'Submit' }));
  expect(screen.getByText('Success')).toBeInTheDocument();
});
```

## Linting
```bash
npm run lint
```

## Adding a New Platform (Outline)
1. Add integration save/retrieve (encrypt credentials) in `lib/integrations/<platform>.ts`.
2. Add posting helper in `lib/platforms/<platform>Posting.ts`.
3. Extend platform detection in `src/app/api/agent/route.ts`.
4. Add a node to the posting StateGraph.
5. Update UI to collect credentials as needed.

## Troubleshooting
| Issue | Fix |
|-------|-----|
| 401 Unauthorized | Ensure Bearer token present & valid |
| 400 from /api/agent | Pre‑generation relevance check failed; add context or seed `messages`/`past_posts` |
| Worker doesn’t run jobs | Ensure `REDIS_URL` is set and worker is running (`npx tsx workers/schedulePostWorker.ts`) |
| Redis TLS errors | Use `rediss://` URL or adjust worker connection TLS settings |
| Encryption errors | Check `ENC_SECRET` length (32 bytes) |
| Vector search empty | Create Atlas vector index `vector_index` and seed embeddings |
| Posting fails | Verify platform tokens and `NEXT_PUBLIC_BASE_URL` |

## Contributing
1. Fork & branch.
2. Add or update tests.
3. Run lint & test.
4. Open PR with concise description.

## License
No license specified yet.

## Disclaimer
Use responsibly and comply with each platform’s API policies.
