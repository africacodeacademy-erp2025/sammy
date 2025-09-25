/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../../lib/auth";
import { decrypt } from "../../../../../lib/crypto";

async function fetchFacebookPosts(
  pageId: string,
  token: string,
  limit: number
) {
  const url = `https://graph.facebook.com/v21.0/${pageId}/feed`;
  const params = new URLSearchParams({
    access_token: token,
    limit: limit.toString(),
    fields: "id,message,from",
  });

  const res = await fetch(`${url}?${params}`);
  const data = await res.json();
  if (!res.ok) throw new Error("Facebook API error");
  return data;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req.headers.get("authorization"));

    if (!user?.facebook?.pageId || !user.facebook?.accessToken) {
      console.log("Facebook not configured for user");
      return NextResponse.json(
        { error: "Facebook not configured" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const count = parseInt(searchParams.get("count") || "5");

    const decryptedToken = decrypt(user.facebook.accessToken);
    const fbData = await fetchFacebookPosts(
      user.facebook.pageId,
      decryptedToken,
      count
    );

    const messages =
      (fbData.data || []).map((post: any) => ({
        user: user._id,
        message: post.message || "",
        platform: "facebook",
      })) || [];

    return NextResponse.json({ success: true, messages });
  } catch (err: any) {
    console.error("Error in Facebook GET route:", err);
    return NextResponse.json(
      { error: err.message || "Something went wrong" },
      { status: 500 }
    );
  }
}
