import { MongoClient, Db } from "mongodb";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectDB(): Promise<Db> {
  if (cachedDb) return cachedDb;

  if (!cachedClient) {
    cachedClient = new MongoClient(process.env.MONGO_URI!, {
      maxPoolSize: 10,
    });
    await cachedClient.connect();
    console.log("MongoDB connected successfully");
  }

  cachedDb = cachedClient.db(process.env.DATABASE_NAME);
  return cachedDb;
}
