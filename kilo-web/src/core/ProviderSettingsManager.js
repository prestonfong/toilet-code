/**
 * Provider Settings Manager for Kilo-Web
 * Handles provider configuration profiles, validation, migrations, and import/export
 * Based on the original kilocode ProviderSettingsManager but adapted for web file storage
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Default consecutive mistake limit
 */
const DEFAULT_CONSECUTIVE_MISTAKE_LIMIT = 3;

/**
 * Available modes for provider configuration
 */
const defaultModes = [
  { slug: 'code', name: 'Code' },
  { slug: 'ask', name: 'Ask' },
  { slug: 'debug', name: 'Debug' },
  { slug: 'architect', name: 'Architect' },
  { slug: 'orchestrator', name: 'Orchestrator' },
  { slug: 'test', name: 'Test' },
  { slug: 'project-manager', name: 'Project Manager' }
];

class ProviderSettingsManager {
  static SETTINGS_DIR = '.kilo/provider-settings';
  static FILES = {
    PROVIDER_PROFILES: 'provider-profiles.json',
    MIGRATIONS: 'provider-migrations.json'
  };

  constructor(workspaceDir = './') {
    this.workspaceDir = workspaceDir;
    this.settingsDir = path.join(workspaceDir, ProviderSettingsManager.SETTINGS_DIR);
    this._lock = Promise.resolve();
    
    // Generate default config ID
    this.defaultConfigId = this.generateId();
    
    // Default mode API configs - all modes use default config initially
    this.defaultModeApiConfigs = Object.fromEntries(
      defaultModes.map(mode => [mode.slug, this.defaultConfigId])
    );
    
    // Default provider profiles structure
    this.defaultProviderProfiles = {
      currentApiConfigName: 'default',
      apiConfigs: {
        default: {
          id: this.defaultConfigId,
          provider: 'anthropic',
          apiKey: '',
          model: 'claude-3-sonnet-20240229',
          temperature: 0.7,
          maxTokens: 4096,
          rateLimitSeconds: 0,
          diffEnabled: true,
          fuzzyMatchThreshold: 1.0,
          consecutiveMistakeLimit: DEFAULT_CONSECUTIVE_MISTAKE_LIMIT,
          todoListEnabled: true,
          created: new Date().toISOString(),
          lastUsed: new Date().toISOString()
        }
      },
      modeApiConfigs: this.defaultModeApiConfigs,
      migrations: {
        rateLimitSecondsMigrated: true,
        diffSettingsMigrated: true,
        openAiHeadersMigrated: true,
        consecutiveMistakeLimitMigrated: true,
        todoListEnabledMigrated: true,
        profileMetadataMigrated: true
      }
    };

    this.defaultMigrations = {
      providerProfilesMigrated: true,
      version: '1.0.0',
      lastMigrationDate: new Date().toISOString()
    };
  }

  /**
   * Generate a unique ID for profiles
   */
  generateId() {
    return Math.random().toString(36).substring(2, 15);
  }

  /**
   * Thread-safe locking mechanism
   */
  lock(callback) {
    const next = this._lock.then(callback);
    this._lock = next.catch(() => {});
    return next;
  }

  /**
   * Initialize the provider settings system
   */
  async initialize() {
    return this.lock(async () => {
      try {
        await this.ensureSettingsDirectory();
        await this.ensureDefaultFiles();
        await this.runMigrations();
        console.log('✅ ProviderSettingsManager initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize ProviderSettingsManager:', error);
        throw error;
      }
    });
  }

  /**
   * Ensure settings directory exists
   */
  async ensureSettingsDirectory() {
    try {
      await fs.access(this.settingsDir);
    } catch (error) {
      await fs.mkdir(this.settingsDir, { recursive: true });
      console.log(`📁 Created provider settings directory: ${this.settingsDir}`);
    }
  }

  /**
   * Ensure all default setting files exist
   */
  async ensureDefaultFiles() {
    const files = [
      {
        name: ProviderSettingsManager.FILES.PROVIDER_PROFILES,
        content: this.defaultProviderProfiles
      },
      {
        name: ProviderSettingsManager.FILES.MIGRATIONS,
        content: this.defaultMigrations
      }
    ];

    for (const file of files) {
      const filePath = path.join(this.settingsDir, file.name);
      try {
        await fs.access(filePath);
      } catch (error) {
        await this.writeJsonFile(filePath, file.content);
        console.log(`📄 Created default provider settings file: ${file.name}`);
      }
    }
  }

