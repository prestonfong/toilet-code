/**
 * Web-adapted version of ClineProvider for standalone operation
 * Maintains all core functionality while replacing VS Code dependencies
 */

import { EventEmitter } from 'events';
import * as path from 'path';
import { WebContext } from '../abstractions/WebContext';
import { WebWorkspace } from '../abstractions/WebWorkspace';
import { WebCommands } from '../abstractions/WebCommands';
import { WebWindow } from '../abstractions/WebWindow';

// Import AI providers
const AnthropicProvider = require('../api/providers/anthropic');
const OpenAIProvider = require('../api/providers/openai');

export interface AIProviderConfig {
  provider: string;
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface WebClineMessage {
  type: string;
  text?: string;
  images?: string[];
  timestamp: number;
  [key: string]: any;
}

export interface WebClineState {
  taskId?: string;
  apiConfiguration?: any;
  customInstructions?: string;
  clineMessages: WebClineMessage[];
  isHidden: boolean;
}

export class WebClineProvider extends EventEmitter {
  private context: WebContext;
  private workspace: WebWorkspace;
  private commands: WebCommands;
  private window: WebWindow;
  private webSocketSender?: (message: any) => void;
  private currentState: WebClineState;
  private taskHistory: Map<string, WebClineState> = new Map();

  constructor(
    storagePath: string,
    workspacePath: string,
    webSocketSender?: (message: any) => void
  ) {
    super();
    
    this.context = new WebContext(storagePath, workspacePath);
    this.workspace = new WebWorkspace(workspacePath);
    this.commands = new WebCommands();
    this.window = new WebWindow();
    
    this.webSocketSender = webSocketSender;
    if (webSocketSender) {
      this.commands.setWebSocketSender(webSocketSender);
      this.window.setWebSocketSender(webSocketSender);
    }

    this.currentState = {
      clineMessages: [],
      isHidden: false
    };

    this.registerCommands();
  }

  async initialize(): Promise<void> {
    await this.context.initialize();
    
    // Load existing state
    const savedState = this.context.globalState.get<WebClineState>('currentState');
    if (savedState) {
      this.currentState = savedState;
    }

    // Load task history
    const savedHistory = this.context.globalState.get<any>('taskHistory');
    if (savedHistory) {
      this.taskHistory = new Map(Object.entries(savedHistory));
    }

    this.emit('initialized');
  }

  private registerCommands(): void {
    // Register core Kilo Code commands
    this.commands.registerCommand('kilo-code.newTask', this.newTask.bind(this));
    this.commands.registerCommand('kilo-code.clearTask', this.clearTask.bind(this));
    this.commands.registerCommand('kilo-code.exportTask', this.exportTask.bind(this));
    this.commands.registerCommand('kilo-code.openSettings', this.openSettings.bind(this));
  }

  setWebSocketSender(sender: (message: any) => void): void {
    this.webSocketSender = sender;
    this.commands.setWebSocketSender(sender);
    this.window.setWebSocketSender(sender);
  }

