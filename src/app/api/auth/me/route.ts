import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../..//lib/auth";

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

    return NextResponse.json({ success: true, user });
  } catch (err: any) {
    console.error("Me error:", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}
