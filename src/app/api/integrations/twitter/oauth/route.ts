import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../../../lib/auth";
import crypto from "crypto";

/**
 * Initiates Twitter OAuth2 flow
 * GET /api/integrations/twitter/oauth
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const user = await getUserFromRequest(authHeader);
    if (!user) {
      console.error("Twitter OAuth: User not authenticated");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientId = process.env.TWITTER_CLIENT_ID;
    const redirectUri = process.env.TWITTER_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      console.error("Twitter OAuth: Missing configuration", {
        hasClientId: !!clientId,
        hasRedirectUri: !!redirectUri,
      });
      return NextResponse.json(
        {
          error:
            "Twitter OAuth not configured. Please check environment variables.",
        },
        { status: 500 }
      );
    }

    console.log("Twitter OAuth: Configuration OK", {
      clientId: clientId.substring(0, 10) + "...",
      redirectUri,
    });

    // Generate PKCE code verifier and challenge
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    // Twitter OAuth 2.0 authorization URL
    const scopes = [
      "tweet.read",
      "tweet.write",
      "users.read",
      "offline.access", // For refresh token
    ];

    // Generate state parameter with userId and code verifier for security
    const state = Buffer.from(
      JSON.stringify({
        userId: user._id.toString(),
        timestamp: Date.now(),
        codeVerifier, // Store for callback
      })
    ).toString("base64");

    const authUrl = new URL("https://twitter.com/i/oauth2/authorize");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scopes.join(" "));
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    console.log("Twitter OAuth: Generated auth URL", {
      hasState: !!state,
      hasCodeChallenge: !!codeChallenge,
      scopes: scopes.join(" "),
    });

    return NextResponse.json({ authUrl: authUrl.toString() });
  } catch (error) {
    console.error("Error initiating Twitter OAuth:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
