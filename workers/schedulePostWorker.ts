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

      // Define recurring schedule processor job
      agenda.define("process-recurring-schedules", async () => {
        console.log("🔄 Processing recurring schedules...");

        try {
          const db = await connectDB();
          const recurringSchedules = db.collection("recurringSchedules");
          const scheduledPosts = db.collection("scheduledPosts");

          // Find all active recurring templates
          const templates = await recurringSchedules
            .find({
              status: "active",
              isRecurring: true,
            })
            .toArray();

          if (templates.length === 0) {
            console.log("✅ No active recurring schedules found");
            return;
          }

          console.log(
            `📋 Found ${templates.length} active recurring schedule(s)`
          );

          const now = new Date();
          const lookAheadWindow = 14 * 24 * 60 * 60 * 1000; // 14 days
          const lookAheadDate = new Date(now.getTime() + lookAheadWindow);

          for (const template of templates) {
            try {
              // Import recurring schedule manager utilities
              const { shouldCreateMoreOccurrences, calculateNextOccurrences } =
                await import("../lib/recurringScheduleManager");

              // Check if we should create more occurrences
              if (!shouldCreateMoreOccurrences(template as any)) {
                console.log(
                  `⏹️ Template ${template._id} has reached its limit or end date`
                );

                // Mark as completed
                await recurringSchedules.updateOne(
                  { _id: template._id },
                  {
                    $set: {
                      status: "completed",
                      updatedAt: new Date(),
                    },
                  }
                );
                continue;
              }

              // Calculate next occurrences within look-ahead window
              const nextOccurrences = calculateNextOccurrences(
                template.recurrencePattern,
                20, // Max 20 occurrences to create at once
                template.lastOccurrenceCreatedAt || now
              );

              // Filter occurrences within look-ahead window
              const occurrencesToCreate = nextOccurrences.filter(
                (date) => date <= lookAheadDate
              );

              if (occurrencesToCreate.length === 0) {
                console.log(
                  `✅ Template ${template._id} already has enough scheduled occurrences`
                );
                continue;
              }

              // Check for already scheduled occurrences to avoid duplicates
              let createdCount = 0;

              for (const occurrenceDate of occurrencesToCreate) {
                const scheduleTime = occurrenceDate.toISOString();

                // Check if this occurrence already exists
                const exists = await scheduledPosts.findOne({
                  parentPostId: template._id,
                  scheduleTime,
                });

                if (exists) {
                  continue; // Skip if already created
                }

                // Create individual scheduled post
                const inserted = await scheduledPosts.insertOne({
                  userId: template.userId,
                  prompt: template.prompt,
                  platform: template.platform,
                  scheduleTime,
                  status: "scheduled",
                  isScheduled: true,
                  parentPostId: template._id, // Link to template
                  occurrenceNumber: template.occurrenceCount + createdCount + 1,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });

                // Schedule the Agenda job for this occurrence
                const job = await agenda.schedule(
                  occurrenceDate,
                  "process-scheduled-post",
                  { postId: inserted.insertedId.toString() }
                );

                // Store job ID
                await scheduledPosts.updateOne(
                  { _id: inserted.insertedId },
                  { $set: { jobId: job.attrs._id?.toString() } }
                );

                createdCount++;
              }

              if (createdCount > 0) {
                // Update template
                await recurringSchedules.updateOne(
                  { _id: template._id },
                  {
                    $set: {
                      occurrenceCount: template.occurrenceCount + createdCount,
                      lastOccurrenceCreatedAt: new Date(),
                      nextOccurrenceTime:
                        occurrencesToCreate[createdCount - 1]?.toISOString(),
                      updatedAt: new Date(),
                    },
                  }
                );

                console.log(
                  `✅ Created ${createdCount} occurrence(s) for template ${template._id}`
                );
              }
            } catch (err: any) {
              console.error(
                `❌ Error processing template ${template._id}:`,
                err.message
              );
            }
          }

          console.log("✅ Finished processing recurring schedules");
        } catch (err: any) {
          console.error(
            "❌ Error in recurring schedule processor:",
            err.message
          );
        }
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

    // Schedule recurring schedule processor (runs every hour)
    console.log("📅 Scheduling recurring schedule processor...");
    await agenda.every("1 hour", "process-recurring-schedules");
    console.log("✅ Recurring schedule processor scheduled (runs hourly)");

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
