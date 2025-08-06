import { ExtensionSettings, SettingsValidationError, ProviderSettings } from '../types/settings';

export class SettingsValidator {
  /**
   * Validate all settings and return any validation errors
   */
  static validateSettings(settings: Partial<ExtensionSettings>): SettingsValidationError[] {
    const errors: SettingsValidationError[] = [];

    // Validate provider configuration
    if (settings.apiConfiguration) {
      errors.push(...this.validateProviderSettings(settings.apiConfiguration));
    }

    // Validate auto-approve settings
    errors.push(...this.validateAutoApproveSettings(settings));

    // Validate browser settings
    errors.push(...this.validateBrowserSettings(settings));

    // Validate context management settings
    errors.push(...this.validateContextManagementSettings(settings));

    // Validate terminal settings
    errors.push(...this.validateTerminalSettings(settings));

    // Validate notification settings
    errors.push(...this.validateNotificationSettings(settings));

    return errors;
  }

  /**
   * Validate provider settings
   */
  static validateProviderSettings(config: ProviderSettings): SettingsValidationError[] {
    const errors: SettingsValidationError[] = [];

    // Required fields
    if (!config.provider) {
      errors.push({
        field: 'apiConfiguration.provider',
        message: 'Provider is required',
        severity: 'error'
      });
    }

    if (!config.apiKey?.trim()) {
      errors.push({
        field: 'apiConfiguration.apiKey',
        message: 'API key is required',
        severity: 'error'
      });
    } else if (config.apiKey.length < 10) {
      errors.push({
        field: 'apiConfiguration.apiKey',
        message: 'API key appears to be too short',
        severity: 'warning'
      });
    }

    if (!config.model?.trim()) {
      errors.push({
        field: 'apiConfiguration.model',
        message: 'Model is required',
        severity: 'error'
      });
    }

    // Temperature validation
    if (config.temperature !== undefined) {
      if (config.temperature < 0 || config.temperature > 2) {
        errors.push({
          field: 'apiConfiguration.temperature',
          message: 'Temperature must be between 0 and 2',
          severity: 'error'
        });
      } else if (config.temperature > 1.5) {
        errors.push({
          field: 'apiConfiguration.temperature',
          message: 'High temperature values may produce unpredictable results',
          severity: 'warning'
        });
      }
    }

    // Max tokens validation
    if (config.maxTokens !== undefined) {
      if (config.maxTokens < 1) {
        errors.push({
          field: 'apiConfiguration.maxTokens',
          message: 'Max tokens must be greater than 0',
          severity: 'error'
        });
      } else if (config.maxTokens > 32000) {
        errors.push({
          field: 'apiConfiguration.maxTokens',
          message: 'Max tokens exceeds typical model limits',
          severity: 'warning'
        });
      }
    }

    // Base URL validation
    if (config.baseUrl) {
      try {
        new URL(config.baseUrl);
      } catch {
        errors.push({
          field: 'apiConfiguration.baseUrl',
          message: 'Base URL must be a valid URL',
          severity: 'error'
        });
      }
    }

    // Provider-specific validations
    if (config.provider === 'anthropic') {
      errors.push(...this.validateAnthropicSettings(config));
    } else if (config.provider === 'openai') {
      errors.push(...this.validateOpenAISettings(config));
    }

    return errors;
  }

  /**
   * Validate Anthropic-specific settings
   */
  private static validateAnthropicSettings(config: ProviderSettings): SettingsValidationError[] {
    const errors: SettingsValidationError[] = [];

    if (config.apiKey && !config.apiKey.startsWith('sk-ant-')) {
      errors.push({
        field: 'apiConfiguration.apiKey',
        message: 'Anthropic API keys typically start with "sk-ant-"',
        severity: 'warning'
      });
    }

    const validModels = [
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      'claude-2.1',
      'claude-2.0',
      'claude-instant-1.2'
    ];

    if (config.model && !validModels.includes(config.model)) {
      errors.push({
        field: 'apiConfiguration.model',
        message: 'Model may not be supported by Anthropic',
        severity: 'info'
      });
    }

    return errors;
  }

  /**
   * Validate OpenAI-specific settings
   */
  private static validateOpenAISettings(config: ProviderSettings): SettingsValidationError[] {
    const errors: SettingsValidationError[] = [];

    if (config.apiKey && !config.apiKey.startsWith('sk-')) {
      errors.push({
        field: 'apiConfiguration.apiKey',
        message: 'OpenAI API keys typically start with "sk-"',
        severity: 'warning'
      });
    }

    const validModels = [
      'gpt-4',
      'gpt-4-turbo',
      'gpt-4-turbo-preview',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-16k'
    ];

    if (config.model && !validModels.includes(config.model)) {
      errors.push({
        field: 'apiConfiguration.model',
        message: 'Model may not be supported by OpenAI',
        severity: 'info'
      });
    }

    return errors;
  }

