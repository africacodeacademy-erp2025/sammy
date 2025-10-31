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
          const priceId = metadata.priceId;
          if (userId) {
            const db = await connectDB();
            const users = db.collection("users");
            // Set user's planId based on the purchased priceId
            // Recommendation: map priceId to actual planId in DB or set planId to priceId if that's your convention.
            // Here we attempt to find a plan by priceId in 'plans' collection and set that plan._id on user.
            const plans = db.collection("plans");
            const planDoc = await plans.findOne({ priceId: priceId });
            if (planDoc) {
              await users.updateOne(
                { _id: new (require("mongodb").ObjectId)(userId) },
                { $set: { planId: planDoc._id } }
              );
              console.log(`Updated user ${userId} to plan ${planDoc._id}`);
            } else {
              // Fallback: use PRO_PLAN_ID env var if present
              const fallback = process.env.PRO_PLAN_ID;
              if (fallback) {
                await users.updateOne(
                  { _id: new (require("mongodb").ObjectId)(userId) },
                  {
                    $set: {
                      planId: new (require("mongodb").ObjectId)(fallback),
                    },
                  }
                );
                console.log(
                  `Updated user ${userId} to PRO_PLAN_ID ${fallback}`
                );
              } else {
                console.log(
                  "No plan found for priceId and no PRO_PLAN_ID configured, skipping DB update"
                );
              }
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
          const metadata = invoice.metadata || {};
          const userId = metadata.userId || invoice.customer_metadata?.userId;
          const priceId = invoice.lines?.data?.[0]?.price?.id;
          if (userId) {
            const db = await connectDB();
            const users = db.collection("users");
            const plans = db.collection("plans");
            const planDoc = await plans.findOne({ priceId: priceId });
            if (planDoc) {
              await users.updateOne(
                { _id: new (require("mongodb").ObjectId)(userId) },
                { $set: { planId: planDoc._id } }
              );
              console.log(`Updated user ${userId} to plan ${planDoc._id}`);
            } else {
              const fallback = process.env.PRO_PLAN_ID;
              if (fallback) {
                await users.updateOne(
                  { _id: new (require("mongodb").ObjectId)(userId) },
                  {
                    $set: {
                      planId: new (require("mongodb").ObjectId)(fallback),
                    },
                  }
                );
                console.log(
                  `Updated user ${userId} to PRO_PLAN_ID ${fallback}`
                );
              } else {
                console.log(
                  "No plan found for priceId on invoice and no PRO_PLAN_ID configured, skipping DB update"
                );
              }
            }
          }
        } catch (innerErr) {
          console.error(
            "Error updating user plan from invoice webhook:",
            innerErr
          );
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
