"use client";
import BaseProps from "../BaseProps";

export default function Card({ children, className = "" }: BaseProps) {
  return (
    <div className={`rounded-lg p-0 bg-gray-800/40 ${className}`}>
      {children}
    </div>
  );
}
