"use client";

export default function Sidebar({
  isOpen,
  onClose,
  onViewSchedule,
}: {
  isOpen: boolean;
  onClose: () => void;
  onViewSchedule: () => void;
}) {
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
        fixed top-0 right-0 h-full w-80 bg-gray-900/95 backdrop-blur-xl border-l border-gray-700/50
        transform transition-transform duration-300 z-50 shadow-2xl
        ${isOpen ? "translate-x-0" : "translate-x-full"}
      `}
      >
        <div className="p-4 border-b border-gray-700/50">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Settings</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700/50"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-4 space-y-6 overflow-y-auto h-[calc(100%-4rem)]">
          <div className="space-y-4">
            <button
              onClick={onViewSchedule}
              className="w-full flex items-center justify-between p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800/70 transition-colors"
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

            <div className="p-3 bg-gray-800/30 rounded-lg">
              <h3 className="text-sm font-medium text-white mb-2">
                Preferences
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-300">
                    Default Posting Tone
                  </label>
                  <select className="w-full mt-1 bg-gray-700/50 border border-gray-600/50 rounded px-2 py-1 text-xs text-white">
                    <option>Professional</option>
                    <option>Casual</option>
                    <option>Humorous</option>
                    <option>Informative</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-300">
                    Auto-post approved content
                  </span>
                  <div className="relative inline-block w-10 h-5">
                    <input type="checkbox" className="sr-only" />
                    <div className="block w-10 h-5 rounded-full bg-gray-600" />
                    <div className="absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full" />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-gray-800/30 rounded-lg">
              <h3 className="text-sm font-medium text-white mb-2">App Info</h3>
              <div className="text-xs text-gray-300 space-y-2">
                <p>SaMMy will post to the platform specified in your prompt.</p>
                <p>
                  Just mention the platform name (Twitter, Instagram, etc.) in
                  your request.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