  /**
   * Run necessary migrations
   */
  async runMigrations() {
    const migrations = await this.readJsonFile(ProviderSettingsManager.FILES.MIGRATIONS);
    const providerProfiles = await this.load();
    let migrationNeeded = false;
    let profilesChanged = false;

    // Check for version updates
    if (!migrations.version || migrations.version !== '1.0.0') {
      console.log('🔄 Running provider settings migrations...');
      migrations.version = '1.0.0';
      migrations.lastMigrationDate = new Date().toISOString();
      migrationNeeded = true;
    }

    // Ensure all profiles have metadata
    if (!providerProfiles.migrations?.profileMetadataMigrated) {
      await this.migrateProfileMetadata(providerProfiles);
      providerProfiles.migrations = providerProfiles.migrations || {};
      providerProfiles.migrations.profileMetadataMigrated = true;
      profilesChanged = true;
    }

    // Ensure all configs have IDs
    for (const [name, apiConfig] of Object.entries(providerProfiles.apiConfigs)) {
      if (!apiConfig.id) {
        apiConfig.id = this.generateId();
        profilesChanged = true;
      }
    }

    // Ensure mode API configs exist
    if (!providerProfiles.modeApiConfigs) {
      const currentName = providerProfiles.currentApiConfigName;
      const seedId = providerProfiles.apiConfigs[currentName]?.id ?? 
                    Object.values(providerProfiles.apiConfigs)[0]?.id ?? 
                    this.defaultConfigId;
      providerProfiles.modeApiConfigs = Object.fromEntries(
        defaultModes.map(m => [m.slug, seedId])
      );
      profilesChanged = true;
    }

    // Run specific migrations
    if (!providerProfiles.migrations?.rateLimitSecondsMigrated) {
      await this.migrateRateLimitSeconds(providerProfiles);
      providerProfiles.migrations.rateLimitSecondsMigrated = true;
      profilesChanged = true;
    }

    if (!providerProfiles.migrations?.diffSettingsMigrated) {
      await this.migrateDiffSettings(providerProfiles);
      providerProfiles.migrations.diffSettingsMigrated = true;
      profilesChanged = true;
    }

    if (!providerProfiles.migrations?.consecutiveMistakeLimitMigrated) {
      await this.migrateConsecutiveMistakeLimit(providerProfiles);
      providerProfiles.migrations.consecutiveMistakeLimitMigrated = true;
      profilesChanged = true;
    }

    if (!providerProfiles.migrations?.todoListEnabledMigrated) {
      await this.migrateTodoListEnabled(providerProfiles);
      providerProfiles.migrations.todoListEnabledMigrated = true;
      profilesChanged = true;
    }

    // Save changes if needed
    if (migrationNeeded) {
      await this.writeJsonFile(
        path.join(this.settingsDir, ProviderSettingsManager.FILES.MIGRATIONS),
        migrations
      );
    }

    if (profilesChanged) {
      await this.store(providerProfiles);
    }

    if (migrationNeeded || profilesChanged) {
      console.log('✅ Provider settings migrations completed');
    }
  }

  /**
   * Migration: Add metadata to existing profiles
   */
  async migrateProfileMetadata(providerProfiles) {
    const now = new Date().toISOString();
    for (const [name, config] of Object.entries(providerProfiles.apiConfigs)) {
      if (!config.created) {
        config.created = now;
      }
      if (!config.lastUsed) {
        config.lastUsed = now;
      }
    }
  }

  /**
   * Migration: Rate limit seconds
   */
  async migrateRateLimitSeconds(providerProfiles) {
    const defaultRateLimit = 0;
    for (const [name, apiConfig] of Object.entries(providerProfiles.apiConfigs)) {
      if (apiConfig.rateLimitSeconds === undefined) {
        apiConfig.rateLimitSeconds = defaultRateLimit;
      }
    }
  }

  /**
   * Migration: Diff settings
   */
  async migrateDiffSettings(providerProfiles) {
    for (const [name, apiConfig] of Object.entries(providerProfiles.apiConfigs)) {
      if (apiConfig.diffEnabled === undefined) {
        apiConfig.diffEnabled = true;
      }
      if (apiConfig.fuzzyMatchThreshold === undefined) {
        apiConfig.fuzzyMatchThreshold = 1.0;
      }
    }
  }

