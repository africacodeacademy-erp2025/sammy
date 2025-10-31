import React from "react";

interface PricingFeature {
  text: string;
}

interface PricingCardProps {
  type: string;
  title: string;
  price: string;
  description: string;
  features: PricingFeature[];
  buttonText: string;
  isPopular?: boolean;
  gradientFrom?: string;
  gradientTo?: string;
  planId: number;
  onSelectPlan: (planId: number) => void;
}

export default function PricingCard({
  type,
  title,
  price,
  description,
  features,
  buttonText,
  isPopular = false,
  gradientFrom = "blue-500",
  gradientTo = "purple-500",
  planId,
  onSelectPlan,
}: PricingCardProps) {
  return (
    <div
      className={`flex flex-col gap-6 bg-gray-800/50 rounded-2xl p-8 shadow-xl 
      ${isPopular ? "border-2 border-purple-500" : "border border-gray-700/50"} 
      hover:scale-105 transition-transform relative`}
    >
      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
        <span
          className={`px-4 py-1 ${
            isPopular
              ? "bg-gradient-to-r from-purple-500 to-pink-500"
              : `bg-gradient-to-r from-${gradientFrom} to-${gradientTo}`
          } rounded-full text-sm font-bold`}
        >
          {type}
        </span>
      </div>

      <div className="text-center mb-4">
        <h3 className="text-2xl font-bold mb-4">{title}</h3>
        <div className="text-4xl font-bold mb-2">
          {price}
          <span className="text-lg text-gray-400">/mo</span>
        </div>
        <p className="text-gray-400">{description}</p>
      </div>

      <ul className="flex flex-col gap-4 flex-grow">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center gap-2 text-gray-300">
            <svg
              className="w-5 h-5 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            {feature.text}
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSelectPlan(planId)}
        className={`w-full px-6 py-3 rounded-xl bg-gradient-to-r 
        from-${gradientFrom} to-${gradientTo} 
        hover:from-${gradientFrom.replace(
          "500",
          "600"
        )} hover:to-${gradientTo.replace("500", "600")}
        transition-all text-white font-bold text-base shadow-lg`}
      >
        {buttonText}
      </button>
    </div>
  );
}
