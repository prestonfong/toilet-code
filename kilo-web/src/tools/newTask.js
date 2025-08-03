/**
 * New Task Tool
 * Creates a new task instance in a specified mode
 * Based on kilocode's newTaskTool implementation
 */

class NewTaskTool {
    constructor(workspaceRoot, modeManager = null) {
        this.workspaceRoot = workspaceRoot;
        this.modeManager = modeManager;
        this.name = 'new_task';
        this.description = 'Create a new task instance in the chosen mode using your provided message';
        this.input_schema = {
            type: 'object',
            properties: {
                mode: {
                    type: 'string',
                    description: 'The slug of the mode to start the new task in',
                    enum: ['architect', 'code', 'ask', 'debug', 'orchestrator']
                },
                message: {
                    type: 'string',
                    description: 'The initial user message or instructions for this new task'
                }
            },
            required: ['mode', 'message']
        };
    }

    /**
     * Set the mode manager for this tool
     */
    setModeManager(modeManager) {
        this.modeManager = modeManager;
    }

    /**
     * Execute the new task creation
     */
    async execute(parameters, provider = null) {
        try {
            const { mode, message } = parameters;

            if (!this.modeManager) {
                return {
                    success: false,
                    error: 'Mode manager not available',
                    available_modes: []
                };
            }

            // Validate the target mode exists
            const targetMode = this.modeManager.getModeBySlug(mode);
            if (!targetMode) {
                const availableModes = this.modeManager.getAllModes().map(m => ({
                    slug: m.slug,
                    name: m.name,
                    description: m.description
                }));

                return {
                    success: false,
                    error: `Mode '${mode}' not found`,
                    available_modes: availableModes
                };
            }

            // Create task context
            const taskContext = {
                taskId: this.generateTaskId(),
                parentMode: this.modeManager.getCurrentModeSlug(),
                targetMode: mode,
                initialMessage: message,
                createdAt: new Date().toISOString(),
                status: 'created'
            };

            // Switch to the target mode for this task
            const switchResult = await this.modeManager.switchMode(mode, { 
                reason: `New task created`,
                taskContext: taskContext 
            });

            if (switchResult.success) {
                return {
                    success: true,
                    message: `New task created in ${targetMode.name} mode`,
                    task_id: taskContext.taskId,
                    previous_mode: switchResult.previousMode,
                    current_mode: switchResult.currentMode,
                    initial_message: message,
                    mode_info: {
                        slug: targetMode.slug,
                        name: targetMode.name,
                        description: targetMode.description,
                        roleDefinition: targetMode.roleDefinition,
                        whenToUse: targetMode.whenToUse,
                        customInstructions: targetMode.customInstructions
                    },
                    available_tools: this.modeManager.getCurrentModeTools(),
                    task_context: taskContext
                };
            } else {
                return {
                    success: false,
                    error: 'Failed to switch to target mode for new task',
                    current_mode: this.modeManager.getCurrentModeSlug()
                };
            }

        } catch (error) {
            console.error('Error in new_task tool:', error);
            return {
                success: false,
                error: error.message,
                current_mode: this.modeManager?.getCurrentModeSlug() || 'unknown'
            };
        }
    }

    /**
     * Generate a unique task ID
     */
    generateTaskId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 5);
        return `task_${timestamp}_${random}`;
    }

    /**
     * Get information about creating tasks in different modes
     */
    getTaskCreationInfo() {
        if (!this.modeManager) {
            return {
                available: false,
                modes: []
            };
        }

        const modes = this.modeManager.getAllModes().map(mode => ({
            slug: mode.slug,
            name: mode.name,
            description: mode.description,
            whenToUse: mode.whenToUse,
            iconName: mode.iconName,
            suitableFor: this.getModeCapabilities(mode)
        }));

        return {
            available: true,
            current_mode: this.modeManager.getCurrentModeSlug(),
            modes: modes,
            usage_tips: [
                'Choose the mode that best matches the type of work needed',
                'Provide clear, detailed instructions in the message parameter',
                'The task will start in the specified mode with its specialized capabilities',
                'Each mode has different tools and restrictions available'
            ]
        };
    }

    /**
     * Get capabilities description for a mode
     */
    getModeCapabilities(mode) {
        const capabilities = [];
        
        if (mode.groups) {
            if (mode.groups.includes('read')) {
                capabilities.push('file reading', 'code analysis');
            }
            if (mode.groups.includes('edit')) {
                capabilities.push('file editing', 'code modification');
            }
            if (mode.groups.includes('command')) {
                capabilities.push('command execution', 'testing');
            }
            if (mode.groups.includes('browser')) {
                capabilities.push('web browsing', 'research');
            }
            if (mode.groups.includes('mcp')) {
                capabilities.push('external tools', 'integrations');
            }
        }

        // Add mode-specific capabilities
        switch (mode.slug) {
            case 'architect':
                capabilities.push('planning', 'system design', 'documentation');
                break;
            case 'code':
                capabilities.push('implementation', 'refactoring', 'debugging');
                break;
            case 'ask':
                capabilities.push('explanations', 'Q&A', 'learning');
                break;
            case 'debug':
                capabilities.push('troubleshooting', 'error analysis', 'diagnosis');
                break;
            case 'orchestrator':
                capabilities.push('task coordination', 'workflow management', 'delegation');
                break;
        }

        return capabilities;
    }

    /**
     * Validate task creation parameters
     */
    validateTaskParameters(parameters) {
        const { mode, message } = parameters;
        const errors = [];

        if (!mode || typeof mode !== 'string') {
            errors.push('Mode is required and must be a string');
        }

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            errors.push('Message is required and must be a non-empty string');
        }

        if (this.modeManager && mode && !this.modeManager.getModeBySlug(mode)) {
            const availableModes = this.modeManager.getAllModes().map(m => m.slug);
            errors.push(`Invalid mode '${mode}'. Available modes: ${availableModes.join(', ')}`);
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
}

module.exports = NewTaskTool;