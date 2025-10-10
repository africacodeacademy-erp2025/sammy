"use client";

import { useEffect, useState } from "react";
import PayButton from "./UI/PayButton";
import SidebarButton from "./UI/SidebarButton";

export default function Sidebar({
  isOpen,
  onClose,
  onViewSchedule,
  onManageCredentials,
}: {
  isOpen: boolean;
  onClose: () => void;
  onViewSchedule: () => void;
  onManageCredentials: () => void;
}) {
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch("/api/user", {
          headers: {
            authorization: "Bearer " + localStorage.getItem("token"),
          },
        });
        if (res.ok) {
          const data = await res.json();
          setUserEmail(data.email);
        }
      } catch (err) {
        console.error("Failed to load user:", err);
      }
    }

    if (isOpen) fetchUser();
  }, [isOpen]);

  const getInitials = (email: string) => email.slice(0, 2).toUpperCase();

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={`
          fixed top-0 right-0 h-full w-80 bg-gray-900 border-l border-gray-700
          transform transition-transform duration-300 z-50 shadow-2xl flex flex-col
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {userEmail && (
              <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-[11px] leading-none uppercase overflow-hidden shrink-0 select-none">
                {getInitials(userEmail)}
              </div>
            )}
            {userEmail && <p className="text-sm text-gray-400">{userEmail}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700"
          >
            ✕
          </button>
        </div>

        {/* Main Content */}
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          <SidebarButton
            onClick={onViewSchedule}
            title="View Schedule"
            description="See upcoming posts"
            icon={<span className="text-blue-400">📅</span>}
          />

          <SidebarButton
            onClick={onManageCredentials}
            title="Sources & Platform"
            description="Connect sources and platform"
            icon={<span className="text-green-400">🔑</span>}
          />

          <PayButton priceId={process.env.NEXT_PUBLIC_STRIPE_PRICE_ID} />
        </div>

        {/* Footer spacer (no logout) */}
        <div className="p-2" />
      </div>
    </>
  );
}
