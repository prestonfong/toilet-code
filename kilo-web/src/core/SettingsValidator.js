/**
 * Comprehensive Settings Validator
 * Handles cross-category validation, dependency checking, and settings integrity verification
 * Extends the existing ProviderValidator with comprehensive cross-system validation
 */

const ProviderValidator = require('./ProviderValidator');

class SettingsValidator {
  constructor() {
    this.providerValidator = new ProviderValidator();
    this.validationRules = this.initializeValidationRules();
    this.dependencyMatrix = this.initializeDependencyMatrix();
  }

  /**
   * Initialize comprehensive validation rules for all settings categories
   */
  initializeValidationRules() {
    return {
      // Provider settings validation
      providerSettings: {
        rules: [
          {
            id: 'provider_configuration_complete',
            description: 'Ensure provider configuration is complete and valid',
            severity: 'error',
            validate: (settings) => {
              const errors = [];
              const warnings = [];
              
              if (!settings.currentApiConfigName) {
                errors.push({
                  field: 'currentApiConfigName',
                  message: 'No active provider configuration selected',
                  suggestion: 'Select an active provider configuration'
                });
              }
              
              if (!settings.apiConfigs || Object.keys(settings.apiConfigs).length === 0) {
                errors.push({
                  field: 'apiConfigs',
                  message: 'No provider configurations defined',
                  suggestion: 'Create at least one provider configuration'
                });
              }
              
              // Validate each provider configuration
              Object.entries(settings.apiConfigs || {}).forEach(([name, config]) => {
                const validation = this.providerValidator.validateProviderConfig(config.provider, config);
                validation.errors.forEach(error => {
                  errors.push({
                    field: `apiConfigs.${name}.${error.field}`,
                    message: error.message,
                    suggestion: error.suggestion
                  });
                });
                validation.warnings.forEach(warning => {
                  warnings.push({
                    field: `apiConfigs.${name}.${warning.field}`,
                    message: warning.message
                  });
                });
              });
              
              return { errors, warnings };
            }
          },
          {
            id: 'active_provider_exists',
            description: 'Ensure the active provider configuration exists',
            severity: 'error',
            validate: (settings) => {
              const errors = [];
              
              if (settings.currentApiConfigName && 
                  (!settings.apiConfigs || !settings.apiConfigs[settings.currentApiConfigName])) {
                errors.push({
                  field: 'currentApiConfigName',
                  message: `Active provider '${settings.currentApiConfigName}' does not exist`,
                  suggestion: 'Select a valid provider configuration or create the missing one'
                });
              }
              
              return { errors, warnings: [] };
            }
          }
        ]
      },

      // Advanced settings validation
      advancedSettings: {
        rules: [
          {
            id: 'auto_approve_safety',
            description: 'Validate auto-approve settings for safety',
            severity: 'warning',
            validate: (settings) => {
              const warnings = [];
              
              if (settings.alwaysAllowWriteProtected) {
                warnings.push({
                  field: 'alwaysAllowWriteProtected',
                  message: 'Allowing writes to protected files poses significant security risks',
                  suggestion: 'Consider using selective auto-approve rules instead'
                });
              }
              
              if (settings.alwaysAllowExecute && settings.alwaysAllowWrite) {
                warnings.push({
                  field: 'autoApprove',
                  message: 'Both execute and write permissions are auto-approved - high risk configuration',
                  suggestion: 'Consider limiting auto-approve to specific commands or file patterns'
                });
              }
              
              if (settings.requestDelaySeconds === 0 && (settings.alwaysAllowWrite || settings.alwaysAllowExecute)) {
                warnings.push({
                  field: 'requestDelaySeconds',
                  message: 'No delay with auto-approve enabled may lead to rapid unintended actions',
                  suggestion: 'Add a small delay (1-2 seconds) to allow for review'
                });
              }
              
              return { errors: [], warnings };
            }
          },
          {
            id: 'browser_tools_security',
            description: 'Validate browser tools security settings',
            severity: 'warning',
            validate: (settings) => {
              const warnings = [];
              
              if (settings.alwaysAllowBrowser && settings.remoteBrowserEnabled) {
                warnings.push({
                  field: 'browserTools',
                  message: 'Auto-approving remote browser operations poses security risks',
                  suggestion: 'Consider manual approval for remote browser operations'
                });
              }
              
              if (settings.screenshotQuality > 90 && settings.alwaysAllowBrowser) {
                warnings.push({
                  field: 'screenshotQuality',
                  message: 'High quality screenshots with auto-approve may impact performance',
                  suggestion: 'Consider reducing screenshot quality for auto-approved operations'
                });
              }
              
              return { errors: [], warnings };
            }
          },
          {
            id: 'context_management_limits',
            description: 'Validate context management settings for performance',
            severity: 'warning',
            validate: (settings) => {
              const warnings = [];
              
              if (settings.maxWorkspaceFiles > 2000) {
                warnings.push({
                  field: 'maxWorkspaceFiles',
                  message: 'Very high workspace file limit may impact performance',
                  suggestion: 'Consider using file filtering or reducing the limit'
                });
              }
              
              if (settings.maxReadFileLine > 10000) {
                warnings.push({
                  field: 'maxReadFileLine',
                  message: 'High read file line limit may cause memory issues with large files',
                  suggestion: 'Consider reducing the limit or enabling selective reading'
                });
              }
              
              if (settings.autoCondenseContextPercent < 20) {
                warnings.push({
                  field: 'autoCondenseContextPercent',
                  message: 'Very low auto-condense threshold may cause frequent context compression',
                  suggestion: 'Consider increasing to 30-50% for better performance'
                });
              }
              
              return { errors: [], warnings };
            }
          }
        ]
      },

      // MCP settings validation
      mcpSettings: {
        rules: [
          {
            id: 'mcp_server_configuration_valid',
            description: 'Validate MCP server configurations',
            severity: 'error',
            validate: (settings, mcpServers = []) => {
              const errors = [];
              const warnings = [];
              
              mcpServers.forEach(server => {
                if (!server.name || !server.name.trim()) {
                  errors.push({
                    field: `mcpServers.${server.id}.name`,
                    message: 'MCP server name is required',
                    suggestion: 'Provide a descriptive name for the server'
                  });
                }
                
                if (!server.command && !server.uri) {
                  errors.push({
                    field: `mcpServers.${server.id}`,
                    message: 'MCP server must have either command or URI specified',
                    suggestion: 'Configure either a local command or remote URI'
                  });
                }
                
                if (server.uri && !this.isValidUri(server.uri)) {
                  errors.push({
                    field: `mcpServers.${server.id}.uri`,
                    message: 'Invalid URI format for MCP server',
                    suggestion: 'Use valid URI format (http://, https://, or sse://)'
                  });
                }
                
                if (server.enabled && !server.validated) {
                  warnings.push({
                    field: `mcpServers.${server.id}`,
                    message: 'MCP server is enabled but not validated',
                    suggestion: 'Test the server connection before enabling'
                  });
                }
              });
              
              return { errors, warnings };
            }
          }
        ]
      },

      // Mode configuration validation
      modeSettings: {
        rules: [
          {
            id: 'mode_provider_compatibility',
            description: 'Ensure mode configurations are compatible with provider capabilities',
            severity: 'error',
            validate: (settings, modeConfigs = {}) => {
              const errors = [];
              const warnings = [];
              
              // Get current provider info
              const currentProviderName = settings.currentApiConfigName;
              const currentProvider = settings.apiConfigs?.[currentProviderName];
              
              if (!currentProvider) {
                return { errors, warnings };
              }
              
              // Check custom modes for compatibility
              (modeConfigs.customModes || []).forEach(mode => {
                // Check if mode requires specific capabilities
                if (mode.requirements) {
                  if (mode.requirements.vision && !this.providerSupportsVision(currentProvider.provider)) {
                    warnings.push({
                      field: `modes.${mode.slug}`,
                      message: `Mode '${mode.name}' requires vision support but current provider may not support it`,
                      suggestion: 'Switch to a vision-capable provider or disable vision-dependent modes'
                    });
                  }
                  
                  if (mode.requirements.toolUse && !this.providerSupportsToolUse(currentProvider.provider)) {
                    warnings.push({
                      field: `modes.${mode.slug}`,
                      message: `Mode '${mode.name}' requires tool use but current provider may not support it`,
                      suggestion: 'Switch to a tool-capable provider or adjust mode requirements'
                    });
                  }
                  
                  if (mode.requirements.minTokens && 
                      currentProvider.maxTokens < mode.requirements.minTokens) {
                    warnings.push({
                      field: `modes.${mode.slug}`,
                      message: `Mode '${mode.name}' requires ${mode.requirements.minTokens} tokens but provider is configured for ${currentProvider.maxTokens}`,
                      suggestion: 'Increase provider max tokens or adjust mode requirements'
                    });
                  }
                }
                
                // Check mode-specific provider overrides
                if (settings.modeApiConfigs && settings.modeApiConfigs[mode.slug]) {
                  const modeProvider = settings.apiConfigs[settings.modeApiConfigs[mode.slug]];
                  if (!modeProvider) {
                    errors.push({
                      field: `modeApiConfigs.${mode.slug}`,
                      message: `Mode '${mode.name}' is configured to use non-existent provider`,
                      suggestion: 'Update mode provider configuration or create the missing provider'
                    });
                  }
                }
              });
              
              return { errors, warnings };
            }
          }
        ]
      }
    };
  }

