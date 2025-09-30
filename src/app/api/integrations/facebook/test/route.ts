import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { pageId, accessToken } = await req.json();

    if (!pageId || !accessToken) {
      return NextResponse.json(
        { error: "Missing Facebook credentials" },
        { status: 400 }
      );
    }

    // Call the Graph API to check Page access
    const url = `https://graph.facebook.com/${pageId}?access_token=${accessToken}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      return NextResponse.json(
        { error: data.error.message || "Invalid Facebook credentials" },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: "Facebook credentials are valid ✅" });
  } catch (err: any) {
    console.error("Facebook test error:", err);
    return NextResponse.json(
      { error: "Failed to test Facebook credentials" },
      { status: 500 }
    );
  }
}
