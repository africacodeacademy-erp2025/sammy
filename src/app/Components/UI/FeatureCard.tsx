import React from "react";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  gradientFrom?: string;
  gradientTo?: string;
}

export default function FeatureCard({
  title,
  description,
  icon,
  gradientFrom = "blue-500",
  gradientTo = "purple-500",
}: FeatureCardProps) {
  return (
    <div className="flex flex-col gap-6 items-center text-center bg-gray-800/50 rounded-2xl p-8 shadow-xl border border-gray-700/50 hover:scale-105 transition-transform">
      <div
        className={`w-16 h-16 flex items-center justify-center rounded-full bg-gradient-to-br from-${gradientFrom} to-${gradientTo} mb-4`}
      >
        {icon}
      </div>
      <h3 className="font-bold text-2xl">{title}</h3>
      <p className="text-gray-300 text-base leading-relaxed">{description}</p>
    </div>
  );
}
