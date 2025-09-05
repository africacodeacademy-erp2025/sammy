
"use client";
import React, { useState, useRef, useEffect } from "react";

// ----------------------
// Types
// ----------------------
interface Message {
  id: string;
  sender: "user" | "ai";
  content: string;
  status?: "pending" | "posting" | "posted" | "error" | "rejected";
  threadId?: string;
}

// ----------------------
// MessageBubble Component
// ----------------------
interface MessageBubbleProps {
  message: Message;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

function MessageBubble({ message, onApprove, onReject }: MessageBubbleProps) {
  const isUser = message.sender === "user";

  const statusLabels: Record<string, React.ReactNode> = {
    pending: (
      <>
        <span className="text-xs text-gray-200">⏳ Draft for review</span>
        <button
          className="text-xs px-3 py-1 rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors focus:outline-none focus:ring-2 focus:ring-green-400"
          onClick={() => onApprove(message.id)}
        >
          ✅ Approve &amp; Post
        </button>
        <button
          className="text-xs px-3 py-1 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
          onClick={() => onReject(message.id)}
        >
          ❌ Reject
        </button>
      </>
    ),
    posting: (
      <span className="text-xs text-yellow-300 font-medium animate-pulse">
        🚀 Posting...
      </span>
    ),
    posted: (
      <span className="text-xs text-green-300 font-medium">✔️ Posted</span>
    ),
    rejected: (
      <span className="text-xs text-red-400 font-medium">🚫 Rejected</span>
    ),
    error: (
      <span className="text-xs text-red-300 font-medium">❌ Error</span>
    ),
  };

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-xl p-3 text-sm shadow-md ${
          isUser ? "bg-blue-500 text-white" : "bg-white/30 text-white"
        }`}
      >
        <div>{message.content}</div>
        {message.sender === "ai" && (
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            {message.status && statusLabels[message.status]}
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------
// ChatBot Component
// ----------------------
export default function ChatBot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ----------------------
  // Effects
  // ----------------------
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  // ----------------------
  // Handlers
  // ----------------------
  const sendMessage = async () => {
    if (!input.trim()) return;

    addMessage({ sender: "user", content: input });

    const userInput = input;
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userInput, platform: "twitter" }),
      });

      const data = await res.json();

      addMessage({
        sender: "ai",
        content: data.review?.post || "No response",
        status: "pending",
        threadId: data.review?.threadId,
      });
    } catch {
      addMessage({
        sender: "ai",
        content: "Failed to generate post.",
        status: "error",
      });
    } finally {
      setLoading(false);
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
        body: JSON.stringify({
          post: draft.content,
          platform: "twitter",
          threadId: draft.threadId,
        }),
      });

      updateMessageStatus(id, res.ok ? "posted" : "error");
    } catch {
      updateMessageStatus(id, "error");
    }
  };

  const handleRejectDraft = (id: string) => {
    updateMessageStatus(id, "rejected");
  };

  // ----------------------
  // Helpers
  // ----------------------
  const addMessage = (msg: Omit<Message, "id">) => {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), ...msg },
    ]);
  };

  const updateMessageStatus = (id: string, status: Message["status"]) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, status } : msg))
    );
  };

  // ----------------------
  // Render
  // ----------------------
  return (
    <div className="flex flex-col h-screen w-full bg-gradient-to-br from-gray-900 via-slate-800 to-indigo-900 p-4 sm:p-6 md:p-8">
      <div className="relative w-[900px] mx-auto flex flex-col h-full bg-white/20 shadow-xl rounded-2xl overflow-hidden backdrop-blur-md">
        {/* Header */}
        <div className="p-4 border-b border-white/20 font-semibold text-lg text-white">
          SaMMy
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onApprove={handleApproveDraft}
              onReject={handleRejectDraft}
            />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/20 flex items-end gap-2 bg-white/10">
          <textarea
            ref={textareaRef}
            className="flex-1 border border-white/30 rounded-lg px-3 py-2 resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-400 max-h-40 text-sm bg-white/20 text-white placeholder-gray-200"
            placeholder="Instruct SaMMy..."
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <button
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center"
            disabled={loading || !input.trim()}
            onClick={sendMessage}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Send"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
