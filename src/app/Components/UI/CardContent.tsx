"use client";
import BaseProps from "../BaseProps";

export default function CardContent({ children, className = "" }: BaseProps) {
  return <div className={`px-4 pb-4 space-y-3 ${className}`}>{children}</div>;
}
