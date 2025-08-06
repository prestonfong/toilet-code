/**
 * Provider Autofill
 * Intelligent autofill system for provider configurations
 * Provides smart defaults, model suggestions, and field completions
 */

class ProviderAutofill {
  constructor() {
    this.providerDefaults = this.initializeProviderDefaults();
    this.modelSuggestions = this.initializeModelSuggestions();
    this.fieldCompletions = this.initializeFieldCompletions();
  }

  /**
   * Initialize default configurations for all providers
   */
  initializeProviderDefaults() {
    return {
      anthropic: {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.7,
        maxTokens: 4096,
        baseUrl: 'https://api.anthropic.com'
      },

      openai: {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 4096,
        baseUrl: 'https://api.openai.com/v1'
      },

      'claude-code': {
        provider: 'claude-code',
        model: 'claude-sonnet-4-20250514',
        temperature: 0.7,
        claudeCodeMaxOutputTokens: 8000,
        claudeCodePath: this.getDefaultClaudeCodePath()
      },

      cerebras: {
        provider: 'cerebras',
        model: 'llama3.1-8b',
        temperature: 0.7,
        maxTokens: 2048,
        topP: 0.9
      },

      fireworks: {
        provider: 'fireworks',
        model: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
        temperature: 0.7,
        maxTokens: 2048,
        baseUrl: 'https://api.fireworks.ai/inference/v1'
      },

      'gemini-cli': {
        provider: 'gemini-cli',
        model: 'gemini-1.5-pro',
        temperature: 0.7,
        maxTokens: 4096
      },

      groq: {
        provider: 'groq',
        model: 'mixtral-8x7b-32768',
        temperature: 0.7,
        maxTokens: 4096
      },

      xai: {
        provider: 'xai',
        model: 'grok-beta',
        temperature: 0.7,
        maxTokens: 2048
      },

      huggingface: {
        provider: 'huggingface',
        model: 'meta-llama/Llama-2-70b-chat-hf',
        temperature: 0.7,
        maxTokens: 2048,
        baseUrl: 'https://api-inference.huggingface.co'
      },

      'virtual-quota-fallback': {
        provider: 'virtual-quota-fallback',
        quotaLimit: 1000000,
        fallbackStrategy: 'priority',
        profiles: []
      }
    };
  }

