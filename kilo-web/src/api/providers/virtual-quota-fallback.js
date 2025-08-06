/**
 * Virtual Quota Fallback Provider
 * Manages multiple provider profiles with quota limits and automatic fallback
 * Web-compatible implementation for kilo-web
 */

class VirtualQuotaFallbackProvider {
    constructor(options = {}) {
        this.options = options;
        this.name = 'virtual-quota-fallback';
        this.displayName = 'Virtual Quota Fallback';
        this.profiles = options.profiles || [];
        this.currentProfileIndex = 0;
        this.quotaUsage = new Map();
        this.supportsStreaming = true;
        this.supportsTools = true;
    }

    /**
     * Get basic model information from current active profile
     */
    getModel() {
        const currentProfile = this.getCurrentProfile();
        if (!currentProfile || !currentProfile.provider) {
            return { id: 'fallback', maxTokens: 4096, temperature: 0.7 };
        }

        // Delegate to the underlying provider
        const ProviderClass = this.getProviderClass(currentProfile.provider);
        const provider = new ProviderClass(currentProfile.settings);
        return provider.getModel ? provider.getModel() : { id: 'fallback', maxTokens: 4096, temperature: 0.7 };
    }

    /**
     * Complete a single prompt using fallback logic
     */
    async complete(options) {
        if (this.profiles.length === 0) {
            throw new Error('No fallback profiles configured');
        }

        let lastError = null;
        const maxAttempts = this.profiles.length;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const profile = this.getCurrentProfile();
            const profileId = profile.id || this.currentProfileIndex;

            try {
                // Check quota limits
                if (this.isQuotaExceeded(profileId, profile)) {
                    console.log(`Quota exceeded for profile ${profileId}, trying next profile`);
                    this.switchToNextProfile();
                    continue;
                }

                // Load the actual provider for this profile
                const ProviderClass = this.getProviderClass(profile.provider);
                const provider = new ProviderClass(profile.settings);

                // Make the request
                const response = await provider.complete(options);

                // Track usage
                this.updateQuotaUsage(profileId, response);

                return response;
            } catch (error) {
                console.error(`Profile ${profileId} failed:`, error.message);
                lastError = error;

                // If this is a quota/rate limit error, mark profile as exhausted
                if (this.isQuotaError(error)) {
                    this.markProfileExhausted(profileId);
                }

                this.switchToNextProfile();
            }
        }

        // All profiles failed
        throw new Error(`All fallback profiles exhausted. Last error: ${lastError?.message || 'Unknown error'}`);
    }

    /**
     * Stream a completion using fallback logic
     */
    async *stream(options) {
        if (this.profiles.length === 0) {
            throw new Error('No fallback profiles configured');
        }

        let lastError = null;
        const maxAttempts = this.profiles.length;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const profile = this.getCurrentProfile();
            const profileId = profile.id || this.currentProfileIndex;

            try {
                // Check quota limits
                if (this.isQuotaExceeded(profileId, profile)) {
                    console.log(`Quota exceeded for profile ${profileId}, trying next profile`);
                    this.switchToNextProfile();
                    continue;
                }

                // Load the actual provider for this profile
                const ProviderClass = this.getProviderClass(profile.provider);
                const provider = new ProviderClass(profile.settings);

                // Stream the request
                let totalTokens = 0;
                for await (const chunk of provider.stream(options)) {
                    if (chunk.type === 'usage') {
                        totalTokens = chunk.usage.inputTokens + chunk.usage.outputTokens;
                    }
                    yield chunk;
                }

                // Track usage
                this.updateQuotaUsage(profileId, { usage: { total_tokens: totalTokens } });
                return;
            } catch (error) {
                console.error(`Profile ${profileId} streaming failed:`, error.message);
                lastError = error;

                // If this is a quota/rate limit error, mark profile as exhausted
                if (this.isQuotaError(error)) {
                    this.markProfileExhausted(profileId);
                }

                this.switchToNextProfile();
            }
        }

        // All profiles failed
        throw new Error(`All fallback profiles exhausted. Last error: ${lastError?.message || 'Unknown error'}`);
    }

    /**
     * Get the current active profile
     */
    getCurrentProfile() {
        return this.profiles[this.currentProfileIndex];
    }

    /**
     * Check if quota is exceeded for a profile
     */
    isQuotaExceeded(profileId, profile) {
        if (!profile.quotaLimit) return false;

        const usage = this.quotaUsage.get(profileId) || { requests: 0, tokens: 0, resetTime: 0 };
        const now = Date.now();

        // Reset quota if reset period has passed
        if (profile.quotaResetPeriod && now > usage.resetTime) {
            this.quotaUsage.set(profileId, { 
                requests: 0, 
                tokens: 0, 
                resetTime: now + profile.quotaResetPeriod 
            });
            return false;
        }

        return (profile.quotaLimit.requests && usage.requests >= profile.quotaLimit.requests) ||
               (profile.quotaLimit.tokens && usage.tokens >= profile.quotaLimit.tokens);
    }

    /**
     * Update quota usage tracking
     */
    updateQuotaUsage(profileId, response) {
        const usage = this.quotaUsage.get(profileId) || { requests: 0, tokens: 0, resetTime: 0 };
        usage.requests += 1;

        if (response.usage) {
            usage.tokens += response.usage.total_tokens || 
                           (response.usage.prompt_tokens || 0) + (response.usage.completion_tokens || 0);
        }

        this.quotaUsage.set(profileId, usage);
    }

    /**
     * Check if error is quota-related
     */
    isQuotaError(error) {
        const quotaKeywords = ['quota', 'rate limit', 'too many requests', '429', 'exceeded'];
        const errorMessage = error.message.toLowerCase();
        return quotaKeywords.some(keyword => errorMessage.includes(keyword));
    }

    /**
     * Mark profile as exhausted for reset period
     */
    markProfileExhausted(profileId) {
        const profile = this.profiles.find(p => (p.id || this.profiles.indexOf(p)) === profileId);
        if (profile && profile.quotaResetPeriod) {
            const usage = this.quotaUsage.get(profileId) || { requests: 0, tokens: 0, resetTime: 0 };
            usage.resetTime = Date.now() + profile.quotaResetPeriod;
            this.quotaUsage.set(profileId, usage);
        }
    }

    /**
     * Switch to the next profile in rotation
     */
    switchToNextProfile() {
        this.currentProfileIndex = (this.currentProfileIndex + 1) % this.profiles.length;
    }

    /**
     * Get provider class by name
     */
    getProviderClass(providerType) {
        // Dynamic require - in a real implementation this would use the provider registry
        const providers = require('./index');
        const ProviderClass = providers[providerType];
        if (!ProviderClass) {
            throw new Error(`Unknown provider type: ${providerType}`);
        }
        return ProviderClass;
    }

    /**
     * Test the provider configuration
     */
    async test() {
        if (this.profiles.length === 0) {
            return { success: false, error: 'No fallback profiles configured' };
        }

        try {
            await this.complete({
                messages: [{ role: 'user', content: 'Hello' }],
                max_tokens: 10
            });
            return { success: true, message: 'Virtual Quota Fallback provider test successful' };
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

module.exports = VirtualQuotaFallbackProvider;