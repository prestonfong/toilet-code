/**
 * Claude Code API Provider
 * Specialized provider for Claude with enhanced code understanding and tool capabilities
 * Web-compatible version of the original kilocode Claude Code provider
 * Uses native fetch API without external dependencies
 */

// Claude Code Model Definitions - Based on original kilocode implementation
const claudeCodeDefaultModelId = 'claude-sonnet-4-20250514';
const CLAUDE_CODE_DEFAULT_MAX_OUTPUT_TOKENS = 8000;

// Model definitions with pricing and capabilities from anthropic models
// but overridden for Claude Code specific behavior
const claudeCodeModels = {
    'claude-sonnet-4-20250514': {
        maxTokens: 64000, // Overridden to 8k if enableReasoningEffort is false
        contextWindow: 200000,
        supportsImages: false, // Claude Code doesn't support images
        supportsComputerUse: true,
        supportsPromptCache: true, // Claude Code does report cache tokens
        inputPrice: 3.0, // $3 per million input tokens
        outputPrice: 15.0, // $15 per million output tokens
        cacheWritesPrice: 3.75, // $3.75 per million tokens
        cacheReadsPrice: 0.3, // $0.30 per million tokens
        supportsReasoningBudget: false,
        supportsReasoningEffort: false,
        requiredReasoningBudget: false,
        name: 'Claude Sonnet 4',
        description: 'Most capable model for complex reasoning and code tasks'
    },
    'claude-opus-4-20250514': {
        maxTokens: 32000, // Overridden to 8k if enableReasoningEffort is false
        contextWindow: 200000,
        supportsImages: false, // Claude Code doesn't support images
        supportsComputerUse: true,
        supportsPromptCache: true, // Claude Code does report cache tokens
        inputPrice: 15.0, // $15 per million input tokens
        outputPrice: 75.0, // $75 per million output tokens
        cacheWritesPrice: 18.75, // $18.75 per million tokens
        cacheReadsPrice: 1.5, // $1.50 per million tokens
        supportsReasoningBudget: false,
        supportsReasoningEffort: false,
        requiredReasoningBudget: false,
        name: 'Claude Opus 4',
        description: 'Most powerful model for highly complex tasks'
    },
    'claude-3-7-sonnet-20250219': {
        maxTokens: 8192, // Since we already have a :thinking virtual model we aren't setting supportsReasoningBudget: true here
        contextWindow: 200000,
        supportsImages: false, // Claude Code doesn't support images
        supportsComputerUse: true,
        supportsPromptCache: true, // Claude Code does report cache tokens
        inputPrice: 3.0, // $3 per million input tokens
        outputPrice: 15.0, // $15 per million output tokens
        cacheWritesPrice: 3.75, // $3.75 per million tokens
        cacheReadsPrice: 0.3, // $0.30 per million tokens
        supportsReasoningBudget: false,
        supportsReasoningEffort: false,
        requiredReasoningBudget: false,
        name: 'Claude 3.7 Sonnet',
        description: 'Advanced model with enhanced reasoning capabilities'
    },
    'claude-3-5-sonnet-20241022': {
        maxTokens: 8192,
        contextWindow: 200000,
        supportsImages: false, // Claude Code doesn't support images
        supportsComputerUse: true,
        supportsPromptCache: true, // Claude Code does report cache tokens
        inputPrice: 3.0, // $3 per million input tokens
        outputPrice: 15.0, // $15 per million output tokens
        cacheWritesPrice: 3.75, // $3.75 per million tokens
        cacheReadsPrice: 0.3, // $0.30 per million tokens
        supportsReasoningBudget: false,
        supportsReasoningEffort: false,
        requiredReasoningBudget: false,
        name: 'Claude 3.5 Sonnet',
        description: 'Most capable model for complex reasoning and code tasks'
    },
    'claude-3-5-haiku-20241022': {
        maxTokens: 8192,
        contextWindow: 200000,
        supportsImages: false, // Claude Code doesn't support images
        supportsPromptCache: true, // Claude Code does report cache tokens
        inputPrice: 1.0,
        outputPrice: 5.0,
        cacheWritesPrice: 1.25,
        cacheReadsPrice: 0.1,
        supportsReasoningBudget: false,
        supportsReasoningEffort: false,
        requiredReasoningBudget: false,
        name: 'Claude 3.5 Haiku',
        description: 'Fast and efficient model for simpler tasks'
    }
};

