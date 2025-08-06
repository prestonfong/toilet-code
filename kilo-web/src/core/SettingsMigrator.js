/**
 * Settings Migration System
 * Handles version migrations, backward compatibility, and data integrity verification
 * Supports automatic migration with rollback capabilities
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class SettingsMigrator {
  constructor(settingsManager) {
    this.settingsManager = settingsManager;
    this.migrationSchemas = this.initializeMigrationSchemas();
    this.currentVersion = '2.0.0';
    this.backupRetentionDays = 30;
  }

  /**
   * Initialize migration schemas for different version transitions
   */
  initializeMigrationSchemas() {
    return {
      // Version history and migration paths
      versions: {
        '1.0.0': {
          description: 'Initial version with basic provider settings',
          releaseDate: '2024-01-01',
          breaking: false
        },
        '1.5.0': {
          description: 'Added advanced settings and MCP support',
          releaseDate: '2024-06-01',
          breaking: false
        },
        '2.0.0': {
          description: 'Comprehensive settings restructure with validation system',
          releaseDate: '2024-12-01',
          breaking: true
        }
      },

      // Migration definitions
      migrations: [
        {
          id: 'v1.0.0_to_v1.5.0',
          fromVersion: '1.0.0',
          toVersion: '1.5.0',
          description: 'Add advanced settings structure',
          breaking: false,
          automatic: true,
          migrations: [
            {
              type: 'add_default_section',
              path: 'advancedSettings',
              value: {
                contextManagement: {
                  enabled: true,
                  maxContextSize: 100000,
                  autoCondense: false,
                  condensingProvider: null
                },
                autoApprove: {
                  enabled: false,
                  rules: [],
                  timeout: 30000
                },
                browserTools: {
                  enabled: true,
                  viewportSize: '1280x720',
                  quality: 75
                },
                checkpoints: {
                  enabled: false,
                  autoSave: true,
                  maxCheckpoints: 10
                }
              }
            },
            {
              type: 'add_default_section',
              path: 'mcpServers',
              value: []
            }
          ]
        },
        {
          id: 'v1.5.0_to_v2.0.0',
          fromVersion: '1.5.0',
          toVersion: '2.0.0',
          description: 'Restructure settings for comprehensive validation system',
          breaking: true,
          automatic: true,
          migrations: [
            {
              type: 'restructure_provider_settings',
              description: 'Convert legacy provider format to new structure',
              transform: (oldSettings) => {
                const newProviderSettings = {
                  currentApiConfigName: oldSettings.currentApiConfigName || 'default',
                  apiConfigs: {},
                  modeApiConfigs: oldSettings.modeApiConfigs || {}
                };

                // Convert existing API configs
                Object.entries(oldSettings.apiConfigs || {}).forEach(([name, config]) => {
                  newProviderSettings.apiConfigs[name] = {
                    ...config,
                    id: config.id || this.generateId(),
                    validated: false,
                    createdAt: Date.now(),
                    lastUsed: null
                  };
                });

                return newProviderSettings;
              }
            },
            {
              type: 'restructure_advanced_settings',
              description: 'Reorganize advanced settings with new validation structure',
              transform: (oldAdvanced) => {
                const newAdvanced = {
                  contextManagement: {
                    enabled: oldAdvanced.contextManagement?.enabled ?? true,
                    maxContextSize: oldAdvanced.contextManagement?.maxContextSize ?? 100000,
                    autoCondense: oldAdvanced.contextManagement?.autoCondense ?? false,
                    autoCondenseThreshold: oldAdvanced.contextManagement?.autoCondensePercent ?? 80,
                    maxOpenTabs: oldAdvanced.maxOpenTabsContext ?? 5,
                    maxWorkspaceFiles: oldAdvanced.maxWorkspaceFiles ?? 200,
                    maxReadLines: oldAdvanced.maxReadFileLine ?? 1000,
                    fuzzyMatchThreshold: oldAdvanced.fuzzyMatchThreshold ?? 0.8
                  },
                  autoApprove: {
                    enabled: false,
                    rules: {
                      alwaysAllowReadOnly: oldAdvanced.alwaysAllowReadOnly ?? false,
                      alwaysAllowWrite: oldAdvanced.alwaysAllowWrite ?? false,
                      alwaysAllowExecute: oldAdvanced.alwaysAllowExecute ?? false,
                      alwaysAllowBrowser: oldAdvanced.alwaysAllowBrowser ?? false,
                      alwaysAllowMcp: oldAdvanced.alwaysAllowMcp ?? false,
                      alwaysAllowWriteProtected: oldAdvanced.alwaysAllowWriteProtected ?? false
                    },
                    requestDelay: oldAdvanced.requestDelaySeconds ?? 0,
                    maxRequests: oldAdvanced.allowedMaxRequests ?? 50,
                    timeout: oldAdvanced.followupAutoApproveTimeoutMs ?? 30000,
                    allowedCommands: oldAdvanced.allowedCommands ?? [],
                    deniedCommands: oldAdvanced.deniedCommands ?? []
                  },
                  browserTools: {
                    enabled: oldAdvanced.browserToolEnabled ?? true,
                    viewportSize: oldAdvanced.browserViewportSize ?? '1280x720',
                    screenshotQuality: oldAdvanced.screenshotQuality ?? 75,
                    remoteEnabled: oldAdvanced.remoteBrowserEnabled ?? false,
                    remoteHost: oldAdvanced.remoteBrowserHost ?? null
                  },
                  checkpoints: {
                    enabled: oldAdvanced.enableCheckpoints ?? false,
                    autoSave: true,
                    maxCheckpoints: 10,
                    diffEnabled: oldAdvanced.diffEnabled ?? true
                  },
                  notifications: {
                    soundEnabled: oldAdvanced.soundEnabled ?? true,
                    soundVolume: oldAdvanced.soundVolume ?? 0.5,
                    ttsEnabled: oldAdvanced.ttsEnabled ?? false,
                    ttsSpeed: oldAdvanced.ttsSpeed ?? 1.0,
                    systemNotifications: oldAdvanced.systemNotificationsEnabled ?? true
                  },
                  terminal: {
                    outputLineLimit: oldAdvanced.terminalOutputLineLimit ?? 500,
                    outputCharLimit: oldAdvanced.terminalOutputCharacterLimit ?? 50000,
                    commandDelay: oldAdvanced.terminalCommandDelay ?? 0,
                    shellIntegrationTimeout: oldAdvanced.terminalShellIntegrationTimeout ?? 5000
                  }
                };

                return newAdvanced;
              }
            },
            {
              type: 'add_validation_metadata',
              description: 'Add validation and migration metadata',
              transform: (settings) => {
                return {
                  ...settings,
                  metadata: {
                    version: '2.0.0',
                    migratedFrom: settings.metadata?.version || '1.5.0',
                    migrationDate: Date.now(),
                    validationEnabled: true,
                    lastValidated: null,
                    validationErrors: [],
                    migrationHistory: [
                      ...(settings.metadata?.migrationHistory || []),
                      {
                        fromVersion: settings.metadata?.version || '1.5.0',
                        toVersion: '2.0.0',
                        date: Date.now(),
                        automatic: true,
                        success: true
                      }
                    ]
                  }
                };
              }
            },
            {
              type: 'restructure_mcp_servers',
              description: 'Update MCP server configuration format',
              transform: (mcpServers) => {
                if (!Array.isArray(mcpServers)) {
                  return [];
                }

                return mcpServers.map(server => ({
                  ...server,
                  id: server.id || this.generateId(),
                  version: server.version || '1.0.0',
                  validated: false,
                  lastValidated: null,
                  healthStatus: 'unknown',
                  capabilities: server.capabilities || {},
                  createdAt: server.createdAt || Date.now(),
                  updatedAt: Date.now()
                }));
              }
            }
          ]
        }
      ]
    };
  }

  /**
   * Check if migration is needed
   */
  async checkMigrationNeeded(settingsData) {
    const currentVersion = settingsData.metadata?.version || '1.0.0';
    const needsMigration = this.compareVersions(currentVersion, this.currentVersion) < 0;
    
    const migrationPlan = [];
    if (needsMigration) {
      migrationPlan.push(...this.buildMigrationPlan(currentVersion, this.currentVersion));
    }

    return {
      needed: needsMigration,
      currentVersion,
      targetVersion: this.currentVersion,
      migrationPlan,
      backupRecommended: migrationPlan.some(m => m.breaking),
      estimatedTime: this.estimateMigrationTime(migrationPlan)
    };
  }

  /**
   * Build migration plan from source version to target version
   */
  buildMigrationPlan(fromVersion, toVersion) {
    const plan = [];
    let currentVersion = fromVersion;

    while (this.compareVersions(currentVersion, toVersion) < 0) {
      const migration = this.migrationSchemas.migrations.find(m => 
        m.fromVersion === currentVersion
      );

      if (!migration) {
        throw new Error(`No migration path found from version ${currentVersion}`);
      }

      plan.push(migration);
      currentVersion = migration.toVersion;
    }

    return plan;
  }

  /**
   * Execute migration plan
   */
  async executeMigration(settingsData, options = {}) {
    const { 
      createBackup = true, 
      validateAfter = true, 
      dryRun = false,
      progressCallback = null 
    } = options;

    const migrationResult = {
      success: false,
      originalVersion: settingsData.metadata?.version || '1.0.0',
      targetVersion: this.currentVersion,
      migratedData: null,
      backupPath: null,
      errors: [],
      warnings: [],
      steps: [],
      rollbackAvailable: false
    };

    try {
      // Check if migration is needed
      const migrationCheck = await this.checkMigrationNeeded(settingsData);
      if (!migrationCheck.needed) {
        migrationResult.success = true;
        migrationResult.migratedData = settingsData;
        return migrationResult;
      }

      // Create backup if requested
      if (createBackup && !dryRun) {
        const backupResult = await this.createMigrationBackup(settingsData);
        migrationResult.backupPath = backupResult.path;
        migrationResult.rollbackAvailable = true;
        
        if (progressCallback) {
          progressCallback({ step: 'backup', progress: 10, message: 'Backup created' });
        }
      }

      // Execute migration steps
      let currentData = { ...settingsData };
      const totalSteps = migrationCheck.migrationPlan.length;

      for (let i = 0; i < migrationCheck.migrationPlan.length; i++) {
        const migration = migrationCheck.migrationPlan[i];
        const stepResult = await this.executeMigrationStep(currentData, migration, dryRun);
        
        migrationResult.steps.push(stepResult);
        migrationResult.errors.push(...stepResult.errors);
        migrationResult.warnings.push(...stepResult.warnings);

        if (stepResult.success) {
          currentData = stepResult.migratedData;
        } else {
          throw new Error(`Migration step failed: ${stepResult.errors.join(', ')}`);
        }

        if (progressCallback) {
          const progress = 10 + (80 * (i + 1) / totalSteps);
          progressCallback({ 
            step: `migration-${i}`, 
            progress, 
            message: `Completed: ${migration.description}` 
          });
        }
      }

      // Validate migrated data if requested
      if (validateAfter && !dryRun) {
        const SettingsValidator = require('./SettingsValidator');
        const validator = new SettingsValidator();
        
        const validationResult = await validator.validateAllSettings(currentData);
        if (!validationResult.isValid) {
          migrationResult.warnings.push(
            ...validationResult.errors.map(e => `Validation: ${e.message}`)
          );
        }

        if (progressCallback) {
          progressCallback({ step: 'validation', progress: 95, message: 'Validation completed' });
        }
      }

      migrationResult.success = true;
      migrationResult.migratedData = currentData;

      if (progressCallback) {
        progressCallback({ step: 'complete', progress: 100, message: 'Migration completed successfully' });
      }

    } catch (error) {
      migrationResult.errors.push(error.message);
      
      // Attempt rollback if backup is available
      if (migrationResult.backupPath && !dryRun) {
        try {
          const rollbackData = await this.rollbackMigration(migrationResult.backupPath);
          migrationResult.warnings.push('Migration failed, but rollback completed successfully');
        } catch (rollbackError) {
          migrationResult.errors.push(`Rollback also failed: ${rollbackError.message}`);
        }
      }
    }

    return migrationResult;
  }

  /**
   * Execute a single migration step
   */
  async executeMigrationStep(settingsData, migration, dryRun = false) {
    const stepResult = {
      migrationId: migration.id,
      success: false,
      migratedData: null,
      errors: [],
      warnings: [],
      changes: []
    };

    try {
      let currentData = { ...settingsData };

      for (const migrationStep of migration.migrations) {
        const changeResult = await this.applyMigrationChange(currentData, migrationStep, dryRun);
        
        stepResult.changes.push(changeResult);
        stepResult.errors.push(...changeResult.errors);
        stepResult.warnings.push(...changeResult.warnings);

        if (changeResult.success) {
          currentData = changeResult.data;
        } else {
          throw new Error(`Migration change failed: ${changeResult.errors.join(', ')}`);
        }
      }

      stepResult.success = true;
      stepResult.migratedData = currentData;

    } catch (error) {
      stepResult.errors.push(error.message);
    }

    return stepResult;
  }

  /**
   * Apply individual migration change
   */
  async applyMigrationChange(data, change, dryRun = false) {
    const changeResult = {
      type: change.type,
      success: false,
      data: { ...data },
      errors: [],
      warnings: [],
      description: change.description || `Applied ${change.type}`
    };

    try {
      switch (change.type) {
        case 'add_default_section':
          changeResult.data = this.applyAddDefaultSection(data, change);
          break;

        case 'restructure_provider_settings':
          changeResult.data = this.applyRestructureProviderSettings(data, change);
          break;

        case 'restructure_advanced_settings':
          changeResult.data = this.applyRestructureAdvancedSettings(data, change);
          break;

        case 'add_validation_metadata':
          changeResult.data = this.applyAddValidationMetadata(data, change);
          break;

        case 'restructure_mcp_servers':
          changeResult.data = this.applyRestructureMcpServers(data, change);
          break;

        case 'rename_field':
          changeResult.data = this.applyRenameField(data, change);
          break;

        case 'remove_deprecated':
          changeResult.data = this.applyRemoveDeprecated(data, change);
          break;

        case 'transform_values':
          changeResult.data = this.applyTransformValues(data, change);
          break;

        default:
          throw new Error(`Unknown migration type: ${change.type}`);
      }

      changeResult.success = true;

    } catch (error) {
      changeResult.errors.push(error.message);
    }

    return changeResult;
  }

  /**
   * Migration change implementations
   */
  applyAddDefaultSection(data, change) {
    const newData = { ...data };
    const pathParts = change.path.split('.');
    let current = newData;

    // Navigate to parent of target path
    for (let i = 0; i < pathParts.length - 1; i++) {
      if (!current[pathParts[i]]) {
        current[pathParts[i]] = {};
      }
      current = current[pathParts[i]];
    }

    // Add the new section if it doesn't exist
    const targetKey = pathParts[pathParts.length - 1];
    if (!current[targetKey]) {
      current[targetKey] = change.value;
    }

    return newData;
  }

  applyRestructureProviderSettings(data, change) {
    const newData = { ...data };
    const transformed = change.transform.call(this, data.providerSettings || data);
    newData.providerSettings = transformed;
    return newData;
  }

  applyRestructureAdvancedSettings(data, change) {
    const newData = { ...data };
    const transformed = change.transform.call(this, data.advancedSettings || {});
    newData.advancedSettings = transformed;
    return newData;
  }

  applyAddValidationMetadata(data, change) {
    return change.transform.call(this, data);
  }

  applyRestructureMcpServers(data, change) {
    const newData = { ...data };
    const transformed = change.transform.call(this, data.mcpServers || []);
    newData.mcpServers = transformed;
    return newData;
  }

  applyRenameField(data, change) {
    const newData = { ...data };
    // Implementation for renaming fields
    return newData;
  }

  applyRemoveDeprecated(data, change) {
    const newData = { ...data };
    // Implementation for removing deprecated fields
    return newData;
  }

  applyTransformValues(data, change) {
    const newData = { ...data };
    // Implementation for transforming values
    return newData;
  }

  /**
   * Create migration backup
   */
  async createMigrationBackup(settingsData) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `settings-backup-${timestamp}.json`;
    const backupDir = path.join(this.settingsManager.settingsDir, 'backups');
    const backupPath = path.join(backupDir, backupFileName);

    try {
      // Ensure backup directory exists
      await fs.mkdir(backupDir, { recursive: true });

      // Create backup with metadata
      const backupData = {
        version: settingsData.metadata?.version || '1.0.0',
        backupDate: Date.now(),
        backupType: 'migration',
        originalData: settingsData,
        checksums: {
          data: this.calculateChecksum(JSON.stringify(settingsData))
        }
      };

      await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2), 'utf8');

      // Cleanup old backups
      await this.cleanupOldBackups(backupDir);

      return {
        path: backupPath,
        size: (await fs.stat(backupPath)).size,
        checksum: backupData.checksums.data
      };

    } catch (error) {
      throw new Error(`Failed to create migration backup: ${error.message}`);
    }
  }

  /**
   * Rollback migration using backup
   */
  async rollbackMigration(backupPath) {
    try {
      const backupContent = await fs.readFile(backupPath, 'utf8');
      const backupData = JSON.parse(backupContent);

      // Verify backup integrity
      const dataChecksum = this.calculateChecksum(JSON.stringify(backupData.originalData));
      if (dataChecksum !== backupData.checksums.data) {
        throw new Error('Backup data integrity check failed');
      }

      return backupData.originalData;

    } catch (error) {
      throw new Error(`Failed to rollback migration: ${error.message}`);
    }
  }

  /**
   * Cleanup old backup files
   */
  async cleanupOldBackups(backupDir) {
    try {
      const files = await fs.readdir(backupDir);
      const cutoffDate = Date.now() - (this.backupRetentionDays * 24 * 60 * 60 * 1000);

      for (const file of files) {
        if (file.startsWith('settings-backup-')) {
          const filePath = path.join(backupDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime.getTime() < cutoffDate) {
            await fs.unlink(filePath);
          }
        }
      }
    } catch (error) {
      // Non-critical error, log but don't throw
      console.warn('Failed to cleanup old backups:', error.message);
    }
  }

  /**
   * Utility methods
   */
  compareVersions(version1, version2) {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part < v2Part) return -1;
      if (v1Part > v2Part) return 1;
    }
    
    return 0;
  }

  estimateMigrationTime(migrationPlan) {
    // Estimate migration time based on complexity
    const baseTime = 1000; // 1 second base
    const complexityMultiplier = migrationPlan.reduce((total, migration) => {
      return total + migration.migrations.length * (migration.breaking ? 2 : 1);
    }, 0);
    
    return baseTime * complexityMultiplier;
  }

  calculateChecksum(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  generateId() {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Get migration history
   */
  async getMigrationHistory(settingsData) {
    return settingsData.metadata?.migrationHistory || [];
  }

  /**
   * Get available rollback points
   */
  async getAvailableRollbacks() {
    const backupDir = path.join(this.settingsManager.settingsDir, 'backups');
    const rollbacks = [];

    try {
      const files = await fs.readdir(backupDir);
      
      for (const file of files) {
        if (file.startsWith('settings-backup-')) {
          const filePath = path.join(backupDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const backupData = JSON.parse(content);
          const stats = await fs.stat(filePath);
          
          rollbacks.push({
            path: filePath,
            version: backupData.version,
            date: backupData.backupDate,
            size: stats.size,
            type: backupData.backupType || 'manual'
          });
        }
      }
    } catch (error) {
      // Return empty array if no backups directory
    }

    return rollbacks.sort((a, b) => b.date - a.date);
  }

  /**
   * Validate migration integrity
   */
  async validateMigrationIntegrity(beforeData, afterData, migrationPlan) {
    const issues = [];

    // Check that essential data wasn't lost
    if (beforeData.providerSettings && !afterData.providerSettings) {
      issues.push('Provider settings were lost during migration');
    }

    // Check that API configs were preserved
    const beforeConfigs = Object.keys(beforeData.providerSettings?.apiConfigs || {});
    const afterConfigs = Object.keys(afterData.providerSettings?.apiConfigs || {});
    
    if (beforeConfigs.length > afterConfigs.length) {
      issues.push('Some API configurations were lost during migration');
    }

    // Check migration metadata
    if (!afterData.metadata?.migrationHistory?.length) {
      issues.push('Migration history not properly recorded');
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }
}

module.exports = SettingsMigrator;