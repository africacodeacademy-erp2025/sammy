"use client";
import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export default function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const baseClasses = `
    rounded-3xl px-4 py-2.5 sm:py-2 font-medium transition 
    flex items-center justify-center shadow-md min-h-[36px] 
    touch-manipulation w-full md:w-auto  /* responsive width */
  `;
  const gradientClasses =
    "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 active:from-blue-700 active:to-purple-700 text-white";
  const variantClasses = variant === "primary" ? gradientClasses : "";

  return (
    <button
      className={`${baseClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
