import { NextRequest, NextResponse } from "next/server";

/**
 * Slack OAuth Initiation Route
 *
 * Generates and redirects to Slack's OAuth authorization URL.
 * Uses OAuth 2.0 with required scopes for reading channels and messages.
 * Accepts auth token via query parameter to maintain user session through OAuth flow.
 */
export async function GET(req: NextRequest) {
  try {
    // Get auth token from query parameter
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Authentication token required" },
        { status: 401 }
      );
    }

    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = process.env.SLACK_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { error: "Slack OAuth configuration is missing" },
        { status: 500 }
      );
    }

    // Define required scopes
    // Bot scopes: what the bot can do (including private channels)
    // User scopes: what the app can do on behalf of the user
    const scopes = [
      "channels:history",
      "channels:read",
      "groups:history",
      "groups:read",
      "users:read",
      "chat:write",
    ].join(",");

    const userScopes = [
      "channels:history",
      "channels:read",
      "groups:history",
      "groups:read",
      "users:read",
    ].join(",");

    // Generate state for CSRF protection and encode the token in it
    // State format: randomString:base64Token
    const randomState = Math.random().toString(36).substring(2, 15);
    const state = `${randomState}:${Buffer.from(token).toString("base64")}`;

    // Build Slack OAuth URL
    const authUrl = new URL("https://slack.com/oauth/v2/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("user_scope", userScopes);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);

    // Redirect to Slack authorization page
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Slack OAuth initiation error:", error);
    return NextResponse.json(
      { error: "Failed to initiate Slack OAuth" },
      { status: 500 }
    );
  }
}
