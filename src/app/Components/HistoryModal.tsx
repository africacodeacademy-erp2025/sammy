import React from "react";
import { History, Trash2, MessageSquare } from "lucide-react";

interface Conversation {
  threadId: string;
  title: string;
  lastUserMessage: string;
  messageCount: number;
  platform?: string;
  updatedAt: string;
}

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  loadingHistory: boolean;
  onLoadConversation: (threadId: string) => void;
  onDeleteConversation: (threadId: string) => void;
}

export default function HistoryModal({
  isOpen,
  onClose,
  conversations,
  loadingHistory,
  onLoadConversation,
  onDeleteConversation,
}: HistoryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800/80 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-gray-700/50">
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-700/50">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <History className="w-6 h-6" />
              Chat History
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl leading-none"
            >
              ×
            </button>
          </div>
          <p className="text-sm text-gray-400 mt-2">
            Load or delete previous conversations
          </p>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loadingHistory ? (
            <div className="text-center text-gray-400 py-8">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Loading conversations...
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <MessageSquare className="w-16 h-16 mx-auto mb-3 opacity-50" />
              <p>No conversation history yet</p>
              <p className="text-sm mt-2">
                Start chatting to save conversations!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {conversations.map((conv) => (
                <div
                  key={conv.threadId}
                  className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50 hover:border-purple-500/50 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white truncate mb-1">
                        {conv.title || "Untitled Conversation"}
                      </h3>
                      <p className="text-sm text-gray-400 truncate mb-2">
                        {conv.lastUserMessage || "No messages"}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {conv.messageCount} messages
                        </span>
                        {conv.platform && (
                          <span className="capitalize">{conv.platform}</span>
                        )}
                        <span>
                          {new Date(conv.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onLoadConversation(conv.threadId)}
                        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white text-sm transition-colors"
                        title="Load conversation"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => onDeleteConversation(conv.threadId)}
                        className="px-3 py-1.5 rounded-lg text-red-400 border border-red-500/30 hover:bg-red-500/20 text-sm transition-colors flex items-center gap-1"
                        title="Delete conversation"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-gray-700/50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 text-white transition-colors border border-gray-700/50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
