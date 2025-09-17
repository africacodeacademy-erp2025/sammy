# SaMMy – Social Media Content Generator & Posting Orchestrator

SaMMy helps you draft, schedule, and post AI‑generated social media content to Twitter/X and Facebook (with groundwork for Slack context ingestion) using an agent workflow built on LangGraph + OpenAI, backed by MongoDB.

## Key Features
- AI drafting with context enrichment (vector search over prior Slack (planned) / stored messages)
- Draft → Review → Approve → Post workflow
- Automatic schedule time extraction (natural language → ISO 8601 UTC)
- Multi‑platform posting (Twitter/X & Facebook; Slack credential storage)
- Secure per‑user credential encryption (AES‑256-GCM)
- JWT authentication
- Background worker that materializes scheduled drafts
- Structured LangGraph state machines for generation & posting
- Post review UI with approve / reject
- TypeScript + Next.js (App Router) + Turbopack
- Tailwind CSS styling
- Jest + Testing Library setup

## Stack
| Layer | Tech |
|-------|------|
| UI / App | Next.js 15 (App Router), React 19 |
| State Machines | @langchain/langgraph (StateGraph) |
| AI | OpenAI (chat + embeddings) |
| DB | MongoDB Atlas (incl. vector index `vector_index`) |
| Auth | JWT (bcrypt password hashing) |
| Crypto | AES-256-GCM (token encryption) |
| Integrations | Twitter API v2, Facebook Graph API, Slack Web API |
| Worker | Node (tsx) interval process |
| Tests | Jest + @testing-library/react |

## High-Level Architecture (Text)
1. User authenticates → receives JWT.
2. User submits a natural language prompt to `/api/agent` (POST).
3. Platform detection + optional schedule time extraction (LLM).
4. If schedule time found → store as `scheduled` entry.
5. Else generate draft post (context via vector search) → return to UI for review.
6. User approves draft → `/api/agent` (PUT) triggers platform-specific posting node.
7. Background worker periodically promotes due scheduled prompts into AI-generated drafts for later approval.

## LangGraph Workflows
- Generation graph: `extractScheduleTime` → (if scheduled END) else `generatePost`
- Posting graph: conditional edge → `twitterPosting` or `facebookPosting`

## Main API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/agent` | Generate draft or schedule post |
| PUT  | `/api/agent` | Approve & publish a draft |
| POST | `/api/postings/x-posting` | Internal Twitter post relay |
| POST | `/api/postings/fb-posting` | Internal Facebook post relay |
| POST | `/api/auth/signup` | Create user |
| POST | `/api/auth/signin` | Login (returns JWT) |
| GET  | `/api/auth/me` | Current user profile |
| POST | `/api/integrations/twitter/connect` | Store Twitter creds (encrypted) |
| POST | `/api/integrations/facebook/connect` | Store Facebook creds (encrypted) |
| POST | `/api/integrations/slack/connect` | Store Slack creds (encrypted) |
| GET  | `/api/scheduledposts` | (If extended) list scheduled posts (placeholder route present) |

## Scripts
```bash
npm run dev        # Start Next.js (Turbopack)
npm run build      # Production build
npm start          # Start production server
npm run worker     # Start scheduled posts background worker
npm test           # Run test suite
npm run lint       # ESLint
```

## Environment Variables
Minimum required (.env):
```
# Core
MONGO_URI=mongodb+srv://...
DATABASE_NAME=sammy
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d                 # optional (default 7d)
ENC_SECRET=32_byte_key____________32_byte_key__  # 32 bytes for AES-256-GCM

# OpenAI
OPEN_AI_API=sk-...

# App
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# (Optional) Global platform defaults / bootstrap
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
- `ENC_SECRET` must be exactly 32 bytes (e.g. generate via `openssl rand -hex 16` then treat carefully).
- Per-user tokens are stored encrypted; these env vars may seed initial flows.

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

// collection: scheduledPosts
{
  _id, userId, prompt, platform, scheduleTime, status: "scheduled" | "ready_for_review" | "posted",
  post?, threadId?, createdAt, updatedAt
}
```

## Security & Privacy
- Passwords: `bcryptjs` with 10 rounds.
- JWT: Signed with `JWT_SECRET`, default expiry 7 days.
- External tokens: Encrypted at rest (AES-256-GCM with `ENC_SECRET`).
- Vector search: Only queries documents filtered by `userId`.
- Token extraction in requests always validates Bearer format.

## Scheduling Flow
1. User prompt includes time expression (e.g. “tomorrow 10:00 UTC”).
2. LLM normalizes → `scheduleTime`.
3. Entry stored as `status = "scheduled"`.
4. Worker (`npm run worker`) runs every 60s:
   - Finds due rows.
   - Generates post draft (no platform dispatch).
   - Marks `ready_for_review` with generated content.

## Example Draft Generation
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

If immediate draft (no time expression):
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

## Approving a Draft
```bash
curl -X PUT http://localhost:3000/api/agent \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"post":"<draft text>","platform":"facebook","threadId":"ab12cd34ef"}'
```

## Local Development
```bash
cp .env.example .env  # (if you create one)
npm install
npm run dev
# In a second terminal (optional for scheduling)
npm run worker
```
Open http://localhost:3000.

## Testing
- Unit / component tests: `npm test`
- Add new tests under `src/**` or co-located; Jest + jsdom configured in `jest.config.js`.
- Extend mocks in `__mocks__/`.

## Linting & Formatting
```bash
npm run lint
```
Adjust ESLint config in `eslint.config.mjs`.

## Adding a New Platform (Outline)
1. Create integration save/retrieve (encrypt credentials) in `lib/integrations/<platform>.ts`.
2. Create posting helper in `lib/platforms/<platform>Posting.ts`.
3. Extend `detectPlatform` in `api/agent/route.ts`.
4. Add node to posting StateGraph with conditional edge.
5. Adapt UI to expose credential inputs.

## Troubleshooting
| Issue | Fix |
|-------|-----|
| 401 Unauthorized | Ensure Bearer token present & valid |
| Schedule not generating draft | Worker running? `npm run worker` |
| Encryption errors | Verify `ENC_SECRET` length (32 bytes) |
| Vector search empty | Ensure Atlas vector index exists & embeddings stored |
| Posting fails | Verify platform tokens & `NEXT_PUBLIC_BASE_URL` |

## Roadmap Ideas
- Slack ingestion pipeline for message embeddings
- Additional platforms (LinkedIn, Instagram)
- Rich media attachments
- Admin dashboard for usage analytics

## Contributing
1. Fork & branch.
2. Add or update tests.
3. Run lint & test.
4. Open PR with concise description.

## License
No license specified yet. Add one (e.g. MIT) before public distribution.

## Disclaimer
Use responsibly. Ensure compliance with each platform’s API policies.
