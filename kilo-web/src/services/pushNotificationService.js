const webpush = require('web-push');
const VapidKeyManager = require('../config/vapidKeyManager');
const SubscriptionManager = require('./subscriptionManager');

class PushNotificationService {
    constructor() {
        this.vapidKeyManager = new VapidKeyManager();
        this.subscriptionManager = new SubscriptionManager();
        this.isInitialized = false;
        this.retryAttempts = 3;
        this.retryDelay = 1000; // 1 second
    }

    /**
     * Initialize the push notification service
     */
    async initialize() {
        try {
            // Initialize VAPID keys
            const keys = await this.vapidKeyManager.initialize();
            
            // Configure web-push
            webpush.setVapidDetails(
                process.env.VAPID_EMAIL || 'your-email@example.com',
                keys.publicKey,
                keys.privateKey
            );

            // Initialize subscription manager
            await this.subscriptionManager.initialize();

            this.isInitialized = true;
            console.log('Push notification service initialized successfully');
        } catch (error) {
            console.error('Error initializing push notification service:', error);
            throw error;
        }
    }

    /**
     * Get the public VAPID key for client subscription
     */
    getPublicKey() {
        this.ensureInitialized();
        return this.vapidKeyManager.getPublicKey();
    }

    /**
     * Subscribe a client to push notifications
     */
    async subscribe(subscription, metadata = {}) {
        this.ensureInitialized();
        try {
            return await this.subscriptionManager.addSubscription(subscription, metadata);
        } catch (error) {
            console.error('Error subscribing client:', error);
            throw error;
        }
    }

    /**
     * Unsubscribe a client from push notifications
     */
    async unsubscribe(subscriptionId) {
        this.ensureInitialized();
        try {
            return await this.subscriptionManager.removeSubscription(subscriptionId);
        } catch (error) {
            console.error('Error unsubscribing client:', error);
            throw error;
        }
    }

    /**
     * Send notification to a specific subscription
     */
    async sendNotification(subscriptionId, notification, options = {}) {
        this.ensureInitialized();
        
        const subscriptionData = this.subscriptionManager.getSubscription(subscriptionId);
        if (!subscriptionData || !subscriptionData.isActive) {
            throw new Error(`Subscription not found or inactive: ${subscriptionId}`);
        }

        return await this.sendNotificationToSubscription(
            subscriptionData.subscription,
            notification,
            options,
            subscriptionId
        );
    }

    /**
     * Send notification to all active subscriptions
     */
    async broadcast(notification, options = {}) {
        this.ensureInitialized();
        
        const activeSubscriptions = this.subscriptionManager.getActiveSubscriptions();
        const results = [];

        console.log(`Broadcasting notification to ${activeSubscriptions.length} subscriptions`);

        for (const subscriptionData of activeSubscriptions) {
            try {
                const result = await this.sendNotificationToSubscription(
                    subscriptionData.subscription,
                    notification,
                    options,
                    subscriptionData.id
                );
                results.push({ subscriptionId: subscriptionData.id, success: true, result });
            } catch (error) {
                console.error(`Failed to send notification to ${subscriptionData.id}:`, error);
                results.push({ subscriptionId: subscriptionData.id, success: false, error: error.message });
                await this.subscriptionManager.markSubscriptionFailed(subscriptionData.id, error);
            }
        }

        return results;
    }

    /**
     * Send notification to subscriptions of a specific user
     */
    async sendToUser(userId, notification, options = {}) {
        this.ensureInitialized();
        
        const userSubscriptions = this.subscriptionManager.getSubscriptionsByUserId(userId);
        const results = [];

        console.log(`Sending notification to user ${userId} (${userSubscriptions.length} subscriptions)`);

        for (const subscriptionData of userSubscriptions) {
            try {
                const result = await this.sendNotificationToSubscription(
                    subscriptionData.subscription,
                    notification,
                    options,
                    subscriptionData.id
                );
                results.push({ subscriptionId: subscriptionData.id, success: true, result });
            } catch (error) {
                console.error(`Failed to send notification to ${subscriptionData.id}:`, error);
                results.push({ subscriptionId: subscriptionData.id, success: false, error: error.message });
                await this.subscriptionManager.markSubscriptionFailed(subscriptionData.id, error);
            }
        }

        return results;
    }

