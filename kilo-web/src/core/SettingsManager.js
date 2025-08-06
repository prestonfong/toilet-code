/**
 * Core Settings Manager for Kilo-Web
 * Handles configuration management, validation, and persistence
 * Based on the original kilocode ProviderSettingsManager but adapted for web
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const ProviderSettingsManager = require('./ProviderSettingsManager');
const ContextManager = require('./ContextManager');
const AutoApproveManager = require('./AutoApproveManager');
const CheckpointManager = require('./CheckpointManager');
const BrowserToolsManager = require('./BrowserToolsManager');
const MCPServerManager = require('./MCPServerManager');
const SettingsValidator = require('./SettingsValidator');
const SettingsMigrator = require('./SettingsMigrator');

class SettingsManager {
  static SETTINGS_DIR = '.kilo/settings';
  static FILES = {
    PROVIDER_PROFILES: 'provider-profiles.json',
    GLOBAL_SETTINGS: 'global-settings.json',
    MODE_CONFIGS: 'mode-configs.json',
    WORKSPACE_OVERRIDES: 'workspace-overrides.json',
    MIGRATIONS: 'migrations.json',
    MCP_SERVERS: 'mcp-servers.json'
  };

  constructor(workspaceDir = './') {
    this.workspaceDir = workspaceDir;
    this.settingsDir = path.join(workspaceDir, SettingsManager.SETTINGS_DIR);
    this._lock = Promise.resolve();
    
    // Initialize provider settings manager
    this.providerSettingsManager = new ProviderSettingsManager(workspaceDir);
    
    // Initialize advanced settings managers
    this.contextManager = new ContextManager(workspaceDir);
    this.autoApproveManager = new AutoApproveManager(workspaceDir);
    this.checkpointManager = new CheckpointManager(workspaceDir);
    this.browserToolsManager = new BrowserToolsManager(workspaceDir);
    this.mcpServerManager = new MCPServerManager(workspaceDir);
    
    // Initialize validation and migration systems
    this.settingsValidator = new SettingsValidator();
    this.settingsMigrator = new SettingsMigrator(this);
    
    // Default configurations (legacy support)
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
      },
      // Advanced settings
      contextManagement: {
        ...ContextManager.DEFAULT_SETTINGS
      },
      autoApprove: {
        ...AutoApproveManager.DEFAULT_SETTINGS
      },
      checkpoints: {
        ...CheckpointManager.DEFAULT_SETTINGS
      },
      browserTools: {
        ...BrowserToolsManager.DEFAULT_SETTINGS
      },
      mcpServers: {
        enabled: true,
        autoStart: true,
        healthCheckInterval: 30000,
        maxRetries: 3,
        retryDelay: 5000,
        builtinServersEnabled: true
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
        
        // Run migrations with new system
        await this.runMigrationsNew();
        
        // Initialize provider settings manager
        await this.providerSettingsManager.initialize();
        
        // Load and validate settings
        const allSettings = await this.loadAllSettings();
        const validationResult = await this.validateSettings(allSettings);
        
        if (!validationResult.isValid) {
          console.warn('⚠️ Settings validation issues found:', validationResult.errors.length);
          for (const error of validationResult.errors.slice(0, 3)) {
            console.warn(`  - ${error.message}`);
          }
          if (validationResult.errors.length > 3) {
            console.warn(`  ... and ${validationResult.errors.length - 3} more issues`);
          }
        }
        
        // Initialize advanced settings managers
        const globalSettings = await this.getGlobalSettings();
        await this.contextManager.initialize(globalSettings.contextManagement);
        await this.autoApproveManager.initialize(globalSettings.autoApprove);
        await this.checkpointManager.initialize(globalSettings.checkpoints);
        await this.browserToolsManager.initialize(globalSettings.browserTools);
        await this.mcpServerManager.initialize();
        
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
   * Run any necessary migrations (legacy method for backward compatibility)
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
   * Run migrations using new migration system
   */
  async runMigrationsNew() {
    try {
      // Load all current settings
      const allSettings = await this.loadAllSettings();
      
      // Check if migration is needed
      const migrationCheck = await this.settingsMigrator.checkMigrationNeeded(allSettings);
      
      if (migrationCheck.needed) {
        console.log(`🔄 Settings migration needed: ${migrationCheck.currentVersion} → ${migrationCheck.targetVersion}`);
        
        if (migrationCheck.backupRecommended) {
          console.log('📁 Creating backup before migration...');
        }
        
        // Execute migration with progress logging
        const migrationResult = await this.settingsMigrator.executeMigration(allSettings, {
          createBackup: true,
          validateAfter: true,
          progressCallback: (progress) => {
            if (progress.step === 'complete') {
              console.log('✅ Migration completed successfully');
            } else if (progress.message) {
              console.log(`🔄 ${progress.message}`);
            }
          }
        });
        
        if (migrationResult.success) {
          // Save migrated settings
          await this.saveAllSettings(migrationResult.migratedData);
          
          if (migrationResult.warnings.length > 0) {
            console.warn('⚠️ Migration completed with warnings:', migrationResult.warnings);
          }
        } else {
          console.error('❌ Migration failed:', migrationResult.errors);
          throw new Error(`Settings migration failed: ${migrationResult.errors.join(', ')}`);
        }
      } else {
        console.log('✅ Settings are up to date, no migration needed');
      }
      
      // Always run legacy migrations for backward compatibility
      await this.runMigrations();
      
    } catch (error) {
      console.error('❌ Migration system error, falling back to legacy:', error.message);
      await this.runMigrations();
    }
  }

  /**
   * Provider Profiles Management
   */
  // Provider Profile Management - Delegated to ProviderSettingsManager
  async getProviderProfiles() {
    try {
      // Try new provider settings manager first
      const profiles = await this.providerSettingsManager.listProfiles();
      const providerProfiles = await this.providerSettingsManager.load();
      return providerProfiles;
    } catch (error) {
      // Fallback to legacy implementation
      console.warn('Using legacy provider profiles:', error.message);
      return this.lock(async () => {
        return await this.readJsonFile(SettingsManager.FILES.PROVIDER_PROFILES);
      });
    }
  }

  async setProviderProfiles(profiles) {
    try {
      // Validate using new validation system first
      const validationResult = await this.settingsValidator.validateProviderSettings(profiles);
      if (!validationResult.isValid) {
        const errorMessages = validationResult.errors.map(e => e.message).join(', ');
        throw new Error(`Provider profiles validation failed: ${errorMessages}`);
      }
      
      // Use new provider settings manager
      await this.providerSettingsManager.store(profiles);
    } catch (error) {
      // Fallback to legacy implementation
      console.warn('Using legacy provider profiles storage:', error.message);
      return this.lock(async () => {
        this.validateProviderProfiles(profiles);
        await this.writeJsonFile(
          path.join(this.settingsDir, SettingsManager.FILES.PROVIDER_PROFILES),
          profiles
        );
      });
    }
  }

  async getProviderProfile(name) {
    try {
      return await this.providerSettingsManager.getProfile({ name });
    } catch (error) {
      // Fallback to legacy implementation
      const profiles = await this.getProviderProfiles();
      const profile = profiles.apiConfigs[name];
      if (!profile) {
        throw new Error(`Provider profile '${name}' not found`);
      }
      return { name, ...profile };
    }
  }

  async saveProviderProfile(name, config) {
    try {
      return await this.providerSettingsManager.saveProfile(name, config);
    } catch (error) {
      // Fallback to legacy implementation
      console.warn('Using legacy provider profile save:', error.message);
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
  }

  async deleteProviderProfile(name) {
    try {
      return await this.providerSettingsManager.deleteProfile(name);
    } catch (error) {
      // Fallback to legacy implementation
      console.warn('Using legacy provider profile delete:', error.message);
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
  }

  async setCurrentProvider(name) {
    try {
      return await this.providerSettingsManager.activateProfile({ name });
    } catch (error) {
      // Fallback to legacy implementation
      console.warn('Using legacy provider activation:', error.message);
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
  }

  async getCurrentProvider() {
    try {
      return await this.providerSettingsManager.getCurrentProvider();
    } catch (error) {
      // Fallback to legacy implementation
      const profiles = await this.getProviderProfiles();
      const currentName = profiles.currentApiConfigName;
      const currentProfile = profiles.apiConfigs[currentName];
      
      if (!currentProfile) {
        throw new Error(`Current provider '${currentName}' not found`);
      }

      return { name: currentName, ...currentProfile };
    }
  }

  // Provider Settings Manager Access
  getProviderSettingsManager() {
    return this.providerSettingsManager;
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
      // Validate using new validation system first, fallback to legacy
      try {
        const validationResult = await this.settingsValidator.validateGlobalSettings(settings);
        if (!validationResult.isValid) {
          const errorMessages = validationResult.errors.map(e => e.message).join(', ');
          throw new Error(`Global settings validation failed: ${errorMessages}`);
        }
      } catch (validationError) {
        console.warn('Using legacy validation for global settings:', validationError.message);
        this.validateGlobalSettings(settings);
      }
      
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
   * Advanced Settings Management
   */
  async getAdvancedSettings(section = null) {
    const globalSettings = await this.getGlobalSettings();
    
    if (section) {
      switch (section) {
        case 'context':
          return globalSettings.contextManagement || {};
        case 'autoApprove':
          return globalSettings.autoApprove || {};
        case 'checkpoints':
          return globalSettings.checkpoints || {};
        case 'browserTools':
          return globalSettings.browserTools || {};
        default:
          throw new Error(`Unknown advanced settings section: ${section}`);
      }
    }
    
    return {
      contextManagement: globalSettings.contextManagement || {},
      autoApprove: globalSettings.autoApprove || {},
      checkpoints: globalSettings.checkpoints || {},
      browserTools: globalSettings.browserTools || {},
      mcpServers: globalSettings.mcpServers || {}
    };
  }

  async updateAdvancedSettings(section, settings) {
    return this.lock(async () => {
      const globalSettings = await this.getGlobalSettings();
      
      switch (section) {
        case 'context':
          globalSettings.contextManagement = { ...globalSettings.contextManagement, ...settings };
          await this.contextManager.initialize(globalSettings.contextManagement);
          break;
        case 'autoApprove':
          globalSettings.autoApprove = { ...globalSettings.autoApprove, ...settings };
          await this.autoApproveManager.initialize(globalSettings.autoApprove);
          break;
        case 'checkpoints':
          globalSettings.checkpoints = { ...globalSettings.checkpoints, ...settings };
          await this.checkpointManager.initialize(globalSettings.checkpoints);
          break;
        case 'browserTools':
          globalSettings.browserTools = { ...globalSettings.browserTools, ...settings };
          await this.browserToolsManager.initialize(globalSettings.browserTools);
          break;
        case 'mcpServers':
          globalSettings.mcpServers = { ...globalSettings.mcpServers, ...settings };
          // MCP server manager doesn't need reinitialization for settings changes
          break;
        default:
          throw new Error(`Unknown advanced settings section: ${section}`);
      }
      
      await this.setGlobalSettings(globalSettings);
    });
  }

  /**
   * Advanced Manager Access
   */
  getContextManager() {
    return this.contextManager;
  }

  getAutoApproveManager() {
    return this.autoApproveManager;
  }

  getCheckpointManager() {
    return this.checkpointManager;
  }

  getBrowserToolsManager() {
    return this.browserToolsManager;
  }

  getMCPServerManager() {
    return this.mcpServerManager;
  }

  /**
   * Advanced Settings Analytics
   */
  async getAdvancedSettingsAnalytics() {
    const analytics = {
      contextManager: this.contextManager.getContextAnalytics(),
      autoApprove: this.autoApproveManager.getSessionStats(),
      checkpoints: this.checkpointManager.getStats(),
      browserTools: this.browserToolsManager.getStats(),
      mcpServers: this.mcpServerManager.getServerStats()
    };
    
    return analytics;
  }

  /**
   * Export advanced settings
   */
  async exportAdvancedSettings() {
    const advancedSettings = await this.getAdvancedSettings();
    const analytics = await this.getAdvancedSettingsAnalytics();
    
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      settings: advancedSettings,
      analytics,
      metadata: {
        exportType: 'advanced-settings',
        kiloVersion: '1.0.0',
        platform: process.platform
      },
      mcpServers: await this.mcpServerManager.getAllServers()
    };
  }

  /**
   * Import advanced settings
   */
  async importAdvancedSettings(data, options = {}) {
    return this.lock(async () => {
      const { mergeMode = 'replace' } = options;
      
      this.validateAdvancedImportData(data);
      
      if (data.settings) {
        const globalSettings = await this.getGlobalSettings();
        
        if (mergeMode === 'merge') {
          globalSettings.contextManagement = { ...globalSettings.contextManagement, ...data.settings.contextManagement };
          globalSettings.autoApprove = { ...globalSettings.autoApprove, ...data.settings.autoApprove };
          globalSettings.checkpoints = { ...globalSettings.checkpoints, ...data.settings.checkpoints };
          globalSettings.browserTools = { ...globalSettings.browserTools, ...data.settings.browserTools };
        } else {
          globalSettings.contextManagement = data.settings.contextManagement || globalSettings.contextManagement;
          globalSettings.autoApprove = data.settings.autoApprove || globalSettings.autoApprove;
          globalSettings.checkpoints = data.settings.checkpoints || globalSettings.checkpoints;
          globalSettings.browserTools = data.settings.browserTools || globalSettings.browserTools;
          globalSettings.mcpServers = data.settings.mcpServers || globalSettings.mcpServers;
          globalSettings.mcpServers = data.settings.mcpServers || globalSettings.mcpServers;
        }
        
        await this.setGlobalSettings(globalSettings);
        
        // Reinitialize managers with new settings
        await this.contextManager.initialize(globalSettings.contextManagement);
        await this.autoApproveManager.initialize(globalSettings.autoApprove);
        await this.checkpointManager.initialize(globalSettings.checkpoints);
        await this.browserToolsManager.initialize(globalSettings.browserTools);
        // Note: MCP servers handled separately via import functionality
      }
    });
  }

  /**
   * Reset advanced settings to defaults
   */
  async resetAdvancedSettings() {
    return this.lock(async () => {
      const globalSettings = await this.getGlobalSettings();
      
      globalSettings.contextManagement = { ...ContextManager.DEFAULT_SETTINGS };
      globalSettings.autoApprove = { ...AutoApproveManager.DEFAULT_SETTINGS };
      globalSettings.checkpoints = { ...CheckpointManager.DEFAULT_SETTINGS };
      globalSettings.browserTools = { ...BrowserToolsManager.DEFAULT_SETTINGS };
      globalSettings.mcpServers = {
        enabled: true,
        autoStart: true,
        healthCheckInterval: 30000,
        maxRetries: 3,
        retryDelay: 5000,
        builtinServersEnabled: true
      };
      
      await this.setGlobalSettings(globalSettings);
      
      // Reinitialize managers with default settings
      await this.contextManager.initialize(globalSettings.contextManagement);
      await this.autoApproveManager.initialize(globalSettings.autoApprove);
      await this.checkpointManager.initialize(globalSettings.checkpoints);
      await this.browserToolsManager.initialize(globalSettings.browserTools);
      // MCP servers will be reset when the manager is reinitialized
      
      console.log('🔄 Advanced settings reset to defaults');
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
   * Import/Export functionality - Enhanced
   */
  async exportSettings(options = {}) {
    // Delegate to comprehensive import/export system
    const SettingsImportExport = require('./SettingsImportExport');
    const importExport = new SettingsImportExport(this);
    return await importExport.exportSettings(options);
  }

  async importSettings(data, options = {}) {
    // Delegate to comprehensive import/export system
    const SettingsImportExport = require('./SettingsImportExport');
    const importExport = new SettingsImportExport(this);
    return await importExport.importSettings(data, options);
  }

  // Legacy export for backward compatibility
  async exportSettingsLegacy() {
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

  async importSettingsLegacy(data, options = {}) {
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
   * Create comprehensive settings backup
   */
  async createSettingsBackup() {
    const SettingsImportExport = require('./SettingsImportExport');
    const importExport = new SettingsImportExport(this);
    return await importExport.createBackup();
  }

  /**
   * Restore settings from backup
   */
  async restoreSettingsFromBackup(backupData) {
    const SettingsImportExport = require('./SettingsImportExport');
    const importExport = new SettingsImportExport(this);
    return await importExport.restoreFromBackup(backupData);
  }

  /**
   * Additional methods required by SettingsImportExport
   */
  async getProviderProfiles() {
    // Implementation depends on how provider profiles are stored
    // This is a placeholder - adjust based on actual implementation
    return this.settings.providerProfiles || { apiConfigs: {} };
  }

  async setProviderProfiles(profiles) {
    this.settings.providerProfiles = profiles;
    await this.saveSettings();
  }

  async getGlobalSettings() {
    return this.settings.globalSettings || {};
  }

  async setGlobalSettings(settings) {
    this.settings.globalSettings = settings;
    await this.saveSettings();
  }

  async getModeConfigs() {
    return this.settings.modeConfigs || {};
  }

  async setModeConfigs(configs) {
    this.settings.modeConfigs = configs;
    await this.saveSettings();
  }

  async getWorkspaceOverrides() {
    return this.settings.workspaceOverrides || {};
  }

  async setWorkspaceOverrides(overrides) {
    this.settings.workspaceOverrides = overrides;
    await this.saveSettings();
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

  validateAdvancedImportData(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Advanced import data must be an object');
    }

    if (data.settings) {
      if (typeof data.settings !== 'object') {
        throw new Error('Advanced settings must be an object');
      }
      
      // Validate individual sections if present
      const sections = ['contextManagement', 'autoApprove', 'checkpoints', 'browserTools', 'mcpServers'];
      for (const section of sections) {
        if (data.settings[section] && typeof data.settings[section] !== 'object') {
          throw new Error(`${section} settings must be an object`);
        }
      }
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

  /**
   * Cleanup advanced managers
   */
  async cleanup() {
    try {
      await this.contextManager.cleanup();
      await this.autoApproveManager.cleanup();
      await this.checkpointManager.cleanup();
      await this.browserToolsManager.cleanup();
      console.log('🧹 Advanced managers cleaned up');
    } catch (error) {
      console.error('Error cleaning up advanced managers:', error);
    }
  }

  /**
   * Validation and Migration Integration Methods
   */

  /**
   * Load all settings for validation and migration
   */
  async loadAllSettings() {
    const [providerProfiles, globalSettings, modeConfigs, workspaceOverrides] = await Promise.all([
      this.getProviderProfiles().catch(() => this.defaultProviderProfiles),
      this.getGlobalSettings().catch(() => this.defaultGlobalSettings),
      this.getModeConfigs().catch(() => ({ customModes: [] })),
      this.getWorkspaceOverrides().catch(() => ({}))
    ]);

    // Get MCP server configurations
    let mcpServers = [];
    try {
      mcpServers = await this.mcpServerManager.getAllServers();
    } catch (error) {
      console.warn('Could not load MCP servers for validation:', error.message);
    }

    return {
      providerSettings: providerProfiles,
      globalSettings,
      advancedSettings: {
        contextManagement: globalSettings.contextManagement || {},
        autoApprove: globalSettings.autoApprove || {},
        checkpoints: globalSettings.checkpoints || {},
        browserTools: globalSettings.browserTools || {},
        mcpServers: globalSettings.mcpServers || {}
      },
      modeConfigs,
      workspaceOverrides,
      mcpServers,
      metadata: {
        version: globalSettings.version || '1.0.0',
        lastValidated: null,
        validationErrors: []
      }
    };
  }

  /**
   * Save all settings after migration
   */
  async saveAllSettings(allSettings) {
    await Promise.all([
      this.setProviderProfiles(allSettings.providerSettings),
      this.setGlobalSettings(allSettings.globalSettings),
      this.setModeConfigs(allSettings.modeConfigs),
      this.setWorkspaceOverrides(allSettings.workspaceOverrides)
    ]);

    // Update MCP servers if they exist
    if (allSettings.mcpServers && Array.isArray(allSettings.mcpServers)) {
      try {
        for (const server of allSettings.mcpServers) {
          await this.mcpServerManager.addServer(server);
        }
      } catch (error) {
        console.warn('Could not save MCP servers after migration:', error.message);
      }
    }
  }

  /**
   * Validate all settings using comprehensive validation system
   */
  async validateSettings(allSettings, options = {}) {
    try {
      return await this.settingsValidator.validateAllSettings(allSettings, options);
    } catch (error) {
      console.warn('Comprehensive validation failed, using basic validation:', error.message);
      
      // Fallback to basic validation
      try {
        this.validateProviderProfiles(allSettings.providerSettings);
        this.validateGlobalSettings(allSettings.globalSettings);
        this.validateModeConfigs(allSettings.modeConfigs);
        
        return {
          isValid: true,
          errors: [],
          warnings: [`Comprehensive validation unavailable: ${error.message}`],
          summary: { total: 0, errors: 0, warnings: 1 }
        };
      } catch (basicError) {
        return {
          isValid: false,
          errors: [{ message: basicError.message, category: 'validation', severity: 'error' }],
          warnings: [],
          summary: { total: 1, errors: 1, warnings: 0 }
        };
      }
    }
  }

  /**
   * Perform real-time validation of specific settings section
   */
  async validateSettingsSection(section, data, options = {}) {
    try {
      switch (section) {
        case 'provider':
          return await this.settingsValidator.validateProviderSettings(data, options);
        case 'global':
          return await this.settingsValidator.validateGlobalSettings(data, options);
        case 'advanced':
          return await this.settingsValidator.validateAdvancedSettings(data, options);
        case 'mode':
          return await this.settingsValidator.validateModeConfigs(data, options);
        default:
          throw new Error(`Unknown settings section: ${section}`);
      }
    } catch (error) {
      return {
        isValid: false,
        errors: [{ message: error.message, category: section, severity: 'error' }],
        warnings: [],
        summary: { total: 1, errors: 1, warnings: 0 }
      };
    }
  }

  /**
   * Get validation and migration status
   */
  async getSystemHealth() {
    try {
      const allSettings = await this.loadAllSettings();
      const validationResult = await this.validateSettings(allSettings);
      const migrationCheck = await this.settingsMigrator.checkMigrationNeeded(allSettings);
      const migrationHistory = await this.settingsMigrator.getMigrationHistory(allSettings);
      const availableRollbacks = await this.settingsMigrator.getAvailableRollbacks();

      return {
        validation: {
          isValid: validationResult.isValid,
          errorCount: validationResult.errors.length,
          warningCount: validationResult.warnings.length,
          lastValidated: allSettings.metadata?.lastValidated,
          summary: validationResult.summary
        },
        migration: {
          currentVersion: migrationCheck.currentVersion,
          targetVersion: migrationCheck.targetVersion,
          migrationNeeded: migrationCheck.needed,
          backupRecommended: migrationCheck.backupRecommended,
          historyCount: migrationHistory.length,
          rollbacksAvailable: availableRollbacks.length
        },
        system: {
          healthy: validationResult.isValid && !migrationCheck.needed,
          lastChecked: Date.now()
        }
      };
    } catch (error) {
      return {
        validation: { isValid: false, errorCount: 1, warningCount: 0 },
        migration: { migrationNeeded: false, currentVersion: 'unknown' },
        system: { healthy: false, error: error.message, lastChecked: Date.now() }
      };
    }
  }

  /**
   * Perform startup health check and automatic fixes
   */
  async performStartupHealthCheck() {
    console.log('🔍 Performing startup health check...');
    
    try {
      const health = await this.getSystemHealth();
      
      if (!health.system.healthy) {
        console.warn('⚠️ System health issues detected');
        
        if (health.migration.migrationNeeded) {
          console.log('🔄 Automatic migration will be handled during initialization');
        }
        
        if (!health.validation.isValid) {
          console.warn(`⚠️ Found ${health.validation.errorCount} validation error(s) and ${health.validation.warningCount} warning(s)`);
          console.log('💡 Consider reviewing your settings configuration');
        }
      } else {
        console.log('✅ System health check passed');
      }
      
      return health;
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      return {
        validation: { isValid: false },
        migration: { migrationNeeded: false },
        system: { healthy: false, error: error.message }
      };
    }
  }

  /**
   * Get Settings Validator instance
   */
  getSettingsValidator() {
    return this.settingsValidator;
  }

  /**
   * Get Settings Migrator instance
   */
  getSettingsMigrator() {
    return this.settingsMigrator;
  }
}

module.exports = SettingsManager;