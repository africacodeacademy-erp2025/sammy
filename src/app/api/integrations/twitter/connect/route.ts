import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../../../lib/auth";
import {
  saveTwitterConfig,
  getTwitterConfig,
} from "../../../../../../lib/integrations/twitter";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const user = await getUserFromRequest(authHeader);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { appKey, appSecret, accessToken, accessSecret } = body;

    if (!appKey || !appSecret || !accessToken || !accessSecret) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    await saveTwitterConfig(user._id.toString(), {
      appKey,
      appSecret,
      accessToken,
      accessSecret,
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