  async handleWebSocketMessage(message: any): Promise<void> {
    try {
      switch (message.type) {
        case 'newTask':
          await this.newTask(message.text, message.images);
          break;
          
        case 'askResponse':
          await this.handleAskResponse(message.askResponse, message.text, message.images);
          break;
          
        case 'clearTask':
          await this.clearTask();
          break;
          
        case 'updateCustomInstructions':
          await this.updateCustomInstructions(message.text);
          break;
          
        case 'inputResponse':
          this.window.handleWebSocketMessage(message);
          break;
          
        case 'requestState':
          await this.sendState();
          break;
          
        default:
          console.warn(`Unknown WebSocket message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      this.sendMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  }

  private async newTask(text?: string, images?: string[]): Promise<void> {
    // Generate new task ID
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Save current state to history if it has content
    if (this.currentState.taskId && this.currentState.clineMessages.length > 0) {
      this.taskHistory.set(this.currentState.taskId, { ...this.currentState });
      await this.saveTaskHistory();
    }

    // Create new task state
    this.currentState = {
      taskId,
      clineMessages: [],
      isHidden: false,
      apiConfiguration: this.currentState.apiConfiguration,
      customInstructions: this.currentState.customInstructions
    };

    // Add initial user message if provided
    if (text) {
      this.addMessage({
        type: 'user',
        text,
        images,
        timestamp: Date.now()
      });
    }

    await this.saveCurrentState();
    await this.sendState();

    // Start AI processing if there's a message
    if (text) {
      await this.processUserMessage(text, images);
    }
  }

  private async clearTask(): Promise<void> {
    this.currentState = {
      clineMessages: [],
      isHidden: false,
      apiConfiguration: this.currentState.apiConfiguration,
      customInstructions: this.currentState.customInstructions
    };

    await this.saveCurrentState();
    await this.sendState();
  }

  private async updateCustomInstructions(instructions: string): Promise<void> {
    this.currentState.customInstructions = instructions;
    await this.saveCurrentState();
    await this.sendState();
  }

  private async handleAskResponse(response: string, text?: string, images?: string[]): Promise<void> {
    if (text) {
      this.addMessage({
        type: 'user',
        text,
        images,
        timestamp: Date.now()
      });
      
      await this.processUserMessage(text, images);
    }
  }

  private async processUserMessage(text: string, images?: string[]): Promise<void> {
    // Add thinking message
    this.addMessage({
      type: 'assistant',
      text: 'I\'m processing your request...',
      timestamp: Date.now()
    });

    await this.sendState();

    // TODO: Integrate actual AI processing here
    // For now, provide a simple response
    setTimeout(async () => {
      this.updateLastMessage({
        type: 'assistant',
        text: `I received your message: "${text}". AI integration is being set up to provide full Kilo Code functionality.`,
        timestamp: Date.now()
      });
      
      await this.sendState();
    }, 1000);
  }

  private addMessage(message: WebClineMessage): void {
    this.currentState.clineMessages.push(message);
  }

  private updateLastMessage(message: WebClineMessage): void {
    if (this.currentState.clineMessages.length > 0) {
      this.currentState.clineMessages[this.currentState.clineMessages.length - 1] = message;
    } else {
      this.addMessage(message);
    }
  }

  private async exportTask(): Promise<void> {
    if (!this.currentState.taskId) {
      await this.window.showWarningMessage('No active task to export');
      return;
    }

    const exportData = {
      taskId: this.currentState.taskId,
      messages: this.currentState.clineMessages,
      customInstructions: this.currentState.customInstructions,
      exportedAt: new Date().toISOString()
    };

    // In a full implementation, this would trigger a file download
    this.sendMessage({
      type: 'exportData',
      data: exportData,
      timestamp: Date.now()
    });
  }

  private async openSettings(): Promise<void> {
    this.sendMessage({
      type: 'openSettings',
      timestamp: Date.now()
    });
  }

  private async sendState(): Promise<void> {
    const state = {
      ...this.currentState,
      workspacePath: this.workspace.rootPath,
      taskHistory: Array.from(this.taskHistory.entries()).map(([id, state]) => ({
        id,
        timestamp: state.clineMessages[0]?.timestamp || Date.now(),
        messageCount: state.clineMessages.length
      }))
    };

    this.sendMessage({
      type: 'state',
      state,
      timestamp: Date.now()
    });
  }

  private sendMessage(message: any): void {
    if (this.webSocketSender) {
      this.webSocketSender(message);
    }
  }

  private async saveCurrentState(): Promise<void> {
    await this.context.globalState.update('currentState', this.currentState);
  }

  private async saveTaskHistory(): Promise<void> {
    const historyObject = Object.fromEntries(this.taskHistory);
    await this.context.globalState.update('taskHistory', historyObject);
  }

  // Getters for compatibility
  get cwd(): string {
    return this.workspace.rootPath || process.cwd();
  }

  get taskId(): string | undefined {
    return this.currentState.taskId;
  }

  get clineMessages(): WebClineMessage[] {
    return this.currentState.clineMessages;
  }

  get isHidden(): boolean {
    return this.currentState.isHidden;
  }

  // API configuration management
  async updateApiConfiguration(config: any): Promise<void> {
    this.currentState.apiConfiguration = config;
    await this.saveCurrentState();
    await this.sendState();
  }

  getApiConfiguration(): any {
    return this.currentState.apiConfiguration;
  }

  // Task management
  async loadTask(taskId: string): Promise<void> {
    const task = this.taskHistory.get(taskId);
    if (task) {
      // Save current state to history first
      if (this.currentState.taskId && this.currentState.clineMessages.length > 0) {
        this.taskHistory.set(this.currentState.taskId, { ...this.currentState });
      }
      
      this.currentState = { ...task };
      await this.saveCurrentState();
      await this.saveTaskHistory();
      await this.sendState();
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    this.taskHistory.delete(taskId);
    await this.saveTaskHistory();
    await this.sendState();
  }

  getTaskHistory(): Array<{ id: string; timestamp: number; messageCount: number }> {
    return Array.from(this.taskHistory.entries()).map(([id, state]) => ({
      id,
      timestamp: state.clineMessages[0]?.timestamp || Date.now(),
      messageCount: state.clineMessages.length
    }));
  }
}