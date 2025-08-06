/**
 * TaskHistoryManager - Core task history and analytics system for kilo-web
 * Handles automatic task tracking, persistence, search, and analytics
 * Based on kilocode's comprehensive task management architecture
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class TaskHistoryManager {
    constructor(workspaceDir, settingsManager) {
        this.workspaceDir = workspaceDir;
        this.settingsManager = settingsManager;
        this.tasksDir = path.join(workspaceDir, '.kilo', 'task-history');
        this.globalTasksDir = path.join(require('os').homedir(), '.kilo', 'task-history');
        
        // In-memory state
        this.activeTasks = new Map(); // Currently active tasks
        this.taskCache = new Map(); // Recently accessed tasks cache
        this.statistics = null;
        this.indexCache = null;
        
        // Event listeners
        this.eventListeners = new Map();
        
        this.initialize();
    }

    async initialize() {
        try {
            // Ensure directories exist
            await this.ensureDirectories();
            
            // Load task index
            await this.loadTaskIndex();
            
            // Generate statistics
            await this.generateStatistics();
            
            console.log('✅ TaskHistoryManager initialized successfully');
        } catch (error) {
            console.error('❌ TaskHistoryManager initialization failed:', error);
            throw error;
        }
    }

    async ensureDirectories() {
        const dirs = [
            this.tasksDir,
            this.globalTasksDir,
            path.join(this.tasksDir, 'index'),
            path.join(this.tasksDir, 'archives'),
            path.join(this.workspaceDir, '.kilo', 'task-exports')
        ];

        for (const dir of dirs) {
            await fs.mkdir(dir, { recursive: true });
        }
    }

    // Task Tracking and Management

    async startTask(initialMessage, mode = 'code', metadata = {}) {
        const taskId = crypto.randomUUID();
        const timestamp = Date.now();
        
        const task = {
            id: taskId,
            title: this.generateTaskTitle(initialMessage),
            mode: mode,
            status: 'in-progress',
            createdAt: timestamp,
            lastModified: timestamp,
            workspace: path.basename(this.workspaceDir),
            category: metadata.category || this.inferCategory(initialMessage, mode),
            tags: metadata.tags || this.generateTags(initialMessage, mode),
            metadata: {
                totalMessages: 0,
                userMessages: 0,
                assistantMessages: 0,
                tokensUsed: 0,
                toolsUsed: [],
                filesModified: [],
                commandsExecuted: 0,
                errorCount: 0,
                startTime: timestamp,
                initialPrompt: initialMessage
            },
            messages: [],
            summary: null,
            archived: false
        };

        // Store in active tasks
        this.activeTasks.set(taskId, task);
        
        // Emit event
        this.emit('taskStarted', { taskId, task });
        
        return taskId;
    }

    async addMessage(taskId, message) {
        const task = this.activeTasks.get(taskId) || await this.loadTask(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        const messageWithId = {
            id: crypto.randomUUID(),
            ...message,
            timestamp: message.timestamp || Date.now()
        };

        // Update task metadata
        task.messages.push(messageWithId);
        task.metadata.totalMessages++;
        
        if (message.type === 'user') {
            task.metadata.userMessages++;
        } else if (message.type === 'assistant') {
            task.metadata.assistantMessages++;
        }

        // Update token count if provided
        if (message.metadata?.tokensEstimate) {
            task.metadata.tokensUsed += message.metadata.tokensEstimate;
        }

        // Track tools used
        if (message.metadata?.tool && !task.metadata.toolsUsed.includes(message.metadata.tool)) {
            task.metadata.toolsUsed.push(message.metadata.tool);
        }

        // Track files modified
        if (message.metadata?.filesModified) {
            const newFiles = message.metadata.filesModified.filter(
                file => !task.metadata.filesModified.includes(file)
            );
            task.metadata.filesModified.push(...newFiles);
        }

        // Track errors
        if (message.type === 'system' && message.content.toLowerCase().includes('error')) {
            task.metadata.errorCount++;
        }

        task.lastModified = Date.now();

        // Update in active tasks
        this.activeTasks.set(taskId, task);
        
        // Auto-save periodically
        if (task.metadata.totalMessages % 5 === 0) {
            await this.saveTask(task);
        }

        this.emit('messageAdded', { taskId, message: messageWithId, task });
        
        return messageWithId.id;
    }

    async completeTask(taskId, summary = null) {
        const task = this.activeTasks.get(taskId) || await this.loadTask(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        const endTime = Date.now();
        task.status = 'completed';
        task.lastModified = endTime;
        task.duration = endTime - task.metadata.startTime;
        task.summary = summary || this.generateSummary(task);

        // Save the completed task
        await this.saveTask(task);
        
        // Remove from active tasks
        this.activeTasks.delete(taskId);
        
        // Update statistics
        await this.generateStatistics();
        
        this.emit('taskCompleted', { taskId, task });
        
        return task;
    }

    async failTask(taskId, error = null) {
        const task = this.activeTasks.get(taskId) || await this.loadTask(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        const endTime = Date.now();
        task.status = 'failed';
        task.lastModified = endTime;
        task.duration = endTime - task.metadata.startTime;
        task.error = error;

        await this.saveTask(task);
        this.activeTasks.delete(taskId);
        await this.generateStatistics();
        
        this.emit('taskFailed', { taskId, task, error });
        
        return task;
    }

    async cancelTask(taskId) {
        const task = this.activeTasks.get(taskId) || await this.loadTask(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        const endTime = Date.now();
        task.status = 'cancelled';
        task.lastModified = endTime;
        task.duration = endTime - task.metadata.startTime;

        await this.saveTask(task);
        this.activeTasks.delete(taskId);
        await this.generateStatistics();
        
        this.emit('taskCancelled', { taskId, task });
        
        return task;
    }

    // Task Persistence

    async saveTask(task) {
        try {
            const taskFile = path.join(this.tasksDir, `${task.id}.json`);
            await fs.writeFile(taskFile, JSON.stringify(task, null, 2));
            
            // Update cache
            this.taskCache.set(task.id, task);
            
            // Update index
            await this.updateTaskIndex(task);
            
            this.emit('taskSaved', { taskId: task.id, task });
        } catch (error) {
            console.error('Error saving task:', error);
            throw error;
        }
    }

    async loadTask(taskId) {
        // Check cache first
        if (this.taskCache.has(taskId)) {
            return this.taskCache.get(taskId);
        }

        try {
            const taskFile = path.join(this.tasksDir, `${taskId}.json`);
            const taskData = await fs.readFile(taskFile, 'utf8');
            const task = JSON.parse(taskData);
            
            // Cache the task
            this.taskCache.set(taskId, task);
            
            return task;
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Error loading task:', error);
            }
            return null;
        }
    }

    async deleteTask(taskId) {
        try {
            const taskFile = path.join(this.tasksDir, `${taskId}.json`);
            await fs.unlink(taskFile);
            
            // Remove from cache
            this.taskCache.delete(taskId);
            this.activeTasks.delete(taskId);
            
            // Update index
            await this.removeFromTaskIndex(taskId);
            
            this.emit('taskDeleted', { taskId });
            
            return true;
        } catch (error) {
            console.error('Error deleting task:', error);
            return false;
        }
    }

    // Task Search and Filtering

    async searchTasks(filters = {}, options = {}) {
        const {
            query = '',
            mode = [],
            status = [],
            dateRange = null,
            workspace = [],
            category = [],
            tags = [],
            hasFiles = null,
            hasErrors = null,
            minDuration = null,
            maxDuration = null,
            minMessages = null,
            maxMessages = null
        } = filters;

        const {
            sortBy = 'lastModified',
            sortOrder = 'desc',
            limit = 100,
            offset = 0
        } = options;

        try {
            const allTasks = await this.getAllTasks();
            
            let filteredTasks = allTasks.filter(task => {
                // Text search
                if (query) {
                    const searchText = `${task.title} ${task.summary || ''} ${task.messages.map(m => m.content).join(' ')}`.toLowerCase();
                    if (!searchText.includes(query.toLowerCase())) {
                        return false;
                    }
                }

                // Mode filter
                if (mode.length > 0 && !mode.includes(task.mode)) {
                    return false;
                }

                // Status filter
                if (status.length > 0 && !status.includes(task.status)) {
                    return false;
                }

                // Date range filter
                if (dateRange) {
                    if (task.createdAt < dateRange.start || task.createdAt > dateRange.end) {
                        return false;
                    }
                }

                // Workspace filter
                if (workspace.length > 0 && !workspace.includes(task.workspace)) {
                    return false;
                }

                // Category filter
                if (category.length > 0 && !category.includes(task.category)) {
                    return false;
                }

                // Tags filter
                if (tags.length > 0) {
                    const taskTags = task.tags || [];
                    if (!tags.some(tag => taskTags.includes(tag))) {
                        return false;
                    }
                }

                // Files filter
                if (hasFiles !== null) {
                    const hasModifiedFiles = task.metadata.filesModified && task.metadata.filesModified.length > 0;
                    if (hasFiles !== hasModifiedFiles) {
                        return false;
                    }
                }

                // Errors filter
                if (hasErrors !== null) {
                    const hasTaskErrors = task.metadata.errorCount > 0;
                    if (hasErrors !== hasTaskErrors) {
                        return false;
                    }
                }

                // Duration filters
                if (minDuration !== null && (!task.duration || task.duration < minDuration)) {
                    return false;
                }
                if (maxDuration !== null && task.duration && task.duration > maxDuration) {
                    return false;
                }

                // Message count filters
                if (minMessages !== null && task.metadata.totalMessages < minMessages) {
                    return false;
                }
                if (maxMessages !== null && task.metadata.totalMessages > maxMessages) {
                    return false;
                }

                return true;
            });

            // Sort results
            filteredTasks.sort((a, b) => {
                let aVal = a[sortBy];
                let bVal = b[sortBy];

                // Handle nested properties
                if (sortBy.includes('.')) {
                    const keys = sortBy.split('.');
                    aVal = keys.reduce((obj, key) => obj?.[key], a);
                    bVal = keys.reduce((obj, key) => obj?.[key], b);
                }

                if (sortOrder === 'asc') {
                    return aVal > bVal ? 1 : -1;
                } else {
                    return aVal < bVal ? 1 : -1;
                }
            });

            // Apply pagination
            const totalCount = filteredTasks.length;
            const paginatedTasks = filteredTasks.slice(offset, offset + limit);

            return {
                tasks: paginatedTasks,
                totalCount,
                hasMore: offset + limit < totalCount,
                searchTime: Date.now() - Date.now() // Would be actual search time
            };
        } catch (error) {
            console.error('Error searching tasks:', error);
            throw error;
        }
    }

    async getAllTasks() {
        try {
            const files = await fs.readdir(this.tasksDir);
            const taskFiles = files.filter(file => file.endsWith('.json') && file !== 'index.json');
            
            const tasks = [];
            for (const file of taskFiles) {
                try {
                    const taskData = await fs.readFile(path.join(this.tasksDir, file), 'utf8');
                    const task = JSON.parse(taskData);
                    tasks.push(task);
                } catch (error) {
                    console.warn(`Error loading task file ${file}:`, error.message);
                }
            }
            
            return tasks;
        } catch (error) {
            console.error('Error getting all tasks:', error);
            return [];
        }
    }

    // Statistics and Analytics

    async generateStatistics() {
        try {
            const allTasks = await this.getAllTasks();
            
            const stats = {
                total: allTasks.length,
                byStatus: {},
                byMode: {},
                byWorkspace: {},
                totalMessages: 0,
                totalTokens: 0,
                totalDuration: 0,
                averageDuration: 0,
                mostUsedTools: [],
                recentActivity: [],
                completionRate: 0
            };

            // Calculate basic statistics
            allTasks.forEach(task => {
                // Status distribution
                stats.byStatus[task.status] = (stats.byStatus[task.status] || 0) + 1;
                
                // Mode distribution
                stats.byMode[task.mode] = (stats.byMode[task.mode] || 0) + 1;
                
                // Workspace distribution
                if (task.workspace) {
                    stats.byWorkspace[task.workspace] = (stats.byWorkspace[task.workspace] || 0) + 1;
                }

                // Aggregate metrics
                stats.totalMessages += task.metadata.totalMessages;
                stats.totalTokens += task.metadata.tokensUsed || 0;
                if (task.duration) {
                    stats.totalDuration += task.duration;
                }
            });

            // Calculate averages
            if (allTasks.length > 0) {
                stats.averageDuration = stats.totalDuration / allTasks.length;
                stats.completionRate = (stats.byStatus.completed || 0) / allTasks.length;
            }

            // Calculate most used tools
            const toolUsage = {};
            allTasks.forEach(task => {
                task.metadata.toolsUsed?.forEach(tool => {
                    toolUsage[tool] = (toolUsage[tool] || 0) + 1;
                });
            });

            stats.mostUsedTools = Object.entries(toolUsage)
                .map(([tool, count]) => ({ tool, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);

            // Calculate recent activity (last 30 days)
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            const recentTasks = allTasks.filter(task => task.createdAt > thirtyDaysAgo);
            
            const dailyActivity = {};
            recentTasks.forEach(task => {
                const date = new Date(task.createdAt).toDateString();
                dailyActivity[date] = (dailyActivity[date] || 0) + 1;
            });

            stats.recentActivity = Object.entries(dailyActivity)
                .map(([date, count]) => ({ date, count }))
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            this.statistics = stats;
            return stats;
        } catch (error) {
            console.error('Error generating statistics:', error);
            return null;
        }
    }

    // Batch Operations

    async executeBatchOperation(operation) {
        const { type, taskIds, params = {} } = operation;
        const results = [];

        for (const taskId of taskIds) {
            try {
                let result;
                switch (type) {
                    case 'delete':
                        result = await this.deleteTask(taskId);
                        break;
                    case 'archive':
                        result = await this.archiveTask(taskId, true);
                        break;
                    case 'unarchive':
                        result = await this.archiveTask(taskId, false);
                        break;
                    case 'tag':
                        result = await this.tagTask(taskId, params.tags);
                        break;
                    case 'categorize':
                        result = await this.categorizeTask(taskId, params.category);
                        break;
                    default:
                        throw new Error(`Unknown batch operation: ${type}`);
                }
                results.push({ taskId, success: true, result });
            } catch (error) {
                results.push({ taskId, success: false, error: error.message });
            }
        }

        this.emit('batchOperationCompleted', { operation, results });
        return results;
    }

    async archiveTask(taskId, archived = true) {
        const task = await this.loadTask(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        task.archived = archived;
        task.lastModified = Date.now();
        
        await this.saveTask(task);
        return task;
    }

    async tagTask(taskId, tags) {
        const task = await this.loadTask(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        task.tags = [...new Set([...(task.tags || []), ...tags])];
        task.lastModified = Date.now();
        
        await this.saveTask(task);
        return task;
    }

    async categorizeTask(taskId, category) {
        const task = await this.loadTask(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        task.category = category;
        task.lastModified = Date.now();
        
        await this.saveTask(task);
        return task;
    }

    // Export and Import

    async exportTasks(options = {}) {
        const {
            format = 'json',
            taskIds = null,
            filters = {}
        } = options;

        try {
            let tasks;
            if (taskIds) {
                tasks = await Promise.all(taskIds.map(id => this.loadTask(id)));
                tasks = tasks.filter(Boolean);
            } else {
                const searchResult = await this.searchTasks(filters, { limit: 10000 });
                tasks = searchResult.tasks;
            }

            const exportData = {
                version: '1.0.0',
                exportedAt: Date.now(),
                tasks,
                metadata: {
                    totalTasks: tasks.length,
                    dateRange: {
                        start: Math.min(...tasks.map(t => t.createdAt)),
                        end: Math.max(...tasks.map(t => t.lastModified))
                    },
                    filters
                }
            };

            switch (format) {
                case 'json':
                    return JSON.stringify(exportData, null, 2);
                case 'csv':
                    return this.exportToCSV(tasks);
                case 'markdown':
                    return this.exportToMarkdown(tasks);
                default:
                    throw new Error(`Unsupported export format: ${format}`);
            }
        } catch (error) {
            console.error('Error exporting tasks:', error);
            throw error;
        }
    }

    // Helper Methods

    generateTaskTitle(initialMessage) {
        // Extract meaningful title from initial message
        const words = initialMessage.trim().split(/\s+/).slice(0, 8);
        let title = words.join(' ');
        
        if (title.length > 50) {
            title = title.substring(0, 47) + '...';
        }
        
        return title || 'Untitled Task';
    }

    inferCategory(message, mode) {
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('bug') || lowerMessage.includes('error') || lowerMessage.includes('fix')) {
            return 'debugging';
        } else if (lowerMessage.includes('test') || lowerMessage.includes('spec')) {
            return 'testing';
        } else if (lowerMessage.includes('refactor') || lowerMessage.includes('improve')) {
            return 'refactoring';
        } else if (lowerMessage.includes('feature') || lowerMessage.includes('add') || lowerMessage.includes('implement')) {
            return 'feature';
        } else if (lowerMessage.includes('document') || lowerMessage.includes('readme')) {
            return 'documentation';
        } else {
            return mode;
        }
    }

    generateTags(message, mode) {
        const tags = [mode];
        const lowerMessage = message.toLowerCase();
        
        // Technology tags
        const techs = ['react', 'typescript', 'javascript', 'python', 'node', 'api', 'database', 'css', 'html'];
        techs.forEach(tech => {
            if (lowerMessage.includes(tech)) {
                tags.push(tech);
            }
        });
        
        // Action tags
        if (lowerMessage.includes('create') || lowerMessage.includes('build')) {
            tags.push('creation');
        }
        if (lowerMessage.includes('fix') || lowerMessage.includes('debug')) {
            tags.push('debugging');
        }
        if (lowerMessage.includes('optimize') || lowerMessage.includes('improve')) {
            tags.push('optimization');
        }
        
        return [...new Set(tags)];
    }

    generateSummary(task) {
        if (task.messages.length === 0) {
            return 'No messages in task';
        }

        const firstUserMessage = task.messages.find(m => m.type === 'user');
        const lastAssistantMessage = task.messages.filter(m => m.type === 'assistant').pop();
        
        let summary = '';
        if (firstUserMessage) {
            summary += `Started with: "${firstUserMessage.content.substring(0, 100)}..."`;
        }
        
        if (lastAssistantMessage) {
            summary += ` Ended with: "${lastAssistantMessage.content.substring(0, 100)}..."`;
        }
        
        return summary;
    }

    async loadTaskIndex() {
        try {
            const indexFile = path.join(this.tasksDir, 'index.json');
            const indexData = await fs.readFile(indexFile, 'utf8');
            this.indexCache = JSON.parse(indexData);
        } catch (error) {
            // Create new index if doesn't exist
            this.indexCache = {
                tasks: {},
                categories: new Set(),
                tags: new Set(),
                workspaces: new Set(),
                lastUpdated: Date.now()
            };
        }
    }

    async updateTaskIndex(task) {
        if (!this.indexCache) {
            await this.loadTaskIndex();
        }

        // Update task entry
        this.indexCache.tasks[task.id] = {
            id: task.id,
            title: task.title,
            mode: task.mode,
            status: task.status,
            createdAt: task.createdAt,
            lastModified: task.lastModified,
            category: task.category,
            tags: task.tags || [],
            workspace: task.workspace
        };

        // Update collections
        if (task.category) this.indexCache.categories.add(task.category);
        if (task.tags) task.tags.forEach(tag => this.indexCache.tags.add(tag));
        if (task.workspace) this.indexCache.workspaces.add(task.workspace);

        this.indexCache.lastUpdated = Date.now();

        // Convert Sets to Arrays for JSON serialization
        const indexToSave = {
            ...this.indexCache,
            categories: Array.from(this.indexCache.categories),
            tags: Array.from(this.indexCache.tags),
            workspaces: Array.from(this.indexCache.workspaces)
        };

        const indexFile = path.join(this.tasksDir, 'index.json');
        await fs.writeFile(indexFile, JSON.stringify(indexToSave, null, 2));
    }

    async removeFromTaskIndex(taskId) {
        if (!this.indexCache) {
            await this.loadTaskIndex();
        }

        delete this.indexCache.tasks[taskId];
        this.indexCache.lastUpdated = Date.now();

        const indexToSave = {
            ...this.indexCache,
            categories: Array.from(this.indexCache.categories),
            tags: Array.from(this.indexCache.tags),
            workspaces: Array.from(this.indexCache.workspaces)
        };

        const indexFile = path.join(this.tasksDir, 'index.json');
        await fs.writeFile(indexFile, JSON.stringify(indexToSave, null, 2));
    }

    exportToCSV(tasks) {
        const headers = [
            'ID', 'Title', 'Mode', 'Status', 'Created', 'Duration', 
            'Messages', 'Tokens', 'Files Modified', 'Tools Used', 'Category', 'Tags'
        ];
        
        const rows = tasks.map(task => [
            task.id,
            `"${task.title.replace(/"/g, '""')}"`,
            task.mode,
            task.status,
            new Date(task.createdAt).toISOString(),
            task.duration || 0,
            task.metadata.totalMessages,
            task.metadata.tokensUsed || 0,
            task.metadata.filesModified?.length || 0,
            `"${(task.metadata.toolsUsed || []).join(', ')}"`,
            task.category || '',
            `"${(task.tags || []).join(', ')}"`
        ]);
        
        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    exportToMarkdown(tasks) {
        let markdown = '# Task History Export\n\n';
        markdown += `Exported ${tasks.length} tasks on ${new Date().toISOString()}\n\n`;
        
        tasks.forEach(task => {
            markdown += `## ${task.title}\n\n`;
            markdown += `- **ID:** ${task.id}\n`;
            markdown += `- **Mode:** ${task.mode}\n`;
            markdown += `- **Status:** ${task.status}\n`;
            markdown += `- **Created:** ${new Date(task.createdAt).toISOString()}\n`;
            if (task.duration) {
                markdown += `- **Duration:** ${Math.round(task.duration / 1000)}s\n`;
            }
            markdown += `- **Messages:** ${task.metadata.totalMessages}\n`;
            if (task.metadata.tokensUsed) {
                markdown += `- **Tokens:** ${task.metadata.tokensUsed}\n`;
            }
            if (task.category) {
                markdown += `- **Category:** ${task.category}\n`;
            }
            if (task.tags && task.tags.length > 0) {
                markdown += `- **Tags:** ${task.tags.join(', ')}\n`;
            }
            markdown += '\n';
            
            if (task.summary) {
                markdown += `**Summary:** ${task.summary}\n\n`;
            }
            
            markdown += '---\n\n';
        });
        
        return markdown;
    }

    // Event System

    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            const index = listeners.indexOf(callback);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in task history event listener for ${event}:`, error);
                }
            });
        }
    }

    // Public API

    getStatistics() {
        return this.statistics;
    }

    getActiveTasks() {
        return Array.from(this.activeTasks.values());
    }

    async getTaskById(taskId) {
        return this.activeTasks.get(taskId) || await this.loadTask(taskId);
    }

    async cleanup() {
        // Clear caches
        this.taskCache.clear();
        this.activeTasks.clear();
        
        // Save any pending tasks
        for (const task of this.activeTasks.values()) {
            await this.saveTask(task);
        }
    }
}

module.exports = TaskHistoryManager;