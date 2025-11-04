import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../../lib/auth";
import { connectDB } from "../../../../../lib/mongo";

type Platform = "twitter" | "facebook" | "linkedin" | "slack";

/**
 * DELETE endpoint to disconnect a platform integration
 * Removes all stored credentials for the specified platform
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req.headers.get("authorization"));
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { platform } = await req.json();

    // Validate platform
    const validPlatforms: Platform[] = [
      "twitter",
      "facebook",
      "linkedin",
      "slack",
    ];
    if (!platform || !validPlatforms.includes(platform)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid platform. Must be one of: twitter, facebook, linkedin, slack",
        },
        { status: 400 }
      );
    }

    const db = await connectDB();
    const users = db.collection("users");

    // Remove platform credentials from user document
    const updateResult = await users.updateOne(
      { _id: user._id },
      {
        $unset: { [platform]: "" },
        $set: { updatedAt: new Date() },
      }
    );

    if (updateResult.modifiedCount === 0) {
      console.warn(`No credentials found for ${platform} for user ${user._id}`);
    }

    console.log(
      `✅ Successfully disconnected ${platform} for user ${user._id}`
    );

    return NextResponse.json({
      success: true,
      message: `${
        platform.charAt(0).toUpperCase() + platform.slice(1)
      } disconnected successfully`,
      platform,
    });
  } catch (error) {
    console.error("Error disconnecting platform:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to disconnect platform. Please try again.",
      },
      { status: 500 }
    );
  }
}
