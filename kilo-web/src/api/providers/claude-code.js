/**
 * Claude Code API Provider
 * Specialized provider for Claude with enhanced code understanding and tool capabilities
 * Web-compatible version of the original kilocode Claude Code provider
 * Uses native fetch API without external dependencies
 */

class ClaudeCodeProvider {
    constructor(options = {}) {
        this.options = options;
        this.name = 'claude-code';
        this.displayName = 'Claude Code';
        this.baseURL = 'https://api.anthropic.com/v1';
        this.defaultModel = 'claude-3-5-sonnet-20241022';
        this.supportedModels = [
            'claude-3-5-sonnet-20241022',
            'claude-3-5-haiku-20241022',
            'claude-3-opus-20240229',
            'claude-3-sonnet-20240229',
            'claude-3-haiku-20240307'
        ];
        this.supportsStreaming = true;
        this.supportsTools = true;
        this.supportsImages = true;
    }

    /**
     * Validate the API key format
     */
    validateApiKey(apiKey) {
        if (!apiKey) {
            throw new Error('API key is required');
        }
        if (!apiKey.startsWith('sk-ant-')) {
            throw new Error('Invalid Claude API key format. Should start with "sk-ant-"');
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
            max_tokens: options.max_tokens || options.maxTokens || 4096,
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
            maxTokens: this.options.maxTokens || 4096,
            temperature: this.options.temperature || 0.7
        };
    }

    /**
     * Complete a single prompt (non-streaming)
     */
    async complete(options) {
        const { messages, systemPrompt, tools = [] } = options;
        const apiKey = this.options.apiKey || options.apiKey;
        
        this.validateApiKey(apiKey);

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
                throw new Error(error.error?.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Extract content and tool calls
            let content = '';
            let toolCalls = [];

            if (data.content && data.content.length > 0) {
                for (const block of data.content) {
                    if (block.type === 'text') {
                        content += block.text;
                    } else if (block.type === 'tool_use') {
                        toolCalls.push({
                            name: block.name,
                            parameters: block.input,
                            id: block.id
                        });
                    }
                }
            }

            return {
                content,
                toolCalls,
                usage: {
                    inputTokens: data.usage?.input_tokens || 0,
                    outputTokens: data.usage?.output_tokens || 0
                },
                model: data.model,
                stop_reason: data.stop_reason
            };
        } catch (error) {
            console.error('Claude Code API error:', error);
            throw new Error(`Claude Code API error: ${error.message}`);
        }
    }

    /**
     * Stream a completion
     */
    async *stream(options) {
        const { messages, systemPrompt, tools = [] } = options;
        const apiKey = this.options.apiKey || options.apiKey;
        
        this.validateApiKey(apiKey);

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
                            
                            if (parsed.type === 'content_block_start') {
                                if (parsed.content_block.type === 'text') {
                                    yield {
                                        type: 'text',
                                        content: parsed.content_block.text
                                    };
                                }
                            } else if (parsed.type === 'content_block_delta') {
                                const delta = parsed.delta;
                                if (delta.type === 'text_delta') {
                                    yield {
                                        type: 'text',
                                        content: delta.text
                                    };
                                }
                            } else if (parsed.type === 'message_start') {
                                yield {
                                    type: 'usage',
                                    usage: {
                                        inputTokens: parsed.message.usage.input_tokens,
                                        outputTokens: parsed.message.usage.output_tokens
                                    }
                                };
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
     * Get model information
     */
    getModelInfo(modelId) {
        const modelInfo = {
            'claude-3-5-sonnet-20241022': {
                name: 'Claude 3.5 Sonnet',
                contextLength: 200000,
                description: 'Most capable model for complex reasoning and code tasks'
            },
            'claude-3-5-haiku-20241022': {
                name: 'Claude 3.5 Haiku',
                contextLength: 200000,
                description: 'Fast and efficient model for simpler tasks'
            },
            'claude-3-opus-20240229': {
                name: 'Claude 3 Opus',
                contextLength: 200000,
                description: 'Most powerful model for highly complex tasks'
            },
            'claude-3-sonnet-20240229': {
                name: 'Claude 3 Sonnet',
                contextLength: 200000,
                description: 'Balanced model for most use cases'
            },
            'claude-3-haiku-20240307': {
                name: 'Claude 3 Haiku',
                contextLength: 200000,
                description: 'Fastest model for simple tasks'
            }
        };

        return modelInfo[modelId] || {
            name: modelId,
            contextLength: 200000,
            description: 'Claude model'
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
     * Count tokens (simplified implementation)
     */
    async countTokens(content) {
        // Rough approximation: 1 token ≈ 4 characters
        const text = typeof content === 'string' ? content : JSON.stringify(content);
        return Math.ceil(text.length / 4);
    }
}

module.exports = ClaudeCodeProvider;