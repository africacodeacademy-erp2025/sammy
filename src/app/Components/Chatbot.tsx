"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Message, ScheduledPost } from "../Types";
import ScheduledPostView from "../Components/ScheduledPostView";
import MessageBubble from "../Components/MessageBubble";
import Sidebar from "./Sidebar";

export default function ChatBot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState<"chat" | "schedule">("chat");

  // Mock scheduled posts
  const [scheduledPosts] = useState<ScheduledPost[]>([
    {
      id: "1",
      content:
        "Just launched our new product! Check it out at our website. #innovation #tech",
      timestamp: Date.now() + 2 * 60 * 60 * 1000,
      platform: "Twitter",
      status: "scheduled",
    },
    {
      id: "2",
      content:
        "Exploring the future of AI in creative industries. What are your thoughts?",
      timestamp: Date.now() + 24 * 60 * 60 * 1000,
      platform: "LinkedIn",
      status: "scheduled",
    },
  ]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const latestAiMessageId = messages
    .filter((msg) => msg.sender === "ai")
    .map((msg) => msg.id)
    .pop();

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        120
      )}px`;
    }
  }, [input]);

  // Clear error after 5s
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Add message
  const addMessage = useCallback((msg: Omit<Message, "id" | "timestamp">) => {
    const newMessage = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      ...msg,
    };
    setMessages((prev) => [...prev, newMessage]);
  }, []);

  const updateMessageStatus = useCallback(
    (id: string, status: Message["status"]) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === id ? { ...msg, status } : msg))
      );
    },
    []
  );

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userInput = input.trim();
    addMessage({ sender: "user", content: userInput });
    setInput("");
    setLoading(true);
    setError(null);
    setIsTyping(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate typing delay

      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userInput }),
      });

      if (!res.ok) throw new Error(`Server responded with ${res.status}`);

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      addMessage({
        sender: "ai",
        content: data.review?.post || "No response generated",
        status: "pending",
        threadId: data.review?.threadId,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to generate post";
      setError(errorMessage);
      addMessage({
        sender: "ai",
        content: "Sorry, I encountered an error processing your request.",
        status: "error",
      });
    } finally {
      setLoading(false);
      setIsTyping(false);
    }
  };

  const handleApproveDraft = async (id: string) => {
    const draft = messages.find((msg) => msg.id === id);
    if (!draft || draft.status !== "pending" || !draft.threadId) return;

    updateMessageStatus(id, "posting");

    try {
      const res = await fetch("/api/agent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post: draft.content, threadId: draft.threadId }),
      });

      if (!res.ok) throw new Error(`Server responded with ${res.status}`);

      updateMessageStatus(id, "posted");
    } catch {
      updateMessageStatus(id, "error");
      setError("Failed to post message. Please try again.");
    }
  };

  const handleRejectDraft = (id: string) => {
    updateMessageStatus(id, "rejected");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    if (confirm("Are you sure you want to clear the conversation?")) {
      setMessages([]);
      setError(null);
    }
  };

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const handleViewSchedule = () => {
    setView("schedule");
    setSidebarOpen(false);
  };

  const handleBackToChat = () => setView("chat");

  if (view === "schedule") {
    return (
      <ScheduledPostView
        onBack={handleBackToChat}
        scheduledPosts={scheduledPosts}
      />
    );
  }

  return (
    <div className="flex h-screen w-full bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-gray-900/80 to-gray-800/80 backdrop-blur-xl border-b border-gray-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">S</span>
              </div>
              <div>
                <h1 className="font-bold text-white">SaMMy</h1>
                <p className="text-xs text-white/60">
                  Social Media Content Generator
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="text-xs px-3 py-1.5 rounded-lg bg-rose-700/50 text-white hover:bg-rose-700 transition-colors"
                >
                  Clear Chat
                </button>
              )}
              <button
                onClick={toggleSidebar}
                className="p-2 rounded-lg bg-gray-700/50 text-white hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <span>⚙️</span>
                <span className="text-xs">Settings</span>
              </button>
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-rose-900/50 text-rose-100 px-4 py-2 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-rose-200 hover:text-white"
            >
              ×
            </button>
          </div>
        )}

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gradient-to-b from-gray-900/30 to-gray-900/10">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-white/60">
              <div className="text-center max-w-md mb-8">
                <div className="text-4xl mb-4">🤖</div>
                <h2 className="text-2xl font-extrabold mb-4">
                  What do you want to post about?
                </h2>
                <div className="p-4 rounded-xl text-left backdrop-blur-sm">
                  <p className="text-xs font-medium mb-2 text-gray-400">
                    Try asking me:
                  </p>
                  <ul className="text-xs space-y-1 text-gray-400">
                    <li>• "Create a tweet about launching our new branch"</li>
                    <li>• "Write a linkedin post about our opened intake"</li>
                    <li>
                      • "Draft a facebook promotional post for my product"
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onApprove={handleApproveDraft}
              onReject={handleRejectDraft}
              isLatestAiMessage={msg.id === latestAiMessageId}
            />
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl p-4 bg-gradient-to-r from-gray-800/80 to-gray-900/80 text-white backdrop-blur-sm border border-gray-700/50">
                <div className="flex items-center gap-2 text-white/70">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-white/50 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-white/50 rounded-full animate-bounce"
                      style={{ animationDelay: "0.4s" }}
                    ></div>
                  </div>
                  <span className="text-sm">SaMMy is thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Unified Input Area */}
        <div className="w-full max-w-2xl fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4">
          <div className="flex items-end gap-2 rounded-3xl p-3 bg-gray-800/30 backdrop-blur-sm">
            <textarea
              ref={textareaRef}
              className="flex-1 rounded-3xl px-4 py-3 resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-purple-500 max-h-32 text-sm bg-gray-800/30 text-white placeholder-gray-400"
              placeholder="Instruct SaMMy..."
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button
              className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-5 py-3 rounded-3xl hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50 flex items-center justify-center min-w-[90px] shadow-md"
              disabled={loading || !input.trim()}
              onClick={sendMessage}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <div className="flex items-center gap-1">
                  <span>Send</span>
                  <span className="text-xs">⏎</span>
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onViewSchedule={handleViewSchedule}
      />
    </div>
  );
}
