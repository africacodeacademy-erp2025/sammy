import { ObjectId } from "mongodb";

export type UserDoc = {
  _id?: ObjectId;
  email: string;
  passwordHash?: string; // Optional for backward compatibility
  password?: string; // For admin initialization
  roleId: ObjectId; // Reference to roles collection
  name?: string;
  createdAt?: Date;
  updatedAt?: Date;
  isActive?: boolean;
  lastLogin?: Date | null;
  resetToken?: string;
  resetTokenExpiry?: Date;
};
