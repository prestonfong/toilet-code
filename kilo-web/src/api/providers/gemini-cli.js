/**
 * Gemini CLI Provider
 * Web-compatible provider for Google Gemini via gcloud CLI
 * Note: This provider requires gcloud CLI to be installed and authenticated
 */

class GeminiCliProvider {
    constructor(options = {}) {
        this.options = options;
        this.name = 'gemini-cli';
        this.displayName = 'Gemini CLI';
        this.defaultModel = 'gemini-1.5-pro';
        this.supportedModels = [
            'gemini-1.5-pro',
            'gemini-1.5-flash',
            'gemini-1.0-pro',
            'gemini-1.0-pro-vision',
            'gemini-pro',
            'gemini-pro-vision'
        ];
        this.supportsStreaming = false; // CLI doesn't support streaming in web context
        this.supportsTools = false;
    }

    /**
     * Validate the configuration
     */
    validateConfig() {
        if (!this.options.projectId) {
            throw new Error('Google Cloud Project ID is required for Gemini CLI');
        }
        return true;
    }

    /**
     * Get basic model information
     */
    getModel() {
        const modelId = this.options.model || this.defaultModel;
        return {
            id: modelId,
            maxTokens: this.options.maxTokens || 8192,
            temperature: this.options.temperature || 0.7
        };
    }

    /**
     * Complete a single prompt using gcloud CLI
     * Note: In a browser environment, this would need to be proxied through the backend
     */
    async complete(options) {
        const { messages, systemPrompt } = options;
        
        this.validateConfig();

        // In a web environment, we need to make an API call to our backend
        // which will execute the gcloud command
        const payload = {
            messages: this.transformMessages(messages, systemPrompt),
            model: options.model || this.options.model || this.defaultModel,
            projectId: this.options.projectId,
            region: this.options.region || 'us-central1',
            maxTokens: options.max_tokens || options.maxTokens || this.options.maxTokens || 8192,
            temperature: options.temperature ?? this.options.temperature ?? 0.7,
            topP: options.top_p ?? this.options.topP,
            topK: options.top_k ?? this.options.topK
        };

        try {
            const response = await fetch('/api/providers/gemini-cli/complete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            return {
                content: data.content || '',
                toolCalls: [],
                usage: {
                    inputTokens: data.usage?.inputTokens || 0,
                    outputTokens: data.usage?.outputTokens || 0
                },
                model: data.model || payload.model,
                stop_reason: data.finishReason || 'stop'
            };
        } catch (error) {
            console.error('Gemini CLI error:', error);
            throw new Error(`Gemini CLI error: ${error.message}`);
        }
    }

    /**
     * Stream a completion (not supported in web environment)
     */
    async *stream(options) {
        // For now, fall back to complete and yield the full response
        const result = await this.complete(options);
        yield {
            type: 'text',
            content: result.content
        };
        
        if (result.usage) {
            yield {
                type: 'usage',
                usage: result.usage
            };
        }
    }

    /**
     * Transform messages for Gemini format
     */
    transformMessages(messages, systemPrompt) {
        const transformedMessages = [];
        
        // Add system prompt if provided
        if (systemPrompt) {
            transformedMessages.push({
                role: 'system',
                content: systemPrompt
            });
        }

        // Transform messages
        for (const message of messages) {
            transformedMessages.push({
                role: message.role === 'assistant' ? 'model' : message.role === 'system' ? 'system' : 'user',
                content: message.content
            });
        }

        return transformedMessages;
    }

    /**
     * Get model information
     */
    getModelInfo(modelId) {
        const modelInfo = {
            'gemini-1.5-pro': {
                name: 'Gemini 1.5 Pro',
                contextLength: 2000000,
                description: 'Most capable model with 2M token context window'
            },
            'gemini-1.5-flash': {
                name: 'Gemini 1.5 Flash',
                contextLength: 1000000,
                description: 'Fast model with 1M token context window'
            },
            'gemini-1.0-pro': {
                name: 'Gemini 1.0 Pro',
                contextLength: 32768,
                description: 'Balanced model for most use cases'
            },
            'gemini-1.0-pro-vision': {
                name: 'Gemini 1.0 Pro Vision',
                contextLength: 16384,
                description: 'Multimodal model with vision capabilities'
            },
            'gemini-pro': {
                name: 'Gemini Pro',
                contextLength: 32768,
                description: 'Standard Gemini model'
            },
            'gemini-pro-vision': {
                name: 'Gemini Pro Vision',
                contextLength: 16384,
                description: 'Gemini with vision capabilities'
            }
        };

        return modelInfo[modelId] || {
            name: modelId,
            contextLength: 32768,
            description: 'Gemini model'
        };
    }

    /**
     * Test the provider configuration
     */
    async test() {
        try {
            await this.complete({
                messages: [{ role: 'user', content: 'Hello' }],
                max_tokens: 10
            });
            return { success: true, message: 'Gemini CLI connection successful' };
        } catch (error) {
            return { 
                success: false, 
                error: `Gemini CLI test failed: ${error.message}. Ensure gcloud CLI is installed and authenticated.` 
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

module.exports = GeminiCliProvider;