/**
 * ModeAwareToolRegistry
 * Enhanced version of ToolRegistry with mode awareness and tool filtering
 * Integrates with ModeManager to enforce mode-specific tool restrictions
 */

const ToolRegistry = require('./ToolRegistry');
const { FileRestrictionError } = require('../modes/ModeConfig');

class ModeAwareToolRegistry extends ToolRegistry {
    constructor(workspaceRoot, modeManager = null) {
        super(workspaceRoot);
        this.modeManager = modeManager;
        
        console.log('🔧 ModeAwareToolRegistry initialized');
    }

    /**
     * Set the mode manager for this tool registry
     */
    setModeManager(modeManager) {
        this.modeManager = modeManager;
        console.log('🔧 ModeManager connected to ToolRegistry');
    }

    /**
     * Get available tools filtered by current mode
     */
    getAvailableTools() {
        const allTools = super.getAvailableTools();
        
        if (!this.modeManager) {
            return allTools;
        }

        const allowedTools = this.modeManager.getCurrentModeTools();
        
        return allTools.filter(tool => allowedTools.includes(tool.name));
    }

    /**
     * Get available tools for a specific mode
     */
    getAvailableToolsForMode(modeSlug) {
        const allTools = super.getAvailableTools();
        
        if (!this.modeManager) {
            return allTools;
        }

        const allowedTools = this.modeManager.getToolsForMode(modeSlug);
        
        return allTools.filter(tool => allowedTools.includes(tool.name));
    }

    /**
     * Execute a tool with mode validation
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

            // Mode-aware tool validation
            if (this.modeManager) {
                try {
                    const isAllowed = this.modeManager.isToolAllowedForCurrentMode(toolName, parameters);
                    if (!isAllowed) {
                        const currentMode = this.modeManager.getCurrentModeSlug();
                        const allowedTools = this.modeManager.getCurrentModeTools();
                        
                        return {
                            success: false,
                            error: `Tool '${toolName}' is not allowed in mode '${currentMode}'`,
                            tool: toolName,
                            current_mode: currentMode,
                            allowed_tools: allowedTools
                        };
                    }
                } catch (error) {
                    if (error instanceof FileRestrictionError) {
                        return {
                            success: false,
                            error: error.message,
                            tool: toolName,
                            restriction_type: 'file_pattern',
                            current_mode: this.modeManager.getCurrentModeSlug()
                        };
                    }
                    // Re-throw other errors
                    throw error;
                }
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
            console.log(`🔧 [TOOL] Executing ${toolName} in mode ${this.modeManager?.getCurrentModeSlug() || 'unknown'}`);
            
            const result = await tool.execute(parameters, provider);
            const executionTime = Date.now() - startTime;

            // Add metadata to result
            const enhancedResult = {
                ...result,
                tool: toolName,
                execution_time_ms: executionTime,
                timestamp: new Date().toISOString(),
                mode: this.modeManager?.getCurrentModeSlug() || null
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
                timestamp: new Date().toISOString(),
                mode: this.modeManager?.getCurrentModeSlug() || null
            };
        }
    }

    /**
     * Execute multiple tools in sequence with mode validation
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
            total_execution_time_ms: results.reduce((sum, r) => sum + (r.execution_time_ms || 0), 0),
            mode: this.modeManager?.getCurrentModeSlug() || null
        };
    }

    /**
     * Check if a tool is available in current mode
     */
    isToolAvailableInCurrentMode(toolName) {
        if (!this.modeManager) {
            return this.tools.has(toolName);
        }

        const allowedTools = this.modeManager.getCurrentModeTools();
        return this.tools.has(toolName) && allowedTools.includes(toolName);
    }

    /**
     * Check if a tool is available in a specific mode
     */
    isToolAvailableInMode(toolName, modeSlug) {
        if (!this.modeManager) {
            return this.tools.has(toolName);
        }

        const allowedTools = this.modeManager.getToolsForMode(modeSlug);
        return this.tools.has(toolName) && allowedTools.includes(toolName);
    }

    /**
     * Get mode-filtered tool result format
     */
    formatToolResult(result) {
        const formatted = super.formatToolResult(result);
        
        // Add mode information to formatted result
        if (result.mode) {
            formatted.mode = result.mode;
        }
        
        return formatted;
    }

    /**
     * Get current mode information
     */
    getCurrentModeInfo() {
        if (!this.modeManager) {
            return null;
        }

        const mode = this.modeManager.getCurrentMode();
        const availableTools = this.getAvailableTools();
        
        return {
            slug: this.modeManager.getCurrentModeSlug(),
            name: mode?.name || 'Unknown',
            description: mode?.description || '',
            iconName: mode?.iconName || '',
            availableTools: availableTools.map(tool => tool.name),
            totalTools: availableTools.length
        };
    }

    /**
     * Get information about all modes and their tool availability
     */
    getAllModesToolInfo() {
        if (!this.modeManager) {
            return [];
        }

        return this.modeManager.getAllModes().map(mode => {
            const availableTools = this.getAvailableToolsForMode(mode.slug);
            
            return {
                slug: mode.slug,
                name: mode.name,
                description: mode.description,
                iconName: mode.iconName,
                availableTools: availableTools.map(tool => tool.name),
                totalTools: availableTools.length,
                groups: mode.groups || []
            };
        });
    }

    /**
     * Validate if a specific operation is allowed in current mode
     */
    validateOperation(toolName, parameters) {
        if (!this.modeManager) {
            return { valid: true };
        }

        try {
            const isAllowed = this.modeManager.isToolAllowedForCurrentMode(toolName, parameters);
            return { valid: isAllowed };
        } catch (error) {
            if (error instanceof FileRestrictionError) {
                return {
                    valid: false,
                    error: error.message,
                    type: 'file_restriction'
                };
            }
            return {
                valid: false,
                error: error.message,
                type: 'unknown'
            };
        }
    }

    /**
     * Get statistics about tool usage by mode
     */
    getToolUsageStats() {
        if (!this.modeManager) {
            return null;
        }

        const stats = {
            currentMode: this.modeManager.getCurrentModeSlug(),
            modesCount: this.modeManager.getAllModes().length,
            toolsInCurrentMode: this.getAvailableTools().length,
            totalToolsAvailable: this.tools.size,
            modeRestrictions: 0
        };

        // Count modes with restrictions
        this.modeManager.getAllModes().forEach(mode => {
            if (mode.groups) {
                mode.groups.forEach(group => {
                    if (Array.isArray(group) && group[1]) {
                        stats.modeRestrictions++;
                    }
                });
            }
        });

        return stats;
    }
}

module.exports = ModeAwareToolRegistry;