import { NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../lib/auth";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const user = await getUserFromRequest(authHeader);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      id: user._id,
      email: user.email,
      slack: user.slack ?? null,
      twitter: user.twitter ?? null,
      facebook: user.facebook ?? null,
    });
  } catch (err) {
    console.error("Error in /api/user:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
