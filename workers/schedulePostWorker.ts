import "dotenv/config";
import Agenda, { Job } from "agenda";
import { connectDB } from "../lib/mongo";
import { generatePost, GraphState } from "../src/app/api/agent/route";
import { ObjectId, Db } from "mongodb";

// Initialize agenda without DB config - we'll set it up after connecting
const agenda = new Agenda({
  db: {
    address: process.env.MONGO_URI as string,
    collection: "agendaJobs",
  },
  // Optimized for MongoDB Free Tier
  processEvery: "1 minute",
  maxConcurrency: 5,
  defaultConcurrency: 3,
  lockLimit: 5,
  defaultLockLifetime: 10000,
});

// Initialize Agenda with existing MongoDB connection
async function initializeAgenda() {
  // Connect to MongoDB first to ensure it's available
  await connectDB();

  console.log("✅ MongoDB connection verified");

  // Define job processors
  agenda.define(
    "process-scheduled-post",
    async (job: Job<{ postId: string }>) => {
      const { postId } = job.attrs.data;

      console.log(`📝 Processing scheduled post: ${postId}`);

      const db = await connectDB();
      const scheduledPosts = db.collection("scheduledPosts");

      try {
        // Fetch post from MongoDB
        const scheduledPost = await scheduledPosts.findOne({
          _id: new ObjectId(postId),
        });

        if (!scheduledPost) {
          throw new Error(`Scheduled post ${postId} not found in database`);
        }

        // Check if post content already exists (new format)
        if (scheduledPost.post && scheduledPost.threadId) {
          console.log(
            `✅ Post ${postId} already has content, marking as ready for review`
          );

          // Update status to indicate it's ready (in case it wasn't already)
          await scheduledPosts.updateOne(
            { _id: new ObjectId(postId) },
            {
              $set: {
                status: "ready_for_review",
                processedAt: new Date(),
                updatedAt: new Date(),
              },
            }
          );

          console.log(`✅ Post ${postId} is ready for review`);
          return; // Job completed successfully
        }

        // Legacy path: Generate post if it doesn't exist (backward compatibility)
        console.log(
          `📝 Generating content for legacy scheduled post: ${postId}`
        );

        const state: GraphState = {
          prompt: scheduledPost.prompt,
          platform: scheduledPost.platform,
          userId: scheduledPost.userId,
        };

        const result = await generatePost(state);

        // Update with generated content
        await scheduledPosts.updateOne(
          { _id: new ObjectId(postId) },
          {
            $set: {
              post: result.post,
              threadId: result.threadId,
              platform: state.platform,
              status: "ready_for_review",
              isScheduled: true,
              processedAt: new Date(),
              updatedAt: new Date(),
            },
          }
        );

        console.log(`✅ Post ${postId} processed successfully`);
      } catch (err: any) {
        console.error(`❌ Failed to process post ${postId}:`, err.message);

        // Update with failure info
        await scheduledPosts.updateOne(
          { _id: new ObjectId(postId) },
          {
            $set: {
              status: "failed",
              failureReason: err.message,
              updatedAt: new Date(),
            },
          }
        );

        throw err; // Agenda will handle retries
      }
    }
  );

  // Define cleanup job for old completed/failed jobs (Free tier optimization)
  agenda.define("cleanup-old-jobs", async () => {
    console.log("🧹 Running cleanup of old agenda jobs...");
    const db = await connectDB();

    // Remove jobs older than 7 days
    const result = await db.collection("agendaJobs").deleteMany({
      lastFinishedAt: {
        $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      },
    });

    console.log(`🗑️ Cleaned up ${result.deletedCount} old jobs`);
  });

  console.log("✅ Job processors registered");

  return agenda;
}

// Auto-cleanup: Remove completed jobs immediately to save storage
agenda.on("success", async (job) => {
  console.log(`✅ Job ${job.attrs.name} completed successfully`);
  await job.remove(); // Critical for free tier storage management
});

// Auto-cleanup: Remove failed jobs after max retries
agenda.on("fail", async (job, err) => {
  console.error(`❌ Job ${job.attrs.name} failed:`, err.message);

  // Remove after 3 failed attempts to avoid accumulation
  const failCount = job.attrs.failCount || 0;
  if (failCount >= 3) {
    console.log(
      `🗑️ Removing job ${job.attrs.name} after ${failCount} failures`
    );
    await job.remove();
  }
});

