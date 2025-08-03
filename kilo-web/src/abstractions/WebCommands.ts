/**
 * Web-compatible abstraction layer for VS Code commands API
 * Handles command registration and execution via WebSocket
 */

import { EventEmitter } from 'events';

export interface WebCommand {
  command: string;
  title: string;
  tooltip?: string;
  category?: string;
}

export type CommandHandler = (...args: any[]) => any;

export class WebCommands extends EventEmitter {
  private commands = new Map<string, CommandHandler>();
  private webSocketSender?: (message: any) => void;

  constructor() {
    super();
  }

  setWebSocketSender(sender: (message: any) => void): void {
    this.webSocketSender = sender;
  }

  registerCommand(command: string, callback: CommandHandler): { dispose(): void } {
    this.commands.set(command, callback);
    
    // Notify frontend about new command
    if (this.webSocketSender) {
      this.webSocketSender({
        type: 'commandRegistered',
        command,
        timestamp: Date.now()
      });
    }

    return {
      dispose: () => {
        this.commands.delete(command);
        if (this.webSocketSender) {
          this.webSocketSender({
            type: 'commandUnregistered',
            command,
            timestamp: Date.now()
          });
        }
      }
    };
  }

  async executeCommand(command: string, ...args: any[]): Promise<any> {
    const handler = this.commands.get(command);
    
    if (handler) {
      try {
        return await handler(...args);
      } catch (error) {
        console.error(`Error executing command ${command}:`, error);
        throw error;
      }
    } else {
      // Check if it's a built-in web command
      return this.executeBuiltInCommand(command, ...args);
    }
  }

  private async executeBuiltInCommand(command: string, ...args: any[]): Promise<any> {
    switch (command) {
      case 'workbench.action.openSettings':
        if (this.webSocketSender) {
          this.webSocketSender({
            type: 'openSettings',
            timestamp: Date.now()
          });
        }
        break;
        
      case 'workbench.action.files.save':
        if (this.webSocketSender) {
          this.webSocketSender({
            type: 'saveFile',
            timestamp: Date.now()
          });
        }
        break;
        
      case 'workbench.action.files.saveAll':
        if (this.webSocketSender) {
          this.webSocketSender({
            type: 'saveAllFiles',
            timestamp: Date.now()
          });
        }
        break;
        
      case 'workbench.action.reloadWindow':
        if (this.webSocketSender) {
          this.webSocketSender({
            type: 'reloadWindow',
            timestamp: Date.now()
          });
        }
        break;
        
      default:
        console.warn(`Unknown command: ${command}`);
        return undefined;
    }
  }

  getAllCommands(): string[] {
    return Array.from(this.commands.keys());
  }

  hasCommand(command: string): boolean {
    return this.commands.has(command);
  }
}