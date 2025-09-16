"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Message } from "../Types";
import ScheduledPostView from "./ScheduledPostsView";
import MessageBubble from "../Components/MessageBubble";
import Sidebar from "./Sidebar";

export default function ChatBot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState<"chat" | "schedule">("chat");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const latestAiMessageId = messages
    .filter((msg) => msg.sender === "ai")
    .map((msg) => msg.id)
    .pop();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    setIsTyping(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const token = localStorage.getItem("token");

      const res = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt: userInput }),
      });
      const data = await res.json();

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
        content: data.review?.post || data.message,
        status: data.message ? "scheduled" : "pending",
        threadId: data.review?.threadId,
        platform: data.review?.platform,
      });
    } catch (err: any) {
      addMessage({
        sender: "ai",
        content:
          err?.message ||
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          post: draft.content,
          platform: draft.platform,
          threadId: draft.threadId,
        }),
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
    } catch (err: any) {
      updateMessageStatus(id, "error");
      addMessage({
        sender: "ai",
        content:
          err?.message || "Failed to post message. Please try again later.",
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
    return <ScheduledPostView onBack={handleBackToChat} />;
  }

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-gray-950">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onViewSchedule={handleViewSchedule}
      />

      {/* Main Chat Area */}
      <div
        className={`flex-1 flex flex-col relative transition-all duration-300 ${
          sidebarOpen ? "md:ml-64" : ""
        }`}
      >
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-gray-900/90 to-gray-800/90 backdrop-blur-xl border-b border-gray-700/50 z-10 sticky top-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center">
                <img
                  src="/SaMMy.png"
                  alt="Logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h1 className="font-bold text-white text-sm sm:text-base">
                  SaMMy
                </h1>
                <p className="text-xs text-white/60">
                  Social Media Content Generator
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-2 sm:mt-0">
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
                className="px-3 py-1.5 rounded-lg bg-gray-700/50 text-white hover:bg-gray-700 transition-colors flex items-center justify-center"
              >
                <span className="text-sm">◧</span>
              </button>

              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 flex flex-col overflow-y-auto p-4 pb-40 sm:pb-44 bg-gradient-to-b from-gray-900/30 to-gray-900/10">
          {messages.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] text-white/60">
              <div className="text-center max-w-md mb-8">
                <h2 className="text-xl sm:text-2xl font-extrabold mb-4">
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
                      • "Draft a facebook promotional post for my product today
                      at 15:30 Lesotho time"
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
          <div className="absolute bottom-0 left-0 w-full h-64 sm:h-72 bg-gradient-to-t from-gray-950 via-gray-950/90 via-gray-950/50 to-transparent pointer-events-none" />
        </div>

        {/* Input Area */}
        <div className="w-full max-w-full sm:max-w-2xl fixed bottom-0 left-1/2 transform -translate-x-1/2 px-4 pb-4 z-20">
          <div className="flex flex-row gap-2">
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

            {/* Send Button (unchanged) */}
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
    </div>
  );
}