  /**
   * Initialize dependency matrix for cross-category validation
   */
  initializeDependencyMatrix() {
    return {
      // Dependencies between different settings categories
      dependencies: [
        {
          id: 'provider_mode_compatibility',
          source: 'providerSettings',
          target: 'modeSettings',
          description: 'Provider must support mode requirements',
          validate: (sourceSettings, targetSettings) => {
            return this.validateProviderModeCompatibility(sourceSettings, targetSettings);
          }
        },
        {
          id: 'mcp_workflow_tools',
          source: 'mcpSettings',
          target: 'workflowSettings',
          description: 'Workflow tools must be available in MCP servers',
          validate: (mcpSettings, workflowSettings) => {
            return this.validateMCPWorkflowTools(mcpSettings, workflowSettings);
          }
        },
        {
          id: 'advanced_provider_limits',
          source: 'advancedSettings',
          target: 'providerSettings',
          description: 'Advanced settings must respect provider limits',
          validate: (advancedSettings, providerSettings) => {
            return this.validateAdvancedProviderLimits(advancedSettings, providerSettings);
          }
        }
      ]
    };
  }

  /**
   * Perform comprehensive validation of all settings
   */
  async validateAllSettings(settingsData) {
    const results = {
      isValid: true,
      errors: [],
      warnings: [],
      categoryResults: {},
      dependencyResults: {},
      summary: {
        totalErrors: 0,
        totalWarnings: 0,
        categoriesValidated: 0,
        dependenciesChecked: 0
      }
    };

    try {
      // Validate each category
      for (const [category, categoryRules] of Object.entries(this.validationRules)) {
        const categoryData = settingsData[category] || {};
        const categoryResult = await this.validateCategory(category, categoryData, settingsData);
        
        results.categoryResults[category] = categoryResult;
        results.errors.push(...categoryResult.errors);
        results.warnings.push(...categoryResult.warnings);
        results.summary.categoriesValidated++;
      }

      // Validate cross-category dependencies  
      for (const dependency of this.dependencyMatrix.dependencies) {
        const sourceData = settingsData[dependency.source] || {};
        const targetData = settingsData[dependency.target] || {};
        const dependencyResult = await dependency.validate(sourceData, targetData);
        
        results.dependencyResults[dependency.id] = dependencyResult;
        results.errors.push(...dependencyResult.errors);
        results.warnings.push(...dependencyResult.warnings);
        results.summary.dependenciesChecked++;
      }

      // Calculate summary
      results.summary.totalErrors = results.errors.length;
      results.summary.totalWarnings = results.warnings.length;
      results.isValid = results.summary.totalErrors === 0;

      // Add performance analysis
      results.performanceAnalysis = this.analyzePerformanceImpact(settingsData);
      
      // Add security analysis
      results.securityAnalysis = this.analyzeSecurityRisks(settingsData);

    } catch (error) {
      results.errors.push({
        field: 'validation',
        message: `Validation process failed: ${error.message}`,
        suggestion: 'Check settings format and try again'
      });
      results.isValid = false;
    }

    return results;
  }

