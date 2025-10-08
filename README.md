# SaMMy – AI-Powered Social Media Assistant

**SaMMy** is an intelligent social media management platform that generates, schedules, and posts AI-powered content to Twitter/X and Facebook. Built with Next.js 15, LangGraph state machines, and OpenAI, it provides seamless OAuth integration, automatic context learning, and intelligent content generation based on your past posts and messaging style.

#### 📅 Scheduling System

### How Scheduling Works

**User Input:**

```
"Create a Twitter post about AI tomorrow at 2pm UTC"
```

**System Flow:**

1. **Time Extraction** (LangGraph node: `extractScheduleTime`)

   - LLM extracts and normalizes time to ISO 8601 UTC
   - Example: `2025-10-09T14:00:00Z`

2. **Job Enqueueing** (BullMQ)
   - Creates delayed Redis job scheduled for extracted time
   - Sa## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Development Process

1. **Fork the repository**

   ```bash
   git clone https://github.com/your-username/sammy.git
   cd sammy
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**

   - Follow existing code style and principles
   - Add TypeScript types (no `any` types)
   - Write clean, self-documenting code
   - Add comments for complex logic

3. **Test your changes**

   ```bash
   npm test
   npm run lint
   ```

4. **Commit with clear messages**

   ```bash
   git commit -m "feat: add LinkedIn integration"
   git commit -m "fix: resolve OAuth callback redirect issue"
   git commit -m "docs: update API documentation"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### Coding Standards

- ✅ TypeScript strict mode
- ✅ No `any` types
- ✅ Single Responsibility Principle
- ✅ Meaningful variable/function names
- ✅ Small, focused functions (5-15 lines)
- ✅ Comprehensive error handling
- ✅ Security best practices (encryption, validation)

### Commit Message Format

```
feat: add new feature
fix: bug fix
docs: documentation changes
style: code formatting
refactor: code restructuring
test: add/update tests
chore: maintenance tasks
```

## 📄 License

This project is currently **not licensed**. All rights reserved.

## ⚠️ Disclaimer

**Important:** This application interacts with third-party APIs (Twitter, Facebook, OpenAI). Users must:

- Comply with each platform's Terms of Service and API policies
- Respect rate limits and usage guidelines
- Obtain proper authorization before posting content
- Handle user data responsibly and in accordance with privacy laws
- Use the application ethically and legally

**The developers are not responsible for:**

- Misuse of the application
- Violations of third-party platform policies
- Data breaches or security issues arising from improper deployment
- Content generated or posted through the application

## 🙏 Acknowledgments

Built with:

