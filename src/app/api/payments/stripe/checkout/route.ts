import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../../../lib/auth";
import { connectDB } from "../../../../../../lib/mongo";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const priceId = body?.priceId || process.env.STRIPE_PRICE_ID!;
    if (!priceId) {
      return NextResponse.json({ error: "Missing priceId" }, { status: 400 });
    }

    const origin = process.env.NEXT_PUBLIC_BASE_URL!;

    // Authenticate user from Authorization header
    const authHeader =
      (req as any).headers?.get?.("authorization") ||
      (req as any).headers?.authorization ||
      null;
    const user = await getUserFromRequest(authHeader);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Initialize Stripe at runtime
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    // Include metadata so webhook can attribute the session to a user
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      billing_address_collection: "auto",
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/chatbot`,
      allow_promotion_codes: true,
      metadata: {
        userId: user._id.toString(),
        priceId: priceId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("create-checkout error", err);
    return NextResponse.json(
      { error: err.message ?? "Server error" },
      { status: 500 }
    );
  }
}
