const ReadFileTool = require('./readFile');
const WriteToFileTool = require('./writeToFile');
const ListFilesTool = require('./listFiles');
const ExecuteCommandTool = require('./executeCommand');
const SearchFilesTool = require('./searchFiles');

/**
 * Central tool registry and execution framework
 * Manages all available tools and provides unified execution interface
 */
class ToolRegistry {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.tools = new Map();
        this.initializeTools();
    }

    initializeTools() {
        // Register all available tools
        const tools = [
            new ReadFileTool(this.workspaceRoot),
            new WriteToFileTool(this.workspaceRoot),
            new ListFilesTool(this.workspaceRoot),
            new ExecuteCommandTool(this.workspaceRoot),
            new SearchFilesTool(this.workspaceRoot)
        ];

        for (const tool of tools) {
            this.tools.set(tool.name, tool);
        }

        console.log(`🔧 Initialized ${this.tools.size} tools:`, Array.from(this.tools.keys()));
    }

    /**
     * Get list of all available tools with their schemas
     */
    getAvailableTools() {
        const toolList = [];
        for (const [name, tool] of this.tools) {
            toolList.push({
                name: tool.name,
                description: tool.description,
                input_schema: tool.input_schema
            });
        }
        return toolList;
    }

    /**
     * Get a specific tool by name
     */
    getTool(toolName) {
        return this.tools.get(toolName);
    }

    /**
     * Execute a tool with the given parameters
     */
    async executeTool(toolName, parameters, provider = null) {
        const startTime = Date.now();
        
        try {
            // Validate tool exists
            const tool = this.tools.get(toolName);
            if (!tool) {
                return {
                    success: false,
                    error: `Unknown tool: ${toolName}`,
                    available_tools: Array.from(this.tools.keys())
                };
            }

            // Validate parameters against schema
            const validationResult = this.validateParameters(tool, parameters);
            if (!validationResult.valid) {
                return {
                    success: false,
                    error: `Parameter validation failed: ${validationResult.error}`,
                    tool: toolName,
                    schema: tool.input_schema
                };
            }

            // Execute the tool
            console.log(`🔧 [TOOL] Executing ${toolName} with parameters:`, JSON.stringify(parameters, null, 2));
            
            const result = await tool.execute(parameters, provider);
            const executionTime = Date.now() - startTime;

            // Add metadata to result
            const enhancedResult = {
                ...result,
                tool: toolName,
                execution_time_ms: executionTime,
                timestamp: new Date().toISOString()
            };

            console.log(`✅ [TOOL] ${toolName} completed in ${executionTime}ms, success: ${result.success}`);
            
            return enhancedResult;

        } catch (error) {
            const executionTime = Date.now() - startTime;
            console.error(`❌ [TOOL] ${toolName} failed after ${executionTime}ms:`, error);
            
            return {
                success: false,
                error: error.message,
                tool: toolName,
                execution_time_ms: executionTime,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Validate parameters against tool schema
     */
    validateParameters(tool, parameters) {
        const schema = tool.input_schema;
        
        if (!schema || !schema.properties) {
            return { valid: true }; // No schema to validate against
        }

        // Check required parameters
        if (schema.required) {
            for (const requiredParam of schema.required) {
                if (!(requiredParam in parameters)) {
                    return {
                        valid: false,
                        error: `Missing required parameter: ${requiredParam}`
                    };
                }
            }
        }

        // Basic type checking for provided parameters
        for (const [paramName, paramValue] of Object.entries(parameters)) {
            const paramSchema = schema.properties[paramName];
            if (paramSchema && paramSchema.type) {
                const actualType = typeof paramValue;
                const expectedType = paramSchema.type;
                
                if (expectedType === 'string' && actualType !== 'string') {
                    return {
                        valid: false,
                        error: `Parameter '${paramName}' must be a string, got ${actualType}`
                    };
                }
                
                if (expectedType === 'number' && actualType !== 'number') {
                    return {
                        valid: false,
                        error: `Parameter '${paramName}' must be a number, got ${actualType}`
                    };
                }
                
                if (expectedType === 'boolean' && actualType !== 'boolean') {
                    return {
                        valid: false,
                        error: `Parameter '${paramName}' must be a boolean, got ${actualType}`
                    };
                }
            }
        }

        return { valid: true };
    }

    /**
     * Execute multiple tools in sequence
     */
    async executeToolChain(toolCalls, provider = null) {
        const results = [];
        
        for (const toolCall of toolCalls) {
            const { tool, parameters } = toolCall;
            const result = await this.executeTool(tool, parameters, provider);
            results.push(result);
            
            // Stop execution chain if a tool fails (optional behavior)
            if (!result.success && toolCall.stopOnFailure !== false) {
                break;
            }
        }
        
        return {
            success: results.every(r => r.success),
            results: results,
            total_execution_time_ms: results.reduce((sum, r) => sum + (r.execution_time_ms || 0), 0)
        };
    }

    /**
     * Format tool result for display in chat
     */
    formatToolResult(result) {
        if (!result.success) {
            return {
                type: 'error',
                message: `❌ Tool '${result.tool}' failed: ${result.error}`,
                details: result
            };
        }

        switch (result.tool) {
            case 'read_file':
                return this.formatReadFileResult(result);
            case 'write_to_file':
                return this.formatWriteFileResult(result);
            case 'list_files':
                return this.formatListFilesResult(result);
            case 'execute_command':
                return this.formatExecuteCommandResult(result);
            case 'search_files':
                return this.formatSearchFilesResult(result);
            default:
                return {
                    type: 'success',
                    message: `✅ Tool '${result.tool}' completed successfully`,
                    details: result
                };
        }
    }

    formatReadFileResult(result) {
        if (result.files) {
            const successCount = result.files.filter(f => f.success).length;
            const totalCount = result.files.length;
            
            return {
                type: 'success',
                message: `📖 Read ${successCount}/${totalCount} files successfully`,
                files: result.files
            };
        }
        
        return {
            type: 'success',
            message: `📖 File read completed`,
            details: result
        };
    }

    formatWriteFileResult(result) {
        return {
            type: 'success',
            message: `📝 File ${result.operation || 'written'}: ${result.path} (${result.lines} lines, ${result.size} bytes)`,
            details: result
        };
    }

    formatListFilesResult(result) {
        const message = result.hit_limit 
            ? `📁 Listed ${result.displayed_count}/${result.total_count} files in ${result.path} (${result.recursive ? 'recursive' : 'top-level'})`
            : `📁 Listed ${result.displayed_count} files in ${result.path} (${result.recursive ? 'recursive' : 'top-level'})`;
            
        return {
            type: 'success',
            message: message,
            files: result.files
        };
    }

    formatExecuteCommandResult(result) {
        const status = result.exit_code === 0 ? '✅' : '❌';
        const message = `${status} Command executed: ${result.command} (exit code: ${result.exit_code}, ${result.execution_time}ms)`;
        
        return {
            type: result.exit_code === 0 ? 'success' : 'warning',
            message: message,
            output: result.output,
            error_output: result.error_output,
            details: result
        };
    }

    formatSearchFilesResult(result) {
        const message = result.hit_limit
            ? `🔍 Found ${result.displayed_matches}/${result.total_matches} matches in ${result.path}`
            : `🔍 Found ${result.total_matches} matches in ${result.path}`;
            
        return {
            type: 'success',
            message: message,
            matches: result.results
        };
    }
}

module.exports = ToolRegistry;