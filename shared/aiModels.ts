// shared/aiModels.ts
// Central configuration for AI providers, models, and related helpers.
// This module is the single source of truth for:
// - Supported providers
// - Available models per provider and category
// - Default models per provider and category
// - Model validation/sanitization
//
// Changing models or providers should only require edits in this file.

export type APIProvider = "openai" | "gemini" | "anthropic" | "deepseek" | "groq" | "openrouter";

export type ModelCategoryKey =
  | "extractionModel"
  | "solutionModel"
  | "debuggingModel"
  | "answerModel";

export interface AIModel {
  id: string;
  name: string;
  description: string;
}

export interface ModelCategoryDefinition {
  key: ModelCategoryKey;
  title: string;
  description: string;
  modelsByProvider: Record<APIProvider, AIModel[]>;
}

/**
 * Base URLs for OpenAI-compatible providers.
 * Providers not listed here use their own SDK (Anthropic) or REST calls (Gemini).
 */
export const PROVIDER_BASE_URLS: Partial<Record<APIProvider, string>> = {
  openai: "https://api.openai.com/v1",
  deepseek: "https://api.deepseek.com",
  groq: "https://api.groq.com/openai/v1",
  openrouter: "https://openrouter.ai/api/v1",
};

/**
 * Display names for providers shown in the Settings UI.
 */
export const PROVIDER_DISPLAY_NAMES: Record<APIProvider, string> = {
  openai: "OpenAI",
  gemini: "Gemini",
  anthropic: "Claude",
  deepseek: "DeepSeek",
  groq: "Groq",
  openrouter: "OpenRouter",
};

/**
 * Short descriptions shown under each provider name in the Settings UI.
 */
export const PROVIDER_DESCRIPTIONS: Record<APIProvider, string> = {
  openai: "GPT-4o, o3, o4-mini",
  gemini: "Gemini 2.5 & 2.0",
  anthropic: "Claude 4.6 & 4.7",
  deepseek: "DeepSeek V3 & R1",
  groq: "Ultra-fast inference",
  openrouter: "Multi-provider gateway",
};

/**
 * Whether a provider uses the OpenAI-compatible chat completions API.
 * If true, we create an OpenAI client with the provider's baseURL.
 */
export const PROVIDER_IS_OPENAI_COMPATIBLE: Record<APIProvider, boolean> = {
  openai: true,
  gemini: false,
  anthropic: false,
  deepseek: true,
  groq: true,
  openrouter: true,
};

/**
 * Default provider used when no provider is configured or an invalid provider is found.
 */
export const DEFAULT_PROVIDER: APIProvider = "gemini";

/**
 * Default models per provider and category.
 * These are used for:
 * - Initial config defaults
 * - Resetting models when provider changes
 * - Fallbacks when a model is missing in config
 */
export const DEFAULT_MODELS: Record<
  APIProvider,
  {
    extractionModel: string;
    solutionModel: string;
    debuggingModel: string;
    answerModel: string;
    // Speech recognition is supported for OpenAI (Whisper) and Gemini (Audio Understanding)
    speechRecognitionModel?: string;
  }
> = {
  openai: {
    extractionModel: "gpt-4o",
    solutionModel: "gpt-4o",
    debuggingModel: "gpt-4o",
    answerModel: "gpt-4o-mini",
    speechRecognitionModel: "whisper-1",
  },
  gemini: {
    extractionModel: "gemini-2.5-flash-preview-04-17",
    solutionModel: "gemini-2.5-pro-preview-05-06",
    debuggingModel: "gemini-2.5-flash-preview-04-17",
    answerModel: "gemini-2.0-flash",
    speechRecognitionModel: "gemini-2.0-flash",
  },
  anthropic: {
    // Default to Claude Sonnet 4.6 — latest at time of writing.
    // If the key doesn't have access, the smart fallback in ProcessingHelper
    // will auto-discover via /v1/models and pick the best available.
    extractionModel: "claude-sonnet-4-6",
    solutionModel: "claude-sonnet-4-6",
    debuggingModel: "claude-sonnet-4-6",
    answerModel: "claude-haiku-4-6",
  },
  deepseek: {
    extractionModel: "deepseek-chat",
    solutionModel: "deepseek-chat",
    debuggingModel: "deepseek-chat",
    answerModel: "deepseek-chat",
  },
  groq: {
    extractionModel: "llama-3.3-70b-versatile",
    solutionModel: "llama-3.3-70b-versatile",
    debuggingModel: "llama-3.3-70b-versatile",
    answerModel: "llama-3.3-70b-versatile",
  },
  openrouter: {
    extractionModel: "anthropic/claude-sonnet-4-5",
    solutionModel: "anthropic/claude-sonnet-4-5",
    debuggingModel: "anthropic/claude-sonnet-4-5",
    answerModel: "deepseek/deepseek-chat-v3-0324:free",
  },
};

