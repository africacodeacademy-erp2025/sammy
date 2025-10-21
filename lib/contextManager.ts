/**
 * Smart Context Management for Cost-Efficient LLM Calls
 *
 * This utility provides a hybrid approach:
 * 1. Recent messages: Always include last N messages for immediate context
 * 2. RAG retrieval: Use embeddings to find relevant past messages if needed
 * 3. Token optimization: Compress older messages, prioritize recent ones
 */

import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPEN_AI_API });

interface Message {
  id: string;
  sender: "user" | "ai";
  content: string;
  timestamp: number;
  status?: string;
  threadId?: string;
  platform?: string;
}

interface ContextConfig {
  maxRecentMessages?: number; // Default: 6 (last 3 exchanges)
  maxTotalTokens?: number; // Default: 2000 tokens (~1500 words)
  useRAG?: boolean; // Default: false (enable for long conversations)
  ragTopK?: number; // Default: 2 (retrieve top 2 relevant past messages)
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Compress a message by keeping first and last portions
 * Useful for very old messages that might still be relevant
 */
function compressMessage(content: string, maxTokens: number = 50): string {
  const estimatedTokens = estimateTokens(content);

  if (estimatedTokens <= maxTokens) {
    return content;
  }

  // Keep first 60% and last 40% of the message
  const maxChars = maxTokens * 4;
  const firstPart = content.substring(0, Math.floor(maxChars * 0.6));
  const lastPart = content.substring(
    content.length - Math.floor(maxChars * 0.4)
  );

  return `${firstPart}...[content trimmed]...${lastPart}`;
}

/**
 * Build context for LLM with smart token management
 *
 * Strategy:
 * - Always include last N messages (recent context is critical)
 * - If conversation is long (>10 messages), optionally use RAG for relevant past context
 * - Compress older messages if needed to stay within token budget
 * - Prioritize user messages over AI responses in compression
 */
export async function buildSmartContext(
  messages: Message[],
  currentPrompt: string,
  config: ContextConfig = {}
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const {
    maxRecentMessages = 6, // Last 3 user-AI exchanges
    maxTotalTokens = 2000, // ~$0.0004 for GPT-4o-mini input
    useRAG = false,
    ragTopK = 2,
  } = config;

  const contextMessages: Array<{
    role: "user" | "assistant";
    content: string;
  }> = [];
  let totalTokens = estimateTokens(currentPrompt);

  // Step 1: Always include recent messages (most important for coherence)
  const recentMessages = messages.slice(-maxRecentMessages);

  for (const msg of recentMessages) {
    const messageTokens = estimateTokens(msg.content);

    // If adding this message exceeds budget, compress it
    if (totalTokens + messageTokens > maxTotalTokens) {
      const remainingTokens = maxTotalTokens - totalTokens;
      if (remainingTokens > 50) {
        // Only include if we have at least 50 tokens left
        const compressed = compressMessage(msg.content, remainingTokens);
        contextMessages.push({
          role: msg.sender === "user" ? "user" : "assistant",
          content: compressed,
        });
        totalTokens += estimateTokens(compressed);
      }
      break; // Stop adding messages if we're out of tokens
    }

    contextMessages.push({
      role: msg.sender === "user" ? "user" : "assistant",
      content: msg.content,
    });
    totalTokens += messageTokens;
  }

  // Step 2: RAG for long conversations (only if enabled and conversation is long)
  if (useRAG && messages.length > maxRecentMessages + 4) {
    const olderMessages = messages.slice(0, -maxRecentMessages);
    const relevantOldMessages = await retrieveRelevantMessages(
      currentPrompt,
      olderMessages,
      ragTopK
    );

    // Prepend relevant old messages (compressed) before recent context
    for (const msg of relevantOldMessages) {
      const remainingTokens = maxTotalTokens - totalTokens;
      if (remainingTokens > 50) {
        const compressed = compressMessage(
          msg.content,
          Math.min(100, remainingTokens)
        );
        contextMessages.unshift({
          role: msg.sender === "user" ? "user" : "assistant",
          content: `[Earlier in conversation] ${compressed}`,
        });
        totalTokens += estimateTokens(compressed);
      }
    }
  }

  return contextMessages;
}

/**
 * Retrieve relevant past messages using embeddings (RAG)
 * Only use this for very long conversations (cost optimization)
 */
async function retrieveRelevantMessages(
  query: string,
  messages: Message[],
  topK: number = 2
): Promise<Message[]> {
  try {
    // Get embedding for current query
    const queryEmbedding = await getEmbedding(query);

    // Get embeddings for all past messages (batch processing for efficiency)
    const messageTexts = messages.map((m) => m.content);
    const messageEmbeddings = await getEmbeddings(messageTexts);

    // Calculate cosine similarity
    const similarities = messageEmbeddings.map((embedding, index) => ({
      message: messages[index],
      similarity: cosineSimilarity(queryEmbedding, embedding),
    }));

    // Return top K most relevant messages
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
      .map((item) => item.message);
  } catch (error) {
    console.error("Error in RAG retrieval:", error);
    return []; // Fallback: return empty if RAG fails
  }
}

/**
 * Get single embedding
 */
async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small", // $0.00002 per 1K tokens
    input: text,
  });
  return response.data[0].embedding;
}

/**
 * Get multiple embeddings in batch (more efficient)
 */
async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  });
  return response.data.map((item) => item.embedding);
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Decide whether to use RAG based on conversation length and complexity
 */
export function shouldUseRAG(messages: Message[]): boolean {
  // Use RAG only for conversations with >12 messages (6+ exchanges)
  // This keeps costs low for short conversations
  return messages.length > 12;
}

/**
 * Calculate estimated cost for context
 * GPT-4o-mini pricing: $0.150/1M input tokens, $0.600/1M output tokens
 */
export function estimateContextCost(messages: Message[]): {
  inputTokens: number;
  estimatedCost: number;
} {
  const inputTokens = messages.reduce(
    (sum, msg) => sum + estimateTokens(msg.content),
    0
  );
  const estimatedCost = (inputTokens / 1_000_000) * 0.15; // Input cost only

  return {
    inputTokens,
    estimatedCost,
  };
}
