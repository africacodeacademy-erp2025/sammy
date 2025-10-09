import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../../../../lib/mongo";
import { getUserFromRequest } from "../../../../../lib/auth";

export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const user = await getUserFromRequest(authHeader);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { newEmail } = body ?? {};

    if (!newEmail) {
      return NextResponse.json(
        { success: false, error: "New email is required" },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 }
      );
    }

    const db = await connectDB();
    const users = db.collection("users");

    // Check if email already exists
    const existingUser = await users.findOne({ 
      email: newEmail.toLowerCase(),
      _id: { $ne: user._id } // Exclude current user
    });
    
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "Email already exists" },
        { status: 400 }
      );
    }

    // Update user email
    await users.updateOne(
      { _id: user._id },
      { $set: { email: newEmail.toLowerCase() } }
    );

    return NextResponse.json({
      success: true,
      message: "Email updated successfully",
      email: newEmail.toLowerCase(),
    });
  } catch (err: unknown) {
    console.error("Update email error:", err);
    const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}