  /**
   * Migration: Consecutive mistake limit
   */
  async migrateConsecutiveMistakeLimit(providerProfiles) {
    for (const [name, apiConfig] of Object.entries(providerProfiles.apiConfigs)) {
      if (apiConfig.consecutiveMistakeLimit == null) {
        apiConfig.consecutiveMistakeLimit = DEFAULT_CONSECUTIVE_MISTAKE_LIMIT;
      }
    }
  }

  /**
   * Migration: Todo list enabled
   */
  async migrateTodoListEnabled(providerProfiles) {
    for (const [name, apiConfig] of Object.entries(providerProfiles.apiConfigs)) {
      if (apiConfig.todoListEnabled === undefined) {
        apiConfig.todoListEnabled = true;
      }
    }
  }

  /**
   * List all available provider profiles with metadata
   */
  async listProfiles() {
    return this.lock(async () => {
      const providerProfiles = await this.load();
      return Object.entries(providerProfiles.apiConfigs).map(([name, apiConfig]) => ({
        name,
        id: apiConfig.id || '',
        provider: apiConfig.provider,
        model: apiConfig.model,
        created: apiConfig.created,
        lastUsed: apiConfig.lastUsed,
        isCurrent: name === providerProfiles.currentApiConfigName
      }));
    });
  }

  /**
   * Save a provider profile with the given name
   */
  async saveProfile(name, config) {
    return this.lock(async () => {
      this.validateProviderConfig(config);
      
      const providerProfiles = await this.load();
      const existingId = providerProfiles.apiConfigs[name]?.id;
      const id = config.id || existingId || this.generateId();
      const now = new Date().toISOString();

      // Prepare the config with metadata
      const profileConfig = {
        ...config,
        id,
        created: config.created || providerProfiles.apiConfigs[name]?.created || now,
        lastUsed: now
      };

      providerProfiles.apiConfigs[name] = profileConfig;
      await this.store(providerProfiles);
      
      console.log(`💾 Saved provider profile: ${name}`);
      return id;
    });
  }

  /**
   * Get a provider profile by name or ID
   */
  async getProfile(params) {
    return this.lock(async () => {
      const providerProfiles = await this.load();
      let name;
      let providerSettings;

      if (params.name) {
        name = params.name;
        if (!providerProfiles.apiConfigs[name]) {
          throw new Error(`Provider profile '${name}' not found`);
        }
        providerSettings = providerProfiles.apiConfigs[name];
      } else if (params.id) {
        const id = params.id;
        const entry = Object.entries(providerProfiles.apiConfigs).find(
          ([_, apiConfig]) => apiConfig.id === id
        );
        if (!entry) {
          throw new Error(`Provider profile with ID '${id}' not found`);
        }
        name = entry[0];
        providerSettings = entry[1];
      } else {
        throw new Error('Either name or id parameter is required');
      }

      return { name, ...providerSettings };
    });
  }

  /**
   * Activate a provider profile by name or ID
   */
  async activateProfile(params) {
    const { name, ...providerSettings } = await this.getProfile(params);
    
    return this.lock(async () => {
      const providerProfiles = await this.load();
      providerProfiles.currentApiConfigName = name;
      
      // Update last used timestamp
      providerProfiles.apiConfigs[name].lastUsed = new Date().toISOString();
      
      await this.store(providerProfiles);
      console.log(`🔄 Activated provider profile: ${name}`);
      
      return { name, ...providerSettings };
    });
  }

  /**
   * Get the currently active provider profile
   */
  async getCurrentProvider() {
    const providerProfiles = await this.load();
    const currentName = providerProfiles.currentApiConfigName;
    const currentProfile = providerProfiles.apiConfigs[currentName];
    
    if (!currentProfile) {
      throw new Error(`Current provider '${currentName}' not found`);
    }

    return { name: currentName, ...currentProfile };
  }

  /**
   * Delete a provider profile by name
   */
  async deleteProfile(name) {
    return this.lock(async () => {
      const providerProfiles = await this.load();
      
      if (!providerProfiles.apiConfigs[name]) {
        throw new Error(`Provider profile '${name}' not found`);
      }

      if (Object.keys(providerProfiles.apiConfigs).length === 1) {
        throw new Error('Cannot delete the last remaining provider profile');
      }

      delete providerProfiles.apiConfigs[name];
      
      // Update current config if needed
      if (providerProfiles.currentApiConfigName === name) {
        providerProfiles.currentApiConfigName = Object.keys(providerProfiles.apiConfigs)[0];
      }

      await this.store(providerProfiles);
      console.log(`🗑️ Deleted provider profile: ${name}`);
    });
  }

