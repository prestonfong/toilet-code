/**
 * Settings Service Layer for Kilo-Web
 * Provides high-level API for settings operations with WebSocket integration
 * Acts as a bridge between SettingsManager and the application
 */

const SettingsManager = require('../core/SettingsManager');
const path = require('path');
const EventEmitter = require('events');

class SettingsService extends EventEmitter {
  constructor(workspaceDir = './') {
    super();
    this.settingsManager = new SettingsManager(workspaceDir);
    this.webSocketSender = null;
    this.watchers = new Map();
  }

  /**
   * Initialize the settings service
   */
  async initialize() {
    try {
      await this.settingsManager.initialize();
      this.emit('initialized');
      console.log('✅ SettingsService initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize SettingsService:', error);
      throw error;
    }
  }

  /**
   * Set WebSocket sender for real-time updates
   */
  setWebSocketSender(sender) {
    this.webSocketSender = sender;
  }

  /**
   * Broadcast settings update via WebSocket
   */
  broadcastUpdate(eventType, data) {
    if (this.webSocketSender) {
      this.webSocketSender({
        type: 'settingsUpdate',
        eventType,
        data,
        timestamp: Date.now()
      });
    }
    this.emit(eventType, data);
  }

  /**
   * Provider Profile Operations
   */
  async getProviderProfiles() {
    try {
      const profiles = await this.settingsManager.getProviderProfiles();
      // Remove API keys for client security
      const safeProfiles = {
        ...profiles,
        apiConfigs: Object.fromEntries(
          Object.entries(profiles.apiConfigs).map(([name, config]) => [
            name,
            { ...config, apiKey: config.apiKey ? '***SET***' : '' }
          ])
        )
      };
      return safeProfiles;
    } catch (error) {
      console.error('Error getting provider profiles:', error);
      throw new Error(`Failed to get provider profiles: ${error.message}`);
    }
  }

  async getProviderProfile(name) {
    try {
      const profile = await this.settingsManager.getProviderProfile(name);
      // Remove API key for client security
      return { ...profile, apiKey: profile.apiKey ? '***SET***' : '' };
    } catch (error) {
      console.error(`Error getting provider profile '${name}':`, error);
      throw new Error(`Failed to get provider profile: ${error.message}`);
    }
  }

  async saveProviderProfile(name, config) {
    try {
      // Handle API key updates
      if (config.apiKey === '***SET***') {
        // Don't update API key if it's the placeholder
        const existingProfile = await this.settingsManager.getProviderProfile(name).catch(() => null);
        if (existingProfile) {
          config.apiKey = existingProfile.apiKey;
        }
      }

      const id = await this.settingsManager.saveProviderProfile(name, config);
      
      this.broadcastUpdate('providerProfileSaved', { name, config: { ...config, apiKey: '***SET***' } });
      
      return id;
    } catch (error) {
      console.error(`Error saving provider profile '${name}':`, error);
      throw new Error(`Failed to save provider profile: ${error.message}`);
    }
  }

  async deleteProviderProfile(name) {
    try {
      await this.settingsManager.deleteProviderProfile(name);
      this.broadcastUpdate('providerProfileDeleted', { name });
    } catch (error) {
      console.error(`Error deleting provider profile '${name}':`, error);
      throw new Error(`Failed to delete provider profile: ${error.message}`);
    }
  }

  async setCurrentProvider(name) {
    try {
      const profile = await this.settingsManager.setCurrentProvider(name);
      this.broadcastUpdate('currentProviderChanged', { 
        name, 
        profile: { ...profile, apiKey: '***SET***' } 
      });
      return profile;
    } catch (error) {
      console.error(`Error setting current provider to '${name}':`, error);
      throw new Error(`Failed to set current provider: ${error.message}`);
    }
  }

  async getCurrentProvider() {
    try {
      const provider = await this.settingsManager.getCurrentProvider();
      return { ...provider, apiKey: provider.apiKey ? '***SET***' : '' };
    } catch (error) {
      console.error('Error getting current provider:', error);
      throw new Error(`Failed to get current provider: ${error.message}`);
    }
  }

