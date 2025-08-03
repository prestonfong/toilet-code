/**
 * Service that manages the WebClineProvider and handles AI interactions
 */

import { WebClineProvider, AIProviderConfig } from '../core/WebClineProvider';
import { TerminalService } from './TerminalService';
import * as path from 'path';
import * as os from 'os';

export class ClineService {
  private provider: WebClineProvider;
  private terminalService: TerminalService;
  private isInitialized = false;

  constructor(workspacePath?: string) {
    const storagePath = path.join(os.homedir(), '.kilo-web');
    const workspace = workspacePath || process.cwd();
    
    this.provider = new WebClineProvider(storagePath, workspace);
    this.terminalService = new TerminalService();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    await this.provider.initialize();
    this.isInitialized = true;
    
    console.log('ClineService initialized successfully');
  }

  setWebSocketSender(sender: (message: any) => void): void {
    this.provider.setWebSocketSender(sender);
    this.terminalService.setMessageSender(sender);
  }

  async handleMessage(message: any): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('ClineService not initialized');
    }
    
    // Handle terminal messages first
    if (message.type && message.type.startsWith('terminal-')) {
      const handled = this.terminalService.handleMessage(message);
      if (!handled) {
        console.error(`Failed to handle terminal message: ${message.type}`);
      }
      return;
    }
    
    await this.provider.handleWebSocketMessage(message);
  }

  getProvider(): WebClineProvider {
    return this.provider;
  }

  // Health check
  isReady(): boolean {
    return this.isInitialized;
  }

  // Get current state
  async getCurrentState(): Promise<any> {
    return {
      taskId: this.provider.taskId,
      messageCount: this.provider.clineMessages.length,
      isHidden: this.provider.isHidden,
      workspacePath: this.provider.cwd
    };
  }

  // API configuration management
  async updateApiConfiguration(config: any): Promise<void> {
    await this.provider.updateApiConfiguration(config);
  }

  getApiConfiguration(): any {
    return this.provider.getApiConfiguration();
  }

  // Task management
  async createNewTask(text?: string, images?: string[]): Promise<void> {
    await this.provider.handleWebSocketMessage({
      type: 'newTask',
      text,
      images
    });
  }

  async clearCurrentTask(): Promise<void> {
    await this.provider.handleWebSocketMessage({
      type: 'clearTask'
    });
  }

  async loadTask(taskId: string): Promise<void> {
    await this.provider.loadTask(taskId);
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.provider.deleteTask(taskId);
  }

  getTaskHistory(): Array<{ id: string; timestamp: number; messageCount: number }> {
    return this.provider.getTaskHistory();
  }
}