class ClaudeCodeProvider {
    constructor(options = {}) {
        this.options = options;
        this.name = 'claude-code';
        this.displayName = 'Claude Code';
        this.baseURL = 'https://api.anthropic.com/v1';
        this.defaultModel = claudeCodeDefaultModelId;
        this.supportedModels = Object.keys(claudeCodeModels);
        this.supportsStreaming = true;
        this.supportsTools = true;
        this.supportsImages = false; // Claude Code doesn't support images
        
        // Validate model if provided
        if (options.model && !this.supportedModels.includes(options.model)) {
            console.warn(`Invalid Claude Code model: ${options.model}. Using default: ${this.defaultModel}`);
            this.options.model = this.defaultModel;
        }
    }

    /**
     * Validate Claude CLI path - Web version uses direct API calls
     * but maintains compatibility with CLI path configuration
     */
    validateClaudeCodePath() {
        // In web environment, claudeCodePath is optional since we use direct API calls
        // But if provided, validate it's not empty
        if (this.options.claudeCodePath !== undefined && this.options.claudeCodePath.trim() === '') {
            throw new Error('Claude Code CLI path cannot be empty if specified');
        }
        return true;
    }

    /**
     * Prepare headers for API requests
     */
    getHeaders(apiKey) {
        return {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-beta': 'tools-2024-04-04'
        };
    }

    /**
     * Transform messages to Claude format
     */
    transformMessages(messages) {
        const claudeMessages = [];
        let systemMessage = '';

        for (const message of messages) {
            if (message.role === 'system') {
                systemMessage += (systemMessage ? '\n\n' : '') + message.content;
            } else {
                claudeMessages.push({
                    role: message.role,
                    content: this.transformContent(message.content)
                });
            }
        }

        return { systemMessage, messages: claudeMessages };
    }

    /**
     * Transform content to handle different types (text, images, etc.)
     */
    transformContent(content) {
        if (typeof content === 'string') {
            return content;
        }

        if (Array.isArray(content)) {
            return content.map(item => {
                if (item.type === 'text') {
                    return { type: 'text', text: item.text };
                } else if (item.type === 'image_url') {
                    // Transform image format for Claude
                    const imageData = item.image_url.url;
                    const [header, base64] = imageData.split(',');
                    const mediaType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
                    
                    return {
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: mediaType,
                            data: base64
                        }
                    };
                }
                return item;
            });
        }

