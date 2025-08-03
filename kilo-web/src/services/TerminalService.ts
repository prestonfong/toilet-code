import * as os from 'os';

// Conditional import for node-pty
let pty: any;
try {
    pty = require('node-pty');
} catch (error) {
    console.warn('node-pty not available, terminal functionality will be limited');
    pty = null;
}

export interface TerminalSession {
    id: string;
    process: any; // Changed from pty.IPty to any for optional dependency
    created: Date;
}

export class TerminalService {
    private terminals: Map<string, TerminalSession> = new Map();
    private messageSender: ((message: any) => void) | null = null;

    constructor() {
        this.cleanup = this.cleanup.bind(this);
        process.on('exit', this.cleanup);
        process.on('SIGINT', this.cleanup);
        process.on('SIGTERM', this.cleanup);
    }

    setMessageSender(sender: (message: any) => void): void {
        this.messageSender = sender;
    }

    private sendMessage(message: any): void {
        if (this.messageSender) {
            this.messageSender(message);
        }
    }

    createTerminal(terminalId: string, cols: number = 80, rows: number = 24, cwd?: string): boolean {
        try {
            // Check if node-pty is available
            if (!pty) {
                this.sendMessage({
                    type: 'terminal-error',
                    terminalId,
                    error: 'Terminal functionality not available (node-pty not installed)'
                });
                return false;
            }

            // Don't create if already exists
            if (this.terminals.has(terminalId)) {
                this.sendMessage({
                    type: 'terminal-error',
                    terminalId,
                    error: 'Terminal already exists'
                });
                return false;
            }

            // Determine shell based on platform
            const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
            
            // Create new pty process
            const ptyProcess = pty.spawn(shell, [], {
                name: 'xterm-color',
                cols,
                rows,
                cwd: cwd || process.cwd(),
                env: process.env as { [key: string]: string }
            });

            // Store terminal session
            const session: TerminalSession = {
                id: terminalId,
                process: ptyProcess,
                created: new Date()
            };
            this.terminals.set(terminalId, session);

            // Handle data from pty process
            ptyProcess.onData((data: string) => {
                this.sendMessage({
                    type: 'terminal-data',
                    terminalId,
                    data
                });
            });

            // Handle process exit
            ptyProcess.onExit((data: { exitCode: number; signal?: number }) => {
                this.sendMessage({
                    type: 'terminal-exit',
                    terminalId,
                    exitCode: data.exitCode
                });
                this.terminals.delete(terminalId);
            });

            // Send success response
            this.sendMessage({
                type: 'terminal-created',
                terminalId
            });

            return true;
        } catch (error) {
            console.error(`Failed to create terminal ${terminalId}:`, error);
            
            this.sendMessage({
                type: 'terminal-error',
                terminalId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            
            return false;
        }
    }

    sendInput(terminalId: string, input: string): boolean {
        const session = this.terminals.get(terminalId);
        if (session) {
            session.process.write(input);
            return true;
        }
        return false;
    }

    resizeTerminal(terminalId: string, cols: number, rows: number): boolean {
        const session = this.terminals.get(terminalId);
        if (session) {
            session.process.resize(cols, rows);
            return true;
        }
        return false;
    }

    destroyTerminal(terminalId: string): boolean {
        const session = this.terminals.get(terminalId);
        if (session) {
            session.process.kill();
            this.terminals.delete(terminalId);
            return true;
        }
        return false;
    }

    private cleanup(): void {
        console.log('Cleaning up terminal sessions...');
        for (const [id, session] of this.terminals.entries()) {
            session.process.kill();
        }
        this.terminals.clear();
    }

    getActiveTerminals(): string[] {
        return Array.from(this.terminals.keys());
    }

    handleMessage(message: any): boolean {
        switch (message.type) {
            case 'terminal-create':
                return this.createTerminal(
                    message.terminalId, 
                    message.cols, 
                    message.rows, 
                    message.cwd
                );
            
            case 'terminal-input':
                return this.sendInput(message.terminalId, message.input);
            
            case 'terminal-resize':
                return this.resizeTerminal(message.terminalId, message.cols, message.rows);
            
            case 'terminal-destroy':
                return this.destroyTerminal(message.terminalId);
                
            default:
                return false;
        }
    }
}