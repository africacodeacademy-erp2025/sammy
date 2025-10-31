"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type LineItem = {
  description?: string;
  amount_total?: number;
  quantity?: number;
  price?: {
    currency?: string;
    product?: { name?: string };
  };
};

type SessionData = {
  customer_email?: string;
  customer?: { email?: string };
  subscription?: { current_period_end?: number };
  payment_status?: string;
  amount_total?: number;
  currency?: string;
  line_items?: { data: LineItem[] };
};

type SessionDetails = {
  planName: string;
  amount: string;
  currency: string;
  nextBilling: string;
  email: string;
};

export default function SuccessPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [details, setDetails] = useState<SessionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSession = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get("session_id");

      if (!sessionId) {
        setError("No session ID found.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(
          `/api/payments/stripe/session?session_id=${sessionId}`
        );
        const data: SessionData & { error?: string } = await res.json();

        if (!res.ok) {
          setError(data.error || "Failed to fetch session.");
          setLoading(false);
          return;
        }

        setSession(data);

        // Calculate subscription details
        const lineItem = data.line_items?.data?.[0];
        const planName =
          lineItem?.price?.product?.name ||
          lineItem?.description ||
          "Subscription";
        const amount = lineItem?.amount_total
          ? (lineItem.amount_total / 100).toFixed(2)
          : "0.00";
        const currency = lineItem?.price?.currency?.toUpperCase() || "USD";
        const nextBilling = data.subscription?.current_period_end
          ? new Date(
              data.subscription.current_period_end * 1000
            ).toLocaleDateString()
          : "N/A";
        const email = data.customer_email || data.customer?.email || "";

        const sessionDetails = {
          planName,
          amount,
          currency,
          nextBilling,
          email,
        };
        setDetails(sessionDetails);

        // Send confirmation email
        if (email) {
          await fetch("/api/payments/stripe/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(sessionDetails),
          });
        }

        // Attempt to wait for webhook to update user plan (poll /api/user)
        const waitForPlanUpdate = async () => {
          const token = localStorage.getItem("token");
          const maxAttempts = 6; // ~6 * 1s = 6 seconds
          for (let i = 0; i < maxAttempts; i++) {
            try {
              const uRes = await fetch("/api/user", {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (uRes.ok) {
                const u = await uRes.json();
                if (u.planId) {
                  // we have a plan, proceed
                  return true;
                }
              }
            } catch {}
            // wait 1s
            await new Promise((r) => setTimeout(r, 1000));
          }
          return false;
        };

        (async () => {
          await waitForPlanUpdate();
          // Redirect back to chatbot after waiting (regardless of result)
          router.push("/chatbot");
        })();
      } catch (err) {
        console.error(err);
        setError("Error fetching session.");
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [router]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <p className="text-lg animate-pulse">Loading payment details...</p>
      </div>
    );

  if (error)
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-red-400">
        <p className="text-lg">{error}</p>
      </div>
    );

  if (!session || !details) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <div className="bg-gray-800 shadow-2xl rounded-2xl p-8 max-w-md w-full text-center animate-fade-in">
        <h1 className="text-3xl font-bold text-green-400 mb-4">
          🎉 Payment Successful!
        </h1>
        <p className="text-gray-300 mb-6">
          Thank you, <strong className="text-white">{details.email}</strong>!
        </p>

        <div className="bg-gray-700 rounded-xl p-6 space-y-3">
          <h2 className="text-xl font-semibold text-blue-400 mb-2">
            Subscription Details
          </h2>
          <p>
            <strong>Plan:</strong> {details.planName}
          </p>
          <p>
            <strong>Amount:</strong> {details.amount} {details.currency}
          </p>
          <p>
            <strong>Next Billing Date:</strong> {details.nextBilling}
          </p>
          <p>
            <strong>Payment Status:</strong> {session.payment_status}
          </p>
        </div>

        <p className="text-gray-400 mt-6">
          Redirecting you back to the <strong>chatbot</strong>...
        </p>
      </div>
    </div>
  );
}
