# SaMMy – AI-Powered Social Media Assistant

**🌐 Live App:** https://sammy.africacodefoundry.com/

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

2. **Job Enqueueing** (Agenda + MongoDB)

   - Creates scheduled job stored in MongoDB
   - Background worker processes at scheduled time

3. **Background Processing** (Worker)

   - Worker polls Agenda queue continuously
   - At scheduled time, job executes:
     - Performs vector search on user's past posts
     - Generates content using OpenAI with context
     - Updates database: `status = "ready_for_review"`
     - Stores generated `post` and `threadId`

4. **User Review**
   - User sees post in "Ready for Review" section
   - Approves or rejects draft
   - On approval: publishes to platform via LangGraph posting workflow

### 🔄 Recurring Scheduling System

**SaMMy supports automated recurring post schedules** - create posts that automatically generate and queue at regular intervals without manual intervention.

#### How Recurring Scheduling Works

**User Interaction:**

1. User creates a post with a specific prompt (e.g., "Share a productivity tip")
2. Opens the **Recurrence Modal** from the agent interface
3. Selects recurrence pattern:
   - **Daily**: Every day or specific days of the week (Mon, Tue, Wed, etc.)
   - **Weekly**: Every 7 days from creation
   - **Monthly**: Specific months of the year (Jan, Feb, Mar, etc.)
4. Sets the time (e.g., "09:00" in 24-hour format)
5. Confirms - system stores recurring schedule

**Backend Processing:**

1. **Storage** (`recurringPosts` collection in MongoDB)

   ```typescript
   {
     _id: ObjectId,
     userId: string,
     platform: "twitter" | "facebook",
     prompt: string,
     frequency: "daily" | "weekly" | "monthly",
     time: string, // "HH:mm" format
     selectedDays?: number[], // [0-6] for daily (0=Sun, 6=Sat)
     selectedMonths?: number[], // [1-12] for monthly
     nextOccurrence: Date, // When next post should be created
     isActive: boolean,
     createdAt: Date,
     updatedAt: Date
   }
   ```

2. **Background Worker** (`schedulePostWorker.ts`)

   - Runs `check-recurring-posts` job **every minute** via Agenda
   - Queries all active recurring posts where `nextOccurrence <= now`
   - For each due post:
     - Creates a new `scheduledPosts` document with status "ready_for_review"
     - Generates AI content using the stored prompt
     - Calculates and updates `nextOccurrence` to next interval
     - Logs processing for monitoring

3. **Automatic Next Occurrence Calculation**

   - **Daily**: Advances to next selected day of week (or next day if all days selected)
   - **Weekly**: Adds 7 days from previous occurrence
   - **Monthly**: Advances to next selected month at specified time

4. **User Management** (RecurringPostsView Component)
   - View all recurring schedules
   - Pause/Resume individual schedules (toggles `isActive`)
   - Edit prompt or recurrence settings
   - Delete recurring schedules
   - Real-time status display with next occurrence timestamp

#### Recurring Schedule Examples

```
✅ "Post daily motivational quote at 8am"
   → Frequency: daily, Time: 08:00, Days: All

✅ "Weekly newsletter on Mondays at 10am"
   → Frequency: daily, Time: 10:00, Days: [1] (Monday only)

✅ "Monthly product update on the 1st at 3pm"
   → Frequency: monthly, Time: 15:00, Months: All

✅ "Holiday greetings in Dec at 9am"
   → Frequency: monthly, Time: 09:00, Months: [12] (December only)
```

#### Worker Architecture

The recurring posts system uses **Agenda** (job scheduling library) with MongoDB persistence:

```typescript
// Every minute check
agenda.every("1 minute", "check-recurring-posts");

// Job lifecycle
agenda.on("success", async (job) => {
  // Preserve recurring jobs, remove one-time jobs
  if (!job.attrs.repeatInterval) {
    await job.remove(); // Clean up one-time scheduled posts
  }
});
```

**Key Features:**

