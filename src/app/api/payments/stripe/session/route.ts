import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../../../../../lib/mongo";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  try {
    // Initialize Stripe at runtime
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    // Expand line_items and subscription details
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items.data.price.product", "subscription", "customer"],
    });

    // If the session contains metadata.userId and the session looks completed,
    // update the user's plan in the DB immediately so the app can reflect the upgrade
    try {
      const metadata: any = (session as any).metadata || {};
      const userId = metadata.userId;
      // Determine priceId from line items if present
      const priceId =
        (session as any).line_items?.data?.[0]?.price?.id || metadata.priceId;

      const isCompleted =
        (session as any).payment_status === "paid" ||
        !!(session as any).subscription;

      if (userId && isCompleted) {
        const db = await connectDB();
        const users = db.collection("users");
        const plans = db.collection("plans");

        // Get metadata planId (the plan user is trying to subscribe to)
        const targetPlanId = metadata.planId ? Number(metadata.planId) : null;

        // Get current user to check their existing planId
        const currentUser = await users.findOne({
          _id: new (require("mongodb").ObjectId)(userId),
        });

        const currentPlanId =
          typeof currentUser?.planId === "number" ? currentUser.planId : null;

        console.log(
          `Session finalize: User ${userId} current plan: ${currentPlanId}, target plan: ${targetPlanId}`
        );

        // ONLY update planId if it's different (actual upgrade/downgrade)
        // Don't update if user is just paying for their current subscription
        if (targetPlanId && targetPlanId !== currentPlanId) {
          await users.updateOne(
            { _id: new (require("mongodb").ObjectId)(userId) },
            {
              $set: {
                planId: targetPlanId, // Use numeric planId, NOT _id
                stripeSubscriptionId: (session as any).subscription?.id || null,
              },
            }
          );
          console.log(
            `Session finalize: Updated user ${userId} from plan ${currentPlanId} to plan ${targetPlanId}`
          );
        } else {
          // Just update subscription ID without changing plan
          await users.updateOne(
            { _id: new (require("mongodb").ObjectId)(userId) },
            {
              $set: {
                stripeSubscriptionId: (session as any).subscription?.id || null,
              },
            }
          );
          console.log(
            `Session finalize: Updated subscription for user ${userId}, plan unchanged (${currentPlanId})`
          );
        }
      }
    } catch (err) {
      console.error("Error finalizing session and updating user plan:", err);
    }

    return NextResponse.json(session);
  } catch (err: any) {
    console.error("Session retrieve error", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
