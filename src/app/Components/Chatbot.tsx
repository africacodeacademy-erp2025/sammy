// src/app/Components/Chatbot.tsx
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
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState<"chat" | "schedule">("chat");

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
  const idCounterRef = useRef(0);

  const latestAiMessageId = messages
    .filter((msg) => msg.sender === "ai")
    .map((msg) => msg.id)
    .pop();

  // Scroll to bottom when messages change
  useEffect(() => {
    const node = messagesEndRef.current as unknown as { scrollIntoView?: (opts?: ScrollIntoViewOptions) => void } | null;
    if (node && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ behavior: "smooth" });
    }
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

  const addMessage = useCallback((msg: Omit<Message, "id" | "timestamp">) => {
    const newMessage = {
      id: `${crypto.randomUUID?.() ?? "id"}-${idCounterRef.current++}`,
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
    setIsTyping(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 100)); // simulate typing delay

      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userInput }),
      });

      const data = await res.json();

      // Show backend errors directly in the message bubble
      if (!res.ok || data.error) {
        addMessage({
          sender: "ai",
          content: data.error || `Server responded with ${res.status}`,
          status: "error",
        });
        return;
      }

      addMessage({
        sender: "ai",
        content: data.review?.post || "No response generated",
        status: "pending",
        threadId: data.review?.threadId,
      });
    } catch (err: unknown) {
      addMessage({
        sender: "ai",
        content:
          (err instanceof Error ? err.message : "An unknown error occurred") ||
          "Sorry, I encountered an error processing your request.",
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

      const data = await res.json();

      if (!res.ok || data.error) {
        updateMessageStatus(id, "error");
        addMessage({
          sender: "ai",
          content: data.error || `Server responded with ${res.status}`,
          status: "error",
        });
        return;
      }

      updateMessageStatus(id, "posted");
    } catch (err: unknown) {
      updateMessageStatus(id, "error");
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to post message. Please try again later.";
      addMessage({
        sender: "ai",
        content: errorMessage,
        status: "error",
      });
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
    <div className="flex h-screen w-full bg-gray-850">
      {/* Sidebar */}
      {sidebarOpen && (
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onViewSchedule={handleViewSchedule}
        />
      )}

      {/* Main Chat Area */}
      <div
        className={`flex-1 flex flex-col relative transition-all duration-300 ${
          sidebarOpen ? "md:ml-64" : ""
        }`}
      >
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-gray-900/90 to-gray-800/90 backdrop-blur-xl border-b border-gray-700/50 z-10 sticky top-0">
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
                aria-label="Settings"
              >
                <span>⚙️</span>
                <span className="text-xs">Settings</span>
              </button>
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-4 pb-40 space-y-6 bg-gradient-to-b from-gray-900/30 to-gray-900/10">
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
                    <li>• &quot;Create a tweet about launching our new branch&quot;</li>
                    <li>• &quot;Write a linkedin post about our opened intake&quot;</li>
                    <li>
                      • &quot;Draft a facebook promotional post for my product&quot;
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {messages.map((msg, index) => (
            <MessageBubble
              key={`${msg.id}-${index}`}
              message={msg}
              onApprove={handleApproveDraft}
              onReject={handleRejectDraft}
              isLatestAiMessage={msg.id === latestAiMessageId}
            />
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="max-w-full sm:max-w-[80%] rounded-2xl p-4 bg-gray-800/80 text-white backdrop-blur-sm border border-gray-700/50">
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

        {/* Input Area */}
        <div className="w-full max-w-2xl fixed bottom-0 left-1/2 transform -translate-x-1/2 px-4 pb-4 z-20">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              className="flex-1 rounded-3xl px-4 py-3 resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-purple-500 max-h-32 text-sm bg-gray-900/90 text-white placeholder-white/60"
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
              data-testid="send-button"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Send
                  <span className="text-xs ml-1">⏎</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