  /**
   * Check if a profile exists by name
   */
  async hasProfile(name) {
    return this.lock(async () => {
      const providerProfiles = await this.load();
      return name in providerProfiles.apiConfigs;
    });
  }

  /**
   * Set the API config for a specific mode
   */
  async setModeConfig(mode, configId) {
    return this.lock(async () => {
      const providerProfiles = await this.load();
      
      // Ensure the per-mode config map exists
      if (!providerProfiles.modeApiConfigs) {
        providerProfiles.modeApiConfigs = {};
      }
      
      // Assign the chosen config ID to this mode
      providerProfiles.modeApiConfigs[mode] = configId;
      await this.store(providerProfiles);
      
      console.log(`🔧 Set mode '${mode}' to use config ID: ${configId}`);
    });
  }

  /**
   * Get the API config ID for a specific mode
   */
  async getModeConfigId(mode) {
    return this.lock(async () => {
      const { modeApiConfigs } = await this.load();
      return modeApiConfigs?.[mode];
    });
  }

  /**
   * Export provider profiles for backup/sharing
   */
  async export() {
    return this.lock(async () => {
      const profiles = await this.load();
      
      // Create sanitized copy without sensitive data
      const sanitizedProfiles = {
        ...profiles,
        apiConfigs: Object.fromEntries(
          Object.entries(profiles.apiConfigs).map(([name, config]) => [
            name,
            { ...config, apiKey: '***REDACTED***' }
          ])
        )
      };

      return {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        exportType: 'provider-profiles',
        data: sanitizedProfiles
      };
    });
  }

  /**
   * Import provider profiles from backup/sharing
   */
  async import(importData, options = {}) {
    return this.lock(async () => {
      const { mergeMode = 'replace', skipApiKeys = true } = options;
      
      this.validateImportData(importData);
      
      if (mergeMode === 'merge') {
        const currentProfiles = await this.load();
        const mergedProfiles = {
          ...currentProfiles,
          ...importData.data,
          apiConfigs: {
            ...currentProfiles.apiConfigs,
            ...importData.data.apiConfigs
          }
        };
        
        // Skip API keys if requested
        if (skipApiKeys) {
          for (const [name, config] of Object.entries(mergedProfiles.apiConfigs)) {
            if (importData.data.apiConfigs[name] && config.apiKey === '***REDACTED***') {
              config.apiKey = currentProfiles.apiConfigs[name]?.apiKey || '';
            }
          }
        }
        
        await this.store(mergedProfiles);
      } else {
        await this.store(importData.data);
      }
      
      console.log('📥 Imported provider profiles successfully');
    });
  }

  /**
   * Reset all provider profiles to defaults
   */
  async resetAllProfiles() {
    return this.lock(async () => {
      await this.store(this.defaultProviderProfiles);
      console.log('🔄 Reset all provider profiles to defaults');
    });
  }

  /**
   * Get available providers
   */
  getAvailableProviders() {
    return [
      {
        id: 'anthropic',
        name: 'Anthropic',
        models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307']
      },
      {
        id: 'openai',
        name: 'OpenAI',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo']
      },
      {
        id: 'claude-code',
        name: 'Claude Code',
        models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022']
      },
      {
        id: 'cerebras',
        name: 'Cerebras',
        models: ['llama3.1-8b', 'llama3.1-70b', 'llama3.1-405b', 'llama-3.3-70b', 'llama-3.2-1b', 'llama-3.2-3b', 'llama-3.2-11b-vision', 'llama-3.2-90b-vision']
      },
      {
        id: 'fireworks',
        name: 'Fireworks AI',
        models: ['accounts/fireworks/models/llama-v3p1-405b-instruct', 'accounts/fireworks/models/llama-v3p1-70b-instruct', 'accounts/fireworks/models/llama-v3p1-8b-instruct', 'accounts/fireworks/models/mixtral-8x7b-instruct', 'accounts/fireworks/models/mixtral-8x22b-instruct']
      },
      {
        id: 'gemini-cli',
        name: 'Gemini CLI',
        models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro']
      },
      {
        id: 'groq',
        name: 'Groq',
        models: ['mixtral-8x7b-32768', 'llama2-70b-4096', 'gemma-7b-it']
      },
      {
        id: 'xai',
        name: 'xAI (Grok)',
        models: ['grok-beta', 'grok-vision-beta']
      },
      {
        id: 'huggingface',
        name: 'Hugging Face',
        models: ['meta-llama/Llama-2-70b-chat-hf', 'microsoft/DialoGPT-medium', 'facebook/blenderbot-400M-distill']
      },
      {
        id: 'virtual-quota-fallback',
        name: 'Virtual Quota Fallback',
        models: []
      }
    ];
  }

