/**
 * Provider Validator
 * Comprehensive validation system for all provider configurations
 * Supports real-time field validation, full configuration validation, and provider-specific rules
 */

class ProviderValidator {
  constructor() {
    this.providerSchemas = this.initializeProviderSchemas();
  }

  /**
   * Initialize validation schemas for all supported providers
   */
  initializeProviderSchemas() {
    return {
      anthropic: {
        name: 'Anthropic',
        requiredFields: ['apiKey'],
        optionalFields: ['model', 'temperature', 'maxTokens', 'baseUrl'],
        validations: {
          apiKey: {
            required: true,
            pattern: /^sk-ant-[a-zA-Z0-9_-]{95,}$/,
            message: 'API key must start with "sk-ant-" and be at least 100 characters long',
            suggestion: 'Get your API key from https://console.anthropic.com/'
          },
          model: {
            required: false,
            enum: [
              'claude-3-5-sonnet-20241022',
              'claude-3-5-sonnet-20240620', 
              'claude-3-5-haiku-20241022',
              'claude-3-opus-20240229',
              'claude-3-sonnet-20240229',
              'claude-3-haiku-20240307'
            ],
            default: 'claude-3-5-sonnet-20241022'
          },
          temperature: {
            required: false,
            type: 'number',
            min: 0,
            max: 1,
            default: 0.7
          },
          maxTokens: {
            required: false,
            type: 'number',
            min: 1,
            max: 4096,
            default: 4096
          },
          baseUrl: {
            required: false,
            type: 'url',
            default: 'https://api.anthropic.com'
          }
        }
      },

      openai: {
        name: 'OpenAI',
        requiredFields: ['apiKey'],
        optionalFields: ['model', 'temperature', 'maxTokens', 'baseUrl', 'orgId'],
        validations: {
          apiKey: {
            required: true,
            pattern: /^sk-[a-zA-Z0-9]{48,}$/,
            message: 'API key must start with "sk-" and be at least 51 characters long',
            suggestion: 'Get your API key from https://platform.openai.com/api-keys'
          },
          model: {
            required: false,
            enum: [
              'gpt-4o',
              'gpt-4o-mini',
              'gpt-4-turbo',
              'gpt-4',
              'gpt-3.5-turbo'
            ],
            default: 'gpt-4o'
          },
          temperature: {
            required: false,
            type: 'number',
            min: 0,
            max: 2,
            default: 0.7
          },
          maxTokens: {
            required: false,
            type: 'number',
            min: 1,
            max: 4096,
            default: 4096
          },
          baseUrl: {
            required: false,
            type: 'url',
            default: 'https://api.openai.com/v1'
          },
          orgId: {
            required: false,
            pattern: /^org-[a-zA-Z0-9]{24}$/,
            message: 'Organization ID must start with "org-" followed by 24 characters'
          }
        }
      },

      'claude-code': {
        name: 'Claude Code',
        requiredFields: ['claudeCodePath'],
        optionalFields: ['model', 'claudeCodeMaxOutputTokens', 'temperature'],
        validations: {
          claudeCodePath: {
            required: true,
            type: 'string',
            message: 'Path to Claude CLI executable is required',
            suggestion: 'Install Claude CLI from https://claude.ai/cli'
          },
          model: {
            required: false,
            enum: [
              'claude-3-5-sonnet-20241022',
              'claude-3-5-haiku-20241022',
              'claude-3-opus-20240229'
            ],
            default: 'claude-3-5-sonnet-20241022'
          },
          claudeCodeMaxOutputTokens: {
            required: false,
            type: 'number',
            min: 1,
            max: 200000,
            default: 4096
          },
          temperature: {
            required: false,
            type: 'number',
            min: 0,
            max: 1,
            default: 0.7
          }
        }
      },

      cerebras: {
        name: 'Cerebras',
        requiredFields: ['apiKey'],
        optionalFields: ['model', 'temperature', 'maxTokens', 'topP'],
        validations: {
          apiKey: {
            required: true,
            type: 'string',
            minLength: 32,
            message: 'Cerebras API key is required',
            suggestion: 'Get your API key from https://cloud.cerebras.ai/'
          },
          model: {
            required: false,
            enum: [
              'llama3.1-8b',
              'llama3.1-70b', 
              'llama3.1-405b',
              'llama-3.3-70b',
              'llama-3.2-1b',
              'llama-3.2-3b',
              'llama-3.2-11b-vision',
              'llama-3.2-90b-vision'
            ],
            default: 'llama3.1-8b'
          },
          temperature: {
            required: false,
            type: 'number',
            min: 0,
            max: 1,
            default: 0.7
          },
          maxTokens: {
            required: false,
            type: 'number',
            min: 1,
            max: 128000,
            default: 2048
          },
          topP: {
            required: false,
            type: 'number',
            min: 0,
            max: 1,
            default: 0.9
          }
        }
      },

      fireworks: {
        name: 'Fireworks AI',
        requiredFields: ['apiKey'],
        optionalFields: ['model', 'temperature', 'maxTokens', 'baseUrl'],
        validations: {
          apiKey: {
            required: true,
            type: 'string',
            minLength: 32,
            message: 'Fireworks API key is required',
            suggestion: 'Get your API key from https://fireworks.ai/api-keys'
          },
          model: {
            required: false,
            enum: [
              'accounts/fireworks/models/llama-v3p1-405b-instruct',
              'accounts/fireworks/models/llama-v3p1-70b-instruct',
              'accounts/fireworks/models/llama-v3p1-8b-instruct',
              'accounts/fireworks/models/mixtral-8x7b-instruct',
              'accounts/fireworks/models/mixtral-8x22b-instruct'
            ],
            default: 'accounts/fireworks/models/llama-v3p1-70b-instruct'
          },
          temperature: {
            required: false,
            type: 'number',
            min: 0,
            max: 1,
            default: 0.7
          },
          maxTokens: {
            required: false,
            type: 'number',
            min: 1,
            max: 4096,
            default: 2048
          },
          baseUrl: {
            required: false,
            type: 'url',
            default: 'https://api.fireworks.ai/inference/v1'
          }
        }
      },

      'gemini-cli': {
        name: 'Gemini CLI',
        requiredFields: ['projectId'],
        optionalFields: ['model', 'temperature', 'maxTokens', 'oauthPath'],
        validations: {
          projectId: {
            required: true,
            pattern: /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/,
            message: 'Google Cloud Project ID must be 6-30 characters, start with letter, contain only lowercase letters, numbers, and hyphens',
            suggestion: 'Create a project at https://console.cloud.google.com/'
          },
          model: {
            required: false,
            enum: [
              'gemini-1.5-pro',
              'gemini-1.5-flash',
              'gemini-1.0-pro'
            ],
            default: 'gemini-1.5-pro'
          },
          temperature: {
            required: false,
            type: 'number',
            min: 0,
            max: 1,
            default: 0.7
          },
          maxTokens: {
            required: false,
            type: 'number',
            min: 1,
            max: 8192,
            default: 4096
          },
          oauthPath: {
            required: false,
            type: 'string',
            message: 'Path to OAuth credentials file'
          }
        }
      },

      groq: {
        name: 'Groq',
        requiredFields: ['apiKey'],
        optionalFields: ['model', 'temperature', 'maxTokens'],
        validations: {
          apiKey: {
            required: true,
            pattern: /^gsk_[a-zA-Z0-9]{52}$/,
            message: 'API key must start with "gsk_" and be exactly 56 characters long',
            suggestion: 'Get your API key from https://console.groq.com/keys'
          },
          model: {
            required: false,
            enum: [
              'mixtral-8x7b-32768',
              'llama2-70b-4096',
              'gemma-7b-it'
            ],
            default: 'mixtral-8x7b-32768'
          },
          temperature: {
            required: false,
            type: 'number',
            min: 0,
            max: 2,
            default: 0.7
          },
          maxTokens: {
            required: false,
            type: 'number',
            min: 1,
            max: 32768,
            default: 4096
          }
        }
      },

      xai: {
        name: 'xAI (Grok)',
        requiredFields: ['apiKey'],
        optionalFields: ['model', 'temperature', 'maxTokens'],
        validations: {
          apiKey: {
            required: true,
            pattern: /^xai-[a-zA-Z0-9_-]{40,}$/,
            message: 'API key must start with "xai-" and be at least 44 characters long',
            suggestion: 'Get your API key from https://console.x.ai/'
          },
          model: {
            required: false,
            enum: [
              'grok-beta',
              'grok-vision-beta'
            ],
            default: 'grok-beta'
          },
          temperature: {
            required: false,
            type: 'number',
            min: 0,
            max: 1,
            default: 0.7
          },
          maxTokens: {
            required: false,
            type: 'number',
            min: 1,
            max: 4096,
            default: 2048
          }
        }
      },

      huggingface: {
        name: 'Hugging Face',
        requiredFields: ['apiKey'],
        optionalFields: ['model', 'temperature', 'maxTokens', 'baseUrl'],
        validations: {
          apiKey: {
            required: true,
            pattern: /^hf_[a-zA-Z0-9]{37}$/,
            message: 'API key must start with "hf_" and be exactly 40 characters long',
            suggestion: 'Get your API key from https://huggingface.co/settings/tokens'
          },
          model: {
            required: false,
            enum: [
              'meta-llama/Llama-2-70b-chat-hf',
              'microsoft/DialoGPT-medium',
              'facebook/blenderbot-400M-distill'
            ],
            default: 'meta-llama/Llama-2-70b-chat-hf'
          },
          temperature: {
            required: false,
            type: 'number',
            min: 0,
            max: 1,
            default: 0.7
          },
          maxTokens: {
            required: false,
            type: 'number',
            min: 1,
            max: 4096,
            default: 2048
          },
          baseUrl: {
            required: false,
            type: 'url',
            default: 'https://api-inference.huggingface.co'
          }
        }
      },

      'virtual-quota-fallback': {
        name: 'Virtual Quota Fallback',
        requiredFields: ['profiles'],
        optionalFields: ['quotaLimit', 'fallbackStrategy'],
        validations: {
          profiles: {
            required: true,
            type: 'array',
            minLength: 1,
            message: 'At least one provider profile is required for fallback',
            suggestion: 'Configure primary and fallback provider profiles'
          },
          quotaLimit: {
            required: false,
            type: 'number',
            min: 1,
            default: 1000000
          },
          fallbackStrategy: {
            required: false,
            enum: ['round-robin', 'priority', 'random'],
            default: 'priority'
          }
        }
      }
    };
  }