  /**
   * Initialize model suggestions by use case
   */
  initializeModelSuggestions() {
    return {
      anthropic: {
        general: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
        coding: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'],
        analysis: ['claude-3-opus-20240229', 'claude-3-5-sonnet-20241022'],
        creative: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229'],
        fast: ['claude-3-5-haiku-20241022', 'claude-3-haiku-20240307']
      },

      openai: {
        general: ['gpt-4o', 'gpt-4-turbo'],
        coding: ['gpt-4o', 'gpt-4'],
        analysis: ['gpt-4o', 'gpt-4-turbo'],
        creative: ['gpt-4o', 'gpt-4'],
        fast: ['gpt-4o-mini', 'gpt-3.5-turbo']
      },

      'claude-code': {
        general: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
        coding: ['claude-sonnet-4-20250514', 'claude-opus-4-20241223', 'claude-3-7-sonnet-20241030'],
        analysis: ['claude-opus-4-20241223', 'claude-sonnet-4-20250514', 'claude-3-7-sonnet-20241030'],
        creative: ['claude-opus-4-20241223', 'claude-3-7-sonnet-20241030'],
        fast: ['claude-3-5-haiku-20241022']
      },

      cerebras: {
        general: ['llama3.1-70b', 'llama3.1-8b'],
        coding: ['llama3.1-70b', 'llama3.1-405b'],
        analysis: ['llama3.1-405b', 'llama3.1-70b'],
        creative: ['llama3.1-70b', 'llama-3.3-70b'],
        fast: ['llama3.1-8b', 'llama-3.2-3b'],
        vision: ['llama-3.2-11b-vision', 'llama-3.2-90b-vision']
      },

      fireworks: {
        general: ['accounts/fireworks/models/llama-v3p1-70b-instruct', 'accounts/fireworks/models/llama-v3p1-8b-instruct'],
        coding: ['accounts/fireworks/models/llama-v3p1-405b-instruct', 'accounts/fireworks/models/llama-v3p1-70b-instruct'],
        analysis: ['accounts/fireworks/models/llama-v3p1-405b-instruct', 'accounts/fireworks/models/mixtral-8x22b-instruct'],
        creative: ['accounts/fireworks/models/llama-v3p1-70b-instruct', 'accounts/fireworks/models/mixtral-8x7b-instruct'],
        fast: ['accounts/fireworks/models/llama-v3p1-8b-instruct']
      },

      'gemini-cli': {
        general: ['gemini-1.5-pro', 'gemini-1.5-flash'],
        coding: ['gemini-1.5-pro', 'gemini-1.0-pro'],
        analysis: ['gemini-1.5-pro'],
        creative: ['gemini-1.5-pro', 'gemini-1.0-pro'],
        fast: ['gemini-1.5-flash']
      },

      groq: {
        general: ['mixtral-8x7b-32768', 'llama2-70b-4096'],
        coding: ['mixtral-8x7b-32768', 'llama2-70b-4096'],
        analysis: ['mixtral-8x7b-32768'],
        creative: ['mixtral-8x7b-32768', 'llama2-70b-4096'],
        fast: ['gemma-7b-it']
      },

      xai: {
        general: ['grok-beta'],
        coding: ['grok-beta'],
        analysis: ['grok-beta'],
        creative: ['grok-beta'],
        fast: ['grok-beta'],
        vision: ['grok-vision-beta']
      },

      huggingface: {
        general: ['meta-llama/Llama-2-70b-chat-hf', 'microsoft/DialoGPT-medium'],
        coding: ['meta-llama/Llama-2-70b-chat-hf'],
        analysis: ['meta-llama/Llama-2-70b-chat-hf'],
        creative: ['meta-llama/Llama-2-70b-chat-hf', 'facebook/blenderbot-400M-distill'],
        fast: ['microsoft/DialoGPT-medium', 'facebook/blenderbot-400M-distill']
      }
    };
  }

  /**
   * Initialize field completion data
   */
  initializeFieldCompletions() {
    return {
      baseUrl: {
        anthropic: ['https://api.anthropic.com'],
        openai: ['https://api.openai.com/v1', 'https://api.openai.com'],
        fireworks: ['https://api.fireworks.ai/inference/v1'],
        huggingface: ['https://api-inference.huggingface.co', 'https://huggingface.co/api']
      },
      temperature: {
        common: [0.1, 0.3, 0.5, 0.7, 0.9, 1.0],
        creative: [0.8, 0.9, 1.0, 1.2],
        precise: [0.1, 0.2, 0.3],
        balanced: [0.5, 0.7, 0.8]
      },
      maxTokens: {
        common: [1024, 2048, 4096, 8192],
        short: [256, 512, 1024],
        long: [4096, 8192, 16384, 32768]
      }
    };
  }

  /**
   * Get default Claude Code path based on OS
   */
  getDefaultClaudeCodePath() {
    if (typeof process !== 'undefined' && process.platform) {
      switch (process.platform) {
        case 'win32':
          return 'C:\\Program Files\\Claude\\claude.exe';
        case 'darwin':
          return '/usr/local/bin/claude';
        case 'linux':
          return '/usr/local/bin/claude';
        default:
          return 'claude';
      }
    }
    // Fallback for browser environment
    return 'claude';
  }

  /**
   * Get autofilled configuration for a provider
   */
  getAutofillConfig(provider, existingConfig = {}) {
    const defaults = this.providerDefaults[provider];
    if (!defaults) {
      return existingConfig;
    }

    // Merge defaults with existing config, preserving user-provided values
    const autofilledConfig = { ...defaults };
    
    // Only override empty or undefined values
    for (const [key, value] of Object.entries(existingConfig)) {
      if (value !== undefined && value !== null && value !== '') {
        autofilledConfig[key] = value;
      }
    }

    // Provider-specific autofill logic
    return this.applyProviderSpecificAutofill(provider, autofilledConfig, existingConfig);
  }

