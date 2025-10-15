"use client";
// Icons handled within ProfileMenu component
import Image from "next/image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import MessageBubble from "../Components/MessageBubble";
import { Message } from "../Types";
import CredentialsSidebar from "./CredentialsSidebar";
import ProfileSidebar from "./ProfileSidebar";
import ScheduledPostView from "./ScheduledPostsView";
import Sidebar from "./Sidebar";
import ProfileMenu from "./UI/ProfileMenu";
import RecurrenceModal, { RecurrenceSettings } from "./RecurrenceModal";

export default function ChatBot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [credentialsSidebarOpen, setCredentialsSidebarOpen] = useState(false);
  const [profileSidebarOpen, setProfileSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [view, setView] = useState<"chat" | "schedule">("chat");
  const [hasRequiredCredentials, setHasRequiredCredentials] = useState(false);

  // Recurrence Modal State
  const [recurrenceModalOpen, setRecurrenceModalOpen] = useState(false);
  const [recurrenceData, setRecurrenceData] = useState<{
    frequency: "daily" | "weekly" | "monthly";
    time: string;
    timestamp: string;
    platform: string;
    prompt: string;
    detectedDays?: number[];
  } | null>(null);

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

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const res = await fetch("/api/user", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) return;

        const user = await res.json();

        // Set user email for profile dropdown
        setUserEmail(user.email);

        if (user.slack && user.twitter && user.facebook) {
          setHasRequiredCredentials(true);
        } else {
          setHasRequiredCredentials(false);
        }
      } catch (err) {
        console.error("Failed to fetch user", err);
      }
    };

    fetchUser();
  }, []);

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

  const handleAttachmentsChange = useCallback(
    (id: string, attachments: File[]) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === id ? { ...msg, attachments } : msg))
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

      // Handle different response types
      if (data.greeting) {
        addMessage({
          sender: "ai",
          content: data.message,
          // No status for greetings - they don't need action buttons
        });
      } else if (data.recurrence) {
        // Handle recurrence - show modal with converted time
        setRecurrenceData(data.recurrenceData);
        setRecurrenceModalOpen(true);
        addMessage({
          sender: "ai",
          content: `🔄 I detected a recurring schedule request! Opening the recurrence settings modal for you to configure the details...`,
        });
      } else if (data.scheduled) {
        addMessage({
          sender: "ai",
          content: data.message,
          status: "scheduled",
        });
      } else {
        // Check if user has credentials for the platform
        if (data.review?.hasCredentials === false) {
          // User doesn't have credentials for this platform
          const platformName =
            data.review?.platform === "twitter"
              ? "Twitter"
              : data.review?.platform === "facebook"
              ? "Facebook"
              : data.review?.platform;
          addMessage({
            sender: "ai",
            content: `${data.review?.post}\n\n🔗 To publish this ${platformName} post, please connect your ${platformName} account in the credentials settings first!`,
            // No status - no action buttons since they can't post
          });
        } else {
          // User has credentials - show normal pending status with action buttons
          addMessage({
            sender: "ai",
            content: data.review?.post || data.message,
            status: "pending",
            threadId: data.review?.threadId,
            platform: data.review?.platform,
          });
        }
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Sorry, I encountered an error processing your request.";
      addMessage({
        sender: "ai",
        content: message,
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
      const formData = new FormData();
      formData.append("post", draft.content);
      if (draft.platform) {
        formData.append("platform", draft.platform);
      }
      formData.append("threadId", draft.threadId);

      console.log("=== ChatBot Debug ===");
      console.log("Draft attachments:", draft.attachments?.length || 0);

      if (draft.attachments) {
        draft.attachments.forEach((file, index) => {
          console.log(
            `Adding attachment ${index}: ${file.name}, size: ${file.size}, type: ${file.type}`
          );
          formData.append("attachments", file);
        });
      }

      console.log("FormData entries:");
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          console.log(
            `${key}: File(${value.name}, ${value.size} bytes, ${value.type})`
          );
        } else {
          console.log(`${key}: ${value}`);
        }
      }

      const res = await fetch("/api/agent", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      });

      const data = await res.json();
      console.log("Post response:", { status: res.status, data }); // Debug log

      // Check for various error conditions
      if (!res.ok || data.error || data.success === false) {
        updateMessageStatus(id, "error");
        addMessage({
          sender: "ai",
          content:
            data.error ||
            `Server responded with ${res.status}: ${res.statusText}`,
          status: "error",
        });
        return;
      }

      // Verify that the post was actually successful
      if (!data.posted && !data.success) {
        updateMessageStatus(id, "error");
        addMessage({
          sender: "ai",
          content:
            "The post may not have been published successfully. Please check your social media account to verify.",
          status: "error",
        });
        return;
      }

      updateMessageStatus(id, "posted");
    } catch (err: unknown) {
      console.error("Post request failed:", err); // Debug log
      updateMessageStatus(id, "error");
      const message =
        err instanceof Error
          ? `Network error: ${err.message}`
          : "Failed to post message due to a network error. Please check your connection and try again.";
      addMessage({
        sender: "ai",
        content: message,
        status: "error",
      });
    }
  };

  const handleRejectDraft = (id: string) => {
    updateMessageStatus(id, "rejected");
  };

  const handleRecurrenceConfirm = async (settings: RecurrenceSettings) => {
    setRecurrenceModalOpen(false);
    setLoading(true);

    try {
      const token = localStorage.getItem("token");

      // Send recurrence settings to backend API endpoint
      const res = await fetch("/api/recurring-posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        addMessage({
          sender: "ai",
          content:
            data.error ||
            `Failed to create recurring schedule: ${res.statusText}`,
          status: "error",
        });
        return;
      }

      // Use the formatted message from the backend
      addMessage({
        sender: "ai",
        content: data.message,
        status: "scheduled",
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to create recurring schedule.";
      addMessage({
        sender: "ai",
        content: message,
        status: "error",
      });
    } finally {
      setLoading(false);
      setRecurrenceData(null);
    }
  };

  const handleRecurrenceCancel = () => {
    setRecurrenceModalOpen(false);
    setRecurrenceData(null);
    addMessage({
      sender: "ai",
      content:
        "Recurring schedule setup canceled. Feel free to ask me anything else! 😊",
    });
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
  const handleManageCredentials = () => {
    setCredentialsSidebarOpen(true);
    setSidebarOpen(false);
  };

  // Profile dropdown handlers
  const toggleProfileDropdown = () => {
    setProfileDropdownOpen(!profileDropdownOpen);
  };

  const handleProfileSettings = () => {
    setProfileSidebarOpen(true);
    setProfileDropdownOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUserEmail(null);
    setProfileDropdownOpen(false);
    window.location.href = "/";
  };

  // getInitials now handled inside ProfileMenu component

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (profileDropdownOpen && !target.closest(".profile-dropdown")) {
        setProfileDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileDropdownOpen]);

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
        onManageCredentials={handleManageCredentials}
      />

      {/* Credentials Sidebar */}
      <CredentialsSidebar
        isOpen={credentialsSidebarOpen}
        onClose={() => setCredentialsSidebarOpen(false)}
      />

      {/* Profile Sidebar */}
      <ProfileSidebar
        isOpen={profileSidebarOpen}
        onClose={() => setProfileSidebarOpen(false)}
      />

      {/* Recurrence Modal */}
      {recurrenceData && (
        <RecurrenceModal
          isOpen={recurrenceModalOpen}
          onClose={handleRecurrenceCancel}
          onConfirm={handleRecurrenceConfirm}
          frequency={recurrenceData.frequency}
          time={recurrenceData.time}
          platform={recurrenceData.platform}
          prompt={recurrenceData.prompt}
          detectedDays={recurrenceData.detectedDays}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative transition-all duration-300">
        {/* Header (fixed) */}
        <div className="fixed top-0 left-0 w-full z-30 p-4 bg-gradient-to-r from-gray-900/90 to-gray-800/90 backdrop-blur-xl border-b border-gray-700/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center relative">
              <Image
                src="/SaMMy.png"
                alt="Logo"
                fill
                style={{ objectFit: "cover" }}
              />
            </div>
            <div>
              <h1 className="font-bold text-white text-sm sm:text-base">
                SaMMy
              </h1>
              <p className="text-xs text-white/60">Social Media AI Agent</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="text-xs px-3 py-1.5 rounded-lg bg-rose-700/50 text-white hover:bg-rose-700 transition-colors"
              >
                Clear
              </button>
            )}

            {/* User Profile Dropdown */}
            {userEmail && (
              <ProfileMenu
                email={userEmail}
                open={profileDropdownOpen}
                onToggle={toggleProfileDropdown}
                onProfileSettings={handleProfileSettings}
                onLogout={handleLogout}
              />
            )}

            <button
              onClick={toggleSidebar}
              className="px-3 py-1.5 rounded-lg bg-gray-700/50 text-white hover:bg-gray-700 transition-colors flex items-center justify-center"
            >
              <span className="text-sm">◧</span>
            </button>
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 flex flex-col overflow-y-auto overscroll-y-contain p-4 pt-[80px] pb-40 sm:pb-44 scroll-pb-32 bg-gradient-to-b from-gray-900/30 to-gray-900/10">
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
                    <li>
                      • &quot;Hello!&quot; or &quot;What can you do?&quot;
                    </li>
                    <li>
                      • &quot;Create a tweet about launching our new
                      branch&quot;
                    </li>
                    <li>
                      • &quot;Write a facebook post about our opened
                      intake&quot;
                    </li>
                    <li>
                      • &quot;Draft a twitter post for tomorrow at 2pm&quot;
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
              onAttachmentsChange={handleAttachmentsChange}
            />
          ))}

          {isTyping && (
            <div className="flex justify-start mt-3 mb-4">
              <div className="max-w-full sm:max-w-[80%] rounded-2xl p-3 bg-gray-800/80 text-white backdrop-blur-sm border border-gray-700/50">
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
          <div className="fixed bottom-0 left-0 w-full h-64 sm:h-72 bg-gradient-to-t from-gray-950 via-gray-950/90 via-gray-950/50 to-transparent pointer-events-none z-0 sm:z-0" />
        </div>

        {/* Input Area */}
        <div className="w-full max-w-full sm:max-w-2xl fixed bottom-0 left-1/2 transform -translate-x-1/2 px-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))] z-20">
          <div className="flex flex-row items-end gap-2 w-full">
            <textarea
              ref={textareaRef}
              className="flex-1 rounded-3xl px-4 py-3 resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm bg-gray-900 text-white placeholder-white/60 min-h-[48px] text-left"
              placeholder={
                hasRequiredCredentials
                  ? "Instruct SaMMy..."
                  : "Instruct SaMMy... (configure sources for curated posts)"
              }
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              style={{
                touchAction: "manipulation",
                lineHeight: "1.5",
                paddingTop: "0.75rem",
                paddingBottom: "0.75rem",
              }}
            />

            <button
              className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-3 sm:px-4 py-3 min-h-[48px] rounded-3xl hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50 flex items-center justify-center shadow-md min-w-[70px] sm:min-w-[90px]"
              disabled={loading || !input.trim()}
              onClick={sendMessage}
              style={{ touchAction: "manipulation" }}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-sm">Send</span>
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
