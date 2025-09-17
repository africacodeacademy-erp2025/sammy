"use client";

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
            {/* View Schedule */}
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

            {/* Manage Credentials */}
            <button
              onClick={onManageCredentials}
              className="w-full flex items-center justify-between p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800/70 transition-colors"
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
        </div>
      </div>
    </>
  );
}
