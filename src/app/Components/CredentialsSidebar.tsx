"use client";

import React, { useState, useEffect } from "react";
import Badge from "./UI/Badge";
import Separator from "./UI/Separator";
import Button from "./UI/Button";
import CardContent from "./UI/CardContent";
import CardTitle from "./UI/CardTitle";
import CardHeader from "./UI/CardHeader";
import Card from "./UI/Card";

// ========== Types ==========
type OAuthPlatform = "twitter" | "facebook" | "slack";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PlatformStatus {
  slack: boolean;
  twitter: boolean;
  facebook: boolean;
}

interface LoadingState {
  twitter: boolean;
  facebook: boolean;
  slack: boolean;
}

interface MessageState {
  twitter: string;
  facebook: string;
  slack: string;
}

// ========== Constants ==========
const OAUTH_PLATFORMS: Record<
  OAuthPlatform,
  { name: string; description: string; color: string }
> = {
  twitter: {
    name: "Twitter/X",
    description:
      "Connect your Twitter/X account to enable posting and reading tweets.",
    color: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  },
  facebook: {
    name: "Facebook",
    description:
      "Connect your Facebook page to enable posting and reading content.",
    color: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  },
  slack: {
    name: "Slack",
    description:
      "Connect your Slack workspace to enable context-aware content generation from your messages.",
    color: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  },
} as const;

/**
 * CredentialsSidebar Component
 *
 * Manages platform credentials for Twitter, Facebook, and Slack using OAuth 2.0.
 * Provides a sidebar interface for connecting platform integrations.
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
  const [loading, setLoading] = useState<LoadingState>({
    twitter: false,
    facebook: false,
    slack: false,
  });
  const [messages, setMessages] = useState<MessageState>({
    twitter: "",
    facebook: "",
    slack: "",
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

    // Slack success
    if (params.get("slack_connected") === "true") {
      setMessages((prev) => ({
        ...prev,
        slack: "Successfully connected to Slack!",
      }));
      setHasCredentials((prev) => ({ ...prev, slack: true }));
      window.history.replaceState({}, "", window.location.pathname);
    }

    // Slack error
    const slackError = params.get("slack_error");
    if (slackError) {
      const errorMessages: Record<string, string> = {
        missing_params: "Missing authorization parameters",
        invalid_state: "Invalid state parameter",
        config_error: "Slack OAuth not properly configured",
        token_exchange_failed: "Failed to exchange authorization code",
        no_access_token: "No access token received",
        callback_error: "An error occurred during authorization",
      };
      setMessages((prev) => ({
        ...prev,
        slack: errorMessages[slackError] || `Error: ${slackError}`,
      }));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Check platform connection status
  useEffect(() => {
    async function checkPlatformStatus() {
      if (!isOpen) return;

      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const res = await fetch("/api/user", {
          headers: {
            authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          const user = data.user || data;

          const twitterConnected = Boolean(
            user?.twitter &&
              (user.twitter.accessToken || user.twitter.refreshToken)
          );

          const facebookConnected = Boolean(
            user?.facebook &&
              (user.facebook.accessToken ||
                user.facebook.pageId ||
                (Array.isArray(user.facebook.pages) &&
                  user.facebook.pages.length > 0))
          );

          const slackConnected = Boolean(
            user?.slack &&
              (user.slack.accessToken ||
                user.slack.userAccessToken ||
                user.slack.botToken ||
                user.slack.userToken ||
                user.slack.teamId)
          );

          setHasCredentials({
            twitter: twitterConnected,
            facebook: facebookConnected,
            slack: slackConnected,
          });
        }
      } catch (error) {
        console.error("Failed to check platform status:", error);
      }
    }

    checkPlatformStatus();
  }, [isOpen]);

  // Handle OAuth connection for all platforms
  const handleOAuthConnect = async (platform: OAuthPlatform) => {
    setLoading((prev) => ({ ...prev, [platform]: true }));
    setMessages((prev) => ({
      ...prev,
      [platform]: "Redirecting to " + OAUTH_PLATFORMS[platform].name + "...",
    }));

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      // Directly redirect to OAuth endpoint
      // The backend will handle the redirect to the OAuth provider
      window.location.href = `/api/integrations/${platform}/oauth?token=${encodeURIComponent(
        token
      )}`;
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

  // Reusable OAuth Card Component
  const OAuthCard = ({ platform }: { platform: OAuthPlatform }) => {
    const config = OAUTH_PLATFORMS[platform];
    const isConnected = hasCredentials[platform];
    const isLoading = loading[platform];
    const message = messages[platform];

    const badgeColor =
      platform === "twitter"
        ? "bg-sky-500/20 text-sky-300"
        : platform === "facebook"
        ? "bg-blue-500/20 text-blue-300"
        : "bg-purple-500/20 text-purple-300";

    const titleColor =
      platform === "twitter"
        ? "text-sky-400"
        : platform === "facebook"
        ? "text-blue-400"
        : "text-purple-400";

    const connectedColor =
      platform === "twitter"
        ? "text-sky-300"
        : platform === "facebook"
        ? "text-blue-300"
        : "text-purple-300";

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
            <Badge
              className={`${badgeColor} ${config.color} text-xs sm:text-sm`}
            >
              OAuth 2.0
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          <p className="text-sm text-gray-400">{config.description}</p>

          {isConnected ? (
            <div
              className="w-full bg-gray-800 rounded p-4 text-center border border-gray-700"
              role="status"
              aria-label={`${config.name} connected successfully`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-xl" aria-hidden="true">
                  ✓
                </span>
                <span
                  className={`${connectedColor} font-semibold text-sm sm:text-base`}
                >
                  Already Connected to {config.name}
                </span>
              </div>
            </div>
          ) : (
            <Button
              className="w-full"
              disabled={isLoading}
              onClick={() => handleOAuthConnect(platform)}
              variant="primary"
            >
              {isLoading ? "Connecting..." : `Connect ${config.name} Account`}
            </Button>
          )}

          {message && (
            <p
              className={`mt-1 text-xs ${messageColor}`}
              role="alert"
              aria-live="polite"
            >
              {message}
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside
        className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-gray-900 border-l border-gray-700 z-50
        transform transition-transform duration-300 shadow-2xl overflow-y-auto
        ${isOpen ? "translate-x-0" : "translate-x-full"}`}
        aria-label="Platform Credentials"
        role="complementary"
      >
        {/* Header */}
        <header className="p-6 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-900 z-10">
          <h2 className="text-xl font-bold text-white">Platform Connections</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close sidebar"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </header>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Info Banner */}
          <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-white mb-2">
              🔐 Secure OAuth 2.0 Authentication
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              All platforms use secure OAuth 2.0. Your credentials are encrypted
              and can be disconnected anytime.
            </p>
          </div>

          <Separator />

          {/* Platform Cards */}
          <OAuthCard platform="twitter" />

          <Separator />

          <OAuthCard platform="facebook" />

          <Separator />

          <OAuthCard platform="slack" />
        </div>
      </aside>
    </>
  );
}
