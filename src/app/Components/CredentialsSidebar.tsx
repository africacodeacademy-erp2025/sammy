"use client";

import React, { useState, useEffect } from "react";
import Badge from "./UI/Badge";
import Separator from "./UI/Separator";
import Button from "./UI/Button";
import InputGroup from "./UI/InputGroup";
import CardContent from "./UI/CardContent";
import CardTitle from "./UI/CardTitle";
import CardHeader from "./UI/CardHeader";
import Card from "./UI/Card";
import TestButton from "./UI/TestButton";

// ========== Types ==========
type Platform = "slack" | "twitter" | "facebook";
type OAuthPlatform = "twitter" | "facebook";

interface SlackCredentials {
  userToken: string;
  workspaceId: string;
  botToken: string;
  channels: string;
}

interface Credentials {
  slack: SlackCredentials;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SlackMessage {
  channel: string;
  text?: string;
  user?: string;
  ts?: string;
}

interface PlatformStatus {
  slack: boolean;
  twitter: boolean;
  facebook: boolean;
}

interface LoadingState {
  slack: boolean;
  twitter: boolean;
  facebook: boolean;
  slackSaving: boolean;
  slackGetting: boolean;
}

interface MessageState {
  slack: string;
  twitter: string;
  facebook: string;
  slackGetting: string;
}

interface PlatformConfig {
  name: string;
  badge: string;
  color: string;
  badgeColor: string;
  fields: Array<{
    id: string;
    label: string;
    type: "text" | "password";
    placeholder: string;
    key: string;
  }>;
  helpContent: React.JSX.Element;
  testBodyMapper: (creds: SlackCredentials) => Record<string, string>;
  pullingEndpoint?: string;
}

// ========== Constants ==========
const OAUTH_PLATFORMS: Record<
  OAuthPlatform,
  { name: string; description: string }
> = {
  twitter: {
    name: "Twitter/X",
    description:
      "Connect your Twitter/X account to enable posting and reading tweets.",
  },
  facebook: {
    name: "Facebook",
    description:
      "Connect your Facebook page to enable posting and reading content.",
  },
} as const;

// Platform configurations - Only Slack uses manual configuration
const SLACK_CONFIG: PlatformConfig = {
  name: "Slack",
  badge: "API",
  color: "indigo",
  badgeColor: "bg-indigo-500/20 text-indigo-300",
  fields: [
    {
      id: "slack-user-token",
      label: "User Token",
      type: "password",
      placeholder: "xoxp-...",
      key: "userToken",
    },
    {
      id: "slack-workspace-id",
      label: "Workspace ID",
      type: "text",
      placeholder: "T1234567890",
      key: "workspaceId",
    },
    {
      id: "slack-bot-token",
      label: "Bot Token",
      type: "password",
      placeholder: "xoxb-...",
      key: "botToken",
    },
    {
      id: "slack-channels",
      label: "Channels",
      type: "text",
      placeholder: "general,announcements",
      key: "channels",
    },
  ],
  testBodyMapper: (creds) => ({
    workspaceId: creds.workspaceId,
    botToken: creds.botToken,
    userToken: creds.userToken,
    channels: creds.channels,
  }),
  helpContent: (
    <div className="p-4 text-sm text-gray-200 space-y-3">
      <h3 className="text-lg font-semibold text-indigo-300">
        How to get Slack tokens
      </h3>
      <ol className="list-decimal list-inside space-y-1">
        <li>
          Go to{" "}
          <a
            href="https://api.slack.com/apps"
            target="_blank"
            rel="noreferrer"
            className="text-indigo-400 underline"
          >
            Slack API Apps
          </a>
          .
        </li>
        <li>
          Create a new app and add a <strong>Bot Token</strong> or{" "}
          <strong>User Token</strong>.
        </li>
        <li>
          Under <strong>OAuth & Permissions</strong>, configure the scopes:
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>
              <strong>Bot Token Scopes:</strong> <code>chat:write</code>,{" "}
              <code>channels:read</code>, <code>channels:history</code>,{" "}
              <code>groups:read</code>, <code>im:read</code>,{" "}
              <code>mpim:read</code>
            </li>
            <li>
              <strong>User Token Scopes:</strong> <code>channels:read</code>,{" "}
              <code>channels:history</code>, <code>groups:read</code>,{" "}
              <code>im:read</code>, <code>mpim:read</code>
            </li>
          </ul>
        </li>
        <li>Install the app to your workspace.</li>
        <li>
          Copy the{" "}
          <code className="bg-gray-800 px-1">Bot Token (xoxb-...)</code> and{" "}
          <code className="bg-gray-800 px-1">User Token (xoxp-...)</code>.
        </li>
        <li>Find your Workspace ID in Slack's URL (format T123456).</li>
      </ol>
    </div>
  ),
};

/**
 * CredentialsSidebar Component
 *
 * Manages platform credentials for Slack (manual), Twitter, and Facebook (OAuth).
 * Provides a sidebar interface for connecting and testing platform integrations.
 *
 * @param {SidebarProps} props - Component props
 * @param {boolean} props.isOpen - Whether the sidebar is currently open
 * @param {() => void} props.onClose - Callback to close the sidebar
 */
export default function CredentialsSidebar({ isOpen, onClose }: SidebarProps) {
  // State management
  const [hasCredentials, setHasCredentials] = useState<PlatformStatus>({
    slack: false,
    twitter: false,
    facebook: false,
  });
  const [savedSlackChannels, setSavedSlackChannels] = useState<string[]>([]);
  const [credentials, setCredentials] = useState<Credentials>({
    slack: { userToken: "", workspaceId: "", botToken: "", channels: "" },
  });
  const [loading, setLoading] = useState<LoadingState>({
    slack: false,
    twitter: false,
    facebook: false,
    slackSaving: false,
    slackGetting: false,
  });
  const [messages, setMessages] = useState<MessageState>({
    slack: "",
    twitter: "",
    facebook: "",
    slackGetting: "",
  });
  const [slackMessages, setSlackMessages] = useState<SlackMessage[]>([]);
  const [helpPage, setHelpPage] = useState<null | "slack">(null);
  const [verified, setVerified] = useState<PlatformStatus>({
    slack: false,
    twitter: false,
    facebook: false,
  });

  // Check URL parameters for OAuth success/error messages
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);

