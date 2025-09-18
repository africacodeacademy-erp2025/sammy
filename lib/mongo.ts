import { MongoClient, Db } from "mongodb";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 1000;

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function connectDB(): Promise<Db> {
  if (cachedDb) return cachedDb;

  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      if (!cachedClient) {
        cachedClient = new MongoClient(process.env.MONGO_URI!, {
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
        });
        await cachedClient.connect();
        console.log("MongoDB connected successfully");
      }

      cachedDb = cachedClient.db(process.env.DATABASE_NAME);
      return cachedDb;
    } catch (err) {
      attempt++;
      console.error(`MongoDB connection attempt ${attempt} failed:`, err);

      if (attempt >= MAX_RETRIES) {
        throw new Error(
          "Database connection failed after multiple attempts. Please try again later or contact support."
        );
      }

      const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`Retrying in ${delay}ms...`);
      await wait(delay);
    }
  }

  throw new Error(
    "Database connection failed unexpectedly. Please try again later."
  );
}

process.on("SIGINT", async () => {
  if (cachedClient) {
    await cachedClient.close();
    console.log("MongoDB connection closed gracefully (SIGINT).");
    process.exit(0);
  }
});

process.on("SIGTERM", async () => {
  if (cachedClient) {
    await cachedClient.close();
    console.log("MongoDB connection closed gracefully (SIGTERM).");
    process.exit(0);
  }
});
