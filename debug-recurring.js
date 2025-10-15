// Debug script to check recurring posts and simulate worker logic
import "dotenv/config";
import { MongoClient } from "mongodb";

async function debugRecurringPosts() {
  const client = new MongoClient(process.env.MONGO_URI);

  try {
    await client.connect();
    console.log("✅ Connected to MongoDB\n");

    const db = client.db(process.env.DATABASE_NAME || "sammydb");
    const recurringPosts = db.collection("recurringPosts");

    const now = new Date();
    const nowISO = now.toISOString();

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🕐 CURRENT TIME");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`UTC:   ${nowISO}`);
    console.log(`Local: ${now.toLocaleString("en-US")}`);
    console.log(`Timestamp: ${now.getTime()}\n`);

    // Get all active recurring posts
    const allActive = await recurringPosts.find({ isActive: true }).toArray();

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📊 ALL ACTIVE RECURRING POSTS (${allActive.length})`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    allActive.forEach((post, index) => {
      console.log(`📋 POST ${index + 1}: ${post._id}`);
      console.log(`   Platform: ${post.platform}`);
      console.log(`   Frequency: ${post.frequency}`);
      console.log(`   Time: ${post.time}`);
      console.log(`   Selected Days: ${post.selectedDays || "none"}`);
      console.log(`   IsActive: ${post.isActive}`);
      console.log(`   Prompt: "${post.prompt.substring(0, 50)}..."`);

      console.log(`\n   📅 nextOccurrence (raw):`);
      console.log(`      Value: ${post.nextOccurrence}`);
      console.log(`      Type: ${typeof post.nextOccurrence}`);
      console.log(
        `      Constructor: ${post.nextOccurrence?.constructor?.name}`
      );

      // Convert to Date for comparison
      let nextOccTime;
      if (post.nextOccurrence instanceof Date) {
        nextOccTime = post.nextOccurrence;
        console.log(`      ✅ Stored as Date object`);
      } else if (typeof post.nextOccurrence === "string") {
        nextOccTime = new Date(post.nextOccurrence);
        console.log(`      ⚠️  Stored as string`);
      } else {
        console.log(`      ❌ Unknown type!`);
        return;
      }

      console.log(`      ISO: ${nextOccTime.toISOString()}`);
      console.log(`      Timestamp: ${nextOccTime.getTime()}`);

      // Check if due
      const isPast = nextOccTime <= now;
      const timeDiff = nextOccTime.getTime() - now.getTime();
      const minutesDiff = Math.round(timeDiff / 1000 / 60);
      const hoursDiff = Math.round(timeDiff / 1000 / 60 / 60);

      console.log(`\n   ⏰ STATUS:`);
      if (isPast) {
        console.log(
          `      🔴 OVERDUE by ${Math.abs(minutesDiff)} minutes (${Math.abs(
            hoursDiff
          )} hours)`
        );
        console.log(`      ✅ SHOULD BE PROCESSED NOW!`);
      } else {
        console.log(
          `      🟢 SCHEDULED to run in ${minutesDiff} minutes (${hoursDiff} hours)`
        );
        console.log(
          `      ⏰ Will run at: ${nextOccTime.toLocaleString("en-US")}`
        );
      }

      if (post.lastExecuted) {
        const lastExec = new Date(post.lastExecuted);
        console.log(`\n   ⏮️  Last Executed:`);
        console.log(`      ${lastExec.toISOString()}`);
        console.log(`      ${lastExec.toLocaleString("en-US")}`);
      } else {
        console.log(`\n   ⏮️  Last Executed: Never`);
      }

      console.log(
        `\n   📅 Updated At: ${new Date(post.updatedAt).toLocaleString(
          "en-US"
        )}`
      );
      console.log("");
    });

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔍 SIMULATING WORKER QUERY");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // Simulate worker query - using $or for Date and String
    console.log("Query 1: Using $or with Date and ISO string");
    const dueWithOr = await recurringPosts
      .find({
        isActive: true,
        $or: [
          { nextOccurrence: { $lte: now } },
          { nextOccurrence: { $lte: nowISO } },
        ],
      })
      .toArray();
    console.log(`   Result: ${dueWithOr.length} post(s) found`);
    if (dueWithOr.length > 0) {
      dueWithOr.forEach((p) => console.log(`      - ${p._id} (${p.platform})`));
    }

    console.log("\nQuery 2: Using Date object only");
    const dueWithDate = await recurringPosts
      .find({
        isActive: true,
        nextOccurrence: { $lte: now },
      })
      .toArray();
    console.log(`   Result: ${dueWithDate.length} post(s) found`);
    if (dueWithDate.length > 0) {
      dueWithDate.forEach((p) =>
        console.log(`      - ${p._id} (${p.platform})`)
      );
    }

    console.log("\nQuery 3: Using ISO string only");
    const dueWithString = await recurringPosts
      .find({
        isActive: true,
        nextOccurrence: { $lte: nowISO },
      })
      .toArray();
    console.log(`   Result: ${dueWithString.length} post(s) found`);
    if (dueWithString.length > 0) {
      dueWithString.forEach((p) =>
        console.log(`      - ${p._id} (${p.platform})`)
      );
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 SUMMARY");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const overduePosts = allActive.filter((post) => {
      const nextTime =
        post.nextOccurrence instanceof Date
          ? post.nextOccurrence
          : new Date(post.nextOccurrence);
      return nextTime <= now;
    });

    console.log(`Total active recurring posts: ${allActive.length}`);
    console.log(`Posts that are overdue: ${overduePosts.length}`);
    console.log(`Worker query found: ${dueWithOr.length}`);

    if (overduePosts.length !== dueWithOr.length) {
      console.log("\n⚠️  WARNING: Mismatch detected!");
      console.log("   The worker query is not finding all overdue posts.");
      console.log(
        "   This indicates a type mismatch issue in MongoDB queries."
      );
    } else if (overduePosts.length > 0) {
      console.log("\n✅ Worker query is working correctly!");
      console.log("   Overdue posts should be processed on next worker check.");
    } else {
      console.log("\n✅ No posts are due right now.");
    }
  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    await client.close();
    console.log("\n👋 Disconnected from MongoDB");
  }
}

debugRecurringPosts();
