/**
 * Auto-Approve Management System for Kilo-Web
 * Handles automated approval of operations with comprehensive safety controls
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class AutoApproveManager {
  static DEFAULT_SETTINGS = {
    // Basic auto-approve settings
    alwaysAllowReadOnly: false,
    alwaysAllowReadOnlyOutsideWorkspace: false,
    alwaysAllowWrite: false,
    alwaysAllowWriteOutsideWorkspace: false,
    alwaysAllowWriteProtected: false,
    alwaysAllowExecute: false,
    alwaysAllowBrowser: false,
    alwaysAllowMcp: false,
    alwaysAllowModeSwitch: false,
    alwaysAllowSubtasks: false,
    alwaysAllowFollowupQuestions: false,
    alwaysAllowUpdateTodoList: false,
    alwaysApproveResubmit: false,
    
    // Command filtering
    allowedCommands: [],
    deniedCommands: ['rm -rf', 'del /f /s /q', 'format', 'mkfs', 'dd if='],
    
    // Rate limiting
    allowedMaxRequests: 100,
    requestDelaySeconds: 0,
    followupAutoApproveTimeoutMs: 30000,
    
    // UI settings
    showAutoApproveMenu: true,
    
    // Safety settings
    emergencyStopEnabled: true,
    auditLoggingEnabled: true,
    riskAssessmentEnabled: true,
    safetyThresholds: {
      low: 0.3,
      medium: 0.6,
      high: 0.8
    },
    maxAutoApprovalsPerHour: 50,
    requireConfirmationForHighRisk: true
  };

  constructor(workspaceDir = './') {
    this.workspaceDir = workspaceDir;
    this.settings = { ...AutoApproveManager.DEFAULT_SETTINGS };
    this.auditLog = [];
    this.requestCounts = new Map();
    this.lastRequestTimes = new Map();
    this.riskAssessments = new Map();
    this.emergencyStop = false;
    this.whitelist = new Set();
    this.blacklist = new Set();
    this.sessionStats = {
      totalRequests: 0,
      approvedRequests: 0,
      deniedRequests: 0,
      riskBlocked: 0,
      emergencyStops: 0
    };
  }

  /**
   * Initialize the auto-approve manager
   */
  async initialize(settings = {}) {
    this.settings = { ...AutoApproveManager.DEFAULT_SETTINGS, ...settings };
    this.loadWhitelistBlacklist();
    this.startHourlyReset();
    console.log('✅ Auto-Approve Manager initialized');
  }

  /**
   * Main auto-approve decision method
   */
  async shouldAutoApprove(operation) {
    this.sessionStats.totalRequests++;
    
    // Emergency stop check
    if (this.emergencyStop) {
      this.logAudit(operation, 'denied', 'Emergency stop active');
      this.sessionStats.deniedRequests++;
      return { approved: false, reason: 'Emergency stop is active' };
    }

    // Rate limiting check
    const rateLimitResult = this.checkRateLimit(operation);
    if (!rateLimitResult.allowed) {
      this.logAudit(operation, 'denied', 'Rate limit exceeded');
      this.sessionStats.deniedRequests++;
      return { approved: false, reason: rateLimitResult.reason };
    }

    // Risk assessment
    const riskAssessment = await this.assessRisk(operation);
    if (riskAssessment.level === 'critical') {
      this.logAudit(operation, 'denied', 'Critical risk level');
      this.sessionStats.riskBlocked++;
      return { approved: false, reason: 'Operation deemed too risky', riskLevel: riskAssessment.level };
    }

    // High risk requires confirmation even if auto-approve is enabled
    if (riskAssessment.level === 'high' && this.settings.requireConfirmationForHighRisk) {
      this.logAudit(operation, 'requires_confirmation', 'High risk operation');
      return { 
        approved: false, 
        requiresConfirmation: true, 
        reason: 'High risk operation requires confirmation',
        riskLevel: riskAssessment.level,
        riskFactors: riskAssessment.factors
      };
    }

    // Check specific operation type permissions
    const typeResult = this.checkOperationType(operation);
    if (!typeResult.allowed) {
      this.logAudit(operation, 'denied', typeResult.reason);
      this.sessionStats.deniedRequests++;
      return { approved: false, reason: typeResult.reason };
    }

    // Command-specific checks for execute operations
    if (operation.type === 'execute') {
      const commandResult = this.checkCommand(operation);
      if (!commandResult.allowed) {
        this.logAudit(operation, 'denied', commandResult.reason);
        this.sessionStats.deniedRequests++;
        return { approved: false, reason: commandResult.reason };
      }
    }

    // File path checks for file operations
    if (['read', 'write', 'delete'].includes(operation.type)) {
      const pathResult = this.checkFilePath(operation);
      if (!pathResult.allowed) {
        this.logAudit(operation, 'denied', pathResult.reason);
        this.sessionStats.deniedRequests++;
        return { approved: false, reason: pathResult.reason };
      }
    }

    // If we get here, approve the operation
    this.logAudit(operation, 'approved', 'Auto-approved');
    this.sessionStats.approvedRequests++;
    this.updateRequestTracking(operation);
    
    return { 
      approved: true, 
      reason: 'Auto-approved',
      riskLevel: riskAssessment.level,
      autoApproved: true
    };
  }

  /**
   * Assess risk level of an operation
   */
  async assessRisk(operation) {
    if (!this.settings.riskAssessmentEnabled) {
      return { level: 'low', score: 0.1, factors: [] };
    }

    let riskScore = 0.0;
    const riskFactors = [];

    // Operation type risk
    const typeRisks = {
      'read': 0.1,
      'write': 0.4,
      'execute': 0.6,
      'delete': 0.8,
      'browser': 0.3,
      'mcp': 0.4,
      'mode_switch': 0.2
    };
    const typeRisk = typeRisks[operation.type] || 0.3;
    riskScore += typeRisk;
    if (typeRisk > 0.5) {
      riskFactors.push(`High-risk operation type: ${operation.type}`);
    }

    // File path risk assessment
    if (operation.filePath) {
      const pathRisk = this.assessFilePathRisk(operation.filePath);
      riskScore += pathRisk.score;
      riskFactors.push(...pathRisk.factors);
    }

    // Command risk assessment
    if (operation.type === 'execute' && operation.command) {
      const commandRisk = this.assessCommandRisk(operation.command);
      riskScore += commandRisk.score;
      riskFactors.push(...commandRisk.factors);
    }

    // Frequency risk - too many operations in short time
    const recentOperations = this.getRecentOperations(300000); // Last 5 minutes
    if (recentOperations.length > 20) {
      riskScore += 0.3;
      riskFactors.push('High frequency of operations');
    }

    // Time-based risk - operations outside normal hours
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      riskScore += 0.1;
      riskFactors.push('Operation outside normal hours');
    }

    // Determine risk level
    let level = 'low';
    if (riskScore >= this.settings.safetyThresholds.high) {
      level = 'high';
    } else if (riskScore >= this.settings.safetyThresholds.medium) {
      level = 'medium';
    }

    // Critical level for extremely dangerous operations
    if (riskScore >= 0.9) {
      level = 'critical';
    }

    const assessment = {
      level,
      score: riskScore,
      factors: riskFactors,
      timestamp: Date.now()
    };

    // Cache the assessment
    this.riskAssessments.set(operation.id || this.generateOperationId(operation), assessment);

    return assessment;
  }

  /**
   * Assess file path risk
   */
  assessFilePathRisk(filePath) {
    let score = 0.0;
    const factors = [];

    // System/critical file patterns
    const criticalPatterns = [
      /\/etc\/passwd/,
      /\/etc\/shadow/,
      /\/boot\//,
      /\/proc\//,
      /\/sys\//,
      /C:\\Windows\\System32/i,
      /C:\\Program Files/i,
      /\.ssh\/id_/,
      /\.aws\/credentials/,
      /\.env$/
    ];

    for (const pattern of criticalPatterns) {
      if (pattern.test(filePath)) {
        score += 0.4;
        factors.push(`Critical system file: ${filePath}`);
        break;
      }
    }

    // Outside workspace risk
    const isOutsideWorkspace = !path.resolve(filePath).startsWith(path.resolve(this.workspaceDir));
    if (isOutsideWorkspace) {
      score += 0.2;
      factors.push('File outside workspace');
    }

    // Hidden files/directories
    if (path.basename(filePath).startsWith('.')) {
      score += 0.1;
      factors.push('Hidden file or directory');
    }

    return { score, factors };
  }

  /**
   * Assess command risk
   */
  assessCommandRisk(command) {
    let score = 0.0;
    const factors = [];

    // Dangerous command patterns
    const dangerousPatterns = [
      { pattern: /rm\s+-rf/i, score: 0.8, description: 'Recursive force delete' },
      { pattern: /del\s+\/[fs]/i, score: 0.8, description: 'Force delete (Windows)' },
      { pattern: /format\s+[a-z]:/i, score: 0.9, description: 'Disk format' },
      { pattern: /mkfs/i, score: 0.9, description: 'Create filesystem' },
      { pattern: /dd\s+if=/i, score: 0.7, description: 'Disk copy/wipe' },
      { pattern: /chmod\s+777/i, score: 0.4, description: 'Overly permissive permissions' },
      { pattern: /sudo\s+/i, score: 0.3, description: 'Elevated privileges' },
      { pattern: /curl.*\|\s*sh/i, score: 0.6, description: 'Download and execute' },
      { pattern: /wget.*\|\s*sh/i, score: 0.6, description: 'Download and execute' },
      { pattern: />.*\/dev\/null/i, score: 0.2, description: 'Output redirection' },
      { pattern: /&\s*$/i, score: 0.2, description: 'Background execution' }
    ];

    for (const { pattern, score: patternScore, description } of dangerousPatterns) {
      if (pattern.test(command)) {
        score += patternScore;
        factors.push(description);
      }
    }

    // Long commands might be obfuscated
    if (command.length > 200) {
      score += 0.2;
      factors.push('Unusually long command');
    }

    // Commands with many special characters
    const specialCharCount = (command.match(/[;&|><(){}[\]\\]/g) || []).length;
    if (specialCharCount > 5) {
      score += 0.2;
      factors.push('Complex command with many special characters');
    }

    return { score, factors };
  }

  /**
   * Check rate limiting
   */
  checkRateLimit(operation) {
    const now = Date.now();
    const operationKey = `${operation.type}:${operation.userId || 'default'}`;
    
    // Check hourly limit
    const hourlyCount = this.requestCounts.get(operationKey) || 0;
    if (hourlyCount >= this.settings.maxAutoApprovalsPerHour) {
      return { 
        allowed: false, 
        reason: `Hourly auto-approval limit exceeded (${this.settings.maxAutoApprovalsPerHour})` 
      };
    }

    // Check request delay
    const lastRequestTime = this.lastRequestTimes.get(operationKey) || 0;
    const timeSinceLastRequest = now - lastRequestTime;
    const requiredDelay = this.settings.requestDelaySeconds * 1000;
    
    if (timeSinceLastRequest < requiredDelay) {
      const waitTime = Math.ceil((requiredDelay - timeSinceLastRequest) / 1000);
      return { 
        allowed: false, 
        reason: `Request delay not met. Wait ${waitTime} seconds` 
      };
    }

    return { allowed: true };
  }

  /**
   * Check operation type permissions
   */
  checkOperationType(operation) {
    const settingsMap = {
      'read': this.settings.alwaysAllowReadOnly,
      'write': this.settings.alwaysAllowWrite,
      'execute': this.settings.alwaysAllowExecute,
      'browser': this.settings.alwaysAllowBrowser,
      'mcp': this.settings.alwaysAllowMcp,
      'mode_switch': this.settings.alwaysAllowModeSwitch,
      'subtask': this.settings.alwaysAllowSubtasks,
      'followup': this.settings.alwaysAllowFollowupQuestions,
      'todo_update': this.settings.alwaysAllowUpdateTodoList,
      'resubmit': this.settings.alwaysApproveResubmit
    };

    const isAllowed = settingsMap[operation.type];
    if (isAllowed === undefined) {
      return { allowed: false, reason: `Unknown operation type: ${operation.type}` };
    }

    if (!isAllowed) {
      return { allowed: false, reason: `Auto-approval disabled for ${operation.type} operations` };
    }

    return { allowed: true };
  }

  /**
   * Check command against allowed/denied lists
   */
  checkCommand(operation) {
    const command = operation.command || '';
    
    // Check denied commands first
    for (const deniedCmd of this.settings.deniedCommands) {
      if (command.toLowerCase().includes(deniedCmd.toLowerCase())) {
        return { 
          allowed: false, 
          reason: `Command contains denied pattern: ${deniedCmd}` 
        };
      }
    }

    // If allowed commands list is specified, command must match one
    if (this.settings.allowedCommands.length > 0) {
      const isAllowed = this.settings.allowedCommands.some(allowedCmd => 
        command.toLowerCase().includes(allowedCmd.toLowerCase())
      );
      
      if (!isAllowed) {
        return { 
          allowed: false, 
          reason: 'Command not in allowed list' 
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Check file path permissions
   */
  checkFilePath(operation) {
    const filePath = operation.filePath || '';
    
    // Check if file is outside workspace
    const isOutsideWorkspace = !path.resolve(filePath).startsWith(path.resolve(this.workspaceDir));
    
    if (isOutsideWorkspace) {
      if (operation.type === 'read' && !this.settings.alwaysAllowReadOnlyOutsideWorkspace) {
        return { allowed: false, reason: 'Read operations outside workspace not allowed' };
      }
      if (operation.type === 'write' && !this.settings.alwaysAllowWriteOutsideWorkspace) {
        return { allowed: false, reason: 'Write operations outside workspace not allowed' };
      }
    }

    // Check protected files
    if (operation.type === 'write' && !this.settings.alwaysAllowWriteProtected) {
      const protectedPatterns = [
        /package\.json$/,
        /package-lock\.json$/,
        /\.git\//,
        /node_modules\//,
        /\.env$/
      ];
      
      for (const pattern of protectedPatterns) {
        if (pattern.test(filePath)) {
          return { 
            allowed: false, 
            reason: `Write to protected file not allowed: ${filePath}` 
          };
        }
      }
    }

    return { allowed: true };
  }

  /**
   * Emergency stop functionality
   */
  activateEmergencyStop(reason = 'Manual activation') {
    this.emergencyStop = true;
    this.sessionStats.emergencyStops++;
    this.logAudit({ type: 'emergency_stop' }, 'activated', reason);
    console.warn('🚨 Emergency stop activated:', reason);
  }

  deactivateEmergencyStop() {
    this.emergencyStop = false;
    this.logAudit({ type: 'emergency_stop' }, 'deactivated', 'Manual deactivation');
    console.log('✅ Emergency stop deactivated');
  }

  /**
   * Audit logging
   */
  logAudit(operation, decision, reason) {
    if (!this.settings.auditLoggingEnabled) return;

    const auditEntry = {
      timestamp: Date.now(),
      operation: {
        type: operation.type,
        filePath: operation.filePath,
        command: operation.command,
        userId: operation.userId,
        sessionId: operation.sessionId
      },
      decision,
      reason,
      riskLevel: this.riskAssessments.get(operation.id)?.level,
      id: this.generateAuditId()
    };

    this.auditLog.push(auditEntry);

    // Keep only recent audit entries (last 1000)
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000);
    }
  }

  /**
   * Get audit log
   */
  getAuditLog(filters = {}) {
    let filteredLog = [...this.auditLog];

    if (filters.timeRange) {
      const cutoff = Date.now() - filters.timeRange;
      filteredLog = filteredLog.filter(entry => entry.timestamp >= cutoff);
    }

    if (filters.decision) {
      filteredLog = filteredLog.filter(entry => entry.decision === filters.decision);
    }

    if (filters.operationType) {
      filteredLog = filteredLog.filter(entry => entry.operation.type === filters.operationType);
    }

    return filteredLog.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get session statistics
   */
  getSessionStats() {
    return {
      ...this.sessionStats,
      approvalRate: this.sessionStats.totalRequests > 0 
        ? (this.sessionStats.approvedRequests / this.sessionStats.totalRequests) * 100 
        : 0,
      emergencyStopActive: this.emergencyStop,
      currentHourlyCount: Math.max(...Array.from(this.requestCounts.values()), 0)
    };
  }

  /**
   * Update whitelist/blacklist
   */
  updateWhitelist(patterns) {
    this.whitelist.clear();
    patterns.forEach(pattern => this.whitelist.add(pattern));
  }

  updateBlacklist(patterns) {
    this.blacklist.clear();
    patterns.forEach(pattern => this.blacklist.add(pattern));
  }

  /**
   * Helper methods
   */
  updateRequestTracking(operation) {
    const now = Date.now();
    const operationKey = `${operation.type}:${operation.userId || 'default'}`;
    
    this.requestCounts.set(operationKey, (this.requestCounts.get(operationKey) || 0) + 1);
    this.lastRequestTimes.set(operationKey, now);
  }

  getRecentOperations(timeWindow) {
    const cutoff = Date.now() - timeWindow;
    return this.auditLog.filter(entry => entry.timestamp >= cutoff);
  }

  loadWhitelistBlacklist() {
    // Load from settings or configuration files
    this.updateWhitelist(this.settings.allowedCommands || []);
    this.updateBlacklist(this.settings.deniedCommands || []);
  }

  generateOperationId(operation) {
    const data = `${operation.type}_${operation.command || operation.filePath || ''}_${Date.now()}`;
    return crypto.createHash('md5').update(data).digest('hex').substring(0, 8);
  }

  generateAuditId() {
    return crypto.randomBytes(4).toString('hex');
  }

  startHourlyReset() {
    // Reset hourly counters
    setInterval(() => {
      this.requestCounts.clear();
    }, 60 * 60 * 1000); // Every hour
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.hourlyResetInterval) {
      clearInterval(this.hourlyResetInterval);
    }
    this.auditLog.length = 0;
    this.requestCounts.clear();
    this.lastRequestTimes.clear();
    this.riskAssessments.clear();
  }
}

module.exports = AutoApproveManager;