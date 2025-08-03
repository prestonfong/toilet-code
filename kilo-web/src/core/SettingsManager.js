/**
 * Core Settings Manager for Kilo-Web
 * Handles configuration management, validation, and persistence
 * Based on the original kilocode ProviderSettingsManager but adapted for web
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class SettingsManager {
  static SETTINGS_DIR = '.kilo/settings';
  static FILES = {
    PROVIDER_PROFILES: 'provider-profiles.json',
    GLOBAL_SETTINGS: 'global-settings.json',
    MODE_CONFIGS: 'mode-configs.json',
    WORKSPACE_OVERRIDES: 'workspace-overrides.json',
    MIGRATIONS: 'migrations.json'
  };

  constructor(workspaceDir = './') {
    this.workspaceDir = workspaceDir;
    this.settingsDir = path.join(workspaceDir, SettingsManager.SETTINGS_DIR);
    this._lock = Promise.resolve();
    
    // Default configurations
    this.defaultProviderProfiles = {
      currentApiConfigName: 'default',
      apiConfigs: {
        default: {
          id: this.generateId(),
          provider: 'anthropic',
          apiKey: '',
          model: 'claude-3-sonnet-20240229',
          temperature: 0.7,
          maxTokens: 4096
        }
      },
      modeApiConfigs: {}
    };

    this.defaultGlobalSettings = {
      theme: 'dark',
      autoSave: true,
      debugMode: false,
      telemetryEnabled: false,
      customInstructions: '',
      toolSettings: {
        diffEnabled: true,
        fuzzyMatchThreshold: 1.0,
        todoListEnabled: true
      }
    };

    this.defaultMigrations = {
      providerProfilesMigrated: true,
      globalSettingsMigrated: true,
      modeConfigsMigrated: true,
      version: '1.0.0'
    };
  }

  generateId() {
    return Math.random().toString(36).substring(2, 15);
  }

  // Thread-safe locking mechanism
  lock(callback) {
    const next = this._lock.then(callback);
    this._lock = next.catch(() => {});
    return next;
  }

  /**
   * Initialize settings system
   */
  async initialize() {
    return this.lock(async () => {
      try {
        await this.ensureSettingsDirectory();
        await this.ensureDefaultFiles();
        await this.runMigrations();
        console.log('✅ SettingsManager initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize SettingsManager:', error);
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
      console.log(`📁 Created settings directory: ${this.settingsDir}`);
    }
  }

  /**
   * Ensure all default setting files exist
   */
  async ensureDefaultFiles() {
    const files = [
      {
        name: SettingsManager.FILES.PROVIDER_PROFILES,
        content: this.defaultProviderProfiles
      },
      {
        name: SettingsManager.FILES.GLOBAL_SETTINGS,
        content: this.defaultGlobalSettings
      },
      {
        name: SettingsManager.FILES.MODE_CONFIGS,
        content: { customModes: [] }
      },
      {
        name: SettingsManager.FILES.WORKSPACE_OVERRIDES,
        content: {}
      },
      {
        name: SettingsManager.FILES.MIGRATIONS,
        content: this.defaultMigrations
      }
    ];

    for (const file of files) {
      const filePath = path.join(this.settingsDir, file.name);
      try {
        await fs.access(filePath);
      } catch (error) {
        await this.writeJsonFile(filePath, file.content);
        console.log(`📄 Created default settings file: ${file.name}`);
      }
    }
  }

  /**
   * Run any necessary migrations
   */
  async runMigrations() {
    const migrations = await this.readJsonFile(SettingsManager.FILES.MIGRATIONS);
    let migrationNeeded = false;

    // Check for version updates or missing migrations
    if (!migrations.version || migrations.version !== '1.0.0') {
      console.log('🔄 Running settings migrations...');
      migrations.version = '1.0.0';
      migrationNeeded = true;
    }

    if (migrationNeeded) {
      await this.writeJsonFile(
        path.join(this.settingsDir, SettingsManager.FILES.MIGRATIONS),
        migrations
      );
      console.log('✅ Settings migrations completed');
    }
  }

  /**
   * Provider Profiles Management
   */
  async getProviderProfiles() {
    return this.lock(async () => {
      return await this.readJsonFile(SettingsManager.FILES.PROVIDER_PROFILES);
    });
  }

  async setProviderProfiles(profiles) {
    return this.lock(async () => {
      this.validateProviderProfiles(profiles);
      await this.writeJsonFile(
        path.join(this.settingsDir, SettingsManager.FILES.PROVIDER_PROFILES),
        profiles
      );
    });
  }

  async getProviderProfile(name) {
    const profiles = await this.getProviderProfiles();
    const profile = profiles.apiConfigs[name];
    if (!profile) {
      throw new Error(`Provider profile '${name}' not found`);
    }
    return { name, ...profile };
  }

  async saveProviderProfile(name, config) {
    return this.lock(async () => {
      const profiles = await this.getProviderProfiles();
      const existingId = profiles.apiConfigs[name]?.id;
      const id = config.id || existingId || this.generateId();

      this.validateProviderConfig(config);
      profiles.apiConfigs[name] = { ...config, id };
      
      await this.setProviderProfiles(profiles);
      return id;
    });
  }

  async deleteProviderProfile(name) {
    return this.lock(async () => {
      const profiles = await this.getProviderProfiles();
      
      if (!profiles.apiConfigs[name]) {
        throw new Error(`Provider profile '${name}' not found`);
      }

      if (Object.keys(profiles.apiConfigs).length === 1) {
        throw new Error('Cannot delete the last remaining provider profile');
      }

      delete profiles.apiConfigs[name];
      
      // Update current config if needed
      if (profiles.currentApiConfigName === name) {
        profiles.currentApiConfigName = Object.keys(profiles.apiConfigs)[0];
      }

      await this.setProviderProfiles(profiles);
    });
  }

  async setCurrentProvider(name) {
    return this.lock(async () => {
      const profiles = await this.getProviderProfiles();
      
      if (!profiles.apiConfigs[name]) {
        throw new Error(`Provider profile '${name}' not found`);
      }

      profiles.currentApiConfigName = name;
      await this.setProviderProfiles(profiles);
      
      return profiles.apiConfigs[name];
    });
  }

  async getCurrentProvider() {
    const profiles = await this.getProviderProfiles();
    const currentName = profiles.currentApiConfigName;
    const currentProfile = profiles.apiConfigs[currentName];
    
    if (!currentProfile) {
      throw new Error(`Current provider '${currentName}' not found`);
    }

    return { name: currentName, ...currentProfile };
  }

  /**
   * Global Settings Management
   */
  async getGlobalSettings() {
    return this.lock(async () => {
      return await this.readJsonFile(SettingsManager.FILES.GLOBAL_SETTINGS);
    });
  }

  async setGlobalSettings(settings) {
    return this.lock(async () => {
      this.validateGlobalSettings(settings);
      await this.writeJsonFile(
        path.join(this.settingsDir, SettingsManager.FILES.GLOBAL_SETTINGS),
        settings
      );
    });
  }

  async updateGlobalSetting(key, value) {
    return this.lock(async () => {
      const settings = await this.getGlobalSettings();
      
      // Support nested key paths like 'toolSettings.diffEnabled'
      const keys = key.split('.');
      let current = settings;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      
      await this.setGlobalSettings(settings);
    });
  }

  /**
   * Mode Configuration Management
   */
  async getModeConfigs() {
    return this.lock(async () => {
      return await this.readJsonFile(SettingsManager.FILES.MODE_CONFIGS);
    });
  }

  async setModeConfigs(configs) {
    return this.lock(async () => {
      this.validateModeConfigs(configs);
      await this.writeJsonFile(
        path.join(this.settingsDir, SettingsManager.FILES.MODE_CONFIGS),
        configs
      );
    });
  }

  async saveModeConfig(modeConfig) {
    return this.lock(async () => {
      const configs = await this.getModeConfigs();
      
      this.validateModeConfig(modeConfig);
      
      // Remove existing mode with same slug
      configs.customModes = configs.customModes.filter(m => m.slug !== modeConfig.slug);
      configs.customModes.push(modeConfig);
      
      await this.setModeConfigs(configs);
    });
  }

  async deleteModeConfig(slug) {
    return this.lock(async () => {
      const configs = await this.getModeConfigs();
      const initialLength = configs.customModes.length;
      
      configs.customModes = configs.customModes.filter(m => m.slug !== slug);
      
      if (configs.customModes.length === initialLength) {
        throw new Error(`Mode configuration '${slug}' not found`);
      }
      
      await this.setModeConfigs(configs);
    });
  }

  /**
   * Import/Export functionality
   */
  async exportSettings() {
    return this.lock(async () => {
      const [providerProfiles, globalSettings, modeConfigs] = await Promise.all([
        this.getProviderProfiles(),
        this.getGlobalSettings(),
        this.getModeConfigs()
      ]);

      // Remove sensitive data for export
      const sanitizedProfiles = {
        ...providerProfiles,
        apiConfigs: Object.fromEntries(
          Object.entries(providerProfiles.apiConfigs).map(([name, config]) => [
            name,
            { ...config, apiKey: '***REDACTED***' }
          ])
        )
      };

      return {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        providerProfiles: sanitizedProfiles,
        globalSettings,
        modeConfigs
      };
    });
  }

  async importSettings(data, options = {}) {
    return this.lock(async () => {
      const { mergeMode = 'replace', skipApiKeys = true } = options;
      
      this.validateImportData(data);

      if (data.providerProfiles && !skipApiKeys) {
        if (mergeMode === 'merge') {
          const currentProfiles = await this.getProviderProfiles();
          const mergedProfiles = {
            ...currentProfiles,
            ...data.providerProfiles,
            apiConfigs: {
              ...currentProfiles.apiConfigs,
              ...data.providerProfiles.apiConfigs
            }
          };
          await this.setProviderProfiles(mergedProfiles);
        } else {
          await this.setProviderProfiles(data.providerProfiles);
        }
      }

      if (data.globalSettings) {
        if (mergeMode === 'merge') {
          const currentSettings = await this.getGlobalSettings();
          const mergedSettings = { ...currentSettings, ...data.globalSettings };
          await this.setGlobalSettings(mergedSettings);
        } else {
          await this.setGlobalSettings(data.globalSettings);
        }
      }

      if (data.modeConfigs) {
        await this.setModeConfigs(data.modeConfigs);
      }
    });
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
      throw new Error(`Failed to read settings file: ${filename}`);
    }
  }

  async writeJsonFile(filePath, data) {
    try {
      const content = JSON.stringify(data, null, 2);
      await fs.writeFile(filePath, content, 'utf8');
    } catch (error) {
      console.error(`Error writing ${filePath}:`, error);
      throw new Error(`Failed to write settings file: ${filePath}`);
    }
  }

  /**
   * Validation methods
   */
  validateProviderProfiles(profiles) {
    if (!profiles || typeof profiles !== 'object') {
      throw new Error('Provider profiles must be an object');
    }
    
    if (!profiles.currentApiConfigName || typeof profiles.currentApiConfigName !== 'string') {
      throw new Error('currentApiConfigName is required and must be a string');
    }
    
    if (!profiles.apiConfigs || typeof profiles.apiConfigs !== 'object') {
      throw new Error('apiConfigs is required and must be an object');
    }

    for (const [name, config] of Object.entries(profiles.apiConfigs)) {
      this.validateProviderConfig(config, name);
    }
  }

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

    const validProviders = ['anthropic', 'openai', 'claude-code'];
    if (!validProviders.includes(config.provider)) {
      throw new Error(`${name}.provider must be one of: ${validProviders.join(', ')}`);
    }
  }

  validateGlobalSettings(settings) {
    if (!settings || typeof settings !== 'object') {
      throw new Error('Global settings must be an object');
    }

    if (settings.theme && !['light', 'dark', 'auto'].includes(settings.theme)) {
      throw new Error('theme must be one of: light, dark, auto');
    }
  }

  validateModeConfigs(configs) {
    if (!configs || typeof configs !== 'object') {
      throw new Error('Mode configs must be an object');
    }

    if (!Array.isArray(configs.customModes)) {
      throw new Error('customModes must be an array');
    }

    for (const mode of configs.customModes) {
      this.validateModeConfig(mode);
    }
  }

  validateModeConfig(mode) {
    if (!mode || typeof mode !== 'object') {
      throw new Error('Mode config must be an object');
    }

    const requiredFields = ['slug', 'name', 'description'];
    for (const field of requiredFields) {
      if (!mode[field] || typeof mode[field] !== 'string') {
        throw new Error(`Mode config.${field} is required and must be a string`);
      }
    }

    if (mode.source && !['global', 'project'].includes(mode.source)) {
      throw new Error('Mode config.source must be either "global" or "project"');
    }
  }

  validateImportData(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Import data must be an object');
    }

    if (data.providerProfiles) {
      this.validateProviderProfiles(data.providerProfiles);
    }

    if (data.globalSettings) {
      this.validateGlobalSettings(data.globalSettings);
    }

    if (data.modeConfigs) {
      this.validateModeConfigs(data.modeConfigs);
    }
  }

  /**
   * Reset all settings to defaults
   */
  async resetAllSettings() {
    return this.lock(async () => {
      await this.setProviderProfiles(this.defaultProviderProfiles);
      await this.setGlobalSettings(this.defaultGlobalSettings);
      await this.setModeConfigs({ customModes: [] });
      
      console.log('🔄 All settings reset to defaults');
    });
  }

  /**
   * Get workspace-specific overrides
   */
  async getWorkspaceOverrides() {
    return this.lock(async () => {
      return await this.readJsonFile(SettingsManager.FILES.WORKSPACE_OVERRIDES);
    });
  }

  async setWorkspaceOverrides(overrides) {
    return this.lock(async () => {
      await this.writeJsonFile(
        path.join(this.settingsDir, SettingsManager.FILES.WORKSPACE_OVERRIDES),
        overrides
      );
    });
  }
}

module.exports = SettingsManager;