- ✅ **Persistent scheduling**: Survives server restarts (MongoDB-backed)
- ✅ **Minute-level precision**: Checks every 60 seconds
- ✅ **Auto-cleanup**: Removes old one-time jobs, preserves recurring jobs
- ✅ **Graceful shutdown**: Properly stops Agenda on process termination
- ✅ **Timezone-aware**: All times stored and calculated in UTC
- ✅ **Smart recalculation**: Handles past-due posts by advancing to next valid occurrence

#### Natural Language Examples

```
✅ "Post this on Twitter tomorrow at 9am"
✅ "Schedule a Facebook post for next Monday 3pm UTC"
✅ "Create a tweet about AI in 2 hours"
✅ "Post to Facebook on Oct 15 at 10:30 UTC"
```

### 📜 Conversation History

**SaMMy includes a comprehensive conversation history system** that allows users to save, manage, and restore previous AI chat conversations with full context preservation.

#### How Conversation History Works

**User Experience:**

1. **Automatic Saving** - All AI chat conversations are automatically saved with unique thread IDs
2. **History Access** - Click the "History" button to open the Conversation History modal
3. **View Conversations** - Browse all past conversations with metadata:
   - Conversation title (auto-generated from first message)
   - Last user message preview
   - Message count in the thread
   - Platform (Twitter/Facebook if applicable)
   - Last updated timestamp
4. **Load Conversation** - Click "Load" to restore a previous conversation with full context
5. **Delete Conversations** - Remove unwanted conversations permanently

#### Technical Implementation

**Database Schema:**

```typescript
// Chat messages stored per conversation thread
{
  _id: ObjectId,
  userId: ObjectId,
  threadId: string,        // Unique conversation identifier
  role: "user" | "assistant" | "system",
  content: string,
  platform?: string,       // "twitter" | "facebook" | null
  timestamp: Date,
  metadata?: {
    postStatus?: string,
    scheduledFor?: Date
  }
}
```

**Features:**

- ✅ **Thread-based Storage** - All messages grouped by unique `threadId`
- ✅ **Full Context Restoration** - When loading a conversation, entire message history is retrieved
- ✅ **Metadata Preservation** - Platform, timestamps, and post statuses preserved
- ✅ **User-scoped** - Each user only sees their own conversation history
- ✅ **Automatic Cleanup** - Option to delete old or unwanted conversations
- ✅ **Real-time Updates** - Conversation list updates as new messages are sent

**API Endpoints:**

```typescript
// Get all conversations for current user
GET /api/chat/history
Response: [{
  threadId: string,
  title: string,
  lastUserMessage: string,
  messageCount: number,
  platform?: string,
  updatedAt: string
}]

// Load specific conversation
GET /api/chat/history/:threadId
Response: {
  threadId: string,
  messages: Array<ChatMessage>
}

// Delete conversation
DELETE /api/chat/history/:threadId
Response: { success: boolean }
```

**Frontend Component:**

- **HistoryModal** (`Components/HistoryModal.tsx`)
  - Beautiful modal interface with dark theme
  - Loading states and empty states
  - Load and delete actions per conversation
  - Message count and timestamp display
  - Platform badges (Twitter/Facebook)
  - Responsive design with overflow handling

**Usage in Chatbot:**

```typescript
// Open history modal
<button onClick={() => setShowHistory(true)}>
  <History /> View History
</button>;

// Load conversation
const handleLoadConversation = async (threadId: string) => {
  const response = await fetch(`/api/chat/history/${threadId}`);
  const data = await response.json();
  setMessages(data.messages); // Restore full conversation
  setCurrentThreadId(threadId); // Continue in same thread
};

// Delete conversation
const handleDeleteConversation = async (threadId: string) => {
  await fetch(`/api/chat/history/${threadId}`, { method: "DELETE" });
  refreshConversations(); // Reload list
};
```

**Benefits:**

- 🔄 **Context Continuity** - Pick up conversations where you left off
- 📊 **Conversation Tracking** - See all your AI interactions in one place
- 🎯 **Efficient Workflow** - No need to re-explain context in new chats
- 🗑️ **Privacy Control** - Delete conversations you no longer need
- 📱 **Modern UI** - Beautiful, intuitive interface with smooth animations

