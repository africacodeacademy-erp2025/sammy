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

    // Update last login timestamp
    await users.updateOne(
      { _id: user._id },
      { $set: { lastLogin: new Date() } }
    );

    // Get user's role
    // user.roleId is already an ObjectId from MongoDB
    const role = await db.collection("roles").findOne({
      _id: user.roleId,
    });

    console.log("User roleId:", user.roleId);
    console.log("Found role:", role);
    console.log("Role name:", role?.name);

    const token = signJwt(user._id.toString());

    const userForClient = {
      _id: user._id,
      email: user.email,
      name: user.name,
      roleId: user.roleId,
      role: role?.name || "user",
      planId: user.planId || 1, // Default to basic plan if not set
      createdAt: user.createdAt,
    };

    console.log("Sending userForClient:", userForClient);

    return NextResponse.json({ success: true, token, user: userForClient });
  } catch (err: unknown) {
    console.error("Login error:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
