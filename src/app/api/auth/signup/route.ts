import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../../../../lib/mongo";
import { hashPassword, signJwt } from "../../../../..//lib/auth";

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

    const newUser = {
      email: email.toLowerCase(),
      passwordHash,
      name: name ?? null,
      createdAt: new Date(),
    };

    const result = await users.insertOne(newUser);

    const userForClient = {
      _id: result.insertedId,
      email: newUser.email,
      name: newUser.name,
      createdAt: newUser.createdAt,
    };

    const token = signJwt(result.insertedId.toString());

    return NextResponse.json(
      { success: true, token, user: userForClient },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("Signup error:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}
