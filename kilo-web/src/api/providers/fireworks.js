/**
 * Fireworks AI Provider
 * Web-compatible provider for Fireworks AI API
 * Supports OpenAI-compatible chat completions endpoint
 */

class FireworksProvider {
    constructor(options = {}) {
        this.options = options;
        this.name = 'fireworks';
        this.displayName = 'Fireworks AI';
        this.baseURL = 'https://api.fireworks.ai/inference/v1';
        this.defaultModel = 'accounts/fireworks/models/llama-v2-7b-chat';
        this.supportedModels = [
            'accounts/fireworks/models/llama-v2-7b-chat',
            'accounts/fireworks/models/llama-v2-13b-chat',
            'accounts/fireworks/models/llama-v2-70b-chat',
            'accounts/fireworks/models/mixtral-8x7b-instruct',
            'accounts/fireworks/models/mistral-7b-instruct-4k',
            'accounts/fireworks/models/yi-34b-200k-capybara'
        ];
        this.supportsStreaming = true;
        this.supportsTools = false;
    }

    /**
     * Validate the API key format
     */
    validateApiKey(apiKey) {
        if (!apiKey) {
            throw new Error('Fireworks API key is required');
        }
        return true;
    }

    /**
     * Prepare headers for API requests
     */
    getHeaders(apiKey) {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        };
    }

    /**
     * Transform messages to Fireworks format
     */
    transformMessages(messages) {
        return messages.map(msg => ({
            role: msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user',
            content: msg.content
        }));
    }

    /**
     * Create the request payload for Fireworks API
     */
    createRequestPayload(options) {
        const payload = {
            model: options.model || this.options.model || this.defaultModel,
            messages: this.transformMessages(options.messages),
            max_tokens: options.max_tokens || options.maxTokens || this.options.maxTokens || 2048,
            stream: options.stream || false
        };

        if (options.temperature !== undefined || this.options.temperature !== undefined) {
            payload.temperature = Math.max(0, Math.min(1, options.temperature ?? this.options.temperature));
        }

        if (options.top_p !== undefined || this.options.topP !== undefined) {
            payload.top_p = Math.max(0, Math.min(1, options.top_p ?? this.options.topP));
        }

        if (options.stop || this.options.stop) {
            payload.stop = Array.isArray(options.stop || this.options.stop) 
                ? (options.stop || this.options.stop) 
                : [options.stop || this.options.stop];
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
            maxTokens: this.options.maxTokens || 2048,
            temperature: this.options.temperature || 0.7
        };
    }

    /**
     * Complete a single prompt (non-streaming)
     */
    async complete(options) {
        const { messages, systemPrompt } = options;
        const apiKey = this.options.apiKey || options.apiKey;
        
        this.validateApiKey(apiKey);

        const allMessages = systemPrompt ? 
            [{ role: 'system', content: systemPrompt }, ...messages] : 
            messages;

        const payload = this.createRequestPayload({
            ...options,
            messages: allMessages,
            stream: false
        });

        const headers = this.getHeaders(apiKey);

        try {
            const response = await fetch(`${this.baseURL}/chat/completions`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error?.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Extract content
            let content = '';
            if (data.choices && data.choices.length > 0) {
                const choice = data.choices[0];
                content = choice.message?.content || choice.text || '';
            }

            return {
                content,
                toolCalls: [], // Fireworks doesn't support tools yet
                usage: {
                    inputTokens: data.usage?.prompt_tokens || 0,
                    outputTokens: data.usage?.completion_tokens || 0
                },
                model: data.model,
                stop_reason: data.choices?.[0]?.finish_reason
            };
        } catch (error) {
            console.error('Fireworks API error:', error);
            throw new Error(`Fireworks API error: ${error.message}`);
        }
    }

    /**
     * Stream a completion
     */
    async *stream(options) {
        const { messages, systemPrompt } = options;
        const apiKey = this.options.apiKey || options.apiKey;
        
        this.validateApiKey(apiKey);

        const allMessages = systemPrompt ? 
            [{ role: 'system', content: systemPrompt }, ...messages] : 
            messages;

        const payload = this.createRequestPayload({
            ...options,
            messages: allMessages,
            stream: true
        });

        const headers = this.getHeaders(apiKey);

        try {
            const response = await fetch(`${this.baseURL}/chat/completions`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error?.message || `HTTP ${response.status}: ${response.statusText}`);
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
                            
                            if (parsed.choices && parsed.choices.length > 0) {
                                const choice = parsed.choices[0];
                                const delta = choice.delta;
                                
                                if (delta?.content) {
                                    yield {
                                        type: 'text',
                                        content: delta.content
                                    };
                                }
                            }

                            if (parsed.usage) {
                                yield {
                                    type: 'usage',
                                    usage: {
                                        inputTokens: parsed.usage.prompt_tokens,
                                        outputTokens: parsed.usage.completion_tokens
                                    }
                                };
                            }
                        } catch (parseError) {
                            console.warn('Failed to parse SSE data:', parseError);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Fireworks streaming error:', error);
            throw new Error(`Fireworks streaming error: ${error.message}`);
        }
    }

    /**
     * Get model information
     */
    getModelInfo(modelId) {
        const modelInfo = {
            'accounts/fireworks/models/llama-v2-7b-chat': {
                name: 'Llama 2 7B Chat',
                contextLength: 4096,
                description: 'Fast 7B parameter model for chat'
            },
            'accounts/fireworks/models/llama-v2-13b-chat': {
                name: 'Llama 2 13B Chat',
                contextLength: 4096,
                description: 'Balanced 13B parameter model for chat'
            },
            'accounts/fireworks/models/llama-v2-70b-chat': {
                name: 'Llama 2 70B Chat',
                contextLength: 4096,
                description: 'Large 70B parameter model for complex tasks'
            },
            'accounts/fireworks/models/mixtral-8x7b-instruct': {
                name: 'Mixtral 8x7B Instruct',
                contextLength: 32768,
                description: 'Mixture of experts model with high performance'
            }
        };

        return modelInfo[modelId] || {
            name: modelId,
            contextLength: 4096,
            description: 'Fireworks model'
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
            return { success: true, message: 'Fireworks API connection successful' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Get available models for Fireworks provider
     */
    getAvailableModels() {
        return this.supportedModels;
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

module.exports = FireworksProvider;