import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPEN_AI_API });

export interface ThreadMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Create a new OpenAI thread
 */
export async function createThread(): Promise<string> {
  try {
    const thread = await openai.beta.threads.create();
    console.log(`✅ OpenAI Thread created: ${thread.id}`);
    return thread.id;
  } catch (error) {
    console.error("❌ Failed to create OpenAI thread:", error);
    throw new Error("Failed to create conversation thread");
  }
}

/**
 * Add a message to an OpenAI thread
 */
export async function addMessageToThread(
  threadId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  try {
    await openai.beta.threads.messages.create(threadId, {
      role,
      content,
    });
    console.log(`💬 Message added to thread ${threadId} (${role})`);
  } catch (error) {
    console.error(`❌ Failed to add message to thread ${threadId}:`, error);
    throw new Error("Failed to add message to thread");
  }
}

/**
 * Retrieve conversation history from an OpenAI thread
 */
export async function getThreadMessages(
  threadId: string,
  limit: number = 20
): Promise<ThreadMessage[]> {
  try {
    const messages = await openai.beta.threads.messages.list(threadId, {
      limit,
      order: "asc",
    });

    return messages.data.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content[0]?.type === "text" ? msg.content[0].text.value : "",
    }));
  } catch (error) {
    console.error(
      `❌ Failed to retrieve messages from thread ${threadId}:`,
      error
    );
    return [];
  }
}

/**
 * Run assistant on a thread and get response
 * This is a simplified version - you can enhance with streaming
 * Note: Currently not used in the application
 */
export async function runThreadWithAssistant(
  threadId: string,
  assistantId: string
): Promise<string> {
  // TODO: Implement proper OpenAI Assistants API integration when needed
  // The syntax for runs.retrieve may vary based on OpenAI SDK version
  throw new Error("Assistant integration not yet implemented");
}

/**
 * Get recent conversation context as formatted string
 * Useful for RAG augmentation
 */
export async function getThreadContext(
  threadId: string,
  limit: number = 10
): Promise<string> {
  const messages = await getThreadMessages(threadId, limit);

  return messages
    .map(
      (msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
    )
    .join("\n\n");
}
