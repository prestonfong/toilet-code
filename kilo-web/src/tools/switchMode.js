/**
 * Switch Mode Tool
 * Allows switching between different AI modes (architect, code, ask, debug, orchestrator)
 * Based on kilocode's switchModeTool implementation
 */

class SwitchModeTool {
    constructor(workspaceRoot, modeManager = null) {
        this.workspaceRoot = workspaceRoot;
        this.modeManager = modeManager;
        this.name = 'switch_mode';
        this.description = 'Switch to a different AI mode with specialized capabilities and behavior';
        this.input_schema = {
            type: 'object',
            properties: {
                mode_slug: {
                    type: 'string',
                    description: 'The slug of the mode to switch to',
                    enum: ['architect', 'code', 'ask', 'debug', 'orchestrator']
                },
                reason: {
                    type: 'string', 
                    description: 'Optional reason for switching modes'
                }
            },
            required: ['mode_slug']
        };
    }

    /**
     * Set the mode manager for this tool
     */
    setModeManager(modeManager) {
        this.modeManager = modeManager;
    }

    /**
     * Execute the mode switch
     */
    async execute(parameters, provider = null) {
        try {
            const { mode_slug, reason } = parameters;

            if (!this.modeManager) {
                return {
                    success: false,
                    error: 'Mode manager not available',
                    available_modes: []
                };
            }

            // Validate the target mode exists
            const targetMode = this.modeManager.getModeBySlug(mode_slug);
            if (!targetMode) {
                const availableModes = this.modeManager.getAllModes().map(mode => ({
                    slug: mode.slug,
                    name: mode.name,
                    description: mode.description
                }));

                return {
                    success: false,
                    error: `Mode '${mode_slug}' not found`,
                    available_modes: availableModes
                };
            }

            // Check if we're already in this mode
            const currentModeSlug = this.modeManager.getCurrentModeSlug();
            if (currentModeSlug === mode_slug) {
                return {
                    success: true,
                    message: `Already in ${targetMode.name} mode`,
                    current_mode: currentModeSlug,
                    mode_info: {
                        slug: targetMode.slug,
                        name: targetMode.name,
                        description: targetMode.description,
                        roleDefinition: targetMode.roleDefinition
                    }
                };
            }

            // Perform the mode switch
            const switchResult = await this.modeManager.switchMode(mode_slug, { reason });

            if (switchResult.success) {
                const message = reason 
                    ? `Switched to ${targetMode.name} mode. Reason: ${reason}`
                    : `Switched to ${targetMode.name} mode`;

                return {
                    success: true,
                    message: message,
                    previous_mode: switchResult.previousMode,
                    current_mode: switchResult.currentMode,
                    mode_info: {
                        slug: targetMode.slug,
                        name: targetMode.name,
                        description: targetMode.description,
                        roleDefinition: targetMode.roleDefinition,
                        whenToUse: targetMode.whenToUse,
                        customInstructions: targetMode.customInstructions
                    },
                    available_tools: this.modeManager.getCurrentModeTools(),
                    reason: reason || null
                };
            } else {
                return {
                    success: false,
                    error: 'Failed to switch mode',
                    current_mode: currentModeSlug
                };
            }

        } catch (error) {
            console.error('Error in switch_mode tool:', error);
            return {
                success: false,
                error: error.message,
                current_mode: this.modeManager?.getCurrentModeSlug() || 'unknown'
            };
        }
    }

    /**
     * Get information about all available modes
     */
    getAvailableModes() {
        if (!this.modeManager) {
            return [];
        }

        return this.modeManager.getAllModes().map(mode => ({
            slug: mode.slug,
            name: mode.name,
            description: mode.description,
            iconName: mode.iconName,
            whenToUse: mode.whenToUse,
            groups: mode.groups || []
        }));
    }

    /**
     * Get current mode information
     */
    getCurrentModeInfo() {
        if (!this.modeManager) {
            return null;
        }

        const currentMode = this.modeManager.getCurrentMode();
        const currentModeSlug = this.modeManager.getCurrentModeSlug();

        return {
            slug: currentModeSlug,
            name: currentMode?.name || 'Unknown',
            description: currentMode?.description || '',
            iconName: currentMode?.iconName || '',
            roleDefinition: currentMode?.roleDefinition || '',
            whenToUse: currentMode?.whenToUse || '',
            customInstructions: currentMode?.customInstructions || '',
            availableTools: this.modeManager.getCurrentModeTools()
        };
    }
}

module.exports = SwitchModeTool;