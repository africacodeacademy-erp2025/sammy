// src/app/api/postings/x-posting/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";
import { refreshTwitterToken } from "../../../../../lib/platforms/twitterPosting";
import { getUserFromRequest } from "../../../../../lib/auth";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const post = formData.get("post") as string;
    const platform = formData.get("platform") as string;
    const tokensStr = formData.get("tokens") as string;
    const attachments = formData.getAll("attachments") as File[];

    console.log("=== Twitter Posting Debug ===");
    console.log("Post:", post);
    console.log("Platform:", platform);
    console.log("Attachments received:", attachments.length);
    attachments.forEach((file, index) => {
      console.log(
        `Attachment ${index}: ${file.name}, size: ${file.size}, type: ${file.type}`
      );
    });

    if (!post || !platform) {
      return NextResponse.json(
        { error: "Missing 'post' or 'platform' in request body" },
        { status: 400 }
      );
    }

    const tokens = JSON.parse(tokensStr);

    if (!tokens?.twitter) {
      return NextResponse.json(
        { error: "No Twitter token provided for this user" },
        { status: 400 }
      );
    }

    // Get user information from the Authorization header
    const authHeader = req.headers.get("Authorization");
    const user = await getUserFromRequest(authHeader);

    if (!user) {
      return NextResponse.json(
        { error: "User authentication failed" },
        { status: 401 }
      );
    }

    console.log("Using Twitter OAuth 2.0 credentials");

    // Use OAuth 2.0 access token
    let accessToken = tokens.twitter.accessToken;
    let client = new TwitterApi(accessToken);

    try {
      let mediaIds: string[] = [];
      if (attachments.length > 0) {
        console.log(
          `Uploading ${attachments.length} attachments to Twitter...`
        );
        mediaIds = await Promise.all(
          attachments.map(async (file, index) => {
            console.log(
              `Uploading file ${index + 1}: ${file.name}, type: ${
                file.type
              }, size: ${file.size}`
            );
            const buffer = Buffer.from(await file.arrayBuffer());
            const mediaId = await client.v1.uploadMedia(buffer, {
              mimeType: file.type,
            });
            console.log(
              `Successfully uploaded file ${index + 1}, media ID: ${mediaId}`
            );
            return mediaId;
          })
        );
        console.log(
          `All media uploaded successfully. Media IDs: ${mediaIds.join(", ")}`
        );
      }

      const tweetOptions =
        mediaIds.length > 0 ? { media: { media_ids: mediaIds as any } } : {};
      console.log("Tweet options:", tweetOptions);

      const tweet = await client.v2.tweet(post, tweetOptions);
      console.log("Tweet posted successfully:", tweet);
      return NextResponse.json({ success: true, tweet });
    } catch (twitterError: any) {
      // Check if it's a 401 error (token expired)
      if (twitterError.code === 401) {
        console.log("Token expired, attempting to refresh...");

        const newAccessToken = await refreshTwitterToken(user._id.toString());

        if (newAccessToken) {
          console.log("Token refreshed successfully, retrying request...");
          client = new TwitterApi(newAccessToken);

          try {
            let mediaIds: string[] = [];
            if (attachments.length > 0) {
              console.log(
                `Retrying upload of ${attachments.length} attachments after token refresh...`
              );
              mediaIds = await Promise.all(
                attachments.map(async (file, index) => {
                  console.log(
                    `Retrying upload file ${index + 1}: ${file.name}, type: ${
                      file.type
                    }, size: ${file.size}`
                  );
                  const buffer = Buffer.from(await file.arrayBuffer());
                  const mediaId = await client.v1.uploadMedia(buffer, {
                    mimeType: file.type,
                  });
                  console.log(
                    `Successfully uploaded file ${
                      index + 1
                    } on retry, media ID: ${mediaId}`
                  );
                  return mediaId;
                })
              );
              console.log(
                `All media uploaded successfully on retry. Media IDs: ${mediaIds.join(
                  ", "
                )}`
              );
            }

            const tweetOptions =
              mediaIds.length > 0
                ? { media: { media_ids: mediaIds as any } }
                : {};
            console.log("Tweet options on retry:", tweetOptions);

            const tweet = await client.v2.tweet(post, tweetOptions);
            console.log("Tweet posted successfully on retry:", tweet);
            return NextResponse.json({ success: true, tweet });
          } catch (retryError: any) {
            console.error("Error after token refresh:", retryError);
            throw retryError;
          }
        } else {
          return NextResponse.json(
            {
              error:
                "Token expired and could not be refreshed. Please reauthenticate.",
            },
            { status: 401 }
          );
        }
      } else {
        throw twitterError;
      }
    }
  } catch (error: any) {
    console.error("Error posting to X/Twitter:", error);
    return NextResponse.json(
      {
        error: error.message || "Something went wrong",
        code: error.code,
        data: error.data,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