    // Twitter success
    if (params.get("twitter_connected") === "true") {
      setMessages((prev) => ({
        ...prev,
        twitter: "Successfully connected to Twitter!",
      }));
      setHasCredentials((prev) => ({ ...prev, twitter: true }));
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    }

    // Twitter error
    const twitterError = params.get("twitter_error");
    if (twitterError) {
      const errorMessages: Record<string, string> = {
        missing_params: "Missing authorization parameters",
        invalid_state: "Invalid state parameter",
        config_error: "Twitter OAuth not properly configured",
        token_exchange_failed: "Failed to exchange authorization code",
        no_access_token: "No access token received",
        callback_error: "An error occurred during authorization",
      };
      setMessages((prev) => ({
        ...prev,
        twitter: errorMessages[twitterError] || `Error: ${twitterError}`,
      }));
      window.history.replaceState({}, "", window.location.pathname);
    }

    // Facebook success
    if (params.get("facebook_connected") === "true") {
      setMessages((prev) => ({
        ...prev,
        facebook: "Successfully connected to Facebook!",
      }));
      setHasCredentials((prev) => ({ ...prev, facebook: true }));
      window.history.replaceState({}, "", window.location.pathname);
    }

    // Facebook error
    const facebookError = params.get("facebook_error");
    if (facebookError) {
      const errorMessages: Record<string, string> = {
        missing_params: "Missing authorization parameters",
        invalid_state: "Invalid state parameter",
        config_error: "Facebook OAuth not properly configured",
        token_exchange_failed: "Failed to exchange authorization code",
        no_access_token: "No access token received",
        pages_fetch_failed: "Failed to fetch Facebook pages",
        callback_error: "An error occurred during authorization",
      };
      setMessages((prev) => ({
        ...prev,
        facebook: errorMessages[facebookError] || `Error: ${facebookError}`,
      }));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Helper function to fetch platform credentials
  const fetchPlatformCredentials = async (
    platform: Platform
  ): Promise<boolean> => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return false;

      const res = await fetch(`/api/integrations/${platform}/connect`, {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        const platformData = data[platform];

        if (platform === "twitter") {
          // Check for OAuth 2.0 tokens (new method)
          return !!(platformData?.accessToken && platformData?.refreshToken);
        } else if (platform === "facebook") {
          // Check for OAuth tokens
          return !!platformData?.accessToken;
        }
      }
      return false;
    } catch (error) {
      console.error(`Error fetching ${platform} credentials:`, error);
      return false;
    }
  };

