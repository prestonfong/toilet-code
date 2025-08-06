/**
 * Context Management System for Kilo-Web
 * Handles intelligent context window management, relevance scoring, and optimization
 */

const fs = require('fs').promises;
const path = require('path');

class ContextManager {
  static DEFAULT_SETTINGS = {
    autoCondenseContext: true,
    autoCondenseContextPercent: 50,
    maxOpenTabsContext: 5,
    maxWorkspaceFiles: 200,
    showRooIgnoredFiles: false,
    maxReadFileLine: 1000,
    maxConcurrentFileReads: 3,
    allowVeryLargeReads: false,
    fuzzyMatchThreshold: 1.0,
    writeDelayMs: 100,
    includeDiagnosticMessages: true,
    maxDiagnosticMessages: 10,
    contextWindowSize: 200000,
    relevanceThreshold: 0.3,
    cacheTimeout: 300000, // 5 minutes
    smartPruningEnabled: true,
    multiFileStrategy: 'prioritized'
  };

  constructor(workspaceDir = './') {
    this.workspaceDir = workspaceDir;
    this.settings = { ...ContextManager.DEFAULT_SETTINGS };
    this.contextCache = new Map();
    this.relevanceScores = new Map();
    this.fileAccessCount = new Map();
    this.lastAccessTime = new Map();
    this.contextWindow = [];
    this.contextSize = 0;
    this.diagnostics = [];
  }

  /**
   * Initialize the context manager
   */
  async initialize(settings = {}) {
    this.settings = { ...ContextManager.DEFAULT_SETTINGS, ...settings };
    this.startCacheCleanup();
    console.log('✅ Context Manager initialized');
  }

  /**
   * Add content to context window
   */
  async addToContext(content, metadata = {}) {
    const contextItem = {
      id: this.generateId(),
      content,
      metadata: {
        ...metadata,
        timestamp: Date.now(),
        size: this.calculateContentSize(content),
        type: metadata.type || 'text'
      }
    };

    // Calculate relevance score
    contextItem.relevanceScore = this.calculateRelevanceScore(contextItem);
    
    // Add to context window
    this.contextWindow.push(contextItem);
    this.contextSize += contextItem.metadata.size;

    // Check if condensing is needed
    if (this.shouldCondenseContext()) {
      await this.condenseContext();
    }

    // Update access tracking
    this.updateAccessTracking(contextItem);
    
    return contextItem.id;
  }

