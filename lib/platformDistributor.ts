import { twitterPosting } from "./platforms/twitterPosting";
import { facebookPosting } from "./platforms/facebookPosting";
import { linkedinPosting } from "./platforms/linkedinPosting";

export interface PlatformTokens {
  twitter?: {
    accessToken: string;
  };
  facebook?: {
    pageId: string;
    accessToken: string;
  };
  linkedin?: {
    accessToken: string;
    personUrn?: string;
  };
}

export interface DistributionRequest {
  post: string;
  platforms: string[];
  tokens: PlatformTokens;
  userId: string;
  authToken: string;
  attachments?: File[];
}

export interface PlatformResult {
  platform: string;
  success: boolean;
  result?: any;
  error?: string;
}

/**
 * Available social media platforms
 */
export const AVAILABLE_PLATFORMS = ["twitter", "facebook", "linkedin"] as const;
export type Platform = (typeof AVAILABLE_PLATFORMS)[number];

/**
 * Distribute post to multiple platforms sequentially
 * Sequential execution prevents network timeout issues when posting to multiple platforms
 */
export async function distributeToMultiplePlatforms(
  request: DistributionRequest
): Promise<PlatformResult[]> {
  const { post, platforms, tokens, userId, authToken, attachments } = request;

  console.log(
    `📤 Distributing post to ${platforms.length} platform(s): ${platforms.join(
      ", "
    )}`
  );

  const results: PlatformResult[] = [];

  // Execute posting to each platform sequentially to avoid network timeout issues
  for (const platform of platforms) {
    try {
      console.log(`📡 Posting to ${platform}...`);

      const state = {
        post,
        platform,
        tokens,
        userId,
        authToken,
        attachments,
        prompt: "", // Not needed for posting
        threadId: "", // Not needed for posting
      };

      let result;
      switch (platform) {
        case "twitter":
          result = await twitterPosting(state);
          break;
        case "facebook":
          result = await facebookPosting(state);
          break;
        case "linkedin":
          result = await linkedinPosting(state);
          break;
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }

      results.push({
        platform,
        success: result.success ?? false,
        result: result.result,
      });

      console.log(`✅ Successfully posted to ${platform}`);

      // Add a small delay between posts to prevent rate limiting
      if (platforms.indexOf(platform) < platforms.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error: any) {
      console.error(`❌ Error posting to ${platform}:`, error);
      results.push({
        platform,
        success: false,
        error: error.message || `Failed to post to ${platform}`,
      });
    }
  }

  // Log summary
  const successCount = results.filter((r) => r.success).length;
  console.log(`✅ Posted to ${successCount}/${platforms.length} platform(s)`);

  return results;
}

/**
 * Validate platform selection
 */
export function validatePlatforms(platforms: string[]): {
  valid: boolean;
  error?: string;
} {
  if (!platforms || platforms.length === 0) {
    return {
      valid: false,
      error: "Please select at least one platform to post to",
    };
  }

  const invalidPlatforms = platforms.filter(
    (p) => !AVAILABLE_PLATFORMS.includes(p as Platform)
  );

  if (invalidPlatforms.length > 0) {
    return {
      valid: false,
      error: `Invalid platform(s): ${invalidPlatforms.join(
        ", "
      )}. Supported platforms: ${AVAILABLE_PLATFORMS.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Get platform-specific posting requirements
 */
export function getPlatformRequirements(platform: string): {
  maxLength: number;
  supportsImages: boolean;
  supportsVideos: boolean;
} {
  switch (platform) {
    case "twitter":
      return {
        maxLength: 280,
        supportsImages: true,
        supportsVideos: true,
      };
    case "facebook":
      return {
        maxLength: 63206,
        supportsImages: true,
        supportsVideos: true,
      };
    case "linkedin":
      return {
        maxLength: 3000,
        supportsImages: true,
        supportsVideos: true,
      };
    default:
      return {
        maxLength: 280, // Most restrictive
        supportsImages: false,
        supportsVideos: false,
      };
  }
}
