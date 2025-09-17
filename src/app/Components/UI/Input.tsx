"use client";
import { useState } from "react";

export default function Input(
  props: React.InputHTMLAttributes<HTMLInputElement>
) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <input
      {...props}
      className={`w-full rounded-lg px-3 py-2 text-sm bg-gray-900/40 text-white placeholder-gray-500
        border-2 outline-none transition duration-300
        ${props.className ?? ""}`}
      style={{
        borderRadius: "0.5rem",
        borderColor: isFocused ? "transparent" : "#4b5563",
        borderImageSlice: isFocused ? 1 : undefined,
        borderImageSource: isFocused
          ? "linear-gradient(45deg, #a855f7, #ec4899)"
          : undefined,
        boxShadow: isFocused
          ? "0 0 8px rgba(168, 85, 247, 0.6), 0 0 12px rgba(236, 72, 153, 0.6)"
          : "none",
      }}
      onFocus={(e) => {
        setIsFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setIsFocused(false);
        props.onBlur?.(e);
      }}
    />
  );
}