  useEffect(() => {
    async function fetchAllCredentials() {
      if (!isOpen) return;

      const [twitterHasCreds, facebookHasCreds] = await Promise.all([
        fetchPlatformCredentials("twitter"),
        fetchPlatformCredentials("facebook"),
      ]);

      setHasCredentials((prev) => ({
        ...prev,
        twitter: twitterHasCreds,
        facebook: facebookHasCreds,
      }));
    }
    fetchAllCredentials();
  }, [isOpen]);

  useEffect(() => {
    async function fetchUserCreds() {
      if (!isOpen) return;
      try {
        const res = await fetch("/api/user", {
          headers: {
            authorization: "Bearer " + localStorage.getItem("token"),
          },
        });
        if (res.ok) {
          const data = await res.json();
          const hasSlack = !!(
            data.slack &&
            (data.slack.userToken || data.slack.botToken)
          );
          setHasCredentials((prev) => ({ ...prev, slack: hasSlack }));

          // Parse channels from user data
          if (data.slack?.channels) {
            const channels = Array.isArray(data.slack.channels)
              ? data.slack.channels
              : String(data.slack.channels)
                  .split(",")
                  .map((c: string) => c.trim())
                  .filter(Boolean);
            setSavedSlackChannels(channels);
          } else {
            setSavedSlackChannels([]);
          }
        } else {
          setHasCredentials((prev) => ({ ...prev, slack: false }));
          setSavedSlackChannels([]);
        }
      } catch {
        setHasCredentials((prev) => ({ ...prev, slack: false }));
        setSavedSlackChannels([]);
      }
    }
    fetchUserCreds();
  }, [isOpen]);

  // Handle OAuth connection for Twitter and Facebook
  const handleOAuthConnect = async (platform: OAuthPlatform) => {
    setLoading((prev) => ({ ...prev, [platform]: true }));
    setMessages((prev) => ({
      ...prev,
      [platform]: "Initiating OAuth...",
    }));

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      const res = await fetch(`/api/integrations/${platform}/oauth`, {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (res.ok && data.authUrl) {
        // Redirect to OAuth provider
        window.location.href = data.authUrl;
      } else {
        throw new Error(data.error || "Failed to initiate OAuth");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to connect. Please try again.";
      console.error(`Failed to initiate ${platform} OAuth:`, err);
      setMessages((prev) => ({
        ...prev,
        [platform]: errorMessage,
      }));
      setLoading((prev) => ({ ...prev, [platform]: false }));
    }
  };

  // Helper to get auth token
  const getAuthToken = (): string | null => {
    const token = localStorage.getItem("token");
    if (!token) {
      console.warn("Authentication token not found");
    }
    return token;
  };

  // Helper to create auth headers
  const getAuthHeaders = (): HeadersInit => {
    const token = getAuthToken();
    return {
      "Content-Type": "application/json",
      ...(token && { authorization: `Bearer ${token}` }),
    };
  };

  // Helper functions
  const handleInputChange = (
    platform: keyof Credentials,
    field: string,
    value: string
  ) => {
    setCredentials((prev) => ({
      ...prev,
      [platform]: { ...prev[platform], [field]: value },
    }));
  };

  const getButtonText = (
    platform: Platform,
    isLoading: boolean,
    message: string
  ) => {
    if (!isLoading) return "Test & Save";

    if (message && message.includes("Testing")) return "Testing...";
    if (message && message.includes("Saving")) return "Saving...";
    if (message && message.includes("Collecting")) return "Collecting posts...";
    if (message && message.includes("Getting")) return "Getting messages...";

    return "Processing...";
  };

  const updateCredentialStatus = (platform: Platform, status: boolean) => {
    setHasCredentials((prev) => ({ ...prev, [platform]: status }));
  };

  const clearCredentialFields = (platform: Platform) => {
    // Only clear Slack fields (Twitter and Facebook use OAuth)
    if (platform === "slack") {
      setCredentials((prev) => ({
        ...prev,
        slack: { userToken: "", workspaceId: "", botToken: "", channels: "" },
      }));
    }
  };

  const handleSlackPostSave = async (body: Record<string, string>) => {
    setLoading((prev) => ({ ...prev, slackSaving: true }));
    setMessages((prev) => ({ ...prev, slack: "Saving..." }));

    try {
      const saveRes = await fetch("/api/integrations/slack/connect", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });

      const saveData = await saveRes.json();
      setMessages((prev) => ({
        ...prev,
        slack: saveData.message || saveData.error || "Unknown response",
      }));

      // After saving, fetch Slack messages
      setLoading((prev) => ({ ...prev, slackGetting: true }));
      setMessages((prev) => ({ ...prev, slackGetting: "Getting messages..." }));

      try {
        const msgRes = await fetch("/api/sources/slack", {
          headers: getAuthHeaders(),
        });
        const msgData = await msgRes.json();
        setSlackMessages(msgData.messages || []);
        setMessages((prev) => ({
          ...prev,
          slackGetting: msgData.success
            ? ""
            : msgData.error || "Failed to get messages",
        }));
      } catch (err) {
        console.error("Failed to fetch Slack messages:", err);
        setMessages((prev) => ({
          ...prev,
          slackGetting: "Failed to get messages",
        }));
      }

      setLoading((prev) => ({ ...prev, slackGetting: false }));
    } catch (err) {
      console.error("Failed to save Slack credentials:", err);
      setMessages((prev) => ({ ...prev, slack: "Failed to save credentials" }));
    }

    setLoading((prev) => ({ ...prev, slackSaving: false }));
  };

  const handlePlatformPostSave = async (
    platform: Platform,
    body: Record<string, string>
  ) => {
    const pullingEndpoint =
      platform === "twitter"
        ? "/api/pulling/x-pulling"
        : "/api/pulling/fb-pulling";

    if (platform === "slack") return; // Slack uses different endpoint

    setMessages((prev) => ({ ...prev, [platform]: "Saving..." }));

    try {
      const saveRes = await fetch(`/api/integrations/${platform}/connect`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });

      const saveData = await saveRes.json();
      setMessages((prev) => ({
        ...prev,
        [platform]:
          saveData.message ||
          saveData.error ||
          "Credentials saved successfully!",
      }));

      clearCredentialFields(platform);
      updateCredentialStatus(platform, true);

      // Collect past posts
      setMessages((prev) => ({
        ...prev,
        [platform]: "Collecting past posts...",
      }));

      try {
        const postsRes = await fetch(pullingEndpoint, {
          headers: getAuthHeaders(),
        });
        const postsData = await postsRes.json();

        const resultMessage = postsData.success
          ? `Credentials saved! Collected ${
              postsData.posts?.length || 0
            } past posts.`
          : "Credentials saved, but failed to collect past posts.";

        setMessages((prev) => ({ ...prev, [platform]: resultMessage }));
      } catch (err) {
        setMessages((prev) => ({
          ...prev,
          [platform]: "Credentials saved, but failed to collect past posts.",
        }));
      }
    } catch (err) {
      setMessages((prev) => ({
        ...prev,
        [platform]: "Failed to save credentials",
      }));
    }
  };