    /**
     * Send notification to a subscription with retry logic
     */
    async sendNotificationToSubscription(subscription, notification, options = {}, subscriptionId = null) {
        const payload = JSON.stringify({
            title: notification.title || 'Kilo Web Notification',
            body: notification.body || '',
            icon: notification.icon || '/icon-192x192.png',
            badge: notification.badge || '/badge-72x72.png',
            data: notification.data || {},
            timestamp: Date.now(),
            ...notification
        });

        const pushOptions = {
            TTL: options.ttl || 24 * 60 * 60, // 24 hours default
            urgency: options.urgency || 'normal',
            ...options
        };

        let lastError;
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                const result = await webpush.sendNotification(subscription, payload, pushOptions);
                
                // Mark subscription as successful if we have the ID
                if (subscriptionId) {
                    await this.subscriptionManager.markSubscriptionSuccess(subscriptionId);
                }
                
                console.log(`Notification sent successfully${subscriptionId ? ` to ${subscriptionId}` : ''} (attempt ${attempt})`);
                return result;
            } catch (error) {
                lastError = error;
                console.error(`Notification attempt ${attempt} failed${subscriptionId ? ` for ${subscriptionId}` : ''}:`, error.message);
                
                // Don't retry for certain errors
                if (error.statusCode === 410 || error.statusCode === 404) {
                    // Subscription is no longer valid
                    if (subscriptionId) {
                        console.log(`Removing invalid subscription: ${subscriptionId}`);
                        await this.subscriptionManager.removeSubscription(subscriptionId);
                    }
                    throw error;
                }
                
                // Wait before retry (except on last attempt)
                if (attempt < this.retryAttempts) {
                    await this.delay(this.retryDelay * attempt);
                }
            }
        }

        // All attempts failed
        if (subscriptionId) {
            await this.subscriptionManager.markSubscriptionFailed(subscriptionId, lastError);
        }
        throw lastError;
    }

    /**
     * Send task completion notification
     */
    async sendTaskCompletionNotification(taskData, options = {}) {
        const notification = {
            title: 'Task Completed',
            body: `Your ${taskData.type || 'task'} has finished processing`,
            icon: '/icon-192x192.png',
            data: {
                type: 'task_completion',
                taskId: taskData.id,
                timestamp: Date.now(),
                ...taskData
            },
            actions: [
                {
                    action: 'view',
                    title: 'View Results'
                },
                {
                    action: 'dismiss',
                    title: 'Dismiss'
                }
            ]
        };

        if (taskData.userId) {
            return await this.sendToUser(taskData.userId, notification, options);
        } else {
            return await this.broadcast(notification, options);
        }
    }

    /**
     * Send error notification
     */
    async sendErrorNotification(errorData, options = {}) {
        const notification = {
            title: 'Task Error',
            body: `An error occurred: ${errorData.message || 'Unknown error'}`,
            icon: '/icon-192x192.png',
            data: {
                type: 'error',
                errorId: errorData.id,
                timestamp: Date.now(),
                ...errorData
            },
            actions: [
                {
                    action: 'retry',
                    title: 'Retry'
                },
                {
                    action: 'dismiss',
                    title: 'Dismiss'
                }
            ]
        };

        if (errorData.userId) {
            return await this.sendToUser(errorData.userId, notification, options);
        } else {
            return await this.broadcast(notification, options);
        }
    }

    /**
     * Get service statistics
     */
    getStats() {
        this.ensureInitialized();
        return {
            isInitialized: this.isInitialized,
            subscriptions: this.subscriptionManager.getStats(),
            publicKey: this.vapidKeyManager.getPublicKey()
        };
    }

    /**
     * Utility method to delay execution
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Ensure service is initialized
     */
    ensureInitialized() {
        if (!this.isInitialized) {
            throw new Error('Push notification service not initialized. Call initialize() first.');
        }
    }

    /**
     * Shutdown the service
     */
    async shutdown() {
        if (this.subscriptionManager) {
            await this.subscriptionManager.shutdown();
        }
        this.isInitialized = false;
        console.log('Push notification service shut down');
    }
}

module.exports = PushNotificationService;