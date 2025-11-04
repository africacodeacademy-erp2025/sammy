/**
 * Posting Queue System
 *
 * Handles LinkedIn posting asynchronously to deal with intermittent connectivity issues.
 * Posts are queued and retried over a longer period (minutes/hours) rather than seconds.
 *
 * This solves the intermittent network issue by:
 * 1. Not blocking the user - immediate feedback
 * 2. Retrying over longer periods when network might be available
 * 3. Allowing manual retry from UI
 * 4. Tracking posting status in database
 */

import { connectDB } from "../mongo";
import { ObjectId } from "mongodb";

export interface QueuedPost {
  _id?: ObjectId;
  userId: string;
  platform: "linkedin" | "twitter" | "facebook";
  content: string;
  personUrn?: string;
  accessToken: string;
  status: "pending" | "processing" | "completed" | "failed";
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: Date;
  lastError?: string;
  createdAt: Date;
  scheduledFor?: Date;
  completedAt?: Date;
}

/**
 * Add a post to the queue
 */
export async function queuePost(
  post: Omit<QueuedPost, "_id" | "createdAt" | "status" | "attempts">
) {
  const db = await connectDB();
  const queue = db.collection<QueuedPost>("postingQueue");

  const queuedPost: QueuedPost = {
    ...post,
    status: "pending",
    attempts: 0,
    createdAt: new Date(),
  };

  const result = await queue.insertOne(queuedPost);
  console.log(`📨 Post queued: ${result.insertedId}`);

  return result.insertedId.toString();
}

/**
 * Get post status from queue
 */
export async function getPostStatus(postId: string) {
  const db = await connectDB();
  const queue = db.collection<QueuedPost>("postingQueue");

  return await queue.findOne({ _id: new ObjectId(postId) });
}

/**
 * Update post status
 */
export async function updatePostStatus(
  postId: string,
  status: QueuedPost["status"],
  error?: string
) {
  const db = await connectDB();
  const queue = db.collection<QueuedPost>("postingQueue");

  await queue.updateOne(
    { _id: new ObjectId(postId) },
    {
      $set: {
        status,
        lastAttemptAt: new Date(),
        ...(error && { lastError: error }),
        ...(status === "completed" && { completedAt: new Date() }),
      },
      $inc: { attempts: 1 },
    }
  );
}

/**
 * Get pending posts that are ready to process
 * (either new or failed posts that haven't exceeded max attempts)
 */
export async function getPendingPosts(limit = 10) {
  const db = await connectDB();
  const queue = db.collection<QueuedPost>("postingQueue");

  // Get posts that:
  // 1. Are pending or failed (but haven't exceeded max attempts)
  // 2. Either have no scheduledFor time, or it's in the past
  // 3. Either have no lastAttemptAt, or it was more than 5 minutes ago (exponential backoff)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  return await queue
    .find({
      $and: [
        {
          $or: [
            { status: "pending" },
            {
              status: "failed",
              $expr: { $lt: ["$attempts", "$maxAttempts"] },
            },
          ],
        },
        {
          $or: [
            { scheduledFor: { $exists: false } },
            { scheduledFor: { $lte: new Date() } },
          ],
        },
        {
          $or: [
            { lastAttemptAt: { $exists: false } },
            { lastAttemptAt: { $lte: fiveMinutesAgo } },
          ],
        },
      ],
    })
    .sort({ createdAt: 1 })
    .limit(limit)
    .toArray();
}

/**
 * Retry a failed post manually
 */
export async function retryPost(postId: string) {
  const db = await connectDB();
  const queue = db.collection<QueuedPost>("postingQueue");

  await queue.updateOne(
    { _id: new ObjectId(postId) },
    {
      $set: {
        status: "pending",
        lastError: undefined,
      },
    }
  );

  console.log(`🔄 Post retry requested: ${postId}`);
}
