"use client";
import { useState, useEffect, useCallback } from "react";
import RecurrenceModal, { RecurrenceSettings } from "./RecurrenceModal";

export interface RecurringPost {
  _id: string;
  userId: string;
  prompt: string;
  platform: string;
  frequency: "daily" | "weekly" | "monthly";
  time: string; // HH:mm format
  selectedDays?: number[] | null;
  selectedMonths?: number[] | null;
  nextOccurrence: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastExecuted: string | null;
}

interface RecurringPostsViewProps {
  onBack: () => void;
}

export default function RecurringPostsView({
  onBack,
}: RecurringPostsViewProps) {
  const [recurringPosts, setRecurringPosts] = useState<RecurringPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPost, setEditingPost] = useState<RecurringPost | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);

  const getToken = () => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("token");
    }
    return null;
  };

  const fetchRecurringPosts = useCallback(async () => {
    const token = getToken();
    try {
      setLoading(true);
      const res = await fetch("/api/recurring-posts", {
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      const data = await res.json();
      if (data.success) {
        setRecurringPosts(data.recurringPosts || []);
      }
    } catch (err) {
      console.error("Failed to fetch recurring posts", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecurringPosts();
  }, [fetchRecurringPosts]);

  const handleTogglePause = async (post: RecurringPost) => {
    const token = getToken();
    try {
      const res = await fetch("/api/recurring-posts", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          id: post._id,
          isActive: !post.isActive,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Update local state
        setRecurringPosts((prev) =>
          prev.map((p) =>
            p._id === post._id ? { ...p, isActive: !p.isActive } : p
          )
        );
      }
    } catch (err) {
      console.error("Error toggling pause:", err);
    }
  };

  const handleEditTime = (post: RecurringPost) => {
    setEditingPost(post);
    setEditModalOpen(true);
  };

  const handleEditPrompt = (post: RecurringPost) => {
    setEditingPromptId(post._id);
    setEditingPrompt(post.prompt);
  };

  const handleSavePrompt = async (postId: string) => {
    if (!editingPrompt) return;

    const token = getToken();
    try {
      const res = await fetch("/api/recurring-posts", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          id: postId,
          prompt: editingPrompt,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setRecurringPosts((prev) =>
          prev.map((p) =>
            p._id === postId ? { ...p, prompt: editingPrompt } : p
          )
        );
        setEditingPromptId(null);
        setEditingPrompt(null);
      }
    } catch (err) {
      console.error("Error updating prompt:", err);
    }
  };

  const handleCancelEditPrompt = () => {
    setEditingPromptId(null);
    setEditingPrompt(null);
  };

  const handleUpdateRecurrence = async (settings: RecurrenceSettings) => {
    if (!editingPost) return;

    const token = getToken();
    try {
      const res = await fetch("/api/recurring-posts", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          id: editingPost._id,
          frequency: settings.frequency,
          time: settings.time,
          selectedDays: settings.selectedDays,
          selectedMonths: settings.selectedMonths,
          timezoneOffset: settings.timezoneOffset, // Include timezone offset
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Refresh the list to get updated nextOccurrence
        await fetchRecurringPosts();
        setEditModalOpen(false);
        setEditingPost(null);
      }
    } catch (err) {
      console.error("Error updating recurrence:", err);
    }
  };

  const handleDelete = async (postId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this recurring schedule? This action cannot be undone."
      )
    ) {
      return;
    }

    const token = getToken();
    try {
      const res = await fetch(`/api/recurring-posts?id=${postId}`, {
        method: "DELETE",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      const data = await res.json();
      if (data.success) {
        setRecurringPosts((prev) => prev.filter((p) => p._id !== postId));
      }
    } catch (err) {
      console.error("Error deleting recurring post:", err);
    }
  };

  const formatNextOccurrence = (timestamp: string) => {
    const date = new Date(timestamp);
    
    // Format in local time
    return date.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };  const getFrequencyLabel = (post: RecurringPost) => {
    if (post.frequency === "daily" && post.selectedDays) {
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const days = post.selectedDays.map((d) => dayNames[d]).join(", ");
      return `Daily (${days})`;
    }
    if (post.frequency === "monthly" && post.selectedMonths) {
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const months = post.selectedMonths
        .map((m) => monthNames[m - 1])
        .join(", ");
      return `Monthly (${months})`;
    }
    return post.frequency.charAt(0).toUpperCase() + post.frequency.slice(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-white bg-gray-950">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Loading recurring posts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-gray-950">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700/50">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-gray-700/50 text-white hover:bg-gray-700 transition-colors"
          >
            ←
          </button>
          <div>
            <h1 className="font-bold text-white text-sm md:text-base">
              🔄 Recurring Posts
            </h1>
            <p className="text-xs text-white/60">
              Manage your automated posting schedules
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-900/30 to-gray-900/10">
        <div className="p-4 md:p-6">
          {recurringPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-60 text-center">
              <div className="text-6xl mb-6">🔄</div>
              <h3 className="text-xl md:text-2xl font-bold text-white mb-4">
                No Recurring Posts Yet
              </h3>
              <p className="text-gray-400 text-sm md:text-base">
                Set up recurring posts in the chat by saying things like
                &quot;post every Wednesday at 2pm&quot;
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:gap-6">
              {recurringPosts.map((post) => (
                <div
                  key={post._id}
                  className={`bg-gray-800/80 border rounded-2xl p-4 md:p-6 transition-all ${
                    post.isActive
                      ? "border-gray-700/50 hover:border-gray-600/50"
                      : "border-gray-700/30 opacity-60"
                  }`}
                >
                  {/* Header with Platform and Status */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 text-xs font-medium rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                        {post.platform === "twitter"
                          ? "𝕏 Twitter"
                          : "📘 Facebook"}
                      </span>
                      <span
                        className={`px-3 py-1 text-xs font-medium rounded-full ${
                          post.isActive
                            ? "bg-green-500/20 text-green-400 border border-green-500/30"
                            : "bg-gray-500/20 text-gray-400 border border-gray-500/30"
                        }`}
                      >
                        {post.isActive ? "● Active" : "⏸ Paused"}
                      </span>
                    </div>
                  </div>

                  {/* Prompt */}
                  <div className="mb-4">
                    <label className="text-xs text-gray-400 mb-1 block">
                      Prompt:
                    </label>
                    {editingPromptId === post._id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingPrompt || ""}
                          onChange={(e) => setEditingPrompt(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-900 text-white rounded-lg border-2 border-purple-500 focus:outline-none resize-none"
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSavePrompt(post._id)}
                            className="px-3 py-1 text-xs rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelEditPrompt}
                            className="px-3 py-1 text-xs rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-white text-sm md:text-base leading-relaxed">
                        {post.prompt}
                      </p>
                    )}
                  </div>

                  {/* Schedule Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">
                        Frequency
                      </div>
                      <div className="text-sm text-white font-medium">
                        {getFrequencyLabel(post)}
                      </div>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">
                        Posting Time
                      </div>
                      <div className="text-sm text-white font-medium">
                        {post.time}
                      </div>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">
                        Next Post
                      </div>
                      <div className="text-sm text-white font-medium">
                        {formatNextOccurrence(post.nextOccurrence)}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleTogglePause(post)}
                      className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${
                        post.isActive
                          ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30"
                          : "bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30"
                      }`}
                    >
                      {post.isActive ? "⏸ Pause" : "▶ Resume"}
                    </button>
                    <button
                      onClick={() => handleEditPrompt(post)}
                      className="px-4 py-2 text-sm rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 font-medium transition-all"
                    >
                      ✏️ Edit Prompt
                    </button>
                    <button
                      onClick={() => handleEditTime(post)}
                      className="px-4 py-2 text-sm rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 font-medium transition-all"
                    >
                      🕒 Edit Schedule
                    </button>
                    <button
                      onClick={() => handleDelete(post._id)}
                      className="px-4 py-2 text-sm rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 font-medium transition-all"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Recurrence Modal */}
      {editingPost && (
        <RecurrenceModal
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setEditingPost(null);
          }}
          onConfirm={handleUpdateRecurrence}
          frequency={editingPost.frequency}
          time={editingPost.time}
          platform={editingPost.platform}
          prompt={editingPost.prompt}
          detectedDays={editingPost.selectedDays || undefined}
        />
      )}
    </div>
  );
}