        return content;
    }

    /**
     * Transform tools to Claude format
     */
    transformTools(tools) {
        if (!tools || !Array.isArray(tools)) {
            return undefined;
        }

        return tools.map(tool => ({
            name: tool.function?.name || tool.name,
            description: tool.function?.description || tool.description,
            input_schema: tool.function?.parameters || tool.input_schema || tool.parameters
        }));
    }

    /**
     * Create the request payload for Claude API
     */
    createRequestPayload(options) {
        const { systemMessage, messages } = this.transformMessages(options.messages);
        
        const payload = {
            model: options.model || this.defaultModel,
            messages: messages,
            max_tokens: options.max_tokens || options.maxTokens || CLAUDE_CODE_DEFAULT_MAX_OUTPUT_TOKENS,
            stream: options.stream || false
        };

        if (systemMessage) {
            payload.system = systemMessage;
        }

        if (options.temperature !== undefined) {
            payload.temperature = Math.max(0, Math.min(1, options.temperature));
        }

        if (options.tools) {
            payload.tools = this.transformTools(options.tools);
        }

        if (options.stop) {
            payload.stop_sequences = Array.isArray(options.stop) ? options.stop : [options.stop];
        }

        return payload;
    }

    /**
     * Get basic model information
     */
    getModel() {
        const modelId = this.options.model || this.defaultModel;
        return {
            id: modelId,
            maxTokens: this.options.maxTokens || CLAUDE_CODE_DEFAULT_MAX_OUTPUT_TOKENS,
            temperature: this.options.temperature || 0.7
        };
    }

    /**
     * Get supported models (backward compatibility)
     */
    getSupportedModels() {
        return this.supportedModels;
    }

    /**
     * Get default model ID (backward compatibility)
     */
    getDefaultModelId() {
        return this.defaultModel;
    }

    /**
     * Update settings (backward compatibility)
     */
    updateSettings(settings) {
        if (settings) {
            Object.assign(this.options, settings);
            
            // Validate model if changed
            if (settings.model && !this.supportedModels.includes(settings.model)) {
                console.warn(`Invalid Claude Code model: ${settings.model}. Using default: ${this.defaultModel}`);
                this.options.model = this.defaultModel;
            }
        }
    }

    /**
     * Chat method (backward compatibility)
     */
    async chat(options) {
        return await this.complete(options);
    }

    /**
     * Get available models for Claude Code provider
     */
    getAvailableModels() {
        // Return array of model IDs as expected by ProviderSettingsManager
        return Object.keys(claudeCodeModels);
    }

    /**
     * Get default model information
     */
    getDefaultModel() {
        return {
            id: claudeCodeDefaultModelId,
            ...claudeCodeModels[claudeCodeDefaultModelId]
        };
    }

    /**
     * Complete a single prompt (non-streaming)
     */
    async complete(options) {
        const { messages, systemPrompt, tools = [], apiKey } = options;
        
        if (!apiKey) {
            throw new Error('API key is required for Claude Code provider');
        }
        
        this.validateClaudeCodePath();

        const allMessages = systemPrompt ?
            [{ role: 'system', content: systemPrompt }, ...messages] :
            messages;

        const payload = this.createRequestPayload({
            ...options,
            messages: allMessages,
            tools,
            stream: false
        });

        const headers = this.getHeaders(apiKey);

        try {
            const response = await fetch(`${this.baseURL}/messages`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                let errorMessage = error.error?.message || `HTTP ${response.status}: ${response.statusText}`;
                
                // Enhanced error handling similar to original implementation
                if (errorMessage.includes('Invalid model name')) {
                    errorMessage += '\n\nNote: This may indicate an API key/model plan mismatch. Please verify your Claude Code configuration.';
                }
                
                throw new Error(errorMessage);
            }

            const data = await response.json();
            
            // Extract content and tool calls with enhanced handling
            let content = '';
            let toolCalls = [];
            let reasoning = '';

            if (data.content && data.content.length > 0) {
                for (const block of data.content) {
                    if (block.type === 'text') {
                        content += block.text;
                    } else if (block.type === 'thinking') {
                        reasoning += block.thinking || '';
                    } else if (block.type === 'tool_use') {
                        toolCalls.push({
                            name: block.name,
                            parameters: block.input,
                            id: block.id
                        });
                    }
                }
            }

            // Enhanced usage tracking similar to original
            const usage = {
                inputTokens: data.usage?.input_tokens || 0,
                outputTokens: data.usage?.output_tokens || 0,
                cacheReadTokens: data.usage?.cache_read_input_tokens || 0,
                cacheWriteTokens: data.usage?.cache_creation_input_tokens || 0
            };

            const result = {
                content,
                toolCalls,
                usage,
                model: data.model,
                stop_reason: data.stop_reason
            };

            // Include reasoning if present
            if (reasoning) {
                result.reasoning = reasoning;
            }

            return result;
        } catch (error) {
            console.error('Claude Code API error:', error);
            throw new Error(`Claude Code API error: ${error.message}`);
        }
    }

    /**
     * Stream a completion
     */
    async *stream(options) {
        const { messages, systemPrompt, tools = [], apiKey } = options;
        
        if (!apiKey) {
            throw new Error('API key is required for Claude Code provider');
        }
        
        this.validateClaudeCodePath();

        const allMessages = systemPrompt ?
            [{ role: 'system', content: systemPrompt }, ...messages] :
            messages;

        const payload = this.createRequestPayload({
            ...options,
            messages: allMessages,
            tools,
            stream: true
        });

        const headers = this.getHeaders(apiKey);

        try {
            const response = await fetch(`${this.baseURL}/messages`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                let errorMessage = error.error?.message || `HTTP ${response.status}: ${response.statusText}`;
                
                // Enhanced error handling similar to original implementation
                if (errorMessage.includes('Invalid model name')) {
                    errorMessage += '\n\nNote: This may indicate an API key/model plan mismatch. Please verify your Claude Code configuration.';
                }
                
                throw new Error(errorMessage);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            return;
                        }

                        try {
                            const parsed = JSON.parse(data);
                            
                            if (parsed.type === 'content_block_start') {
                                const block = parsed.content_block;
                                if (block.type === 'text') {
                                    yield {
                                        type: 'text',
                                        text: block.text || ''
                                    };
                                } else if (block.type === 'thinking') {
                                    yield {
                                        type: 'reasoning',
                                        text: block.thinking || ''
                                    };
                                }
                            } else if (parsed.type === 'content_block_delta') {
                                const delta = parsed.delta;
                                if (delta.type === 'text_delta') {
                                    yield {
                                        type: 'text',
                                        text: delta.text
                                    };
                                } else if (delta.type === 'input_json_delta') {
                                    // Handle tool use deltas
                                    yield {
                                        type: 'text',
                                        text: delta.partial_json || ''
                                    };
                                }
                            } else if (parsed.type === 'message_start') {
                                // Enhanced usage tracking similar to original
                                yield {
                                    type: 'usage',
                                    inputTokens: parsed.message.usage.input_tokens || 0,
                                    outputTokens: parsed.message.usage.output_tokens || 0,
                                    cacheReadTokens: parsed.message.usage.cache_read_input_tokens || 0,
                                    cacheWriteTokens: parsed.message.usage.cache_creation_input_tokens || 0
                                };
                            } else if (parsed.type === 'message_delta') {
                                // Handle final usage updates
                                if (parsed.delta?.usage) {
                                    yield {
                                        type: 'usage',
                                        inputTokens: parsed.delta.usage.input_tokens || 0,
                                        outputTokens: parsed.delta.usage.output_tokens || 0
                                    };
                                }
                            } else if (parsed.type === 'message_stop') {
                                return;
                            }
                        } catch (parseError) {
                            console.warn('Failed to parse SSE data:', parseError);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Claude Code streaming error:', error);
            throw new Error(`Claude Code streaming error: ${error.message}`);
        }
    }

    /**
     * Convert generic messages to Claude format
     */
    convertMessages(messages) {
        return messages.map(msg => ({
            role: msg.role,
            content: this.transformContent(msg.content)
        }));
    }

    /**
     * Convert tools to Claude format
     */
    convertTools(tools) {
        return this.transformTools(tools);
    }

    /**
     * Get detailed model information
     */
    getModelInfo(modelId) {
        // Use the new comprehensive model definitions
        const modelInfo = claudeCodeModels[modelId];
        
        if (!modelInfo) {
            // Fallback for unknown models
            return {
                name: modelId,
                contextWindow: 200000,
                description: 'Claude model',
                maxTokens: CLAUDE_CODE_DEFAULT_MAX_OUTPUT_TOKENS,
                supportsImages: false,
                supportsPromptCache: true
            };
        }

        return {
            id: modelId,
            name: modelInfo.name,
            description: modelInfo.description,
            maxTokens: modelInfo.maxTokens,
            contextWindow: modelInfo.contextWindow,
            supportsImages: modelInfo.supportsImages,
            supportsComputerUse: modelInfo.supportsComputerUse,
            supportsPromptCache: modelInfo.supportsPromptCache,
            inputPrice: modelInfo.inputPrice,
            outputPrice: modelInfo.outputPrice,
            cacheWritesPrice: modelInfo.cacheWritesPrice,
            cacheReadsPrice: modelInfo.cacheReadsPrice,
            supportsReasoningBudget: modelInfo.supportsReasoningBudget,
            supportsReasoningEffort: modelInfo.supportsReasoningEffort,
            requiredReasoningBudget: modelInfo.requiredReasoningBudget
        };
    }

    /**
     * Test the API connection
     */
    async test(apiKey) {
        try {
            await this.complete({
                messages: [{ role: 'user', content: 'Hello' }],
                model: this.defaultModel,
                max_tokens: 10,
                apiKey
            });
            return { success: true, message: 'Claude Code API connection successful' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Validate provider settings
     */
    validateSettings(settings) {
        const errors = [];
        
        // API key is optional for basic configuration
        if (settings.apiKey && typeof settings.apiKey !== 'string') {
            errors.push('API key must be a string');
        }
        
        // Clear empty API key
        if (settings.apiKey === '') {
            settings.apiKey = undefined;
        }
        
        // Validate model if provided
        if (settings.model && !claudeCodeModels[settings.model]) {
            errors.push(`Invalid model: ${settings.model}. Available models: ${Object.keys(claudeCodeModels).join(', ')}`);
        }
        
        // Validate other settings
        if (settings.temperature !== undefined) {
            if (typeof settings.temperature !== 'number' || settings.temperature < 0 || settings.temperature > 1) {
                errors.push('Temperature must be a number between 0 and 1');
            }
        }
        
        if (settings.maxTokens !== undefined) {
            if (typeof settings.maxTokens !== 'number' || settings.maxTokens <= 0) {
                errors.push('Max tokens must be a positive number');
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Get autofill suggestions for provider settings
     */
    getAutofillSuggestions(partialSettings = {}) {
        try {
            const suggestions = {
                models: Object.keys(claudeCodeModels),
                defaultModel: claudeCodeDefaultModelId,
                modelDetails: claudeCodeModels
            };
            
            // Add model-specific suggestions
            if (partialSettings.model && claudeCodeModels[partialSettings.model]) {
                const modelInfo = this.getModelInfo(partialSettings.model);
                suggestions.selectedModelInfo = modelInfo;
                suggestions.recommendedMaxTokens = modelInfo.maxTokens;
            }
            
            // Default suggestions
            suggestions.defaultSettings = {
                model: claudeCodeDefaultModelId,
                temperature: 0.7,
                maxTokens: CLAUDE_CODE_DEFAULT_MAX_OUTPUT_TOKENS
            };
            
            return suggestions;
        } catch (error) {
            console.error('Error generating autofill suggestions for Claude Code:', error);
            return {
                models: Object.keys(claudeCodeModels),
                defaultModel: claudeCodeDefaultModelId,
                error: error.message
            };
        }
    }

    /**
     * Count tokens (simplified implementation)
     */
    async countTokens(content) {
        // Rough approximation: 1 token ≈ 4 characters
        const text = typeof content === 'string' ? content : JSON.stringify(content);
        return Math.ceil(text.length / 4);
    }
}

module.exports = ClaudeCodeProvider;
module.exports.claudeCodeDefaultModelId = claudeCodeDefaultModelId;
module.exports.CLAUDE_CODE_DEFAULT_MAX_OUTPUT_TOKENS = CLAUDE_CODE_DEFAULT_MAX_OUTPUT_TOKENS;
module.exports.claudeCodeModels = claudeCodeModels;