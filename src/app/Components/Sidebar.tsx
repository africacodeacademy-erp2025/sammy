"use client";

import { useEffect, useState } from "react";

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

  const handleLogout = async () => {
    localStorage.removeItem("token");
    setUserEmail(null);

    window.location.href = "/";
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
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
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
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
          {/* View Schedule */}
          <button
            onClick={onViewSchedule}
            className="w-full flex items-center justify-between p-4 bg-gray-800 rounded-lg hover:bg-gray-800/70 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600/20 rounded-lg">
                <span className="text-blue-400">📅</span>
              </div>
              <div className="text-left">
                <h3 className="text-sm font-medium text-white">
                  View Schedule
                </h3>
                <p className="text-xs text-gray-400">See upcoming posts</p>
              </div>
            </div>
            <span className="text-gray-400">→</span>
          </button>

          {/* Manage Credentials */}
          <button
            onClick={onManageCredentials}
            className="w-full flex items-center justify-between p-4 bg-gray-800 rounded-lg hover:bg-gray-800/70 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-600/20 rounded-lg">
                <span className="text-green-400">🔑</span>
              </div>
              <div className="text-left">
                <h3 className="text-sm font-medium text-white">
                  Manage Credentials
                </h3>
                <p className="text-xs text-gray-400">
                  Configure API keys & tokens
                </p>
              </div>
            </div>
            <span className="text-gray-400">→</span>
          </button>
        </div>

        {/* Logout at bottom */}
        <div className="p-4 border-t border-gray-700 mt-auto">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-between p-4 bg-gray-800 rounded-lg hover:bg-gray-800/70 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-600 rounded-lg">
                <span className="text-red-400">⇦</span>
              </div>
              <div className="text-left">
                <h3 className="text-sm font-medium text-white">Logout</h3>
                <p className="text-xs text-gray-400">
                  Sign out of your account
                </p>
              </div>
            </div>
            <span className="text-gray-400">→</span>
          </button>
        </div>
      </div>
    </>
  );
}
