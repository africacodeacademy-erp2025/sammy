import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../../../lib/auth";

/**
 * Initiates Facebook OAuth2 flow
 * GET /api/integrations/facebook/oauth
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const user = await getUserFromRequest(authHeader);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientId = process.env.FACEBOOK_APP_ID;
    const redirectUri = process.env.FACEBOOK_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { error: "Facebook OAuth not configured" },
        { status: 500 }
      );
    }

    // Facebook OAuth 2.0 authorization URL
    const scopes = [
      "pages_manage_posts",
      "pages_read_engagement",
      "pages_read_user_content",
      "pages_show_list",
    ];

    // Generate state parameter with userId for security
    const state = Buffer.from(
      JSON.stringify({
        userId: user._id.toString(),
        timestamp: Date.now(),
      })
    ).toString("base64");

    const authUrl = new URL("https://www.facebook.com/v18.0/dialog/oauth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scopes.join(","));
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("response_type", "code");

    return NextResponse.json({ authUrl: authUrl.toString() });
  } catch (error) {
    console.error("Error initiating Facebook OAuth:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
