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

// Track initialization state
let isInitialized = false;
let isInitializing = false;
let initPromise: Promise<void> | null = null;

// Initialize Agenda with existing MongoDB connection
async function initializeAgenda() {
  // If already initialized, return immediately
  if (isInitialized) {
    return;
  }

  // If currently initializing, wait for the existing initialization to complete
  if (isInitializing && initPromise) {
    await initPromise;
    return;
  }

  // Start initialization
  isInitializing = true;
  initPromise = (async () => {
    try {
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

            // Check if post was already processed (skip duplicate processing)
            if (
              scheduledPost.status === "ready_for_review" ||
              scheduledPost.status === "posted"
            ) {
              console.log(
                `⚠️ Post ${postId} already processed (status: ${scheduledPost.status}), skipping`
              );
              return;
            }

            // Generate post content at scheduled time (normal path)
            console.log(`📝 Generating content for scheduled post: ${postId}`);

            const state: GraphState = {
              prompt: scheduledPost.prompt,
              platform: scheduledPost.platform,
              userId: scheduledPost.userId,
            };

            const result = await generatePost(state);

            if (!result.post || !result.threadId) {
              throw new Error("Failed to generate post content");
            }

            // Update with generated content and mark as ready for review
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

            console.log(`✅ Post ${postId} generated and ready for review`);
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

      // Define job to check and process recurring posts
      agenda.define("check-recurring-posts", async () => {
        console.log("\n🔄 ========== CHECKING RECURRING POSTS ==========");
        await processRecurringPosts();
        console.log(
          "🔄 ========== RECURRING POSTS CHECK COMPLETE ==========\n"
        );
      });

      console.log("✅ Job processors registered");

      // Start Agenda
      await agenda.start();
      console.log("✅ Agenda started successfully");

      // Mark as initialized
      isInitialized = true;
    } catch (err) {
      isInitializing = false;
      initPromise = null;
      throw err;
    }
  })();

  await initPromise;
}

// Auto-cleanup: Remove completed jobs immediately to save storage
agenda.on("success", async (job) => {
  console.log(`✅ Job ${job.attrs.name} completed successfully`);

  // Only remove one-time jobs, not recurring jobs
  // Recurring jobs (like check-recurring-posts, cleanup-old-jobs) should persist
  if (job.attrs.repeatInterval) {
    console.log(`   ↻ Recurring job - keeping for next run`);
  } else {
    console.log(`   🗑️ One-time job - removing`);
    await job.remove(); // Only remove one-time jobs
  }
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

// Helper function to calculate next occurrence based on recurring schedule
function calculateNextOccurrence(
  frequency: "daily" | "weekly" | "monthly",
  time: string,
  selectedDays?: number[] | null,
  selectedMonths?: number[] | null
): Date {
  const now = new Date();
  const [hours, minutes] = time.split(":").map(Number);

  if (frequency === "daily") {
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);

    if (selectedDays && selectedDays.length > 0) {
      // If time has already passed today, start looking from tomorrow
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }

      // Find next matching day
      let attempts = 0;
      while (!selectedDays.includes(next.getDay()) && attempts < 7) {
        next.setDate(next.getDate() + 1);
        attempts++;
      }
    } else {
      // Every day - if time has passed today, schedule for tomorrow
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
    }
    return next;
  }

  if (frequency === "weekly") {
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);
    // Add 7 days from now
    next.setDate(next.getDate() + 7);
    return next;
  }

  if (frequency === "monthly") {
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);

    if (selectedMonths && selectedMonths.length > 0) {
      // Find next matching month
      while (!selectedMonths.includes(next.getMonth() + 1)) {
        next.setMonth(next.getMonth() + 1);
        next.setDate(1); // Reset to first day of month
      }
    } else {
      // Every month - add 1 month
      next.setMonth(next.getMonth() + 1);
    }
    return next;
  }

  return now;
}

