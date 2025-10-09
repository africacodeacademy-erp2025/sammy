import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../../../../lib/mongo";
import { hashPassword, getUserFromRequest, verifyPassword } from "../../../../../lib/auth";

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
    const { currentPassword, newPassword } = body ?? {};

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: "Current password and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: "New password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const db = await connectDB();
    const users = db.collection("users");

    // Get user with password hash to verify current password
    const userWithPassword = await users.findOne({ _id: user._id });
    if (!userWithPassword) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Verify current password
    const isValidPassword = await verifyPassword(currentPassword, userWithPassword.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update user password
    await users.updateOne(
      { _id: user._id },
      { $set: { passwordHash } }
    );

    return NextResponse.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (err: unknown) {
    console.error("Change password error:", err);
    const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}