## 🤝 Contributing

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
```

## ✨ Key Features

- 🔐 **One-Click OAuth 2.0** - Connect Twitter, Facebook, and Slack accounts with secure OAuth flows (no manual API keys!)
- 🔑 **Complete Authentication System** - Secure user registration, login, password reset with email verification, and profile management
- 🤖 **AI Content Generation** - OpenAI-powered post creation with context-aware drafting
- 📊 **Automatic Context Learning** - Pulls and analyzes your past posts and Slack messages to match your writing style
- 🎯 **Vector-Based Intelligence** - Uses MongoDB vector search with embeddings for semantic post analysis
- ⏰ **Smart Scheduling** - Natural language schedule extraction ("tomorrow at 9am") with background workers
- 📜 **Conversation History** - Save, load, and manage past AI chat conversations with full context restoration
- ✅ **Review & Approve Workflow** - Preview generated posts before publishing
- 🔒 **Enterprise Security** - AES-256-GCM encryption for all credentials and tokens
- 🚀 **Multi-Platform** - Simultaneous posting to Twitter/X and Facebook
- 💬 **Slack Integration** - Automatic message ingestion for context learning with real-time webhook support
- 📱 **Modern Stack** - Next.js 15, React 19, TypeScript, Tailwind CSS
- 📧 **Email Notifications** - Password reset emails with Gmail SMTP integration
- 👤 **Profile Management** - Update email, change password, and manage account settings

## 🚀 Quick Start

### 🔐 OAuth 2.0 Security Model

SaMMy uses **OAuth 2.0 exclusively** for all platform integrations:

- **Twitter/X**: OAuth 2.0 with PKCE (no API keys needed)
- **Facebook**: OAuth 2.0 with proper scopes
- **Slack**: OAuth 2.0 with workspace-level permissions
- **No Manual Tokens**: All credentials obtained through secure OAuth flows
- **Encrypted Storage**: All tokens encrypted with AES-256-GCM before database storage
- **Auto-Refresh**: Refresh tokens handled automatically (Twitter)

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
4. Add redirect URIs:
   - **Production:** `https://sammy.africacodefoundry.com/api/integrations/twitter/callback`
   - **Development:** `http://localhost:3000/api/integrations/twitter/callback`
5. Copy Client ID and Client Secret to `.env`

**Facebook:**

