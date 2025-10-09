/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../../lib/auth";

/**
 * Facebook posting endpoint using Graph API per user.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req.headers.get("authorization"));
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const post = formData.get("post") as string;
    const platform = formData.get("platform") as string;
    const tokensStr = formData.get("tokens") as string;
    const attachments = formData.getAll("attachments") as File[];

    console.log("=== Facebook Posting Debug ===");
    console.log("Post:", post);
    console.log("Platform:", platform);
    console.log("Attachments received:", attachments.length);
    attachments.forEach((file, index) => {
      console.log(
        `Facebook attachment ${index}: ${file.name}, type: ${file.type}, size: ${file.size}`
      );
    });

    if (!post) {
      return NextResponse.json(
        { error: "Missing 'post' in request body" },
        { status: 400 }
      );
    }

    if (platform && platform.toLowerCase() !== "facebook") {
      return NextResponse.json(
        { error: `Platform '${platform}' not supported by this endpoint.` },
        { status: 400 }
      );
    }

    const tokens = JSON.parse(tokensStr);

    // Prefer tokens from request body, fallback to user.facebook
    const pageId = tokens?.facebook?.pageId || user.facebook?.pageId;
    const pageAccessToken =
      tokens?.facebook?.accessToken || user.facebook?.accessToken;

    if (!pageId || !pageAccessToken) {
      return NextResponse.json(
        { error: "Facebook credentials not configured for this user" },
        { status: 400 }
      );
    }

    try {
      let postResult;

      if (attachments.length > 0) {
        // Post with photo(s)
        console.log(`Uploading ${attachments.length} photos to Facebook...`);

        if (attachments.length === 1) {
          // Single photo post
          const file = attachments[0];
          const buffer = Buffer.from(await file.arrayBuffer());

          const photoFormData = new FormData();
          photoFormData.append(
            "source",
            new Blob([buffer], { type: file.type }),
            file.name
          );
          photoFormData.append("message", post);
          photoFormData.append("access_token", pageAccessToken);

          const photoUrl = `https://graph.facebook.com/v21.0/${pageId}/photos`;
          const photoRes = await fetch(photoUrl, {
            method: "POST",
            body: photoFormData,
          });

          postResult = await photoRes.json();
          console.log("Single photo post result:", postResult);

          if (!photoRes.ok) {
            return NextResponse.json(
              {
                error:
                  postResult?.error?.message || "Facebook photo upload error",
                data: postResult,
              },
              { status: photoRes.status }
            );
          }
        } else {
          // Multiple photos - need to upload photos first, then create post
          console.log("Uploading multiple photos...");
          const photoIds = [];

          for (let i = 0; i < attachments.length; i++) {
            const file = attachments[i];
            const buffer = Buffer.from(await file.arrayBuffer());

            const photoFormData = new FormData();
            photoFormData.append(
              "source",
              new Blob([buffer], { type: file.type }),
              file.name
            );
            photoFormData.append("published", "false"); // Don't publish individual photos
            photoFormData.append("access_token", pageAccessToken);

            const photoUrl = `https://graph.facebook.com/v21.0/${pageId}/photos`;
            const photoRes = await fetch(photoUrl, {
              method: "POST",
              body: photoFormData,
            });

            const photoResult = await photoRes.json();
            console.log(`Photo ${i + 1} upload result:`, photoResult);

            if (!photoRes.ok) {
              return NextResponse.json(
                {
                  error: `Failed to upload photo ${i + 1}: ${
                    photoResult?.error?.message
                  }`,
                  data: photoResult,
                },
                { status: photoRes.status }
              );
            }

            photoIds.push({ media_fbid: photoResult.id });
          }

          // Create post with multiple photos
          const postParams = new URLSearchParams();
          postParams.append("message", post);
          postParams.append("attached_media", JSON.stringify(photoIds));
          postParams.append("access_token", pageAccessToken);

          const postUrl = `https://graph.facebook.com/v21.0/${pageId}/feed`;
          const postRes = await fetch(postUrl, {
            method: "POST",
            body: postParams,
          });

          postResult = await postRes.json();
          console.log("Multiple photos post result:", postResult);

          if (!postRes.ok) {
            return NextResponse.json(
              {
                error:
                  postResult?.error?.message ||
                  "Facebook multi-photo post error",
                data: postResult,
              },
              { status: postRes.status }
            );
          }
        }
      } else {
        // Text-only post
        const url = `https://graph.facebook.com/v21.0/${pageId}/feed`;
        const params = new URLSearchParams();
        params.append("message", post);
        params.append("access_token", pageAccessToken);

        const graphRes = await fetch(url, {
          method: "POST",
          body: params,
        });

        postResult = await graphRes.json();
        console.log("Text-only post result:", postResult);

        if (!graphRes.ok) {
          return NextResponse.json(
            {
              error: postResult?.error?.message || "Facebook Graph API error",
              data: postResult,
            },
            { status: graphRes.status }
          );
        }
      }

      return NextResponse.json({ success: true, data: postResult });
    } catch (uploadError: any) {
      console.error("Error during Facebook upload process:", uploadError);
      return NextResponse.json(
        { error: uploadError.message || "Upload process failed" },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error posting to Facebook:", error);
    return NextResponse.json(
      { error: error?.message || "Something went wrong" },
      { status: 500 }
    );
  }
}
