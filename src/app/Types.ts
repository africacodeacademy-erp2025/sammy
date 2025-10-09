// types.ts

export interface Message {
  id: string;
  sender: "user" | "ai";
  content: string;
  status?:
    | "pending"
    | "posting"
    | "posted"
    | "error"
    | "rejected"
    | "scheduled"
    | "pending_approval";
  threadId?: string;
  platform?: string;
  timestamp: number | string;
  attachments?: File[];
}

export interface ScheduledPost {
  id: string;
  content: string;
  timestamp: number;
  platform: string;
  status: "scheduled" | "posted" | "canceled";
  post?: string;
}

export interface MessageBubbleProps {
  message: Message;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isLatestAiMessage: boolean;
  onEditSave?: (id: string, content: string) => void;
  onAttachmentsChange?: (id: string, attachments: File[]) => void;
}