- [Next.js](https://nextjs.org/) - React framework
- [LangGraph](https://github.com/langchain-ai/langgraph) - AI workflow orchestration
- [OpenAI](https://openai.com/) - AI models and embeddings
- [MongoDB Atlas](https://www.mongodb.com/atlas) - Database with vector search
- [BullMQ](https://docs.bullmq.io/) - Background job processing
- [Tailwind CSS](https://tailwindcss.com/) - Styling

## 📞 Support

For issues, questions, or contributions:

- Open an issue on GitHub
- Check existing documentation
- Review troubleshooting section

---

**Made with ❤️ for the AI and social media community**ledPosts`collection with status`"scheduled"`

3. **Background Processing** (Worker)

   - Worker polls Redis queue continuously
   - At scheduled time, job executes:
     - Performs vector search on user's past posts
     - Generates content using OpenAI with context
     - Updates database: `status = "ready_for_review"`
     - Stores generated `post` and `threadId`

4. **User Review**
   - User sees post in "Ready for Review" section
   - Approves or rejects draft
   - On approval: publishes to platform via LangGraph posting workflow

### Natural Language Examples

````
✅ "Post this on Twitter tomorrow at 9am"
✅ "Schedule a Facebook post for next Monday 3pm UTC"
✅ "Create a tweet about AI in 2 hours"
✅ "Post to Facebook on Oct 15 at 10:30 UTC"
```atures

- 🔐 **One-Click OAuth 2.0** - Connect Twitter and Facebook accounts with secure OAuth flows (no manual API keys!)
- 🤖 **AI Content Generation** - OpenAI-powered post creation with context-aware drafting
- 📊 **Automatic Context Learning** - Pulls and analyzes your past posts to match your writing style
- 🎯 **Vector-Based Intelligence** - Uses MongoDB vector search with embeddings for semantic post analysis
- ⏰ **Smart Scheduling** - Natural language schedule extraction ("tomorrow at 9am") with background workers
- ✅ **Review & Approve Workflow** - Preview generated posts before publishing
- 🔒 **Enterprise Security** - AES-256-GCM encryption for all credentials and tokens
- 🚀 **Multi-Platform** - Simultaneous posting to Twitter/X and Facebook
- 📱 **Modern Stack** - Next.js 15, React 19, TypeScript, Tailwind CSS

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd sammy
npm install
````

### 2. Environment Setup

```bash
cp .env.example .env
# Edit .env with your credentials (see Environment Variables section)
```

### 3. Configure OAuth Applications

**Twitter (X):**

1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create a new app or select existing app
3. Enable OAuth 2.0 with PKCE
4. Add redirect URI: `http://localhost:3000/api/integrations/twitter/callback`
5. Copy Client ID and Client Secret to `.env`

**Facebook:**

1. Go to [Facebook Developers](https://developers.facebook.com/apps/)
2. Create a new app or select existing app
3. Add Facebook Login product
4. Add redirect URI: `http://localhost:3000/api/integrations/facebook/callback`
5. Copy App ID and App Secret to `.env`

### 4. Start Development

```bash
# Start Next.js server
npm run dev

# In a separate terminal, start the background worker
npx tsx workers/schedulePostWorker.ts
```

### 5. Access the Application

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📚 How It Works

### User Flow

1. **Sign Up / Login** - Create account with email/password (JWT authentication)
2. **Connect Platforms** - One-click OAuth for Twitter and Facebook
3. **Automatic Learning** - System automatically pulls your recent posts (10 tweets, 5 Facebook posts)
4. **Generate Content** - Chat with AI to create posts: "Create a Twitter post about AI trends"
5. **Review & Approve** - Preview generated content before publishing
6. **Schedule or Post** - Post immediately or schedule for later

### Intelligent Context System

**Vector Search Technology:**

- Automatically generates embeddings for all your past posts
- Uses semantic search to find similar content when generating new posts
- Learns your writing style, tone, and preferred topics
- Matches platform-specific characteristics (280 chars for Twitter, longer for Facebook)

**Automatic Past Posts Pulling:**

- Twitter: Fetches 10 most recent tweets on OAuth connection
- Facebook: Fetches 5 most recent posts on OAuth connection
- Runs in background without blocking user experience
- Generates embeddings for semantic search
- Deduplicates automatically to prevent data redundancy

## 🛠️ Technology Stack

| Category             | Technologies                                                                |
| -------------------- | --------------------------------------------------------------------------- |
| **Frontend**         | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS                 |
| **AI & LLM**         | OpenAI GPT (content generation), OpenAI Embeddings (text-embedding-3-small) |
| **State Management** | LangGraph (StateGraph for AI workflows)                                     |
| **Database**         | MongoDB Atlas with Vector Search (`vector_index` for embeddings)            |
| **Authentication**   | JWT tokens, bcrypt password hashing                                         |
| **Security**         | AES-256-GCM encryption for OAuth tokens and credentials                     |
| **OAuth 2.0**        | Twitter API v2 (with PKCE), Facebook Graph API v21.0                        |
| **Background Jobs**  | BullMQ + Redis (scheduled post processing)                                  |
| **API Integrations** | Twitter API v2, Facebook Graph API, Slack Web API                           |
| **Testing**          | Jest, @testing-library/react                                                |
| **Dev Tools**        | Turbopack, ESLint, TypeScript strict mode                                   |

## 🏗️ Architecture Overview

### Authentication & Security Flow

```
User Registration/Login
    ↓
JWT Token Generation
    ↓
Token-based API Authentication
    ↓
AES-256-GCM Encrypted Credential Storage
```

### OAuth 2.0 Connection Flow

```
User clicks "Connect X Account" / "Connect Facebook"
    ↓
Redirect to OAuth Provider (Twitter/Facebook)
    ↓
User Authorizes Application
    ↓
OAuth Callback with Authorization Code
    ↓
Exchange Code for Access Token (+ Refresh Token for Twitter)
    ↓
Encrypt & Store Tokens in MongoDB
    ↓
[AUTOMATIC] Pull Past Posts in Background
    ↓
Generate Embeddings with OpenAI
    ↓
Save to past_posts Collection
    ↓
User Redirected to App (Connection Complete)
```

### Content Generation Flow

```
User: "Create a Twitter post about AI"
    ↓
LangGraph: Detect Platform & Check for Schedule Time
    ↓
[If Scheduled] → Enqueue BullMQ Job → END
    ↓
[If Immediate] → Vector Search past_posts
    ↓
Find Similar Posts (Semantic Search)
    ↓
OpenAI: Generate Post with Context
    ↓
Return Draft for User Review
    ↓
User Approves → LangGraph Posting Workflow
    ↓
Platform-Specific API Call (Twitter/Facebook)
    ↓
Success Response
```

### Background Worker Flow

```
BullMQ Worker (Runs Continuously)
    ↓
Check for Scheduled Posts Due
    ↓
Generate Content with User Context
    ↓
Mark as "ready_for_review"
    ↓
User Approves via UI
    ↓
Post to Platform
```

### LangGraph State Machines

**Generation Workflow:**

````typescript
START
  ↓
checkGreeting → [if greeting] → END
  ↓
extractScheduleTime → [if scheduled] → END
## 📡 API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create new user account |
| POST | `/api/auth/signin` | Login (returns JWT token) |
| GET | `/api/auth/me` | Get current user profile |

### OAuth Integration
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/integrations/twitter/oauth` | Initiate Twitter OAuth 2.0 flow |
| GET | `/api/integrations/twitter/callback` | Twitter OAuth callback (exchanges code for tokens) |
| POST | `/api/integrations/twitter/connect` | Manually store Twitter credentials (legacy) |
| GET | `/api/integrations/facebook/oauth` | Initiate Facebook OAuth flow |
| GET | `/api/integrations/facebook/callback` | Facebook OAuth callback (exchanges code for tokens) |
| POST | `/api/integrations/facebook/connect` | Manually store Facebook credentials (legacy) |
| POST | `/api/integrations/slack/connect` | Store Slack credentials |

### Content Generation & Posting
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/agent` | Generate content or schedule post (LangGraph workflow) |
| PUT | `/api/agent` | Approve & publish draft to platform |
| POST | `/api/postings/x-posting` | Internal Twitter posting endpoint |
| POST | `/api/postings/fb-posting` | Internal Facebook posting endpoint |

### Content Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/scheduledposts` | List user's scheduled posts |
| DELETE | `/api/scheduledposts?id=<id>` | Delete scheduled post |
| GET | `/api/pulling/x-pulling` | Pull & embed recent tweets |
| GET | `/api/pulling/fb-pulling` | Pull & embed recent Facebook posts |

### Context Sources
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sources/slack` | Fetch Slack messages for context |
| POST | `/api/sources/slack/events` | Slack Events webhook endpoint |

### User Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user` | Get user profile with platform connections |
| POST   | `/api/auth/signup`                    | Create user                                                 |
| POST   | `/api/auth/signin`                    | Login (returns JWT)                                         |
| GET    | `/api/auth/me`                        | Current user profile                                        |
| GET    | `/api/integrations/twitter/oauth`     | Initiate Twitter OAuth flow                                 |
| GET    | `/api/integrations/twitter/callback`  | Twitter OAuth callback                                      |
| POST   | `/api/integrations/twitter/connect`   | Store Twitter creds (encrypted)                             |
| GET    | `/api/integrations/facebook/oauth`    | Initiate Facebook OAuth flow                                |
| GET    | `/api/integrations/facebook/callback` | Facebook OAuth callback                                     |
| POST   | `/api/integrations/facebook/connect`  | Store Facebook creds (encrypted)                            |
| POST   | `/api/integrations/slack/connect`     | Store Slack creds (encrypted)                               |
| GET    | `/api/scheduledposts`                 | List scheduled posts (basic/placeholder)                    |
| POST   | `/api/sources/slack`                  | Ingest Slack messages for embeddings (user-scoped)          |
| POST   | `/api/sources/slack/events`           | Slack Events endpoint (ingestion)                           |
| POST   | `/api/pulling/x-pulling`              | Pull/embedding helper for Twitter                           |
| POST   | `/api/pulling/fb-pulling`             | Pull/embedding helper for Facebook                          |

## 🐳 Docker Deployment

### Development with Docker

```bash
# Build and run with hot reload
docker compose -f docker-compose.dev.yml up --build

# Run worker inside container
docker compose -f docker-compose.dev.yml exec sammy-app npx tsx workers/schedulePostWorker.ts
````

### Production with Docker

```bash
# Build and run production
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build

# View logs
docker compose -f docker-compose.yml -f docker-compose.override.yml logs -f

# Stop services
docker compose -f docker-compose.yml -f docker-compose.override.yml down
```

**Production Notes:**

- Exposes port `3000:3000`
- Reads environment from `.env` file
- Next.js configured to bind to `0.0.0.0`
- Multi-stage build for minimal image size

### Adding Redis Service (Optional)

```yaml
# Add to docker-compose.yml
services:
  redis:
    image: redis/redis-stack-server:latest
    ports:
      - "6379:6379"
    networks:
      - sammy_network
```

Then use: `REDIS_URL=redis://redis:6379`

## ⚙️ Environment Variables

Create a `.env` file in the root directory:

```bash
# ============================================
# Database
# ============================================
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/
DATABASE_NAME=sammy

# ============================================
# Authentication & Security
# ============================================
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d
ENCRYPTION_KEY=32_byte_hex_key_for_aes_256_encryption__  # Must be exactly 32 bytes

# ============================================
# OpenAI
# ============================================
OPEN_AI_API=sk-proj-your_openai_api_key_here

# ============================================
# Application URLs
# ============================================
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ============================================
# Background Jobs (BullMQ + Redis)
# ============================================
REDIS_URL=rediss://default:password@hostname:port
# For local Redis without TLS: redis://localhost:6379

# ============================================
# Twitter OAuth 2.0
# ============================================
TWITTER_CLIENT_ID=your_twitter_oauth2_client_id
TWITTER_CLIENT_SECRET=your_twitter_oauth2_client_secret
TWITTER_REDIRECT_URI=http://localhost:3000/api/integrations/twitter/callback

# ============================================
# Facebook OAuth 2.0
# ============================================
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_REDIRECT_URI=http://localhost:3000/api/integrations/facebook/callback

# ============================================
# Slack (Optional - for context ingestion)
# ============================================
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_USER_TOKEN=xoxp-your-user-token
```

### Environment Variable Notes

- **ENCRYPTION_KEY**: Must be exactly 32 bytes for AES-256-GCM encryption. Generate with:

  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

- **REDIS_URL**:

  - Use `rediss://` for TLS-enabled Redis (recommended for production)
  - Use `redis://` for local development without TLS
  - Worker code requires Redis for BullMQ job queue

- **OAuth Redirect URIs**:

  - Development: `http://localhost:3000/api/integrations/{platform}/callback`
  - Production: Update with your production domain

- **NEXT_PUBLIC_BASE_URL**: Used internally for API calls between services
  pages?: [
  {
  id: string,
  name: string,
  accessToken: string // Encrypted
  }
  ]
  },
  slack?: {
  workspaceId?: string,
  botToken?: string, // Encrypted
  userToken?: string, // Encrypted
  channels?: string
  },
  createdAt: Date,
  updatedAt: Date
  }

````

#### `past_posts`
```typescript
{
  _id: ObjectId,
  userId: string,
  postId: string,                 // Platform's post ID
  message: string,                // Post content
  embedding: number[],            // 1536-dim vector (OpenAI text-embedding-3-small)
  platform: "twitter" | "facebook",
  createdAt: Date
## 📝 API Usage Examples

### 1. User Registration
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123"
  }'
````

**Response:**

```json
{
  "success": true,
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 2. User Login

```bash
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123"
  }'
```

**Response:**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com"
  }
}
```

### 3. Generate Immediate Post

```bash
curl -X POST http://localhost:3000/api/agent \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a Twitter post about the future of AI in education"
  }'
```

**Response:**

```json
{
  "success": true,
  "review": {
    "post": "🤖 AI is transforming education! From personalized learning paths to instant feedback, students now have access to tools that adapt to their unique needs. The future is about augmenting human potential, not replacing teachers. #EdTech #AIinEducation",
    "threadId": "a1b2c3d4e5",
    "platform": "twitter",
    "userId": "507f1f77bcf86cd799439011"
  }
}
```

### 4. Schedule a Post

```bash
curl -X POST http://localhost:3000/api/agent \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Post on Facebook about our product launch tomorrow at 9am UTC"
  }'
```

**Response:**

## 🔧 Development Workflow

### Local Development

```bash
# Install dependencies
npm install

# Start Next.js dev server (with Turbopack)
npm run dev

# In a separate terminal, start the background worker
npx tsx workers/schedulePostWorker.ts

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint
```

Access the application at [http://localhost:3000](http://localhost:3000)

### MongoDB Atlas Setup

1. Create a free MongoDB Atlas account
2. Create a new cluster
3. Add your IP to the whitelist
4. Create a database user
5. Get your connection string
6. **Create Vector Search Index:**
   - Database: `sammy`
   - Collection: `past_posts`
   - Index Name: `vector_index`
   - Field: `embedding`
   - Dimensions: 1536
   - Similarity: cosine

### Redis Setup (for Scheduling)

**Option 1: Local Redis**

```bash
# Install Redis
# macOS
brew install redis

# Ubuntu/Debian
sudo apt-get install redis-server

# Start Redis
redis-server
```

**Option 2: Managed Redis (Recommended)**

- Use Upstash, Redis Cloud, or similar
- Get connection URL (with TLS support recommended)
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
  "post": "🤖 AI is transforming education!...",
  "platform": "twitter",
  "threadId": "a1b2c3d4e5"
  }'

````

**Response:**
```json
{
  "success": true,
  "posted": true,
  "result": {
    "success": true,
    "tweet": {
      "data": {
        "id": "1975875673022431268",
        "text": "🤖 AI is transforming education!..."
      }
    }
  }
}
````

### 6. Pull Past Posts

```bash
# Pull recent tweets (automatically pulls 10)
curl -X GET "http://localhost:3000/api/pulling/x-pulling?count=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Pull recent Facebook posts (automatically pulls 5)
curl -X GET "http://localhost:3000/api/pulling/fb-pulling?count=5" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**

````json
{
  "success": true,
  "posts": [
    {
      "_id": "507f191e810c19729de860ea",
      "userId": "507f1f77bcf86cd799439011",
      "postId": "1975875673022431268",
      "message": "Excited for Demo Day!...",
      "embedding": [0.123, -0.456, ...],
      "platform": "twitter",
      "createdAt": "2025-10-08T10:30:00.000Z"
    }
  ]
}
```id, userId, platform: "twitter" | "facebook", message, embedding: number[]
}

// collection: scheduledPosts
{
  _id, userId, prompt, platform, scheduleTime,
  status: "scheduled" | "ready_for_review" | "posted",
  post?, threadId?, isScheduled?, createdAt, updatedAt
}
````

## Scheduling Flow

## 🧪 Testing

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

### Test Structure

- **Framework**: Jest + @testing-library/react
- **Configuration**: `jest.config.js`
- **Setup**: `jest.setup.ts`
- **Mocks**: `__mocks__/` directory

### Example Test

```typescript
// src/app/page.test.tsx
import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("Home Page", () => {
  it("renders the welcome message", () => {
    render(<Home />);
    expect(screen.getByText(/Welcome to SaMMy/i)).toBeInTheDocument();
  });
});
```

## 🎨 Code Quality

### Linting

```bash
# Run ESLint
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

### TypeScript

- **Strict Mode**: Enabled
- **No `any` types**: All code properly typed
- **Interfaces**: Defined for all data structures

### Code Principles Applied

- ✅ **Single Responsibility Principle** - Each function does one thing
- ✅ **DRY (Don't Repeat Yourself)** - Reusable helper functions
- ✅ **Type Safety** - Full TypeScript coverage
- ✅ **Clean Code** - Meaningful names, small functions, clear intent
- ✅ **Security First** - All credentials encrypted, JWT authentication

## 🔌 Adding a New Platform

To integrate a new social media platform (e.g., LinkedIn, Instagram):

### 1. Create Integration Module

```typescript
// lib/integrations/linkedin.ts
export async function saveLinkedInConfig(
  userId: string,
  config: LinkedInConfig
) {
  // Encrypt and save tokens
}

export async function getLinkedInClient(userId: string) {
  // Return authenticated client
}
```

### 2. Create Posting Function

```typescript
// lib/platforms/linkedinPosting.ts
export async function linkedinPosting(
  state: GraphState
): Promise<Partial<GraphState>> {
  // Validate state
  // Send API request
  // Return result
}
```

### 3. Add OAuth Routes

```typescript
// src/app/api/integrations/linkedin/oauth/route.ts
// src/app/api/integrations/linkedin/callback/route.ts
```

### 4. Update Agent Route

```typescript
// src/app/api/agent/route.ts
function detectPlatform(prompt: string, platform?: string) {
  if (normalized.includes("linkedin")) return { platform: "linkedin" };
  // ...
}
```

### 5. Add to LangGraph Workflow

```typescript
postWorkflow.addNode("linkedinPosting", linkedinPosting);
postWorkflow.addConditionalEdges(START, (s) =>
  s.platform === "linkedin" ? "linkedinPosting" : /* ... */
);
```

### 6. Update UI

Add LinkedIn connection button in `CredentialsSidebar.tsx`
{
"success": true,
"scheduled": true,
"message": "Post scheduled for 2025-09-18T09:30:00Z"
}

````

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
````

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
new IORedis(process.env.REDIS_URL!, { tls: {}, maxRetriesPerRequest: null });
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
      dockerfile: Dockerfile.dev # or Dockerfile.prod
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

```bash
npm test
```

- Jest + jsdom configured in `jest.config.js`.
- Mocks under `__mocks__/`.

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

| Issue                   | Fix                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| 401 Unauthorized        | Ensure Bearer token present & valid                                                       |
| 400 from /api/agent     | Pre‑generation relevance check failed; add context or seed `messages`/`past_posts`        |
| Worker doesn’t run jobs | Ensure `REDIS_URL` is set and worker is running (`npx tsx workers/schedulePostWorker.ts`) |
| Redis TLS errors        | Use `rediss://` URL or adjust worker connection TLS settings                              |
| Encryption errors       | Check `ENC_SECRET` length (32 bytes)                                                      |
| Vector search empty     | Create Atlas vector index `vector_index` and seed embeddings                              |
| Posting fails           | Verify platform tokens and `NEXT_PUBLIC_BASE_URL`                                         |

## Contributing

1. Fork & branch.
2. Add or update tests.
3. Run lint & test.
4. Open PR with concise description.

## License

No license specified yet.

## Disclaimer

Use responsibly and comply with each platform’s API policies.
