import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { botToken, userToken } = await req.json();

    // Prefer bot token, fallback to user token
    const token = botToken || userToken;

    if (!token) {
      return NextResponse.json(
        { error: "Missing Slack token" },
        { status: 400 }
      );
    }

    // Use Slack auth.test API (safe, no message sending)
    const res = await fetch("https://slack.com/api/auth.test", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    const data = await res.json();

    if (!data.ok) {
      return NextResponse.json(
        { error: data.error || "Invalid Slack credentials" },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: "Slack credentials are valid ✅" });
  } catch (err: any) {
    console.error("Slack test error:", err);
    return NextResponse.json(
      { error: "Failed to test Slack credentials" },
      { status: 500 }
    );
  }
}
