import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../../../../../lib/mongo";

export async function POST(req: NextRequest) {
  // Initialize Stripe at runtime
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json(
      { error: "Missing Stripe signature" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("Webhook signature error", err.message);
    return NextResponse.json({ error: "Webhook Error" }, { status: 400 });
  }

  // Handle subscription lifecycle events
  try {
    switch (event.type) {
      case "checkout.session.completed":
        console.log("✅ Checkout session completed:", event.data.object.id);
        try {
          const session = event.data.object as any;
          const metadata = session.metadata || {};
          const userId = metadata.userId;
          const targetPlanId = metadata.planId ? Number(metadata.planId) : null;

          if (userId) {
            const db = await connectDB();
            const users = db.collection("users");

            // Get current user to check their existing planId
            const currentUser = await users.findOne({
              _id: new (require("mongodb").ObjectId)(userId),
            });

            const currentPlanId =
              typeof currentUser?.planId === "number"
                ? currentUser.planId
                : null;

            console.log(
              `Webhook: User ${userId} current plan: ${currentPlanId}, target plan: ${targetPlanId}`
            );

            // ONLY update planId if it's different (actual upgrade/downgrade)
            if (targetPlanId && targetPlanId !== currentPlanId) {
              await users.updateOne(
                { _id: new (require("mongodb").ObjectId)(userId) },
                { $set: { planId: targetPlanId } } // Use numeric planId, NOT _id
              );
              console.log(
                `Webhook: Updated user ${userId} from plan ${currentPlanId} to plan ${targetPlanId}`
              );
            } else {
              console.log(
                `Webhook: Payment processed for user ${userId}, plan unchanged (${currentPlanId})`
              );
            }
          }
        } catch (innerErr) {
          console.error("Error updating user plan from webhook:", innerErr);
        }
        break;
      case "customer.subscription.created":
        console.log("🟢 Subscription started:", event.data.object.id);
        break;
      case "customer.subscription.deleted":
        console.log("🔴 Subscription cancelled:", event.data.object.id);
        break;
      case "invoice.payment_succeeded":
        console.log("💰 Payment success:", event.data.object.id);
        try {
          const invoice = event.data.object as any;
          const subscriptionId = invoice.subscription;

          if (subscriptionId) {
            const db = await connectDB();
            const users = db.collection("users");

            // Find user by subscription ID - this is a renewal payment
            const user = await users.findOne({
              stripeSubscriptionId: subscriptionId,
            });

            if (user) {
              console.log(
                `Webhook: Renewal payment for user ${user._id}, plan unchanged (${user.planId})`
              );
              // Don't change planId on renewals - user stays on current plan
            } else {
              console.log(
                `Webhook: No user found for subscription ${subscriptionId}`
              );
            }
          }
        } catch (innerErr) {
          console.error("Error processing invoice payment webhook:", innerErr);
        }
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  } catch (err) {
    console.error("Webhook handler error", err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
