"use client";
import React from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}

export default function UpgradeToProModal({
  isOpen,
  onClose,
  onUpgrade,
}: Props) {
  if (!isOpen) return null;

  const handleUpgrade = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/payments/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data?.url) {
        // redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        alert("Failed to create checkout session: " + (data?.error || ""));
      }
    } catch (err) {
      console.error("Upgrade checkout failed", err);
      alert("Network error creating checkout session");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden
      />

      <div className="relative max-w-lg w-full bg-gray-900 border border-gray-700 rounded-lg p-6 shadow-lg text-white">
        <h3 className="text-lg font-semibold">Upgrade required</h3>
        <p className="mt-2 text-sm text-gray-300">
          Recurring schedules are available on the Pro and Business plans.
          Upgrade to Pro to enable recurring posts and advanced scheduling.
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <button
            className="px-3 py-1.5 rounded-lg text-white hover:bg-gray-700/50 transition-colors flex items-center justify-center border border-gray-700"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white text-sm transition-colors"
            onClick={handleUpgrade}
          >
            Upgrade to Pro
          </button>
        </div>
      </div>
    </div>
  );
}
