import { ObjectId } from "mongodb";

export type UserDoc = {
  _id?: ObjectId;
  email: string;
  passwordHash: string;
  name?: string;
  createdAt?: Date;
};
