import { NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../../../lib/auth";
import { saveSlackConfig } from "../../../../../../lib/integrations/slack";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const user = await getUserFromRequest(authHeader);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { workspaceId, botToken, userToken, channels } = body;

    // Validate workspaceId
    if (
      !workspaceId ||
      typeof workspaceId !== "string" ||
      !workspaceId.trim()
    ) {
      return NextResponse.json(
        { error: "Workspace ID is required." },
        { status: 400 }
      );
    }

    // Validate channels
    let channelArr: string[] = [];
    if (Array.isArray(channels)) {
      channelArr = channels.filter((c) => typeof c === "string" && c.trim());
    } else if (typeof channels === "string") {
      channelArr = channels
        .split(",")
        .map((c: string) => c.trim())
        .filter(Boolean);
    }
    if (!channelArr.length) {
      return NextResponse.json(
        { error: "At least one channel must be provided." },
        { status: 400 }
      );
    }

    if (!botToken && !userToken) {
      return NextResponse.json(
        {
          error: "At least one of botToken or userToken must be provided",
        },
        { status: 400 }
      );
    }

    await saveSlackConfig(user._id.toString(), {
      workspaceId,
      botToken,
      userToken,
      channels: channelArr,
    });

    return NextResponse.json({ success: true, message: "Slack config saved" });
  } catch (err: any) {
    console.error("Slack connect error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to save Slack config" },
      { status: 500 }
    );
  }
}