  /**
   * Remove item from context
   */
  removeFromContext(itemId) {
    const index = this.contextWindow.findIndex(item => item.id === itemId);
    if (index !== -1) {
      const item = this.contextWindow[index];
      this.contextSize -= item.metadata.size;
      this.contextWindow.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get current context window
   */
  getContextWindow() {
    return {
      items: this.contextWindow,
      totalSize: this.contextSize,
      itemCount: this.contextWindow.length,
      relevanceScores: this.contextWindow.map(item => ({
        id: item.id,
        score: item.relevanceScore,
        type: item.metadata.type
      }))
    };
  }

  /**
   * Smart context pruning based on relevance and usage
   */
  async pruneContext(targetSize) {
    if (!this.settings.smartPruningEnabled) {
      return this.basicPruneContext(targetSize);
    }

    const itemsToRemove = [];
    let currentSize = this.contextSize;

    // Sort by relevance score (ascending - remove least relevant first)
    const sortedItems = [...this.contextWindow].sort((a, b) => {
      // Consider both relevance score and recency
      const scoreA = a.relevanceScore * this.getRecencyMultiplier(a);
      const scoreB = b.relevanceScore * this.getRecencyMultiplier(b);
      return scoreA - scoreB;
    });

    for (const item of sortedItems) {
      if (currentSize <= targetSize) break;
      
      // Don't remove critical items
      if (item.metadata.critical || item.relevanceScore > 0.8) continue;
      
      itemsToRemove.push(item.id);
      currentSize -= item.metadata.size;
    }

    // Remove selected items
    for (const itemId of itemsToRemove) {
      this.removeFromContext(itemId);
    }

    return {
      removedItems: itemsToRemove.length,
      newSize: this.contextSize,
      targetReached: this.contextSize <= targetSize
    };
  }

  /**
   * Basic context pruning (FIFO)
   */
  basicPruneContext(targetSize) {
    const itemsToRemove = [];
    let currentSize = this.contextSize;

    while (currentSize > targetSize && this.contextWindow.length > 0) {
      const oldestItem = this.contextWindow[0];
      itemsToRemove.push(oldestItem.id);
      currentSize -= oldestItem.metadata.size;
      this.contextWindow.shift();
      this.contextSize -= oldestItem.metadata.size;
    }

    return {
      removedItems: itemsToRemove.length,
      newSize: this.contextSize,
      targetReached: this.contextSize <= targetSize
    };
  }

  /**
   * Condense context when it gets too large
   */
  async condenseContext() {
    const targetSize = Math.floor(
      this.settings.contextWindowSize * (this.settings.autoCondenseContextPercent / 100)
    );

    const result = await this.pruneContext(targetSize);
    
    if (this.settings.includeDiagnosticMessages) {
      this.addDiagnostic(`Context condensed: removed ${result.removedItems} items, new size: ${result.newSize}`);
    }

    return result;
  }

  /**
   * Calculate relevance score for content
   */
  calculateRelevanceScore(contextItem) {
    let score = 0.5; // Base score
    const { content, metadata } = contextItem;

    // Type-based scoring
    const typeScores = {
      'file': 0.7,
      'error': 0.9,
      'command': 0.6,
      'output': 0.4,
      'diagnostic': 0.8,
      'user_input': 0.9
    };
    score += (typeScores[metadata.type] || 0.5) * 0.3;

    // Content-based scoring
    if (typeof content === 'string') {
      // Higher score for code-like content
      if (this.isCodeContent(content)) score += 0.2;
      
      // Higher score for error messages
      if (this.containsErrors(content)) score += 0.3;
      
      // Score based on content length (sweet spot around 100-1000 chars)
      const lengthScore = this.calculateLengthScore(content.length);
      score += lengthScore * 0.2;
    }

    // Recency bonus
    const recencyScore = this.getRecencyMultiplier(contextItem);
    score *= recencyScore;

    // Access frequency bonus
    const accessFrequency = this.fileAccessCount.get(metadata.filePath) || 0;
    score += Math.min(accessFrequency * 0.1, 0.3);

    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * Check if content should trigger condensing
   */
  shouldCondenseContext() {
    if (!this.settings.autoCondenseContext) return false;
    return this.contextSize > this.settings.contextWindowSize;
  }

  /**
   * Multi-file context strategy
   */
  async optimizeMultiFileContext(files) {
    const strategy = this.settings.multiFileStrategy;
    
    switch (strategy) {
      case 'prioritized':
        return this.prioritizedFileStrategy(files);
      case 'distributed':
        return this.distributedFileStrategy(files);
      case 'focused':
        return this.focusedFileStrategy(files);
      default:
        return this.prioritizedFileStrategy(files);
    }
  }

  /**
   * Prioritized file strategy - focus on most relevant files
   */
  async prioritizedFileStrategy(files) {
    const scoredFiles = files.map(file => ({
      ...file,
      priority: this.calculateFilePriority(file)
    })).sort((a, b) => b.priority - a.priority);

    const selectedFiles = [];
    let totalSize = 0;

    for (const file of scoredFiles) {
      const estimatedSize = file.size || 0;
      if (totalSize + estimatedSize <= this.settings.contextWindowSize * 0.8) {
        selectedFiles.push(file);
        totalSize += estimatedSize;
      } else {
        break;
      }
    }

    return selectedFiles;
  }

  /**
   * Calculate file priority for context inclusion
   */
  calculateFilePriority(file) {
    let priority = 0.5;
    
    // File extension priority
    const extPriorities = {
      '.js': 0.9, '.ts': 0.9, '.jsx': 0.9, '.tsx': 0.9,
      '.py': 0.8, '.java': 0.8, '.cpp': 0.8, '.c': 0.8,
      '.json': 0.7, '.yaml': 0.7, '.yml': 0.7,
      '.md': 0.6, '.txt': 0.5,
      '.log': 0.3
    };
    
    const ext = path.extname(file.path || '').toLowerCase();
    priority += (extPriorities[ext] || 0.4) * 0.3;

    // Recently modified files get higher priority
    if (file.lastModified) {
      const age = Date.now() - file.lastModified;
      const ageScore = Math.max(0, 1 - (age / (24 * 60 * 60 * 1000))); // Last 24 hours
      priority += ageScore * 0.2;
    }

    // Access frequency
    const accessCount = this.fileAccessCount.get(file.path) || 0;
    priority += Math.min(accessCount * 0.05, 0.2);

    // Size penalty for very large files
    if (file.size > 10000) {
      priority -= Math.min((file.size - 10000) / 100000, 0.3);
    }

    return Math.min(Math.max(priority, 0), 1);
  }

  /**
   * Cache management
   */
  cacheContext(key, context) {
    this.contextCache.set(key, {
      context,
      timestamp: Date.now(),
      size: this.calculateContentSize(context)
    });
  }

  getCachedContext(key) {
    const cached = this.contextCache.get(key);
    if (!cached) return null;
    
    // Check if cache is still valid
    if (Date.now() - cached.timestamp > this.settings.cacheTimeout) {
      this.contextCache.delete(key);
      return null;
    }
    
    return cached.context;
  }

  /**
   * Context monitoring and analytics
   */
  getContextAnalytics() {
    const analytics = {
      currentContextSize: this.contextSize,
      maxContextSize: this.settings.contextWindowSize,
      utilizationPercent: (this.contextSize / this.settings.contextWindowSize) * 100,
      itemCount: this.contextWindow.length,
      averageRelevanceScore: this.calculateAverageRelevance(),
      cacheHitRate: this.calculateCacheHitRate(),
      topFileTypes: this.getTopFileTypes(),
      recentActivity: this.getRecentActivity()
    };

    return analytics;
  }

  /**
   * Real-time context monitoring
   */
  startRealTimeMonitoring(callback) {
    this.monitoringCallback = callback;
    this.monitoringInterval = setInterval(() => {
      if (this.monitoringCallback) {
        this.monitoringCallback(this.getContextAnalytics());
      }
    }, 5000); // Update every 5 seconds
  }

  stopRealTimeMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.monitoringCallback = null;
  }

  /**
   * Helper methods
   */
  generateId() {
    return `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  calculateContentSize(content) {
    if (typeof content === 'string') {
      return new Blob([content]).size;
    }
    return JSON.stringify(content).length;
  }

  isCodeContent(content) {
    const codeIndicators = [
      /function\s+\w+\s*\(/,
      /class\s+\w+/,
      /import\s+.*from/,
      /const\s+\w+\s*=/,
      /def\s+\w+\s*\(/,
      /{[\s\S]*}/
    ];
    return codeIndicators.some(pattern => pattern.test(content));
  }

  containsErrors(content) {
    const errorIndicators = [
      /error/i, /exception/i, /failed/i, /cannot/i, /unable/i
    ];
    return errorIndicators.some(pattern => pattern.test(content));
  }

  calculateLengthScore(length) {
    if (length < 50) return 0.2;
    if (length < 200) return 0.6;
    if (length < 1000) return 1.0;
    if (length < 5000) return 0.8;
    return 0.4;
  }

  getRecencyMultiplier(contextItem) {
    const age = Date.now() - contextItem.metadata.timestamp;
    const hoursSinceCreation = age / (1000 * 60 * 60);
    return Math.max(0.3, 1 - (hoursSinceCreation / 24));
  }

  updateAccessTracking(contextItem) {
    const filePath = contextItem.metadata.filePath;
    if (filePath) {
      this.fileAccessCount.set(filePath, (this.fileAccessCount.get(filePath) || 0) + 1);
      this.lastAccessTime.set(filePath, Date.now());
    }
  }

  addDiagnostic(message) {
    this.diagnostics.push({
      timestamp: Date.now(),
      message,
      level: 'info'
    });

    // Keep only recent diagnostics
    if (this.diagnostics.length > this.settings.maxDiagnosticMessages) {
      this.diagnostics = this.diagnostics.slice(-this.settings.maxDiagnosticMessages);
    }
  }

  calculateAverageRelevance() {
    if (this.contextWindow.length === 0) return 0;
    const total = this.contextWindow.reduce((sum, item) => sum + item.relevanceScore, 0);
    return total / this.contextWindow.length;
  }

  calculateCacheHitRate() {
    // This would track cache hits vs misses in a real implementation
    return 0.75; // Placeholder
  }

  getTopFileTypes() {
    const typeCount = {};
    this.contextWindow.forEach(item => {
      const type = item.metadata.type || 'unknown';
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    
    return Object.entries(typeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));
  }

  getRecentActivity() {
    const recentThreshold = Date.now() - (5 * 60 * 1000); // Last 5 minutes
    return this.contextWindow.filter(item => 
      item.metadata.timestamp > recentThreshold
    ).length;
  }

  startCacheCleanup() {
    // Clean up expired cache entries every 5 minutes
    this.cacheCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, cached] of this.contextCache.entries()) {
        if (now - cached.timestamp > this.settings.cacheTimeout) {
          this.contextCache.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
    }
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this.contextCache.clear();
    this.relevanceScores.clear();
    this.fileAccessCount.clear();
    this.lastAccessTime.clear();
  }
}

module.exports = ContextManager;