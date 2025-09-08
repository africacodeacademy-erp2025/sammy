"use client";
import { ScheduledPost } from "../Types";

export default function ScheduledPostsView({
  onBack,
  scheduledPosts,
}: {
  onBack: () => void;
  scheduledPosts: ScheduledPost[];
}) {
  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-gray-900/80 to-gray-800/80 backdrop-blur-xl border-b border-gray-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-lg bg-gray-700/50 text-white hover:bg-gray-700 transition-colors"
            >
              ←
            </button>
            <div>
              <h1 className="font-bold text-white">Scheduled Posts</h1>
              <p className="text-xs text-white/60">Upcoming content</p>
            </div>
          </div>
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {scheduledPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/60">
            <div className="text-center max-w-md">
              <div className="text-4xl mb-4">📅</div>
              <h2 className="text-xl font-semibold mb-2">No scheduled posts</h2>
              <p className="text-sm">You don't have any posts scheduled yet.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {scheduledPosts.map((post) => (
              <div
                key={post.id}
                className="bg-gray-800/50 rounded-xl p-4 backdrop-blur-sm border border-gray-700/50"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded-full">
                    {post.platform}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(post.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-white/90 text-sm">{post.content}</p>
                <div className="flex justify-between items-center mt-3">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      post.status === "scheduled"
                        ? "bg-amber-500/20 text-amber-300"
                        : post.status === "posted"
                        ? "bg-green-500/20 text-green-300"
                        : "bg-rose-500/20 text-rose-300"
                    }`}
                  >
                    {post.status}
                  </span>
                  {post.status === "scheduled" && (
                    <button className="text-xs text-rose-400 hover:text-rose-300">
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
