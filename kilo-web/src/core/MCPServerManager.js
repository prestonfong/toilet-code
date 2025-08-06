/**
 * MCP Server Manager for Kilo-Web
 * Handles Model Context Protocol server lifecycle, configuration, and communication
 * Based on the MCP specification for standardized AI tool integration
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn, exec } = require('child_process');
const EventEmitter = require('events');
const crypto = require('crypto');

class MCPServerManager extends EventEmitter {
  static SETTINGS_FILE = '.kilo/settings/mcp-servers.json';
  static BUILTIN_SERVERS = {
    'weather': {
      name: 'Weather Server',
      description: 'Provides weather data and forecasts',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-weather'],
      builtin: true,
      tags: ['weather', 'data']
    },
    'filesystem': {
      name: 'File System Server',
      description: 'File operations and management',
      type: 'stdio', 
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
      builtin: true,
      tags: ['files', 'system']
    },
    'git': {
      name: 'Git Server',
      description: 'Version control operations',
      type: 'stdio',
      command: 'npx', 
      args: ['-y', '@modelcontextprotocol/server-git'],
      builtin: true,
      tags: ['git', 'version-control']
    },
    'web-search': {
      name: 'Web Search Server',
      description: 'Web content extraction and search',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-web-search'],
      builtin: true,
      tags: ['web', 'search']
    }
  };

  constructor(workspaceDir = './') {
    super();
    this.workspaceDir = workspaceDir;
    this.settingsFile = path.join(workspaceDir, MCPServerManager.SETTINGS_FILE);
    
    // Server state management
    this.servers = new Map(); // serverId -> server config
    this.processes = new Map(); // serverId -> process instance
    this.connections = new Map(); // serverId -> connection state
    this.serverStatuses = new Map(); // serverId -> status info
    this.serverHealth = new Map(); // serverId -> health metrics
    this.tools = new Map(); // toolId -> tool info
    this.resources = new Map(); // resourceId -> resource info
    
    // WebSocket clients for real-time updates
    this.websocketClients = new Set();
    
    // Health monitoring
    this.healthCheckInterval = null;
    this.healthCheckIntervalMs = 30000; // 30 seconds
    
    // Request tracking for metrics
    this.requestMetrics = new Map(); // serverId -> metrics
    
    this._lock = Promise.resolve();
  }

  // Thread-safe locking mechanism
  lock(callback) {
    const next = this._lock.then(callback);
    this._lock = next.catch(() => {});
    return next;
  }

  /**
   * Initialize the MCP Server Manager
   */
  async initialize() {
    return this.lock(async () => {
      try {
        await this.ensureSettingsDirectory();
        await this.loadServerConfigurations();
        await this.startHealthMonitoring();
        
        console.log('✅ MCPServerManager initialized successfully');
        this.emit('initialized');
      } catch (error) {
        console.error('❌ Failed to initialize MCPServerManager:', error);
        throw error;
      }
    });
  }

  /**
   * Ensure settings directory exists
   */
  async ensureSettingsDirectory() {
    const settingsDir = path.dirname(this.settingsFile);
    try {
      await fs.access(settingsDir);
    } catch (error) {
      await fs.mkdir(settingsDir, { recursive: true });
      console.log(`📁 Created MCP settings directory: ${settingsDir}`);
    }
  }

  /**
   * Load server configurations from settings file
   */
  async loadServerConfigurations() {
    try {
      const data = await fs.readFile(this.settingsFile, 'utf8');
      const config = JSON.parse(data);
      
      // Load user-defined servers
      if (config.servers) {
        for (const server of config.servers) {
          this.servers.set(server.id, server);
          this.initializeServerMetrics(server.id);
        }
      }
      
      console.log(`📖 Loaded ${this.servers.size} MCP server configurations`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('📄 No existing MCP server configuration found, starting fresh');
        await this.saveServerConfigurations();
      } else {
        console.error('Error loading MCP server configurations:', error);
        throw error;
      }
    }
  }

  /**
   * Save server configurations to settings file
   */
  async saveServerConfigurations() {
    const config = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      servers: Array.from(this.servers.values())
    };
    
    const content = JSON.stringify(config, null, 2);
    await fs.writeFile(this.settingsFile, content, 'utf8');
  }

  /**
   * Initialize metrics tracking for a server
   */
  initializeServerMetrics(serverId) {
    this.requestMetrics.set(serverId, {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      responseTimes: [],
      errors: []
    });
  }

  /**
   * Add a new MCP server
   */
  async addServer(serverConfig) {
    return this.lock(async () => {
      // Generate unique ID if not provided
      if (!serverConfig.id) {
        serverConfig.id = this.generateServerId();
      }
      
      // Validate server configuration
      this.validateServerConfig(serverConfig);
      
      // Set metadata
      serverConfig.createdAt = new Date().toISOString();
      serverConfig.enabled = serverConfig.enabled !== false; // Default to enabled
      
      // Store server configuration
      this.servers.set(serverConfig.id, serverConfig);
      this.initializeServerMetrics(serverConfig.id);
      
      // Save to file
      await this.saveServerConfigurations();
      
      console.log(`➕ Added MCP server: ${serverConfig.name} (${serverConfig.id})`);
      this.broadcastEvent('mcpServerAdded', { server: serverConfig });
      
      return serverConfig.id;
    });
  }

  /**
   * Remove an MCP server
   */
  async removeServer(serverId) {
    return this.lock(async () => {
      const server = this.servers.get(serverId);
      if (!server) {
        throw new Error(`Server ${serverId} not found`);
      }
      
      // Stop server if running
      await this.stopServer(serverId);
      
      // Remove from collections
      this.servers.delete(serverId);
      this.processes.delete(serverId);
      this.connections.delete(serverId);
      this.serverStatuses.delete(serverId);
      this.serverHealth.delete(serverId);
      this.requestMetrics.delete(serverId);
      
      // Remove tools and resources from this server
      for (const [toolId, tool] of this.tools.entries()) {
        if (tool.serverId === serverId) {
          this.tools.delete(toolId);
        }
      }
      
      for (const [resourceId, resource] of this.resources.entries()) {
        if (resource.serverId === serverId) {
          this.resources.delete(resourceId);
        }
      }
      
      // Save configuration
      await this.saveServerConfigurations();
      
      console.log(`➖ Removed MCP server: ${server.name} (${serverId})`);
      this.broadcastEvent('mcpServerRemoved', { serverId });
    });
  }

  /**
   * Start an MCP server
   */
  async startServer(serverId) {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }
    
    if (!server.enabled) {
      throw new Error(`Server ${serverId} is disabled`);
    }
    
    if (this.processes.has(serverId)) {
      console.log(`⏯️ Server ${serverId} already running`);
      return;
    }
    
    try {
      this.updateServerStatus(serverId, 'connecting');
      
      if (server.type === 'stdio') {
        await this.startStdioServer(serverId, server);
      } else if (server.type === 'sse') {
        await this.startSSEServer(serverId, server);
      } else {
        throw new Error(`Unsupported server type: ${server.type}`);
      }
      
      console.log(`🚀 Started MCP server: ${server.name} (${serverId})`);
      
    } catch (error) {
      console.error(`❌ Failed to start server ${serverId}:`, error);
      this.updateServerStatus(serverId, 'error', error.message);
      throw error;
    }
  }

  /**
   * Start a stdio-based MCP server
   */
  async startStdioServer(serverId, server) {
    const options = {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...server.env },
      cwd: server.cwd || this.workspaceDir
    };
    
    const process = spawn(server.command, server.args || [], options);
    this.processes.set(serverId, process);
    
    // Set up process event handlers
    process.on('error', (error) => {
      console.error(`Process error for server ${serverId}:`, error);
      this.updateServerStatus(serverId, 'error', error.message);
    });
    
    process.on('exit', (code, signal) => {
      console.log(`Process exited for server ${serverId}: code=${code}, signal=${signal}`);
      this.processes.delete(serverId);
      this.connections.delete(serverId);
      this.updateServerStatus(serverId, 'disconnected');
    });
    
    // Set up MCP communication
    await this.setupMCPCommunication(serverId, process);
    
    this.updateServerStatus(serverId, 'connected');
  }

  /**
   * Start an SSE-based MCP server
   */
  async startSSEServer(serverId, server) {
    // For SSE servers, we connect to an existing HTTP endpoint
    // This is a simplified implementation - full SSE support would need more work
    
    try {
      const response = await fetch(server.url + '/health', {
        method: 'GET',
        headers: server.headers || {}
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Store connection info
      this.connections.set(serverId, {
        type: 'sse',
        url: server.url,
        headers: server.headers
      });
      
      this.updateServerStatus(serverId, 'connected');
      
    } catch (error) {
      throw new Error(`Failed to connect to SSE server: ${error.message}`);
    }
  }

  /**
   * Set up MCP protocol communication for stdio server
   */
  async setupMCPCommunication(serverId, process) {
    let messageBuffer = '';
    
    // Handle incoming messages from server
    process.stdout.on('data', (data) => {
      messageBuffer += data.toString();
      
      // Process complete JSON-RPC messages
      const lines = messageBuffer.split('\n');
      messageBuffer = lines.pop(); // Keep incomplete line
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            this.handleMCPMessage(serverId, message);
          } catch (error) {
            console.error(`Error parsing MCP message from ${serverId}:`, error);
          }
        }
      }
    });
    
    process.stderr.on('data', (data) => {
      console.error(`Server ${serverId} stderr:`, data.toString());
    });
    
    // Send initialization message
    await this.sendMCPMessage(serverId, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: true },
          resources: { subscribe: true, listChanged: true }
        },
        clientInfo: {
          name: 'kilo-web',
          version: '1.0.0'
        }
      }
    });
  }

  /**
   * Handle incoming MCP messages
   */
  handleMCPMessage(serverId, message) {
    // Update metrics
    this.updateRequestMetrics(serverId, Date.now(), true);
    
    if (message.method) {
      // Handle notifications and requests
      switch (message.method) {
        case 'tools/list':
          this.handleToolsList(serverId, message);
          break;
        case 'resources/list':
          this.handleResourcesList(serverId, message);
          break;
        case 'notifications/tools/list_changed':
          this.refreshServerTools(serverId);
          break;
        case 'notifications/resources/list_changed':
          this.refreshServerResources(serverId);
          break;
        default:
          console.log(`Unhandled MCP method ${message.method} from server ${serverId}`);
      }
    } else if (message.result || message.error) {
      // Handle responses
      this.handleMCPResponse(serverId, message);
    }
  }

  /**
   * Send MCP message to server
   */
  async sendMCPMessage(serverId, message) {
    const process = this.processes.get(serverId);
    if (!process) {
      throw new Error(`No active process for server ${serverId}`);
    }
    
    const messageStr = JSON.stringify(message) + '\n';
    process.stdin.write(messageStr);
  }

  /**
   * Handle tools list from server
   */
  handleToolsList(serverId, message) {
    if (message.result && message.result.tools) {
      // Clear existing tools for this server
      for (const [toolId, tool] of this.tools.entries()) {
        if (tool.serverId === serverId) {
          this.tools.delete(toolId);
        }
      }
      
      // Add new tools
      for (const tool of message.result.tools) {
        const toolId = `${serverId}:${tool.name}`;
        this.tools.set(toolId, {
          ...tool,
          serverId,
          enabled: true
        });
      }
      
      console.log(`🔧 Updated ${message.result.tools.length} tools for server ${serverId}`);
      this.broadcastEvent('mcpToolsUpdated', { 
        serverId,
        tools: Array.from(this.tools.values())
      });
    }
  }

  /**
   * Handle resources list from server
   */
  handleResourcesList(serverId, message) {
    if (message.result && message.result.resources) {
      // Clear existing resources for this server
      for (const [resourceId, resource] of this.resources.entries()) {
        if (resource.serverId === serverId) {
          this.resources.delete(resourceId);
        }
      }
      
      // Add new resources
      for (const resource of message.result.resources) {
        const resourceId = `${serverId}:${resource.uri}`;
        this.resources.set(resourceId, {
          ...resource,
          serverId
        });
      }
      
      console.log(`📁 Updated ${message.result.resources.length} resources for server ${serverId}`);
      this.broadcastEvent('mcpResourcesUpdated', {
        serverId,
        resources: Array.from(this.resources.values())
      });
    }
  }

  /**
   * Stop an MCP server
   */
  async stopServer(serverId) {
    const process = this.processes.get(serverId);
    if (process) {
      process.kill('SIGTERM');
      
      // Wait for graceful shutdown or force kill after timeout
      setTimeout(() => {
        if (this.processes.has(serverId)) {
          console.log(`Force killing server ${serverId}`);
          process.kill('SIGKILL');
        }
      }, 5000);
    }
    
    // Clean up connection state
    this.processes.delete(serverId);
    this.connections.delete(serverId);
    this.updateServerStatus(serverId, 'disconnected');
    
    console.log(`⏹️ Stopped MCP server: ${serverId}`);
  }

  /**
   * Toggle server enabled state
   */
  async toggleServer(serverId, enabled) {
    return this.lock(async () => {
      const server = this.servers.get(serverId);
      if (!server) {
        throw new Error(`Server ${serverId} not found`);
      }
      
      server.enabled = enabled;
      
      if (enabled) {
        await this.startServer(serverId);
      } else {
        await this.stopServer(serverId);
      }
      
      await this.saveServerConfigurations();
      
      console.log(`${enabled ? '▶️' : '⏸️'} Toggled server ${serverId}: ${enabled ? 'enabled' : 'disabled'}`);
    });
  }

  /**
   * Test server connection
   */
  async testConnection(serverId) {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }
    
    const startTime = Date.now();
    
    try {
      if (server.type === 'stdio') {
        // For stdio servers, try to start temporarily if not running
        if (!this.processes.has(serverId)) {
          await this.startServer(serverId);
          // Give it time to initialize
          await new Promise(resolve => setTimeout(resolve, 2000));
          await this.stopServer(serverId);
        }
      } else if (server.type === 'sse') {
        // For SSE servers, try to connect to health endpoint
        const response = await fetch(server.url + '/health', {
          method: 'GET',
          headers: server.headers || {},
          timeout: 5000
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }
      
      const responseTime = Date.now() - startTime;
      
      return {
        success: true,
        responseTime,
        message: 'Connection test successful'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Update server status
   */
  updateServerStatus(serverId, status, errorMessage = null) {
    const statusInfo = {
      id: serverId,
      status,
      lastPing: new Date().toISOString(),
      uptime: this.calculateUptime(serverId),
      errorMessage
    };
    
    // Add process info for stdio servers
    const process = this.processes.get(serverId);
    if (process) {
      statusInfo.processId = process.pid;
      
      // Get memory usage if available
      try {
        const memUsage = process.memoryUsage ? process.memoryUsage() : null;
        if (memUsage) {
          statusInfo.memoryUsage = memUsage.rss;
        }
      } catch (error) {
        // Ignore memory usage errors
      }
    }
    
    this.serverStatuses.set(serverId, statusInfo);
    this.broadcastEvent('mcpServerStatusChanged', { serverId, status: statusInfo });
  }

  /**
   * Calculate server uptime
   */
  calculateUptime(serverId) {
    const process = this.processes.get(serverId);
    if (!process || !process.startTime) {
      return 0;
    }
    
    return Date.now() - process.startTime;
  }

  /**
   * Update request metrics
   */
  updateRequestMetrics(serverId, responseTime, success) {
    const metrics = this.requestMetrics.get(serverId);
    if (!metrics) return;
    
    metrics.totalRequests++;
    
    if (success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }
    
    // Update response time metrics
    metrics.responseTimes.push(responseTime);
    if (metrics.responseTimes.length > 100) {
      metrics.responseTimes.shift(); // Keep only last 100
    }
    
    metrics.averageResponseTime = metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length;
  }

  /**
   * Start health monitoring
   */
  async startHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.healthCheckIntervalMs);
    
    console.log('💓 Started MCP server health monitoring');
  }

  /**
   * Perform health checks on all servers
   */
  async performHealthChecks() {
    for (const [serverId, server] of this.servers.entries()) {
      if (!server.enabled) continue;
      
      try {
        await this.checkServerHealth(serverId);
      } catch (error) {
        console.error(`Health check failed for server ${serverId}:`, error);
      }
    }
  }

  /**
   * Check health of a specific server
   */
  async checkServerHealth(serverId) {
    const server = this.servers.get(serverId);
    const metrics = this.requestMetrics.get(serverId);
    const isRunning = this.processes.has(serverId) || this.connections.has(serverId);
    
    const health = {
      serverId,
      healthy: isRunning,
      lastCheck: new Date().toISOString(),
      checks: {
        connection: isRunning,
        tools: this.getServerTools(serverId).length > 0,
        resources: this.getServerResources(serverId).length > 0
      },
      metrics: metrics || {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0
      },
      errors: []
    };
    
    // Check for recent errors
    if (metrics && metrics.errors) {
      health.errors = metrics.errors.slice(-5); // Last 5 errors
    }
    
    this.serverHealth.set(serverId, health);
    this.broadcastEvent('mcpHealthUpdated', { serverId, health });
  }

  /**
   * Get tools for a specific server
   */
  getServerTools(serverId) {
    return Array.from(this.tools.values()).filter(tool => tool.serverId === serverId);
  }

  /**
   * Get resources for a specific server
   */
  getServerResources(serverId) {
    return Array.from(this.resources.values()).filter(resource => resource.serverId === serverId);
  }

  /**
   * Broadcast event to WebSocket clients
   */
  broadcastEvent(eventType, data) {
    const message = JSON.stringify({
      type: eventType,
      data,
      timestamp: new Date().toISOString()
    });
    
    for (const client of this.websocketClients) {
      try {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(message);
        }
      } catch (error) {
        console.error('Error broadcasting to WebSocket client:', error);
        this.websocketClients.delete(client);
      }
    }
  }

  /**
   * Add WebSocket client for real-time updates
   */
  addWebSocketClient(client) {
    this.websocketClients.add(client);
    
    client.on('close', () => {
      this.websocketClients.delete(client);
    });
    
    // Send current state to new client
    client.send(JSON.stringify({
      type: 'mcpInitialState',
      data: {
        servers: Array.from(this.servers.values()),
        serverStatuses: Object.fromEntries(this.serverStatuses),
        serverHealth: Object.fromEntries(this.serverHealth),
        tools: Array.from(this.tools.values()),
        resources: Array.from(this.resources.values())
      }
    }));
  }

  /**
   * Generate unique server ID
   */
  generateServerId() {
    return 'mcp_' + crypto.randomBytes(8).toString('hex');
  }

  /**
   * Validate server configuration
   */
  validateServerConfig(config) {
    if (!config.name || typeof config.name !== 'string') {
      throw new Error('Server name is required and must be a string');
    }
    
    if (!config.type || !['stdio', 'sse'].includes(config.type)) {
      throw new Error('Server type must be either "stdio" or "sse"');
    }
    
    if (config.type === 'stdio') {
      if (!config.command || typeof config.command !== 'string') {
        throw new Error('Command is required for stdio servers');
      }
    } else if (config.type === 'sse') {
      if (!config.url || typeof config.url !== 'string') {
        throw new Error('URL is required for SSE servers');
      }
      
      try {
        new URL(config.url);
      } catch (error) {
        throw new Error('Invalid URL format');
      }
    }
  }

  /**
   * Get all servers (including built-in suggestions)
   */
  async getAllServers() {
    const userServers = Array.from(this.servers.values());
    const builtinServers = Object.entries(MCPServerManager.BUILTIN_SERVERS).map(([id, config]) => ({
      id,
      ...config,
      enabled: false // Built-in servers start disabled
    }));
    
    return [...userServers, ...builtinServers];
  }

  /**
   * Get server statistics
   */
  getServerStats() {
    const totalServers = this.servers.size;
    const connectedServers = Array.from(this.serverStatuses.values())
      .filter(status => status.status === 'connected').length;
    const totalTools = this.tools.size;
    const totalResources = this.resources.size;
    
    // Calculate average response time across all servers
    let totalResponseTime = 0;
    let responseCount = 0;
    
    for (const metrics of this.requestMetrics.values()) {
      if (metrics.responseTimes.length > 0) {
        totalResponseTime += metrics.averageResponseTime;
        responseCount++;
      }
    }
    
    const averageResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;
    
    return {
      totalServers,
      connectedServers,
      totalTools,
      totalResources,
      averageResponseTime,
      uptimePercentage: totalServers > 0 ? (connectedServers / totalServers) * 100 : 0
    };
  }

  /**
   * Cleanup and shutdown
   */
  async cleanup() {
    console.log('🧹 Cleaning up MCP Server Manager...');
    
    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    // Stop all servers
    const stopPromises = Array.from(this.servers.keys()).map(serverId => 
      this.stopServer(serverId).catch(error => 
        console.error(`Error stopping server ${serverId}:`, error)
      )
    );
    
    await Promise.all(stopPromises);
    
    // Close WebSocket connections
    for (const client of this.websocketClients) {
      try {
        client.close();
      } catch (error) {
        console.error('Error closing WebSocket client:', error);
      }
    }
    
    console.log('✅ MCP Server Manager cleanup completed');
  }
}

module.exports = MCPServerManager;