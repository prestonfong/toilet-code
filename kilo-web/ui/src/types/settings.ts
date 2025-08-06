// Enhanced Settings Type Definitions for Kilo Web

export interface ProviderSettings {
  provider?: string;
  model?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  baseUrl?: string;
  customHeaders?: Record<string, string>;
  // Claude Code specific settings
  claudeCodePath?: string;
  claudeCodeMaxOutputTokens?: number;
  
  // Virtual Quota Fallback settings
  profiles?: Array<{
    id?: string;
    provider: string;
    settings: any;
    quotaLimit?: {
      requests: number;
      tokens: number;
    };
    quotaResetPeriod?: number;
  }>;
  
  // Fireworks settings
  fireworksApiKey?: string;
  fireworksModel?: string;
  
  // Cerebras settings
  cerebrasApiKey?: string;
  cerebrasModel?: string;
  
  // Gemini CLI settings
  geminiCliProjectId?: string;
  geminiCliModel?: string;
  geminiCliRegion?: string;
  
  // xAI settings
  xaiApiKey?: string;
  xaiModel?: string;
  
  // Groq settings
  groqApiKey?: string;
  groqModel?: string;
  
  // Hugging Face settings
  huggingFaceApiKey?: string;
  huggingFaceModelId?: string;
  huggingFaceInferenceProvider?: 'inference-api' | 'inference-endpoints';
  huggingFaceEndpointName?: string;
  
  // Additional parameters for new providers
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  repetitionPenalty?: number;
  seed?: number;
  stop?: string | string[];
}

export interface ProviderProfile {
  id: string;
  name: string;
  displayName: string;
  provider: string;
  config: ProviderSettings;
  isDefault?: boolean;
  created: string;
  modified: string;
  description?: string;
  tags?: string[];
}

export interface WorkspaceSettings {
  workspaceId: string;
  workspaceName: string;
  overrides: Partial<ExtensionSettings>;
  inheritGlobal: boolean;
  created: string;
  modified: string;
}

export interface SettingsValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface SettingsTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  settings: Partial<ExtensionSettings>;
  tags?: string[];
}

export interface SettingsExportData {
  version: string;
  timestamp: string;
  globalSettings: ExtensionSettings;
  providerProfiles: ProviderProfile[];
  workspaceSettings: WorkspaceSettings[];
  modeConfigs?: any[];
  metadata: {
    exportedBy: string;
    kiloVersion: string;
    platform: string;
  };
}

export interface SettingsImportOptions {
  overwriteExisting?: boolean;
  mergeSettings?: boolean;
  importProfiles?: boolean;
  importWorkspaceSettings?: boolean;
  importModeConfigs?: boolean;
  validateBeforeImport?: boolean;
}

export interface ExtensionSettings {
  // Provider settings
  apiConfiguration?: ProviderSettings;
  currentApiConfigName?: string;
  
  // Auto-approve settings
  alwaysAllowReadOnly?: boolean;
  alwaysAllowReadOnlyOutsideWorkspace?: boolean;
  alwaysAllowWrite?: boolean;
  alwaysAllowWriteOutsideWorkspace?: boolean;
  alwaysAllowWriteProtected?: boolean;
  alwaysAllowExecute?: boolean;
  alwaysAllowBrowser?: boolean;
  alwaysAllowMcp?: boolean;
  alwaysAllowModeSwitch?: boolean;
  alwaysAllowSubtasks?: boolean;
  alwaysAllowFollowupQuestions?: boolean;
  alwaysAllowUpdateTodoList?: boolean;
  alwaysApproveResubmit?: boolean;
  allowedCommands?: string[];
  deniedCommands?: string[];
  allowedMaxRequests?: number;
  requestDelaySeconds?: number;
  followupAutoApproveTimeoutMs?: number;
  showAutoApproveMenu?: boolean;

  // Browser settings
  browserToolEnabled?: boolean;
  browserViewportSize?: string;
  screenshotQuality?: number;
  remoteBrowserHost?: string;
  remoteBrowserEnabled?: boolean;

  // Checkpoint settings
  enableCheckpoints?: boolean;
  diffEnabled?: boolean;

  // Display settings
  showTaskTimeline?: boolean;
  theme?: 'dark' | 'light' | 'auto';

