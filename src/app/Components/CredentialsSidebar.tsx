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

type Platform = "slack" | "twitter" | "facebook";

interface Credentials {
  slack: {
    userToken: string;
    workspaceId: string;
    botToken: string;
    channels: string;
  };
  twitter: {
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    accessSecret: string;
  };
  facebook: {
    pageId: string;
    pageAccessToken: string;
  };
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
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
  testBodyMapper: (creds: any) => any;
  pullingEndpoint?: string;
}

// Platform configurations
const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  slack: {
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
  },
  twitter: {
    name: "Twitter",
    badge: "OAuth",
    color: "sky",
    badgeColor: "bg-sky-500/20 text-sky-300",
    fields: [
      {
        id: "twitter-api-key",
        label: "API Key",
        type: "password",
        placeholder: "Your Twitter API Key",
        key: "apiKey",
      },
      {
        id: "twitter-api-secret",
        label: "API Secret",
        type: "password",
        placeholder: "Your Twitter API Secret",
        key: "apiSecret",
      },
      {
        id: "twitter-access-token",
        label: "Access Token",
        type: "password",
        placeholder: "Your Twitter Access Token",
        key: "accessToken",
      },
      {
        id: "twitter-access-secret",
        label: "Access Secret",
        type: "password",
        placeholder: "Your Twitter Access Secret",
        key: "accessSecret",
      },
    ],
    testBodyMapper: (creds) => ({
      appKey: creds.apiKey,
      appSecret: creds.apiSecret,
      accessToken: creds.accessToken,
      accessSecret: creds.accessSecret,
    }),
    pullingEndpoint: "/api/pulling/x-pulling",
    helpContent: (
      <div className="p-4 text-sm text-gray-200 space-y-3">
        <h3 className="text-lg font-semibold text-sky-300">
          How to get Twitter API keys
        </h3>
        <ol className="list-decimal list-inside space-y-1">
          <li>
            Go to{" "}
            <a
              href="https://developer.twitter.com/"
              target="_blank"
              rel="noreferrer"
              className="text-sky-400 underline"
            >
              Twitter Developer Portal
            </a>
            .
          </li>
          <li>Create a project and app.</li>
          <li>
            Under <strong>Keys and Tokens</strong>, generate API Key, API
            Secret, Access Token, and Access Secret.
          </li>
          <li>
            Configure app permissions (scopes):
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>
                <strong>Read:</strong> <code>tweet.read</code>,{" "}
                <code>users.read</code>, <code>follows.read</code>
              </li>
              <li>
                <strong>Write:</strong> <code>tweet.write</code>,{" "}
                <code>follows.write</code>
              </li>
              <li>
                <strong>Offline Access:</strong> <code>offline.access</code>{" "}
                (optional for long-lived tokens)
              </li>
            </ul>
          </li>
          <li>Paste the generated keys/tokens into the form fields here.</li>
        </ol>
      </div>
    ),
  },
  facebook: {
    name: "Facebook",
    badge: "Page",
    color: "blue",
    badgeColor: "bg-blue-500/20 text-blue-300",
    fields: [
      {
        id: "facebook-page-id",
        label: "Page ID",
        type: "text",
        placeholder: "Your Facebook Page ID",
        key: "pageId",
      },
      {
        id: "facebook-page-access-token",
        label: "Page Access Token",
        type: "password",
        placeholder: "Your Facebook Page Access Token",
        key: "pageAccessToken",
      },
    ],
    testBodyMapper: (creds) => ({
      pageId: creds.pageId,
      accessToken: creds.pageAccessToken,
    }),
    pullingEndpoint: "/api/pulling/fb-pulling",
    helpContent: (
      <div className="p-4 text-sm text-gray-200 space-y-3">
        <h3 className="text-lg font-semibold text-blue-300">
          How to get Facebook Page tokens
        </h3>
        <ol className="list-decimal list-inside space-y-1">
          <li>
            Go to{" "}
            <a
              href="https://developers.facebook.com/apps/"
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 underline"
            >
              Facebook Developers
            </a>
            .
          </li>
          <li>
            Create an app and add the <strong>Facebook Login</strong> product.
          </li>
          <li>Generate a Page Access Token from the Graph API Explorer.</li>
          <li>
            Ensure your app has these permissions:
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>
                <strong>Read:</strong> <code>pages_read_engagement</code>,{" "}
                <code>pages_read_user_content</code>
              </li>
              <li>
                <strong>Write:</strong> <code>pages_manage_posts</code>
              </li>
              <li>
                <strong>Optional:</strong> <code>pages_manage_metadata</code>{" "}
                (for managing page settings)
              </li>
            </ul>
          </li>
          <li>Copy your Page ID from your Page settings.</li>
        </ol>
      </div>
    ),
  },
};

