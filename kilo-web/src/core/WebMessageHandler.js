const fs = require('fs').promises;
const path = require('path');

/**
 * Web-compatible message handler
 * Adapts VS Code webviewMessageHandler for Node.js/WebSocket environment
 */
class WebMessageHandler {
    constructor(kiloProvider) {
        this.provider = kiloProvider;
    }

    /**
     * Handle incoming WebSocket messages
     */
    async handleMessage(message, ws) {
        try {
            console.log(`[WebMessageHandler] Received message: ${message.type}`);
            
            switch (message.type) {
                case 'webviewDidLaunch':
                    await this.handleWebviewLaunch(ws);
                    break;
                
                case 'newTask':
                    await this.handleNewTask(message, ws);
                    break;
                
                case 'askResponse':
                    await this.handleAskResponse(message, ws);
                    break;
                
                case 'clearTask':
                    await this.handleClearTask(ws);
                    break;
                
                case 'getState':
                    await this.handleGetState(ws);
                    break;

                case 'readFile':
                    await this.handleReadFile(message, ws);
                    break;

                case 'writeFile':
                    await this.handleWriteFile(message, ws);
                    break;

                case 'listFiles':
                    await this.handleListFiles(message, ws);
                    break;

                case 'executeCommand':
                    await this.handleExecuteCommand(message, ws);
                    break;

                case 'setApiProvider':
                    await this.handleSetApiProvider(message, ws);
                    break;
                
                default:
                    console.log(`[WebMessageHandler] Unhandled message type: ${message.type}`);
                    this.sendResponse(ws, {
                        type: 'error',
                        error: `Unknown message type: ${message.type}`
                    });
                    break;
            }
        } catch (error) {
            console.error(`[WebMessageHandler] Error handling message:`, error);
            this.sendResponse(ws, {
                type: 'error',
                error: error.message || 'Unknown error occurred'
            });
        }
    }

    /**
     * Handle webview launch - send initial state
     */
    async handleWebviewLaunch(ws) {
        const state = this.provider.getStateForWebSocket();
        this.sendResponse(ws, {
            type: 'state',
            state: state
        });
    }

    /**
     * Handle new task creation
     */
    async handleNewTask(message, ws) {
        const { text, images } = message;
        
        try {
            const taskId = await this.provider.startTask(text, { images });
            
            this.sendResponse(ws, {
                type: 'taskStarted',
                taskId: taskId
            });

            // Process the task
            await this.processUserMessage(text, images, ws);
        } catch (error) {
            console.error('[WebMessageHandler] Error starting new task:', error);
            this.sendResponse(ws, {
                type: 'error',
                error: `Failed to start task: ${error.message}`
            });
        }
    }

    /**
     * Handle user response/input
     */
    async handleAskResponse(message, ws) {
        const { text, images } = message;
        await this.processUserMessage(text, images, ws);
    }

    /**
     * Process user message and get AI response
     */
    async processUserMessage(text, images = [], ws) {
        try {
            // Send thinking indicator
            this.sendResponse(ws, {
                type: 'thinking',
                isThinking: true
            });

            // Process the message through the AI provider
            const response = await this.provider.processMessage(text, images);
            
            // Send the response
            this.sendResponse(ws, {
                type: 'messageResponse',
                message: response
            });

            // Send updated state
            const state = this.provider.getStateForWebSocket();
            this.sendResponse(ws, {
                type: 'state',
                state: state
            });

        } catch (error) {
            console.error('[WebMessageHandler] Error processing message:', error);
            this.sendResponse(ws, {
                type: 'error',
                error: `Failed to process message: ${error.message}`
            });
        } finally {
            // Stop thinking indicator
            this.sendResponse(ws, {
                type: 'thinking',
                isThinking: false
            });
        }
    }

    /**
     * Handle clear task
     */
    async handleClearTask(ws) {
        this.provider.currentTask = null;
        this.provider.clineMessages = [];
        this.provider.apiConversationHistory = [];
        
        const state = this.provider.getStateForWebSocket();
        this.sendResponse(ws, {
            type: 'state',
            state: state
        });
    }

    /**
     * Handle get state request
     */
    async handleGetState(ws) {
        const state = this.provider.getStateForWebSocket();
        this.sendResponse(ws, {
            type: 'state',
            state: state
        });
    }

    /**
     * Handle read file request
     */
    async handleReadFile(message, ws) {
        try {
            const { filePath } = message;
            const content = await this.provider.readFile(filePath);
            
            this.sendResponse(ws, {
                type: 'fileContent',
                filePath: filePath,
                content: content
            });
        } catch (error) {
            this.sendResponse(ws, {
                type: 'error',
                error: `Failed to read file ${message.filePath}: ${error.message}`
            });
        }
    }

    /**
     * Handle write file request
     */
    async handleWriteFile(message, ws) {
        try {
            const { filePath, content } = message;
            await this.provider.writeFile(filePath, content);
            
            this.sendResponse(ws, {
                type: 'fileWritten',
                filePath: filePath
            });
        } catch (error) {
            this.sendResponse(ws, {
                type: 'error',
                error: `Failed to write file ${message.filePath}: ${error.message}`
            });
        }
    }

    /**
     * Handle list files request
     */
    async handleListFiles(message, ws) {
        try {
            const { dirPath } = message;
            const files = await this.provider.listFiles(dirPath || '');
            
            this.sendResponse(ws, {
                type: 'fileList',
                dirPath: dirPath || '',
                files: files
            });
        } catch (error) {
            this.sendResponse(ws, {
                type: 'error',
                error: `Failed to list files: ${error.message}`
            });
        }
    }

    /**
     * Handle execute command request
     */
    async handleExecuteCommand(message, ws) {
        try {
            const { command, cwd } = message;
            
            // Import here to avoid circular dependencies
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);
            
            const result = await execAsync(command, { 
                cwd: cwd || this.provider.workspaceRoot,
                timeout: 30000 // 30 second timeout
            });
            
            this.sendResponse(ws, {
                type: 'commandResult',
                command: command,
                stdout: result.stdout,
                stderr: result.stderr
            });
        } catch (error) {
            this.sendResponse(ws, {
                type: 'commandResult',
                command: message.command,
                error: error.message,
                stdout: error.stdout || '',
                stderr: error.stderr || ''
            });
        }
    }

    /**
     * Handle set API provider request
     */
    async handleSetApiProvider(message, ws) {
        try {
            const { provider, apiKey, model } = message;
            
            await this.provider.setApiProvider(provider, apiKey, model);
            
            this.sendResponse(ws, {
                type: 'apiProviderSet',
                provider: provider
            });
            
            // Send updated state
            const state = this.provider.getStateForWebSocket();
            this.sendResponse(ws, {
                type: 'state',
                state: state
            });
        } catch (error) {
            this.sendResponse(ws, {
                type: 'error',
                error: `Failed to set API provider: ${error.message}`
            });
        }
    }

    /**
     * Send response to WebSocket client
     */
    sendResponse(ws, response) {
        if (ws.readyState === 1) { // WebSocket.OPEN
            ws.send(JSON.stringify(response));
        }
    }
}

module.exports = WebMessageHandler;