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

  constructor(private url: string = `ws://${window.location.host}`) {}

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
    this.send({
      type: 'listFiles',
      dirPath
    });
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

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Create a singleton instance
export const kiloClient = new KiloWebClient();