"use client";

import { ReactNode, useState } from "react";

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
    slack: {
      userToken: '',
      workspaceId: '',
      botToken: '',
      channels: ''
    },
    twitter: {
      apiKey: '',
      apiSecret: '',
      accessToken: '',
      accessSecret: ''
    },
    facebook: {
      pageId: '',
      pageAccessToken: ''
    }
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
      <div
        className={`fixed top-0 right-0 h-full w-96 bg-gray-900/95 backdrop-blur-xl border-l border-gray-700/50
        transform transition-transform duration-300 z-50 shadow-2xl
        ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Credentials</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700/50"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-6 overflow-y-auto h-[calc(100%-4rem)]">
          {/* Slack */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-indigo-400">
                Slack <Badge className="bg-indigo-500/20 text-indigo-300">API</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="slack-user-token">User Token</Label>
                  <Input
                    id="slack-user-token"
                    type="password"
                    placeholder="xoxp-..."
                    value={credentials.slack.userToken}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleInputChange("slack", "userToken", e.target.value)
                    }
                    className="border-indigo-200 focus:border-indigo-400 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <Label htmlFor="slack-workspace-id">Workspace ID</Label>
                  <Input
                    id="slack-workspace-id"
                    type="text"
                    placeholder="T1234567890"
                    value={credentials.slack.workspaceId}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleInputChange("slack", "workspaceId", e.target.value)
                    }
                    className="border-indigo-200 focus:border-indigo-400 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <Label htmlFor="slack-bot-token">Bot Token</Label>
                  <Input
                    id="slack-bot-token"
                    type="password"
                    placeholder="xoxb-..."
                    value={credentials.slack.botToken}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleInputChange("slack", "botToken", e.target.value)
                    }
                    className="border-indigo-200 focus:border-indigo-400 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <Label htmlFor="slack-channels">Channels</Label>
                  <Input
                    id="slack-channels"
                    type="text"
                    placeholder="general,announcements"
                    value={credentials.slack.channels}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleInputChange("slack", "channels", e.target.value)
                    }
                    className="border-indigo-200 focus:border-indigo-400 focus:ring-indigo-400"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator className="bg-gray-700/50" />

          {/* Twitter */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sky-400">
                Twitter <Badge className="bg-sky-500/20 text-sky-300">OAuth</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="twitter-api-key">API Key</Label>
                  <Input
                    id="twitter-api-key"
                    type="text"
                    placeholder="Your Twitter API Key"
                    value={credentials.twitter.apiKey}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleInputChange("twitter", "apiKey", e.target.value)
                    }
                    className="border-sky-200 focus:border-sky-400 focus:ring-sky-400"
                  />
                </div>
                <div>
                  <Label htmlFor="twitter-api-secret">API Secret</Label>
                  <Input
                    id="twitter-api-secret"
                    type="password"
                    placeholder="Your Twitter API Secret"
                    value={credentials.twitter.apiSecret}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleInputChange("twitter", "apiSecret", e.target.value)
                    }
                    className="border-sky-200 focus:border-sky-400 focus:ring-sky-400"
                  />
                </div>
                <div>
                  <Label htmlFor="twitter-access-token">Access Token</Label>
                  <Input
                    id="twitter-access-token"
                    type="password"
                    placeholder="Your Twitter Access Token"
                    value={credentials.twitter.accessToken}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleInputChange("twitter", "accessToken", e.target.value)
                    }
                    className="border-sky-200 focus:border-sky-400 focus:ring-sky-400"
                  />
                </div>
                <div>
                  <Label htmlFor="twitter-access-secret">Access Secret</Label>
                  <Input
                    id="twitter-access-secret"
                    type="password"
                    placeholder="Your Twitter Access Secret"
                    value={credentials.twitter.accessSecret}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleInputChange("twitter", "accessSecret", e.target.value)
                    }
                    className="border-sky-200 focus:border-sky-400 focus:ring-sky-400"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator className="bg-gray-700/50" />

          {/* Facebook */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-400">
                Facebook <Badge className="bg-blue-500/20 text-blue-300">Page</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="facebook-page-id">Page ID</Label>
                  <Input
                    id="facebook-page-id"
                    type="text"
                    placeholder="Your Facebook Page ID"
                    value={credentials.facebook.pageId}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleInputChange("facebook", "pageId", e.target.value)
                    }
                    className="border-blue-200 focus:border-blue-400 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <Label htmlFor="facebook-page-access-token">Page Access Token</Label>
                  <Input
                    id="facebook-page-access-token"
                    type="password"
                    placeholder="Your Facebook Page Access Token"
                    value={credentials.facebook.pageAccessToken}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleInputChange("facebook", "pageAccessToken", e.target.value)
                    }
                    className="border-blue-200 focus:border-blue-400 focus:ring-blue-400"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
            Save Credentials
          </Button>
        </div>
      </div>
    </>
  );
}

/* ---------------- UI COMPONENTS ---------------- */
interface BaseProps {
  children: ReactNode;
  className?: string;
}

function Card({ children, className = "" }: BaseProps) {
  return <div className={`rounded-lg p-0 ${className}`}>{children}</div>;
}
function CardHeader({ children, className = "" }: BaseProps) {
  return <div className={`px-4 pt-4 ${className}`}>{children}</div>;
}
function CardTitle({ children, className = "" }: BaseProps) {
  return <h2 className={`font-semibold ${className}`}>{children}</h2>;
}
function CardContent({ children, className = "" }: BaseProps) {
  return <div className={`px-4 pb-4 ${className}`}>{children}</div>;
}
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <input
      className={`w-full rounded px-3 py-2 text-sm ${props.className ?? ""}`}
      style={{
        borderWidth: "2px",
        borderStyle: "solid",
        borderColor: "transparent", // no visible border initially
        borderImage: isFocused
          ? "linear-gradient(45deg, #a855f7, #ec4899) 1"
          : undefined, // apply gradient only on focus
      }}
      {...props}
      onFocus={(e) => {
        setIsFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setIsFocused(false);
        props.onBlur?.(e);
      }}
    />
  );
}
function Label(props: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={`block text-sm font-medium ${props.className ?? ""}`}
      {...props}
    >
      {props.children}
    </label>
  );
}
function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`rounded px-4 py-2 font-medium transition ${props.className ?? ""}`}
      {...props}
    >
      {props.children}
    </button>
  );
}
function Separator({ className = "" }: { className?: string }) {
  return <div className={`h-px w-full ${className}`} />;
}
function Badge({ children, className = "" }: BaseProps) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}
