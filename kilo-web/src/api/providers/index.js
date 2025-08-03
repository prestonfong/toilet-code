const AnthropicProvider = require('./anthropic');
const OpenAIProvider = require('./openai');
const ClaudeCodeProvider = require('./claude-code');

const providers = {
    anthropic: new AnthropicProvider(),
    openai: new OpenAIProvider(),
    'claude-code': new ClaudeCodeProvider()
};

module.exports = providers;