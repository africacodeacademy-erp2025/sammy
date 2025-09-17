"use client";
import BaseProps from "../BaseProps";
export default function Badge({ children, className = "" }: BaseProps) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}
