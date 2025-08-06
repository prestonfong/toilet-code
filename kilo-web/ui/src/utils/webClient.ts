export interface KiloMessage {
  type: string;
  [key: string]: any;
}

export interface KiloState {
  taskId?: string;
  currentTask?: any;
  clineMessages: any[];
  isConnected: boolean;
  hasApiProvider: boolean;
  workspaceRoot: string;
}

export class KiloWebClient {
  private ws: WebSocket | null = null;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(private url: string = `ws://${window.location.hostname}:5000`) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: KiloMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect().catch(error => {
          console.error('Reconnection failed:', error);
        });
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  private handleMessage(message: KiloMessage) {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message);
    } else {
      console.log('Unhandled message type:', message.type, message);
    }
  }

  on(messageType: string, handler: (data: any) => void) {
    this.messageHandlers.set(messageType, handler);
  }

  off(messageType: string) {
    this.messageHandlers.delete(messageType);
  }

  send(message: KiloMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
      throw new Error('WebSocket is not connected');
    }
  }

  // Convenience methods for common operations
  async startNewTask(instruction: string, images: string[] = []) {
    this.send({
      type: 'newTask',
      text: instruction,
      images
    });
  }

  async sendMessage(text: string, images: string[] = []) {
    this.send({
      type: 'askResponse',
      askResponse: 'messageResponse',
      text,
      images
    });
  }

  async clearTask() {
    this.send({
      type: 'clearTask'
    });
  }

  async requestState() {
    this.send({
      type: 'getState'
    });
  }

  async setApiProvider(provider: string, apiKey: string, model?: string) {
    this.send({
      type: 'setApiProvider',
      provider,
      apiKey,
      model
    });
  }

  async readFile(filePath: string) {
    this.send({
      type: 'readFile',
      filePath
    });
  }

  async writeFile(filePath: string, content: string) {
    this.send({
      type: 'writeFile',
      filePath,
      content
    });
  }

  async listFiles(dirPath: string = '') {
    console.log('🐛 [DEBUG] webClient.listFiles() - Sending WebSocket message:', { type: 'listFiles', dirPath });
    console.log('🐛 [DEBUG] This will NOT work - server expects HTTP GET /api/files');
    this.send({
      type: 'listFiles',
      dirPath
    });
  }

  // 🐛 [DEBUG] Missing HTTP method for file listing - should be:
  async listFilesHTTP(dirPath: string = '') {
    console.log('🐛 [DEBUG] listFilesHTTP() - Making HTTP request to /api/files');
    const url = `/api/files${dirPath ? `?path=${encodeURIComponent(dirPath)}` : ''}`;
    const response = await fetch(url);
    const data = await response.json();
    return data;
  }

  async createFile(filePath: string, content: string = '') {
    this.send({
      type: 'createFile',
      filePath,
      content
    });
  }

  async createDirectory(dirPath: string) {
    this.send({
      type: 'createDirectory',
      dirPath
    });
  }

  async deleteFile(filePath: string) {
    this.send({
      type: 'deleteFile',
      filePath
    });
  }

  async uploadFile(file: File, targetPath: string = '.') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', targetPath);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }
      return result;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  }

  async downloadFile(filePath: string) {
    try {
      const response = await fetch(`/api/download/${encodeURIComponent(filePath)}`);
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filePath.split('/').pop() || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      throw error;
    }
  }

  async executeCommand(command: string, cwd?: string) {
    this.send({
      type: 'executeCommand',
      command,
      cwd
    });
  }

  // Terminal methods
  async createTerminal(terminalId: string, cols: number = 80, rows: number = 24, cwd?: string) {
    this.send({
      type: 'terminal-create',
      terminalId,
      cols,
      rows,
      cwd
    });
  }

  async sendTerminalInput(terminalId: string, input: string) {
    this.send({
      type: 'terminal-input',
      terminalId,
      input
    });
  }

  async resizeTerminal(terminalId: string, cols: number, rows: number) {
    this.send({
      type: 'terminal-resize',
      terminalId,
      cols,
      rows
    });
  }

  async destroyTerminal(terminalId: string) {
    this.send({
      type: 'terminal-destroy',
      terminalId
    });
  }

  // Settings methods
  async getSettings() {
    this.send({
      type: 'settingsGet'
    });
  }

  async updateSettings(settings: any) {
    this.send({
      type: 'settingsUpdate',
      data: settings
    });
  }

  async saveProviderProfile(name: string, config: any) {
    this.send({
      type: 'settingsProviderProfileSave',
      data: { name, config }
    });
  }

  async deleteProviderProfile(name: string) {
    this.send({
      type: 'settingsProviderProfileDelete',
      data: { name }
    });
  }

  async setCurrentProvider(name: string) {
    this.send({
      type: 'settingsProviderSetCurrent',
      data: { name }
    });
  }

  async updateGlobalSettings(settings: any) {
    this.send({
      type: 'settingsGlobalUpdate',
      data: settings
    });
  }

  async saveModeConfig(config: any) {
    this.send({
      type: 'settingsModeConfigSave',
      data: config
    });
  }

  async exportSettings() {
    this.send({
      type: 'settingsExport'
    });
  }

  async importSettings(data: any, options: any = {}) {
    this.send({
      type: 'settingsImport',
      data: { data, options }
    });
  }

  // Comprehensive Settings Import/Export Methods

  async exportSettingsHTTP(options: any = {}) {
    try {
      const response = await fetch('/api/settings/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options)
      });
      return await response.json();
    } catch (error) {
      console.error('Error exporting settings:', error);
      throw error;
    }
  }

  async importSettingsHTTP(importData: any, options: any = {}) {
    try {
      const response = await fetch('/api/settings/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importData, options })
      });
      return await response.json();
    } catch (error) {
      console.error('Error importing settings:', error);
      throw error;
    }
  }

  async createImportPreview(importData: any, password?: string) {
    try {
      const response = await fetch('/api/settings/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importData, password })
      });
      return await response.json();
    } catch (error) {
      console.error('Error creating import preview:', error);
      throw error;
    }
  }

  async validateImportData(importData: any, password?: string) {
    try {
      const response = await fetch('/api/settings/import/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importData, password })
      });
      return await response.json();
    } catch (error) {
      console.error('Error validating import data:', error);
      throw error;
    }
  }

  async createSettingsBackup() {
    try {
      const response = await fetch('/api/settings/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return await response.json();
    } catch (error) {
      console.error('Error creating settings backup:', error);
      throw error;
    }
  }

  async restoreFromBackup(backupData: any) {
    try {
      const response = await fetch('/api/settings/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupData })
      });
      return await response.json();
    } catch (error) {
      console.error('Error restoring from backup:', error);
      throw error;
    }
  }

  async getExportFormats() {
    try {
      const response = await fetch('/api/settings/export/formats');
      return await response.json();
    } catch (error) {
      console.error('Error getting export formats:', error);
      throw error;
    }
  }

  async getSettingsCategories() {
    try {
      const response = await fetch('/api/settings/categories');
      return await response.json();
    } catch (error) {
      console.error('Error getting settings categories:', error);
      throw error;
    }
  }

  // Mode switching methods
  async switchMode(modeSlug: string) {
    this.send({
      type: 'switchMode',
      modeSlug
    });
  }

  async getCurrentMode() {
    this.send({
      type: 'getCurrentMode'
    });
  }

  // MCP Server Management methods
  async getMCPServers() {
    this.send({
      type: 'mcpGetServers'
    });
  }

  async getMCPServerStatuses() {
    this.send({
      type: 'mcpGetServerStatuses'
    });
  }

  async getMCPTools() {
    this.send({
      type: 'mcpGetTools'
    });
  }

  async getMCPResources() {
    this.send({
      type: 'mcpGetResources'
    });
  }

  async getMCPHealth() {
    this.send({
      type: 'mcpGetHealth'
    });
  }

  async addMCPServer(config: any) {
    this.send({
      type: 'mcpAddServer',
      config
    });
  }

  async updateMCPServer(serverId: string, config: any) {
    this.send({
      type: 'mcpUpdateServer',
      serverId,
      config
    });
  }

  async deleteMCPServer(serverId: string) {
    this.send({
      type: 'mcpDeleteServer',
      serverId
    });
  }

  async toggleMCPServer(serverId: string, enabled: boolean) {
    this.send({
      type: 'mcpToggleServer',
      serverId,
      enabled
    });
  }

  async testMCPConnection(serverId: string) {
    this.send({
      type: 'mcpTestConnection',
      serverId
    });
  }

  async testMCPServerConfig(config: any) {
    this.send({
      type: 'mcpTestServerConfig',
      config
    });
  }

  async restartMCPServer(serverId: string) {
    this.send({
      type: 'mcpRestartServer',
      serverId
    });
  }

  async getMCPServerLogs(serverId: string, lines?: number) {
    this.send({
      type: 'mcpGetServerLogs',
      serverId,
      lines
    });
  }

  async executeMCPTool(serverId: string, toolName: string, parameters: any) {
    this.send({
      type: 'mcpExecuteTool',
      serverId,
      toolName,
      parameters
    });
  }

  async accessMCPResource(serverId: string, uri: string) {
    this.send({
      type: 'mcpAccessResource',
      serverId,
      uri
    });
  }

  async refreshMCPServerCapabilities(serverId: string) {
    this.send({
      type: 'mcpRefreshCapabilities',
      serverId
    });
  }

  async getMCPServerStats() {
    this.send({
      type: 'mcpGetStats'
    });
  }

  // Provider Validation and Autofill Methods
  
  async validateProviderConfig(provider: string, config: any) {
    try {
      const response = await fetch('/api/settings/providers/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, config })
      });
      return await response.json();
    } catch (error) {
      console.error('Error validating provider config:', error);
      throw error;
    }
  }

  async validateProviderField(provider: string, field: string, value: any) {
    try {
      const response = await fetch('/api/settings/providers/validate/field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, field, value })
      });
      return await response.json();
    } catch (error) {
      console.error('Error validating provider field:', error);
      throw error;
    }
  }

  async getProviderSchema(provider: string) {
    try {
      const response = await fetch(`/api/settings/providers/${provider}/schema`);
      return await response.json();
    } catch (error) {
      console.error('Error getting provider schema:', error);
      throw error;
    }
  }

  async getAutofillConfig(provider: string, existingConfig: any = {}, useCase: string = 'general') {
    try {
      const response = await fetch('/api/settings/providers/autofill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, existingConfig, useCase })
      });
      return await response.json();
    } catch (error) {
      console.error('Error getting autofill config:', error);
      throw error;
    }
  }

  async getModelSuggestions(provider: string, useCase: string = 'general') {
    try {
      const response = await fetch(`/api/settings/providers/${provider}/models/suggestions?useCase=${useCase}`);
      return await response.json();
    } catch (error) {
      console.error('Error getting model suggestions:', error);
      throw error;
    }
  }

  async getFieldCompletions(provider: string, field: string, currentValue: string = '', context: any = {}) {
    try {
      const response = await fetch('/api/settings/providers/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, field, currentValue, context })
      });
      return await response.json();
    } catch (error) {
      console.error('Error getting field completions:', error);
      throw error;
    }
  }

  async getFieldHelp(provider: string, field: string) {
    try {
      const response = await fetch(`/api/settings/providers/${provider}/field/${field}/help`);
      return await response.json();
    } catch (error) {
      console.error('Error getting field help:', error);
      throw error;
    }
  }

  async testProviderConnection(provider: string, config: any) {
    try {
      const response = await fetch('/api/settings/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, config })
      });
      return await response.json();
    } catch (error) {
      console.error('Error testing provider connection:', error);
      throw error;
    }
  }

  async getSupportedProviders() {
    try {
      const response = await fetch('/api/settings/providers/supported');
      return await response.json();
    } catch (error) {
      console.error('Error getting supported providers:', error);
      throw error;
    }
  }

  // Comprehensive Settings Validation Methods
  
  async getSettingsHealth() {
    try {
      const response = await fetch('/api/settings/validation/health');
      return await response.json();
    } catch (error) {
      console.error('Error getting settings health:', error);
      throw error;
    }
  }

  async validateAllSettings(options: any = {}) {
    try {
      const response = await fetch('/api/settings/validation/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options)
      });
      return await response.json();
    } catch (error) {
      console.error('Error validating all settings:', error);
      throw error;
    }
  }

  async validateSettingsSection(section: string, data: any, options: any = {}) {
    try {
      const response = await fetch(`/api/settings/validation/validate/${section}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, options })
      });
      return await response.json();
    } catch (error) {
      console.error(`Error validating ${section} settings:`, error);
      throw error;
    }
  }

  async getValidationSchemas() {
    try {
      const response = await fetch('/api/settings/validation/schemas');
      return await response.json();
    } catch (error) {
      console.error('Error getting validation schemas:', error);
      throw error;
    }
  }

  async analyzeSettings(category: string, data: any) {
    try {
      const response = await fetch('/api/settings/validation/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, data })
      });
      return await response.json();
    } catch (error) {
      console.error(`Error analyzing settings for ${category}:`, error);
      throw error;
    }
  }

  async getValidationRules() {
    try {
      const response = await fetch('/api/settings/validation/rules');
      return await response.json();
    } catch (error) {
      console.error('Error getting validation rules:', error);
      throw error;
    }
  }

  async performRealtimeValidation(category: string, field: string, value: any, context: any = {}) {
    try {
      const response = await fetch('/api/settings/validation/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, field, value, context })
      });
      return await response.json();
    } catch (error) {
      console.error('Error performing real-time validation:', error);
      throw error;
    }
  }

  // Settings Migration Methods
  
  async getMigrationStatus() {
    try {
      const response = await fetch('/api/settings/migration/status');
      return await response.json();
    } catch (error) {
      console.error('Error getting migration status:', error);
      throw error;
    }
  }

  async executeMigration(options: any = {}) {
    try {
      const response = await fetch('/api/settings/migration/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options)
      });
      return await response.json();
    } catch (error) {
      console.error('Error executing migration:', error);
      throw error;
    }
  }

  async getAvailableRollbacks() {
    try {
      const response = await fetch('/api/settings/migration/rollbacks');
      return await response.json();
    } catch (error) {
      console.error('Error getting available rollbacks:', error);
      throw error;
    }
  }

  async performRollback(backupPath: string) {
    try {
      const response = await fetch('/api/settings/migration/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupPath })
      });
      return await response.json();
    } catch (error) {
      console.error('Error performing rollback:', error);
      throw error;
    }
  }

  async createMigrationBackup() {
    try {
      const response = await fetch('/api/settings/migration/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return await response.json();
    } catch (error) {
      console.error('Error creating migration backup:', error);
      throw error;
    }
  }

  // Combined validation and migration health check
  async performStartupHealthCheck() {
    try {
      const [healthResult, migrationResult] = await Promise.all([
        this.getSettingsHealth(),
        this.getMigrationStatus()
      ]);
      
      return {
        health: healthResult.health,
        migration: migrationResult.migration,
        overall: {
          healthy: healthResult.health?.system?.healthy && !migrationResult.migration?.needed,
          requiresAttention: !healthResult.health?.system?.healthy || migrationResult.migration?.needed,
          migrationNeeded: migrationResult.migration?.needed || false,
          validationErrors: healthResult.health?.validation?.errorCount || 0,
          validationWarnings: healthResult.health?.validation?.warningCount || 0
        }
      };
    } catch (error) {
      console.error('Error performing startup health check:', error);
      return {
        health: null,
        migration: null,
        overall: {
          healthy: false,
          requiresAttention: true,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  // Convenience method for comprehensive settings validation
  async runComprehensiveValidation() {
    try {
      const [validationResult, performanceAnalysis, securityAnalysis] = await Promise.all([
        this.validateAllSettings({ includeSettings: false }),
        this.analyzeSettings('performance', {}),
        this.analyzeSettings('security', {})
      ]);

      return {
        validation: validationResult.validation,
        analysis: {
          performance: performanceAnalysis.analysis,
          security: securityAnalysis.analysis
        },
        summary: {
          totalIssues: (validationResult.validation?.errors?.length || 0) + (validationResult.validation?.warnings?.length || 0),
          criticalIssues: validationResult.validation?.errors?.length || 0,
          warningIssues: validationResult.validation?.warnings?.length || 0,
          isHealthy: validationResult.validation?.isValid || false
        }
      };
    } catch (error) {
      console.error('Error running comprehensive validation:', error);
      throw error;
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get webSocket(): WebSocket | null {
    return this.ws;
  }
}

// Create a singleton instance
export const kiloClient = new KiloWebClient();