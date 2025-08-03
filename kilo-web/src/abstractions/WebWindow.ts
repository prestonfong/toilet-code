/**
 * Web-compatible abstraction layer for VS Code window APIs
 * Handles notifications, input dialogs, and UI interactions via WebSocket
 */

import { EventEmitter } from 'events';

export interface WebMessageOptions {
  modal?: boolean;
  detail?: string;
}

export interface WebInputBoxOptions {
  value?: string;
  valueSelection?: [number, number];
  prompt?: string;
  placeHolder?: string;
  password?: boolean;
  ignoreFocusOut?: boolean;
  validateInput?: (value: string) => string | undefined | null;
}

export interface WebQuickPickItem {
  label: string;
  description?: string;
  detail?: string;
  picked?: boolean;
  alwaysShow?: boolean;
}

export interface WebQuickPickOptions {
  matchOnDescription?: boolean;
  matchOnDetail?: boolean;
  placeHolder?: string;
  ignoreFocusOut?: boolean;
  canPickMany?: boolean;
}

export class WebWindow extends EventEmitter {
  private webSocketSender?: (message: any) => void;
  private pendingInputs = new Map<string, (value: any) => void>();

  constructor() {
    super();
  }

  setWebSocketSender(sender: (message: any) => void): void {
    this.webSocketSender = sender;
  }

  handleWebSocketMessage(message: any): void {
    if (message.type === 'inputResponse' && message.requestId) {
      const resolver = this.pendingInputs.get(message.requestId);
      if (resolver) {
        resolver(message.value);
        this.pendingInputs.delete(message.requestId);
      }
    }
  }

  async showInformationMessage<T extends string>(
    message: string,
    options?: WebMessageOptions,
    ...items: T[]
  ): Promise<T | undefined> {
    if (!this.webSocketSender) return undefined;

    const requestId = this.generateRequestId();
    
    this.webSocketSender({
      type: 'showMessage',
      level: 'info',
      message,
      options,
      items,
      requestId,
      timestamp: Date.now()
    });

    if (items.length > 0) {
      return new Promise<T | undefined>((resolve) => {
        this.pendingInputs.set(requestId, resolve);
        
        // Timeout after 30 seconds
        setTimeout(() => {
          if (this.pendingInputs.has(requestId)) {
            this.pendingInputs.delete(requestId);
            resolve(undefined);
          }
        }, 30000);
      });
    }

    return undefined;
  }

  async showWarningMessage<T extends string>(
    message: string,
    options?: WebMessageOptions,
    ...items: T[]
  ): Promise<T | undefined> {
    if (!this.webSocketSender) return undefined;

    const requestId = this.generateRequestId();
    
    this.webSocketSender({
      type: 'showMessage',
      level: 'warning',
      message,
      options,
      items,
      requestId,
      timestamp: Date.now()
    });

    if (items.length > 0) {
      return new Promise<T | undefined>((resolve) => {
        this.pendingInputs.set(requestId, resolve);
        
        setTimeout(() => {
          if (this.pendingInputs.has(requestId)) {
            this.pendingInputs.delete(requestId);
            resolve(undefined);
          }
        }, 30000);
      });
    }

    return undefined;
  }

  async showErrorMessage<T extends string>(
    message: string,
    options?: WebMessageOptions,
    ...items: T[]
  ): Promise<T | undefined> {
    if (!this.webSocketSender) return undefined;

    const requestId = this.generateRequestId();
    
    this.webSocketSender({
      type: 'showMessage',
      level: 'error',
      message,
      options,
      items,
      requestId,
      timestamp: Date.now()
    });

    if (items.length > 0) {
      return new Promise<T | undefined>((resolve) => {
        this.pendingInputs.set(requestId, resolve);
        
        setTimeout(() => {
          if (this.pendingInputs.has(requestId)) {
            this.pendingInputs.delete(requestId);
            resolve(undefined);
          }
        }, 30000);
      });
    }

    return undefined;
  }

  async showInputBox(options?: WebInputBoxOptions): Promise<string | undefined> {
    if (!this.webSocketSender) return undefined;

    const requestId = this.generateRequestId();
    
    this.webSocketSender({
      type: 'showInputBox',
      options,
      requestId,
      timestamp: Date.now()
    });

    return new Promise<string | undefined>((resolve) => {
      this.pendingInputs.set(requestId, resolve);
      
      setTimeout(() => {
        if (this.pendingInputs.has(requestId)) {
          this.pendingInputs.delete(requestId);
          resolve(undefined);
        }
      }, 30000);
    });
  }

  async showQuickPick<T extends WebQuickPickItem>(
    items: T[],
    options?: WebQuickPickOptions
  ): Promise<T | T[] | undefined> {
    if (!this.webSocketSender) return undefined;

    const requestId = this.generateRequestId();
    
    this.webSocketSender({
      type: 'showQuickPick',
      items,
      options,
      requestId,
      timestamp: Date.now()
    });

    return new Promise<T | T[] | undefined>((resolve) => {
      this.pendingInputs.set(requestId, resolve);
      
      setTimeout(() => {
        if (this.pendingInputs.has(requestId)) {
          this.pendingInputs.delete(requestId);
          resolve(undefined);
        }
      }, 30000);
    });
  }

  async showOpenDialog(options?: {
    defaultUri?: { fsPath: string };
    openLabel?: string;
    canSelectFiles?: boolean;
    canSelectFolders?: boolean;
    canSelectMany?: boolean;
    filters?: { [name: string]: string[] };
  }): Promise<{ fsPath: string }[] | undefined> {
    if (!this.webSocketSender) return undefined;

    const requestId = this.generateRequestId();
    
    this.webSocketSender({
      type: 'showOpenDialog',
      options,
      requestId,
      timestamp: Date.now()
    });

    return new Promise<{ fsPath: string }[] | undefined>((resolve) => {
      this.pendingInputs.set(requestId, resolve);
      
      setTimeout(() => {
        if (this.pendingInputs.has(requestId)) {
          this.pendingInputs.delete(requestId);
          resolve(undefined);
        }
      }, 30000);
    });
  }

  async showSaveDialog(options?: {
    defaultUri?: { fsPath: string };
    saveLabel?: string;
    filters?: { [name: string]: string[] };
  }): Promise<{ fsPath: string } | undefined> {
    if (!this.webSocketSender) return undefined;

    const requestId = this.generateRequestId();
    
    this.webSocketSender({
      type: 'showSaveDialog',
      options,
      requestId,
      timestamp: Date.now()
    });

    return new Promise<{ fsPath: string } | undefined>((resolve) => {
      this.pendingInputs.set(requestId, resolve);
      
      setTimeout(() => {
        if (this.pendingInputs.has(requestId)) {
          this.pendingInputs.delete(requestId);
          resolve(undefined);
        }
      }, 30000);
    });
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  get activeTextEditor() {
    // In web environment, we don't have direct text editor access
    // This would need to be handled through WebSocket communication
    return undefined;
  }

  get visibleTextEditors() {
    return [];
  }

  async showTextDocument(uri: { fsPath: string }, options?: any) {
    if (this.webSocketSender) {
      this.webSocketSender({
        type: 'showTextDocument',
        uri,
        options,
        timestamp: Date.now()
      });
    }
  }
}