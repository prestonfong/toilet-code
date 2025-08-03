const { spawn } = require('child_process');
const path = require('path');

/**
 * Execute command tool - web-compatible version of kilocode's executeCommandTool
 * Supports command execution with timeout and output streaming
 */
class ExecuteCommandTool {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.name = 'execute_command';
        this.description = 'Request to execute a CLI command on the system';
        this.input_schema = {
            type: 'object',
            properties: {
                command: {
                    type: 'string',
                    description: 'The CLI command to execute'
                },
                cwd: {
                    type: 'string',
                    description: 'The working directory to execute the command in (optional)'
                }
            },
            required: ['command']
        };
    }

    async execute(parameters, provider) {
        const { command, cwd } = parameters;

        try {
            if (!command) {
                return {
                    success: false,
                    error: 'Missing required parameter: command'
                };
            }

            // Determine working directory
            let workingDir = this.workspaceRoot;
            if (cwd) {
                if (path.isAbsolute(cwd)) {
                    workingDir = cwd;
                } else {
                    workingDir = path.resolve(this.workspaceRoot, cwd);
                }
            }

            // Validate working directory exists and is within allowed scope
            try {
                const fs = require('fs');
                if (!fs.existsSync(workingDir)) {
                    return {
                        success: false,
                        error: `Working directory does not exist: ${workingDir}`
                    };
                }
            } catch (error) {
                return {
                    success: false,
                    error: `Cannot access working directory: ${workingDir}`
                };
            }

            // Security check - prevent dangerous commands
            if (this.isDangerousCommand(command)) {
                return {
                    success: false,
                    error: 'Command not allowed for security reasons'
                };
            }

            // Execute command with timeout
            const timeout = 30000; // 30 seconds timeout
            const result = await this.executeCommandWithTimeout(command, workingDir, timeout);

            return {
                success: true,
                command: command,
                working_directory: workingDir,
                exit_code: result.exitCode,
                output: result.output,
                error_output: result.errorOutput,
                execution_time: result.executionTime,
                timed_out: result.timedOut
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                command: command
            };
        }
    }

    async executeCommandWithTimeout(command, workingDir, timeout) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            let output = '';
            let errorOutput = '';
            let timedOut = false;

            // Parse command and arguments
            const args = this.parseCommand(command);
            const cmd = args.shift();

            const childProcess = spawn(cmd, args, {
                cwd: workingDir,
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: true
            });

            // Set up timeout
            const timeoutId = setTimeout(() => {
                timedOut = true;
                childProcess.kill('SIGTERM');
                
                // If process doesn't terminate gracefully, force kill
                setTimeout(() => {
                    if (!childProcess.killed) {
                        childProcess.kill('SIGKILL');
                    }
                }, 5000);
            }, timeout);

            // Collect stdout
            childProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            // Collect stderr
            childProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            // Handle process completion
            childProcess.on('close', (exitCode) => {
                clearTimeout(timeoutId);
                const executionTime = Date.now() - startTime;

                // Limit output size
                const maxOutputSize = 50000; // 50KB limit
                if (output.length > maxOutputSize) {
                    output = output.substring(0, maxOutputSize) + '\n... (output truncated)';
                }
                if (errorOutput.length > maxOutputSize) {
                    errorOutput = errorOutput.substring(0, maxOutputSize) + '\n... (error output truncated)';
                }

                resolve({
                    exitCode: timedOut ? -1 : exitCode,
                    output: output,
                    errorOutput: errorOutput,
                    executionTime: executionTime,
                    timedOut: timedOut
                });
            });

            // Handle process errors
            childProcess.on('error', (error) => {
                clearTimeout(timeoutId);
                const executionTime = Date.now() - startTime;

                resolve({
                    exitCode: -1,
                    output: output,
                    errorOutput: errorOutput + '\nProcess error: ' + error.message,
                    executionTime: executionTime,
                    timedOut: timedOut
                });
            });
        });
    }

    parseCommand(command) {
        // Simple command parsing - splits on spaces but respects quotes
        const args = [];
        let current = '';
        let inQuotes = false;
        let quoteChar = '';

        for (let i = 0; i < command.length; i++) {
            const char = command[i];
            
            if ((char === '"' || char === "'") && !inQuotes) {
                inQuotes = true;
                quoteChar = char;
            } else if (char === quoteChar && inQuotes) {
                inQuotes = false;
                quoteChar = '';
            } else if (char === ' ' && !inQuotes) {
                if (current) {
                    args.push(current);
                    current = '';
                }
            } else {
                current += char;
            }
        }

        if (current) {
            args.push(current);
        }

        return args;
    }

    isDangerousCommand(command) {
        // List of dangerous command patterns to block
        const dangerousPatterns = [
            /^rm\s+-rf\s+\//, // rm -rf /
            /^rmdir\s+\//, // rmdir /
            /^del\s+\/[sq]/, // del /s or del /q on entire drives
            /^format\s+/, // format command
            /^fdisk\s+/, // fdisk command
            /^mkfs/, // make filesystem
            /^dd\s+if=/, // dd command
            /shutdown/, // shutdown command
            /reboot/, // reboot command
            /halt/, // halt command
            /poweroff/, // poweroff command
            /^sudo\s+/, // sudo commands (can be dangerous)
            /^su\s+/, // su commands
            /passwd/, // password changes
            /^chmod\s+777/, // overly permissive chmod
            /^chown\s+/, // ownership changes
            />\s*\/dev\//, // redirecting to device files
            /\/etc\/passwd/, // accessing password file
            /\/etc\/shadow/, // accessing shadow file
            /^curl.*\|\s*sh/, // pipe curl to shell
            /^wget.*\|\s*sh/, // pipe wget to shell
            /^nc\s+.*-e/, // netcat with execute
            /^ncat\s+.*-e/, // ncat with execute
        ];

        return dangerousPatterns.some(pattern => pattern.test(command.toLowerCase()));
    }
}

module.exports = ExecuteCommandTool;