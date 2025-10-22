import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../../../../lib/mongo";
import { hashPassword, signJwt } from "../../../../..//lib/auth";
import { getNextUserId } from "../../../../../lib/userHelpers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name } = body ?? {};

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const db = await connectDB();
    const users = db.collection("users");

    const existing = await users.findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "User already exists with that email" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    
    // Get next user ID (starts from 2, since 1 is admin)
    const userId = await getNextUserId();

    const newUser = {
      userId, // Sequential user ID
      email: email.toLowerCase(),
      passwordHash,
      password: passwordHash, // For compatibility
      role: 'user' as const, // Default role is 'user'
      permissions: [] as string[], // No special permissions by default
      name: name ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      lastLogin: null,
    };

    const result = await users.insertOne(newUser);

    const userForClient = {
      _id: result.insertedId,
      userId: newUser.userId,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      createdAt: newUser.createdAt,
    };

    const token = signJwt(result.insertedId.toString());

    return NextResponse.json(
      { success: true, token, user: userForClient },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error("Signup error:", err);
    const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
