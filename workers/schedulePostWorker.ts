import "dotenv/config";
import { Queue, Worker, JobsOptions } from "bullmq";
import IORedis from "ioredis";
import { connectDB } from "../lib/mongo";
import { generatePost, GraphState } from "../src/app/api/agent/route";
import { ObjectId } from "mongodb";

const connection = new IORedis(process.env.REDIS_URL!, {
  tls: {},
  maxRetriesPerRequest: null,
});

// Create queue
export const scheduledPostsQueue = new Queue("scheduled-posts", { connection });

// Worker to process jobs
const worker = new Worker(
  "scheduled-posts",
  async (job) => {
    console.log(`Processing job ${job.id} for post ${job.data._id}`);
    const db = await connectDB();
    const scheduledPosts = db.collection("scheduledPosts");

    try {
      const state: GraphState = {
        prompt: job.data.prompt,
        platform: job.data.platform,
        userId: job.data.userId,
      };

      const result = await generatePost(state);

      // Update the scheduled post in Mongo
      await scheduledPosts.updateOne(
        { _id: new ObjectId(job.data._id) },
        {
          $set: {
            post: result.post,
            threadId: result.threadId,
            platform: state.platform,
            status: "ready_for_review",
            isScheduled: true,
            updatedAt: new Date(),
          },
        }
      );

      console.log(`Post ${job.data._id} processed and updated.`);
      return { success: true };
    } catch (err) {
      console.error(`Failed job ${job.id}:`, err);
      throw err;
    }
  },
  { connection }
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

// Utility to enqueue a scheduled post
export async function enqueueScheduledPost(post: any) {
  const delay = new Date(post.scheduleTime).getTime() - Date.now();

  const jobOpts: JobsOptions = {
    delay: Math.max(delay, 0),
    removeOnComplete: true,
    removeOnFail: false,
  };

  await scheduledPostsQueue.add("scheduled-post", post, jobOpts);
  console.log(`Job scheduled for ${post._id} at ${post.scheduleTime}`);
}
