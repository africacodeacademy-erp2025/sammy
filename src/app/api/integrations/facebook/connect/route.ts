import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../../../lib/auth";
import {
  saveFacebookConfig,
  getFacebookConfig,
} from "../../../../../../lib/integrations/facebook";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const user = await getUserFromRequest(authHeader);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { pageId, accessToken } = body;

    if (!pageId || !accessToken) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    await saveFacebookConfig(user._id.toString(), { pageId, accessToken });

    return NextResponse.json({ message: "Facebook config saved successfully" });
  } catch (error) {
    console.error("Error saving Facebook config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const user = await getUserFromRequest(authHeader);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const config = await getFacebookConfig(user._id.toString());
    return NextResponse.json({ facebook: config });
  } catch (error) {
    console.error("Error fetching Facebook config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
