/**
 * Comprehensive Settings Import/Export System for Kilo-Web
 * Handles backup, sharing, and migration of all configuration data
 * Based on the original kilocode settings import/export capabilities
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const ProviderValidator = require('./ProviderValidator');

class SettingsImportExport {
  constructor(settingsManager) {
    this.settingsManager = settingsManager;
    this.providerValidator = new ProviderValidator();
    this.version = '1.0.0';
    this.supportedVersions = ['1.0.0'];
  }

  /**
   * Export all settings with comprehensive metadata
   * @param {Object} options - Export options
   * @returns {Object} Export data
   */
  async exportSettings(options = {}) {
    const {
      includeCategories = ['all'],
      encrypted = false,
      password = null,
      selective = false,
      metadata = {}
    } = options;

    try {
      const exportData = {
        version: this.version,
        exportDate: new Date().toISOString(),
        source: 'kilo-web',
        platform: process.platform,
        metadata: {
          exportedBy: 'kilo-web',
          kiloVersion: this.version,
          ...metadata
        },
        categories: {}
      };

      // Export provider settings
      if (this.shouldIncludeCategory('providerSettings', includeCategories)) {
        exportData.categories.providerSettings = await this.exportProviderSettings();
      }

      // Export global settings
      if (this.shouldIncludeCategory('globalSettings', includeCategories)) {
        exportData.categories.globalSettings = await this.exportGlobalSettings();
      }

      // Export advanced settings
      if (this.shouldIncludeCategory('advancedSettings', includeCategories)) {
        exportData.categories.advancedSettings = await this.exportAdvancedSettings();
      }

      // Export MCP server configurations
      if (this.shouldIncludeCategory('mcpServers', includeCategories)) {
        exportData.categories.mcpServers = await this.exportMCPServers();
      }

      // Export mode configurations
      if (this.shouldIncludeCategory('modeConfigs', includeCategories)) {
        exportData.categories.modeConfigs = await this.exportModeConfigs();
      }

      // Export workspace overrides
      if (this.shouldIncludeCategory('workspaceSettings', includeCategories)) {
        exportData.categories.workspaceSettings = await this.exportWorkspaceSettings();
      }

      // Calculate checksum for integrity
      exportData.checksum = this.calculateChecksum(exportData.categories);

      // Encrypt if requested
      if (encrypted && password) {
        exportData.encrypted = true;
        exportData.categories = this.encryptData(exportData.categories, password);
      }

      return exportData;
    } catch (error) {
      console.error('Export failed:', error);
      throw new Error(`Settings export failed: ${error.message}`);
    }
  }

  /**
   * Import settings with comprehensive validation and conflict resolution
   * @param {Object} importData - The import data
   * @param {Object} options - Import options
   * @returns {Object} Import result
   */
  async importSettings(importData, options = {}) {
    const {
      mergeMode = 'replace',
      validateBeforeImport = true,
      createBackup = true,
      rollbackOnError = true,
      skipCategories = [],
      password = null
    } = options;

    let backupData = null;
    const importResult = {
      success: false,
      imported: {},
      errors: [],
      warnings: [],
      backupCreated: false
    };

    try {
      // Validate import data structure
      const validation = this.validateImportData(importData);
      if (!validation.isValid) {
        throw new Error(`Invalid import data: ${validation.errors.join(', ')}`);
      }

      // Check version compatibility
      if (!this.isVersionCompatible(importData.version)) {
        importData = await this.migrateVersion(importData);
        importResult.warnings.push(`Migrated from version ${importData.version} to ${this.version}`);
      }

      // Decrypt if necessary
      let categories = importData.categories;
      if (importData.encrypted) {
        if (!password) {
          throw new Error('Password required for encrypted import');
        }
        categories = this.decryptData(categories, password);
      }

      // Verify checksum
      if (importData.checksum) {
        const calculatedChecksum = this.calculateChecksum(categories);
        if (calculatedChecksum !== importData.checksum) {
          importResult.warnings.push('Checksum mismatch - data may be corrupted');
        }
      }

      // Create backup if requested
      if (createBackup) {
        backupData = await this.createBackup();
        importResult.backupCreated = true;
      }

      // Validate settings before import
      if (validateBeforeImport) {
        const settingsValidation = await this.validateSettingsData(categories);
        if (settingsValidation.errors.length > 0) {
          importResult.errors = settingsValidation.errors;
          if (rollbackOnError) {
            throw new Error('Settings validation failed');
          }
        }
        importResult.warnings.push(...settingsValidation.warnings);
      }

      // Import each category
      for (const [category, data] of Object.entries(categories)) {
        if (skipCategories.includes(category)) {
          continue;
        }

        try {
          await this.importCategory(category, data, mergeMode);
          importResult.imported[category] = true;
        } catch (error) {
          importResult.errors.push(`Failed to import ${category}: ${error.message}`);
          if (rollbackOnError) {
            throw error;
          }
        }
      }

      importResult.success = Object.keys(importResult.imported).length > 0;
      return importResult;

    } catch (error) {
      console.error('Import failed:', error);
      
      // Rollback if requested and backup exists
      if (rollbackOnError && backupData) {
        try {
          await this.restoreFromBackup(backupData);
          importResult.warnings.push('Settings restored from backup due to import failure');
        } catch (rollbackError) {
          console.error('Rollback failed:', rollbackError);
          importResult.errors.push(`Rollback failed: ${rollbackError.message}`);
        }
      }

      importResult.success = false;
      importResult.errors.push(error.message);
      return importResult;
    }
  }

  /**
   * Create a comprehensive preview of import changes
   * @param {Object} importData - The import data
   * @returns {Object} Preview data
   */
  async createImportPreview(importData) {
    try {
      const preview = {
        valid: false,
        version: importData.version,
        exportDate: importData.exportDate,
        source: importData.source,
        platform: importData.platform,
        categories: {},
        conflicts: [],
        changes: {},
        warnings: [],
        errors: []
      };

      // Validate import data
      const validation = this.validateImportData(importData);
      preview.valid = validation.isValid;
      preview.errors = validation.errors;

      if (!validation.isValid) {
        return preview;
      }

      // Decrypt if necessary (requires password to be provided separately)
      let categories = importData.categories;
      if (importData.encrypted) {
        preview.warnings.push('Encrypted data - password required for full preview');
        return preview;
      }

      // Analyze each category
      for (const [category, data] of Object.entries(categories)) {
        const categoryPreview = await this.createCategoryPreview(category, data);
        preview.categories[category] = categoryPreview;
        
        if (categoryPreview.conflicts.length > 0) {
          preview.conflicts.push(...categoryPreview.conflicts);
        }
        
        preview.changes[category] = categoryPreview.changes;
      }

      return preview;
    } catch (error) {
      console.error('Preview generation failed:', error);
      return {
        valid: false,
        errors: [`Preview failed: ${error.message}`]
      };
    }
  }

  /**
   * Export provider settings
   * @returns {Object} Provider settings data
   */
  async exportProviderSettings() {
    try {
      const providerData = await this.settingsManager.getProviderProfiles();
      
      // Sanitize sensitive data
      const sanitizedData = {
        ...providerData,
        apiConfigs: {}
      };

      for (const [name, config] of Object.entries(providerData.apiConfigs || {})) {
        sanitizedData.apiConfigs[name] = {
          ...config,
          apiKey: config.apiKey ? '***REDACTED***' : undefined
        };
      }

      return sanitizedData;
    } catch (error) {
      console.error('Provider settings export failed:', error);
      return {};
    }
  }

  /**
   * Export global settings
   * @returns {Object} Global settings data
   */
  async exportGlobalSettings() {
    try {
      return await this.settingsManager.getGlobalSettings();
    } catch (error) {
      console.error('Global settings export failed:', error);
      return {};
    }
  }

  /**
   * Export advanced settings
   * @returns {Object} Advanced settings data
   */
  async exportAdvancedSettings() {
    try {
      return await this.settingsManager.exportAdvancedSettings();
    } catch (error) {
      console.error('Advanced settings export failed:', error);
      return {};
    }
  }

  /**
   * Export MCP server configurations
   * @returns {Object} MCP server data
   */
  async exportMCPServers() {
    try {
      const mcpManager = this.settingsManager.getMCPServerManager();
      return await mcpManager.getAllServers();
    } catch (error) {
      console.error('MCP servers export failed:', error);
      return {};
    }
  }

  /**
   * Export mode configurations
   * @returns {Object} Mode config data
   */
  async exportModeConfigs() {
    try {
      return await this.settingsManager.getModeConfigs();
    } catch (error) {
      console.error('Mode configs export failed:', error);
      return {};
    }
  }

  /**
   * Export workspace settings
   * @returns {Object} Workspace settings data
   */
  async exportWorkspaceSettings() {
    try {
      return await this.settingsManager.getWorkspaceOverrides();
    } catch (error) {
      console.error('Workspace settings export failed:', error);
      return {};
    }
  }

  /**
   * Import a specific category
   * @param {string} category - Category name
   * @param {Object} data - Category data
   * @param {string} mergeMode - Merge mode (replace, merge)
   */
  async importCategory(category, data, mergeMode) {
    switch (category) {
      case 'providerSettings':
        await this.importProviderSettings(data, mergeMode);
        break;
      case 'globalSettings':
        await this.importGlobalSettings(data, mergeMode);
        break;
      case 'advancedSettings':
        await this.importAdvancedSettings(data, mergeMode);
        break;
      case 'mcpServers':
        await this.importMCPServers(data, mergeMode);
        break;
      case 'modeConfigs':
        await this.importModeConfigs(data, mergeMode);
        break;
      case 'workspaceSettings':
        await this.importWorkspaceSettings(data, mergeMode);
        break;
      default:
        throw new Error(`Unknown category: ${category}`);
    }
  }

  /**
   * Import provider settings
   * @param {Object} data - Provider settings data
   * @param {string} mergeMode - Merge mode
   */
  async importProviderSettings(data, mergeMode) {
    if (mergeMode === 'merge') {
      const currentSettings = await this.settingsManager.getProviderProfiles();
      const mergedSettings = {
        ...currentSettings,
        ...data,
        apiConfigs: {
          ...currentSettings.apiConfigs,
          ...data.apiConfigs
        }
      };
      await this.settingsManager.setProviderProfiles(mergedSettings);
    } else {
      await this.settingsManager.setProviderProfiles(data);
    }
  }

  /**
   * Import global settings
   * @param {Object} data - Global settings data
   * @param {string} mergeMode - Merge mode
   */
  async importGlobalSettings(data, mergeMode) {
    if (mergeMode === 'merge') {
      const currentSettings = await this.settingsManager.getGlobalSettings();
      const mergedSettings = { ...currentSettings, ...data };
      await this.settingsManager.setGlobalSettings(mergedSettings);
    } else {
      await this.settingsManager.setGlobalSettings(data);
    }
  }

  /**
   * Import advanced settings
   * @param {Object} data - Advanced settings data
   * @param {string} mergeMode - Merge mode
   */
  async importAdvancedSettings(data, mergeMode) {
    await this.settingsManager.importAdvancedSettings(data, { mergeMode });
  }

  /**
   * Import MCP servers
   * @param {Object} data - MCP server data
   * @param {string} mergeMode - Merge mode
   */
  async importMCPServers(data, mergeMode) {
    const mcpManager = this.settingsManager.getMCPServerManager();
    
    if (Array.isArray(data)) {
      for (const serverConfig of data) {
        try {
          await mcpManager.addServer(serverConfig);
        } catch (error) {
          console.warn(`Failed to import MCP server ${serverConfig.name}:`, error);
        }
      }
    }
  }

  /**
   * Import mode configurations
   * @param {Object} data - Mode config data
   * @param {string} mergeMode - Merge mode
   */
  async importModeConfigs(data, mergeMode) {
    if (mergeMode === 'merge') {
      const currentConfigs = await this.settingsManager.getModeConfigs();
      const mergedConfigs = {
        ...currentConfigs,
        customModes: [...(currentConfigs.customModes || []), ...(data.customModes || [])]
      };
      await this.settingsManager.setModeConfigs(mergedConfigs);
    } else {
      await this.settingsManager.setModeConfigs(data);
    }
  }

  /**
   * Import workspace settings
   * @param {Object} data - Workspace settings data
   * @param {string} mergeMode - Merge mode
   */
  async importWorkspaceSettings(data, mergeMode) {
    if (mergeMode === 'merge') {
      const currentSettings = await this.settingsManager.getWorkspaceOverrides();
      const mergedSettings = { ...currentSettings, ...data };
      await this.settingsManager.setWorkspaceOverrides(mergedSettings);
    } else {
      await this.settingsManager.setWorkspaceOverrides(data);
    }
  }

  /**
   * Validate import data structure
   * @param {Object} data - Import data
   * @returns {Object} Validation result
   */
  validateImportData(data) {
    const errors = [];
    
    if (!data || typeof data !== 'object') {
      errors.push('Import data must be an object');
    }

    if (!data.version) {
      errors.push('Import data must include version information');
    }

    if (!data.categories || typeof data.categories !== 'object') {
      errors.push('Import data must include categories');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate settings data using existing validators
   * @param {Object} categories - Settings categories
   * @returns {Object} Validation result
   */
  async validateSettingsData(categories) {
    const errors = [];
    const warnings = [];

    // Validate provider settings
    if (categories.providerSettings) {
      try {
        for (const [name, config] of Object.entries(categories.providerSettings.apiConfigs || {})) {
          if (config.provider) {
            const validation = this.providerValidator.validateProviderConfig(config.provider, config);
            if (!validation.isValid) {
              errors.push(`Provider ${name}: ${validation.errors.map(e => e.message).join(', ')}`);
            }
            warnings.push(...validation.warnings.map(w => `Provider ${name}: ${w.message}`));
          }
        }
      } catch (error) {
        errors.push(`Provider validation failed: ${error.message}`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Check if a version is compatible
   * @param {string} version - Version to check
   * @returns {boolean} Whether version is compatible
   */
  isVersionCompatible(version) {
    return this.supportedVersions.includes(version);
  }

  /**
   * Migrate data from older versions
   * @param {Object} data - Import data
   * @returns {Object} Migrated data
   */
  async migrateVersion(data) {
    const migrated = { ...data };
    migrated.version = this.version;
    return migrated;
  }

  /**
   * Create a backup of current settings
   * @returns {Object} Backup data
   */
  async createBackup() {
    return await this.exportSettings({
      includeCategories: ['all'],
      metadata: { type: 'backup', created: new Date().toISOString() }
    });
  }

  /**
   * Restore settings from backup
   * @param {Object} backupData - Backup data
   */
  async restoreFromBackup(backupData) {
    await this.importSettings(backupData, {
      mergeMode: 'replace',
      validateBeforeImport: false,
      createBackup: false,
      rollbackOnError: false
    });
  }

  /**
   * Create preview for a specific category
   * @param {string} category - Category name
   * @param {Object} data - Category data
   * @returns {Object} Category preview
   */
  async createCategoryPreview(category, data) {
    const preview = {
      category,
      hasData: !!data && Object.keys(data).length > 0,
      conflicts: [],
      changes: {
        additions: [],
        modifications: [],
        deletions: []
      }
    };

    try {
      // Get current data for comparison
      let currentData = {};
      switch (category) {
        case 'providerSettings':
          currentData = await this.settingsManager.getProviderProfiles();
          break;
        case 'globalSettings':
          currentData = await this.settingsManager.getGlobalSettings();
          break;
        // Add other categories as needed
      }

      // Compare and identify changes
      preview.changes = this.compareData(currentData, data);
      
    } catch (error) {
      console.warn(`Preview failed for category ${category}:`, error);
    }

    return preview;
  }

  /**
   * Compare two data objects and identify changes
   * @param {Object} current - Current data
   * @param {Object} incoming - Incoming data
   * @returns {Object} Changes summary
   */
  compareData(current, incoming) {
    const changes = {
      additions: [],
      modifications: [],
      deletions: []
    };

    for (const key of Object.keys(incoming)) {
      if (!(key in current)) {
        changes.additions.push(key);
      } else if (JSON.stringify(current[key]) !== JSON.stringify(incoming[key])) {
        changes.modifications.push(key);
      }
    }

    for (const key of Object.keys(current)) {
      if (!(key in incoming)) {
        changes.deletions.push(key);
      }
    }

    return changes;
  }

  /**
   * Check if a category should be included in export
   * @param {string} category - Category name
   * @param {Array} includeCategories - Categories to include
   * @returns {boolean} Whether to include category
   */
  shouldIncludeCategory(category, includeCategories) {
    return includeCategories.includes('all') || includeCategories.includes(category);
  }

  /**
   * Calculate checksum for data integrity
   * @param {Object} data - Data to checksum
   * @returns {string} SHA256 checksum
   */
  calculateChecksum(data) {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(data));
    return hash.digest('hex');
  }

  /**
   * Encrypt data with password
   * @param {Object} data - Data to encrypt
   * @param {string} password - Password
   * @returns {Object} Encrypted data
   */
  encryptData(data, password) {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(password, 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    return {
      algorithm,
      data: encrypted.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  /**
   * Decrypt data with password
   * @param {Object} encryptedData - Encrypted data
   * @param {string} password - Password
   * @returns {Object} Decrypted data
   */
  decryptData(encryptedData, password) {
    const { algorithm, data, iv, authTag } = encryptedData;
    const key = crypto.scryptSync(password, 'salt', 32);
    
    const decipher = crypto.createDecipher(algorithm, key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(data, 'hex')),
      decipher.final()
    ]);
    
    return JSON.parse(decrypted.toString('utf8'));
  }
}

module.exports = SettingsImportExport;