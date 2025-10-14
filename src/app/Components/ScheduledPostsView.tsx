"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import MessageBubble from "../Components/MessageBubble";
import RecurringScheduleManager from "../Components/RecurringScheduleManager";
import type { RecurringScheduleTemplate } from "../Types/recurring";

export interface ScheduledPost {
  threadId: string | null;
  post?: string;
  _id: string;
  prompt: string;
  platform: string;
  scheduleTime: string;
  status: "scheduled" | "ready_for_review" | string;
  isScheduled?: boolean;
  parentPostId?: string; // Links to recurring template
  isRecurringOccurrence?: boolean;
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
  const [recurringTemplates, setRecurringTemplates] = useState<
    RecurringScheduleTemplate[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [showReadyPosts, setShowReadyPosts] = useState(false);
  const [showRecurringManager, setShowRecurringManager] = useState(false);
  const [refreshCountdown, setRefreshCountdown] = useState(60);

  const token = localStorage.getItem("token");

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch("/api/scheduledposts", {
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      const data = await res.json();
      setScheduledPosts(data.scheduled || initialPosts);
      setReadyForReviewPosts(data.readyForReview || []);

      // Fetch recurring templates
      const recurringRes = await fetch("/api/recurring-schedules", {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      const recurringData = await recurringRes.json();
      if (recurringData.success) {
        setRecurringTemplates(recurringData.templates || []);
      }
    } catch (err) {
      console.error("Failed to fetch scheduled posts", err);
    } finally {
      setLoading(false);
      setRefreshCountdown(60);
    }
  }, [initialPosts, token]);

  const handleApprove = async (id: string) => {
    const postToApprove = readyForReviewPosts.find((p) => p._id === id);
    if (!postToApprove) return;

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
          platform: postToApprove.platform,
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

  useEffect(() => {
    fetchPosts();
    const fetchInterval = setInterval(fetchPosts, 60 * 1000);

    const countdownInterval = setInterval(() => {
      setRefreshCountdown((prev) => (prev > 1 ? prev - 1 : 60));
    }, 1000);

    return () => {
      clearInterval(fetchInterval);
      clearInterval(countdownInterval);
    };
  }, []);

  const navigateMonth = (direction: number) => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1)
    );
  };

