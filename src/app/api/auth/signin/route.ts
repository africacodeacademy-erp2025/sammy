import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../../../../lib/mongo";
import { verifyPassword, signJwt } from "../../../../..//lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body ?? {};

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    const db = await connectDB();
    const users = db.collection("users");

    const user = await users.findOne({ email: email.toLowerCase() });
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = signJwt(user._id.toString());

    const userForClient = {
      _id: user._id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };

    return NextResponse.json({ success: true, token, user: userForClient });
  } catch (err: any) {
    console.error("Login error:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}
