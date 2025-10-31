#!/usr/bin/env tsx
import { connectDB } from "../lib/mongo";
import { ObjectId } from "mongodb";

async function main() {
  const priceId = process.env.STRIPE_PRICE_ID;
  const proPlanId = process.env.PRO_PLAN_ID;

  if (!priceId) {
    console.error("STRIPE_PRICE_ID is not set in environment. Aborting.");
    process.exit(1);
  }

  const db = await connectDB();
  const plans = db.collection("plans");

  if (proPlanId) {
    try {
      const res = await plans.updateOne(
        { _id: new ObjectId(proPlanId) },
        { $set: { priceId } }
      );
      if (res.matchedCount === 0) {
        console.warn(`No plan found with _id=${proPlanId}.`);
      } else {
        console.log(`Updated plan ${proPlanId} with priceId=${priceId}`);
      }
      process.exit(0);
    } catch (err) {
      console.error("Failed to update plan by PRO_PLAN_ID:", err);
      process.exit(1);
    }
  }

  // Fallback: try to find a plan with 'pro' in the name
  const plan = await plans.findOne({ name: { $regex: /pro/i } });
  if (!plan) {
    console.error(
      "No PRO_PLAN_ID provided and no plan with 'pro' in the name was found. Please set PRO_PLAN_ID or update the plans collection manually."
    );
    process.exit(1);
  }

  try {
    await plans.updateOne({ _id: plan._id }, { $set: { priceId } });
    console.log(
      `Updated plan ${plan._id} (name='${plan.name}') with priceId=${priceId}`
    );
    process.exit(0);
  } catch (err) {
    console.error("Failed to update plan:", err);
    process.exit(1);
  }
}

main();
