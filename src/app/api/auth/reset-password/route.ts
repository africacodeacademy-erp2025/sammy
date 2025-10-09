import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../../../../lib/mongo";
import { hashPassword } from "../../../../../lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, password } = body ?? {};

    if (!token || !password) {
      return NextResponse.json(
        { success: false, error: "Token and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const db = await connectDB();
    const users = db.collection("users");

    // Find user with valid reset token
    const user = await users.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired reset token" },
        { status: 400 }
      );
    }

    // Hash new password
    const passwordHash = await hashPassword(password);

    // Update user password and remove reset token
    await users.updateOne(
      { _id: user._id },
      {
        $set: { passwordHash },
        $unset: { resetToken: "", resetTokenExpiry: "" },
      }
    );

    return NextResponse.json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (err: unknown) {
    console.error("Reset password error:", err);
    const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}