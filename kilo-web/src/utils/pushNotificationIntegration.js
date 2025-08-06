/**
 * Integration utilities for push notifications with WebSocket system
 */

class PushNotificationIntegration {
    constructor(pushService) {
        this.pushService = pushService;
    }

    /**
     * Send task completion notification via push notifications
     * This can be called when a WebSocket task completes
     */
    async notifyTaskCompletion(taskData) {
        try {
            if (!this.pushService || !this.pushService.isInitialized) {
                console.log('Push service not available, skipping push notification');
                return;
            }

            const results = await this.pushService.sendTaskCompletionNotification(taskData);
            console.log(`Task completion notification sent to ${results.filter(r => r.success).length} clients`);
            return results;
        } catch (error) {
            console.error('Error sending task completion push notification:', error);
        }
    }

    /**
     * Send error notification via push notifications
     */
    async notifyError(errorData) {
        try {
            if (!this.pushService || !this.pushService.isInitialized) {
                console.log('Push service not available, skipping push notification');
                return;
            }

            const results = await this.pushService.sendErrorNotification(errorData);
            console.log(`Error notification sent to ${results.filter(r => r.success).length} clients`);
            return results;
        } catch (error) {
            console.error('Error sending error push notification:', error);
        }
    }

    /**
     * Send custom notification
     */
    async sendCustomNotification(notification, userId = null) {
        try {
            if (!this.pushService || !this.pushService.isInitialized) {
                console.log('Push service not available, skipping push notification');
                return;
            }

            const results = userId 
                ? await this.pushService.sendToUser(userId, notification)
                : await this.pushService.broadcast(notification);
            
            console.log(`Custom notification sent to ${results.filter(r => r.success).length} clients`);
            return results;
        } catch (error) {
            console.error('Error sending custom push notification:', error);
        }
    }

    /**
     * Enhanced WebSocket message handler that also sends push notifications
     * Call this function in your WebSocket message handlers to add push notification support
     */
    async handleWebSocketMessage(ws, message, pushNotificationData = null) {
        // Process the WebSocket message normally first
        // ... your existing WebSocket logic here ...

        // If push notification data is provided, send a push notification
        if (pushNotificationData && this.pushService && this.pushService.isInitialized) {
            try {
                await this.sendCustomNotification(
                    pushNotificationData.notification,
                    pushNotificationData.userId
                );
            } catch (error) {
                console.error('Error sending push notification for WebSocket message:', error);
            }
        }
    }

    /**
     * Utility to create notification data from task results
     */
    createTaskNotificationData(taskType, taskResult, userId = null) {
        const isSuccess = !taskResult.error;
        
        return {
            notification: {
                title: isSuccess ? 'Task Completed' : 'Task Failed',
                body: isSuccess 
                    ? `Your ${taskType} task has completed successfully`
                    : `Your ${taskType} task failed: ${taskResult.error}`,
                icon: '/icon-192x192.png',
                data: {
                    type: isSuccess ? 'task_completion' : 'task_error',
                    taskType,
                    taskResult,
                    timestamp: Date.now()
                },
                actions: isSuccess ? [
                    { action: 'view', title: 'View Results' },
                    { action: 'dismiss', title: 'Dismiss' }
                ] : [
                    { action: 'retry', title: 'Retry' },
                    { action: 'dismiss', title: 'Dismiss' }
                ]
            },
            userId
        };
    }
}

module.exports = PushNotificationIntegration;