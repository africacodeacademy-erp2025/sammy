"use client";
import { MessageBubbleProps } from "../Types";
import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  Edit,
  Copy,
  ImagePlus,
  Check,
  X,
  ChevronDown,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  CheckSquare,
  Square,
} from "lucide-react";

export default function MessageBubble({
  message,
  onApprove,
  onReject,
  isLatestAiMessage,
  onEditSave,
  onAttachmentsChange,
  onPlatformSelectionChange,
}: MessageBubbleProps) {
  const isUser = message.sender === "user";
  const [isVisible, setIsVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const [showActions, setShowActions] = useState(false);
  const [showUserActions, setShowUserActions] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    message.selectedPlatforms || []
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const userActionsRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (
        actionsRef.current &&
        !actionsRef.current.contains(event.target as Node)
      ) {
        setShowActions(false);
      }
      if (
        userActionsRef.current &&
        !userActionsRef.current.contains(event.target as Node)
      ) {
        setShowUserActions(false);
      }
    };

    if (showActions || showUserActions) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showActions, showUserActions]);

  const handleSaveEdit = () => {
    if (onEditSave) {
      onEditSave(message.id, editedContent);
    }
    setIsEditing(false);
    setShowUserActions(false);
  };

  const handleCancelEdit = () => {
    setEditedContent(message.content);
    setIsEditing(false);
    setShowUserActions(false);
  };

  const handlePlatformToggle = (platform: string) => {
    const newSelection = selectedPlatforms.includes(platform)
      ? selectedPlatforms.filter((p) => p !== platform)
      : [...selectedPlatforms, platform];

    setSelectedPlatforms(newSelection);
    if (onPlatformSelectionChange) {
      onPlatformSelectionChange(message.id, newSelection);
    }
  };

  const handleApprove = () => {
    // Validate that at least one platform is selected
    if (selectedPlatforms.length === 0) {
      alert("Please select at least one platform to post to!");
      return;
    }

    if (onApprove) {
      onApprove(message.id, selectedPlatforms);
    }
    setShowActions(false);
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

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(editedContent);
      // Show a temporary success indicator
      const button = document.activeElement as HTMLButtonElement;
      if (button) {
        const originalTitle = button.title;
        button.title = "Copied!";
        setTimeout(() => {
          button.title = originalTitle;
        }, 2000);
      }
      setShowActions(false);
    } catch (err) {
      console.error("Failed to copy text:", err);
      alert("Failed to copy to clipboard");
    }
  };

  const availablePlatforms = message.availablePlatforms || [];

  const statusLabels: Record<string, React.ReactNode> = {
    pending: (
      <div className="flex flex-col gap-3 mt-3 p-3 bg-black/20 rounded-lg border border-white/10">
        {/* Platform Selection Checkboxes */}
        {availablePlatforms.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-xs text-white/60 font-medium">
              Select platforms to post:
            </span>
            <div className="flex flex-wrap gap-2">
              {availablePlatforms.map((platform) => (
                <button
                  key={platform}
                  onClick={() => handlePlatformToggle(platform)}
                  className={`flex items-center gap-2 px-3 py-1.5 transition-all ${
                    selectedPlatforms.includes(platform)
                      ? "text-blue-300"
                      : "text-gray-400"
                  }`}
                >
                  {selectedPlatforms.includes(platform) ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  <span className="text-sm capitalize">{platform}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-xs text-amber-300/80">
            ⚠️ No platforms connected. Please connect your social media accounts
            in credentials settings to enable posting.
          </div>
        )}

        {isEditing ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full p-2 bg-gray-800/50 text-white rounded border-none outline-none text-sm focus:ring-0"
              rows={4}
            />
            <div className="flex gap-2 justify-end">
              <button
                className="p-2 rounded-lg bg-transparent border border-gray-500 text-white hover:bg-gray-500/20 transition-colors flex items-center gap-1"
                onClick={handleCancelEdit}
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                className="p-2 rounded-lg bg-transparent border border-green-500 text-white hover:bg-green-500/20 transition-colors flex items-center gap-1"
                onClick={handleSaveEdit}
                title="Save"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="relative inline-block" ref={actionsRef}>
            <button
              onClick={() => setShowActions(!showActions)}
              className="px-3 py-2 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-2"
              title="Actions"
            >
              <span className="text-sm">Actions</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${
                  showActions ? "rotate-180" : ""
                }`}
              />
            </button>

            {showActions && (
              <div className="absolute bottom-full left-0 mb-2 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-xl overflow-y-auto max-h-[300px] z-50 min-w-[200px] whitespace-nowrap">
                <button
                  className="w-full px-4 py-2 text-left text-sm text-white hover:bg-sky-500/20 transition-colors flex items-center gap-2 border-b border-gray-700/50"
                  onClick={() => {
                    setIsEditing(true);
                    setShowActions(false);
                  }}
                >
                  <Edit className="w-4 h-4" />
                  Edit post
                </button>

                {message.status && (
                  <button
                    className="w-full px-4 py-2 text-left text-sm text-white hover:bg-purple-500/20 transition-colors flex items-center gap-2 border-b border-gray-700/50"
                    onClick={handleCopyToClipboard}
                  >
                    <Copy className="w-4 h-4" />
                    Copy to clipboard
                  </button>
                )}

                <button
                  className="w-full px-4 py-2 text-left text-sm text-white hover:bg-blue-500/20 transition-colors flex items-center gap-2 border-b border-gray-700/50"
                  onClick={handleAttachClick}
                >
                  <ImagePlus className="w-4 h-4" />
                  Attach images
                </button>

                <button
                  className={`w-full px-4 py-2 text-left text-sm transition-colors flex items-center gap-2 border-b border-gray-700/50 ${
                    selectedPlatforms.length === 0
                      ? "text-gray-500 cursor-not-allowed"
                      : "text-white hover:bg-green-500/20"
                  }`}
                  onClick={handleApprove}
                  disabled={selectedPlatforms.length === 0}
                  title={
                    selectedPlatforms.length === 0
                      ? "Select at least one platform to post"
                      : "Post to selected platforms"
                  }
                >
                  <Check className="w-4 h-4" />
                  Post
                </button>

                <button
                  className="w-full px-4 py-2 text-left text-sm text-red-300 hover:bg-red-500/20 transition-colors flex items-center gap-2"
                  onClick={() => {
                    if (onReject) {
                      onReject(message.id);
                    }
                    setShowActions(false);
                  }}
                >
                  <X className="w-4 h-4" />
                  Delete draft
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    ),
    // NEW: Pending approval status with hourglass spinner
    pending_approval: (
      <div className="flex items-center gap-2 mt-2 text-xs text-amber-300 font-medium">
        <Clock className="w-3 h-3 animate-pulse" />
        <span>Approval pending...</span>
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
        <CheckCircle className="w-4 h-4" />
        <span>Posted</span>
      </div>
    ),
    rejected: (
      <div className="flex items-center gap-2 mt-2 text-xs text-rose-300 font-medium">
        <XCircle className="w-4 h-4" />
        <span>Rejected</span>
      </div>
    ),
    error: (
      <div className="flex items-center gap-2 mt-2 text-xs text-red-300 font-medium">
        <AlertCircle className="w-4 h-4" />
        <span>Error</span>
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
        {isEditing && isUser ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full p-2 bg-transparent text-white rounded border-none outline-none text-sm resize-none focus:ring-0"
              rows={4}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                className="p-2 rounded-lg bg-transparent border border-gray-500 text-white hover:bg-gray-500/20 transition-colors flex items-center gap-1"
                onClick={handleCancelEdit}
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                className="p-2 rounded-lg bg-transparent border border-green-500 text-white hover:bg-green-500/20 transition-colors flex items-center gap-1"
                onClick={handleSaveEdit}
                title="Save"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words">{editedContent}</div>
        )}

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
            {message.sender === "ai" &&
              message.selectedPlatforms &&
              message.selectedPlatforms.length > 0 && (
                <div className="flex gap-1">
                  {message.selectedPlatforms.map((p) => (
                    <span
                      key={p}
                      className="text-xs px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 capitalize"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              )}
            <span className="text-xs opacity-50">
              {isUser ? "You" : "SaMMy"}
            </span>
            {isUser && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-1 rounded hover:bg-white/10 transition-colors"
                title="Edit message"
              >
                <Edit className="w-3 h-3" />
              </button>
            )}
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
