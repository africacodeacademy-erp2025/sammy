import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
export async function POST(req: NextRequest) {
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
        break;
      case "customer.subscription.created":
        console.log("🟢 Subscription started:", event.data.object.id);
        break;
      case "customer.subscription.deleted":
        console.log("🔴 Subscription cancelled:", event.data.object.id);
        break;
      case "invoice.payment_succeeded":
        console.log("💰 Payment success:", event.data.object.id);
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
