"use client";
import BaseProps from "../BaseProps";

export default function CardTitle({ children, className = "" }: BaseProps) {
  return <h2 className={`font-semibold ${className}`}>{children}</h2>;
}
