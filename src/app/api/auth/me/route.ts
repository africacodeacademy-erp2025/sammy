import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../..//lib/auth";
import { connectDB } from "../../../../../lib/mongo";
import { ObjectId } from "mongodb";

export async function GET(req: NextRequest) {
  try {
    // read Authorization header
    const authHeader = req.headers.get("authorization");
    const user = await getUserFromRequest(authHeader);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Get user's role information
    const db = await connectDB();
    const role = user.roleId ? await db.collection("roles").findOne({
      _id: new ObjectId(user.roleId)
    }) : null;

    // Return user with all necessary fields for dashboard selection
    return NextResponse.json({ 
      success: true, 
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        roleId: user.roleId,
        role: role?.name || 'user',
        permissions: role?.permissions || [],
        isActive: user.isActive !== false,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });
  } catch (err: unknown) {
    console.error("Me error:", err);
    const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
