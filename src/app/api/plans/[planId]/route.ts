import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../../../../lib/mongo";
import { ObjectId } from "mongodb";

// GET /api/plans/:planId — supports lookup by MongoDB _id (24-char hex) or numeric planId
export async function GET(
  request: NextRequest,
  { params }: { params: { planId?: string } | Promise<{ planId?: string }> }
) {
  try {
    // params may be a Promise in some Next.js runtimes - await it to be safe
    const resolvedParams = await params;
    const planIdParam = resolvedParams?.planId;

    if (!planIdParam) {
      return NextResponse.json(
        { success: false, error: "Plan ID is required" },
        { status: 400 }
      );
    }

    const db = await connectDB();
    const plans = db.collection("plans");

    // If planId looks like a MongoDB ObjectId (24 hex chars), search by _id.
    let plan = null;
    if (/^[0-9a-fA-F]{24}$/.test(planIdParam)) {
      try {
        plan = await plans.findOne({ _id: new ObjectId(planIdParam) });
      } catch (e) {
        // ignore and fall back to other lookup strategies
      }
    }

    // If not found by _id, try numeric planId field (legacy)
    if (!plan) {
      const numeric = Number(planIdParam);
      if (!Number.isNaN(numeric)) {
        plan = await plans.findOne({ planId: numeric });
      }
    }

    if (!plan) {
      return NextResponse.json(
        { success: false, error: "Plan not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, plan });
  } catch (err: unknown) {
    console.error("Error fetching plan:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