  // Notification settings
  soundEnabled?: boolean;
  soundVolume?: number;
  ttsEnabled?: boolean;
  ttsSpeed?: number;
  systemNotificationsEnabled?: boolean;

  // Context management settings
  autoCondenseContext?: boolean;
  autoCondenseContextPercent?: number;
  maxOpenTabsContext?: number;
  maxWorkspaceFiles?: number;
  showRooIgnoredFiles?: boolean;
  maxReadFileLine?: number;
  maxConcurrentFileReads?: number;
  allowVeryLargeReads?: boolean;
  fuzzyMatchThreshold?: number;
  writeDelayMs?: number;
  includeDiagnosticMessages?: boolean;
  maxDiagnosticMessages?: number;

  // Terminal settings
  terminalOutputLineLimit?: number;
  terminalOutputCharacterLimit?: number;
  terminalCommandDelay?: number;
  terminalShellIntegrationTimeout?: number;
  terminalShellIntegrationDisabled?: boolean;
  terminalPowershellCounter?: boolean;
  terminalZshClearEolMark?: boolean;
  terminalZshOhMy?: boolean;
  terminalZshP10k?: boolean;
  terminalZdotdir?: boolean;
  terminalCompressProgressBar?: boolean;
  terminalCommandApiConfigId?: string;

  // Experimental settings
  experiments?: Record<string, boolean>;

  // Language settings
  language?: string;

  // MCP settings
  mcpEnabled?: boolean;

  // Custom prompts
  customSupportPrompts?: Record<string, string>;
  customCondensingPrompt?: string;
  condensingApiConfigId?: string;
}

export interface SettingsSearchResult {
  section: string;
  key: string;
  label: string;
  description?: string;
  value: any;
  type: 'boolean' | 'string' | 'number' | 'select' | 'range' | 'array';
  relevanceScore: number;
}

export interface SettingsManager {
  // Core settings management
  getAllSettings(): Promise<ExtensionSettings>;
  updateSettings(settings: Partial<ExtensionSettings>): Promise<void>;
  resetSettings(): Promise<void>;
  
  // Provider profile management
  getProviderProfiles(): Promise<ProviderProfile[]>;
  saveProviderProfile(name: string, config: ProviderSettings): Promise<string>;
  deleteProviderProfile(name: string): Promise<void>;
  setCurrentProvider(name: string): Promise<ProviderProfile>;
  getCurrentProvider(): Promise<ProviderProfile | null>;
  
  // Workspace settings
  getWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettings | null>;
  saveWorkspaceSettings(settings: WorkspaceSettings): Promise<void>;
  deleteWorkspaceSettings(workspaceId: string): Promise<void>;
  
  // Import/Export
  exportSettings(): Promise<SettingsExportData>;
  importSettings(data: SettingsExportData, options?: SettingsImportOptions): Promise<void>;
  
  // Validation
  validateSettings(settings: Partial<ExtensionSettings>): Promise<SettingsValidationError[]>;
  
  // Search
  searchSettings(query: string): Promise<SettingsSearchResult[]>;
  
  // Templates
  getSettingsTemplates(): Promise<SettingsTemplate[]>;
  applyTemplate(templateId: string): Promise<void>;
}

export type SectionName =
  | 'providers'
  | 'autoApprove'
  | 'browser'
  | 'checkpoints'
  | 'display'
  | 'notifications'
  | 'contextManagement'
  | 'terminal'
  | 'prompts'
  | 'experimental'
  | 'language'
  | 'mcp'
  | 'advancedModes'
  | 'about'
  | 'profileManager'
  | 'importExport'
  | 'workspaceOverrides';

export interface SettingsPanelState {
  activeSection: SectionName;
  searchQuery: string;
  showSearch: boolean;
  isLoading: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  validationErrors: SettingsValidationError[];
  selectedProfile?: ProviderProfile;
  workspaceOverrides?: WorkspaceSettings;
}

export interface SettingsAction {
  type: 'SET_ACTIVE_SECTION' | 'SET_SEARCH_QUERY' | 'TOGGLE_SEARCH' | 'SET_LOADING' | 
        'SET_SAVING' | 'SET_UNSAVED_CHANGES' | 'SET_VALIDATION_ERRORS' | 
        'SET_SELECTED_PROFILE' | 'SET_WORKSPACE_OVERRIDES' | 'RESET_STATE';
  payload?: any;
}