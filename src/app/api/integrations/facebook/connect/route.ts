import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../../../lib/auth";
import {
  saveFacebookConfig,
  getFacebookConfig,
} from "../../../../../../lib/integrations/facebook";

/**
 * POST: Save Facebook OAuth credentials
 * GET: Retrieve Facebook credentials
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const user = await getUserFromRequest(authHeader);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { accessToken, pages } = body;

    // Require OAuth flow data
    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            "Missing access token. Please use the OAuth flow to connect your account.",
        },
        { status: 400 }
      );
    }

    await saveFacebookConfig(user._id.toString(), {
      pageId: pages && pages.length > 0 ? pages[0].id : "",
      accessToken,
      pages,
    });

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
