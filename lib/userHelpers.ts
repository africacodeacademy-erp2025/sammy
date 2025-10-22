import { connectDB } from './mongo';
import { ObjectId } from 'mongodb';

interface CounterDoc {
  _id: string;
  sequence: number;
}

/**
 * Get the next available user ID
 * Admin has ID 1, regular users start from ID 2
 */
export async function getNextUserId(): Promise<number> {
  const db = await connectDB();
  
  const counter = await db.collection<CounterDoc>('counters').findOneAndUpdate(
    { _id: 'userId' },
    { $inc: { sequence: 1 } },
    { upsert: true, returnDocument: 'after' }
  );

  return counter?.sequence || 2; // Start from 2 if counter doesn't exist
}

/**
 * Check if a user is an admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const db = await connectDB();
  const user = await db.collection('users').findOne({ 
    _id: new ObjectId(userId)
  });
  
  return user?.role === 'admin' || user?.userId === 1;
}

/**
 * Check if user has specific permission
 */
export async function hasPermission(userId: string, permission: string): Promise<boolean> {
  const db = await connectDB();
  const user = await db.collection('users').findOne({ 
    _id: new ObjectId(userId)
  });
  
  if (!user) return false;
  
  // Admin has all permissions
  if (user.role === 'admin' || user.userId === 1) return true;
  
  // Check if user has the specific permission
  return user.permissions?.includes(permission) || user.permissions?.includes('all') || false;
}