export default function CredentialsSidebar({ isOpen, onClose }: SidebarProps) {
  // Consolidated credential status state
  const [hasCredentials, setHasCredentials] = useState({
    slack: false,
    twitter: false,
    facebook: false,
  });
  const [savedSlackChannels, setSavedSlackChannels] = useState<string[]>([]);

  // Helper function to fetch platform credentials
  const fetchPlatformCredentials = async (platform: Platform) => {
    try {
      const res = await fetch(`/api/integrations/${platform}/connect`, {
        headers: {
          authorization: "Bearer " + localStorage.getItem("token"),
        },
      });

      if (res.ok) {
        const data = await res.json();
        const platformData = data[platform];

        if (platform === "twitter") {
          return !!(
            platformData?.appKey &&
            platformData?.appSecret &&
            platformData?.accessToken &&
            platformData?.accessSecret
          );
        } else if (platform === "facebook") {
          return !!(platformData?.pageId && platformData?.accessToken);
        }
      }
      return false;
    } catch {
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

  const [credentials, setCredentials] = useState<Credentials>({
    slack: { userToken: "", workspaceId: "", botToken: "", channels: "" },
    twitter: { apiKey: "", apiSecret: "", accessToken: "", accessSecret: "" },
    facebook: { pageId: "", pageAccessToken: "" },
  });

  const [loading, setLoading] = useState({
    slack: false,
    twitter: false,
    facebook: false,
    slackSaving: false,
    slackGetting: false,
  });

  // ...existing code...

  // ...existing code...

  const [messages, setMessages] = useState({
    slack: "",
    twitter: "",
    facebook: "",
    slackGetting: "",
  });
  const [slackMessages, setSlackMessages] = useState<any[]>([]);

  const [helpPage, setHelpPage] = useState<
    null | "slack" | "twitter" | "facebook"
  >(null);

  const [verified, setVerified] = useState({
    slack: false,
    twitter: false,
    facebook: false,
  });

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
    setCredentials((prev) => ({
      ...prev,
      [platform]: Object.fromEntries(
        Object.keys(prev[platform]).map((key) => [key, ""])
      ) as any,
    }));
  };

  const handleSlackPostSave = async (body: any) => {
    setLoading((prev) => ({ ...prev, slackSaving: true }));
    setMessages((prev) => ({ ...prev, slack: "Saving..." }));

    try {
      const saveRes = await fetch("/api/integrations/slack/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: "Bearer " + localStorage.getItem("token"),
        },
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
          headers: {
            authorization: "Bearer " + localStorage.getItem("token"),
          },
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
        setMessages((prev) => ({
          ...prev,
          slackGetting: "Failed to get messages",
        }));
      }

      setLoading((prev) => ({ ...prev, slackGetting: false }));
    } catch (err) {
      setMessages((prev) => ({ ...prev, slack: "Failed to save credentials" }));
    }

    setLoading((prev) => ({ ...prev, slackSaving: false }));
  };

  const handlePlatformPostSave = async (platform: Platform, body: any) => {
    const config = PLATFORM_CONFIGS[platform];
    if (!config.pullingEndpoint) return;

    setMessages((prev) => ({ ...prev, [platform]: "Saving..." }));

    try {
      const saveRes = await fetch(`/api/integrations/${platform}/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: "Bearer " + localStorage.getItem("token"),
        },
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
        const postsRes = await fetch(config.pullingEndpoint, {
          headers: {
            authorization: "Bearer " + localStorage.getItem("token"),
          },
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

  const handleTest = async (platform: Platform, body: any) => {
    setLoading((prev) => ({ ...prev, [platform]: true }));
    setMessages((prev) => ({ ...prev, [platform]: "Testing..." }));

    try {
      const res = await fetch(`/api/integrations/${platform}/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: "Bearer " + localStorage.getItem("token"),
        },
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
      console.error(`Failed to test ${platform} credentials:`, err);
      setMessages((prev) => ({
        ...prev,
        [platform]: "Failed to connect. Please try again.",
      }));
      setVerified((prev) => ({ ...prev, [platform]: false }));
    } finally {
      setLoading((prev) => ({ ...prev, [platform]: false }));
    }
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

      case "twitter":
        return (
          <div className="p-4 text-sm text-gray-200 space-y-3">
            <h3 className="text-lg font-semibold text-sky-300">
              How to get Twitter API keys
            </h3>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                Go to{" "}
                <a
                  href="https://developer.twitter.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-400 underline"
                >
                  Twitter Developer Portal
                </a>
                .
              </li>
              <li>Create a project and app.</li>
              <li>
                Under <strong>Keys and Tokens</strong>, generate API Key, API
                Secret, Access Token, and Access Secret.
              </li>
              <li>
                Configure app permissions (scopes):
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>
                    <strong>Read:</strong> <code>tweet.read</code>,{" "}
                    <code>users.read</code>, <code>follows.read</code>
                  </li>
                  <li>
                    <strong>Write:</strong> <code>tweet.write</code>,{" "}
                    <code>follows.write</code>
                  </li>
                  <li>
                    <strong>Offline Access:</strong> <code>offline.access</code>{" "}
                    (optional for long-lived tokens)
                  </li>
                </ul>
              </li>
              <li>
                Paste the generated keys/tokens into the form fields here.
              </li>
            </ol>
          </div>
        );

      case "facebook":
        return (
          <div className="p-4 text-sm text-gray-200 space-y-3">
            <h3 className="text-lg font-semibold text-blue-300">
              How to get Facebook Page tokens
            </h3>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                Go to{" "}
                <a
                  href="https://developers.facebook.com/apps/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 underline"
                >
                  Facebook Developers
                </a>
                .
              </li>
              <li>
                Create an app and add the <strong>Facebook Login</strong>{" "}
                product.
              </li>
              <li>Generate a Page Access Token from the Graph API Explorer.</li>
              <li>
                Ensure your app has these permissions:
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>
                    <strong>Read:</strong> <code>pages_read_engagement</code>,{" "}
                    <code>pages_read_user_content</code>
                  </li>
                  <li>
                    <strong>Write:</strong> <code>pages_manage_posts</code>
                  </li>
                  <li>
                    <strong>Optional:</strong>{" "}
                    <code>pages_manage_metadata</code> (for managing page
                    settings)
                  </li>
                </ul>
              </li>
              <li>Copy your Page ID from your Page settings.</li>
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
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 right-0 h-full bg-gray-900/95 backdrop-blur-xl border-l border-gray-700/50
        transform transition-transform duration-300 z-50 shadow-2xl
        w-full sm:w-[40rem] flex
        ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Help Panel (desktop) */}
        <div className="hidden sm:block w-1/2 border-r border-gray-700/50 overflow-y-auto">
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
          <div className="p-3 sm:p-4 border-b border-gray-700/50 flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-semibold text-white">
              Credentials
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700/50"
            >
              ✕
            </button>
          </div>

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
                            PLATFORM_CONFIGS.slack.testBodyMapper(
                              credentials.slack
                            )
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sky-400 text-sm sm:text-base">
                  Twitter{" "}
                  <Badge className="bg-sky-500/20 text-sky-300 text-xs sm:text-sm">
                    OAuth
                  </Badge>
                  <button
                    onClick={() => setHelpPage("twitter")}
                    className="ml-auto text-sky-300 hover:text-white text-lg font-bold"
                    title="How to get Twitter credentials?"
                  >
                    ?
                  </button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <InputGroup
                  id="twitter-api-key"
                  label="API Key"
                  type="password"
                  placeholder="Your Twitter API Key"
                  value={credentials.twitter.apiKey}
                  onChange={(e) =>
                    handleInputChange("twitter", "apiKey", e.target.value)
                  }
                />
                <InputGroup
                  id="twitter-api-secret"
                  label="API Secret"
                  type="password"
                  placeholder="Your Twitter API Secret"
                  value={credentials.twitter.apiSecret}
                  onChange={(e) =>
                    handleInputChange("twitter", "apiSecret", e.target.value)
                  }
                />
                <InputGroup
                  id="twitter-access-token"
                  label="Access Token"
                  type="password"
                  placeholder="Your Twitter Access Token"
                  value={credentials.twitter.accessToken}
                  onChange={(e) =>
                    handleInputChange("twitter", "accessToken", e.target.value)
                  }
                />
                <InputGroup
                  id="twitter-access-secret"
                  label="Access Secret"
                  type="password"
                  placeholder="Your Twitter Access Secret"
                  value={credentials.twitter.accessSecret}
                  onChange={(e) =>
                    handleInputChange("twitter", "accessSecret", e.target.value)
                  }
                />
                <div className="flex flex-col md:flex-row gap-2 md:gap-3">
                  {verified.twitter || hasCredentials.twitter ? (
                    <div className="bg-gray-800 rounded p-2 text-xs text-gray-200">
                      <span className="text-sky-300 font-bold">
                        Credentials Configured
                      </span>
                    </div>
                  ) : (
                    <>
                      <TestButton
                        className=""
                        loading={loading.twitter}
                        disabled={loading.twitter}
                        onClick={() =>
                          handleTest(
                            "twitter",
                            PLATFORM_CONFIGS.twitter.testBodyMapper(
                              credentials.twitter
                            )
                          )
                        }
                        text={getButtonText(
                          "twitter",
                          loading.twitter,
                          messages.twitter
                        )}
                      />
                      {messages.twitter && (
                        <p className="mt-1 text-xs text-red-400">
                          {messages.twitter}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Separator />

            {/* Facebook */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-400 text-sm sm:text-base">
                  Facebook{" "}
                  <Badge className="bg-blue-500/20 text-blue-300 text-xs sm:text-sm">
                    Page
                  </Badge>
                  <button
                    onClick={() => setHelpPage("facebook")}
                    className="ml-auto text-blue-300 hover:text-white text-lg font-bold"
                    title="How to get Facebook credentials?"
                  >
                    ?
                  </button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <InputGroup
                  id="facebook-page-id"
                  label="Page ID"
                  type="text"
                  placeholder="Your Facebook Page ID"
                  value={credentials.facebook.pageId}
                  onChange={(e) =>
                    handleInputChange("facebook", "pageId", e.target.value)
                  }
                />
                <InputGroup
                  id="facebook-page-access-token"
                  label="Page Access Token"
                  type="password"
                  placeholder="Your Facebook Page Access Token"
                  value={credentials.facebook.pageAccessToken}
                  onChange={(e) =>
                    handleInputChange(
                      "facebook",
                      "pageAccessToken",
                      e.target.value
                    )
                  }
                />
                <div className="flex flex-col md:flex-row gap-2 md:gap-3">
                  {verified.facebook || hasCredentials.facebook ? (
                    <div className="bg-gray-800 rounded p-2 text-xs text-gray-200">
                      <span className="text-blue-300 font-bold">
                        Credentials Configured
                      </span>
                    </div>
                  ) : (
                    <>
                      <TestButton
                        className=""
                        loading={loading.facebook}
                        disabled={loading.facebook}
                        onClick={() =>
                          handleTest(
                            "facebook",
                            PLATFORM_CONFIGS.facebook.testBodyMapper(
                              credentials.facebook
                            )
                          )
                        }
                        text={getButtonText(
                          "facebook",
                          loading.facebook,
                          messages.facebook
                        )}
                      />
                      {messages.facebook && (
                        <p className="mt-1 text-xs text-red-400">
                          {messages.facebook}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Help Overlay (mobile only) */}
      {helpPage && (
        <div className="fixed inset-0 bg-gray-900/95 z-50 sm:hidden flex flex-col">
          <div className="p-3 flex items-center justify-between border-b border-gray-700/50">
            <h3 className="text-white font-semibold text-base">
              {helpPage === "slack" && "Slack Setup"}
              {helpPage === "twitter" && "Twitter Setup"}
              {helpPage === "facebook" && "Facebook Setup"}
            </h3>
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