  /**
   * Apply provider-specific autofill logic
   */
  applyProviderSpecificAutofill(provider, config, existingConfig) {
    switch (provider) {
      case 'claude-code':
        // Auto-detect Claude CLI path if not provided
        if (!existingConfig.claudeCodePath) {
          config.claudeCodePath = this.getDefaultClaudeCodePath();
        }
        break;

      case 'openai':
        // Adjust maxTokens based on model
        if (config.model && config.model.includes('gpt-4')) {
          config.maxTokens = config.maxTokens || 8192;
        } else if (config.model && config.model.includes('gpt-3.5')) {
          config.maxTokens = config.maxTokens || 4096;
        }
        break;

      case 'cerebras':
        // Adjust maxTokens based on model capabilities
        if (config.model && config.model.includes('405b')) {
          config.maxTokens = Math.min(config.maxTokens || 8192, 128000);
        } else if (config.model && config.model.includes('70b')) {
          config.maxTokens = Math.min(config.maxTokens || 4096, 128000);
        }
        break;

      case 'groq':
        // Adjust maxTokens based on model context length
        if (config.model && config.model.includes('32768')) {
          config.maxTokens = Math.min(config.maxTokens || 4096, 32768);
        } else if (config.model && config.model.includes('4096')) {
          config.maxTokens = Math.min(config.maxTokens || 2048, 4096);
        }
        break;

      case 'virtual-quota-fallback':
        // Initialize with empty profiles array if not provided
        if (!config.profiles || !Array.isArray(config.profiles)) {
          config.profiles = [];
        }
        break;
    }

    return config;
  }

  /**
   * Get recommended settings for a specific use case
   */
  getRecommendedSettings(provider, useCase = 'general') {
    const recommendations = {
      general: {
        temperature: 0.7,
        description: 'Balanced settings for general-purpose tasks'
      },
      coding: {
        temperature: 0.3,
        description: 'Lower temperature for more precise code generation'
      },
      creative: {
        temperature: 0.9,
        description: 'Higher temperature for creative and varied outputs'
      },
      analysis: {
        temperature: 0.1,
        description: 'Very low temperature for analytical and factual tasks'
      },
      fast: {
        temperature: 0.7,
        maxTokens: 1024,
        description: 'Optimized for speed with smaller token limits'
      }
    };

    const baseRecommendation = recommendations[useCase] || recommendations.general;
    
    // Provider-specific adjustments
    const providerAdjustments = this.getProviderSpecificRecommendations(provider, useCase);
    
    return {
      ...baseRecommendation,
      ...providerAdjustments,
      useCase
    };
  }

  /**
   * Get provider-specific recommendations
   */
  getProviderSpecificRecommendations(provider, useCase) {
    const adjustments = {};

    switch (provider) {
      case 'anthropic':
        if (useCase === 'coding') {
          adjustments.model = 'claude-3-5-sonnet-20241022';
          adjustments.maxTokens = 4096;
        } else if (useCase === 'analysis') {
          adjustments.model = 'claude-3-opus-20240229';
          adjustments.maxTokens = 4096;
        }
        break;

      case 'openai':
        if (useCase === 'coding') {
          adjustments.model = 'gpt-4o';
          adjustments.maxTokens = 4096;
        } else if (useCase === 'fast') {
          adjustments.model = 'gpt-4o-mini';
          adjustments.maxTokens = 2048;
        }
        break;

      case 'cerebras':
        if (useCase === 'fast') {
          adjustments.model = 'llama3.1-8b';
          adjustments.maxTokens = 2048;
        } else if (useCase === 'analysis') {
          adjustments.model = 'llama3.1-405b';
          adjustments.maxTokens = 4096;
        }
        break;
    }

    return adjustments;
  }

