const fs = require('fs-extra');
const path = require('path');

class PushNotificationLogger {
    constructor() {
        this.logDir = path.join(__dirname, '../../logs');
        this.logFile = path.join(this.logDir, 'push-notifications.log');
        this.maxLogSize = 10 * 1024 * 1024; // 10MB
        this.maxLogFiles = 5;
    }

    /**
     * Initialize the logger
     */
    async initialize() {
        try {
            await fs.ensureDir(this.logDir);
            console.log('Push notification logger initialized');
        } catch (error) {
            console.error('Error initializing push notification logger:', error);
        }
    }

    /**
     * Log a push notification event
     */
    async log(level, message, data = null) {
        try {
            const timestamp = new Date().toISOString();
            const logEntry = {
                timestamp,
                level,
                message,
                data
            };

            const logLine = JSON.stringify(logEntry) + '\n';
            
            // Check if log rotation is needed
            await this.rotateLogsIfNeeded();
            
            // Append to log file
            await fs.appendFile(this.logFile, logLine);
        } catch (error) {
            console.error('Error writing to push notification log:', error);
        }
    }

    /**
     * Log info message
     */
    async info(message, data = null) {
        await this.log('INFO', message, data);
    }

    /**
     * Log warning message
     */
    async warn(message, data = null) {
        await this.log('WARN', message, data);
    }

    /**
     * Log error message
     */
    async error(message, data = null) {
        await this.log('ERROR', message, data);
    }

    /**
     * Log debug message
     */
    async debug(message, data = null) {
        if (process.env.NODE_ENV === 'development') {
            await this.log('DEBUG', message, data);
        }
    }

    /**
     * Log notification sent
     */
    async logNotificationSent(subscriptionId, notification, success, error = null) {
        const data = {
            subscriptionId,
            notification: {
                title: notification.title,
                body: notification.body,
                type: notification.data?.type
            },
            success,
            error: error ? error.message : null
        };

        if (success) {
            await this.info('Notification sent successfully', data);
        } else {
            await this.error('Notification failed to send', data);
        }
    }

    /**
     * Log subscription event
     */
    async logSubscription(action, subscriptionId, metadata = null) {
        const data = {
            action, // 'added', 'removed', 'failed', 'reactivated'
            subscriptionId,
            metadata
        };

        await this.info(`Subscription ${action}`, data);
    }

    /**
     * Log service event
     */
    async logServiceEvent(event, data = null) {
        await this.info(`Push service ${event}`, data);
    }

    /**
     * Rotate logs if needed
     */
    async rotateLogsIfNeeded() {
        try {
            if (await fs.pathExists(this.logFile)) {
                const stats = await fs.stat(this.logFile);
                if (stats.size > this.maxLogSize) {
                    await this.rotateLogs();
                }
            }
        } catch (error) {
            console.error('Error checking log rotation:', error);
        }
    }

    /**
     * Rotate log files
     */
    async rotateLogs() {
        try {
            // Move existing log files
            for (let i = this.maxLogFiles - 1; i > 0; i--) {
                const oldFile = `${this.logFile}.${i}`;
                const newFile = `${this.logFile}.${i + 1}`;
                
                if (await fs.pathExists(oldFile)) {
                    if (i === this.maxLogFiles - 1) {
                        // Remove the oldest log file
                        await fs.remove(oldFile);
                    } else {
                        await fs.move(oldFile, newFile);
                    }
                }
            }

            // Move current log to .1
            if (await fs.pathExists(this.logFile)) {
                await fs.move(this.logFile, `${this.logFile}.1`);
            }

            console.log('Push notification logs rotated');
        } catch (error) {
            console.error('Error rotating push notification logs:', error);
        }
    }

    /**
     * Get recent log entries
     */
    async getRecentLogs(lines = 100) {
        try {
            if (!(await fs.pathExists(this.logFile))) {
                return [];
            }

            const content = await fs.readFile(this.logFile, 'utf8');
            const logLines = content.trim().split('\n').filter(line => line.length > 0);
            
            // Get the last N lines
            const recentLines = logLines.slice(-lines);
            
            // Parse JSON entries
            const logs = recentLines.map(line => {
                try {
                    return JSON.parse(line);
                } catch (error) {
                    return { error: 'Failed to parse log entry', line };
                }
            });

            return logs;
        } catch (error) {
            console.error('Error reading recent logs:', error);
            return [];
        }
    }

    /**
     * Get log statistics
     */
    async getLogStats() {
        try {
            const recentLogs = await this.getRecentLogs(1000); // Last 1000 entries
            
            const stats = {
                totalEntries: recentLogs.length,
                byLevel: {},
                byHour: {},
                errors: 0,
                notifications: 0
            };

            recentLogs.forEach(log => {
                // Count by level
                stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
                
                // Count by hour
                const hour = new Date(log.timestamp).getHours();
                stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;
                
                // Count errors and notifications
                if (log.level === 'ERROR') {
                    stats.errors++;
                }
                if (log.message.includes('Notification')) {
                    stats.notifications++;
                }
            });

            return stats;
        } catch (error) {
            console.error('Error getting log statistics:', error);
            return null;
        }
    }
}

module.exports = PushNotificationLogger;