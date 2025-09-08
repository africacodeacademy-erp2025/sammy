"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";

// Types
interface Message {
  id: string;
  sender: "user" | "ai";
  content: string;
  status?: "pending" | "posting" | "posted" | "error" | "rejected";
  threadId?: string;
  timestamp: number;
}

interface ScheduledPost {
  id: string;
  content: string;
  timestamp: number;
  platform: string;
  status: "scheduled" | "posted" | "canceled";
}

interface MessageBubbleProps {
  message: Message;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isLatestAiMessage: boolean;
}

// MessageBubble Component
function MessageBubble({ message, onApprove, onReject, isLatestAiMessage }: MessageBubbleProps) {
  const isUser = message.sender === "user";
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isLatestAiMessage) {
      const timer = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(true);
    }
  }, [isLatestAiMessage]);

  const statusLabels: Record<string, React.ReactNode> = {
    pending: (
      <div className="flex flex-col gap-2 mt-3 p-3 bg-black/20 rounded-lg border border-white/10">
        <span className="text-xs font-medium text-white/80">📝 Ready for review</span>
        <div className="flex gap-2">
          <button
            className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-400 flex items-center gap-1"
            onClick={() => onApprove(message.id)}
          >
            <span>✅</span> Approve
          </button>
          <button
            className="text-xs px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-400 flex items-center gap-1"
            onClick={() => onReject(message.id)}
          >
            <span>❌</span> Reject
          </button>
        </div>
      </div>
    ),
    posting: (
      <div className="flex items-center gap-2 mt-2 text-xs text-amber-300 font-medium">
        <div className="w-3 h-3 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
        <span>Posting...</span>
      </div>
    ),
    posted: (
      <div className="flex items-center gap-2 mt-2 text-xs text-green-300 font-medium">
        <span>✔️</span> Posted
      </div>
    ),
    rejected: (
      <div className="flex items-center gap-2 mt-2 text-xs text-rose-300 font-medium">
        <span>🚫</span> Rejected
      </div>
    ),
    error: (
      <div className="flex items-center gap-2 mt-2 text-xs text-red-300 font-medium">
        <span>❌</span> Error
      </div>
    ),
  };

  return (
    <div 
      className={`flex ${isUser ? "justify-end" : "justify-start"} transition-all duration-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
      style={{ transitionDelay: isLatestAiMessage ? '100ms' : '0ms' }}
    >
      <div
        className={`max-w-[80%] rounded-2xl p-4 text-sm ${
          isUser 
            ? "bg-gradient-to-r from-blue-500/80 to-indigo-500/80 text-white backdrop-blur-sm" 
            : "bg-gradient-to-r from-gray-800/80 to-gray-900/80 text-white backdrop-blur-sm border border-gray-700/50"
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
        
        <div className="flex justify-between items-center mt-2">
          <div className="text-xs opacity-70">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-xs opacity-50">
            {isUser ? "You" : "SaMMy"}
          </div>
        </div>
        
        {message.sender === "ai" && (
          <div className="mt-3">
            {message.status && statusLabels[message.status]}
          </div>
        )}
      </div>
    </div>
  );
}

// Sidebar Component
function Sidebar({ 
  isOpen, 
  onClose,
  onViewSchedule
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
      <div className={`
        fixed top-0 right-0 h-full w-80 bg-gray-900/95 backdrop-blur-xl border-l border-gray-700/50
        transform transition-transform duration-300 z-50 shadow-2xl
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
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
                  <h3 className="text-sm font-medium text-white">View Schedule</h3>
                  <p className="text-xs text-gray-400">See upcoming posts</p>
                </div>
              </div>
              <span className="text-gray-400">→</span>
            </button>

            <div className="p-3 bg-gray-800/30 rounded-lg">
              <h3 className="text-sm font-medium text-white mb-2">Preferences</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-300">Default Posting Tone</label>
                  <select className="w-full mt-1 bg-gray-700/50 border border-gray-600/50 rounded px-2 py-1 text-xs text-white">
                    <option>Professional</option>
                    <option>Casual</option>
                    <option>Humorous</option>
                    <option>Informative</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-300">Auto-post approved content</span>
                  <div className="relative inline-block w-10 h-5">
                    <input
                      type="checkbox"
                      className="sr-only"
                    />
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
                <p>Just mention the platform name (Twitter, Instagram, etc.) in your request.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ScheduledPostsView Component
function ScheduledPostsView({ 
  onBack,
  scheduledPosts 
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
              <div key={post.id} className="bg-gray-800/50 rounded-xl p-4 backdrop-blur-sm border border-gray-700/50">
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
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    post.status === 'scheduled' 
                      ? 'bg-amber-500/20 text-amber-300' 
                      : post.status === 'posted'
                      ? 'bg-green-500/20 text-green-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}>
                    {post.status}
                  </span>
                  {post.status === 'scheduled' && (
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

// ChatBot Component
export default function ChatBot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState<'chat' | 'schedule'>('chat');
  
  // Mock scheduled posts data
  const [scheduledPosts] = useState<ScheduledPost[]>([
    {
      id: '1',
      content: "Just launched our new product! Check it out at our website. #innovation #tech",
      timestamp: Date.now() + 2 * 60 * 60 * 1000, // 2 hours from now
      platform: 'Twitter',
      status: 'scheduled'
    },
    {
      id: '2',
      content: "Exploring the future of AI in creative industries. What are your thoughts?",
      timestamp: Date.now() + 24 * 60 * 60 * 1000, // 1 day from now
      platform: 'LinkedIn',
      status: 'scheduled'
    }
  ]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get the latest AI message ID for animation purposes
  const latestAiMessageId = messages
    .filter(msg => msg.sender === "ai")
    .map(msg => msg.id)
    .pop();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Message handlers
  const addMessage = useCallback((msg: Omit<Message, "id" | "timestamp">) => {
    const newMessage = { 
      id: crypto.randomUUID(), 
      timestamp: Date.now(),
      ...msg 
    };
    setMessages(prev => [...prev, newMessage]);
  }, []);

  const updateMessageStatus = useCallback((id: string, status: Message["status"]) => {
    setMessages(prev =>
      prev.map(msg => (msg.id === id ? { ...msg, status } : msg))
    );
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userInput = input.trim();
    addMessage({ sender: "user", content: userInput });
    setInput("");
    setLoading(true);
    setError(null);
    setIsTyping(true);

    try {
      // Simulate typing delay for better UX
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userInput }),
      });

      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }

      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      addMessage({
        sender: "ai",
        content: data.review?.post || "No response generated",
        status: "pending",
        threadId: data.review?.threadId,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to generate post";
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
        body: JSON.stringify({
          post: draft.content,
          threadId: draft.threadId,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }

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

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleViewSchedule = () => {
    setView('schedule');
    setSidebarOpen(false);
  };

  const handleBackToChat = () => {
    setView('chat');
  };

  if (view === 'schedule') {
    return <ScheduledPostsView onBack={handleBackToChat} scheduledPosts={scheduledPosts} />;
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
                <p className="text-xs text-white/60">Social Media Content Generator</p>
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
            <button onClick={() => setError(null)} className="text-rose-200 hover:text-white">
              ×
            </button>
          </div>
        )}

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gradient-to-b from-gray-900/30 to-gray-900/10">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/60">
              <div className="text-center max-w-md mb-8">
                <div className="text-4xl mb-4">🤖</div>
                <h2 className="text-xl font-semibold mb-2">Welcome to SaMMy!</h2>
                <p className="text-sm mb-6">I'm your AI social media assistant. I can help you create and post engaging content across multiple platforms.</p>
                <div className="bg-gray-800/50 p-4 rounded-xl text-left backdrop-blur-sm">
                  <p className="text-xs font-medium mb-2">Try asking me:</p>
                  <ul className="text-xs space-y-1">
                    <li className="flex items-center gap-2">• "Create a tweet about AI advancements"</li>
                    <li className="flex items-center gap-2">• "Write a thread about climate change"</li>
                    <li className="flex items-center gap-2">• "Draft a promotional post for my product"</li>
                  </ul>
                </div>
              </div>
              
              {/* Centered Input Area for empty state */}
              <div className="w-full max-w-2xl fixed bottom-4 left-1/2 transform -translate-x-1/2 px-4">
                <div className="flex items-end gap-2 bg-gray-800/30 backdrop-blur-xl rounded-xl p-3 border border-gray-700/50">
                  <textarea
                    ref={textareaRef}
                    className="flex-1 border border-gray-700/50 rounded-lg px-4 py-3 resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-purple-500 max-h-32 text-sm bg-gray-800/30 text-white placeholder-gray-400"
                    placeholder="Message SaMMy... (Press Enter to send, Shift+Enter for new line)"
                    rows={1}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                  />
                  <button
                    className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-5 py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50 flex items-center justify-center min-w-[90px]"
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
          ) : (
            <>
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
                        <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                      <span className="text-sm">SaMMy is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area (shown only when there are messages) */}
        {messages.length > 0 && (
          <div className="p-4 bg-gradient-to-r from-gray-900/80 to-gray-800/80 backdrop-blur-xl border-t border-gray-700/50">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                className="flex-1 border border-gray-700/50 rounded-xl px-4 py-3 resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-purple-500 max-h-32 text-sm bg-gray-800/30 text-white placeholder-gray-400 backdrop-blur-sm"
                placeholder="Message SaMMy... (Press Enter to send, Shift+Enter for new line)"
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
              />
              <button
                className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-5 py-3 rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50 flex items-center justify-center min-w-[90px] shadow-md backdrop-blur-sm"
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
        )}
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