  // Helper function to calculate next occurrences for a recurring template
  const calculateRecurringOccurrences = (
    template: RecurringScheduleTemplate,
    startDate: Date,
    endDate: Date
  ): ScheduledPost[] => {
    if (!template.recurrencePattern || template.status !== "active") return [];

    const occurrences: ScheduledPost[] = [];
    const pattern = template.recurrencePattern;
    const [hours, minutes] = pattern.timeOfDay.split(":").map(Number);

    let currentDate = new Date(startDate);
    currentDate.setHours(hours, minutes, 0, 0);

    // If the time has passed for startDate, move to next day
    if (currentDate < new Date()) {
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const maxIterations = 100; // Safety limit
    let iterations = 0;

    while (currentDate <= endDate && iterations < maxIterations) {
      iterations++;
      let shouldAdd = false;

      if (pattern.frequency === "daily") {
        shouldAdd = true;
        currentDate.setDate(currentDate.getDate() + pattern.interval);
      } else if (pattern.frequency === "weekly") {
        const dayOfWeek = currentDate.toLocaleDateString("en-US", {
          weekday: "long",
        });
        if (
          pattern.daysOfWeek &&
          pattern.daysOfWeek.includes(
            dayOfWeek as
              | "Sunday"
              | "Monday"
              | "Tuesday"
              | "Wednesday"
              | "Thursday"
              | "Friday"
              | "Saturday"
          )
        ) {
          shouldAdd = true;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      } else if (pattern.frequency === "monthly") {
        if (
          pattern.dayOfMonth &&
          currentDate.getDate() === pattern.dayOfMonth
        ) {
          shouldAdd = true;
        }
        currentDate.setMonth(currentDate.getMonth() + pattern.interval);
      }

      if (shouldAdd && currentDate <= endDate && currentDate >= startDate) {
        occurrences.push({
          _id: `recurring-${template._id}-${currentDate.getTime()}`,
          threadId: null,
          prompt: template.prompt,
          platform: template.platform,
          scheduleTime: currentDate.toISOString(),
          status: "scheduled",
          isScheduled: true,
          parentPostId: template._id,
          isRecurringOccurrence: true,
        });
      }
    }

    return occurrences;
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

    // Calculate recurring occurrences for the visible calendar range
    const recurringOccurrences: ScheduledPost[] = [];
    recurringTemplates.forEach((template) => {
      const occurrences = calculateRecurringOccurrences(
        template,
        startDate,
        endDate
      );
      recurringOccurrences.push(...occurrences);
    });

    // Merge scheduled posts with recurring occurrences
    const allPosts = [...scheduledPosts, ...recurringOccurrences];

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
        posts: allPosts.filter(
          (post) => new Date(post.scheduleTime).toDateString() === dateString
        ),
      });
    }
    return days;
  }, [currentDate, scheduledPosts, recurringTemplates]);

  const selectedDatePosts = useMemo(() => {
    // Calculate recurring occurrences for the selected date
    const selectedDateStart = new Date(selectedDate);
    selectedDateStart.setHours(0, 0, 0, 0);
    const selectedDateEnd = new Date(selectedDate);
    selectedDateEnd.setHours(23, 59, 59, 999);

    const recurringOccurrences: ScheduledPost[] = [];
    recurringTemplates.forEach((template) => {
      const occurrences = calculateRecurringOccurrences(
        template,
        selectedDateStart,
        selectedDateEnd
      );
      recurringOccurrences.push(...occurrences);
    });

    // Merge scheduled posts with recurring occurrences
    const allPosts = [...scheduledPosts, ...recurringOccurrences];

    return allPosts.filter(
      (post) =>
        new Date(post.scheduleTime).toDateString() ===
        selectedDate.toDateString()
    );
  }, [selectedDate, scheduledPosts, recurringTemplates]);

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

  // Show Recurring Manager if requested
  if (showRecurringManager) {
    return (
      <RecurringScheduleManager
        onClose={() => {
          setShowRecurringManager(false);
          fetchPosts(); // Refresh data when returning
        }}
      />
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-gray-950">
      {/* Sidebar Calendar */}
      <div className="w-full md:w-80 bg-gray-900/90 border-r border-gray-700/50 flex flex-col">
        <div className="p-4 bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700/50">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={onBack}
              className="p-2 rounded-lg bg-gray-700/50 text-white hover:bg-gray-700"
            >
              ←
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
        <div className="p-4 flex-1 overflow-y-auto">
          {/* Legend */}
          <div className="mb-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700/30">
            <p className="text-xs text-gray-400 mb-2 font-medium">Legend:</p>
            <div className="flex flex-col gap-1 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span className="text-gray-300">One-time post</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-gray-300">Recurring post</span>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-medium text-sm md:text-base">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h3>
              <div className="flex gap-1">
                {[-1, 1].map((dir) => (
                  <button
                    key={dir}
                    onClick={() => navigateMonth(dir)}
                    className="w-7 h-7 rounded bg-gray-700/50 text-white hover:bg-gray-700"
                  >
                    {dir === -1 ? "‹" : "›"}
                  </button>
                ))}
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
                      {day.posts.some((p) => p.isRecurringOccurrence) && (
                        <div
                          className="w-1.5 h-1.5 bg-green-400 rounded-full"
                          title="Recurring post"
                        ></div>
                      )}
                      {day.posts.some((p) => !p.isRecurringOccurrence) && (
                        <div
                          className="w-1.5 h-1.5 bg-blue-400 rounded-full"
                          title="One-time post"
                        ></div>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Show Ready for Review Button */}
        <div className="p-4 border-t border-gray-700/50 space-y-2">
          <button
            onClick={() => setShowReadyPosts(!showReadyPosts)}
            className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold hover:from-blue-600 hover:to-purple-600 transition-all"
          >
            {showReadyPosts ? "Hide Ready for Review" : "Show Ready for Review"}
          </button>

          {/* Recurring Schedules Button */}
          <button
            onClick={() => setShowRecurringManager(true)}
            className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold hover:from-green-600 hover:to-emerald-600 transition-all flex items-center justify-center gap-2"
          >
            🔄 Recurring Schedules
            {recurringTemplates.length > 0 && (
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                {recurringTemplates.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
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
          <span className="text-xs text-gray-400">
            Auto-refreshing in {refreshCountdown}s
          </span>
        </div>

        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-900/30 to-gray-900/10">
          <div className="p-4 md:p-6">
            {showReadyPosts ? (
              readyForReviewPosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-60 text-center">
                  <div className="text-6xl mb-6">✅</div>
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
                        platform: post.platform,
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
                <div className="text-6xl mb-6">📝</div>
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
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-gray-400">
                        Scheduled for {formatTime(post.scheduleTime)}
                      </div>
                      <div className="flex items-center gap-2">
                        {post.isRecurringOccurrence && (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1">
                            🔄 Recurring
                          </span>
                        )}
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
                    {post.platform && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs text-gray-500">Platform:</span>
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                          {post.platform === "twitter"
                            ? "𝕏 Twitter"
                            : "📘 Facebook"}
                        </span>
                      </div>
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
