/**
 * Checkpoint Management System for Kilo-Web
 * Handles automatic checkpoint creation, git integration, and state restoration
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const crypto = require('crypto');

const execAsync = promisify(exec);

class CheckpointManager {
  static DEFAULT_SETTINGS = {
    enableCheckpoints: true,
    diffEnabled: true,
    autoCheckpointInterval: 300000, // 5 minutes
    maxCheckpoints: 100,
    checkpointOnFileChange: true,
    checkpointOnCommand: true,
    gitIntegrationEnabled: true,
    smartTiming: true,
    retentionDays: 30,
    compressionEnabled: true,
    backupDirectory: '.kilo/checkpoints',
    includePatterns: ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx', '**/*.json', '**/*.md'],
    excludePatterns: ['node_modules/**', '.git/**', '*.log', 'dist/**', 'build/**'],
    autoCleanup: true,
    diffViewerEnabled: true
  };

  constructor(workspaceDir = './') {
    this.workspaceDir = workspaceDir;
    this.settings = { ...CheckpointManager.DEFAULT_SETTINGS };
    this.checkpoints = new Map();
    this.lastCheckpointTime = 0;
    this.fileWatchers = new Map();
    this.activityBuffer = [];
    this.checkpointQueue = [];
    this.isProcessing = false;
    this.stats = {
      totalCheckpoints: 0,
      autoCheckpoints: 0,
      manualCheckpoints: 0,
      restorations: 0,
      cleanups: 0
    };
  }

  /**
   * Initialize the checkpoint manager
   */
  async initialize(settings = {}) {
    this.settings = { ...CheckpointManager.DEFAULT_SETTINGS, ...settings };
    
    await this.ensureCheckpointDirectory();
    await this.loadExistingCheckpoints();
    
    if (this.settings.enableCheckpoints) {
      await this.startAutomaticCheckpoints();
      await this.setupFileWatching();
    }
    
    if (this.settings.autoCleanup) {
      this.startCleanupScheduler();
    }

    console.log('✅ Checkpoint Manager initialized');
  }

  /**
   * Create a new checkpoint
   */
  async createCheckpoint(options = {}) {
    const checkpointId = this.generateCheckpointId();
    const timestamp = Date.now();
    
    const checkpoint = {
      id: checkpointId,
      timestamp,
      type: options.type || 'manual',
      description: options.description || 'Manual checkpoint',
      author: options.author || 'system',
      tags: options.tags || [],
      metadata: {
        workspaceDir: this.workspaceDir,
        nodeVersion: process.version,
        platform: process.platform,
        ...options.metadata
      }
    };

    try {
      // Capture current state
      checkpoint.state = await this.captureWorkspaceState();
      
      // Create git commit if enabled
      if (this.settings.gitIntegrationEnabled) {
        checkpoint.gitCommit = await this.createGitCommit(checkpoint);
      }
      
      // Save checkpoint data
      await this.saveCheckpoint(checkpoint);
      
      // Update tracking
      this.checkpoints.set(checkpointId, checkpoint);
      this.stats.totalCheckpoints++;
      if (checkpoint.type === 'auto') {
        this.stats.autoCheckpoints++;
      } else {
        this.stats.manualCheckpoints++;
      }
      
      // Cleanup old checkpoints if needed
      if (this.settings.autoCleanup) {
        await this.cleanupOldCheckpoints();
      }
      
      console.log(`📸 Checkpoint created: ${checkpointId} (${checkpoint.description})`);
      return checkpoint;
      
    } catch (error) {
      console.error('Failed to create checkpoint:', error);
      throw error;
    }
  }

  /**
   * Restore from a checkpoint
   */
  async restoreCheckpoint(checkpointId, options = {}) {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }

    try {
      // Create backup of current state before restoration
      if (options.createBackup !== false) {
        await this.createCheckpoint({
          type: 'backup',
          description: `Backup before restoring ${checkpointId}`,
          tags: ['pre-restore', 'backup']
        });
      }

      // Git-based restoration
      if (checkpoint.gitCommit && this.settings.gitIntegrationEnabled) {
        await this.restoreFromGit(checkpoint.gitCommit);
      } else {
        // File-based restoration
        await this.restoreWorkspaceState(checkpoint.state);
      }

      this.stats.restorations++;
      console.log(`🔄 Restored from checkpoint: ${checkpointId}`);
      
      return {
        restored: true,
        checkpointId,
        timestamp: checkpoint.timestamp,
        description: checkpoint.description
      };
      
    } catch (error) {
      console.error('Failed to restore checkpoint:', error);
      throw error;
    }
  }

  /**
   * Get checkpoint differences
   */
  async getCheckpointDiff(checkpointId, compareWith = 'current') {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }

    let compareState;
    if (compareWith === 'current') {
      compareState = await this.captureWorkspaceState();
    } else if (this.checkpoints.has(compareWith)) {
      compareState = this.checkpoints.get(compareWith).state;
    } else {
      throw new Error(`Compare target ${compareWith} not found`);
    }

    return this.calculateDiff(checkpoint.state, compareState);
  }

  /**
   * List all checkpoints
   */
  listCheckpoints(filters = {}) {
    let checkpointList = Array.from(this.checkpoints.values());

    // Apply filters
    if (filters.type) {
      checkpointList = checkpointList.filter(cp => cp.type === filters.type);
    }
    
    if (filters.author) {
      checkpointList = checkpointList.filter(cp => cp.author === filters.author);
    }
    
    if (filters.tag) {
      checkpointList = checkpointList.filter(cp => cp.tags.includes(filters.tag));
    }
    
    if (filters.timeRange) {
      const { start, end } = filters.timeRange;
      checkpointList = checkpointList.filter(cp => 
        cp.timestamp >= start && cp.timestamp <= end
      );
    }

    // Sort by timestamp (newest first)
    checkpointList.sort((a, b) => b.timestamp - a.timestamp);

    return checkpointList.map(cp => ({
      id: cp.id,
      timestamp: cp.timestamp,
      type: cp.type,
      description: cp.description,
      author: cp.author,
      tags: cp.tags,
      fileCount: cp.state?.files?.length || 0,
      size: cp.state?.totalSize || 0
    }));
  }

  /**
   * Delete a checkpoint
   */
  async deleteCheckpoint(checkpointId) {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }

    try {
      // Remove checkpoint files
      const checkpointPath = path.join(this.workspaceDir, this.settings.backupDirectory, checkpointId);
      await fs.rmdir(checkpointPath, { recursive: true });
      
      // Remove from memory
      this.checkpoints.delete(checkpointId);
      
      console.log(`🗑️ Deleted checkpoint: ${checkpointId}`);
      return true;
      
    } catch (error) {
      console.error('Failed to delete checkpoint:', error);
      throw error;
    }
  }

  /**
   * Capture current workspace state
   */
  async captureWorkspaceState() {
    const state = {
      timestamp: Date.now(),
      files: [],
      totalSize: 0,
      fileCount: 0
    };

    try {
      const files = await this.getWorkspaceFiles();
      
      for (const filePath of files) {
        try {
          const fullPath = path.join(this.workspaceDir, filePath);
          const stats = await fs.stat(fullPath);
          const content = await fs.readFile(fullPath, 'utf8');
          const hash = crypto.createHash('sha256').update(content).digest('hex');
          
          const fileInfo = {
            path: filePath,
            size: stats.size,
            modified: stats.mtime.getTime(),
            hash,
            content: this.settings.compressionEnabled ? this.compressContent(content) : content
          };
          
          state.files.push(fileInfo);
          state.totalSize += stats.size;
          state.fileCount++;
          
        } catch (fileError) {
          console.warn(`Failed to capture file ${filePath}:`, fileError.message);
        }
      }
      
    } catch (error) {
      console.error('Failed to capture workspace state:', error);
      throw error;
    }

    return state;
  }

  /**
   * Restore workspace state
   */
  async restoreWorkspaceState(state) {
    try {
      for (const fileInfo of state.files) {
        const fullPath = path.join(this.workspaceDir, fileInfo.path);
        
        // Ensure directory exists
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        
        // Restore file content
        const content = this.settings.compressionEnabled 
          ? this.decompressContent(fileInfo.content)
          : fileInfo.content;
          
        await fs.writeFile(fullPath, content, 'utf8');
        
        // Restore modification time
        const atime = new Date();
        const mtime = new Date(fileInfo.modified);
        await fs.utimes(fullPath, atime, mtime);
      }
      
    } catch (error) {
      console.error('Failed to restore workspace state:', error);
      throw error;
    }
  }

  /**
   * Git integration methods
   */
  async createGitCommit(checkpoint) {
    try {
      // Check if git repo exists
      await execAsync('git rev-parse --git-dir', { cwd: this.workspaceDir });
      
      // Stage all changes
      await execAsync('git add .', { cwd: this.workspaceDir });
      
      // Create commit
      const message = `Checkpoint: ${checkpoint.description}`;
      const { stdout } = await execAsync(`git commit -m "${message}"`, { cwd: this.workspaceDir });
      
      // Get commit hash
      const { stdout: hash } = await execAsync('git rev-parse HEAD', { cwd: this.workspaceDir });
      
      return {
        hash: hash.trim(),
        message,
        timestamp: checkpoint.timestamp
      };
      
    } catch (error) {
      console.warn('Git commit failed:', error.message);
      return null;
    }
  }

  async restoreFromGit(gitCommit) {
    try {
      await execAsync(`git checkout ${gitCommit.hash}`, { cwd: this.workspaceDir });
      console.log(`Restored from git commit: ${gitCommit.hash}`);
      
    } catch (error) {
      console.error('Git restoration failed:', error);
      throw error;
    }
  }

  /**
   * Automatic checkpoint creation
   */
  async startAutomaticCheckpoints() {
    if (!this.settings.smartTiming) {
      // Simple interval-based checkpoints
      setInterval(async () => {
        if (this.hasSignificantChanges()) {
          await this.createCheckpoint({
            type: 'auto',
            description: 'Automatic checkpoint'
          });
        }
      }, this.settings.autoCheckpointInterval);
      return;
    }

    // Smart timing - create checkpoints based on activity
    setInterval(async () => {
      await this.evaluateCheckpointTriggers();
    }, 30000); // Check every 30 seconds
  }

  async evaluateCheckpointTriggers() {
    const recentActivity = this.getRecentActivity();
    
    // Trigger conditions
    const conditions = [
      this.hasSignificantFileChanges(recentActivity),
      this.hasImportantCommands(recentActivity),
      this.hasBeenIdleAfterActivity(),
      this.isScheduledCheckpointDue()
    ];

    if (conditions.some(condition => condition)) {
      await this.createCheckpoint({
        type: 'auto',
        description: 'Smart automatic checkpoint',
        tags: ['smart', 'auto']
      });
    }
  }

  /**
   * File watching for real-time checkpoint triggers
   */
  async setupFileWatching() {
    // This is a simplified version - in production you'd use fs.watch or chokidar
    console.log('File watching setup (simplified implementation)');
  }

  /**
   * Cleanup old checkpoints
   */
  async cleanupOldCheckpoints() {
    const cutoffTime = Date.now() - (this.settings.retentionDays * 24 * 60 * 60 * 1000);
    const toDelete = [];

    for (const [id, checkpoint] of this.checkpoints) {
      if (checkpoint.timestamp < cutoffTime && checkpoint.type === 'auto') {
        toDelete.push(id);
      }
    }

    // Keep at least some recent checkpoints
    const sortedCheckpoints = Array.from(this.checkpoints.values())
      .sort((a, b) => b.timestamp - a.timestamp);
    
    const toKeep = sortedCheckpoints.slice(0, Math.min(10, this.settings.maxCheckpoints));
    const keepIds = new Set(toKeep.map(cp => cp.id));

    for (const id of toDelete) {
      if (!keepIds.has(id)) {
        try {
          await this.deleteCheckpoint(id);
          this.stats.cleanups++;
        } catch (error) {
          console.error(`Failed to cleanup checkpoint ${id}:`, error);
        }
      }
    }
  }

  /**
   * Utility methods
   */
  async getWorkspaceFiles() {
    const files = [];
    
    const walk = async (dir) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(this.workspaceDir, fullPath);
        
        if (entry.isDirectory()) {
          if (!this.isExcluded(relativePath)) {
            await walk(fullPath);
          }
        } else {
          if (this.isIncluded(relativePath) && !this.isExcluded(relativePath)) {
            files.push(relativePath);
          }
        }
      }
    };

    await walk(this.workspaceDir);
    return files;
  }

  isIncluded(filePath) {
    if (this.settings.includePatterns.length === 0) return true;
    return this.settings.includePatterns.some(pattern => 
      this.matchPattern(filePath, pattern)
    );
  }

  isExcluded(filePath) {
    return this.settings.excludePatterns.some(pattern => 
      this.matchPattern(filePath, pattern)
    );
  }

  matchPattern(filePath, pattern) {
    // Simple pattern matching - in production use a proper glob library
    const regex = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');
    return new RegExp(`^${regex}$`).test(filePath);
  }

  calculateDiff(state1, state2) {
    const diff = {
      added: [],
      removed: [],
      modified: [],
      unchanged: []
    };

    const files1 = new Map(state1.files.map(f => [f.path, f]));
    const files2 = new Map(state2.files.map(f => [f.path, f]));

    // Find added and modified files
    for (const [path, file2] of files2) {
      const file1 = files1.get(path);
      if (!file1) {
        diff.added.push({ path, size: file2.size });
      } else if (file1.hash !== file2.hash) {
        diff.modified.push({ 
          path, 
          oldSize: file1.size, 
          newSize: file2.size,
          sizeDiff: file2.size - file1.size
        });
      } else {
        diff.unchanged.push({ path, size: file2.size });
      }
    }

    // Find removed files
    for (const [path, file1] of files1) {
      if (!files2.has(path)) {
        diff.removed.push({ path, size: file1.size });
      }
    }

    return diff;
  }

  hasSignificantChanges() {
    // Simple implementation - check if enough time has passed
    return Date.now() - this.lastCheckpointTime > this.settings.autoCheckpointInterval;
  }

  hasSignificantFileChanges(activity) {
    return activity.fileChanges > 5;
  }

  hasImportantCommands(activity) {
    const importantCommands = ['npm install', 'git commit', 'build', 'deploy'];
    return activity.commands.some(cmd => 
      importantCommands.some(important => cmd.includes(important))
    );
  }

  hasBeenIdleAfterActivity() {
    const recentActivity = this.activityBuffer.slice(-10);
    return recentActivity.length > 5 && 
           Date.now() - recentActivity[recentActivity.length - 1].timestamp > 60000;
  }

  isScheduledCheckpointDue() {
    return Date.now() - this.lastCheckpointTime > this.settings.autoCheckpointInterval;
  }

  getRecentActivity() {
    const cutoff = Date.now() - 300000; // Last 5 minutes
    return {
      fileChanges: this.activityBuffer.filter(a => a.type === 'file' && a.timestamp > cutoff).length,
      commands: this.activityBuffer.filter(a => a.type === 'command' && a.timestamp > cutoff).map(a => a.data)
    };
  }

  compressContent(content) {
    // Simple compression placeholder - use proper compression in production
    return Buffer.from(content).toString('base64');
  }

  decompressContent(compressed) {
    // Simple decompression placeholder
    return Buffer.from(compressed, 'base64').toString('utf8');
  }

  generateCheckpointId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `cp_${timestamp}_${random}`;
  }

  async ensureCheckpointDirectory() {
    const checkpointDir = path.join(this.workspaceDir, this.settings.backupDirectory);
    await fs.mkdir(checkpointDir, { recursive: true });
  }

  async saveCheckpoint(checkpoint) {
    const checkpointDir = path.join(this.workspaceDir, this.settings.backupDirectory, checkpoint.id);
    await fs.mkdir(checkpointDir, { recursive: true });
    
    const metadataPath = path.join(checkpointDir, 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(checkpoint, null, 2));
  }

  async loadExistingCheckpoints() {
    try {
      const checkpointDir = path.join(this.workspaceDir, this.settings.backupDirectory);
      const entries = await fs.readdir(checkpointDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          try {
            const metadataPath = path.join(checkpointDir, entry.name, 'metadata.json');
            const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
            this.checkpoints.set(metadata.id, metadata);
          } catch (error) {
            console.warn(`Failed to load checkpoint ${entry.name}:`, error.message);
          }
        }
      }
      
      console.log(`Loaded ${this.checkpoints.size} existing checkpoints`);
      
    } catch (error) {
      console.log('No existing checkpoints found');
    }
  }

  startCleanupScheduler() {
    // Run cleanup daily
    setInterval(async () => {
      await this.cleanupOldCheckpoints();
    }, 24 * 60 * 60 * 1000);
  }

  getStats() {
    return {
      ...this.stats,
      totalSize: Array.from(this.checkpoints.values())
        .reduce((sum, cp) => sum + (cp.state?.totalSize || 0), 0),
      oldestCheckpoint: Math.min(...Array.from(this.checkpoints.values()).map(cp => cp.timestamp)),
      newestCheckpoint: Math.max(...Array.from(this.checkpoints.values()).map(cp => cp.timestamp))
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.checkpoints.clear();
    this.activityBuffer.length = 0;
    this.checkpointQueue.length = 0;
    
    for (const watcher of this.fileWatchers.values()) {
      if (watcher.close) watcher.close();
    }
    this.fileWatchers.clear();
  }
}

module.exports = CheckpointManager;