  /**
   * Validate specific category
   */
  async validateCategory(category, categoryData, fullSettings) {
    const result = {
      category,
      isValid: true,
      errors: [],
      warnings: []
    };

    const categoryRules = this.validationRules[category];
    if (!categoryRules) {
      return result;
    }

    for (const rule of categoryRules.rules) {
      try {
        const ruleResult = await rule.validate(categoryData, fullSettings.mcpServers, fullSettings.modeConfigs);
        result.errors.push(...ruleResult.errors);
        result.warnings.push(...ruleResult.warnings);
      } catch (error) {
        result.errors.push({
          field: category,
          message: `Rule '${rule.id}' failed: ${error.message}`,
          suggestion: 'Check rule implementation'
        });
      }
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * Real-time validation for settings changes
   */
  async validateSettingsChange(category, field, value, currentSettings) {
    const errors = [];
    const warnings = [];

    try {
      // Create temporary settings with the change
      const tempSettings = {
        ...currentSettings,
        [category]: {
          ...currentSettings[category],
          [field]: value
        }
      };

      // Run relevant validations
      const categoryRules = this.validationRules[category];
      if (categoryRules) {
        for (const rule of categoryRules.rules) {
          const ruleResult = await rule.validate(tempSettings[category], tempSettings.mcpServers, tempSettings.modeConfigs);
          
          // Filter results to only include those related to the changed field
          const fieldErrors = ruleResult.errors.filter(error => 
            error.field === field || error.field.includes(field)
          );
          const fieldWarnings = ruleResult.warnings.filter(warning => 
            warning.field === field || warning.field.includes(field)
          );
          
          errors.push(...fieldErrors);
          warnings.push(...fieldWarnings);
        }
      }

      // Check cross-category dependencies
      for (const dependency of this.dependencyMatrix.dependencies) {
        if (dependency.source === category || dependency.target === category) {
          const sourceData = tempSettings[dependency.source] || {};
          const targetData = tempSettings[dependency.target] || {};
          const dependencyResult = await dependency.validate(sourceData, targetData);
          
          errors.push(...dependencyResult.errors);
          warnings.push(...dependencyResult.warnings);
        }
      }

    } catch (error) {
      errors.push({
        field,
        message: `Validation failed: ${error.message}`,
        suggestion: 'Check input format and try again'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Analyze performance impact of settings
   */
  analyzePerformanceImpact(settings) {
    const analysis = {
      impact: 'low',
      factors: [],
      recommendations: []
    };

    // Check various performance factors
    if (settings.advancedSettings?.maxWorkspaceFiles > 1000) {
      analysis.factors.push('High workspace file limit may slow file operations');
      analysis.impact = 'medium';
    }

    if (settings.advancedSettings?.maxReadFileLine > 5000) {
      analysis.factors.push('High read line limit may cause memory usage spikes');
      analysis.impact = 'medium';
    }

    if (settings.advancedSettings?.screenshotQuality > 80) {
      analysis.factors.push('High screenshot quality increases processing time');
      analysis.impact = analysis.impact === 'high' ? 'high' : 'medium';
    }

    if ((settings.mcpServers || []).length > 5) {
      analysis.factors.push('Many MCP servers may slow startup and operations');
      analysis.impact = 'medium';
    }

    if (settings.advancedSettings?.autoCondenseContextPercent < 30) {
      analysis.factors.push('Low auto-condense threshold causes frequent processing');
      analysis.impact = analysis.impact === 'high' ? 'high' : 'medium';
    }

    // Generate recommendations
    if (analysis.impact !== 'low') {
      analysis.recommendations.push('Consider optimizing settings for better performance');
      if (analysis.factors.some(f => f.includes('file'))) {
        analysis.recommendations.push('Reduce file-related limits or use filtering');
      }
      if (analysis.factors.some(f => f.includes('screenshot'))) {
        analysis.recommendations.push('Lower screenshot quality for routine operations');
      }
    }

    return analysis;
  }

  /**
   * Analyze security risks in settings
   */
  analyzeSecurityRisks(settings) {
    const analysis = {
      riskLevel: 'low',
      risks: [],
      recommendations: []
    };

    const advanced = settings.advancedSettings || {};

    // Check security-related settings
    if (advanced.alwaysAllowWriteProtected) {
      analysis.risks.push('Auto-approval for protected file writes');
      analysis.riskLevel = 'high';
    }

    if (advanced.alwaysAllowExecute && advanced.alwaysAllowWrite) {
      analysis.risks.push('Auto-approval for both execution and file modification');
      analysis.riskLevel = analysis.riskLevel === 'high' ? 'high' : 'medium';
    }

    if (advanced.remoteBrowserEnabled && advanced.alwaysAllowBrowser) {
      analysis.risks.push('Auto-approval for remote browser operations');
      analysis.riskLevel = analysis.riskLevel === 'high' ? 'high' : 'medium';
    }

    if (advanced.requestDelaySeconds === 0 && (advanced.alwaysAllowWrite || advanced.alwaysAllowExecute)) {
      analysis.risks.push('No delay for auto-approved dangerous operations');
      analysis.riskLevel = analysis.riskLevel === 'high' ? 'high' : 'medium';
    }

    // Generate recommendations
    if (analysis.riskLevel !== 'low') {
      analysis.recommendations.push('Review auto-approval settings for security implications');
      if (analysis.risks.some(r => r.includes('protected'))) {
        analysis.recommendations.push('Disable auto-approval for protected files');
      }
      if (analysis.risks.some(r => r.includes('delay'))) {
        analysis.recommendations.push('Add delay for dangerous auto-approved operations');
      }
    }

    return analysis;
  }

  /**
   * Helper methods for validation
   */
  isValidUri(uri) {
    try {
      new URL(uri);
      return true;
    } catch {
      return false;
    }
  }

  providerSupportsVision(provider) {
    const visionProviders = ['anthropic', 'openai', 'gemini-cli'];
    return visionProviders.includes(provider);
  }

  providerSupportsToolUse(provider) {
    const toolProviders = ['anthropic', 'openai', 'claude-code'];
    return toolProviders.includes(provider);
  }

  validateProviderModeCompatibility(providerSettings, modeSettings) {
    const errors = [];
    const warnings = [];
    
    // Implementation would check specific compatibility requirements
    return { errors, warnings };
  }

  validateMCPWorkflowTools(mcpSettings, workflowSettings) {
    const errors = [];
    const warnings = [];
    
    // Implementation would check tool availability
    return { errors, warnings };
  }

  validateAdvancedProviderLimits(advancedSettings, providerSettings) {
    const errors = [];
    const warnings = [];
    
    // Implementation would check limits compatibility
    return { errors, warnings };
  }

  /**
   * Get validation schema for a specific category
   */
  getValidationSchema(category) {
    return this.validationRules[category] || null;
  }

  /**
   * Get all available validation categories
   */
  getValidationCategories() {
    return Object.keys(this.validationRules);
  }
}

module.exports = SettingsValidator;