  /**
   * Get full provider profile with API key (for server-side use only)
   */
  async getProviderProfileWithApiKey(name) {
    try {
      return await this.settingsManager.getProviderProfile(name);
    } catch (error) {
      console.error(`Error getting provider profile with API key '${name}':`, error);
      throw new Error(`Failed to get provider profile: ${error.message}`);
    }
  }

  async getCurrentProviderWithApiKey() {
    try {
      return await this.settingsManager.getCurrentProvider();
    } catch (error) {
      console.error('Error getting current provider with API key:', error);
      throw new Error(`Failed to get current provider: ${error.message}`);
    }
  }

  /**
   * Global Settings Operations
   */
  async getGlobalSettings() {
    try {
      return await this.settingsManager.getGlobalSettings();
    } catch (error) {
      console.error('Error getting global settings:', error);
      throw new Error(`Failed to get global settings: ${error.message}`);
    }
  }

  async setGlobalSettings(settings) {
    try {
      await this.settingsManager.setGlobalSettings(settings);
      this.broadcastUpdate('globalSettingsChanged', settings);
    } catch (error) {
      console.error('Error setting global settings:', error);
      throw new Error(`Failed to set global settings: ${error.message}`);
    }
  }

  async updateGlobalSetting(key, value) {
    try {
      await this.settingsManager.updateGlobalSetting(key, value);
      this.broadcastUpdate('globalSettingChanged', { key, value });
    } catch (error) {
      console.error(`Error updating global setting '${key}':`, error);
      throw new Error(`Failed to update global setting: ${error.message}`);
    }
  }

  /**
   * Mode Configuration Operations
   */
  async getModeConfigs() {
    try {
      return await this.settingsManager.getModeConfigs();
    } catch (error) {
      console.error('Error getting mode configs:', error);
      throw new Error(`Failed to get mode configs: ${error.message}`);
    }
  }

  async setModeConfigs(configs) {
    try {
      await this.settingsManager.setModeConfigs(configs);
      this.broadcastUpdate('modeConfigsChanged', configs);
    } catch (error) {
      console.error('Error setting mode configs:', error);
      throw new Error(`Failed to set mode configs: ${error.message}`);
    }
  }

  async saveModeConfig(modeConfig) {
    try {
      await this.settingsManager.saveModeConfig(modeConfig);
      this.broadcastUpdate('modeConfigSaved', modeConfig);
    } catch (error) {
      console.error(`Error saving mode config '${modeConfig.slug}':`, error);
      throw new Error(`Failed to save mode config: ${error.message}`);
    }
  }

  async deleteModeConfig(slug) {
    try {
      await this.settingsManager.deleteModeConfig(slug);
      this.broadcastUpdate('modeConfigDeleted', { slug });
    } catch (error) {
      console.error(`Error deleting mode config '${slug}':`, error);
      throw new Error(`Failed to delete mode config: ${error.message}`);
    }
  }

  /**
   * Workspace Override Operations
   */
  async getWorkspaceOverrides() {
    try {
      return await this.settingsManager.getWorkspaceOverrides();
    } catch (error) {
      console.error('Error getting workspace overrides:', error);
      throw new Error(`Failed to get workspace overrides: ${error.message}`);
    }
  }

  async setWorkspaceOverrides(overrides) {
    try {
      await this.settingsManager.setWorkspaceOverrides(overrides);
      this.broadcastUpdate('workspaceOverridesChanged', overrides);
    } catch (error) {
      console.error('Error setting workspace overrides:', error);
      throw new Error(`Failed to set workspace overrides: ${error.message}`);
    }
  }

