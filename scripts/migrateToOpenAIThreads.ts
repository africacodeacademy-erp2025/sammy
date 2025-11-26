/**
 * MongoDB Migration Script for OpenAI Threads Integration
 *
 * This script connects to MongoDB and performs necessary migrations for the
 * OpenAI Threads integration. It can also optionally migrate existing chat
 * history to OpenAI Threads format.
 *
 * Usage:
 *   ts-node scripts/migrateToOpenAIThreads.ts [--migrate-history]
 *
 * Options:
 *   --migrate-history: Migrate existing chat history to OpenAI Threads (optional)
 *   --dry-run: Preview changes without applying them
 */

import { MongoClient } from "mongodb";
import * as dotenv from "dotenv";
import OpenAI from "openai";

// Load environment variables
dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const DATABASE_NAME = process.env.DATABASE_NAME || "sammydb";
const OPEN_AI_API = process.env.OPEN_AI_API;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI not found in .env file");
  process.exit(1);
}

if (!OPEN_AI_API) {
  console.error("❌ OPEN_AI_API not found in .env file");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPEN_AI_API });

interface MigrationOptions {
  migrateHistory: boolean;
  dryRun: boolean;
}

async function connectToMongoDB(): Promise<MongoClient> {
  console.log("🔌 Connecting to MongoDB...");
  const client = new MongoClient(MONGO_URI as string);
  await client.connect();
  console.log("✅ Connected to MongoDB successfully");
  return client;
}

async function createIndexes(client: MongoClient, dryRun: boolean) {
  console.log("\n📊 Creating/updating indexes...");
  const db = client.db(DATABASE_NAME);

  const indexes: Array<{
    collection: string;
    index: Record<string, 1 | -1>;
    options: { name: string };
  }> = [
    {
      collection: "chatHistory",
      index: { userId: 1, threadId: 1 },
      options: { name: "userId_threadId" },
    },
    {
      collection: "chatHistory",
      index: { threadId: 1 },
      options: { name: "threadId" },
    },
    {
      collection: "chatHistory",
      index: { userId: 1, updatedAt: -1 },
      options: { name: "userId_updatedAt" },
    },
  ];

  for (const { collection, index, options } of indexes) {
    if (dryRun) {
      console.log(
        `  [DRY RUN] Would create index on ${collection}:`,
        index,
        options
      );
    } else {
      try {
        await db.collection(collection).createIndex(index, options);
        console.log(`  ✅ Created index ${options.name} on ${collection}`);
      } catch (error: any) {
        if (error.code === 85 || error.code === 86) {
          console.log(
            `  ℹ️ Index ${options.name} already exists on ${collection}`
          );
        } else {
          console.error(
            `  ❌ Failed to create index on ${collection}:`,
            error.message
          );
        }
      }
    }
  }
}

async function migrateChatHistoryToOpenAI(
  client: MongoClient,
  dryRun: boolean
): Promise<void> {
  console.log("\n🔄 Migrating chat history to OpenAI Threads...");
  const db = client.db(DATABASE_NAME);

  // Find all conversations that don't have an OpenAI threadId format
  const conversations = await db
    .collection("chatHistory")
    .find({
      threadId: { $exists: true, $not: /^thread_/ }, // Custom threadIds don't start with "thread_"
    })
    .toArray();

  console.log(`  Found ${conversations.length} conversations to migrate`);

  let migratedCount = 0;
  let errorCount = 0;

  for (const conv of conversations) {
    try {
      if (dryRun) {
        console.log(
          `  [DRY RUN] Would migrate conversation ${conv.threadId} for user ${conv.userId}`
        );
        migratedCount++;
        continue;
      }

      // Create OpenAI thread
      const thread = await openai.beta.threads.create();
      console.log(
        `  📝 Created OpenAI thread ${thread.id} for ${conv.threadId}`
      );

      // Add messages to the thread
      if (conv.messages && Array.isArray(conv.messages)) {
        for (const msg of conv.messages) {
          if (!msg || !msg.content) continue;

          const role = msg.sender === "ai" ? "assistant" : "user";
          await openai.beta.threads.messages.create(thread.id, {
            role,
            content: String(msg.content),
          });
        }
        console.log(
          `    ✅ Migrated ${conv.messages.length} messages to thread ${thread.id}`
        );
      }

      // Update the conversation with new OpenAI threadId
      await db.collection("chatHistory").updateOne(
        { _id: conv._id },
        {
          $set: {
            threadId: thread.id,
            oldThreadId: conv.threadId, // Keep old ID for reference
            migratedAt: new Date(),
          },
        }
      );

      migratedCount++;
      console.log(`  ✅ Migrated conversation ${conv.threadId} → ${thread.id}`);
    } catch (error: any) {
      errorCount++;
      console.error(
        `  ❌ Failed to migrate conversation ${conv.threadId}:`,
        error.message
      );
    }
  }

  console.log(
    `\n📊 Migration complete: ${migratedCount} successful, ${errorCount} errors`
  );
}