// Process recurring posts and create scheduled posts when it's time
async function processRecurringPosts() {
  try {
    const db = await connectDB();
    const recurringPosts = db.collection("recurringPosts");
    const scheduledPosts = db.collection("scheduledPosts");

    const now = new Date();
    const nowISO = now.toISOString();

    console.log(`🕐 Current time: ${nowISO}`);

    // Find active recurring posts where nextOccurrence has arrived or passed
    // Use $or to handle both Date objects and ISO strings in the database
    const dueRecurringPosts = await recurringPosts
      .find({
        isActive: true,
        $or: [
          { nextOccurrence: { $lte: now } }, // For Date objects
          { nextOccurrence: { $lte: nowISO } }, // For ISO strings
        ],
      })
      .toArray();

    // Also log all active recurring posts for debugging
    const allActiveRecurring = await recurringPosts
      .find({ isActive: true })
      .toArray();

    console.log(
      `📊 Total active recurring posts: ${allActiveRecurring.length}`
    );
    allActiveRecurring.forEach((post) => {
      const nextOccTime =
        post.nextOccurrence instanceof Date
          ? post.nextOccurrence
          : new Date(post.nextOccurrence);
      const isPast = nextOccTime <= now;
      const timeDiff = nextOccTime.getTime() - now.getTime();
      const minutesUntil = Math.round(timeDiff / 1000 / 60);

      console.log(
        `  - Post ${post._id}: nextOccurrence=${post.nextOccurrence}, platform=${post.platform}, ` +
          `due=${isPast ? "YES ✅" : "NO"} (${
            isPast
              ? Math.abs(minutesUntil) + "min ago"
              : "in " + minutesUntil + "min"
          })`
      );
    });

    if (dueRecurringPosts.length === 0) {
      console.log("✅ No recurring posts due at this time");
      return;
    }

    console.log(
      `🔄 Found ${dueRecurringPosts.length} recurring post(s) to schedule`
    );

    for (const recurringPost of dueRecurringPosts) {
      try {
        console.log(
          `📅 Processing recurring post: ${recurringPost._id.toString()}`
        );

        // Get nextOccurrence - handle both Date objects and ISO strings
        const nextOccurrenceValue =
          recurringPost.nextOccurrence instanceof Date
            ? recurringPost.nextOccurrence.toISOString()
            : recurringPost.nextOccurrence;

        console.log(
          `  Next occurrence: ${nextOccurrenceValue} (type: ${typeof recurringPost.nextOccurrence})`
        );

        // Create a new scheduled post document
        const newScheduledPost = {
          userId: recurringPost.userId,
          prompt: recurringPost.prompt,
          platform: recurringPost.platform,
          scheduleTime: nextOccurrenceValue, // Use ISO string for consistency
          status: "scheduled",
          isScheduled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Insert into scheduledPosts collection
        const result = await scheduledPosts.insertOne(newScheduledPost);
        const scheduledPostId = result.insertedId.toString();

        console.log(`✅ Created scheduled post: ${scheduledPostId}`);

        // Schedule the job with Agenda
        // Handle both Date objects and ISO strings
        const scheduleTime =
          recurringPost.nextOccurrence instanceof Date
            ? recurringPost.nextOccurrence
            : new Date(recurringPost.nextOccurrence);

        const { schedulePost } = await import("./schedulePostWorker");
        const jobId = await schedulePost(scheduledPostId, scheduleTime);

        // Update the scheduled post with jobId
        await scheduledPosts.updateOne(
          { _id: result.insertedId },
          {
            $set: {
              jobId: jobId,
              updatedAt: new Date(),
            },
          }
        );

        console.log(`✅ Scheduled job: ${jobId} for post: ${scheduledPostId}`);

        // Calculate next occurrence for this recurring post
        const nextOccurrence = calculateNextOccurrence(
          recurringPost.frequency,
          recurringPost.time,
          recurringPost.selectedDays,
          recurringPost.selectedMonths
        );

        console.log(
          `📅 Calculated next occurrence: ${nextOccurrence.toISOString()}`
        );

        // Update the recurring post with new nextOccurrence and lastExecuted
        const updateResult = await recurringPosts.updateOne(
          { _id: recurringPost._id },
          {
            $set: {
              nextOccurrence: nextOccurrence, // Store as Date object for MongoDB compatibility
              lastExecuted: now,
              updatedAt: new Date(),
            },
          }
        );

        console.log(
          `🔄 Updated recurring post ${recurringPost._id.toString()} (matched: ${
            updateResult.matchedCount
          }, modified: ${
            updateResult.modifiedCount
          }) - Next occurrence: ${nextOccurrence.toISOString()}`
        );
      } catch (err: any) {
        console.error(
          `❌ Failed to process recurring post ${recurringPost._id.toString()}:`,
          err.message
        );
      }
    }

    console.log(
      `✅ Processed ${dueRecurringPosts.length} recurring post(s) successfully`
    );
  } catch (err) {
    console.error("❌ Error processing recurring posts:", err);
  }
}

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

    // Schedule recurring posts check (runs every minute)
    console.log("🔄 Scheduling recurring posts check...");
    await agenda.every("1 minute", "check-recurring-posts");
    console.log("✅ Recurring posts check scheduled (every minute)");

    // Process any missed/orphaned scheduled posts on startup
    console.log("🔍 Processing missed posts...");
    await processMissedScheduledPosts();

    // Process recurring posts immediately on startup
    console.log("🔄 Processing recurring posts...");
    await processRecurringPosts();

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
  if (!isInitialized) {
    console.log("🔄 Initializing Agenda for post scheduling...");
    await initializeAgenda();
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
  // Ensure Agenda is initialized and ready
  if (!isInitialized) {
    console.log("🔄 Initializing Agenda for job cancellation...");
    await initializeAgenda();
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
