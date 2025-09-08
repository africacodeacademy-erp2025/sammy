// types.ts

export interface Message {
  id: string;
  sender: "user" | "ai";
  content: string;
  status?: "pending" | "posting" | "posted" | "error" | "rejected";
  threadId?: string;
  timestamp: number;
}

export interface ScheduledPost {
  id: string;
  content: string;
  timestamp: number;
  platform: string;
  status: "scheduled" | "posted" | "canceled";
}

export interface MessageBubbleProps {
  message: Message;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isLatestAiMessage: boolean;
}