  /**
   * Validate auto-approve settings
   */
  private static validateAutoApproveSettings(settings: Partial<ExtensionSettings>): SettingsValidationError[] {
    const errors: SettingsValidationError[] = [];

    // Request delay validation
    if (settings.requestDelaySeconds !== undefined) {
      if (settings.requestDelaySeconds < 0 || settings.requestDelaySeconds > 60) {
        errors.push({
          field: 'requestDelaySeconds',
          message: 'Request delay must be between 0 and 60 seconds',
          severity: 'error'
        });
      }
    }

    // Max requests validation
    if (settings.allowedMaxRequests !== undefined) {
      if (settings.allowedMaxRequests < 1 || settings.allowedMaxRequests > 1000) {
        errors.push({
          field: 'allowedMaxRequests',
          message: 'Max requests must be between 1 and 1000',
          severity: 'error'
        });
      }
    }

    // Auto-approve timeout validation
    if (settings.followupAutoApproveTimeoutMs !== undefined) {
      if (settings.followupAutoApproveTimeoutMs < 1000 || settings.followupAutoApproveTimeoutMs > 300000) {
        errors.push({
          field: 'followupAutoApproveTimeoutMs',
          message: 'Auto-approve timeout must be between 1 second and 5 minutes',
          severity: 'error'
        });
      }
    }

    // Security warnings
    if (settings.alwaysAllowWrite) {
      errors.push({
        field: 'alwaysAllowWrite',
        message: 'Allowing all write operations can be dangerous',
        severity: 'warning'
      });
    }

    if (settings.alwaysAllowExecute) {
      errors.push({
        field: 'alwaysAllowExecute',
        message: 'Allowing all command executions poses security risks',
        severity: 'warning'
      });
    }

    if (settings.alwaysAllowWriteProtected) {
      errors.push({
        field: 'alwaysAllowWriteProtected',
        message: 'Allowing writes to protected files is very dangerous',
        severity: 'error'
      });
    }

    return errors;
  }

  /**
   * Validate browser settings
   */
  private static validateBrowserSettings(settings: Partial<ExtensionSettings>): SettingsValidationError[] {
    const errors: SettingsValidationError[] = [];

    // Screenshot quality validation
    if (settings.screenshotQuality !== undefined) {
      if (settings.screenshotQuality < 1 || settings.screenshotQuality > 100) {
        errors.push({
          field: 'screenshotQuality',
          message: 'Screenshot quality must be between 1 and 100',
          severity: 'error'
        });
      }
    }

    // Viewport size validation
    if (settings.browserViewportSize) {
      const viewportPattern = /^\d+x\d+$/;
      if (!viewportPattern.test(settings.browserViewportSize)) {
        errors.push({
          field: 'browserViewportSize',
          message: 'Viewport size must be in format "widthxheight" (e.g., "1920x1080")',
          severity: 'error'
        });
      } else {
        const [width, height] = settings.browserViewportSize.split('x').map(Number);
        if (width < 400 || height < 300) {
          errors.push({
            field: 'browserViewportSize',
            message: 'Viewport size is very small and may cause issues',
            severity: 'warning'
          });
        }
        if (width > 4000 || height > 4000) {
          errors.push({
            field: 'browserViewportSize',
            message: 'Very large viewport sizes may cause performance issues',
            severity: 'warning'
          });
        }
      }
    }

    // Remote browser host validation
    if (settings.remoteBrowserHost) {
      try {
        new URL(settings.remoteBrowserHost);
      } catch {
        errors.push({
          field: 'remoteBrowserHost',
          message: 'Remote browser host must be a valid URL',
          severity: 'error'
        });
      }
    }

    return errors;
  }

  /**
   * Validate context management settings
   */
  private static validateContextManagementSettings(settings: Partial<ExtensionSettings>): SettingsValidationError[] {
    const errors: SettingsValidationError[] = [];

    // Max open tabs validation
    if (settings.maxOpenTabsContext !== undefined) {
      if (settings.maxOpenTabsContext < 1 || settings.maxOpenTabsContext > 50) {
        errors.push({
          field: 'maxOpenTabsContext',
          message: 'Max open tabs must be between 1 and 50',
          severity: 'error'
        });
      }
    }

    // Max workspace files validation
    if (settings.maxWorkspaceFiles !== undefined) {
      if (settings.maxWorkspaceFiles < 10 || settings.maxWorkspaceFiles > 10000) {
        errors.push({
          field: 'maxWorkspaceFiles',
          message: 'Max workspace files must be between 10 and 10,000',
          severity: 'error'
        });
      } else if (settings.maxWorkspaceFiles > 1000) {
        errors.push({
          field: 'maxWorkspaceFiles',
          message: 'Large file counts may impact performance',
          severity: 'warning'
        });
      }
    }

    // Max read file lines validation
    if (settings.maxReadFileLine !== undefined) {
      if (settings.maxReadFileLine < 100 || settings.maxReadFileLine > 50000) {
        errors.push({
          field: 'maxReadFileLine',
          message: 'Max read file lines must be between 100 and 50,000',
          severity: 'error'
        });
      }
    }

    // Auto-condense context percentage validation
    if (settings.autoCondenseContextPercent !== undefined) {
      if (settings.autoCondenseContextPercent < 10 || settings.autoCondenseContextPercent > 90) {
        errors.push({
          field: 'autoCondenseContextPercent',
          message: 'Auto-condense percentage must be between 10% and 90%',
          severity: 'error'
        });
      }
    }

    // Fuzzy match threshold validation
    if (settings.fuzzyMatchThreshold !== undefined) {
      if (settings.fuzzyMatchThreshold < 0 || settings.fuzzyMatchThreshold > 1) {
        errors.push({
          field: 'fuzzyMatchThreshold',
          message: 'Fuzzy match threshold must be between 0 and 1',
          severity: 'error'
        });
      }
    }

    return errors;
  }

