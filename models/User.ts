import { ObjectId } from "mongodb";

export type UserDoc = {
  _id?: ObjectId;
  userId?: number; // Sequential user ID (1 for admin, 2+ for regular users)
  email: string;
  passwordHash?: string; // Optional for backward compatibility
  password?: string; // For admin initialization
  role?: 'admin' | 'user'; // User role
  permissions?: string[]; // User permissions
  name?: string;
  createdAt?: Date;
  updatedAt?: Date;
  isActive?: boolean;
  lastLogin?: Date | null;
  resetToken?: string;
  resetTokenExpiry?: Date;
};
