"use client";
import { useState, useMemo, useEffect } from "react";

export interface ScheduledPost {
  post?: string;
  _id: string;
  prompt: string;
  platform: string;
  scheduleTime: string;
  status: "scheduled" | "ready_for_review" | string;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  posts: ScheduledPost[];
}

export default function ScheduledPostView({ onBack }: { onBack: () => void }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [readyForReviewPosts, setReadyForReviewPosts] = useState<
    ScheduledPost[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [showReadyPosts, setShowReadyPosts] = useState(false);

  const fetchPosts = async () => {
    try {
      const res = await fetch("/api/scheduledposts");
      const data = await res.json();
      setScheduledPosts(data.scheduled || []);
      setReadyForReviewPosts(data.readyForReview || []);
    } catch (err) {
      console.error("Failed to fetch scheduled posts", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
    const interval = setInterval(fetchPosts, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

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
    <div className="flex h-screen w-full bg-gray-950">
      {/* Sidebar Calendar */}
      <div className="w-80 bg-gray-900/90 border-r border-gray-700/50 flex flex-col">
        <div className="p-4 bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700/50">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={onBack}
              className="p-2 rounded-lg bg-gray-700/50 text-white hover:bg-gray-700"
            >
              ←
            </button>
            <div>
              <h1 className="font-bold text-white">Content Calendar</h1>
              <p className="text-xs text-white/60">Scheduled Posts</p>
            </div>
          </div>
        </div>

        {/* Mini Calendar */}
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-medium">
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

            <div className="grid grid-cols-7 gap-1 text-xs">
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
                  className={`h-8 text-xs rounded transition-all relative
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
                    <div className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Show Ready for Review Button */}
        <div className="p-4 border-t border-gray-700/50">
          <button
            onClick={() => setShowReadyPosts(!showReadyPosts)}
            className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold"
          >
            {showReadyPosts ? "Hide Ready for Review" : "Show Ready for Review"}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700/50 flex justify-between items-center">
          <h2 className="text-xl text-white font-medium">
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
            Auto-refreshing every 60s
          </span>
        </div>

        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-900/30 to-gray-900/10">
          <div className="p-6">
            {showReadyPosts ? (
              readyForReviewPosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-80 text-center">
                  <div className="text-6xl mb-6">✅</div>
                  <h3 className="text-2xl font-bold text-white mb-4">
                    No posts ready for review
                  </h3>
                </div>
              ) : (
                <div className="space-y-4">
                  {readyForReviewPosts.map((post) => (
                    <div
                      key={post._id}
                      className="bg-gray-800/80 border border-gray-700/50 rounded-2xl p-6"
                    >
                      <div className="text-sm text-gray-400 mb-2">
                        Platform:{" "}
                        <span className="font-medium text-white">
                          {post.platform}
                        </span>
                      </div>
                      <p className="text-white text-base leading-relaxed">
                        {post.post}
                      </p>
                    </div>
                  ))}
                </div>
              )
            ) : selectedDatePosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-80 text-center">
                <div className="text-6xl mb-6">📝</div>
                <h3 className="text-2xl font-bold text-white mb-4">
                  No posts scheduled
                </h3>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedDatePosts.map((post) => (
                  <div
                    key={post._id}
                    className="bg-gray-800/80 border border-gray-700/50 rounded-2xl p-6"
                  >
                    <div className="text-sm text-gray-400 mb-2">
                      Scheduled for {formatTime(post.scheduleTime)}
                    </div>
                    <p className="text-white text-base leading-relaxed">
                      {post.prompt}
                    </p>
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
