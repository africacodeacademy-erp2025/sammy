import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../../../lib/auth";
import crypto from "crypto";

/**
 * Initiates LinkedIn OAuth2 flow
 * GET /api/integrations/linkedin/oauth
 */
export async function GET(req: NextRequest) {
  try {
    // Get auth token from query parameter
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      console.error("LinkedIn OAuth: Authentication token required");
      return NextResponse.json(
        { error: "Authentication token required" },
        { status: 401 }
      );
    }

    const user = await getUserFromRequest(`Bearer ${token}`);
    if (!user) {
      console.error("LinkedIn OAuth: User not authenticated");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const redirectUri = process.env.LINKEDIN_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      console.error("LinkedIn OAuth: Missing configuration", {
        hasClientId: !!clientId,
        hasRedirectUri: !!redirectUri,
      });
      return NextResponse.json(
        {
          error:
            "LinkedIn OAuth not configured. Please check environment variables.",
        },
        { status: 500 }
      );
    }

    console.log("LinkedIn OAuth: Configuration OK", {
      clientId: clientId.substring(0, 10) + "...",
      redirectUri,
    });

    // LinkedIn OAuth 2.0 authorization URL
    const scopes = [
      "openid",
      "profile",
      "email",
      "w_member_social", // Post shares on behalf of the user
    ];

    // Generate state parameter with userId for security
    const state = Buffer.from(
      JSON.stringify({
        userId: user._id.toString(),
        timestamp: Date.now(),
        token, // Store auth token for callback
      })
    ).toString("base64");

    const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scopes.join(" "));
    authUrl.searchParams.set("state", state);

    console.log("LinkedIn OAuth: Generated auth URL", {
      hasState: !!state,
      scopes: scopes.join(" "),
    });

    // Redirect directly to LinkedIn OAuth
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Error initiating LinkedIn OAuth:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