  /**
   * Validate terminal settings
   */
  private static validateTerminalSettings(settings: Partial<ExtensionSettings>): SettingsValidationError[] {
    const errors: SettingsValidationError[] = [];

    // Terminal output line limit validation
    if (settings.terminalOutputLineLimit !== undefined) {
      if (settings.terminalOutputLineLimit < 10 || settings.terminalOutputLineLimit > 10000) {
        errors.push({
          field: 'terminalOutputLineLimit',
          message: 'Terminal output line limit must be between 10 and 10,000',
          severity: 'error'
        });
      }
    }

    // Terminal output character limit validation
    if (settings.terminalOutputCharacterLimit !== undefined) {
      if (settings.terminalOutputCharacterLimit < 1000 || settings.terminalOutputCharacterLimit > 1000000) {
        errors.push({
          field: 'terminalOutputCharacterLimit',
          message: 'Terminal output character limit must be between 1,000 and 1,000,000',
          severity: 'error'
        });
      }
    }

    // Terminal command delay validation
    if (settings.terminalCommandDelay !== undefined) {
      if (settings.terminalCommandDelay < 0 || settings.terminalCommandDelay > 10000) {
        errors.push({
          field: 'terminalCommandDelay',
          message: 'Terminal command delay must be between 0 and 10,000 milliseconds',
          severity: 'error'
        });
      }
    }

    // Shell integration timeout validation
    if (settings.terminalShellIntegrationTimeout !== undefined) {
      if (settings.terminalShellIntegrationTimeout < 1000 || settings.terminalShellIntegrationTimeout > 60000) {
        errors.push({
          field: 'terminalShellIntegrationTimeout',
          message: 'Shell integration timeout must be between 1 and 60 seconds',
          severity: 'error'
        });
      }
    }

    return errors;
  }

  /**
   * Validate notification settings
   */
  private static validateNotificationSettings(settings: Partial<ExtensionSettings>): SettingsValidationError[] {
    const errors: SettingsValidationError[] = [];

    // Sound volume validation
    if (settings.soundVolume !== undefined) {
      if (settings.soundVolume < 0 || settings.soundVolume > 1) {
        errors.push({
          field: 'soundVolume',
          message: 'Sound volume must be between 0 and 1',
          severity: 'error'
        });
      }
    }

    // TTS speed validation
    if (settings.ttsSpeed !== undefined) {
      if (settings.ttsSpeed < 0.1 || settings.ttsSpeed > 4.0) {
        errors.push({
          field: 'ttsSpeed',
          message: 'TTS speed must be between 0.1 and 4.0',
          severity: 'error'
        });
      }
    }

    return errors;
  }

  /**
   * Validate a single setting field
   */
  static validateField(
    field: keyof ExtensionSettings, 
    value: any, 
    context?: Partial<ExtensionSettings>
  ): SettingsValidationError[] {
    const tempSettings = { [field]: value, ...context };
    const allErrors = this.validateSettings(tempSettings);
    return allErrors.filter(error => error.field === field || error.field.startsWith(`${field}.`));
  }

  /**
   * Check if settings are valid (no error-level validation issues)
   */
  static isValid(settings: Partial<ExtensionSettings>): boolean {
    const errors = this.validateSettings(settings);
    return !errors.some(error => error.severity === 'error');
  }

  /**
   * Get validation summary
   */
  static getValidationSummary(settings: Partial<ExtensionSettings>): {
    isValid: boolean;
    errorCount: number;
    warningCount: number;
    infoCount: number;
    errors: SettingsValidationError[];
  } {
    const errors = this.validateSettings(settings);
    const errorCount = errors.filter(e => e.severity === 'error').length;
    const warningCount = errors.filter(e => e.severity === 'warning').length;
    const infoCount = errors.filter(e => e.severity === 'info').length;

    return {
      isValid: errorCount === 0,
      errorCount,
      warningCount,
      infoCount,
      errors
    };
  }
}

export default SettingsValidator;