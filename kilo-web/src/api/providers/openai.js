const { OpenAI } = require('openai');

/**
 * Web-compatible OpenAI API provider
 * Simplified version of the VS Code extension's OpenAiHandler
 */
class OpenAIProvider {
    constructor(options = {}) {
        this.options = options;
        this.client = new OpenAI({
            apiKey: options.apiKey,
            baseURL: options.baseUrl || 'https://api.openai.com/v1',
            defaultHeaders: options.headers || {}
        });
        this.modelId = options.model || 'gpt-4';
    }

    /**
     * Get basic model information
     */
    getModel() {
        return {
            id: this.modelId,
            maxTokens: this.options.maxTokens || 4096,
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
            
            // Convert messages to OpenAI format
            const openaiMessages = this.convertMessages(messages, systemPrompt);
            
            const requestOptions = {
                model: model.id,
                max_tokens: model.maxTokens,
                temperature: model.temperature,
                messages: openaiMessages
            };

            if (tools && tools.length > 0) {
                requestOptions.tools = this.convertTools(tools);
                requestOptions.tool_choice = 'auto';
            }

            const response = await this.client.chat.completions.create(requestOptions);
            
            const choice = response.choices[0];
            const message = choice.message;
            
            // Extract content and tool calls
            let content = message.content || '';
            let toolCalls = [];
            
            if (message.tool_calls) {
                toolCalls = message.tool_calls.map(toolCall => ({
                    name: toolCall.function.name,
                    parameters: JSON.parse(toolCall.function.arguments || '{}'),
                    id: toolCall.id
                }));
            }

            return {
                content,
                toolCalls,
                usage: {
                    inputTokens: response.usage.prompt_tokens,
                    outputTokens: response.usage.completion_tokens
                }
            };
        } catch (error) {
            console.error('OpenAI API error:', error);
            throw new Error(`OpenAI API error: ${error.message}`);
        }
    }

    /**
     * Stream a completion (for future use)
     */
    async *stream(options) {
        const { messages, systemPrompt, tools = [] } = options;
        
        try {
            const model = this.getModel();
            
            const openaiMessages = this.convertMessages(messages, systemPrompt);
            
            const requestOptions = {
                model: model.id,
                max_tokens: model.maxTokens,
                temperature: model.temperature,
                messages: openaiMessages,
                stream: true,
                stream_options: { include_usage: true }
            };

            if (tools && tools.length > 0) {
                requestOptions.tools = this.convertTools(tools);
                requestOptions.tool_choice = 'auto';
            }

            const stream = await this.client.chat.completions.create(requestOptions);
            
            for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta;
                
                if (delta?.content) {
                    yield {
                        type: 'text',
                        content: delta.content
                    };
                }
                
                if (chunk.usage) {
                    yield {
                        type: 'usage',
                        usage: {
                            inputTokens: chunk.usage.prompt_tokens,
                            outputTokens: chunk.usage.completion_tokens
                        }
                    };
                }
            }
        } catch (error) {
            console.error('OpenAI streaming error:', error);
            throw new Error(`OpenAI streaming error: ${error.message}`);
        }
    }

    /**
     * Convert generic messages to OpenAI format
     */
    convertMessages(messages, systemPrompt) {
        const converted = [];
        
        if (systemPrompt) {
            converted.push({
                role: 'system',
                content: systemPrompt
            });
        }
        
        return converted.concat(messages.map(msg => ({
            role: msg.role,
            content: msg.content
        })));
    }

    /**
     * Convert tools to OpenAI format
     */
    convertTools(tools) {
        return tools.map(tool => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.input_schema || {
                    type: 'object',
                    properties: tool.parameters || {},
                    required: tool.required || []
                }
            }
        }));
    }

    /**
     * Count tokens (simplified implementation)
     */
    async countTokens(content) {
        // Rough approximation: 1 token ≈ 4 characters for GPT models
        const text = typeof content === 'string' ? content : JSON.stringify(content);
        return Math.ceil(text.length / 4);
    }
}

module.exports = OpenAIProvider;