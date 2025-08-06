const AnthropicProvider = require('./anthropic');
const OpenAIProvider = require('./openai');
const ClaudeCodeProvider = require('./claude-code');
const VirtualQuotaFallbackProvider = require('./virtual-quota-fallback');
const FireworksProvider = require('./fireworks');
const CerebrasProvider = require('./cerebras');
const GeminiCliProvider = require('./gemini-cli');
const XaiProvider = require('./xai');
const GroqProvider = require('./groq');
const HuggingFaceProvider = require('./huggingface');

const providers = {
    anthropic: new AnthropicProvider(),
    openai: new OpenAIProvider(),
    'claude-code': new ClaudeCodeProvider(),
    'virtual-quota-fallback': new VirtualQuotaFallbackProvider(),
    fireworks: new FireworksProvider(),
    cerebras: new CerebrasProvider(),
    'gemini-cli': new GeminiCliProvider(),
    xai: new XaiProvider(),
    groq: new GroqProvider(),
    huggingface: new HuggingFaceProvider()
};

module.exports = providers;