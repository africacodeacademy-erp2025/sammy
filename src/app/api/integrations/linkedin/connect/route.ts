import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../../../lib/auth";
import {
  saveLinkedInConfig,
  getLinkedInConfig,
} from "../../../../../../lib/integrations/linkedin";

/**
 * POST: Save LinkedIn OAuth 2.0 credentials
 * GET: Retrieve LinkedIn credentials
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const user = await getUserFromRequest(authHeader);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    // Only accept OAuth 2.0 tokens
    if (!body.accessToken) {
      return NextResponse.json(
        {
          error:
            "Missing OAuth tokens. Please use the OAuth flow to connect your account.",
        },
        { status: 400 }
      );
    }

    await saveLinkedInConfig(user._id.toString(), {
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
      expiresAt: body.expiresAt,
      personUrn: body.personUrn,
    });

    return NextResponse.json({
      message: "LinkedIn config saved successfully",
    });
  } catch (error) {
    console.error("Error saving LinkedIn config:", error);
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

    const config = await getLinkedInConfig(user._id.toString());
    return NextResponse.json({ linkedin: config });
  } catch (error) {
    console.error("Error fetching LinkedIn config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