  /**
   * Get model suggestions for a provider and use case
   */
  getModelSuggestions(provider, useCase = 'general') {
    const suggestions = this.modelSuggestions[provider];
    if (!suggestions) {
      return [];
    }

    return suggestions[useCase] || suggestions.general || [];
  }

  /**
   * Get field completions based on context
   */
  getFieldCompletions(provider, field, currentValue = '', context = {}) {
    const completions = [];

    // Get provider-specific completions
    if (this.fieldCompletions[field] && this.fieldCompletions[field][provider]) {
      completions.push(...this.fieldCompletions[field][provider]);
    }

    // Get common completions
    if (this.fieldCompletions[field] && this.fieldCompletions[field].common) {
      completions.push(...this.fieldCompletions[field].common);
    }

    // Context-based completions
    if (field === 'temperature') {
      if (context.useCase === 'creative') {
        completions.push(...(this.fieldCompletions.temperature.creative || []));
      } else if (context.useCase === 'analysis') {
        completions.push(...(this.fieldCompletions.temperature.precise || []));
      } else {
        completions.push(...(this.fieldCompletions.temperature.balanced || []));
      }
    }

    if (field === 'maxTokens') {
      if (context.useCase === 'fast') {
        completions.push(...(this.fieldCompletions.maxTokens.short || []));
      } else if (context.useCase === 'analysis') {
        completions.push(...(this.fieldCompletions.maxTokens.long || []));
      } else {
        completions.push(...(this.fieldCompletions.maxTokens.common || []));
      }
    }

    // Filter based on current value if provided
    if (currentValue) {
      return completions.filter(completion => 
        completion.toString().toLowerCase().includes(currentValue.toLowerCase())
      );
    }

    // Remove duplicates and sort
    return [...new Set(completions)].sort();
  }

  /**
   * Get smart field suggestions based on other field values
   */
  getSmartFieldSuggestions(provider, field, currentConfig = {}) {
    const suggestions = [];

    switch (field) {
      case 'model':
        // Suggest models based on other configured parameters
        if (currentConfig.maxTokens > 8192) {
          // Suggest models that support larger context windows
          const longContextSuggestions = this.getModelSuggestions(provider, 'analysis');
          suggestions.push(...longContextSuggestions);
        } else if (currentConfig.temperature < 0.3) {
          // Suggest models good for precise tasks
          const preciseSuggestions = this.getModelSuggestions(provider, 'coding');
          suggestions.push(...preciseSuggestions);
        } else {
          suggestions.push(...this.getModelSuggestions(provider, 'general'));
        }
        break;

      case 'maxTokens':
        // Suggest token limits based on model capabilities
        if (currentConfig.model) {
          if (provider === 'groq' && currentConfig.model.includes('32768')) {
            suggestions.push(4096, 8192, 16384, 32768);
          } else if (provider === 'cerebras') {
            suggestions.push(2048, 4096, 8192, 16384);
          } else if (provider === 'anthropic' || provider === 'openai') {
            suggestions.push(1024, 2048, 4096, 8192);
          }
        }
        break;

      case 'temperature':
        // Suggest temperature based on use case indicators
        if (currentConfig.model && currentConfig.model.includes('code')) {
          suggestions.push(0.1, 0.2, 0.3);
        } else {
          suggestions.push(0.3, 0.5, 0.7, 0.9);
        }
        break;
    }

    return [...new Set(suggestions)];
  }

