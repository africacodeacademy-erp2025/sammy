import "dotenv/config";
import { connectDB } from "../lib/mongo";
import { generatePost, GraphState } from "../src/app/api/agent/route";

async function runScheduledPostsWorker() {
  const db = await connectDB();
  const scheduledPosts = db.collection("scheduledPosts");

  const nowISO = new Date().toISOString();

  // Find all scheduled posts due now or earlier
  const duePosts = await scheduledPosts
    .find({
      status: "scheduled",
      scheduleTime: { $lte: nowISO },
    })
    .toArray();

  for (const postEntry of duePosts) {
    try {
      const state: GraphState = {
        prompt: postEntry.prompt,
        platform: postEntry.platform,
        userId: postEntry.userId,
      };

      const result = await generatePost(state);

      // Update the DB entry with the generated post, threadId, platform, mark ready for review
      await scheduledPosts.updateOne(
        { _id: postEntry._id },
        {
          $set: {
            post: result.post,
            threadId: result.threadId,
            platform: state.platform,
            status: "ready_for_review",
            updatedAt: new Date(),
          },
        }
      );

      console.log(
        `Generated post for scheduled entry ${postEntry._id} on platform ${state.platform}`
      );
    } catch (err) {
      console.error(
        `Failed to generate post for scheduled entry ${postEntry._id}:`,
        err
      );
    }
  }
}

// Run every 60 seconds
setInterval(runScheduledPostsWorker, 60 * 1000);
console.log("Scheduled post worker started...");
