// src/app/api/postings/linkedin-posting/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { refreshLinkedInToken } from "../../../../../lib/platforms/linkedinPosting";
import { getUserFromRequest } from "../../../../../lib/auth";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const post = formData.get("post") as string;
    const platform = formData.get("platform") as string;
    const tokensStr = formData.get("tokens") as string;
    const attachments = formData.getAll("attachments") as File[];

    console.log("=== LinkedIn Posting Debug ===");
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

    if (!tokens?.linkedin) {
      return NextResponse.json(
        { error: "No LinkedIn token provided for this user" },
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

    console.log("Using LinkedIn OAuth 2.0 credentials");

    // Use OAuth 2.0 access token
    let accessToken = tokens.linkedin.accessToken;
    const personUrn = tokens.linkedin.personUrn;

    if (!personUrn) {
      return NextResponse.json(
        { error: "LinkedIn person URN not available" },
        { status: 400 }
      );
    }

    try {
      // LinkedIn UGC Post API
      const sharePayload: any = {
        author: personUrn,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: {
              text: post,
            },
            shareMediaCategory: attachments.length > 0 ? "IMAGE" : "NONE",
          },
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
        },
      };

      // If there are attachments, handle media upload first
      if (attachments.length > 0) {
        console.log(
          `Uploading ${attachments.length} attachments to LinkedIn...`
        );
        const mediaAssets = await Promise.all(
          attachments.map(async (file, index) => {
            console.log(
              `Uploading file ${index + 1}: ${file.name}, type: ${
                file.type
              }, size: ${file.size}`
            );

            // Register upload for the media
            const registerResponse = await fetch(
              "https://api.linkedin.com/v2/assets?action=registerUpload",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                  "X-Restli-Protocol-Version": "2.0.0",
                },
                body: JSON.stringify({
                  registerUploadRequest: {
                    recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
                    owner: personUrn,
                    serviceRelationships: [
                      {
                        relationshipType: "OWNER",
                        identifier: "urn:li:userGeneratedContent",
                      },
                    ],
                  },
                }),
              }
            );

            if (!registerResponse.ok) {
              throw new Error(
                `Failed to register media upload: ${await registerResponse.text()}`
              );
            }

            const registerData = await registerResponse.json();
            const uploadUrl =
              registerData.value.uploadMechanism[
                "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
              ].uploadUrl;
            const asset = registerData.value.asset;

            // Upload the actual file
            const buffer = Buffer.from(await file.arrayBuffer());
            const uploadResponse = await fetch(uploadUrl, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
              body: buffer,
            });

            if (!uploadResponse.ok) {
              throw new Error(
                `Failed to upload media: ${await uploadResponse.text()}`
              );
            }

            console.log(
              `Successfully uploaded file ${index + 1}, asset: ${asset}`
            );
            return asset;
          })
        );

        // Add media to the share payload
        sharePayload.specificContent["com.linkedin.ugc.ShareContent"].media =
          mediaAssets.map((asset) => ({
            status: "READY",
            media: asset,
          }));

        console.log(
          `All media uploaded successfully. Assets: ${mediaAssets.join(", ")}`
        );
      }

      console.log("Share payload:", JSON.stringify(sharePayload, null, 2));

      // Post to LinkedIn with timeout and retry logic
      console.log("Posting to LinkedIn API...");
      let shareResponse;
      try {
        // Create an AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        shareResponse = await fetch("https://api.linkedin.com/v2/ugcPosts", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
          },
          body: JSON.stringify(sharePayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        console.error("=== LinkedIn API Network Error ===");
        console.error("Error name:", fetchError.name);
        console.error("Error code:", fetchError.code);
        console.error("Error message:", fetchError.message);
        console.error("Error cause:", fetchError.cause);
        console.error(
          "Full error:",
          JSON.stringify(fetchError, Object.getOwnPropertyNames(fetchError))
        );

        // Log environment diagnostics
        console.error("Environment diagnostics:");
        console.error("- NODE_ENV:", process.env.NODE_ENV);
        console.error("- Platform:", process.platform);
        console.error("- Node version:", process.version);

        // Check if it's a timeout/connection error
        if (
          fetchError.name === "AbortError" ||
          fetchError.code === "UND_ERR_CONNECT_TIMEOUT" ||
          fetchError.code === "ETIMEDOUT" ||
          fetchError.code === "ECONNREFUSED" ||
          fetchError.code === "ENOTFOUND"
        ) {
          return NextResponse.json(
            {
              error: "Network error connecting to LinkedIn",
              errorCode: fetchError.code || fetchError.name,
              details: fetchError.message,
              possibleCauses: [
                "DNS resolution failure (ENOTFOUND)",
                "Firewall blocking outbound HTTPS connections",
                "LinkedIn API is unreachable from this server",
                "Network timeout or connection refused",
              ],
              recommendation:
                "Check server network configuration, firewall rules, and DNS settings. Contact infrastructure team if using cloud hosting.",
            },
            { status: 504 }
          );
        }

        // Re-throw other errors
        throw fetchError;
      }

      if (!shareResponse.ok) {
        const errorText = await shareResponse.text();
        console.error("LinkedIn share failed:", errorText);

        // Check if it's a 401 error (token expired)
        if (shareResponse.status === 401) {
          console.log("Token expired, attempting to refresh...");

          const newAccessToken = await refreshLinkedInToken(
            user._id.toString()
          );

          if (newAccessToken) {
            console.log("Token refreshed successfully, retrying request...");
            accessToken = newAccessToken;

            // Retry the post with refreshed token (with timeout)
            try {
              const retryController = new AbortController();
              const retryTimeoutId = setTimeout(
                () => retryController.abort(),
                30000
              );

              const retryResponse = await fetch(
                "https://api.linkedin.com/v2/ugcPosts",
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                    "X-Restli-Protocol-Version": "2.0.0",
                  },
                  body: JSON.stringify(sharePayload),
                  signal: retryController.signal,
                }
              );

              clearTimeout(retryTimeoutId);

              if (!retryResponse.ok) {
                throw new Error(
                  `LinkedIn post failed on retry: ${await retryResponse.text()}`
                );
              }

              const retryData = await retryResponse.json();
              console.log("LinkedIn post successful on retry:", retryData);
              return NextResponse.json({ success: true, post: retryData });
            } catch (retryError: any) {
              console.error("=== LinkedIn API Retry Network Error ===");
              console.error("Error name:", retryError.name);
              console.error("Error code:", retryError.code);
              console.error("Error message:", retryError.message);
              console.error("Error cause:", retryError.cause);

              if (
                retryError.name === "AbortError" ||
                retryError.code === "UND_ERR_CONNECT_TIMEOUT" ||
                retryError.code === "ETIMEDOUT" ||
                retryError.code === "ECONNREFUSED" ||
                retryError.code === "ENOTFOUND"
              ) {
                return NextResponse.json(
                  {
                    error: "Network error on retry",
                    errorCode: retryError.code || retryError.name,
                    details: retryError.message,
                    recommendation:
                      "Server cannot reach api.linkedin.com. Check network/firewall configuration.",
                  },
                  { status: 504 }
                );
              }
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
        }

        throw new Error(`LinkedIn post failed: ${errorText}`);
      }

      const shareData = await shareResponse.json();
      console.log("LinkedIn post successful:", shareData);
      return NextResponse.json({ success: true, post: shareData });
    } catch (linkedinError: any) {
      console.error("Error posting to LinkedIn:", linkedinError);
      throw linkedinError;
    }
  } catch (error: any) {
    console.error("Error posting to LinkedIn:", error);
    return NextResponse.json(
      {
        error: error.message || "Something went wrong",
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
