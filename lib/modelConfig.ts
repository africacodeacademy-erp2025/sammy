/**
 * Model configuration based on user plan tiers
 * Maps planId to OpenAI model and generation parameters
 */

export interface ModelConfig {
  model: string;
  maxTokens: number;
  description: string;
}

export const MODEL_TIERS: Record<number, ModelConfig> = {
  1: {
    // Basic Plan
    model: "gpt-3.5-turbo",
    maxTokens: 150,
    description: "Fast and efficient content generation",
  },
  2: {
    // Pro Plan
    model: "gpt-4o-mini",
    maxTokens: 250,
    description: "High-quality balanced content generation",
  },
  3: {
    // Business Plan
    model: "gpt-4o",
    maxTokens: 500,
    description: "Premium enterprise-grade content generation",
  },
};

/**
 * Get model configuration for a given plan ID
 * @param planId - User's plan ID (1: Basic, 2: Pro, 3: Business)
 * @returns ModelConfig with model name and max tokens
 */
export function getModelConfig(planId: number | undefined): ModelConfig {
  // Default to Basic plan if planId is missing or invalid
  const config = MODEL_TIERS[planId ?? 1];

  if (!config) {
    console.warn(`Invalid planId ${planId}, defaulting to Basic plan model`);
    return MODEL_TIERS[1];
  }

  return config;
}

/**
 * Get model name directly for a plan ID
 * @param planId - User's plan ID
 * @returns OpenAI model name
 */
export function getModelForPlan(planId: number | undefined): string {
  return getModelConfig(planId).model;
}

/**
 * Get max tokens for a plan ID
 * @param planId - User's plan ID
 * @returns Maximum tokens for generation
 */
export function getMaxTokensForPlan(planId: number | undefined): number {
  return getModelConfig(planId).maxTokens;
}
