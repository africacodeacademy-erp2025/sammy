// app/components/UI/PayButton.tsx
"use client";
import { useState } from "react";
import SidebarButton from "./SidebarButton";

export default function PayButton({ priceId }: { priceId?: string }) {
  const [loading, setLoading] = useState(false);

  async function handlePay() {
    try {
      setLoading(true);
      const res = await fetch("/api/payments/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        alert("Error creating checkout session: " + (data?.error || "unknown"));
      }
    } catch (err) {
      console.error(err);
      alert("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SidebarButton
      onClick={handlePay}
      title="Subscribe"
      description={loading ? "Redirecting…" : "Pay your subscription"}
      icon={<span className="text-purple-400">💳</span>}
      className="bg-gray-800 hover:bg-gray-800/70"
    />
  );
}
