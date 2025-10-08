import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../../../lib/auth";
import {
  saveTwitterConfig,
  getTwitterConfig,
} from "../../../../../../lib/integrations/twitter";

/**
 * POST: Save Twitter OAuth 2.0 credentials
 * GET: Retrieve Twitter credentials
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const user = await getUserFromRequest(authHeader);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    // Only accept OAuth 2.0 tokens
    if (!body.accessToken || !body.refreshToken) {
      return NextResponse.json(
        {
          error:
            "Missing OAuth tokens. Please use the OAuth flow to connect your account.",
        },
        { status: 400 }
      );
    }

    await saveTwitterConfig(user._id.toString(), {
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
      expiresAt: body.expiresAt,
    });

    return NextResponse.json({ message: "Twitter config saved successfully" });
  } catch (error) {
    console.error("Error saving Twitter config:", error);
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

    const config = await getTwitterConfig(user._id.toString());
    return NextResponse.json({ twitter: config });
  } catch (error) {
    console.error("Error fetching Twitter config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
