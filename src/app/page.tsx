/* eslint-disable */
"use client";
import { useState, useRef, useEffect } from "react";

interface Message {
  id: string;
  sender: "user" | "ai";
  content: string;
  status?: "pending" | "posted" | "error" | "approved" | "posting";
  threadId?: string;
}

export default function ChatBot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      sender: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input, platform: "twitter" }),
      });
      const data = await res.json();

      const aiMessage: Message = {
        id: crypto.randomUUID(),
        sender: "ai",
        content: data.review.post || "No response",
        status: "pending",
        threadId: data.review.threadId,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        sender: "ai",
        content: "Failed to generate post.",
        status: "error",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    const messageToApprove = messages.find((msg) => msg.id === id);

    if (
      !messageToApprove ||
      !messageToApprove.threadId ||
      messageToApprove.status !== "pending"
    ) {
      console.error("Invalid message or status for approval.");
      return;
    }

    try {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === id ? { ...msg, status: "posting" } : msg
        )
      );

      const res = await fetch("/api/agent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post: messageToApprove.content,
          platform: "twitter",
          threadId: messageToApprove.threadId,
        }),
      });

      if (res.ok) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === id ? { ...msg, status: "posted" } : msg
          )
        );
      } else {
        throw new Error("Failed to post");
      }
    } catch (err) {
      console.error("Error posting to Twitter:", err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === id ? { ...msg, status: "error" } : msg
        )
      );
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-gradient-to-br from-gray-900 via-slate-800 to-indigo-900 p-4 sm:p-6 md:p-8">
      <div className="relative w-[900px] mx-auto flex flex-col h-full bg-white/20 shadow-xl rounded-2xl overflow-hidden backdrop-blur-md">
        <div className="p-4 border-b border-white/20 font-semibold text-lg text-white">
          SaMMy
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-xl p-3 text-sm shadow-md ${
                  msg.sender === "user"
                    ? "bg-blue-500 text-white"
                    : "bg-white/30 text-white"
                }`}
              >
                <div>{msg.content}</div>
                {msg.sender === "ai" && (
                  <div className="mt-2 flex items-center gap-2">
                    {msg.status === "pending" && (
                      <span className="text-xs text-gray-200">
                        ⏳ Draft for review
                      </span>
                    )}
                    {msg.status === "posting" && (
                      <span className="text-xs text-yellow-300 font-medium animate-pulse">
                        🚀 Posting...
                      </span>
                    )}
                    {msg.status === "posted" && (
                      <span className="text-xs text-green-300 font-medium">
                        ✔️ Posted
                      </span>
                    )}
                    {msg.status === "error" && (
                      <span className="text-xs text-red-300 font-medium">
                        ❌ Error
                      </span>
                    )}
                    {msg.status === "pending" && (
                      <button
                        className="text-xs px-2 py-1 rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors focus:outline-none focus:ring-2 focus:ring-green-400"
                        onClick={() => handleApprove(msg.id)}
                      >
                        Approve &amp; Post
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef}></div>
        </div>
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
                handleSend();
              }
            }}
          />
          <button
  className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center"
  disabled={loading || !input.trim()}
  onClick={handleSend}
>
  {loading ? (
    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
  ) : (
    "Send"
  )}
</button>

        </div>
      </div>
    </div>
  );
}
