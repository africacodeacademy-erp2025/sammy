import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  try {
    // Expand line_items and subscription details
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items.data.price.product", "subscription", "customer"],
    });

    return NextResponse.json(session);
  } catch (err: any) {
    console.error("Session retrieve error", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
