"use client";
import Image from "next/image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { History, Trash2, Send, Menu } from "lucide-react";
import MessageBubble from "../Components/MessageBubble";
import { Message } from "../Types";
import CredentialsSidebar from "./CredentialsSidebar";
import ProfileSidebar from "./ProfileSidebar";
import ScheduledPostView from "./ScheduledPostsView";
import Sidebar from "./Sidebar";
import ProfileMenu from "./UI/ProfileMenu";
import RecurrenceModal, { RecurrenceSettings } from "./RecurrenceModal";
import HistoryModal from "./HistoryModal";

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
  const [userPlan, setUserPlan] = useState<{
    name: string;
    features: string[];
  } | null>(null);
  const [view, setView] = useState<"chat" | "schedule">("chat");
  const [hasRequiredCredentials, setHasRequiredCredentials] = useState(false);

  // Chat History State
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

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

  // Follow-up confirmation UI state (for 'continue' / 'change' when thread exists)
  const [followupInfo, setFollowupInfo] = useState<{
    type: "continue" | "change";
    changeInstr?: string;
  } | null>(null);
  const [followupConfirmVisible, setFollowupConfirmVisible] = useState(false);
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
        if (!token) {
          // No token, redirect to home
          window.location.href = "/";
          return;
        }

        const res = await fetch("/api/user", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          // Token is invalid or expired
          if (res.status === 401) {
            localStorage.removeItem("token");
            window.location.href = "/";
            return;
          }
          return;
        }

        const user = await res.json();
        setUserEmail(user.email);

        // Extract planId (support string or {$oid: string})
        const rawPlan = user.planId;
        const planId =
          typeof rawPlan === "string"
            ? rawPlan
            : rawPlan?.$oid || rawPlan?.toString?.() || "";

        if (planId) {
          // Fetch plan using GET (API route expects planId in path)
          const planRes = await fetch(`/api/plans/${planId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (planRes.ok) {
            const planData = await planRes.json();
            if (planData?.success && planData.plan) {
              setUserPlan(planData.plan);
            }
          } else {
            console.error("Failed to fetch plan:", await planRes.text());
          }
        } else {
          console.warn(
            "No planId available on user object, skipping plan fetch",
            user
          );
        }

        if (user.slack && user.twitter && user.facebook) {
          setHasRequiredCredentials(true);
        } else {
          setHasRequiredCredentials(false);
        }
      } catch (err) {
        console.error("Failed to fetch user", err);
        // On network error, also redirect to be safe
        localStorage.removeItem("token");
        window.location.href = "/";
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

  // Generate a unique threadId for new conversations
  const generateThreadId = useCallback(() => {
    return `thread_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 11)}`;
  }, []);

  // Save conversation to chat history
  const saveConversation = useCallback(
    async (threadId: string, messageList: Message[]) => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        // Filter out transient UI messages (hints, warnings, errors) from saved history.
        // These should still appear in the UI and be included when posting, but not persisted
        // as part of the user's conversation history.
        const isTransient = (m: Message) => {
          if (!m) return false;
          // Explicit statuses (use any to avoid strict status typing issues)
          const status = (m as any).status as string | undefined;
          if (status === "warning" || status === "error") return true;
          // Content patterns that look like UI hints
          if (typeof m.content === "string") {
            const hintRe =
              /(🔗|to publish this|please connect your|please connect|connect your)/i;
            if (hintRe.test(m.content)) return true;
          }
          return false;
        };

        const messagesToSave = messageList.filter((m) => !isTransient(m));

        // Extract platform from messagesToSave (if any)
        const platformMessage = messagesToSave.find((m) => m.platform);
        const platform = platformMessage?.platform;

        await fetch("/api/chat-history", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            threadId,
            messages: messagesToSave,
            platform,
          }),
        });

        console.log(
          `💾 Conversation saved: ${threadId} (${messageList.length} messages)`
        );
      } catch (err) {
        console.error("Failed to save conversation:", err);
        // Don't show error to user - auto-save failures should be silent
      }
    },
    []
  );

  // Fetch conversation history list
  const fetchConversations = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch("/api/chat-history", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
        console.log(
          `📚 Loaded ${data.conversations?.length || 0} conversations`
        );
      }
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Load a specific conversation
  const loadConversation = useCallback(async (threadId: string) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch(`/api/chat-history?threadId=${threadId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.conversation) {
          setMessages(data.conversation.messages);
          setCurrentThreadId(threadId);
          setHistoryModalOpen(false);
          console.log(
            `📖 Loaded conversation: ${threadId} (${data.conversation.messages.length} messages)`
          );
        }
      }
    } catch (err) {
      console.error("Failed to load conversation:", err);
    }
  }, []);

  // Delete a conversation
  const deleteConversation = useCallback(async (threadId: string) => {
    if (!confirm("Are you sure you want to delete this conversation?")) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch(`/api/chat-history?threadId=${threadId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setConversations((prev) => prev.filter((c) => c.threadId !== threadId));
        console.log(`🗑️ Deleted conversation: ${threadId}`);
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  }, []);

  const sendMessage = async (skipConfirm = false) => {
    if (!input.trim() || loading) return;
    const userInput = input.trim();

    const parseFollowup = (text: string) => {
      const t = text.trim();
      if (/^continue$/i.test(t)) return { type: "continue" as const };
      const m = t.match(/^change\b(.*)/i);
      if (m) return { type: "change" as const, changeInstr: m[1].trim() };
      return null;
    };

    const parsedFollowup = parseFollowup(userInput);
    // If this looks like a follow-up and we have an active thread, require confirmation first
    if (parsedFollowup && currentThreadId && !skipConfirm) {
      // If it's a 'change' with no instruction, prompt user to add more detail instead of confirming
      if (parsedFollowup.type === "change" && !parsedFollowup.changeInstr) {
        setFollowupInfo(parsedFollowup);
        setFollowupConfirmVisible(false);
        // Focus textarea for user to add the change instruction
        setTimeout(() => textareaRef.current?.focus(), 50);
        return;
      }
      setFollowupInfo(parsedFollowup);
      setFollowupConfirmVisible(true);
      return;
    }

    addMessage({ sender: "user", content: userInput });
    setInput("");
    setLoading(true);
    setIsTyping(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const token = localStorage.getItem("token");

      // Generate threadId for new conversations (first message)
      let threadId = currentThreadId;
      if (!threadId) {
        threadId = generateThreadId();
        setCurrentThreadId(threadId);
        console.log(`🆕 New conversation started: ${threadId}`);
      }

      const res = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: userInput,
          threadId, // Pass threadId for context
        }),
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
        const aiMessage = {
          sender: "ai" as const,
          content: data.message,
          // No status for greetings - they don't need action buttons
        };
        addMessage(aiMessage);

        // Auto-save conversation after AI response
        if (threadId) {
          // Wait a bit for state to update, then save
          setTimeout(() => {
            setMessages((currentMessages) => {
              saveConversation(threadId, currentMessages);
              return currentMessages;
            });
          }, 100);
        }
      } else if (data.recurrence) {
        // Handle recurrence - show modal with converted time
        setRecurrenceData(data.recurrenceData);
        setRecurrenceModalOpen(true);
        const aiMessage = {
          sender: "ai" as const,
          content: `🔄 I detected a recurring schedule request! Opening the recurrence settings modal for you to configure the details...`,
          platform: data.recurrenceData?.platform,
        };
        addMessage(aiMessage);

        // Auto-save conversation
        if (threadId) {
          setTimeout(() => {
            setMessages((currentMessages) => {
              saveConversation(threadId, currentMessages);
              return currentMessages;
            });
          }, 100);
        }
      } else if (data.scheduled) {
        const aiMessage = {
          sender: "ai" as const,
          content: data.message,
          status: "scheduled" as const,
          platform: data.platform,
        };
        addMessage(aiMessage);

        // Auto-save conversation
        if (threadId) {
          setTimeout(() => {
            setMessages((currentMessages) => {
              saveConversation(threadId, currentMessages);
              return currentMessages;
            });
          }, 100);
        }
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

          // Add the draft content as a normal AI message (so it becomes part of the conversation)
          const draftMessage = {
            sender: "ai" as const,
            content: data.review?.post || data.message,
            platform: data.review?.platform,
            // No status so there are no post action buttons (user cannot post without credentials)
          };
          addMessage(draftMessage);

          // Add a separate transient warning/hint message that should NOT be saved to chatHistory
          const hintMessage = {
            sender: "ai" as const,
            content: `🔗 To publish this ${platformName} post, please connect your ${platformName} account in the credentials settings first!`,
            platform: data.review?.platform,
            // Mark as warning so it will be filtered from saved history
            status: "warning" as const,
          };
          // cast to any to avoid strict status typing in Message type
          addMessage(hintMessage as any);

          // Auto-save conversation
          if (threadId) {
            setTimeout(() => {
              setMessages((currentMessages) => {
                saveConversation(threadId, currentMessages);
                return currentMessages;
              });
            }, 100);
          }
        } else {
          // User has credentials - show normal pending status with action buttons
          const aiMessage = {
            sender: "ai" as const,
            content: data.review?.post || data.message,
            status: "pending" as const,
            threadId: data.review?.threadId,
            platform: data.review?.platform,
          };
          addMessage(aiMessage);

          // Auto-save conversation
          if (threadId) {
            setTimeout(() => {
              setMessages((currentMessages) => {
                saveConversation(threadId, currentMessages);
                return currentMessages;
              });
            }, 100);
          }
        }
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Sorry, I encountered an error processing your request.";
      const aiMessage = {
        sender: "ai" as const,
        content: message,
        status: "error" as const,
      };
      addMessage(aiMessage);

      // Auto-save conversation even on errors
      if (currentThreadId) {
        setTimeout(() => {
          setMessages((currentMessages) => {
            saveConversation(currentThreadId, currentMessages);
            return currentMessages;
          });
        }, 100);
      }
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

  const formatNextOccurrence = (timestamp: string) => {
    const date = new Date(timestamp);

    // Manual formatting to guarantee AM/PM suffix and consistent output
    const weekday = date.toLocaleString("en-US", { weekday: "short" });
    const month = date.toLocaleString("en-US", { month: "short" });
    const day = date.getDate();
    const year = date.getFullYear();
    let hour = date.getHours();
    const minute = date.getMinutes();
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12;
    if (hour === 0) hour = 12;
    const minuteStr = minute.toString().padStart(2, "0");

    return `${weekday}, ${month} ${day}, ${year}, ${hour}:${minuteStr} ${ampm}`;
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

      // Use backend message but remove any existing 'Next post' line and replace
      // it with a localized version built on the client.
      const raw = data.message || "Recurring schedule created.";
      // Remove any line that contains 'Next post' (Emoji or plain)
      const lines = raw
        .split(/\r?\n/)
        .filter((l: string) => !/next post/i.test(l));
      let message = lines.join("\n").trim();
      if (data.nextOccurrence) {
        const localNext = formatNextOccurrence(data.nextOccurrence);
        message = `${message}\n\n🔜 Next post (local): ${localNext}`;
      }

      addMessage({ sender: "ai", content: message, status: "scheduled" });
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
      setCurrentThreadId(null); // Reset thread ID for new conversation
      console.log("🗑️ Chat cleared - ready for new conversation");
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

      {/* History Modal */}
      <HistoryModal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        conversations={conversations}
        loadingHistory={loadingHistory}
        onLoadConversation={loadConversation}
        onDeleteConversation={deleteConversation}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative transition-all duration-300">
        {/* Header (fixed) */}
        <div className="fixed top-0 left-0 w-full z-30 bg-gray-950 border-b border-gray-700/50">
          <div className="max-w-[1600px] mx-auto p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center relative">
                <Image
                  src="/SaMMy.png"
                  alt="Logo"
                  fill
                  style={{ objectFit: "cover" }}
                />
              </div>
              <div className="flex flex-col">
                <div className="flex flex-col gap-1">
                  {userPlan ? (
                    <div className="flex items-center">
                      <span className="text-xs font-medium px-3 py-1 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg">
                        {userPlan.name}
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400">Loading plan...</div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* History Button */}
              <button
                onClick={() => {
                  setHistoryModalOpen(true);
                  fetchConversations();
                }}
                className="text-xs px-3 py-1.5 rounded-lg text-white hover:bg-gray-700/50 transition-colors flex items-center gap-2"
                title="Chat History"
              >
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">History</span>
              </button>

              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="text-xs px-3 py-1.5 rounded-lg text-white hover:bg-gray-700/50 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              )}

              {/* Sidebar Menu Button */}
              <button
                onClick={toggleSidebar}
                className="px-3 py-1.5 rounded-lg text-white hover:bg-gray-700/50 transition-colors flex items-center justify-center"
                title="Menu"
              >
                <Menu className="w-4 h-4" />
              </button>

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
            </div>
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 flex flex-col overflow-y-auto overscroll-y-contain p-4 pt-[80px] pb-40 sm:pb-44 scroll-pb-32 bg-gray-950">
          <div className="max-w-[1200px] mx-auto w-full">
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
          </div>
        </div>

        {/* Input Area - Full Width Background */}
        <div className="fixed bottom-0 left-0 w-full z-20 bg-gray-950">
          <div className="max-w-[1200px] mx-auto px-2 sm:px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4">
            {/* Follow-up confirmation banner (continue / change) */}
            {followupConfirmVisible && followupInfo && (
              <div className="mb-2 max-w-[1200px] mx-auto px-2 sm:px-4">
                <div className="rounded-lg p-2 bg-gray-850 border border-gray-700 text-white flex items-center justify-between">
                  <div className="text-sm">
                    {followupInfo.type === "continue" ? (
                      <>
                        You're about to continue the last draft in this
                        conversation. This will generate a new version based on
                        the previous AI draft.
                      </>
                    ) : (
                      <>
                        You're about to modify the last draft
                        {followupInfo.changeInstr
                          ? `: "${followupInfo.changeInstr}"`
                          : "."}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        // Hide banner and proceed with sending (skip confirm)
                        setFollowupConfirmVisible(false);
                        setTimeout(() => sendMessage(true), 50);
                      }}
                      className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-3 py-1 rounded text-sm"
                    >
                      Continue
                    </button>
                    <button
                      onClick={() => {
                        setFollowupConfirmVisible(false);
                        setFollowupInfo(null);
                      }}
                      className="px-3 py-1 rounded bg-gray-800 text-white text-sm border border-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* If user typed 'change' but provided no instruction, prompt to add details */}
            {followupInfo?.type === "change" && !followupInfo.changeInstr && (
              <div className="mb-2 max-w-[1200px] mx-auto px-2 sm:px-4 text-sm text-gray-400">
                Please specify how you'd like the post changed after "change".
              </div>
            )}

            <div className="flex flex-row items-end gap-2 w-full">
              <textarea
                ref={textareaRef}
                className="flex-1 rounded-3xl px-4 py-3 resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm bg-gray-900 text-white placeholder-white/60 min-h-[48px] text-left"
                placeholder={
                  hasRequiredCredentials
                    ? "Instruct SaMMy..."
                    : "Instruct SaMMy... (connect platforms)"
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
                onClick={() => sendMessage()}
                style={{ touchAction: "manipulation" }}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    <span className="text-sm hidden sm:inline">Send</span>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