async function cleanupOldData(client: MongoClient, dryRun: boolean) {
  console.log("\n🧹 Cleaning up old data structures...");
  const db = client.db(DATABASE_NAME);

  // Optional: Remove old platform-specific fields from messages
  const updateResult = await db
    .collection("chatHistory")
    .find({
      "messages.platform": { $exists: true },
    })
    .count();

  if (updateResult > 0) {
    console.log(
      `  Found ${updateResult} conversations with platform-specific message fields`
    );

    if (dryRun) {
      console.log(
        `  [DRY RUN] Would remove platform field from ${updateResult} conversations`
      );
    } else {
      // We're keeping the data for now, just logging
      console.log(
        `  ℹ️ Platform fields will remain for historical reference (no deletion)`
      );
    }
  } else {
    console.log("  ✅ No legacy platform fields found");
  }
}

async function validateMigration(client: MongoClient) {
  console.log("\n🔍 Validating migration...");
  const db = client.db(DATABASE_NAME);

  // Check for conversations with OpenAI thread IDs
  const openAIThreadCount = await db
    .collection("chatHistory")
    .countDocuments({ threadId: /^thread_/ });

  // Check for conversations without threadId
  const noThreadCount = await db
    .collection("chatHistory")
    .countDocuments({ threadId: { $exists: false } });

  // Check for old custom threadIds
  const oldThreadCount = await db.collection("chatHistory").countDocuments({
    threadId: { $exists: true, $not: /^thread_/ },
    oldThreadId: { $exists: false },
  });

  console.log(`  ✅ Conversations with OpenAI threads: ${openAIThreadCount}`);
  console.log(`  ⚠️ Conversations without threadId: ${noThreadCount}`);
  console.log(`  ⚠️ Conversations with old threadIds: ${oldThreadCount}`);

  if (oldThreadCount > 0) {
    console.log(
      `\n  💡 TIP: Run with --migrate-history to migrate ${oldThreadCount} old conversations`
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {
    migrateHistory: args.includes("--migrate-history"),
    dryRun: args.includes("--dry-run"),
  };

  console.log("🚀 Starting MongoDB Migration for OpenAI Threads");
  console.log(`📁 Database: ${DATABASE_NAME}`);
  console.log(`🔧 Options:`, options);

  let client: MongoClient | null = null;

  try {
    client = await connectToMongoDB();

    // Create necessary indexes
    await createIndexes(client, options.dryRun);

    // Optionally migrate existing chat history to OpenAI Threads
    if (options.migrateHistory) {
      await migrateChatHistoryToOpenAI(client, options.dryRun);
    }

    // Clean up old data structures
    await cleanupOldData(client, options.dryRun);

    // Validate the migration
    await validateMigration(client);

    console.log("\n✅ Migration completed successfully!");

    if (options.dryRun) {
      console.log(
        "\n💡 This was a dry run. Run without --dry-run to apply changes."
      );
    }
  } catch (error: any) {
    console.error("\n❌ Migration failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log("🔌 Disconnected from MongoDB");
    }
  }
}

// Run the migration
main();