1. Go to [Facebook Developers](https://developers.facebook.com/apps/)
2. Create a new app or select existing app
3. Add Facebook Login product
4. Add redirect URIs:
   - **Production:** `https://sammy.africacodefoundry.com/api/integrations/facebook/callback`
   - **Development:** `http://localhost:3000/api/integrations/facebook/callback`
5. Copy App ID and App Secret to `.env`

**Slack (Optional - for context ingestion):**

1. Go to [Slack API](https://api.slack.com/apps/)
2. Create a new app or select existing app
3. Enable OAuth 2.0 with required scopes:
   - `channels:history` - Read public channel messages
   - `channels:read` - List public channels
   - `groups:history` - Read private channel messages
   - `groups:read` - List private channels
   - `users:read` - Read user information
   - `chat:write` - Send messages
4. Add redirect URIs:
   - **Production:** `https://sammy.africacodefoundry.com/api/integrations/slack/callback`
   - **Development:** `http://localhost:3000/api/integrations/slack/callback`
5. Copy Client ID and Client Secret to `.env`
6. Configure Event Subscriptions (optional for real-time ingestion):
   - **Production Request URL:** `https://sammy.africacodefoundry.com/api/sources/slack/events`
   - **Development Request URL:** `http://localhost:3000/api/sources/slack/events` (requires ngrok or similar)
   - Subscribe to `message.channels` and `message.groups` events

**Gmail SMTP (for password reset emails):**

1. **Enable 2-Step Verification** for your Gmail account
2. Go to [Google Account Settings](https://myaccount.google.com/) → Security
3. Under "How you sign in to Google" → "2-Step Verification"
4. Scroll down to "App passwords" and click "Generate"
5. Select "Mail" and "Other (custom name)" → enter "SaMMy App"
6. Copy the generated 16-character app password
7. Add to `.env`:
   ```bash
   SMTP_USER=your_gmail_address@gmail.com
   SMTP_PASS=your_16_character_app_password
   ```

### 3. Start Development

```bash
# Start Next.js server and background worker together
npm run dev:all

# Or run them separately:
# Terminal 1: Start Next.js server
npm run dev

# Terminal 2: Start the background worker (for scheduled & recurring posts)
npx tsx workers/schedulePostWorker.ts
```

### 5. Access the Application

**Live Production App:** [https://sammy.africacodefoundry.com/](https://sammy.africacodefoundry.com/)

**Local Development:** Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Test Email Functionality (Optional)

To verify that password reset emails are working:

```bash
# Test the email configuration
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "your_test_email@example.com"}'
```

Check your email for the password reset link. The system will also log fallback reset links to the console if email delivery fails.

## 📚 How It Works

### User Flow

1. **Sign Up / Login** - Create account with email/password (JWT authentication)
2. **Connect Platforms** - One-click OAuth for Twitter, Facebook, and Slack
3. **Automatic Learning** - System automatically pulls your recent posts (10 tweets, 5 Facebook posts) and Slack messages from connected channels
4. **Generate Content** - Chat with AI to create posts: "Create a Twitter post about AI trends"
5. **Review & Approve** - Preview generated content before publishing
6. **Schedule or Post** - Post immediately or schedule for later

### 🔐 Authentication & Security Features

**Complete User Management System:**

- **User Registration & Login** - Secure account creation with email/password and JWT authentication
- **Password Reset Flow** - Forgot password functionality with secure email verification
  - Dynamic base URL detection (works in any deployment environment)
  - Gmail SMTP integration for reliable email delivery
  - Secure token generation with 24-hour expiration
  - Clean, professional email templates with branding
- **Profile Management Sidebar** - In-app user profile management with tabbed interface
  - **Email Update** - Change account email with validation
  - **Password Change** - Update password with current password verification
  - **Real-time Validation** - Form validation with user-friendly error messages
- **Security Best Practices**
  - JWT token-based authentication
  - bcrypt password hashing with salt
  - Secure token generation for password resets
  - Input validation and sanitization
  - Environment-aware email configuration

**Email Integration:**

- **Gmail SMTP** - Reliable email delivery using Gmail's SMTP service
- **Professional Templates** - Branded email templates with modern design
- **Dynamic URLs** - Automatically detects deployment environment (localhost, production, etc.)
- **Fallback Logging** - Debug support with fallback reset links in console logs

### Intelligent Context System

**Vector Search Technology:**

- Automatically generates embeddings for all your past posts
- Uses semantic search to find similar content when generating new posts
- Learns your writing style, tone, and preferred topics
- Matches platform-specific characteristics (280 chars for Twitter, longer for Facebook)

**Automatic Past Posts Pulling:**

- Twitter: Fetches 10 most recent tweets on OAuth connection
- Facebook: Fetches 5 most recent posts on OAuth connection
- Slack: Fetches recent messages from channels where bot is a member (3 messages per channel)
- Runs in background without blocking user experience
- Generates embeddings for semantic search
- Deduplicates automatically to prevent data redundancy

**Real-time Slack Integration:**

- Automatic webhook-based message ingestion from connected Slack workspaces
- Processes messages from all channels where the bot is a member
- Generates embeddings for new messages to enhance context learning
- OAuth 2.0 security with encrypted token storage

## 🛠️ Technology Stack

| Category             | Technologies                                                                |
| -------------------- | --------------------------------------------------------------------------- |
| **Frontend**         | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS                 |
| **AI & LLM**         | OpenAI GPT (content generation), OpenAI Embeddings (text-embedding-3-small) |
| **State Management** | LangGraph (StateGraph for AI workflows)                                     |
| **Database**         | MongoDB Atlas with Vector Search (`vector_index` for embeddings)            |
| **Authentication**   | JWT tokens, bcrypt password hashing                                         |
| **Security**         | AES-256-GCM encryption for OAuth tokens and credentials                     |
| **OAuth 2.0**        | Twitter API v2 (with PKCE), Facebook Graph API v21.0, Slack Web API         |
| **Background Jobs**  | Agenda 5.0.0 + MongoDB (scheduled & recurring post processing)              |
| **API Integrations** | Twitter API v2, Facebook Graph API, Slack Web API (OAuth 2.0)               |
| **Testing**          | Jest, @testing-library/react                                                |
| **Dev Tools**        | Turbopack, ESLint, TypeScript strict mode, concurrently                     |

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
User clicks "Connect X Account" / "Connect Facebook" / "Connect Slack"
    ↓
Redirect to OAuth Provider (Twitter/Facebook/Slack)
    ↓
User Authorizes Application
    ↓
OAuth Callback with Authorization Code
    ↓
Exchange Code for Access Token (+ Refresh Token for Twitter)
    ↓
Encrypt & Store Tokens in MongoDB
    ↓
[AUTOMATIC] Pull Past Posts/Messages in Background
    ↓
Generate Embeddings with OpenAI
    ↓
Save to past_posts Collection (Twitter/Facebook) or messages Collection (Slack)
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
| POST | `/api/auth/forgot-password` | Send password reset email |
| POST | `/api/auth/reset-password` | Reset password with token |
| PUT | `/api/auth/change-password` | Change password (authenticated) |
| PUT | `/api/auth/update-email` | Update user email (authenticated) |

### OAuth Integration
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/integrations/twitter/oauth` | Initiate Twitter OAuth 2.0 flow |
| GET | `/api/integrations/twitter/callback` | Twitter OAuth callback (exchanges code for tokens) |
| POST | `/api/integrations/twitter/connect` | Manually store Twitter credentials (legacy) |
| GET | `/api/integrations/facebook/oauth` | Initiate Facebook OAuth flow |
| GET | `/api/integrations/facebook/callback` | Facebook OAuth callback (exchanges code for tokens) |
| POST | `/api/integrations/facebook/connect` | Manually store Facebook credentials (legacy) |
| GET | `/api/integrations/slack/oauth` | Initiate Slack OAuth 2.0 flow |
| GET | `/api/integrations/slack/callback` | Slack OAuth callback (exchanges code for tokens) |

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

### Recurring Posts Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/recurring-posts` | Create new recurring schedule |
| GET | `/api/recurring-posts` | List user's recurring schedules |
| PUT | `/api/recurring-posts` | Update recurring schedule (prompt, time, frequency, pause/resume) |
| DELETE | `/api/recurring-posts?id=<id>` | Delete recurring schedule |

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
| GET    | `/api/integrations/slack/oauth`       | Initiate Slack OAuth 2.0 flow                               |
| GET    | `/api/integrations/slack/callback`    | Slack OAuth callback (OAuth 2.0 only)                       |
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
# For Production, use:
# NEXT_PUBLIC_BASE_URL=https://sammy.africacodefoundry.com
# NEXT_PUBLIC_APP_URL=https://sammy.africacodefoundry.com

# For Local Development:
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ============================================
# Twitter OAuth 2.0
# ============================================
TWITTER_CLIENT_ID=your_twitter_oauth2_client_id
TWITTER_CLIENT_SECRET=your_twitter_oauth2_client_secret
# Production: https://sammy.africacodefoundry.com/api/integrations/twitter/callback
# Development: http://localhost:3000/api/integrations/twitter/callback
TWITTER_REDIRECT_URI=http://localhost:3000/api/integrations/twitter/callback

# ============================================
# Facebook OAuth 2.0
# ============================================
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
# Production: https://sammy.africacodefoundry.com/api/integrations/facebook/callback
# Development: http://localhost:3000/api/integrations/facebook/callback
FACEBOOK_REDIRECT_URI=http://localhost:3000/api/integrations/facebook/callback

# ============================================
# Slack OAuth 2.0 (Optional - for context ingestion)
# ============================================
SLACK_CLIENT_ID=your_slack_oauth2_client_id
SLACK_CLIENT_SECRET=your_slack_oauth2_client_secret
# Production: https://sammy.africacodefoundry.com/api/integrations/slack/callback
# Development: http://localhost:3000/api/integrations/slack/callback
SLACK_REDIRECT_URI=http://localhost:3000/api/integrations/slack/callback

# ============================================
# Email Configuration (Gmail SMTP)
# ============================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_gmail_address@gmail.com
SMTP_PASS=your_gmail_app_password
```

### Environment Variable Notes

- **ENCRYPTION_KEY**: Must be exactly 32 bytes for AES-256-GCM encryption. Generate with:

  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

- **OAuth Redirect URIs**:

  - **Production:** `https://sammy.africacodefoundry.com/api/integrations/{platform}/callback`
  - **Development:** `http://localhost:3000/api/integrations/{platform}/callback`
  - Replace `{platform}` with `twitter`, `facebook`, or `slack`

- **Gmail SMTP Configuration**:

  - **SMTP_USER**: Your Gmail address
  - **SMTP_PASS**: Gmail App Password (not your regular password)
  - Generate App Password: [Google Account Settings](https://support.google.com/accounts/answer/185833) → Security → 2-Step Verification → App passwords
  - Required for password reset email functionality

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
  // OAuth 2.0 fields
  accessToken?: string, // Bot token (encrypted)
  userAccessToken?: string, // User token (encrypted)
  teamId?: string, // Workspace/Team ID
  teamName?: string, // Workspace name
  userId?: string // Slack user ID
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
}
```

#### `messages` (Slack)
```typescript
{
  _id: ObjectId,
  userId: string,
  channel: string,                // Slack channel name
  user: string,                   // Slack user ID
  text: string,                   // Message content
  ts: string,                     // Slack timestamp
  embedding: number[],            // 1536-dim vector (OpenAI text-embedding-3-small)
  createdAt: Date
}
```

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

### 3. Password Reset Flow

**Request Password Reset:**

```bash
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

**Response:**

```json
{
  "success": true,
  "message": "If an account exists with this email, a reset link has been sent."
}
```

**Reset Password with Token:**

```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "reset_token_from_email",
    "newPassword": "NewSecurePassword123"
  }'
```

### 4. Profile Management (Authenticated)

**Change Password:**

```bash
curl -X PUT http://localhost:3000/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_jwt_token" \
  -d '{
    "currentPassword": "CurrentPassword123",
    "newPassword": "NewSecurePassword123"
  }'
```

**Update Email:**

```bash
curl -X PUT http://localhost:3000/api/auth/update-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_jwt_token" \
  -d '{
    "newEmail": "newemail@example.com"
  }'
```

### 5. Generate Immediate Post

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
6. **Create Vector Search Indexes:**

   **For past_posts collection:**

   - Database: `sammy`
   - Collection: `past_posts`
   - Index Name: `vector_index`
   - Field: `embedding`
   - Dimensions: 1536
   - Similarity: cosine

   **For messages collection (Slack):**

   - Database: `sammy`
   - Collection: `messages`
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

# Fetch Slack messages for context (from connected channels)
curl -X GET "http://localhost:3000/api/sources/slack" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**

```json
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
```

### 7. Create Recurring Schedule

```bash
curl -X POST http://localhost:3000/api/recurring-posts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "twitter",
    "prompt": "Share a daily productivity tip",
    "frequency": "daily",
    "time": "09:00",
    "selectedDays": [1, 2, 3, 4, 5]
  }'
```

**Response:**

```json
{
  "success": true,
  "recurringPost": {
    "_id": "671234567890abcdef123456",
    "userId": "507f1f77bcf86cd799439011",
    "platform": "twitter",
    "prompt": "Share a daily productivity tip",
    "frequency": "daily",
    "time": "09:00",
    "selectedDays": [1, 2, 3, 4, 5],
    "nextOccurrence": "2025-10-16T09:00:00.000Z",
    "isActive": true,
    "createdAt": "2025-10-15T10:30:00.000Z"
  }
}
```

### 8. List Recurring Schedules

```bash
curl -X GET http://localhost:3000/api/recurring-posts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**

```json
{
  "success": true,
  "recurringPosts": [
    {
      "_id": "671234567890abcdef123456",
      "platform": "twitter",
      "prompt": "Share a daily productivity tip",
      "frequency": "daily",
      "time": "09:00",
      "selectedDays": [1, 2, 3, 4, 5],
      "nextOccurrence": "2025-10-16T09:00:00.000Z",
      "isActive": true,
      "createdAt": "2025-10-15T10:30:00.000Z"
    }
  ]
}
```

### 9. Update Recurring Schedule

```bash
# Pause/Resume
curl -X PUT http://localhost:3000/api/recurring-posts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "671234567890abcdef123456",
    "isActive": false
  }'

# Update time and frequency
curl -X PUT http://localhost:3000/api/recurring-posts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "671234567890abcdef123456",
    "frequency": "weekly",
    "time": "14:00"
  }'
```

### 10. Delete Recurring Schedule

```bash
curl -X DELETE "http://localhost:3000/api/recurring-posts?id=671234567890abcdef123456" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Database Schema

### MongoDB Collections

#### `users`

```typescript
{
  _id: ObjectId,
  email: string,
  password: string, // bcrypt hashed
  resetToken?: string,
  resetTokenExpiry?: Date,
  twitter?: {
    accessToken?: string, // Encrypted
    refreshToken?: string, // Encrypted
    userId?: string
  },
  facebook?: {
    accessToken?: string, // Encrypted
    userId?: string,
    pages?: [
      {
        id: string,
        name: string,
        accessToken: string // Encrypted
      }
    ]
  },
  slack?: {
    accessToken?: string, // Bot token (encrypted)
    userAccessToken?: string, // User token (encrypted)
    teamId?: string,
    teamName?: string,
    userId?: string
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### `past_posts`

```typescript
{
  _id: ObjectId,
  userId: string,
  postId: string, // Platform's post ID
  message: string, // Post content
  embedding: number[], // 1536-dim vector (OpenAI text-embedding-3-small)
  platform: "twitter" | "facebook",
  createdAt: Date
}
```

#### `messages` (Slack)

```typescript
{
  _id: ObjectId,
  userId: string,
  channel: string, // Slack channel name
  user: string, // Slack user ID
  text: string, // Message content
  ts: string, // Slack timestamp
  embedding: number[], // 1536-dim vector
  createdAt: Date
}
```

#### `scheduledPosts`

```typescript
{
  _id: ObjectId,
  userId: string,
  prompt: string,
  platform: "twitter" | "facebook",
  scheduleTime: Date,
  status: "scheduled" | "ready_for_review" | "posted" | "failed",
  post?: string, // Generated content
  threadId?: string, // LangGraph thread ID
  isScheduled?: boolean,
  failureReason?: string,
  processedAt?: Date,
  createdAt: Date,
  updatedAt: Date
}
```

#### `recurringPosts`

```typescript
{
  _id: ObjectId,
  userId: string,
  platform: "twitter" | "facebook",
  prompt: string, // Template prompt for content generation
  frequency: "daily" | "weekly" | "monthly",
  time: string, // "HH:mm" format (24-hour)
  selectedDays?: number[], // For daily: [0-6] (0=Sun, 6=Sat)
  selectedMonths?: number[], // For monthly: [1-12] (1=Jan, 12=Dec)
  nextOccurrence: Date, // When next post should be created
  isActive: boolean, // Pause/resume control
  createdAt: Date,
  updatedAt: Date
}
```

#### `agendaJobs` (Managed by Agenda)

```typescript
{
  _id: ObjectId,
  name: string, // "process-scheduled-post", "check-recurring-posts", "cleanup-old-jobs"
  type: "normal" | "single",
  data: object, // Job-specific data
  priority: number,
  nextRunAt: Date,
  lastRunAt?: Date,
  lastFinishedAt?: Date,
  repeatInterval?: string, // "1 minute" for recurring jobs
  lockedAt?: Date,
  failCount: number,
  failReason?: string
}
```

### Vector Search Indexes

**Required for semantic content matching:**

1. **past_posts collection**

   - Index Name: `vector_index`
   - Field: `embedding`
   - Dimensions: 1536
   - Similarity: cosine

2. **messages collection**
   - Index Name: `vector_index`
   - Field: `embedding`
   - Dimensions: 1536
   - Similarity: cosine

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
