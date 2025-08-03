/**
 * ModeManager
 * Central component for managing modes, mode switching, and tool validation
 * Based on kilocode's mode system architecture
 */

const { 
    DEFAULT_MODES, 
    TOOL_GROUPS, 
    ALWAYS_AVAILABLE_TOOLS,
    getGroupName,
    getGroupOptions,
    doesFileMatchRegex,
    getToolsForMode,
    FileRestrictionError
} = require('./ModeConfig');

// Edit operation parameters that indicate an actual edit operation
const EDIT_OPERATION_PARAMS = ['diff', 'content', 'operations', 'search', 'replace', 'args', 'line'];

class ModeManager {
    constructor(toolRegistry = null) {
        this.currentMode = 'code'; // default mode
        this.modes = new Map();
        this.customModes = new Map();
        this.toolRegistry = toolRegistry;
        this.eventListeners = new Map();
        
        // Initialize with default modes
        this.loadDefaultModes();
        
        console.log(`🎭 ModeManager initialized with ${this.modes.size} modes`);
    }

    /**
     * Load default modes into the mode registry
     */
    loadDefaultModes() {
        DEFAULT_MODES.forEach(mode => {
            this.modes.set(mode.slug, { ...mode, source: 'built-in' });
        });
    }

    /**
     * Get mode by slug, checking custom modes first
     */
    getModeBySlug(slug) {
        return this.customModes.get(slug) || this.modes.get(slug);
    }

    /**
     * Get current mode configuration
     */
    getCurrentMode() {
        return this.getModeBySlug(this.currentMode);
    }

    /**
     * Get current mode slug
     */
    getCurrentModeSlug() {
        return this.currentMode;
    }

    /**
     * Get all available modes (built-in + custom)
     */
    getAllModes() {
        const allModes = [];
        
        // Add built-in modes
        this.modes.forEach(mode => allModes.push(mode));
        
        // Add custom modes (they override built-in modes with same slug)
        this.customModes.forEach(mode => {
            const existingIndex = allModes.findIndex(m => m.slug === mode.slug);
            if (existingIndex !== -1) {
                allModes[existingIndex] = mode; // Override
            } else {
                allModes.push(mode); // Add new
            }
        });
        
        return allModes;
    }

    /**
     * Switch to a different mode
     */
    async switchMode(modeSlug, context = {}) {
        const targetMode = this.getModeBySlug(modeSlug);
        
        if (!targetMode) {
            throw new Error(`Mode '${modeSlug}' not found`);
        }

        const previousMode = this.currentMode;
        this.currentMode = modeSlug;
        
        console.log(`🎭 Mode switched: ${previousMode} → ${modeSlug}`);
        
        // Emit mode change event
        this.emit('modeChanged', {
            previousMode,
            currentMode: modeSlug,
            context
        });
        
        return {
            success: true,
            previousMode,
            currentMode: modeSlug,
            mode: targetMode
        };
    }

    /**
     * Get tools available for current mode
     */
    getCurrentModeTools() {
        const mode = this.getCurrentMode();
        if (!mode) return ALWAYS_AVAILABLE_TOOLS;
        
        return getToolsForMode(mode.groups || []);
    }

    /**
     * Get tools available for a specific mode
     */
    getToolsForMode(modeSlug) {
        const mode = this.getModeBySlug(modeSlug);
        if (!mode) return ALWAYS_AVAILABLE_TOOLS;
        
        return getToolsForMode(mode.groups || []);
    }

    /**
     * Check if a tool is allowed for the current mode
     */
    isToolAllowedForCurrentMode(toolName, toolParams = {}) {
        return this.isToolAllowedForMode(toolName, this.currentMode, toolParams);
    }

