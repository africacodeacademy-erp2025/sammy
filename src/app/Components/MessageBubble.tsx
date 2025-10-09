"use client";
import { MessageBubbleProps } from "../Types";
import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";

export default function MessageBubble({
  message,
  onApprove,
  onReject,
  isLatestAiMessage,
  onEditSave,
  onAttachmentsChange,
}: MessageBubbleProps) {
  const isUser = message.sender === "user";
  const [isVisible, setIsVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isLatestAiMessage) {
      const timer = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(true);
    }
  }, [isLatestAiMessage]);

  useEffect(() => {
    setEditedContent(message.content);
  }, [message.content]);

  const handleSaveEdit = () => {
    if (onEditSave) {
      onEditSave(message.id, editedContent);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedContent(message.content);
    setIsEditing(false);
  };

  const handleApprove = () => {
    // Set local state to show pending immediately
    if (onApprove) {
      onApprove(message.id);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && onAttachmentsChange) {
      onAttachmentsChange(message.id, Array.from(event.target.files));
    }
  };

  const handleAttachClick = () => {
    // Temporarily disabled due to Twitter API limitations
    alert(
      "📷 Image attachments are temporarily under maintenance due to API limitations. This feature will be restored soon!"
    );
    // fileInputRef.current?.click(); // Uncomment when ready to re-enable
  };

  const statusLabels: Record<string, React.ReactNode> = {
    pending: (
      <div className="flex flex-col gap-3 mt-3 p-3 bg-black/20 rounded-lg border border-white/10">
        <span className="text-sm font-medium text-white/80">
          📝 Ready for review
        </span>

        {isEditing ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full p-2 bg-gray-800/50 text-white rounded border border-gray-700 text-sm"
              rows={4}
            />
            <div className="flex gap-2 justify-end">
              <button
                className="p-2 rounded-lg bg-transparent border border-gray-500 text-white hover:bg-gray-500/20 transition-colors text-lg"
                onClick={handleCancelEdit}
                title="Cancel"
              >
                ❌
              </button>
              <button
                className="p-2 rounded-lg bg-transparent border border-green-500 text-white hover:bg-green-500/20 transition-colors text-lg"
                onClick={handleSaveEdit}
                title="Save"
              >
                💾
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-2">
              <button
                className="p-2 rounded-lg bg-transparent border border-sky-500 text-white hover:bg-sky-500/20 transition-colors text-lg"
                onClick={() => setIsEditing(true)}
                title="Edit post"
              >
                ✏️
              </button>
              <input
                type="file"
                multiple
                accept="image/*"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                className="p-2 rounded-lg bg-transparent border border-blue-500 text-white hover:bg-blue-500/20 transition-colors text-lg"
                onClick={handleAttachClick}
                title="Attach images"
              >
                ➕
              </button>
            </div>
            <div className="flex gap-2">
              <button
                className="p-2 rounded-lg bg-transparent border border-green-500 text-white hover:bg-green-500/20 transition-colors text-lg"
                onClick={handleApprove}
                title="Approve"
              >
                ✅
              </button>
              <button
                className="p-2 rounded-lg bg-transparent border border-rose-500 text-white hover:bg-rose-500/20 transition-colors text-lg"
                onClick={() => onReject(message.id)}
                title="Reject"
              >
                ❌
              </button>
            </div>
          </div>
        )}
      </div>
    ),
    // NEW: Pending approval status with hourglass spinner
    pending_approval: (
      <div className="flex items-center gap-2 mt-2 text-xs text-amber-300 font-medium">
        <div className="w-3 h-3 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
        <span>⏳ Approval pending...</span>
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
      className={`flex mt-4 ${
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
        <div className="whitespace-pre-wrap break-words">{editedContent}</div>

        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((file, index) => (
              <div key={index} className="relative w-16 h-16">
                <Image
                  src={URL.createObjectURL(file)}
                  alt={`attachment ${index + 1}`}
                  fill
                  style={{ objectFit: "cover" }}
                  className="rounded-md"
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center mt-2">
          <div className="text-xs opacity-70">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>

          <div className="flex items-center gap-2">
            {message.sender === "ai" && message.platform && (
              <span className="text-xs px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-300">
                {message.platform}
              </span>
            )}
            <span className="text-xs opacity-50">
              {isUser ? "You" : "SaMMy"}
            </span>
          </div>
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