/**
 * Default models specifically for the answer suggestion assistant.
 */
export const DEFAULT_ANSWER_MODELS: Record<APIProvider, string> = {
  openai: "gpt-4o-mini",
  gemini: "gemini-2.0-flash",
  anthropic: "claude-haiku-4-6",
  // (above is DEFAULT_ANSWER_MODELS.anthropic — kept concise for speed)
  deepseek: "deepseek-chat",
  groq: "llama-3.3-70b-versatile",
  openrouter: "deepseek/deepseek-chat-v3-0324:free",
};

/**
 * Allowed model ids per provider.
 * Used for validation/sanitization when reading or updating config.
 */
export const ALLOWED_MODELS: Record<APIProvider, string[]> = {
  openai: [
    // GPT-4o family
    "gpt-4o",
    "gpt-4o-mini",
    // Reasoning models
    "o1",
    "o1-mini",
    "o3",
    "o3-mini",
    "o4-mini",
    // Legacy
    "gpt-4-turbo",
  ],
  gemini: [
    // Gemini 2.5 (latest)
    "gemini-2.5-pro-preview-05-06",
    "gemini-2.5-flash-preview-04-17",
    // Gemini 2.0
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    // Legacy
    "gemini-1.5-pro",
    "gemini-1.5-flash",
  ],
  // Anthropic: sanitizeModelSelection() also accepts any claude-* id
  // (so the app doesn't reject new models the user's key actually supports).
  anthropic: [
    // Claude 4.7
    "claude-opus-4-7",
    "claude-sonnet-4-7",
    "claude-haiku-4-7",
    // Claude 4.6
    "claude-opus-4-6",
    "claude-sonnet-4-6",
    "claude-haiku-4-6",
    // Claude 4.5
    "claude-opus-4-5",
    "claude-sonnet-4-5",
    "claude-haiku-4-5",
    // Claude 4.1 / 4
    "claude-opus-4-1",
    "claude-opus-4",
    "claude-sonnet-4",
    // Claude 3.7
    "claude-3-7-sonnet-20250219",
    "claude-3-7-sonnet-latest",
    // Claude 3.5 — fallbacks for older-access accounts
    "claude-3-5-sonnet-20241022",
    "claude-3-5-sonnet-latest",
    "claude-3-5-haiku-20241022",
    "claude-3-5-haiku-latest",
    // Claude 3 legacy
    "claude-3-opus-20240229",
    "claude-3-opus-latest",
    "claude-3-sonnet-20240229",
    "claude-3-haiku-20240307",
  ],
  deepseek: [
    "deepseek-chat",        // DeepSeek V3
    "deepseek-reasoner",    // DeepSeek R1
  ],
  groq: [
    "llama-3.3-70b-versatile",
    "llama-3.1-70b-versatile",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768",
    "deepseek-r1-distill-llama-70b",
    "gemma2-9b-it",
  ],
  openrouter: [
    // OpenRouter uses provider/model format - allow anything since it routes to many providers
    "anthropic/claude-sonnet-4-5",
    "anthropic/claude-sonnet-4-5",
    "anthropic/claude-3-5-sonnet-20241022",
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "openai/o3-mini",
    "google/gemini-2.5-pro-preview-05-06",
    "google/gemini-2.5-flash-preview-04-17",
    "deepseek/deepseek-chat-v3-0324:free",
    "deepseek/deepseek-r1:free",
    "meta-llama/llama-3.3-70b-instruct",
    "qwen/qwen-2.5-coder-32b-instruct",
    "mistralai/mistral-large-latest",
  ],
};