  /**
   * Combined settings getter that merges global and workspace overrides
   */
  async getAllSettings() {
    try {
      const [providerProfiles, globalSettings, modeConfigs, workspaceOverrides] = await Promise.all([
        this.getProviderProfiles(),
        this.getGlobalSettings(),
        this.getModeConfigs(),
        this.getWorkspaceOverrides()
      ]);

      // Merge global settings with workspace overrides
      const mergedGlobalSettings = { ...globalSettings, ...workspaceOverrides.globalSettings };

      return {
        providerProfiles,
        globalSettings: mergedGlobalSettings,
        modeConfigs,
        workspaceOverrides
      };
    } catch (error) {
      console.error('Error getting all settings:', error);
      throw new Error(`Failed to get all settings: ${error.message}`);
    }
  }

  /**
   * Bulk settings update
   */
  async updateSettings(updates) {
    try {
      const promises = [];

      if (updates.providerProfiles) {
        promises.push(this.settingsManager.setProviderProfiles(updates.providerProfiles));
      }

      if (updates.globalSettings) {
        promises.push(this.setGlobalSettings(updates.globalSettings));
      }

      if (updates.modeConfigs) {
        promises.push(this.setModeConfigs(updates.modeConfigs));
      }

      if (updates.workspaceOverrides) {
        promises.push(this.setWorkspaceOverrides(updates.workspaceOverrides));
      }

      await Promise.all(promises);
      
      this.broadcastUpdate('settingsUpdated', updates);
    } catch (error) {
      console.error('Error updating settings:', error);
      throw new Error(`Failed to update settings: ${error.message}`);
    }
  }

  /**
   * Import/Export Operations
   */
  async exportSettings() {
    try {
      return await this.settingsManager.exportSettings();
    } catch (error) {
      console.error('Error exporting settings:', error);
      throw new Error(`Failed to export settings: ${error.message}`);
    }
  }

  async importSettings(data, options = {}) {
    try {
      await this.settingsManager.importSettings(data, options);
      this.broadcastUpdate('settingsImported', { data, options });
    } catch (error) {
      console.error('Error importing settings:', error);
      throw new Error(`Failed to import settings: ${error.message}`);
    }
  }

  /**
   * Validation helpers
   */
  async validateProviderConfig(config) {
    try {
      this.settingsManager.validateProviderConfig(config);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  async validateGlobalSettings(settings) {
    try {
      this.settingsManager.validateGlobalSettings(settings);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  async validateModeConfig(config) {
    try {
      this.settingsManager.validateModeConfig(config);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Provider availability and models
   */
  getAvailableProviders() {
    return ['anthropic', 'openai', 'claude-code'];
  }

  getAvailableModels(provider) {
    const models = {
      anthropic: [
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
        'claude-3-5-sonnet-20241022'
      ],
      openai: [
        'gpt-4',
        'gpt-4-turbo',
        'gpt-4o',
        'gpt-3.5-turbo'
      ],
      'claude-code': [
        'claude-3-5-sonnet-20241022'
      ]
    };

    return models[provider] || [];
  }

  /**
   * Settings reset
   */
  async resetAllSettings() {
    try {
      await this.settingsManager.resetAllSettings();
      this.broadcastUpdate('settingsReset', {});
    } catch (error) {
      console.error('Error resetting settings:', error);
      throw new Error(`Failed to reset settings: ${error.message}`);
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      // Try to read settings to verify system is working
      await this.getGlobalSettings();
      return { healthy: true, timestamp: Date.now() };
    } catch (error) {
      return { 
        healthy: false, 
        error: error.message, 
        timestamp: Date.now() 
      };
    }
  }

  /**
   * Get settings metadata
   */
  getSettingsInfo() {
    return {
      settingsDir: this.settingsManager.settingsDir,
      files: SettingsManager.FILES,
      availableProviders: this.getAvailableProviders(),
      version: '1.0.0'
    };
  }

  /**
   * Clean up
   */
  destroy() {
    this.removeAllListeners();
    this.webSocketSender = null;
    for (const watcher of this.watchers.values()) {
      if (watcher.close) {
        watcher.close();
      }
    }
    this.watchers.clear();
  }
}

module.exports = SettingsService;