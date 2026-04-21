// ConfigHelper.ts
import fs from "node:fs"
import path from "node:path"
import { app } from "electron"
import { EventEmitter } from "events"
import { OpenAI } from "openai"
import {
  APIProvider,
  DEFAULT_PROVIDER,
  DEFAULT_MODELS,
  PROVIDER_BASE_URLS,
  sanitizeModelSelection,
} from "../shared/aiModels";

export interface CandidateProfile {
  name?: string;
  resume?: string;  // Full resume text
  jobDescription?: string; // Target role/job description
}

interface Config {
  apiKey: string;
  apiProvider: APIProvider;  // Added provider selection
  extractionModel: string;
  solutionModel: string;
  debuggingModel: string;
  answerModel: string;  // Model for AI answer suggestions in conversations
  speechRecognitionModel: string;  // Speech recognition model (Whisper for OpenAI)
  language: string;
  opacity: number;
  candidateProfile?: CandidateProfile;  // Candidate profile for personalized AI suggestions
}

export class ConfigHelper extends EventEmitter {
  private configPath: string;
  private defaultConfig: Config = {
    apiKey: "",
    apiProvider: DEFAULT_PROVIDER,
    extractionModel: DEFAULT_MODELS[DEFAULT_PROVIDER].extractionModel,
    solutionModel: DEFAULT_MODELS[DEFAULT_PROVIDER].solutionModel,
    debuggingModel: DEFAULT_MODELS[DEFAULT_PROVIDER].debuggingModel,
    answerModel: DEFAULT_MODELS[DEFAULT_PROVIDER].answerModel,
    speechRecognitionModel:
      DEFAULT_MODELS.openai.speechRecognitionModel || "whisper-1",
    language: "python",
    opacity: 1.0,
    candidateProfile: {
      name: "",
      resume: "",
      jobDescription: ""
    }
  };

  constructor() {
    super();
    // Use the app's user data directory to store the config
    try {
      this.configPath = path.join(app.getPath('userData'), 'config.json');
      console.log('Config path:', this.configPath);
    } catch (err) {
      console.warn('Could not access user data path, using fallback');
      this.configPath = path.join(process.cwd(), 'config.json');
    }
    
    // Ensure the initial config file exists
    this.ensureConfigExists();
  }

  /**
   * Ensure config file exists
   */
  private ensureConfigExists(): void {
    try {
      if (!fs.existsSync(this.configPath)) {
        this.saveConfig(this.defaultConfig);
      }
    } catch (err) {
      console.error("Error ensuring config exists:", err);
    }
  }

  /**
   * Validate and sanitize model selection to ensure only allowed models are used.
   * Delegates to shared model configuration for single source of truth.
   */
  public loadConfig(): Config {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        const config = JSON.parse(configData);
        
        // Ensure apiProvider is a valid value
        const validProviders: APIProvider[] = ["openai", "gemini", "anthropic", "deepseek", "groq", "openrouter"];
        if (!validProviders.includes(config.apiProvider)) {
          config.apiProvider = DEFAULT_PROVIDER; // Default to shared provider if invalid
        }

        // Drop any stored apiKey that is obviously malformed (HTML, whitespace, etc.).
        // This recovers from a previously corrupted config without the user having to
        // manually edit the file.
        if (typeof config.apiKey === "string") {
          const trimmed = config.apiKey.trim();
          const looksBogus =
            trimmed.length > 0 && (
              /[\s<>]/.test(trimmed) ||
              trimmed.length > 400 ||
              trimmed.length < 10
            );
          if (looksBogus) {
            console.warn("Dropping malformed stored apiKey — please re-enter in Settings.");
            config.apiKey = "";
          } else {
            config.apiKey = trimmed;
          }
        } else if (config.apiKey !== undefined) {
          config.apiKey = "";
        }
        
        // Sanitize model selections to ensure only allowed models are used
        if (config.extractionModel) {
          config.extractionModel = sanitizeModelSelection(
            config.extractionModel,
            config.apiProvider,
            "extractionModel"
          );
        }
        if (config.solutionModel) {
          config.solutionModel = sanitizeModelSelection(
            config.solutionModel,
            config.apiProvider,
            "solutionModel"
          );
        }
        if (config.debuggingModel) {
          config.debuggingModel = sanitizeModelSelection(
            config.debuggingModel,
            config.apiProvider,
            "debuggingModel"
          );
        }
        if (config.answerModel) {
          config.answerModel = sanitizeModelSelection(
            config.answerModel,
            config.apiProvider,
            "answerModel"
          );
        }
        
        // Ensure speechRecognitionModel is valid
        if (config.speechRecognitionModel) {
          if (config.apiProvider === "openai" && config.speechRecognitionModel !== "whisper-1") {
            config.speechRecognitionModel = "whisper-1";
          } else if (config.apiProvider === "gemini") {
            const allowedGeminiSpeechModels = [
              "gemini-1.5-flash",
              "gemini-1.5-pro",
              "gemini-2.0-flash",
              "gemini-2.0-flash-lite",
              "gemini-2.5-flash-preview-04-17",
              "gemini-2.5-pro-preview-05-06",
            ];
            if (!allowedGeminiSpeechModels.includes(config.speechRecognitionModel)) {
              config.speechRecognitionModel = DEFAULT_MODELS.gemini.speechRecognitionModel || "gemini-2.0-flash";
            }
          }
        } else if (!config.speechRecognitionModel) {
          config.speechRecognitionModel = this.defaultConfig.speechRecognitionModel;
        }
        
        return {
          ...this.defaultConfig,
          ...config
        };
      }
      