  /**
   * Get available models for a provider
   */
  getAvailableModels(provider) {
    // Try to get models dynamically from provider class first
    try {
      const providers = require('../api/providers');
      const ProviderClass = providers[provider];
      
      if (ProviderClass && typeof ProviderClass.prototype.getAvailableModels === 'function') {
        const providerInstance = new ProviderClass();
        return providerInstance.getAvailableModels();
      }
    } catch (error) {
      // Fall back to static list if dynamic loading fails
      console.warn(`Could not load dynamic models for ${provider}, using static list:`, error);
    }
    
    // Fallback to static list
    const providers = this.getAvailableProviders();
    const providerInfo = providers.find(p => p.id === provider);
    return providerInfo ? providerInfo.models : [];
  }

  /**
   * Utility methods
   */
  async readJsonFile(filename) {
    try {
      const filePath = path.join(this.settingsDir, filename);
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Error reading ${filename}:`, error);
      throw new Error(`Failed to read provider settings file: ${filename}`);
    }
  }

  async writeJsonFile(filePath, data) {
    try {
      const content = JSON.stringify(data, null, 2);
      await fs.writeFile(filePath, content, 'utf8');
    } catch (error) {
      console.error(`Error writing ${filePath}:`, error);
      throw new Error(`Failed to write provider settings file: ${filePath}`);
    }
  }

  /**
   * Load provider profiles from storage
   */
  async load() {
    try {
      const content = await this.readJsonFile(ProviderSettingsManager.FILES.PROVIDER_PROFILES);
      return content || this.defaultProviderProfiles;
    } catch (error) {
      // Return defaults if file doesn't exist or is corrupted
      return this.defaultProviderProfiles;
    }
  }

  /**
   * Store provider profiles to storage
   */
  async store(providerProfiles) {
    try {
      await this.writeJsonFile(
        path.join(this.settingsDir, ProviderSettingsManager.FILES.PROVIDER_PROFILES),
        providerProfiles
      );
    } catch (error) {
      throw new Error(`Failed to store provider profiles: ${error.message}`);
    }
  }

  /**
   * Validation methods
   */
  validateProviderConfig(config, name = 'config') {
    if (!config || typeof config !== 'object') {
      throw new Error(`${name} must be an object`);
    }

    const requiredFields = ['provider'];
    for (const field of requiredFields) {
      if (!config[field]) {
        throw new Error(`${name}.${field} is required`);
      }
    }

    const validProviders = ['anthropic', 'openai', 'claude-code', 'cerebras', 'fireworks', 'gemini-cli', 'groq', 'xai', 'huggingface', 'virtual-quota-fallback'];
    if (!validProviders.includes(config.provider)) {
      throw new Error(`${name}.provider must be one of: ${validProviders.join(', ')}`);
    }

    // Validate temperature if provided
    if (config.temperature !== undefined) {
      if (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 1) {
        throw new Error(`${name}.temperature must be a number between 0 and 1`);
      }
    }

    // Validate maxTokens if provided
    if (config.maxTokens !== undefined) {
      if (typeof config.maxTokens !== 'number' || config.maxTokens < 1) {
        throw new Error(`${name}.maxTokens must be a positive number`);
      }
    }
  }

  validateImportData(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Import data must be an object');
    }

    if (!data.data || typeof data.data !== 'object') {
      throw new Error('Import data.data must be an object');
    }

    if (!data.data.apiConfigs || typeof data.data.apiConfigs !== 'object') {
      throw new Error('Import data must contain apiConfigs');
    }

    // Validate each profile
    for (const [name, config] of Object.entries(data.data.apiConfigs)) {
      try {
        this.validateProviderConfig(config, `profile '${name}'`);
      } catch (error) {
        throw new Error(`Invalid ${error.message}`);
      }
    }
  }
}

module.exports = ProviderSettingsManager;