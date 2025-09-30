"use client";

import { useState } from "react";
import Badge from "./UI/Badge";
import Separator from "./UI/Separator";
import Button from "./UI/Button";
import InputGroup from "./UI/InputGroup";
import CardContent from "./UI/CardContent";
import CardTitle from "./UI/CardTitle";
import CardHeader from "./UI/CardHeader";
import Card from "./UI/Card";
import TestButton from "./UI/TestButton";

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

export default function CredentialsSidebar({ isOpen, onClose }: SidebarProps) {
  const [credentials, setCredentials] = useState<Credentials>({
    slack: { userToken: "", workspaceId: "", botToken: "", channels: "" },
    twitter: { apiKey: "", apiSecret: "", accessToken: "", accessSecret: "" },
    facebook: { pageId: "", pageAccessToken: "" },
  });

  const [loading, setLoading] = useState({
    slack: false,
    twitter: false,
    facebook: false,
  });

  const [messages, setMessages] = useState({
    slack: "",
    twitter: "",
    facebook: "",
  });

  const [helpPage, setHelpPage] = useState<
    null | "slack" | "twitter" | "facebook"
  >(null);

  const [verified, setVerified] = useState({
    slack: false,
    twitter: false,
    facebook: false,
  });

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

  const handleSave = async (
    platform: keyof Credentials,
    url: string,
    body: any
  ) => {
    setLoading((prev) => ({ ...prev, [platform]: true }));
    setMessages((prev) => ({ ...prev, [platform]: "" }));

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setMessages((prev) => ({
        ...prev,
        [platform]: data.message || data.error || "Unknown response",
      }));

      setCredentials((prev) => ({
        ...prev,
        [platform]: Object.fromEntries(
          Object.keys(prev[platform]).map((key) => [key, ""])
        ) as any,
      }));
    } catch (err) {
      console.error(`Failed to save ${platform} credentials:`, err);
      setMessages((prev) => ({
        ...prev,
        [platform]: "Failed to connect. Please try again.",
      }));
    } finally {
      setLoading((prev) => ({ ...prev, [platform]: false }));
    }
  };

  const handleTest = async (platform: keyof Credentials, body: any) => {
    setLoading((prev) => ({ ...prev, [platform]: true }));
    setMessages((prev) => ({ ...prev, [platform]: "" }));

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
                  type="password"
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
                  <TestButton
                    className=""
                    loading={loading.slack}
                    disabled={loading.slack}
                    onClick={() =>
                      handleTest("slack", {
                        workspaceId: credentials.slack.workspaceId,
                        botToken: credentials.slack.botToken,
                        userToken: credentials.slack.userToken,
                        channels: credentials.slack.channels,
                      })
                    }
                  />

                  <Button
                    className=""
                    disabled={!verified.slack}
                    onClick={() =>
                      handleSave("slack", "/api/integrations/slack/connect", {
                        workspaceId: credentials.slack.workspaceId,
                        botToken: credentials.slack.botToken,
                        userToken: credentials.slack.userToken,
                        channels: credentials.slack.channels,
                      })
                    }
                  >
                    {loading.slack ? "Saving..." : "Save"}
                  </Button>
                </div>
                {messages.slack && (
                  <p className="mt-1 text-sm text-gray-300">{messages.slack}</p>
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
                  <TestButton
                    className=""
                    loading={loading.twitter}
                    disabled={loading.twitter}
                    onClick={() =>
                      handleTest("twitter", {
                        appKey: credentials.twitter.apiKey,
                        appSecret: credentials.twitter.apiSecret,
                        accessToken: credentials.twitter.accessToken,
                        accessSecret: credentials.twitter.accessSecret,
                      })
                    }
                  />

                  <Button
                    className=""
                    disabled={!verified.twitter}
                    onClick={() =>
                      handleSave(
                        "twitter",
                        "/api/integrations/twitter/connect",
                        {
                          appKey: credentials.twitter.apiKey,
                          appSecret: credentials.twitter.apiSecret,
                          accessToken: credentials.twitter.accessToken,
                          accessSecret: credentials.twitter.accessSecret,
                        }
                      )
                    }
                  >
                    {loading.twitter ? "Saving..." : "Save"}
                  </Button>
                </div>
                {messages.twitter && (
                  <p className="mt-1 text-sm text-gray-300">
                    {messages.twitter}
                  </p>
                )}
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
                  <TestButton
                    className=""
                    loading={loading.facebook}
                    disabled={loading.facebook}
                    onClick={() =>
                      handleTest("facebook", {
                        pageId: credentials.facebook.pageId,
                        accessToken: credentials.facebook.pageAccessToken,
                      })
                    }
                  />

                  <Button
                    className=""
                    disabled={!verified.facebook}
                    onClick={() =>
                      handleSave(
                        "facebook",
                        "/api/integrations/facebook/connect",
                        {
                          pageId: credentials.facebook.pageId,
                          accessToken: credentials.facebook.pageAccessToken,
                        }
                      )
                    }
                  >
                    {loading.facebook ? "Saving..." : "Save"}
                  </Button>
                </div>
                {messages.facebook && (
                  <p className="mt-1 text-sm text-gray-300">
                    {messages.facebook}
                  </p>
                )}
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