      // If no config exists, create a default one
      this.saveConfig(this.defaultConfig);
      return this.defaultConfig;
    } catch (err) {
      console.error("Error loading config:", err);
      return this.defaultConfig;
    }
  }

  /**
   * Save configuration to disk
   */
  public saveConfig(config: Config): void {
    try {
      // Ensure the directory exists
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      // Write the config file
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (err) {
      console.error("Error saving config:", err);
    }
  }

  /**
   * Update specific configuration values
   */
  public updateConfig(updates: Partial<Config>): Config {
    try {
      const currentConfig = this.loadConfig();

      // Sanitize API key before anything else. Reject obviously invalid
      // values (HTML fragments, multi-line blobs, whitespace-only) rather
      // than storing them and failing later inside the SDK.
      if (updates.apiKey !== undefined) {
        if (typeof updates.apiKey !== "string") {
          console.warn("Rejecting non-string apiKey in updateConfig");
          delete updates.apiKey;
        } else {
          const trimmed = updates.apiKey.trim();
          const looksBogus =
            trimmed.length > 0 && (
              /[\s<>]/.test(trimmed) ||
              trimmed.length > 400 ||
              trimmed.length < 10
            );
          if (looksBogus) {
            console.warn(
              `Rejecting malformed apiKey (length=${trimmed.length}, first chars="${trimmed.substring(0, 20)}")`
            );
            delete updates.apiKey;
          } else {
            // Always store the trimmed, whitespace-free version
            updates.apiKey = trimmed;
          }
        }
      }

      let provider: APIProvider = updates.apiProvider || currentConfig.apiProvider;

      // Auto-detect provider based on API key format if a new key is provided
      // Only auto-detect if provider was NOT explicitly set by the user
      if (updates.apiKey && !updates.apiProvider) {
        const key = updates.apiKey.trim();
        if (key.startsWith('sk-ant-')) {
          provider = "anthropic";
          console.log("Auto-detected Anthropic API key format");
        } else if (key.startsWith('sk-or-')) {
          provider = "openrouter";
          console.log("Auto-detected OpenRouter API key format");
        } else if (key.startsWith('gsk_')) {
          provider = "groq";
          console.log("Auto-detected Groq API key format");
        } else if (key.startsWith('sk-')) {
          // Could be OpenAI or DeepSeek — keep current provider if it's one of those
          if (currentConfig.apiProvider === "deepseek") {
            provider = "deepseek";
          } else {
            provider = "openai";
          }
          console.log(`Auto-detected ${provider} API key format`);
        } else {
          provider = "gemini";
          console.log("Using Gemini API key format (default)");
        }

        updates.apiProvider = provider;
      }
      
      // If provider is changing, reset models to the default for that provider
      if (updates.apiProvider && updates.apiProvider !== currentConfig.apiProvider) {
        const defaults = DEFAULT_MODELS[updates.apiProvider];
        updates.extractionModel = defaults.extractionModel;
        updates.solutionModel = defaults.solutionModel;
        updates.debuggingModel = defaults.debuggingModel;
        updates.answerModel = defaults.answerModel;
        // Speech recognition supported for OpenAI and Gemini
        if (defaults.speechRecognitionModel) {
          updates.speechRecognitionModel = defaults.speechRecognitionModel;
        }
      }
      
      // Validate speech recognition model
      if (updates.speechRecognitionModel) {
        if (provider === "openai" && updates.speechRecognitionModel !== "whisper-1") {
          console.warn(`Invalid speech recognition model: ${updates.speechRecognitionModel}. Only whisper-1 is supported for OpenAI.`);
          updates.speechRecognitionModel = "whisper-1";
        } else if (provider === "gemini") {
          const allowedGeminiSpeechModels = [
            "gemini-1.5-flash",
            "gemini-1.5-pro",
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
            "gemini-2.5-flash-preview-04-17",
            "gemini-2.5-pro-preview-05-06",
          ];
          if (!allowedGeminiSpeechModels.includes(updates.speechRecognitionModel)) {
            const defaultModel = DEFAULT_MODELS[provider].speechRecognitionModel || "gemini-2.0-flash";
            console.warn(`Invalid Gemini speech recognition model: ${updates.speechRecognitionModel}. Using default: ${defaultModel}`);
            updates.speechRecognitionModel = defaultModel;
          }
        }
        // Other providers (deepseek, groq, openrouter) don't have built-in speech recognition
      }
      
      // Sanitize model selections in the updates
      if (updates.extractionModel) {
        updates.extractionModel = sanitizeModelSelection(
          updates.extractionModel,
          provider,
          "extractionModel"
        );
      }
      if (updates.solutionModel) {
        updates.solutionModel = sanitizeModelSelection(
          updates.solutionModel,
          provider,
          "solutionModel"
        );
      }
      if (updates.debuggingModel) {
        updates.debuggingModel = sanitizeModelSelection(
          updates.debuggingModel,
          provider,
          "debuggingModel"
        );
      }
      if (updates.answerModel) {
        updates.answerModel = sanitizeModelSelection(
          updates.answerModel,
          provider,
          "answerModel"
        );
      }
      
      const newConfig = { ...currentConfig, ...updates };
      this.saveConfig(newConfig);
      
      // Only emit update event for changes other than opacity
      // This prevents re-initializing the AI client when only opacity changes
      if (updates.apiKey !== undefined || updates.apiProvider !== undefined || 
          updates.extractionModel !== undefined || updates.solutionModel !== undefined || 
          updates.debuggingModel !== undefined || updates.answerModel !== undefined ||
          updates.speechRecognitionModel !== undefined || 
          updates.language !== undefined) {
        this.emit('config-updated', newConfig);
      }
      
      return newConfig;
    } catch (error) {
      console.error('Error updating config:', error);
      return this.defaultConfig;
    }
  }

  /**
   * Check if the API key is configured
   */
  public hasApiKey(): boolean {
    const config = this.loadConfig();
    return !!config.apiKey && config.apiKey.trim().length > 0;
  }
  
  /**
   * Validate the API key format
   */
  public isValidApiKeyFormat(apiKey: string, provider?: APIProvider): boolean {
    const key = apiKey.trim();

    // If provider is not specified, attempt to auto-detect
    if (!provider) {
      if (key.startsWith('sk-ant-')) provider = "anthropic";
      else if (key.startsWith('sk-or-')) provider = "openrouter";
      else if (key.startsWith('gsk_')) provider = "groq";
      else if (key.startsWith('sk-')) provider = "openai";
      else provider = "gemini";
    }

    switch (provider) {
      case "openai":
        return /^sk-[a-zA-Z0-9_-]{32,}$/.test(key);
      case "anthropic":
        return /^sk-ant-[a-zA-Z0-9_-]{32,}$/.test(key);
      case "groq":
        return /^gsk_[a-zA-Z0-9]{32,}$/.test(key);
      case "openrouter":
        return /^sk-or-[a-zA-Z0-9_-]{20,}$/.test(key);
      case "deepseek":
        return /^sk-[a-zA-Z0-9]{32,}$/.test(key);
      case "gemini":
        return key.length >= 10;
      default:
        return key.length >= 10;
    }
  }
  
  /**
   * Get the stored opacity value
   */
  public getOpacity(): number {
    const config = this.loadConfig();
    return config.opacity !== undefined ? config.opacity : 1.0;
  }

  /**
   * Set the window opacity value
   */
  public setOpacity(opacity: number): void {
    // Ensure opacity is between 0.1 and 1.0
    const validOpacity = Math.min(1.0, Math.max(0.1, opacity));
    this.updateConfig({ opacity: validOpacity });
  }  
  
  /**
   * Get the preferred programming language
   */
  public getLanguage(): string {
    const config = this.loadConfig();
    return config.language || "python";
  }

  /**
   * Set the preferred programming language
   */
  public setLanguage(language: string): void {
    this.updateConfig({ language });
  }
  
  /**
   * Test API key with the selected provider
   */
  public async testApiKey(apiKey: string, provider?: APIProvider): Promise<{valid: boolean, error?: string}> {
    // Auto-detect provider based on key format if not specified
    if (!provider) {
      const key = apiKey.trim();
      if (key.startsWith('sk-ant-')) provider = "anthropic";
      else if (key.startsWith('sk-or-')) provider = "openrouter";
      else if (key.startsWith('gsk_')) provider = "groq";
      else if (key.startsWith('sk-')) provider = "openai";
      else provider = "gemini";
      console.log(`Auto-detected ${provider} API key format for testing`);
    }

    switch (provider) {
      case "openai":
        return this.testOpenAIKey(apiKey);
      case "gemini":
        return this.testGeminiKey(apiKey);
      case "anthropic":
        return this.testAnthropicKey(apiKey);
      case "deepseek":
      case "groq":
      case "openrouter":
        return this.testOpenAICompatibleKey(apiKey, provider);
      default:
        return { valid: false, error: "Unknown API provider" };
    }
  }
  
  /**
   * Test OpenAI API key
   */
  private async testOpenAIKey(apiKey: string): Promise<{valid: boolean, error?: string}> {
    try {
      const openai = new OpenAI({ apiKey });
      // Make a simple API call to test the key
      await openai.models.list();
      return { valid: true };
    } catch (error: any) {
      console.error('OpenAI API key test failed:', error);
      
      // Determine the specific error type for better error messages
      let errorMessage = 'Unknown error validating OpenAI API key';
      
      if (error.status === 401) {
        errorMessage = 'Invalid API key. Please check your OpenAI key and try again.';
      } else if (error.status === 429) {
        errorMessage = 'Rate limit exceeded. Your OpenAI API key has reached its request limit or has insufficient quota.';
      } else if (error.status === 500) {
        errorMessage = 'OpenAI server error. Please try again later.';
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      return { valid: false, error: errorMessage };
    }
  }
  
  /**
   * Test Gemini API key
   * Note: This is a simplified implementation since we don't have the actual Gemini client
   */
  private async testGeminiKey(apiKey: string): Promise<{valid: boolean, error?: string}> {
    try {
      // For now, we'll just do a basic check to ensure the key exists and has valid format
      // In production, you would connect to the Gemini API and validate the key
      if (apiKey && apiKey.trim().length >= 20) {
        // Here you would actually validate the key with a Gemini API call
        return { valid: true };
      }
      return { valid: false, error: 'Invalid Gemini API key format.' };
    } catch (error: any) {
      console.error('Gemini API key test failed:', error);
      let errorMessage = 'Unknown error validating Gemini API key';
      
      if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      return { valid: false, error: errorMessage };
    }
  }

  /**
   * Test OpenAI-compatible API key (DeepSeek, Groq, OpenRouter)
   */
  private async testOpenAICompatibleKey(apiKey: string, provider: APIProvider): Promise<{valid: boolean, error?: string}> {
    try {
      const baseURL = PROVIDER_BASE_URLS[provider];
      const openai = new OpenAI({ apiKey, baseURL });
      await openai.models.list();
      return { valid: true };
    } catch (error: any) {
      console.error(`${provider} API key test failed:`, error);
      let errorMessage = `Unknown error validating ${provider} API key`;

      if (error.status === 401) {
        errorMessage = `Invalid API key. Please check your ${provider} key and try again.`;
      } else if (error.status === 429) {
        errorMessage = `Rate limit exceeded on ${provider}. Please try again later.`;
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }

      return { valid: false, error: errorMessage };
    }
  }

  /**
   * Test Anthropic API key
   * Note: This is a simplified implementation since we don't have the actual Anthropic client
   */
  private async testAnthropicKey(apiKey: string): Promise<{valid: boolean, error?: string}> {
    try {
      // For now, we'll just do a basic check to ensure the key exists and has valid format
      // In production, you would connect to the Anthropic API and validate the key
      if (apiKey && /^sk-ant-[a-zA-Z0-9]{32,}$/.test(apiKey.trim())) {
        // Here you would actually validate the key with an Anthropic API call
        return { valid: true };
      }
      return { valid: false, error: 'Invalid Anthropic API key format.' };
    } catch (error: any) {
      console.error('Anthropic API key test failed:', error);
      let errorMessage = 'Unknown error validating Anthropic API key';
      
      if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      return { valid: false, error: errorMessage };
    }
  }
}

// Export a singleton instance
export const configHelper = new ConfigHelper();
