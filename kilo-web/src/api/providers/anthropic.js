const { Anthropic } = require('@anthropic-ai/sdk');

/**
 * Web-compatible Anthropic API provider
 * Simplified version of the VS Code extension's AnthropicHandler
 */
class AnthropicProvider {
    constructor(options = {}) {
        this.options = options;
        this.client = new Anthropic({
            apiKey: options.apiKey,
            baseURL: options.baseUrl || undefined
        });
        this.modelId = options.model || 'claude-3-5-sonnet-20241022';
    }

    /**
     * Get basic model information
     */
    getModel() {
        return {
            id: this.modelId,
            maxTokens: 4096,
            temperature: this.options.temperature || 0.7
        };
    }

    /**
     * Complete a single prompt (non-streaming)
     */
    async complete(options) {
        const { messages, systemPrompt, tools = [] } = options;
        
        try {
            const model = this.getModel();
            
            // Convert messages to Anthropic format
            const anthropicMessages = this.convertMessages(messages);
            
            const requestOptions = {
                model: model.id,
                max_tokens: model.maxTokens,
                temperature: model.temperature,
                messages: anthropicMessages
            };

            if (systemPrompt) {
                requestOptions.system = systemPrompt;
            }

            if (tools && tools.length > 0) {
                requestOptions.tools = this.convertTools(tools);
            }

            const response = await this.client.messages.create(requestOptions);
            
            // Extract content and tool calls
            let content = '';
            let toolCalls = [];
            
            for (const block of response.content) {
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

            return {
                content,
                toolCalls,
                usage: {
                    inputTokens: response.usage.input_tokens,
                    outputTokens: response.usage.output_tokens
                }
            };
        } catch (error) {
            console.error('Anthropic API error:', error);
            throw new Error(`Anthropic API error: ${error.message}`);
        }
    }

    /**
     * Stream a completion (for future use)
     */
    async *stream(options) {
        const { messages, systemPrompt, tools = [] } = options;
        
        try {
            const model = this.getModel();
            
            const anthropicMessages = this.convertMessages(messages);
            
            const requestOptions = {
                model: model.id,
                max_tokens: model.maxTokens,
                temperature: model.temperature,
                messages: anthropicMessages,
                stream: true
            };

            if (systemPrompt) {
                requestOptions.system = systemPrompt;
            }

            if (tools && tools.length > 0) {
                requestOptions.tools = this.convertTools(tools);
            }

            const stream = await this.client.messages.create(requestOptions);
            
            for await (const chunk of stream) {
                switch (chunk.type) {
                    case 'content_block_start':
                        if (chunk.content_block.type === 'text') {
                            yield {
                                type: 'text',
                                content: chunk.content_block.text
                            };
                        }
                        break;
                    case 'content_block_delta':
                        if (chunk.delta.type === 'text_delta') {
                            yield {
                                type: 'text',
                                content: chunk.delta.text
                            };
                        }
                        break;
                    case 'message_start':
                        yield {
                            type: 'usage',
                            usage: {
                                inputTokens: chunk.message.usage.input_tokens,
                                outputTokens: chunk.message.usage.output_tokens
                            }
                        };
                        break;
                }
            }
        } catch (error) {
            console.error('Anthropic streaming error:', error);
            throw new Error(`Anthropic streaming error: ${error.message}`);
        }
    }

    /**
     * Convert generic messages to Anthropic format
     */
    convertMessages(messages) {
        return messages.map(msg => ({
            role: msg.role,
            content: msg.content
        }));
    }

    /**
     * Convert tools to Anthropic format
     */
    convertTools(tools) {
        return tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.input_schema || {
                type: 'object',
                properties: tool.parameters || {},
                required: tool.required || []
            }
        }));
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

module.exports = AnthropicProvider;