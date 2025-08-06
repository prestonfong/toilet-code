/**
 * Groq Provider
 * Web-compatible provider for Groq AI API
 * Supports OpenAI-compatible chat completions endpoint with ultra-fast inference
 */

class GroqProvider {
    constructor(options = {}) {
        this.options = options;
        this.name = 'groq';
        this.displayName = 'Groq';
        this.baseURL = 'https://api.groq.com/openai/v1';
        this.defaultModel = 'llama-3.1-70b-versatile';
        this.supportedModels = [
            'llama-3.1-70b-versatile',
            'llama-3.1-8b-instant',
            'llama-3.2-1b-preview',
            'llama-3.2-3b-preview',
            'llama-3.2-11b-text-preview',
            'llama-3.2-90b-text-preview',
            'mixtral-8x7b-32768',
            'gemma-7b-it',
            'gemma2-9b-it'
        ];
        this.supportsStreaming = true;
        this.supportsTools = false;
    }

    /**
     * Validate the API key format
     */
    validateApiKey(apiKey) {
        if (!apiKey) {
            throw new Error('Groq API key is required');
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
     * Transform messages to Groq format
     */
    transformMessages(messages) {
        return messages.map(msg => ({
            role: msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user',
            content: msg.content
        }));
    }

    /**
     * Create the request payload for Groq API
     */
    createRequestPayload(options) {
        const payload = {
            model: options.model || this.options.model || this.defaultModel,
            messages: this.transformMessages(options.messages),
            max_tokens: options.max_tokens || options.maxTokens || this.options.maxTokens || 2048,
            stream: options.stream || false
        };

        if (options.temperature !== undefined || this.options.temperature !== undefined) {
            payload.temperature = Math.max(0, Math.min(2, options.temperature ?? this.options.temperature));
        }

        if (options.top_p !== undefined || this.options.topP !== undefined) {
            payload.top_p = Math.max(0, Math.min(1, options.top_p ?? this.options.topP));
        }

        if (options.frequency_penalty !== undefined || this.options.frequencyPenalty !== undefined) {
            payload.frequency_penalty = Math.max(-2, Math.min(2, options.frequency_penalty ?? this.options.frequencyPenalty));
        }

        if (options.presence_penalty !== undefined || this.options.presencePenalty !== undefined) {
            payload.presence_penalty = Math.max(-2, Math.min(2, options.presence_penalty ?? this.options.presencePenalty));
        }

        if (options.seed !== undefined || this.options.seed !== undefined) {
            payload.seed = options.seed ?? this.options.seed;
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
                toolCalls: [], // Groq doesn't support tools yet
                usage: {
                    inputTokens: data.usage?.prompt_tokens || 0,
                    outputTokens: data.usage?.completion_tokens || 0
                },
                model: data.model,
                stop_reason: data.choices?.[0]?.finish_reason
            };
        } catch (error) {
            console.error('Groq API error:', error);
            throw new Error(`Groq API error: ${error.message}`);
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
            console.error('Groq streaming error:', error);
            throw new Error(`Groq streaming error: ${error.message}`);
        }
    }

    /**
     * Get model information
     */
    getModelInfo(modelId) {
        const modelInfo = {
            'llama-3.1-70b-versatile': {
                name: 'Llama 3.1 70B Versatile',
                contextLength: 131072,
                description: 'Large versatile model with high performance'
            },
            'llama-3.1-8b-instant': {
                name: 'Llama 3.1 8B Instant',
                contextLength: 131072,
                description: 'Ultra-fast 8B parameter model'
            },
            'llama-3.2-1b-preview': {
                name: 'Llama 3.2 1B Preview',
                contextLength: 131072,
                description: 'Extremely fast 1B parameter model'
            },
            'llama-3.2-3b-preview': {
                name: 'Llama 3.2 3B Preview',
                contextLength: 131072,
                description: 'Fast 3B parameter model'
            },
            'mixtral-8x7b-32768': {
                name: 'Mixtral 8x7B',
                contextLength: 32768,
                description: 'Mixture of experts model with high quality'
            },
            'gemma2-9b-it': {
                name: 'Gemma2 9B IT',
                contextLength: 8192,
                description: 'Google Gemma2 model optimized for instruction following'
            }
        };

        return modelInfo[modelId] || {
            name: modelId,
            contextLength: 131072,
            description: 'Groq model'
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
            return { success: true, message: 'Groq API connection successful' };
        } catch (error) {
            return { success: false, error: error.message };
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

module.exports = GroqProvider;