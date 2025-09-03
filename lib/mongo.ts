import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGO_URI!);
let db: ReturnType<MongoClient["db"]>;

export async function connectDB() {
  if (!db) {
    await client.connect();
    db = client.db(process.env.DATABASE_NAME);
    console.log("Connected to MongoDB Atlas");
  }
  return db;
}