  /**
   * Get field help information
   */
  getFieldHelp(provider, field) {
    const helpTexts = {
      apiKey: {
        anthropic: {
          description: 'Your Anthropic API key from the console',
          format: 'sk-ant-[95+ characters]',
          link: 'https://console.anthropic.com/'
        },
        openai: {
          description: 'Your OpenAI API key from the platform',
          format: 'sk-[48+ characters]',
          link: 'https://platform.openai.com/api-keys'
        },
        cerebras: {
          description: 'Your Cerebras API key from the cloud console',
          format: 'Free-form string (32+ characters)',
          link: 'https://cloud.cerebras.ai/'
        },
        groq: {
          description: 'Your Groq API key from the console',
          format: 'gsk_[52 characters]',
          link: 'https://console.groq.com/keys'
        },
        xai: {
          description: 'Your xAI API key from the console',
          format: 'xai-[40+ characters]',
          link: 'https://console.x.ai/'
        },
        huggingface: {
          description: 'Your Hugging Face API token',
          format: 'hf_[37 characters]',
          link: 'https://huggingface.co/settings/tokens'
        }
      },
      model: {
        general: {
          description: 'The AI model to use for completions',
          tip: 'Choose based on your use case: larger models for complex tasks, smaller for speed'
        }
      },
      temperature: {
        general: {
          description: 'Controls randomness in model outputs (0.0 = deterministic, 1.0 = very random)',
          recommendations: {
            'Coding & Analysis': '0.1 - 0.3',
            'General Use': '0.7 - 0.8',
            'Creative Writing': '0.8 - 1.0'
          }
        }
      },
      maxTokens: {
        general: {
          description: 'Maximum number of tokens the model can generate in a single response',
          tip: 'Higher values allow longer responses but cost more and take longer'
        }
      }
    };

    // Get provider-specific help
    if (helpTexts[field] && helpTexts[field][provider]) {
      return helpTexts[field][provider];
    }

    // Get general help
    if (helpTexts[field] && helpTexts[field].general) {
      return helpTexts[field].general;
    }

    return null;
  }

  /**
   * Auto-populate form based on detected context
   */
  autoPopulateFromContext(provider, context = {}) {
    const config = this.getAutofillConfig(provider);

    // Detect use case from context
    if (context.taskType) {
      const useCase = this.detectUseCaseFromTaskType(context.taskType);
      const recommendations = this.getRecommendedSettings(provider, useCase);
      
      // Apply recommendations
      if (recommendations.model) config.model = recommendations.model;
      if (recommendations.temperature !== undefined) config.temperature = recommendations.temperature;
      if (recommendations.maxTokens) config.maxTokens = recommendations.maxTokens;
    }

    // Apply workspace-specific settings
    if (context.workspace) {
      config.workspaceId = context.workspace.id;
    }

    return config;
  }

  /**
   * Detect use case from task type
   */
  detectUseCaseFromTaskType(taskType) {
    const useCaseMap = {
      'code-generation': 'coding',
      'code-review': 'coding',
      'debugging': 'coding',
      'data-analysis': 'analysis',
      'research': 'analysis',
      'creative-writing': 'creative',
      'storytelling': 'creative',
      'chat': 'general',
      'qa': 'general'
    };

    return useCaseMap[taskType] || 'general';
  }

  /**
   * Validate autofill suggestions against provider constraints
   */
  validateAutofillSuggestions(provider, suggestions) {
    // This would integrate with ProviderValidator if available
    // For now, return basic validation
    return {
      valid: suggestions,
      invalid: [],
      warnings: []
    };
  }

  /**
   * Get progressive disclosure recommendations
   * Shows most important fields first, advanced fields later
   */
  getFieldPriority(provider) {
    const priorities = {
      high: ['provider', 'apiKey', 'model'],
      medium: ['temperature', 'maxTokens'],
      low: ['baseUrl', 'topP', 'orgId'],
      advanced: ['claudeCodePath', 'claudeCodeMaxOutputTokens', 'oauthPath', 'profiles']
    };

    // Provider-specific adjustments
    switch (provider) {
      case 'claude-code':
        priorities.high.push('claudeCodePath');
        break;
      case 'gemini-cli':
        priorities.high.push('projectId');
        break;
      case 'virtual-quota-fallback':
        priorities.high.push('profiles');
        break;
    }

    return priorities;
  }
}

module.exports = ProviderAutofill;