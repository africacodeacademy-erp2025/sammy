import { NextResponse } from "next/server";
import { connectDB } from "../../../../lib/mongo";

export async function GET() {
  try {
    const db = await connectDB();
    const plans = await db
      .collection("plans")
      .find({ isActive: true })
      .toArray();

    if (!plans || plans.length === 0) {
      return NextResponse.json(
        { success: false, error: "No active plans found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, plans });
  } catch (err: unknown) {
    console.error("Error fetching plans:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