  /**
   * Get supported provider IDs
   */
  getSupportedProviders() {
    return Object.keys(this.providerSchemas);
  }

  /**
   * Get validation schema for a specific provider
   */
  getProviderSchema(provider) {
    return this.providerSchemas[provider] || null;
  }

  /**
   * Validate a complete provider configuration
   */
  validateProviderConfig(provider, config) {
    const schema = this.getProviderSchema(provider);
    if (!schema) {
      return {
        isValid: false,
        errors: [{ field: 'provider', message: `Unsupported provider: ${provider}` }],
        warnings: []
      };
    }

    const errors = [];
    const warnings = [];

    // Validate required fields
    for (const field of schema.requiredFields) {
      if (!config[field] || (typeof config[field] === 'string' && config[field].trim() === '')) {
        errors.push({
          field,
          message: `${field} is required`,
          suggestion: schema.validations[field]?.suggestion
        });
      }
    }

    // Validate all provided fields
    for (const [field, value] of Object.entries(config)) {
      if (schema.validations[field]) {
        const validation = schema.validations[field];
        const fieldErrors = this.validateField(field, value, validation);
        errors.push(...fieldErrors.errors);
        warnings.push(...fieldErrors.warnings);
      }
    }

    // Provider-specific validations
    const providerSpecificResult = this.validateProviderSpecific(provider, config);
    errors.push(...providerSpecificResult.errors);
    warnings.push(...providerSpecificResult.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate a single field in real-time
   */
  validateFieldRealtime(provider, field, value) {
    const schema = this.getProviderSchema(provider);
    if (!schema || !schema.validations[field]) {
      return [];
    }

    const validation = schema.validations[field];
    const result = this.validateField(field, value, validation);
    return result.errors;
  }

  /**
   * Validate a single field against its validation rules
   */
  validateField(field, value, validation) {
    const errors = [];
    const warnings = [];

    // Required validation
    if (validation.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      errors.push({
        field,
        message: validation.message || `${field} is required`,
        suggestion: validation.suggestion
      });
      return { errors, warnings };
    }

    // Skip further validation if field is empty and not required
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return { errors, warnings };
    }

    // Type validation
    if (validation.type) {
      const typeError = this.validateType(field, value, validation.type);
      if (typeError) {
        errors.push(typeError);
        return { errors, warnings };
      }
    }

    // Pattern validation (regex)
    if (validation.pattern && typeof value === 'string') {
      if (!validation.pattern.test(value)) {
        errors.push({
          field,
          message: validation.message || `${field} format is invalid`,
          suggestion: validation.suggestion
        });
      }
    }

    // Enum validation
    if (validation.enum && !validation.enum.includes(value)) {
      errors.push({
        field,
        message: `${field} must be one of: ${validation.enum.join(', ')}`,
        suggestion: `Use one of the supported values: ${validation.enum.join(', ')}`
      });
    }

    // Length validation
    if (validation.minLength && typeof value === 'string' && value.length < validation.minLength) {
      errors.push({
        field,
        message: `${field} must be at least ${validation.minLength} characters long`
      });
    }

    if (validation.maxLength && typeof value === 'string' && value.length > validation.maxLength) {
      errors.push({
        field,
        message: `${field} must be no more than ${validation.maxLength} characters long`
      });
    }

    // Numeric range validation
    if (validation.min !== undefined && typeof value === 'number' && value < validation.min) {
      errors.push({
        field,
        message: `${field} must be at least ${validation.min}`
      });
    }

    if (validation.max !== undefined && typeof value === 'number' && value > validation.max) {
      errors.push({
        field,
        message: `${field} must be no more than ${validation.max}`
      });
    }

    // Array validation
    if (validation.type === 'array') {
      if (validation.minLength && value.length < validation.minLength) {
        errors.push({
          field,
          message: `${field} must contain at least ${validation.minLength} items`
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate field type
   */
  validateType(field, value, expectedType) {
    switch (expectedType) {
      case 'string':
        if (typeof value !== 'string') {
          return { field, message: `${field} must be a string` };
        }
        break;
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return { field, message: `${field} must be a valid number` };
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          return { field, message: `${field} must be a boolean` };
        }
        break;
      case 'array':
        if (!Array.isArray(value)) {
          return { field, message: `${field} must be an array` };
        }
        break;
      case 'url':
        if (typeof value !== 'string') {
          return { field, message: `${field} must be a string` };
        }
        try {
          new URL(value);
        } catch {
          return { field, message: `${field} must be a valid URL` };
        }
        break;
    }
    return null;
  }

  /**
   * Provider-specific validation logic
   */
  validateProviderSpecific(provider, config) {
    const errors = [];
    const warnings = [];

    switch (provider) {
      case 'virtual-quota-fallback':
        if (config.profiles && Array.isArray(config.profiles)) {
          // Validate each profile in the fallback configuration
          for (const profile of config.profiles) {
            if (!profile.provider || !profile.apiKey) {
              errors.push({
                field: 'profiles',
                message: 'Each fallback profile must have a provider and apiKey'
              });
            }
          }
        }
        break;

      case 'openai':
        // Warn about deprecated models
        if (config.model && ['gpt-3.5-turbo-0301', 'gpt-4-0314'].includes(config.model)) {
          warnings.push({
            field: 'model',
            message: 'This model version is deprecated and may be discontinued soon'
          });
        }
        break;

      case 'anthropic':
        // Check for common model naming mistakes
        if (config.model && config.model.includes('claude-2')) {
          warnings.push({
            field: 'model',
            message: 'Claude 2 models are legacy. Consider upgrading to Claude 3 models'
          });
        }
        break;

      case 'claude-code':
        // Additional validation for Claude CLI path
        if (config.claudeCodePath) {
          if (!config.claudeCodePath.includes('claude')) {
            warnings.push({
              field: 'claudeCodePath',
              message: 'The path should point to the Claude CLI executable'
            });
          }
        }
        break;
    }

    return { errors, warnings };
  }

  /**
   * Get validation summary for a provider configuration
   */
  getValidationSummary(provider, config) {
    const validation = this.validateProviderConfig(provider, config);
    const schema = this.getProviderSchema(provider);

    return {
      provider,
      providerName: schema?.name || provider,
      isValid: validation.isValid,
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length,
      missingRequiredFields: schema?.requiredFields.filter(field => 
        !config[field] || (typeof config[field] === 'string' && config[field].trim() === '')
      ) || [],
      configuredFields: Object.keys(config).filter(key => config[key] !== undefined && config[key] !== ''),
      completionPercentage: this.calculateCompletionPercentage(provider, config)
    };
  }

  /**
   * Calculate configuration completion percentage
   */
  calculateCompletionPercentage(provider, config) {
    const schema = this.getProviderSchema(provider);
    if (!schema) return 0;

    const allFields = [...schema.requiredFields, ...schema.optionalFields];
    const configuredFields = Object.keys(config).filter(key => 
      config[key] !== undefined && config[key] !== '' && allFields.includes(key)
    );

    return Math.round((configuredFields.length / allFields.length) * 100);
  }

  /**
   * Get field validation help text
   */
  getFieldValidationHelp(provider, field) {
    const schema = this.getProviderSchema(provider);
    if (!schema || !schema.validations[field]) {
      return null;
    }

    const validation = schema.validations[field];
    return {
      required: validation.required || false,
      type: validation.type,
      description: validation.message,
      suggestion: validation.suggestion,
      example: validation.example,
      pattern: validation.pattern?.source,
      enum: validation.enum,
      min: validation.min,
      max: validation.max,
      default: validation.default
    };
  }
}

module.exports = ProviderValidator;