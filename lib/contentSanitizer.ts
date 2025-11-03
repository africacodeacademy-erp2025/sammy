/**
 * Content Sanitization and Validation Utilities
 *
 * Handles platform-specific content sanitization, validation, and formatting
 * for social media posts across Twitter, Facebook, and LinkedIn.
 */

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
}

/**
 * Sanitizes content for Twitter's requirements
 * - Maximum 280 characters (aims for 240-260 for retweets)
 * - Removes HTML tags
 * - Properly formats hashtags and mentions
 * - Cleans excessive punctuation
 */
export function sanitizeForTwitter(text: string): string {
  // Twitter character limit: 280 characters
  let sanitized = text.trim();

  // Remove any HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, "");

  // Remove potentially problematic characters
  sanitized = sanitized.replace(/[^\w\s#@.,!?;:()\-'"]/g, "");

  // Ensure hashtags are properly formatted (no spaces, alphanumeric + underscore)
  sanitized = sanitized.replace(/#[\w\s]+/g, (match) => {
    const cleaned = match.replace(/\s+/g, "").replace(/[^#\w]/g, "");
    return cleaned.length > 1 ? cleaned : "";
  });

  // Ensure mentions are properly formatted
  sanitized = sanitized.replace(/@[\w\s]+/g, (match) => {
    const cleaned = match.replace(/\s+/g, "").replace(/[^@\w]/g, "");
    return cleaned.length > 1 ? cleaned : "";
  });

  // Clean up multiple spaces and newlines
  sanitized = sanitized.replace(/\s+/g, " ").replace(/\n+/g, "\n");

  // Remove excessive punctuation
  sanitized = sanitized.replace(/[.]{3,}/g, "...");
  sanitized = sanitized.replace(/[!]{2,}/g, "!");
  sanitized = sanitized.replace(/[?]{2,}/g, "?");

  // Truncate if too long, leaving space for potential link shortening
  if (sanitized.length > 260) {
    const truncated = sanitized.substring(0, 257);
    const lastSpace = truncated.lastIndexOf(" ");
    sanitized =
      (lastSpace > 240 ? truncated.substring(0, lastSpace) : truncated) + "...";
  }

  return sanitized.trim();
}

/**
 * Sanitizes content for Facebook's requirements
 * - Maximum 63,206 characters (but optimal is 40-80 for engagement)
 * - Removes HTML tags
 * - Properly formats hashtags and mentions
 * - Cleans excessive whitespace and punctuation
 */
export function sanitizeForFacebook(text: string): string {
  // Facebook has a 63,206 character limit, but optimal is much shorter
  let sanitized = text.trim();

  // Remove any HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, "");

  // Remove potentially problematic characters but keep emojis and common symbols
  sanitized = sanitized.replace(/[^\w\s#@.,!?;:()\-'"emoji\u00A0-\uFFFF]/g, "");

  // Ensure hashtags work properly (Facebook is more flexible but clean them up)
  sanitized = sanitized.replace(/#[\w\s]+/g, (match) => {
    const cleaned = match.replace(/\s+/g, "");
    return cleaned.length > 1 ? cleaned : "";
  });

  // Clean up mentions
  sanitized = sanitized.replace(/@[\w\s]+/g, (match) => {
    const cleaned = match.replace(/\s+/g, "");
    return cleaned.length > 1 ? cleaned : "";
  });

  // Clean up excessive whitespace
  sanitized = sanitized.replace(/\n{3,}/g, "\n\n");
  sanitized = sanitized.replace(/\s{2,}/g, " ");

  // Remove excessive punctuation
  sanitized = sanitized.replace(/[.]{4,}/g, "...");
  sanitized = sanitized.replace(/[!]{3,}/g, "!!");
  sanitized = sanitized.replace(/[?]{3,}/g, "??");

  // Keep it reasonable length for engagement (Facebook's sweet spot is 40-80 chars but allow longer)
  if (sanitized.length > 1500) {
    const truncated = sanitized.substring(0, 1497);
    const lastSpace = truncated.lastIndexOf(" ");
    sanitized =
      (lastSpace > 1400 ? truncated.substring(0, lastSpace) : truncated) +
      "...";
  }

  return sanitized.trim();
}

/**
 * Sanitizes content for LinkedIn's requirements
 * - Professional tone and formatting
 * - Removes HTML tags
 * - Properly formats hashtags
 * - Cleans excessive whitespace and punctuation
 */
export function sanitizeForLinkedIn(text: string): string {
  let sanitized = text.trim();

  // Remove any HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, "");

  // Remove potentially problematic characters but keep professional symbols
  sanitized = sanitized.replace(/[^\w\s#@.,!?;:()\-'"&\u00A0-\uFFFF]/g, "");

  // Ensure hashtags are properly formatted
  sanitized = sanitized.replace(/#[\w\s]+/g, (match) => {
    const cleaned = match.replace(/\s+/g, "");
    return cleaned.length > 1 ? cleaned : "";
  });

  // Clean up mentions
  sanitized = sanitized.replace(/@[\w\s]+/g, (match) => {
    const cleaned = match.replace(/\s+/g, "");
    return cleaned.length > 1 ? cleaned : "";
  });

  // Clean up excessive whitespace
  sanitized = sanitized.replace(/\n{3,}/g, "\n\n");
  sanitized = sanitized.replace(/\s{2,}/g, " ");

  // Remove excessive punctuation (more conservative for LinkedIn)
  sanitized = sanitized.replace(/[.]{4,}/g, "...");
  sanitized = sanitized.replace(/[!]{2,}/g, "!");
  sanitized = sanitized.replace(/[?]{2,}/g, "?");

  // LinkedIn posts can be up to 3,000 characters, but keep it reasonable
  if (sanitized.length > 2000) {
    const truncated = sanitized.substring(0, 1997);
    const lastSpace = truncated.lastIndexOf(" ");
    sanitized =
      (lastSpace > 1900 ? truncated.substring(0, lastSpace) : truncated) +
      "...";
  }

  return sanitized.trim();
}

/**
 * Validates content for problematic patterns
 * - Checks for spam-like content
 * - Checks for potentially inappropriate language
 * - Checks for excessive special characters
 * - Checks for all-caps spam patterns
 */
export function validateContent(text: string): ValidationResult {
  const lowercaseText = text.toLowerCase();

  // Check for potentially problematic content patterns
  const problematicPatterns = [
    /\b(spam|click here|buy now|act fast|limited time|urgent|free money)\b/gi,
    /\b(hate|kill|die|stupid|idiot)\b/gi,
    /(.)\1{10,}/g, // Same character repeated 10+ times
    /[A-Z]{20,}/g, // All caps for 20+ characters
  ];

  for (const pattern of problematicPatterns) {
    if (pattern.test(text)) {
      return {
        isValid: false,
        reason:
          "Content contains potentially inappropriate or spam-like language",
      };
    }
  }

  // Check for excessive special characters (potential spam)
  const specialCharCount = (
    text.match(/[!@#$%^&*()_+={}[\]|\\:";'<>?,./]/g) || []
  ).length;
  if (specialCharCount > text.length * 0.3) {
    return {
      isValid: false,
      reason: "Content contains excessive special characters",
    };
  }

  return { isValid: true };
}

/**
 * Applies platform-specific sanitization based on the platform
 */
export function sanitizeForPlatform(text: string, platform: string): string {
  switch (platform.toLowerCase()) {
    case "twitter":
      return sanitizeForTwitter(text);
    case "facebook":
      return sanitizeForFacebook(text);
    case "linkedin":
      return sanitizeForLinkedIn(text);
    default:
      return text.trim();
  }
}

/**
 * Gets platform-specific content guidelines for AI generation
 */
export function getPlatformSpecificGuidelines(platform: string): string {
  if (platform === "twitter") {
    return `
Platform-specific guidelines for Twitter:
- Keep it under 280 characters (aim for 240-260 for retweets)
- Use 1-2 relevant hashtags maximum
- Make it engaging and conversational
- Include a call-to-action when appropriate
- Use line breaks sparingly
- Avoid excessive punctuation or special characters
- Write in a concise, punchy style
- Consider Twitter's audience: fast-paced, news-oriented, conversational
- Use proper capitalization (not all caps)
- Make it authentic and human-like`;
  } else if (platform === "facebook") {
    return `
Platform-specific guidelines for Facebook:
- Optimal length: 40-80 characters for high engagement, but can be longer for storytelling
- Use storytelling and emotional connection
- Ask questions to encourage engagement
- Use emojis appropriately (1-3 per post)
- Line breaks are okay for readability
- Include relevant hashtags (3-5 maximum)
- Write in a warm, community-focused tone
- Consider Facebook's audience: community-focused, relationship-oriented
- Use proper grammar and spelling
- Make it authentic and personal`;
  } else if (platform === "linkedin") {
    return `
Platform-specific guidelines for LinkedIn:
- Professional yet engaging tone
- Can be longer-form (up to 3,000 characters, but aim for 1,300 or less)
- Share insights, expertise, or business value
- Use relevant professional hashtags
- Consider LinkedIn's audience: professional, business-oriented, networking-focused
- Include actionable takeaways when appropriate
- Use proper formatting with line breaks for readability
- Be authentic while maintaining professionalism
- Avoid overly promotional content`;
  }
  return "";
}
