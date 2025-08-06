/**
 * Hugging Face Provider
 * Web-compatible provider for Hugging Face Inference API
 * Supports both Inference API and Inference Endpoints
 */

class HuggingFaceProvider {
    constructor(options = {}) {
        this.options = options;
        this.name = 'huggingface';
        this.displayName = 'Hugging Face';
        this.defaultModel = 'microsoft/DialoGPT-medium';
        this.inferenceProvider = options.inferenceProvider || 'inference-api';
        this.baseURL = this.getBaseURL();
        this.supportsStreaming = false; // HF Inference API has limited streaming support
        this.supportsTools = false;
    }

    /**
     * Get the base URL based on inference provider type
     */
    getBaseURL() {
        switch (this.inferenceProvider) {
            case 'inference-endpoints':
                return `https://${this.options.endpointName}.endpoints.huggingface.cloud`;
            case 'inference-api':
            default:
                return 'https://api-inference.huggingface.co';
        }
    }

    /**
     * Validate the API key format
     */
    validateApiKey(apiKey) {
        if (!apiKey) {
            throw new Error('Hugging Face API key is required');
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
     * Transform messages for different model types
     */
    transformMessages(messages, systemPrompt) {
        const allMessages = systemPrompt ? 
            [{ role: 'system', content: systemPrompt }, ...messages] : 
            messages;

        // For conversational models
        if (this.isConversationalModel()) {
            return {
                past_user_inputs: [],
                generated_responses: [],
                text: allMessages[allMessages.length - 1]?.content || ''
            };
        }

        // For text generation models, create a single prompt
        return allMessages.map(msg => {
            const prefix = msg.role === 'system' ? 'System: ' : 
                         msg.role === 'assistant' ? 'Assistant: ' : 'User: ';
            return prefix + msg.content;
        }).join('\n') + '\nAssistant: ';
    }

    /**
     * Create the request payload for Hugging Face API
     */
    createRequestPayload(options) {
        const { messages, systemPrompt } = options;
        const modelId = options.model || this.options.model || this.defaultModel;

        if (this.isConversationalModel()) {
            return {
                inputs: this.transformMessages(messages, systemPrompt),
                parameters: {
                    max_length: options.max_tokens || options.maxTokens || this.options.maxTokens || 512,
                    temperature: options.temperature ?? this.options.temperature ?? 0.7,
                    repetition_penalty: this.options.repetitionPenalty || 1.03,
                    do_sample: true
                }
            };
        } else if (this.isChatCompletionModel()) {
            return {
                model: modelId,
                messages: messages.map(msg => ({
                    role: msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user',
                    content: msg.content
                })),
                max_tokens: options.max_tokens || options.maxTokens || this.options.maxTokens || 2048,
                temperature: options.temperature ?? this.options.temperature ?? 0.7,
                top_p: options.top_p ?? this.options.topP ?? 0.9,
                stream: false
            };
        } else {
            // Text generation model
            return {
                inputs: this.transformMessages(messages, systemPrompt),
                parameters: {
                    max_new_tokens: options.max_tokens || options.maxTokens || this.options.maxTokens || 512,
                    temperature: options.temperature ?? this.options.temperature ?? 0.7,
                    top_p: options.top_p ?? this.options.topP ?? 0.9,
                    do_sample: true,
                    return_full_text: false
                }
            };
        }
    }

    /**
     * Get basic model information
     */
    getModel() {
        const modelId = this.options.model || this.defaultModel;
        return {
            id: modelId,
            maxTokens: this.options.maxTokens || 512,
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

        const payload = this.createRequestPayload({
            ...options,
            messages,
            systemPrompt
        });

        const headers = this.getHeaders(apiKey);
        const modelId = options.model || this.options.model || this.defaultModel;

        try {
            let endpoint;
            if (this.isChatCompletionModel()) {
                endpoint = `${this.baseURL}/chat/completions`;
            } else {
                endpoint = `${this.baseURL}/models/${modelId}`;
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Handle different response formats
            let content = '';
            
            if (this.isChatCompletionModel() && data.choices) {
                content = data.choices[0]?.message?.content || '';
            } else if (data.generated_text !== undefined) {
                content = data.generated_text;
            } else if (Array.isArray(data) && data.length > 0) {
                content = data[0].generated_text || '';
            } else if (typeof data === 'string') {
                content = data;
            }

            return {
                content,
                toolCalls: [], // Hugging Face doesn't support tools
                usage: {
                    inputTokens: 0, // HF doesn't always provide token counts
                    outputTokens: 0
                },
                model: modelId,
                stop_reason: 'stop'
            };
        } catch (error) {
            console.error('Hugging Face API error:', error);
            throw new Error(`Hugging Face API error: ${error.message}`);
        }
    }

    /**
     * Stream a completion (limited support)
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
     * Check if model is a conversational type
     */
    isConversationalModel() {
        const modelId = this.options.model || this.defaultModel;
        const conversationalModels = ['DialoGPT', 'blenderbot', 'conversational'];
        return conversationalModels.some(model => 
            modelId.toLowerCase().includes(model.toLowerCase())
        );
    }

    /**
     * Check if model supports chat completion API
     */
    isChatCompletionModel() {
        const modelId = this.options.model || this.defaultModel;
        const chatModels = ['chat', 'instruct', 'assistant'];
        return chatModels.some(model => 
            modelId.toLowerCase().includes(model.toLowerCase())
        );
    }

    /**
     * Check if model is a text generation type
     */
    isTextGenerationModel() {
        const modelId = this.options.model || this.defaultModel;
        const textGenModels = ['gpt', 'llama', 'mistral', 'falcon', 'bloom', 'opt'];
        return textGenModels.some(model => 
            modelId.toLowerCase().includes(model.toLowerCase())
        );
    }

    /**
     * Get model information
     */
    getModelInfo(modelId) {
        // This would typically be fetched from HF model hub API
        return {
            name: modelId,
            contextLength: 1024, // Default, varies by model
            description: 'Hugging Face model'
        };
    }

    /**
     * Get available inference providers
     */
    getInferenceProviders() {
        return [
            { id: 'inference-api', name: 'Inference API (Free)', description: 'Free hosted inference' },
            { id: 'inference-endpoints', name: 'Inference Endpoints', description: 'Dedicated endpoints (paid)' }
        ];
    }

    /**
     * Test the API connection
     */
    async test(apiKey) {
        try {
            await this.complete({
                messages: [{ role: 'user', content: 'Hello' }],
                max_tokens: 10,
                apiKey
            });
            return { success: true, message: 'Hugging Face API connection successful' };
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

module.exports = HuggingFaceProvider;