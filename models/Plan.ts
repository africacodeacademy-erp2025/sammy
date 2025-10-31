import { ObjectId } from "mongodb";

export type PlanDoc = {
  _id?: ObjectId;
  planId: number; // 1: Basic, 2: Pro, 3: Business
  name: string;
  price: number;
  description: string;
  features: string[];
  createdAt?: Date;
  updatedAt?: Date;
  isActive: boolean;
};

export const defaultPlans: Omit<PlanDoc, "_id">[] = [
  {
    planId: 1,
    name: "Basic Plan",
    price: 4.99,
    description: "Perfect for individual creators",
    features: [
      "AI-Powered Content Generation",
      "Post to X/Twitter & Facebook",
      "Basic Post Scheduling",
    ],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    planId: 2,
    name: "Pro Plan",
    price: 6.99,
    description: "For power users",
    features: [
      "Everything in Basic",
      "Recurring Post Scheduling",
      "Advanced Analytics",
    ],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    planId: 3,
    name: "Business Plan",
    price: 24.99,
    description: "For teams and businesses",
    features: [
      "Everything in Pro",
      "Slack Workplace Integration",
      "Priority Support",
    ],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];
