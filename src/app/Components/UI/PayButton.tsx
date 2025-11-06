// app/components/UI/PayButton.tsx
"use client";
import { useState } from "react";
import SidebarButton from "./SidebarButton";

export default function PayButton({
  priceId,
  planId,
  title,
  description,
}: {
  priceId?: string;
  planId?: number | string;
  title?: string;
  description?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handlePay() {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      // Build request body with available identifiers
      const body: any = {};
      if (priceId) body.priceId = priceId;
      if (planId !== undefined) body.planId = planId;

      console.log("PayButton sending body:", body);

      const res = await fetch("/api/payments/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
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
      title={title || "Subscribe"}
      description={
        loading ? "Redirecting…" : description || "Pay your subscription"
      }
      icon={<span className="text-purple-400">💳</span>}
      className="bg-gray-800 hover:bg-gray-800/70"
    />
  );
}
