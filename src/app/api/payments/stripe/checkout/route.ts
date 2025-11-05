import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../../../lib/auth";
import { connectDB } from "../../../../../../lib/mongo";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let priceId = body?.priceId || process.env.STRIPE_PRICE_ID!;
    const planId = body?.planId;

    // If planId is provided, look up the plan in database to get price info
    let planDoc: any = null;
    if (planId) {
      try {
        const db = await connectDB();
        const plans = db.collection("plans");

        // Support numeric planId or MongoDB _id
        if (/^[0-9a-fA-F]{24}$/.test(String(planId))) {
          planDoc = await plans.findOne({
            _id: new (require("mongodb").ObjectId)(planId),
          });
        } else if (!isNaN(Number(planId))) {
          planDoc = await plans.findOne({ planId: Number(planId) });
        }

        // If plan has a priceId, use it
        if (planDoc && planDoc.priceId) {
          priceId = planDoc.priceId;
        }
      } catch (err) {
        console.error("Error looking up plan:", err);
      }
    }

    if (!priceId && !planDoc) {
      return NextResponse.json(
        { error: "Missing priceId or planId" },
        { status: 400 }
      );
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

    // Build line items - use price_data if we have plan info to show name and price
    let line_items: any[] = [];
    if (planDoc && planDoc.price && planDoc.name) {
      // Use price_data to show plan name and price on checkout
      const currency = planDoc.currency || "usd";
      const unit_amount = Math.round(Number(planDoc.price) * 100); // Convert to cents
      const interval = planDoc.interval || "month";

      line_items = [
        {
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount,
            product_data: {
              name: planDoc.name,
              description: planDoc.description || undefined,
            },
            recurring: { interval },
          },
          quantity: 1,
        },
      ];
    } else {
      // Fallback to existing priceId behavior
      line_items = [{ price: priceId, quantity: 1 }];
    }

    // Calculate next billing date (start immediately, no trial)
    const now = Math.floor(Date.now() / 1000);
    const interval = planDoc?.interval || "month";

    // Set billing cycle anchor to ensure proper next billing date calculation
    let billing_cycle_anchor;
    if (interval === "month") {
      // For monthly, set to the same day next month
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      billing_cycle_anchor = Math.floor(nextMonth.getTime() / 1000);
    } else if (interval === "year") {
      // For yearly, set to the same date next year
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      billing_cycle_anchor = Math.floor(nextYear.getTime() / 1000);
    }

    // Include metadata so webhook can attribute the session to a user
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items,
      billing_address_collection: "auto",
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/chatbot`,
      allow_promotion_codes: true,
      subscription_data: {
        billing_cycle_anchor: billing_cycle_anchor,
        metadata: {
          userId: user._id.toString(),
          planId: planId || null,
          planName: planDoc?.name || null,
        },
      },
      metadata: {
        userId: user._id.toString(),
        priceId: priceId,
        planId: planId || null,
        planName: planDoc?.name || null,
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
