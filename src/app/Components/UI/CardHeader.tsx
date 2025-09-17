"use client";
import BaseProps from "../BaseProps";

export default function CardHeader({ children, className = "" }: BaseProps) {
  return <div className={`px-4 pt-4 ${className}`}>{children}</div>;
}
