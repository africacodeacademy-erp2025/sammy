"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import MessageBubble from "../Components/MessageBubble";
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Calendar as CalendarIcon,
  Clock,
  CheckCircle,
  Edit,
  Trash2,
  X,
  Check,
} from "lucide-react";

export interface ScheduledPost {
  threadId: string | null;
  post?: string;
  _id: string;
  prompt: string;
  platform?: string; // Legacy single platform
  platforms?: string[]; // New multi-platform array
  scheduleTime: string;
  status: "scheduled" | "ready_for_review" | string;
  isScheduled?: boolean;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  posts: ScheduledPost[];
}

interface ScheduledPostViewProps {
  onBack: () => void;
  scheduledPosts?: ScheduledPost[];
}

export default function ScheduledPostView({
  onBack,
  scheduledPosts: initialPosts = [],
}: ScheduledPostViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scheduledPosts, setScheduledPosts] =
    useState<ScheduledPost[]>(initialPosts);
  const [readyForReviewPosts, setReadyForReviewPosts] = useState<
    ScheduledPost[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [showReadyPosts, setShowReadyPosts] = useState(false);
  const [refreshCountdown, setRefreshCountdown] = useState(60);
  const [workerNextRun, setWorkerNextRun] = useState<Date | null>(null);

  // Edit state for scheduled posts
  const [editingScheduledPost, setEditingScheduledPost] = useState<
    string | null
  >(null);
  const [editingPrompt, setEditingPrompt] = useState("");
  const [editingDateTime, setEditingDateTime] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const token = localStorage.getItem("token");

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch("/api/scheduledposts", {
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      if (res.status === 401) {
        // Token expired, redirect to home
        localStorage.removeItem("token");
        window.location.href = "/";
        return;
      }

      const data = await res.json();
      setScheduledPosts(data.scheduled || initialPosts);
      setReadyForReviewPosts(data.readyForReview || []);
    } catch (err) {
      console.error("Failed to fetch scheduled posts", err);
    } finally {
      setLoading(false);
    }
  }, [initialPosts, token]);

  const fetchWorkerStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/worker-status", {
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      const data = await res.json();

      if (data.success) {
        setRefreshCountdown(data.secondsUntilNextRun);
        if (data.nextRunAt) {
          setWorkerNextRun(new Date(data.nextRunAt));
        }
      }
    } catch (err) {
      console.error("Failed to fetch worker status", err);
    }
  }, [token]);

  const handleApprove = async (id: string, selectedPlatforms?: string[]) => {
    const postToApprove = readyForReviewPosts.find((p) => p._id === id);
    if (!postToApprove) return;

    // Use selected platforms from user choice, or fall back to post's platforms
    const platformsToUse =
      selectedPlatforms && selectedPlatforms.length > 0
        ? selectedPlatforms
        : postToApprove.platforms ||
          (postToApprove.platform ? [postToApprove.platform] : []);

    if (platformsToUse.length === 0) {
      alert("Please select at least one platform to post to!");
      return;
    }

    // Update status locally to show "posting..."
    setReadyForReviewPosts((prev) =>
      prev.map((p) => (p._id === id ? { ...p, status: "posting" } : p))
    );

    try {
      const res = await fetch("/api/agent", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          _id: postToApprove._id,
          post: postToApprove.post || postToApprove.prompt,
          platforms: platformsToUse,
          threadId: postToApprove.threadId || null,
          isScheduled: postToApprove.isScheduled,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        // Show error if request failed
        setReadyForReviewPosts((prev) =>
          prev.map((p) => (p._id === id ? { ...p, status: "error" } : p))
        );
        return;
      }

      // Mark as posted after successful approval
      setReadyForReviewPosts((prev) =>
        prev.map((p) => (p._id === id ? { ...p, status: "posted" } : p))
      );
    } catch (err) {
      console.error("Error approving post:", err);
      setReadyForReviewPosts((prev) =>
        prev.map((p) => (p._id === id ? { ...p, status: "error" } : p))
      );
    }
  };

  const handleReject = async (id: string) => {
    try {
      const res = await fetch(`/api/scheduledposts?id=${id}`, {
        method: "DELETE",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      if (!res.ok) return;
      setReadyForReviewPosts((prev) => prev.filter((post) => post._id !== id));
    } catch (err) {
      console.error("Error rejecting post:", err);
    }
  };

  const handleEditSave = (id: string, content: string) => {
    setReadyForReviewPosts((prev) =>
      prev.map((p) => (p._id === id ? { ...p, post: content } : p))
    );
  };

  // Start editing a scheduled post
  const handleStartEdit = (post: ScheduledPost) => {
    setEditingScheduledPost(post._id);
    setEditingPrompt(post.prompt);
    // Convert ISO to datetime-local format
    const date = new Date(post.scheduleTime);
    const localDateTime = new Date(
      date.getTime() - date.getTimezoneOffset() * 60000
    )
      .toISOString()
      .slice(0, 16);
    setEditingDateTime(localDateTime);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingScheduledPost(null);
    setEditingPrompt("");
    setEditingDateTime("");
  };

  // Save edited scheduled post
  const handleSaveScheduledPost = async (id: string) => {
    if (!editingPrompt.trim()) {
      alert("Prompt cannot be empty");
      return;
    }

    const newScheduleTime = new Date(editingDateTime);
    if (newScheduleTime <= new Date()) {
      alert("Schedule time must be in the future");
      return;
    }

    setIsUpdating(true);
    try {
      const res = await fetch("/api/scheduledposts", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          id,
          prompt: editingPrompt,
          scheduleTime: newScheduleTime.toISOString(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.error || "Failed to update scheduled post");
        return;
      }

      // Update local state
      setScheduledPosts((prev) =>
        prev.map((p) =>
          p._id === id
            ? {
                ...p,
                prompt: editingPrompt,
                scheduleTime: newScheduleTime.toISOString(),
              }
            : p
        )
      );

      // Clear editing state
      handleCancelEdit();
    } catch (err) {
      console.error("Error updating scheduled post:", err);
      alert("Failed to update scheduled post");
    } finally {
      setIsUpdating(false);
    }
  };

  // Delete a scheduled post
  const handleDeleteScheduledPost = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this scheduled post? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/scheduledposts?id=${id}`, {
        method: "DELETE",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete scheduled post");
        return;
      }

      // Remove from local state
      setScheduledPosts((prev) => prev.filter((post) => post._id !== id));
    } catch (err) {
      console.error("Error deleting scheduled post:", err);
      alert("Failed to delete scheduled post");
    }
  };

  useEffect(() => {
    fetchPosts();
    fetchWorkerStatus();

    // Fetch posts every 60 seconds
    const fetchInterval = setInterval(() => {
      fetchPosts();
      fetchWorkerStatus();
    }, 60 * 1000);

    // Update countdown every second
    const countdownInterval = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          // When countdown reaches 0, fetch worker status again
          fetchWorkerStatus();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(fetchInterval);
      clearInterval(countdownInterval);
    };
  }, [fetchPosts, fetchWorkerStatus]);

  const navigateMonth = (direction: number) => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1)
    );
  };

  const miniCalendarDays = useMemo((): CalendarDay[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(
      firstDay.getTime() - firstDay.getDay() * 24 * 60 * 60 * 1000
    );
    const endDate = new Date(
      lastDay.getTime() + (6 - lastDay.getDay()) * 24 * 60 * 60 * 1000
    );

    const days: CalendarDay[] = [];
    const today = new Date().toDateString();
    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      const dateString = d.toDateString();
      days.push({
        date: new Date(d),
        isCurrentMonth: d.getMonth() === month,
        isToday: dateString === today,
        posts: scheduledPosts.filter(
          (post) => new Date(post.scheduleTime).toDateString() === dateString
        ),
      });
    }
    return days;
  }, [currentDate, scheduledPosts]);

  const selectedDatePosts = useMemo(() => {
    return scheduledPosts.filter(
      (post) =>
        new Date(post.scheduleTime).toDateString() ===
        selectedDate.toDateString()
    );
  }, [selectedDate, scheduledPosts]);

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const dayNames = ["S", "M", "T", "W", "Th", "F", "S"];

  const formatTime = (timestamp: string | number) =>
    new Date(timestamp).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-white">
        Loading scheduled posts...
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-gray-950">
      {/* Sidebar Calendar */}
      <div className="w-full md:w-80 bg-gray-950 border-r border-gray-700/50 flex flex-col shrink-0">
        <div className="p-4 bg-gray-950 border-b border-gray-700/50">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={onBack}
              className="p-2 rounded-lg text-white hover:bg-gray-700/50 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-bold text-white text-sm md:text-base">
                Content Calendar
              </h1>
              <p className="text-xs text-white/60">Scheduled Posts</p>
            </div>
          </div>
        </div>

        {/* Mini Calendar */}
        <div className="p-4 flex-1 overflow-y-auto bg-gray-950">
          {/* Legend */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-medium text-sm md:text-base flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h3>
              <div className="flex gap-1">
                <button
                  onClick={() => navigateMonth(-1)}
                  className="w-7 h-7 rounded text-white hover:bg-gray-700/50 transition-colors flex items-center justify-center"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigateMonth(1)}
                  className="w-7 h-7 rounded text-white hover:bg-gray-700/50 transition-colors flex items-center justify-center"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-xs md:text-sm">
              {dayNames.map((day, i) => (
                <div
                  key={i}
                  className="text-center text-gray-400 font-medium py-1"
                >
                  {day}
                </div>
              ))}
              {miniCalendarDays.map((day, i) => (
                <button
                  key={`${i}-${day.date.getTime()}`}
                  onClick={() => setSelectedDate(day.date)}
                  className={`h-8 text-xs md:text-sm rounded transition-all relative
                    ${!day.isCurrentMonth ? "text-gray-600" : "text-gray-200"}
                    ${
                      day.isToday
                        ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold"
                        : ""
                    }
                    ${
                      selectedDate.toDateString() === day.date.toDateString() &&
                      !day.isToday
                        ? "bg-gray-700/80 text-white"
                        : ""
                    }
                    ${
                      !day.isToday &&
                      selectedDate.toDateString() !== day.date.toDateString()
                        ? "hover:bg-gray-800/50"
                        : ""
                    }`}
                >
                  {day.date.getDate()}
                  {day.posts.length > 0 && (
                    <div className="absolute bottom-0.5 left-0 right-0 flex justify-center gap-0.5">
                      <div
                        className="w-1.5 h-1.5 bg-blue-400 rounded-full"
                        title="Scheduled post"
                      ></div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Show Ready for Review Button */}
        <div className="p-4 border-t border-gray-700/50 space-y-2 bg-gray-950">
          <button
            onClick={() => setShowReadyPosts(!showReadyPosts)}
            className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium hover:from-blue-600 hover:to-purple-600 transition-all flex items-center justify-center gap-2"
          >
            <Clock className="w-4 h-4" />
            {showReadyPosts ? "Hide Ready for Review" : "Show Ready for Review"}
          </button>
          <button
            onClick={() => (window.location.href = "/manage-recurring")}
            className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-green-500 to-teal-500 text-white font-medium hover:from-green-600 hover:to-teal-600 transition-all flex items-center justify-center gap-2"
          >
            <RotateCw className="w-4 h-4" />
            Manage Recurring Posts
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-gray-950">
        <div className="p-4 bg-gray-950 border-b border-gray-700/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <h2 className="text-lg md:text-xl text-white font-medium">
            {showReadyPosts
              ? "Posts Ready for Review"
              : selectedDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
          </h2>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Auto-refreshing in {refreshCountdown}s
          </span>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-950">
          <div className="max-w-4xl mx-auto p-4 md:p-6">
            {showReadyPosts ? (
              readyForReviewPosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-60 text-center">
                  <CheckCircle className="w-16 h-16 text-green-400 mb-4" />
                  <h3 className="text-xl md:text-2xl font-bold text-white mb-4">
                    No posts ready for review
                  </h3>
                </div>
              ) : (
                <div className="space-y-4">
                  {readyForReviewPosts.map((post, index) => (
                    <MessageBubble
                      key={post._id}
                      message={{
                        id: post._id,
                        sender: "ai",
                        content: post.post || post.prompt,
                        timestamp: new Date(post.scheduleTime).getTime(),
                        status:
                          post.status === "ready_for_review"
                            ? "pending"
                            : (post.status as
                                | "scheduled"
                                | "pending"
                                | "posting"
                                | "posted"
                                | "error"
                                | "rejected"),
                        availablePlatforms:
                          post.platforms ||
                          (post.platform ? [post.platform] : []),
                        threadId: post.threadId || undefined,
                        _id: post._id,
                        isScheduled: post.isScheduled,
                      }}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      isLatestAiMessage={
                        index === readyForReviewPosts.length - 1
                      }
                      onEditSave={handleEditSave}
                    />
                  ))}
                </div>
              )
            ) : selectedDatePosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-60 text-center">
                <CalendarIcon className="w-16 h-16 text-gray-500 mb-4" />
                <h3 className="text-xl md:text-2xl font-bold text-white mb-4">
                  No posts scheduled
                </h3>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedDatePosts.map((post) => (
                  <div
                    key={post._id}
                    className="bg-gray-800/80 border border-gray-700/50 rounded-2xl p-4 md:p-6 hover:border-gray-600/50 transition-all"
                  >
                    {editingScheduledPost === post._id ? (
                      // Edit mode
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">
                            Prompt:
                          </label>
                          <textarea
                            value={editingPrompt}
                            onChange={(e) => setEditingPrompt(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-900 text-white rounded-lg border-2 border-purple-500 focus:outline-none resize-none"
                            rows={3}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">
                            Schedule Time:
                          </label>
                          <input
                            type="datetime-local"
                            value={editingDateTime}
                            onChange={(e) => setEditingDateTime(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-900 text-white rounded-lg border-2 border-purple-500 focus:outline-none"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={handleCancelEdit}
                            disabled={isUpdating}
                            className="px-3 py-1.5 text-sm text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-1"
                          >
                            <X className="w-4 h-4" />
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveScheduledPost(post._id)}
                            disabled={isUpdating}
                            className="px-3 py-1.5 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-500 transition-colors flex items-center gap-1 disabled:opacity-50"
                          >
                            <Check className="w-4 h-4" />
                            {isUpdating ? "Saving..." : "Save"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm text-gray-400">
                            Scheduled for {formatTime(post.scheduleTime)}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                              {post.status === "scheduled"
                                ? "⏰ Pending"
                                : "✅ Ready"}
                            </span>
                          </div>
                        </div>
                        <p className="text-white text-sm md:text-base leading-relaxed">
                          {post.prompt}
                        </p>
                        {(post.platforms || post.platform) && (
                          <div className="mt-3 flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              Platform
                              {(post.platforms?.length || 0) > 1 ? "s" : ""}:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {(post.platforms || [post.platform])
                                .filter(Boolean)
                                .map((p) => (
                                  <span
                                    key={p}
                                    className="px-2 py-0.5 text-xs font-medium rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 capitalize"
                                  >
                                    {p === "twitter"
                                      ? "𝕏 Twitter"
                                      : p === "facebook"
                                      ? "📘 Facebook"
                                      : p === "linkedin"
                                      ? "💼 LinkedIn"
                                      : p}
                                  </span>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Action buttons for pending posts */}
                        {post.status === "scheduled" && (
                          <div className="mt-4 flex justify-end gap-2 pt-3 border-t border-gray-700/50">
                            <button
                              onClick={() => handleStartEdit(post)}
                              className="px-3 py-1.5 text-sm text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-1"
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteScheduledPost(post._id)
                              }
                              className="px-3 py-1.5 text-sm text-red-300 bg-red-900/30 rounded-lg hover:bg-red-900/50 transition-colors flex items-center gap-1"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