/**
 * Settings UI model catalogue, organized by functional category and provider.
 */
export const MODEL_CATEGORIES: ModelCategoryDefinition[] = [
  {
    key: "extractionModel",
    title: "Problem Extraction",
    description:
      "Model used to analyze screenshots and extract problem details",
    modelsByProvider: {
      openai: [
        { id: "gpt-4o", name: "GPT-4o", description: "Best overall for vision and extraction" },
        { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "Faster, cheaper — still great at vision" },
        { id: "o4-mini", name: "o4-mini", description: "Reasoning model with vision support" },
        { id: "gpt-4-turbo", name: "GPT-4 Turbo", description: "Legacy — use GPT-4o instead" },
      ],
      gemini: [
        { id: "gemini-2.5-pro-preview-05-06", name: "Gemini 2.5 Pro", description: "Best Gemini model for complex extraction" },
        { id: "gemini-2.5-flash-preview-04-17", name: "Gemini 2.5 Flash", description: "Fast and capable — best balance" },
        { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", description: "Fast and reliable" },
        { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite", description: "Ultra-fast, cheapest option" },
        { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", description: "Legacy — use 2.5 for best results" },
      ],
      anthropic: [
        { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", description: "Recommended — latest Claude 4.x" },
        { id: "claude-opus-4-6", name: "Claude Opus 4.6", description: "Most capable — use for hardest problems" },
        { id: "claude-haiku-4-6", name: "Claude Haiku 4.6", description: "Fast and cheap, still Claude 4.x" },
        { id: "claude-sonnet-4-7", name: "Claude Sonnet 4.7 (if available)", description: "Newest — only if your key has early access" },
        { id: "claude-opus-4-7", name: "Claude Opus 4.7 (if available)", description: "Newest Opus — early access" },
        { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", description: "Prior release" },
        { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet", description: "Fallback for older-access keys" },
      ],
      deepseek: [
        { id: "deepseek-chat", name: "DeepSeek V3", description: "Strong coding model, very cost-effective" },
        { id: "deepseek-reasoner", name: "DeepSeek R1", description: "Reasoning model — slower but more thorough" },
      ],
      groq: [
        { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", description: "Best overall, lightning fast on Groq" },
        { id: "llama-3.1-70b-versatile", name: "Llama 3.1 70B", description: "Reliable, fast inference" },
        { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B", description: "Ultra-fast, good for simple tasks" },
        { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", description: "Good balance of speed and quality" },
      ],
      openrouter: [
        { id: "anthropic/claude-sonnet-4-5", name: "Claude Sonnet 4.5", description: "Best extraction via OpenRouter" },
        { id: "openai/gpt-4o", name: "GPT-4o", description: "OpenAI's best vision model" },
        { id: "google/gemini-2.5-pro-preview-05-06", name: "Gemini 2.5 Pro", description: "Google's best model" },
        { id: "deepseek/deepseek-chat-v3-0324:free", name: "DeepSeek V3 (Free)", description: "Free tier, strong coding" },
      ],
    },
  },
  {
    key: "solutionModel",
    title: "Solution Generation",
    description: "Model used to generate coding solutions",
    modelsByProvider: {
      openai: [
        { id: "o3", name: "o3", description: "Best reasoning — ideal for hard coding problems" },
        { id: "o4-mini", name: "o4-mini", description: "Fast reasoning — great cost/performance ratio" },
        { id: "o3-mini", name: "o3-mini", description: "Efficient reasoning model" },
        { id: "gpt-4o", name: "GPT-4o", description: "Strong general coding performance" },
        { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "Faster, more cost-effective" },
      ],
      gemini: [
        { id: "gemini-2.5-pro-preview-05-06", name: "Gemini 2.5 Pro", description: "Best Gemini for coding — use this for hard problems" },
        { id: "gemini-2.5-flash-preview-04-17", name: "Gemini 2.5 Flash", description: "Fast and capable — good for most problems" },
        { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", description: "Fast and reliable" },
        { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", description: "Legacy — use 2.5 for best results" },
      ],
      anthropic: [
        { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet", description: "Best coder — extended thinking enabled" },
        { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", description: "Reliable coding performance" },
        { id: "claude-3-opus-20240229", name: "Claude 3 Opus", description: "Legacy — use Claude 4 for best results" },
      ],
      deepseek: [
        { id: "deepseek-chat", name: "DeepSeek V3", description: "Excellent coder, GPT-4 level at fraction of cost" },
        { id: "deepseek-reasoner", name: "DeepSeek R1", description: "Deep reasoning — best for complex algorithms" },
      ],
      groq: [
        { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", description: "Best coding on Groq, ultra-fast" },
        { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Distill 70B", description: "Reasoning-tuned, great for DSA" },
        { id: "llama-3.1-70b-versatile", name: "Llama 3.1 70B", description: "Reliable, fast inference" },
        { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", description: "Good balance, 32K context" },
      ],
      openrouter: [
        { id: "anthropic/claude-sonnet-4-5", name: "Claude Sonnet 4.5", description: "Top-tier coding via OpenRouter" },
        { id: "openai/o3-mini", name: "o3-mini", description: "OpenAI reasoning, great for DSA" },
        { id: "deepseek/deepseek-chat-v3-0324:free", name: "DeepSeek V3 (Free)", description: "Free tier, excellent coder" },
        { id: "deepseek/deepseek-r1:free", name: "DeepSeek R1 (Free)", description: "Free reasoning model" },
        { id: "qwen/qwen-2.5-coder-32b-instruct", name: "Qwen 2.5 Coder 32B", description: "Specialized coding model" },
        { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", description: "Open-source, strong coder" },
      ],
    },
  },
  {
    key: "debuggingModel",
    title: "Debugging",
    description: "Model used to debug and improve solutions",
    modelsByProvider: {
      openai: [
        { id: "o3", name: "o3", description: "Best at finding subtle bugs" },
        { id: "o4-mini", name: "o4-mini", description: "Fast reasoning for debugging" },
        { id: "gpt-4o", name: "GPT-4o", description: "Good at analyzing code and errors" },
        { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "Faster, more cost-effective" },
      ],
      gemini: [
        { id: "gemini-2.5-pro-preview-05-06", name: "Gemini 2.5 Pro", description: "Best Gemini for deep debugging" },
        { id: "gemini-2.5-flash-preview-04-17", name: "Gemini 2.5 Flash", description: "Fast debugging, good accuracy" },
        { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", description: "Quick turnaround" },
        { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", description: "Legacy — use 2.5 for best results" },
      ],
      anthropic: [
        { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet", description: "Best for tricky bugs — extended thinking" },
        { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", description: "Reliable debugging" },
        { id: "claude-3-opus-20240229", name: "Claude 3 Opus", description: "Legacy — use Claude 4 for best results" },
      ],
      deepseek: [
        { id: "deepseek-chat", name: "DeepSeek V3", description: "Good at code analysis and fixes" },
        { id: "deepseek-reasoner", name: "DeepSeek R1", description: "Deep reasoning for tricky bugs" },
      ],
      groq: [
        { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", description: "Fast debugging on Groq" },
        { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Distill 70B", description: "Reasoning-tuned for bug finding" },
        { id: "llama-3.1-70b-versatile", name: "Llama 3.1 70B", description: "Reliable debugging" },
      ],
      openrouter: [
        { id: "anthropic/claude-sonnet-4-5", name: "Claude Sonnet 4.5", description: "Best debugging via OpenRouter" },
        { id: "openai/o3-mini", name: "o3-mini", description: "Reasoning model for bug hunting" },
        { id: "deepseek/deepseek-r1:free", name: "DeepSeek R1 (Free)", description: "Free reasoning for debugging" },
        { id: "mistralai/mistral-large-latest", name: "Mistral Large", description: "Strong code understanding" },
      ],
    },
  },
  {
    key: "answerModel",
    title: "Answer Suggestions",
    description: "Model used to generate AI answer suggestions for conversation questions",
    modelsByProvider: {
      openai: [
        { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "Fast and cost-effective for suggestions" },
        { id: "gpt-4o", name: "GPT-4o", description: "Best overall for nuanced answers" },
        { id: "o4-mini", name: "o4-mini", description: "Reasoning for complex interview questions" },
      ],
      gemini: [
        { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", description: "Fast, great for quick suggestions" },
        { id: "gemini-2.5-flash-preview-04-17", name: "Gemini 2.5 Flash", description: "Better quality, still fast" },
        { id: "gemini-2.5-pro-preview-05-06", name: "Gemini 2.5 Pro", description: "Best quality for complex questions" },
        { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite", description: "Ultra-fast, cheapest option" },
      ],
      anthropic: [
        { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", description: "Fastest, cheapest — great for suggestions" },
        { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet", description: "Better quality for complex questions" },
        { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", description: "Balanced performance" },
      ],
      deepseek: [
        { id: "deepseek-chat", name: "DeepSeek V3", description: "Fast, cost-effective suggestions" },
        { id: "deepseek-reasoner", name: "DeepSeek R1", description: "Deep reasoning for complex questions" },
      ],
      groq: [
        { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", description: "Best quality on Groq" },
        { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B", description: "Ultra-fast responses" },
        { id: "gemma2-9b-it", name: "Gemma 2 9B", description: "Good quality, very fast" },
      ],
      openrouter: [
        { id: "deepseek/deepseek-chat-v3-0324:free", name: "DeepSeek V3 (Free)", description: "Free, fast suggestions" },
        { id: "anthropic/claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", description: "High quality suggestions" },
        { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", description: "Open-source, fast" },
        { id: "google/gemini-2.5-flash-preview-04-17", name: "Gemini 2.5 Flash", description: "Fast and capable" },
      ],
    },
  },
];

/**
 * Links to API key signup pages for each provider.
 */
export const PROVIDER_API_KEY_LINKS: Record<APIProvider, { signup: string; keys: string }> = {
  openai: {
    signup: "https://platform.openai.com/signup",
    keys: "https://platform.openai.com/api-keys",
  },
  gemini: {
    signup: "https://aistudio.google.com/",
    keys: "https://aistudio.google.com/app/apikey",
  },
  anthropic: {
    signup: "https://console.anthropic.com/signup",
    keys: "https://console.anthropic.com/settings/keys",
  },
  deepseek: {
    signup: "https://platform.deepseek.com/sign_up",
    keys: "https://platform.deepseek.com/api_keys",
  },
  groq: {
    signup: "https://console.groq.com/signup",
    keys: "https://console.groq.com/keys",
  },
  openrouter: {
    signup: "https://openrouter.ai/sign-up",
    keys: "https://openrouter.ai/keys",
  },
};

/**
 * API key placeholder hints per provider.
 */
export const PROVIDER_KEY_PLACEHOLDERS: Record<APIProvider, string> = {
  openai: "sk-...",
  gemini: "Enter your Gemini API key",
  anthropic: "sk-ant-...",
  deepseek: "sk-...",
  groq: "gsk_...",
  openrouter: "sk-or-v1-...",
};

/**
 * Sanitize a model selection to ensure only allowed models are used.
 * If the model is not allowed for the provider, the provider's default
 * model for the given category is returned.
 *
 * OpenRouter is more permissive — it allows any model string that contains a "/".
 */
export function sanitizeModelSelection(
  model: string,
  provider: APIProvider,
  category: ModelCategoryKey
): string {
  // OpenRouter allows arbitrary provider/model combinations
  if (provider === "openrouter" && model.includes("/")) {
    return model;
  }

  // Anthropic releases new model IDs frequently; accept any id that looks
  // like a Claude model rather than hardcoding a rigid allow-list that
  // would reject new releases the user's key actually supports.
  if (provider === "anthropic" && /^claude-[a-z0-9._-]+$/i.test(model)) {
    return model;
  }

  const allowed = ALLOWED_MODELS[provider];
  if (allowed.includes(model)) {
    return model;
  }

  const fallback = DEFAULT_MODELS[provider][category];
  // eslint-disable-next-line no-console
  console.warn(
    `Invalid ${provider} model specified for ${category}: ${model}. Using default model: ${fallback}`
  );
  return fallback;
}
