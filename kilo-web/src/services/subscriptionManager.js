const fs = require('fs-extra');
const path = require('path');

class SubscriptionManager {
    constructor() {
        this.subscriptionsPath = path.join(__dirname, '../../data/subscriptions.json');
        this.subscriptions = new Map();
        this.cleanupInterval = null;
    }

    /**
     * Initialize the subscription manager
     */
    async initialize() {
        try {
            // Ensure data directory exists
            await fs.ensureDir(path.dirname(this.subscriptionsPath));
            
            // Load existing subscriptions
            await this.loadSubscriptions();
            
            // Start cleanup interval (every 24 hours)
            this.startCleanupInterval();
            
            console.log(`Subscription manager initialized with ${this.subscriptions.size} subscriptions`);
        } catch (error) {
            console.error('Error initializing subscription manager:', error);
            throw error;
        }
    }

    /**
     * Load subscriptions from file
     */
    async loadSubscriptions() {
        try {
            if (await fs.pathExists(this.subscriptionsPath)) {
                const data = await fs.readJson(this.subscriptionsPath);
                this.subscriptions = new Map(Object.entries(data));
            }
        } catch (error) {
            console.error('Error loading subscriptions:', error);
            // Initialize empty subscriptions on error
            this.subscriptions = new Map();
        }
    }

    /**
     * Save subscriptions to file
     */
    async saveSubscriptions() {
        try {
            const data = Object.fromEntries(this.subscriptions);
            await fs.writeJson(this.subscriptionsPath, data, { spaces: 2 });
        } catch (error) {
            console.error('Error saving subscriptions:', error);
            throw error;
        }
    }

    /**
     * Add a new subscription
     */
    async addSubscription(subscription, metadata = {}) {
        try {
            // Generate unique ID based on endpoint
            const subscriptionId = this.generateSubscriptionId(subscription.endpoint);
            
            // Create subscription object with metadata
            const subscriptionData = {
                subscription: subscription,
                metadata: {
                    addedAt: new Date().toISOString(),
                    lastUsed: new Date().toISOString(),
                    failureCount: 0,
                    userAgent: metadata.userAgent || 'unknown',
                    userId: metadata.userId || null,
                    ...metadata
                },
                isActive: true
            };

            this.subscriptions.set(subscriptionId, subscriptionData);
            await this.saveSubscriptions();
            
            console.log(`Added subscription: ${subscriptionId}`);
            return subscriptionId;
        } catch (error) {
            console.error('Error adding subscription:', error);
            throw error;
        }
    }

    /**
     * Remove a subscription
     */
    async removeSubscription(subscriptionId) {
        try {
            const removed = this.subscriptions.delete(subscriptionId);
            if (removed) {
                await this.saveSubscriptions();
                console.log(`Removed subscription: ${subscriptionId}`);
            }
            return removed;
        } catch (error) {
            console.error('Error removing subscription:', error);
            throw error;
        }
    }

    /**
     * Get a subscription by ID
     */
    getSubscription(subscriptionId) {
        return this.subscriptions.get(subscriptionId);
    }

    /**
     * Get all active subscriptions
     */
    getActiveSubscriptions() {
        const activeSubscriptions = [];
        for (const [id, data] of this.subscriptions.entries()) {
            if (data.isActive) {
                activeSubscriptions.push({ id, ...data });
            }
        }
        return activeSubscriptions;
    }

    /**
     * Get subscriptions by user ID
     */
    getSubscriptionsByUserId(userId) {
        const userSubscriptions = [];
        for (const [id, data] of this.subscriptions.entries()) {
            if (data.metadata.userId === userId && data.isActive) {
                userSubscriptions.push({ id, ...data });
            }
        }
        return userSubscriptions;
    }

    /**
     * Mark subscription as failed
     */
    async markSubscriptionFailed(subscriptionId, error = null) {
        try {
            const subscription = this.subscriptions.get(subscriptionId);
            if (subscription) {
                subscription.metadata.failureCount += 1;
                subscription.metadata.lastError = error ? error.message : 'Unknown error';
                subscription.metadata.lastErrorAt = new Date().toISOString();
                
                // Deactivate subscription after 3 consecutive failures
                if (subscription.metadata.failureCount >= 3) {
                    subscription.isActive = false;
                    console.log(`Deactivated subscription due to failures: ${subscriptionId}`);
                }
                
                await this.saveSubscriptions();
            }
        } catch (error) {
            console.error('Error marking subscription as failed:', error);
        }
    }

    /**
     * Mark subscription as successful
     */
    async markSubscriptionSuccess(subscriptionId) {
        try {
            const subscription = this.subscriptions.get(subscriptionId);
            if (subscription) {
                subscription.metadata.failureCount = 0;
                subscription.metadata.lastUsed = new Date().toISOString();
                subscription.metadata.lastError = null;
                subscription.metadata.lastErrorAt = null;
                subscription.isActive = true;
                
                await this.saveSubscriptions();
            }
        } catch (error) {
            console.error('Error marking subscription as successful:', error);
        }
    }

    /**
     * Clean up expired and invalid subscriptions
     */
    async cleanupSubscriptions() {
        try {
            const now = new Date();
            const expiredThreshold = 30 * 24 * 60 * 60 * 1000; // 30 days
            let removedCount = 0;

            for (const [id, data] of this.subscriptions.entries()) {
                const lastUsed = new Date(data.metadata.lastUsed);
                const timeSinceLastUse = now - lastUsed;
                
                // Remove subscriptions that haven't been used in 30 days or have too many failures
                if (timeSinceLastUse > expiredThreshold || data.metadata.failureCount >= 5) {
                    this.subscriptions.delete(id);
                    removedCount++;
                    console.log(`Cleaned up expired/failed subscription: ${id}`);
                }
            }

            if (removedCount > 0) {
                await this.saveSubscriptions();
                console.log(`Cleaned up ${removedCount} subscriptions`);
            }
        } catch (error) {
            console.error('Error during subscription cleanup:', error);
        }
    }

    /**
     * Start automatic cleanup interval
     */
    startCleanupInterval() {
        // Run cleanup every 24 hours
        this.cleanupInterval = setInterval(() => {
            this.cleanupSubscriptions();
        }, 24 * 60 * 60 * 1000);
    }

    /**
     * Stop cleanup interval
     */
    stopCleanupInterval() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    /**
     * Generate subscription ID from endpoint
     */
    generateSubscriptionId(endpoint) {
        // Extract a unique identifier from the endpoint URL
        const url = new URL(endpoint);
        const pathParts = url.pathname.split('/');
        const uniquePart = pathParts[pathParts.length - 1] || 'unknown';
        return `sub_${uniquePart}`;
    }

    /**
     * Get subscription statistics
     */
    getStats() {
        const total = this.subscriptions.size;
        let active = 0;
        let failed = 0;

        for (const data of this.subscriptions.values()) {
            if (data.isActive) {
                active++;
            }
            if (data.metadata.failureCount > 0) {
                failed++;
            }
        }

        return {
            total,
            active,
            inactive: total - active,
            failed
        };
    }

    /**
     * Cleanup and shutdown
     */
    async shutdown() {
        this.stopCleanupInterval();
        await this.saveSubscriptions();
        console.log('Subscription manager shut down');
    }
}

module.exports = SubscriptionManager;