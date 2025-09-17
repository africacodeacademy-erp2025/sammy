"use client";
import React from "react";
export default function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>
) {
  return (
    <button
      className={`rounded px-4 py-2 font-medium transition 
        bg-[#0a2540] text-white hover:bg-[#133b63] active:bg-[#0a1a2f]
        ${props.className ?? ""}`}
      {...props}
    >
      {props.children}
    </button>
  );
}