    /**
     * Check if a tool is allowed for a specific mode
     */
    isToolAllowedForMode(toolName, modeSlug, toolParams = {}) {
        // Always allow these tools
        if (ALWAYS_AVAILABLE_TOOLS.includes(toolName)) {
            return true;
        }

        const mode = this.getModeBySlug(modeSlug);
        if (!mode) {
            return false;
        }

        // Check if tool is in any of the mode's groups and respects any group options
        for (const group of mode.groups || []) {
            const groupName = getGroupName(group);
            const options = getGroupOptions(group);
            
            const groupConfig = TOOL_GROUPS[groupName];
            
            // If the tool isn't in this group's tools, continue to next group
            if (!groupConfig || !groupConfig.tools.includes(toolName)) {
                continue;
            }

            // If there are no options, allow the tool
            if (!options) {
                return true;
            }

            // For the edit group, check file regex if specified
            if (groupName === 'edit' && options.fileRegex) {
                const filePath = toolParams.path;
                // Check if this is an actual edit operation (not just path-only for streaming)
                const isEditOperation = EDIT_OPERATION_PARAMS.some(param => toolParams[param]);
                
                // Handle single file path validation
                if (filePath && isEditOperation && !doesFileMatchRegex(filePath, options.fileRegex)) {
                    throw new FileRestrictionError(mode.name, options.fileRegex, options.description, filePath, toolName);
                }

                // Handle XML args parameter (used by multi-file operations)
                if (toolParams.args && typeof toolParams.args === 'string') {
                    try {
                        const filePathMatches = toolParams.args.match(/<path>([^<]+)<\/path>/g);
                        if (filePathMatches) {
                            for (const match of filePathMatches) {
                                const pathMatch = match.match(/<path>([^<]+)<\/path>/);
                                if (pathMatch && pathMatch[1]) {
                                    const extractedPath = pathMatch[1].trim();
                                    if (extractedPath && !extractedPath.includes('<') && !extractedPath.includes('>')) {
                                        if (!doesFileMatchRegex(extractedPath, options.fileRegex)) {
                                            throw new FileRestrictionError(
                                                mode.name,
                                                options.fileRegex,
                                                options.description,
                                                extractedPath,
                                                toolName
                                            );
                                        }
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        // Re-throw FileRestrictionError as it's an expected validation error
                        if (error instanceof FileRestrictionError) {
                            throw error;
                        }
                        // If XML parsing fails, log the error but don't block the operation
                        console.warn(`Failed to parse XML args for file restriction validation: ${error}`);
                    }
                }
            }

            return true;
        }

        return false;
    }

    /**
     * Validate tool use for current mode
     */
    validateToolForCurrentMode(toolName, toolParams = {}) {
        try {
            return this.isToolAllowedForCurrentMode(toolName, toolParams);
        } catch (error) {
            if (error instanceof FileRestrictionError) {
                return { valid: false, error: error.message };
            }
            throw error;
        }
    }

    /**
     * Generate system prompt for current mode
     */
    generateSystemPrompt(globalCustomInstructions = '', language = 'en') {
        const mode = this.getCurrentMode();
        if (!mode) {
            return 'You are Kilo Code, an AI assistant for software development.';
        }

        let systemPrompt = '';
        
        // Add role definition
        if (mode.roleDefinition) {
            systemPrompt += mode.roleDefinition;
        }

        // Add mode-specific custom instructions
        if (mode.customInstructions) {
            systemPrompt += '\n\n' + mode.customInstructions;
        }

        // Add global custom instructions if provided
        if (globalCustomInstructions) {
            systemPrompt += '\n\n' + globalCustomInstructions;
        }

        return systemPrompt;
    }

    /**
     * Add custom mode
     */
    addCustomMode(modeConfig) {
        // Validate mode config
        if (!modeConfig.slug || !modeConfig.name || !modeConfig.roleDefinition) {
            throw new Error('Mode config must have slug, name, and roleDefinition');
        }

        // Add source marker
        const customMode = { ...modeConfig, source: 'custom' };
        this.customModes.set(modeConfig.slug, customMode);
        
        console.log(`🎭 Custom mode added: ${modeConfig.slug}`);
        
        this.emit('modeAdded', { mode: customMode });
        
        return customMode;
    }

    /**
     * Remove custom mode
     */
    removeCustomMode(slug) {
        if (this.customModes.has(slug)) {
            const mode = this.customModes.get(slug);
            this.customModes.delete(slug);
            
            // If we're currently in this mode, switch to default
            if (this.currentMode === slug) {
                this.switchMode('code');
            }
            
            console.log(`🎭 Custom mode removed: ${slug}`);
            this.emit('modeRemoved', { mode });
            
            return true;
        }
        return false;
    }

    /**
     * Event system for mode changes
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    /**
     * Remove event listener
     */
    off(event, callback) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            const index = listeners.indexOf(callback);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * Emit event
     */
    emit(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    /**
     * Get mode statistics
     */
    getStats() {
        return {
            totalModes: this.modes.size + this.customModes.size,
            builtInModes: this.modes.size,
            customModes: this.customModes.size,
            currentMode: this.currentMode,
            availableTools: this.getCurrentModeTools().length
        };
    }

    /**
     * Export current configuration
     */
    exportConfig() {
        return {
            currentMode: this.currentMode,
            customModes: Array.from(this.customModes.values()),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Import configuration
     */
    importConfig(config) {
        if (config.customModes) {
            config.customModes.forEach(mode => {
                this.addCustomMode(mode);
            });
        }
        
        if (config.currentMode && this.getModeBySlug(config.currentMode)) {
            this.switchMode(config.currentMode);
        }
        
        console.log(`🎭 Configuration imported with ${config.customModes?.length || 0} custom modes`);
    }
}

module.exports = ModeManager;