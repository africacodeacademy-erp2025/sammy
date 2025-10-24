import { connectDB } from './mongo';
import { ObjectId } from 'mongodb';

/**
 * Get role by roleId
 */
export async function getRole(roleId: ObjectId) {
  const db = await connectDB();
  const role = await db.collection('roles').findOne({ _id: roleId });
  return role;
}

/**
 * Get role by name
 */
export async function getRoleByName(roleName: 'admin' | 'user') {
  const db = await connectDB();
  const role = await db.collection('roles').findOne({ name: roleName });
  return role;
}

/**
 * Check if a user is an admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const db = await connectDB();
  const user = await db.collection('users').findOne({ 
    _id: new ObjectId(userId)
  });
  
  if (!user || !user.roleId) return false;
  
  const role = await db.collection('roles').findOne({
    _id: new ObjectId(user.roleId)
  });
  
  return role?.name === 'admin';
}

/**
 * Check if user has specific permission
 */
export async function hasPermission(userId: string, permission: string): Promise<boolean> {
  const db = await connectDB();
  const user = await db.collection('users').findOne({ 
    _id: new ObjectId(userId)
  });
  
  if (!user || !user.roleId) return false;
  
  const role = await db.collection('roles').findOne({
    _id: new ObjectId(user.roleId)
  });
  
  if (!role) return false;
  
  // Check if role has 'all' permissions or the specific permission
  return role.permissions?.includes('all') || role.permissions?.includes(permission) || false;
}
