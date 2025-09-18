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
        w-full sm:w-96
        ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
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
              <Button
                className="w-full sm:w-auto"
                onClick={() =>
                  handleSave("slack", "/api/integrations/slack/connect", {
                    workspaceId: credentials.slack.workspaceId,
                    botToken: credentials.slack.botToken,
                    userToken: credentials.slack.userToken,
                    channels: credentials.slack.channels,
                  })
                }
              >
                {loading.slack ? "Saving..." : "Save Credentials"}
              </Button>
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
              <Button
                className="w-full sm:w-auto"
                onClick={() =>
                  handleSave("twitter", "/api/integrations/twitter/connect", {
                    appKey: credentials.twitter.apiKey,
                    appSecret: credentials.twitter.apiSecret,
                    accessToken: credentials.twitter.accessToken,
                    accessSecret: credentials.twitter.accessSecret,
                  })
                }
              >
                {loading.twitter ? "Saving..." : "Save Credentials"}
              </Button>
              {messages.twitter && (
                <p className="mt-1 text-sm text-gray-300">{messages.twitter}</p>
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
              <Button
                className="w-full sm:w-auto"
                onClick={() =>
                  handleSave("facebook", "/api/integrations/facebook/connect", {
                    pageId: credentials.facebook.pageId,
                    accessToken: credentials.facebook.pageAccessToken,
                  })
                }
              >
                {loading.facebook ? "Saving..." : "Save Credentials"}
              </Button>
              {messages.facebook && (
                <p className="mt-1 text-sm text-gray-300">
                  {messages.facebook}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
