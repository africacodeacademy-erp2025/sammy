import { ObjectId } from "mongodb";

export type RoleDoc = {
  _id?: ObjectId;
  name: 'admin' | 'user';
  permissions: string[];
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export const DEFAULT_ROLES = {
  ADMIN: 'admin',
  USER: 'user'
} as const;
