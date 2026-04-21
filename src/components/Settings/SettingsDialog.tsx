import { useState, useEffect, useRef } from "react";
// Dialog components no longer used - settings rendered as inline overlay
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Settings } from "lucide-react";
import { useToast } from "../../contexts/toast";
import { CandidateProfileSection, CandidateProfile } from "./CandidateProfileSection";
import {
  APIProvider,
  AIModel,
  MODEL_CATEGORIES,
  DEFAULT_MODELS,
  PROVIDER_DISPLAY_NAMES,
  PROVIDER_DESCRIPTIONS,
  PROVIDER_KEY_PLACEHOLDERS,
  PROVIDER_API_KEY_LINKS,
  PROVIDER_IS_OPENAI_COMPATIBLE,
} from "../../../shared/aiModels";

interface SettingsDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SettingsDialog({ open: externalOpen, onOpenChange }: SettingsDialogProps) {
  const [open, setOpen] = useState(externalOpen || false);
  const [apiKey, setApiKey] = useState("");
  const [apiProvider, setApiProvider] = useState<APIProvider>("openai");
  const [extractionModel, setExtractionModel] = useState(
    DEFAULT_MODELS.openai.extractionModel
  );
  const [solutionModel, setSolutionModel] = useState(
    DEFAULT_MODELS.openai.solutionModel
  );
  const [debuggingModel, setDebuggingModel] = useState(
    DEFAULT_MODELS.openai.debuggingModel
  );
  const [answerModel, setAnswerModel] = useState(
    DEFAULT_MODELS.openai.answerModel
  );
  const [speechRecognitionModel, setSpeechRecognitionModel] = useState("whisper-1");
  const [language, setLanguage] = useState("python");
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile>({
    name: "",
    resume: "",
    jobDescription: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[] | null>(null);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const { showToast } = useToast();

  const handleTestKeyAndListModels = async () => {
    if (!apiKey) {
      showToast("No API Key", "Enter your API key first", "neutral");
      return;
    }
    setIsTestingKey(true);
    try {
      const res = await window.electronAPI.listAvailableModels(apiProvider, apiKey);
      if (res.success && res.models) {
        setAvailableModels(res.models);
        showToast("Success", `Found ${res.models.length} models available`, "success");
      } else {
        showToast("Error", res.error || "Could not list models", "error");
      }
    } catch (e: any) {
      showToast("Error", e?.message || "Request failed", "error");
    } finally {
      setIsTestingKey(false);
    }
  };

  // Sync with external open state
  useEffect(() => {
    if (externalOpen !== undefined) {
      setOpen(externalOpen);
    }
  }, [externalOpen]);

  // Handle open state changes
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    // Only call onOpenChange when there's actually a change
    if (onOpenChange && newOpen !== externalOpen) {
      onOpenChange(newOpen);
    }
  };
  
  // Load current config on dialog open
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      interface Config {
        apiKey?: string;
        apiProvider?: APIProvider;
        extractionModel?: string;
        solutionModel?: string;
        debuggingModel?: string;
        answerModel?: string;
        speechRecognitionModel?: string;
        language?: string;
        candidateProfile?: CandidateProfile;
      }

      window.electronAPI
        .getConfig()
        .then((config: Config) => {
          setApiKey(config.apiKey || "");
          const provider: APIProvider = config.apiProvider || "openai";
          setApiProvider(provider);
          const providerDefaults = DEFAULT_MODELS[provider];
          setExtractionModel(
            config.extractionModel || providerDefaults.extractionModel
          );
          setSolutionModel(
            config.solutionModel || providerDefaults.solutionModel
          );
          setDebuggingModel(
            config.debuggingModel || providerDefaults.debuggingModel
          );
          setAnswerModel(
            config.answerModel || providerDefaults.answerModel
          );
          setSpeechRecognitionModel(
            config.speechRecognitionModel ||
              providerDefaults.speechRecognitionModel ||
              (config.apiProvider === "gemini" ? "gemini-2.0-flash" : "whisper-1")
          );
          setLanguage(config.language || "python");
          setCandidateProfile(config.candidateProfile || {
            name: "",
            resume: "",
            jobDescription: ""
          });
        })
        .catch((error: unknown) => {
          console.error("Failed to load config:", error);
          showToast("Error", "Failed to load settings", "error");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, showToast]);

  // Handle API provider change
  const handleProviderChange = (provider: APIProvider) => {
    setApiProvider(provider);
    
    // Reset models to defaults when changing provider
    const defaults = DEFAULT_MODELS[provider];
    setExtractionModel(defaults.extractionModel);
    setSolutionModel(defaults.solutionModel);
    setDebuggingModel(defaults.debuggingModel);
    setAnswerModel(defaults.answerModel);
    setSpeechRecognitionModel(
      defaults.speechRecognitionModel || 
      (provider === "gemini" ? "gemini-3-flash-preview" : "whisper-1")
    );
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.updateConfig({
        apiKey,
        apiProvider,
        extractionModel,
        solutionModel,
        debuggingModel,
        answerModel,
        speechRecognitionModel,
        language,
        candidateProfile,
      });
      
      if (result) {
        showToast("Success", "Settings saved successfully", "success");
        handleOpenChange(false);
        
        // Force reload the app to apply the API key
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      showToast("Error", "Failed to save settings", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Mask API key for display
  const maskApiKey = (key: string) => {
    if (!key || key.length < 10) return "";
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  };

  // Open external link handler
  const openExternalLink = (url: string) => {
    window.electronAPI.openLink(url);
  };

  const settingsRef = useRef<HTMLDivElement>(null);

  if (!open) return null;

  return (
    <div
      ref={settingsRef}
      className="sm:max-w-md bg-black border border-white/10 text-white settings-dialog rounded-lg"
      style={{
        width: 'min(450px, 90vw)',
        height: 'auto',
        minHeight: '400px',
        maxHeight: '85vh',
        overflowY: 'auto',
        padding: '20px',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col space-y-1.5 text-left mb-4">
        <h2 className="text-lg font-semibold text-white">Settings</h2>
        <p className="text-sm text-white/70">
          Configure your API key, AI models, and optional candidate profile. You'll need your own API key to use this application.
        </p>
      </div>
        <div className="space-y-4 py-4">
          {/* API Settings Section */}
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-white">API Settings</h2>
            <p className="text-xs text-white/60">
              Choose your provider and models. These control how screenshots and solutions are processed.
            </p>
          </div>
          
          {/* API Provider Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">API Provider</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(PROVIDER_DISPLAY_NAMES) as APIProvider[]).map((provider) => (
                <div
                  key={provider}
                  className={`p-2 rounded-lg cursor-pointer transition-colors ${
                    apiProvider === provider
                      ? "bg-white/10 border border-white/20"
                      : "bg-black/30 border border-white/5 hover:bg-white/5"
                  }`}
                  onClick={() => handleProviderChange(provider)}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full flex-shrink-0 ${
                        apiProvider === provider ? "bg-white" : "bg-white/20"
                      }`}
                    />
                    <div className="flex flex-col min-w-0">
                      <p className="font-medium text-white text-sm truncate">{PROVIDER_DISPLAY_NAMES[provider]}</p>
                      <p className="text-[10px] text-white/60 truncate">{PROVIDER_DESCRIPTIONS[provider]}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-white" htmlFor="apiKey">
              {PROVIDER_DISPLAY_NAMES[apiProvider]} API Key
            </label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={PROVIDER_KEY_PLACEHOLDERS[apiProvider]}
              className="bg-black/50 border-white/10 text-white"
            />
            {apiKey && (
              <p className="text-xs text-white/50">
                Current: {maskApiKey(apiKey)}
              </p>
            )}
            <p className="text-xs text-white/50">
              Your API key is stored locally and only sent to {PROVIDER_DISPLAY_NAMES[apiProvider]}'s API
            </p>
            {/* Test key & discover which models the key has access to */}
            <Button
              type="button"
              variant="outline"
              onClick={handleTestKeyAndListModels}
              disabled={!apiKey || isTestingKey}
              className="w-full border-white/10 hover:bg-white/5 text-white text-xs py-1 h-auto"
            >
              {isTestingKey ? "Checking..." : "Test key & list my available models"}
            </Button>
            {availableModels && (
              <div className="mt-1 p-2 rounded-md bg-white/5 border border-white/10">
                <p className="text-xs text-white/80 mb-1">
                  Your key has access to {availableModels.length} models:
                </p>
                <div className="text-[10px] text-white/60 max-h-24 overflow-y-auto custom-scrollbar font-mono">
                  {availableModels.map((m) => (
                    <div key={m} className="py-0.5">
                      {m}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-white/50 mt-1">
                  Pick one of these below in the AI Model Selection section.
                </p>
              </div>
            )}
            <div className="mt-2 p-2 rounded-md bg-white/5 border border-white/10">
              <p className="text-xs text-white/80 mb-1">Don't have an API key?</p>
              <p className="text-xs text-white/60 mb-1">1. Create an account at{" "}
                <button
                  onClick={() => openExternalLink(PROVIDER_API_KEY_LINKS[apiProvider].signup)}
                  className="text-blue-400 hover:underline cursor-pointer"
                >{PROVIDER_DISPLAY_NAMES[apiProvider]}</button>
              </p>
              <p className="text-xs text-white/60 mb-1">2. Go to the{" "}
                <button
                  onClick={() => openExternalLink(PROVIDER_API_KEY_LINKS[apiProvider].keys)}
                  className="text-blue-400 hover:underline cursor-pointer"
                >API Keys</button> section
              </p>
              <p className="text-xs text-white/60">3. Create a new API key and paste it here</p>
            </div>
          </div>
          
          <div className="space-y-2 mt-4">
            <label className="text-sm font-medium text-white mb-2 block">Keyboard Shortcuts</label>
            <div className="bg-black/30 border border-white/10 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <div className="text-white/70">Toggle Visibility</div>
                <div className="text-white/90 font-mono">Ctrl+B / Cmd+B</div>
                
                <div className="text-white/70">Take Screenshot</div>
                <div className="text-white/90 font-mono">Ctrl+H / Cmd+H</div>
                
                <div className="text-white/70">Start/Stop Recording</div>
                <div className="text-white/90 font-mono">Ctrl+M / Cmd+M</div>
                
                <div className="text-white/70">Toggle Speaker Mode</div>
                <div className="text-white/90 font-mono">Ctrl+Shift+M / Cmd+Shift+M</div>
                
                <div className="text-white/70">Process Screenshots</div>
                <div className="text-white/90 font-mono">Ctrl+Enter / Cmd+Enter</div>
                
                <div className="text-white/70">Delete Last Screenshot</div>
                <div className="text-white/90 font-mono">Ctrl+L / Cmd+L</div>
                
                <div className="text-white/70">Reset View</div>
                <div className="text-white/90 font-mono">Ctrl+R / Cmd+R</div>
                
                <div className="text-white/70">Quit Application</div>
                <div className="text-white/90 font-mono">Ctrl+Q / Cmd+Q</div>
                
                <div className="text-white/70">Move Window</div>
                <div className="text-white/90 font-mono">Ctrl+Arrow Keys</div>
                
                <div className="text-white/70">Decrease Opacity</div>
                <div className="text-white/90 font-mono">Ctrl+[ / Cmd+[</div>
                
                <div className="text-white/70">Increase Opacity</div>
                <div className="text-white/90 font-mono">Ctrl+] / Cmd+]</div>
                
                <div className="text-white/70">Zoom Out</div>
                <div className="text-white/90 font-mono">Ctrl+- / Cmd+-</div>
                
                <div className="text-white/70">Reset Zoom</div>
                <div className="text-white/90 font-mono">Ctrl+0 / Cmd+0</div>
                
                <div className="text-white/70">Zoom In</div>
                <div className="text-white/90 font-mono">Ctrl+= / Cmd+=</div>
              </div>
            </div>
          </div>
          
          {/* Programming Language Selection */}
          <div className="space-y-2 mt-4">
            <label className="text-sm font-medium text-white" htmlFor="language">
              Programming Language
            </label>
            <p className="text-xs text-white/60">
              Language used for generated solutions and code
            </p>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full bg-black/50 text-white/90 rounded-lg px-3 py-2 text-sm outline-none border border-white/10 focus:border-white/20"
              style={{ WebkitAppearance: 'menulist' }}
            >
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
              <option value="c">C</option>
              <option value="csharp">C#</option>
              <option value="golang">Go</option>
              <option value="rust">Rust</option>
              <option value="swift">Swift</option>
              <option value="kotlin">Kotlin</option>
              <option value="scala">Scala</option>
              <option value="ruby">Ruby</option>
              <option value="php">PHP</option>
              <option value="dart">Dart</option>
              <option value="r">R</option>
              <option value="elixir">Elixir</option>
              <option value="haskell">Haskell</option>
              <option value="ocaml">OCaml</option>
              <option value="clojure">Clojure</option>
              <option value="lua">Lua</option>
              <option value="julia">Julia</option>
              <option value="erlang">Erlang</option>
              <option value="fsharp">F#</option>
              <option value="nim">Nim</option>
              <option value="zig">Zig</option>
              <option value="sql">SQL</option>
            </select>
          </div>

          <div className="space-y-4 mt-4">
            <label className="text-sm font-medium text-white">AI Model Selection</label>
            <p className="text-xs text-white/60 -mt-3 mb-2">
              Select which models to use for each stage of the process
            </p>
            
            {MODEL_CATEGORIES.map((category) => {
              // Get the appropriate model list based on selected provider
              const models: AIModel[] = category.modelsByProvider[apiProvider];
              
              return (
                <div key={category.key} className="mb-4">
                  <label className="text-sm font-medium text-white mb-1 block">
                    {category.title}
                  </label>
                  <p className="text-xs text-white/60 mb-2">{category.description}</p>
                  
                  <div className="space-y-2">
                    {models.map((m) => {
                      // Determine which state to use based on category key
                      const currentValue = 
                        category.key === 'extractionModel' ? extractionModel :
                        category.key === 'solutionModel' ? solutionModel :
                        category.key === 'debuggingModel' ? debuggingModel :
                        answerModel;
                      
                      // Determine which setter function to use
                      const setValue = 
                        category.key === 'extractionModel' ? setExtractionModel :
                        category.key === 'solutionModel' ? setSolutionModel :
                        category.key === 'debuggingModel' ? setDebuggingModel :
                        setAnswerModel;
                        
                      return (
                        <div
                          key={m.id}
                          className={`p-2 rounded-lg cursor-pointer transition-colors ${
                            currentValue === m.id
                              ? "bg-white/10 border border-white/20"
                              : "bg-black/30 border border-white/5 hover:bg-white/5"
                          }`}
                          onClick={() => setValue(m.id)}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-3 h-3 rounded-full ${
                                currentValue === m.id ? "bg-white" : "bg-white/20"
                              }`}
                            />
                            <div>
                              <p className="font-medium text-white text-xs">{m.name}</p>
                              <p className="text-xs text-white/60">{m.description}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Speech Recognition Model Selection */}
          <div className="space-y-2 mt-4">
            <label className="text-sm font-medium text-white mb-1 block">
              Speech Recognition Model
            </label>
            <p className="text-xs text-white/60 mb-2">
              Model used for transcribing interview conversations
            </p>

            {apiProvider === "openai" ? (
              <div className="space-y-2">
                {[
                  { id: "whisper-1", name: "Whisper-1", desc: "OpenAI's speech-to-text model" },
                ].map((m) => (
                  <div
                    key={m.id}
                    className={`p-2 rounded-lg cursor-pointer transition-colors ${
                      speechRecognitionModel === m.id
                        ? "bg-white/10 border border-white/20"
                        : "bg-black/30 border border-white/5 hover:bg-white/5"
                    }`}
                    onClick={() => setSpeechRecognitionModel(m.id)}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${speechRecognitionModel === m.id ? "bg-white" : "bg-white/20"}`} />
                      <div>
                        <p className="font-medium text-white text-xs">{m.name}</p>
                        <p className="text-xs text-white/60">{m.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : apiProvider === "gemini" ? (
              <div className="space-y-2">
                {[
                  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", desc: "Fast, reliable audio understanding" },
                  { id: "gemini-2.5-flash-preview-04-17", name: "Gemini 2.5 Flash", desc: "Latest model, best accuracy" },
                  { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite", desc: "Ultra-fast, cheapest option" },
                  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", desc: "Legacy — higher accuracy" },
                  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", desc: "Legacy — fast and efficient" },
                ].map((m) => (
                  <div
                    key={m.id}
                    className={`p-2 rounded-lg cursor-pointer transition-colors ${
                      speechRecognitionModel === m.id
                        ? "bg-white/10 border border-white/20"
                        : "bg-black/30 border border-white/5 hover:bg-white/5"
                    }`}
                    onClick={() => setSpeechRecognitionModel(m.id)}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${speechRecognitionModel === m.id ? "bg-white" : "bg-white/20"}`} />
                      <div>
                        <p className="font-medium text-white text-xs">{m.name}</p>
                        <p className="text-xs text-white/60">{m.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-black/30 border border-white/10">
                <p className="text-sm text-white/70">
                  Speech recognition is only supported with OpenAI (Whisper) or Gemini. Switch to one of these providers to use this feature.
                </p>
              </div>
            )}
          </div>
          
          {/* Candidate Profile Section */}
          <div className="space-y-4 mt-6 border-t border-white/10 pt-4">
            <div>
              <label className="text-sm font-medium text-white mb-1 block">
                Candidate Profile
              </label>
              <p className="text-xs text-white/60 mb-3">
                Add your resume and details to get more personalized AI answer suggestions during interviews.
              </p>
              <CandidateProfileSection
                profile={candidateProfile}
                onProfileChange={setCandidateProfile}
              />
            </div>
          </div>
        </div>
        <div className="flex justify-between mt-4">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="border-white/10 hover:bg-white/5 text-white"
          >
            Cancel
          </Button>
          <Button
            className="px-4 py-3 bg-white text-black rounded-xl font-medium hover:bg-white/90 transition-colors"
            onClick={handleSave}
            disabled={isLoading || !apiKey}
          >
            {isLoading ? "Saving..." : "Save Settings"}
          </Button>
        </div>
    </div>
  );
}
