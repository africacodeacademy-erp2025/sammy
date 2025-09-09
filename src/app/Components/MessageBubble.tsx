"use client";
import { MessageBubbleProps } from "../Types";
import React, { useState, useEffect } from "react";

export default function MessageBubble({
  message,
  onApprove,
  onReject,
  isLatestAiMessage,
}: MessageBubbleProps) {
  const isUser = message.sender === "user";
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isLatestAiMessage) {
      const timer = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(true);
    }
  }, [isLatestAiMessage]);

  const statusLabels: Record<string, React.ReactNode> = {
    pending: (
      <div className="flex flex-col gap-2 mt-3 p-3 bg-black/20 rounded-lg border border-white/10">
        <span className="text-xs font-medium text-white/80">
          📝 Ready for review
        </span>
        <div className="flex gap-2">
          <button
            className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-400 flex items-center gap-1"
            onClick={() => onApprove(message.id)}
          >
            <span>✅</span> Approve
          </button>
          <button
            className="text-xs px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-400 flex items-center gap-1"
            onClick={() => onReject(message.id)}
          >
            <span>❌</span> Reject
          </button>
        </div>
      </div>
    ),
    scheduled: (
      <div className="flex flex-col gap-2 mt-3 bg-black/20 rounded-lg border border-white/10"></div>
    ),
    posting: (
      <div className="flex items-center gap-2 mt-2 text-xs text-amber-300 font-medium">
        <div className="w-3 h-3 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
        <span>Posting...</span>
      </div>
    ),
    posted: (
      <div className="flex items-center gap-2 mt-2 text-xs text-green-300 font-medium">
        <span>✔️</span> Posted
      </div>
    ),
    rejected: (
      <div className="flex items-center gap-2 mt-2 text-xs text-rose-300 font-medium">
        <span>🚫</span> Rejected
      </div>
    ),
    error: (
      <div className="flex items-center gap-2 mt-2 text-xs text-red-300 font-medium">
        <span>❌</span> Error
      </div>
    ),
  };

  return (
    <div
      className={`flex ${
        isUser ? "justify-end" : "justify-start"
      } transition-all duration-300 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
      style={{ transitionDelay: isLatestAiMessage ? "100ms" : "0ms" }}
    >
      <div
        className={`max-w-[80%] rounded-2xl p-4 text-sm ${
          isUser
            ? "bg-gradient-to-r from-blue-500/80 to-indigo-500/80 text-white backdrop-blur-sm"
            : "bg-gradient-to-r from-gray-800/80 to-gray-900/80 text-white backdrop-blur-sm border border-gray-700/50"
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{message.content}</div>

        <div className="flex justify-between items-center mt-2">
          <div className="text-xs opacity-70">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          <div className="text-xs opacity-50">{isUser ? "You" : "SaMMy"}</div>
        </div>

        {message.sender === "ai" && (
          <div className="mt-3">
            {message.status && statusLabels[message.status]}
          </div>
        )}
      </div>
    </div>
  );
}