  const handleTest = async (
    platform: Platform,
    body: Record<string, string>
  ) => {
    setLoading((prev) => ({ ...prev, [platform]: true }));
    setMessages((prev) => ({ ...prev, [platform]: "Testing..." }));

    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("Authentication required. Please log in again.");
      }

      const res = await fetch(`/api/integrations/${platform}/test`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });

      const data = await res.json();
      const success = res.ok && !data.error;

      setMessages((prev) => ({
        ...prev,
        [platform]: data.message || data.error || "Unknown response",
      }));

      setVerified((prev) => ({ ...prev, [platform]: success }));

      if (success) {
        if (platform === "slack") {
          await handleSlackPostSave(body);
        } else {
          await handlePlatformPostSave(platform, body);
        }
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to connect. Please try again.";
      console.error(`Failed to test ${platform} credentials:`, err);
      setMessages((prev) => ({
        ...prev,
        [platform]: errorMessage,
      }));
      setVerified((prev) => ({ ...prev, [platform]: false }));
    } finally {
      setLoading((prev) => ({ ...prev, [platform]: false }));
    }
  };

  // Reusable OAuth Card Component
  const OAuthCard = ({ platform }: { platform: OAuthPlatform }) => {
    const config = OAUTH_PLATFORMS[platform];
    const isConnected = hasCredentials[platform];
    const isLoading = loading[platform];
    const message = messages[platform];
    const badgeColor =
      platform === "twitter"
        ? "bg-sky-500/20 text-sky-300"
        : "bg-blue-500/20 text-blue-300";
    const titleColor =
      platform === "twitter" ? "text-sky-400" : "text-blue-400";
    const connectedColor =
      platform === "twitter" ? "text-sky-300" : "text-blue-300";

    // Determine if message is success or error
    const isSuccess =
      message &&
      (message.includes("Successfully") || message.includes("connected"));
    const messageColor = isSuccess ? "text-green-400" : "text-red-400";

    return (
      <Card>
        <CardHeader>
          <CardTitle
            className={`flex items-center gap-2 ${titleColor} text-sm sm:text-base`}
          >
            {config.name}{" "}
            <Badge className={`${badgeColor} text-xs sm:text-sm`}>OAuth</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          {isConnected ? (
            <div
              className="bg-gray-800 rounded p-4 text-center"
              role="status"
              aria-label={`${config.name} connected successfully`}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-2xl" aria-hidden="true">
                  ✓
                </span>
                <span className={`${connectedColor} font-bold`}>
                  {config.name} Connected
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Your {config.name} account is connected and ready to use.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-400">{config.description}</p>
              <TestButton
                className="w-full"
                loading={isLoading}
                disabled={isLoading}
                onClick={() => handleOAuthConnect(platform)}
                text={
                  isLoading ? "Connecting..." : `Connect ${config.name} Account`
                }
                aria-label={`Connect your ${config.name} account`}
              />
              {message && (
                <p
                  className={`mt-1 text-xs ${messageColor}`}
                  role="alert"
                  aria-live="polite"
                >
                  {message}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderHelpContent = () => {
    switch (helpPage) {
      case "slack":
        return (
          <div className="p-4 text-sm text-gray-200 space-y-3">
            <h3 className="text-lg font-semibold text-indigo-300">
              How to get Slack tokens
            </h3>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                Go to{" "}
                <a
                  href="https://api.slack.com/apps"
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-400 underline"
                >
                  Slack API Apps
                </a>
                .
              </li>
              <li>
                Create a new app and add a <strong>Bot Token</strong> or{" "}
                <strong>User Token</strong>.
              </li>
              <li>
                Under <strong>OAuth & Permissions</strong>, configure the
                scopes:
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>
                    <strong>Bot Token Scopes:</strong> <code>chat:write</code>,{" "}
                    <code>channels:read</code>, <code>channels:history</code>,{" "}
                    <code>groups:read</code>, <code>im:read</code>,{" "}
                    <code>mpim:read</code>
                  </li>
                  <li>
                    <strong>User Token Scopes:</strong>{" "}
                    <code>channels:read</code>, <code>channels:history</code>,{" "}
                    <code>groups:read</code>, <code>im:read</code>,{" "}
                    <code>mpim:read</code>
                  </li>
                </ul>
              </li>
              <li>Install the app to your workspace.</li>
              <li>
                Copy the{" "}
                <code className="bg-gray-800 px-1">Bot Token (xoxb-...)</code>{" "}
                and{" "}
                <code className="bg-gray-800 px-1">User Token (xoxp-...)</code>.
              </li>
              <li>Find your Workspace ID in Slack’s URL (format T123456).</li>
            </ol>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 sm:hidden"
          onClick={onClose}
          role="button"
          tabIndex={0}
          aria-label="Close credentials sidebar"
          onKeyDown={(e) => e.key === "Escape" && onClose()}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 right-0 h-full bg-gray-900/95 backdrop-blur-xl border-l border-gray-700/50
        transform transition-transform duration-300 z-50 shadow-2xl
        w-full sm:w-[40rem] flex
        ${isOpen ? "translate-x-0" : "translate-x-full"}`}
        aria-label="Credentials management sidebar"
        role="complementary"
      >
        {/* Help Panel (desktop) */}
        <div
          className="hidden sm:block w-1/2 border-r border-gray-700/50 overflow-y-auto"
          role="region"
          aria-label="Help documentation"
        >
          {helpPage ? (
            renderHelpContent()
          ) : (
            <div className="p-4 text-gray-400 text-sm">
              <p>
                Select a <span className="text-white">? help icon</span> in any
                card to see setup instructions.
              </p>
            </div>
          )}
        </div>

        {/* Credentials Form */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="p-3 sm:p-4 border-b border-gray-700/50 flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-semibold text-white">
              Credentials
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700/50"
              aria-label="Close credentials sidebar"
            >
              ✕
            </button>
          </header>

          {/* Scrollable Content */}
          <div className="p-3 sm:p-4 space-y-4 sm:space-y-6 overflow-y-auto h-[calc(100%-4rem)]">
            {/* Slack */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-indigo-400 text-sm sm:text-base">
                  Slack{" "}
                  <Badge className="bg-indigo-500/20 text-indigo-300 text-xs sm:text-sm">
                    API
                  </Badge>
                  <button
                    onClick={() => setHelpPage("slack")}
                    className="ml-auto text-indigo-300 hover:text-white text-lg font-bold"
                    title="How to get Slack credentials?"
                  >
                    ?
                  </button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <InputGroup
                  id="slack-user-token"
                  label="User Token"
                  type="password"
                  placeholder="xoxp-..."
                  value={credentials.slack.userToken}
                  onChange={(e) =>
                    handleInputChange("slack", "userToken", e.target.value)
                  }
                />
                <InputGroup
                  id="slack-workspace-id"
                  label="Workspace ID"
                  type="text"
                  placeholder="T1234567890"
                  value={credentials.slack.workspaceId}
                  onChange={(e) =>
                    handleInputChange("slack", "workspaceId", e.target.value)
                  }
                />
                <InputGroup
                  id="slack-bot-token"
                  label="Bot Token"
                  type="password"
                  placeholder="xoxb-..."
                  value={credentials.slack.botToken}
                  onChange={(e) =>
                    handleInputChange("slack", "botToken", e.target.value)
                  }
                />
                <InputGroup
                  id="slack-channels"
                  label="Channels"
                  type="text"
                  placeholder="general,announcements"
                  value={credentials.slack.channels}
                  onChange={(e) =>
                    handleInputChange("slack", "channels", e.target.value)
                  }
                />

                <div className="flex flex-col md:flex-row gap-2 md:gap-3">
                  {hasCredentials.slack ? (
                    <div className="bg-gray-800 rounded p-2 text-xs text-gray-200">
                      <div className="font-bold text-indigo-300 mb-1">
                        Saved Slack Channels:
                      </div>
                      {savedSlackChannels.length > 0 ? (
                        <ul className="list-disc ml-4">
                          {savedSlackChannels.map((channel) => (
                            <li key={channel}>
                              <span className="text-indigo-200">{channel}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-gray-400">
                          No channels saved.
                        </span>
                      )}
                    </div>
                  ) : (
                    <>
                      <TestButton
                        className=""
                        loading={
                          loading.slack ||
                          loading.slackSaving ||
                          loading.slackGetting
                        }
                        disabled={
                          loading.slack ||
                          loading.slackSaving ||
                          loading.slackGetting
                        }
                        onClick={() =>
                          handleTest(
                            "slack",
                            SLACK_CONFIG.testBodyMapper(credentials.slack)
                          )
                        }
                        text={getButtonText(
                          "slack",
                          loading.slack ||
                            loading.slackSaving ||
                            loading.slackGetting,
                          messages.slack || messages.slackGetting
                        )}
                      />
                      {messages.slack && (
                        <p className="mt-1 text-xs text-red-400">
                          {messages.slack}
                        </p>
                      )}
                    </>
                  )}
                </div>
                {/* State messages now only shown on button */}
                {slackMessages.length > 0 && (
                  <div className="mt-2 text-xs text-gray-200 bg-gray-800 rounded p-2">
                    <div className="font-bold text-indigo-300 mb-1">
                      Slack Message Count per Channel:
                    </div>
                    <ul className="list-disc ml-4">
                      {Object.entries(
                        slackMessages.reduce(
                          (acc: Record<string, number>, msg: any) => {
                            acc[msg.channel] = (acc[msg.channel] || 0) + 1;
                            return acc;
                          },
                          {}
                        )
                      ).map(([channel, count]) => (
                        <li key={channel}>
                          <span className="text-indigo-200">{channel}</span>:{" "}
                          <span className="text-white font-bold">{count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <Separator />

            {/* Twitter */}
            <OAuthCard platform="twitter" />

            <Separator />

            {/* Facebook */}
            <OAuthCard platform="facebook" />
          </div>
        </div>
      </aside>

      {/* Help Overlay (mobile only) */}
      {helpPage && (
        <div className="fixed inset-0 bg-gray-900/95 z-50 sm:hidden flex flex-col">
          <div className="p-3 flex items-center justify-between border-b border-gray-700/50">
            <h3 className="text-white font-semibold text-base">Slack Setup</h3>
            <button
              onClick={() => setHelpPage(null)}
              className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700/50"
            >
              Back ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">{renderHelpContent()}</div>
        </div>
      )}
    </>
  );
}