// Graceful shutdown handlers
async function gracefulShutdown() {
  console.log("⏹️  Shutting down Agenda gracefully...");
  await agenda.stop();
  process.exit(0);
}

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Process missed/orphaned scheduled posts (posts without jobId or past schedule time)
async function processMissedScheduledPosts() {
  console.log("🔍 Checking for missed scheduled posts...");

  try {
    const db = await connectDB();
    const scheduledPosts = db.collection("scheduledPosts");

    const now = new Date();

    // Find posts that:
    // 1. Are in "scheduled" status
    // 2. Have a schedule time in the past
    // 3. Don't have a jobId (orphaned) OR have a pending jobStatus
    const missedPosts = await scheduledPosts
      .find({
        status: "scheduled",
        scheduleTime: { $lt: now.toISOString() },
        $or: [
          { jobId: { $exists: false } },
          { jobId: null },
          { jobStatus: "pending" },
        ],
      })
      .toArray();

    if (missedPosts.length === 0) {
      console.log("✅ No missed posts found");
      return;
    }

    console.log(
      `📋 Found ${missedPosts.length} missed post(s), processing now...`
    );

    for (const post of missedPosts) {
      try {
        console.log(`⚡ Processing missed post: ${post._id.toString()}`);

        // Create state for post generation
        const state: GraphState = {
          prompt: post.prompt,
          platform: post.platform,
          userId: post.userId,
        };

        // Generate the post content
        const result = await generatePost(state);

        if (result.success && result.post && result.threadId) {
          // Update the post with generated content
          await scheduledPosts.updateOne(
            { _id: post._id },
            {
              $set: {
                post: result.post,
                threadId: result.threadId,
                status: "ready_for_review",
                processedAt: new Date(),
                updatedAt: new Date(),
                jobStatus: "completed",
              },
            }
          );

          console.log(`✅ Processed missed post: ${post._id.toString()}`);
        } else {
          throw new Error(result.error || "Failed to generate post");
        }
      } catch (err: any) {
        console.error(
          `❌ Failed to process missed post ${post._id.toString()}:`,
          err.message
        );

        // Mark as failed
        await scheduledPosts.updateOne(
          { _id: post._id },
          {
            $set: {
              status: "failed",
              failureReason: err.message,
              jobStatus: "failed",
              updatedAt: new Date(),
            },
          }
        );
      }
    }

    console.log(`✅ Finished processing ${missedPosts.length} missed post(s)`);
  } catch (err) {
    console.error("❌ Error checking for missed posts:", err);
  }
}

// Start Agenda and schedule cleanup job
(async () => {
  try {
    console.log("🚀 Initializing Agenda worker...");

    // Initialize Agenda with existing MongoDB connection
    await initializeAgenda();
    console.log("📡 Starting Agenda...");

    await agenda.start();
    console.log("✅ Agenda worker started - listening for scheduled posts");

    // Schedule daily cleanup job (runs at 2 AM daily)
    console.log("📅 Scheduling cleanup job...");
    await agenda.every("24 hours", "cleanup-old-jobs");
    console.log("✅ Daily cleanup job scheduled");

    // Process any missed/orphaned scheduled posts on startup
    console.log("🔍 Processing missed posts...");
    await processMissedScheduledPosts();

    console.log("🎯 Worker is now running and waiting for jobs...");
  } catch (err) {
    console.error("❌ Failed to start Agenda:", err);
    console.error("Stack trace:", err);
    process.exit(1);
  }
})().catch((err) => {
  console.error("❌ Unhandled error in worker startup:", err);
  console.error("Stack trace:", err);
  process.exit(1);
});

// Export function to schedule a post
export async function schedulePost(
  postId: string,
  scheduleTime: Date
): Promise<string> {
  // Ensure Agenda is initialized and ready
  if (!agenda._ready) {
    await initializeAgenda();
    await agenda.start();
  }

  // Schedule the job
  const job = await agenda.schedule(scheduleTime, "process-scheduled-post", {
    postId,
  });

  const jobId = job.attrs._id?.toString() || "";

  console.log(`📅 Scheduled post ${postId} for ${scheduleTime.toISOString()}`);

  return jobId; // Return job ID for tracking
}

// Export function to cancel a scheduled post
export async function cancelScheduledPost(jobId: string): Promise<boolean> {
  if (!agenda._ready) {
    await initializeAgenda();
    await agenda.start();
  }

  const numRemoved = (await agenda.cancel({ _id: new ObjectId(jobId) })) || 0;

  if (numRemoved > 0) {
    console.log(`🗑️ Cancelled job with ID ${jobId}`);
  } else {
    console.log(`⚠️ Job ${jobId} not found or already completed`);
  }

  return numRemoved > 0;
}

// Export agenda instance for advanced usage
export { agenda };
