/**
 * WorkflowManager - Core workflow management system for kilo-web
 * Handles workflow creation, execution, persistence, and management
 * Based on kilocode's workflow system architecture
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class WorkflowManager {
    constructor(workspaceDir, toolRegistry, modeManager) {
        this.workspaceDir = workspaceDir;
        this.toolRegistry = toolRegistry;
        this.modeManager = modeManager;
        this.workflowsDir = path.join(workspaceDir, '.kilo', 'workflows');
        this.globalWorkflowsDir = path.join(require('os').homedir(), '.kilo', 'workflows');
        
        // Active workflows and execution state
        this.activeWorkflows = new Map();
        this.workflowHistory = [];
        this.workflowToggles = new Map(); // Local workflow toggles
        this.globalWorkflowToggles = new Map(); // Global workflow toggles
        
        // Event listeners
        this.eventListeners = new Map();
        
        // Workflow templates
        this.templates = new Map();
        
        this.initialize();
    }

    async initialize() {
        try {
            // Ensure workflow directories exist
            await this.ensureDirectories();
            
            // Load existing workflows
            await this.loadWorkflows();
            
            // Load workflow toggles
            await this.loadWorkflowToggles();
            
            console.log('✅ WorkflowManager initialized successfully');
        } catch (error) {
            console.error('❌ WorkflowManager initialization failed:', error);
            throw error;
        }
    }

    async ensureDirectories() {
        const dirs = [
            this.workflowsDir,
            this.globalWorkflowsDir,
            path.join(this.workspaceDir, '.kilo', 'workflow-history'),
            path.join(this.workspaceDir, '.kilo', 'workflow-templates')
        ];

        for (const dir of dirs) {
            await fs.mkdir(dir, { recursive: true });
        }
    }

    async loadWorkflows() {
        try {
            // Load local workflows
            const localWorkflows = await this.loadWorkflowsFromDirectory(this.workflowsDir, false);
            
            // Load global workflows
            const globalWorkflows = await this.loadWorkflowsFromDirectory(this.globalWorkflowsDir, true);
            
            console.log(`📁 Loaded ${localWorkflows.length} local workflows and ${globalWorkflows.length} global workflows`);
        } catch (error) {
            console.error('Error loading workflows:', error);
        }
    }

    async loadWorkflowsFromDirectory(directory, isGlobal) {
        const workflows = [];
        
        try {
            const files = await fs.readdir(directory);
            
            for (const file of files) {
                if (file.endsWith('.md') || file.endsWith('.yaml') || file.endsWith('.json')) {
                    const filePath = path.join(directory, file);
                    try {
                        const workflow = await this.loadWorkflowFile(filePath, isGlobal);
                        if (workflow) {
                            workflows.push(workflow);
                        }
                    } catch (error) {
                        console.warn(`Failed to load workflow file ${filePath}:`, error.message);
                    }
                }
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`Error reading workflows directory ${directory}:`, error);
            }
        }
        
        return workflows;
    }

    async loadWorkflowFile(filePath, isGlobal) {
        const content = await fs.readFile(filePath, 'utf8');
        const fileName = path.basename(filePath);
        const baseName = path.basename(filePath, path.extname(filePath));
        
        // Parse workflow based on file type
        let workflow;
        if (filePath.endsWith('.json')) {
            workflow = JSON.parse(content);
        } else if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
            // Simple YAML parsing for basic workflows
            workflow = this.parseSimpleYaml(content);
        } else {
            // Markdown format (compatible with kilocode)
            workflow = this.parseMarkdownWorkflow(content, baseName);
        }

        return {
            id: crypto.createHash('md5').update(filePath).digest('hex'),
            name: workflow.name || baseName,
            description: workflow.description || '',
            filePath: filePath,
            fileName: fileName,
            isGlobal: isGlobal,
            enabled: this.getWorkflowToggleState(filePath, isGlobal),
            type: workflow.type || 'manual',
            triggers: workflow.triggers || [],
            steps: workflow.steps || [],
            variables: workflow.variables || {},
            conditions: workflow.conditions || [],
            metadata: {
                created: workflow.created || new Date().toISOString(),
                modified: (await fs.stat(filePath)).mtime.toISOString(),
                version: workflow.version || '1.0.0',
                tags: workflow.tags || []
            },
            raw: content
        };
    }

    parseMarkdownWorkflow(content, name) {
        const lines = content.split('\n');
        const workflow = {
            name: name,
            description: '',
            steps: [],
            variables: {},
            triggers: []
        };

        let currentSection = 'description';
        let currentStep = null;

        for (const line of lines) {
            const trimmed = line.trim();
            
            if (trimmed.startsWith('# ')) {
                workflow.name = trimmed.substring(2).trim();
            } else if (trimmed.startsWith('## Steps')) {
                currentSection = 'steps';
            } else if (trimmed.startsWith('## Variables')) {
                currentSection = 'variables';
            } else if (trimmed.startsWith('## Triggers')) {
                currentSection = 'triggers';
            } else if (trimmed.match(/^\d+\./)) {
                // Step item
                if (currentSection === 'steps') {
                    const stepText = trimmed.replace(/^\d+\.\s*/, '');
                    workflow.steps.push({
                        type: 'manual',
                        description: stepText,
                        action: this.parseStepAction(stepText)
                    });
                }
            } else if (trimmed && currentSection === 'description') {
                workflow.description += (workflow.description ? '\n' : '') + trimmed;
            }
        }

        return workflow;
    }

    parseStepAction(stepText) {
        // Parse common step patterns
        if (stepText.includes('execute') || stepText.includes('run')) {
            return { type: 'command', command: stepText };
        } else if (stepText.includes('create') || stepText.includes('write')) {
            return { type: 'file_operation', operation: 'create' };
        } else if (stepText.includes('test')) {
            return { type: 'test', command: stepText };
        }
        
        return { type: 'manual', description: stepText };
    }

    parseSimpleYaml(content) {
        // Basic YAML parsing for workflow definitions
        const lines = content.split('\n');
        const workflow = {};
        let currentKey = null;
        let currentArray = null;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;

            if (trimmed.includes(':') && !trimmed.startsWith('-')) {
                const [key, value] = trimmed.split(':', 2);
                const cleanKey = key.trim();
                const cleanValue = value ? value.trim() : '';

                if (cleanValue) {
                    workflow[cleanKey] = cleanValue;
                } else {
                    currentKey = cleanKey;
                    currentArray = [];
                    workflow[cleanKey] = currentArray;
                }
            } else if (trimmed.startsWith('-') && currentArray) {
                currentArray.push(trimmed.substring(1).trim());
            }
        }

        return workflow;
    }

    async loadWorkflowToggles() {
        try {
            // Load local workflow toggles
            const localTogglesPath = path.join(this.workspaceDir, '.kilo', 'workflow-toggles.json');
            try {
                const localData = await fs.readFile(localTogglesPath, 'utf8');
                const localToggles = JSON.parse(localData);
                for (const [key, value] of Object.entries(localToggles)) {
                    this.workflowToggles.set(key, value);
                }
            } catch (error) {
                // File doesn't exist yet, that's okay
            }

            // Load global workflow toggles
            const globalTogglesPath = path.join(require('os').homedir(), '.kilo', 'global-workflow-toggles.json');
            try {
                const globalData = await fs.readFile(globalTogglesPath, 'utf8');
                const globalToggles = JSON.parse(globalData);
                for (const [key, value] of Object.entries(globalToggles)) {
                    this.globalWorkflowToggles.set(key, value);
                }
            } catch (error) {
                // File doesn't exist yet, that's okay
            }
        } catch (error) {
            console.error('Error loading workflow toggles:', error);
        }
    }

    async saveWorkflowToggles() {
        try {
            // Save local toggles
            const localTogglesPath = path.join(this.workspaceDir, '.kilo', 'workflow-toggles.json');
            const localToggles = Object.fromEntries(this.workflowToggles);
            await fs.writeFile(localTogglesPath, JSON.stringify(localToggles, null, 2));

            // Save global toggles
            const globalTogglesPath = path.join(require('os').homedir(), '.kilo', 'global-workflow-toggles.json');
            const globalToggles = Object.fromEntries(this.globalWorkflowToggles);
            await fs.writeFile(globalTogglesPath, JSON.stringify(globalToggles, null, 2));
        } catch (error) {
            console.error('Error saving workflow toggles:', error);
        }
    }

    getWorkflowToggleState(filePath, isGlobal) {
        const toggles = isGlobal ? this.globalWorkflowToggles : this.workflowToggles;
        return toggles.get(filePath) ?? true; // Default enabled
    }

    async toggleWorkflow(filePath, enabled, isGlobal) {
        const toggles = isGlobal ? this.globalWorkflowToggles : this.workflowToggles;
        toggles.set(filePath, enabled);
        await this.saveWorkflowToggles();
        
        this.emit('workflowToggled', { filePath, enabled, isGlobal });
    }

    async getEnabledWorkflows() {
        const enabled = [];
        
        // Get enabled local workflows
        for (const [filePath, isEnabled] of this.workflowToggles) {
            if (isEnabled) {
                try {
                    const workflow = await this.loadWorkflowFile(filePath, false);
                    if (workflow) {
                        enabled.push(workflow);
                    }
                } catch (error) {
                    console.warn(`Failed to load enabled workflow ${filePath}:`, error.message);
                }
            }
        }

        // Get enabled global workflows
        for (const [filePath, isEnabled] of this.globalWorkflowToggles) {
            if (isEnabled) {
                try {
                    const workflow = await this.loadWorkflowFile(filePath, true);
                    if (workflow) {
                        enabled.push(workflow);
                    }
                } catch (error) {
                    console.warn(`Failed to load enabled global workflow ${filePath}:`, error.message);
                }
            }
        }

        return enabled;
    }

    async createWorkflow(config) {
        const workflowId = crypto.randomUUID();
        const workflow = {
            id: workflowId,
            name: config.name,
            description: config.description || '',
            type: config.type || 'manual',
            steps: config.steps || [],
            variables: config.variables || {},
            triggers: config.triggers || [],
            conditions: config.conditions || [],
            metadata: {
                created: new Date().toISOString(),
                modified: new Date().toISOString(),
                version: '1.0.0',
                tags: config.tags || []
            }
        };

        // Save workflow to file
        const isGlobal = config.isGlobal || false;
        const workflowDir = isGlobal ? this.globalWorkflowsDir : this.workflowsDir;
        const fileName = `${config.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.json`;
        const filePath = path.join(workflowDir, fileName);

        await fs.writeFile(filePath, JSON.stringify(workflow, null, 2));
        
        // Enable by default
        await this.toggleWorkflow(filePath, true, isGlobal);

        this.emit('workflowCreated', workflow);
        return workflow;
    }

    async deleteWorkflow(workflowId, filePath) {
        try {
            await fs.unlink(filePath);
            
            // Remove from toggles
            this.workflowToggles.delete(filePath);
            this.globalWorkflowToggles.delete(filePath);
            await this.saveWorkflowToggles();

            this.emit('workflowDeleted', { workflowId, filePath });
            return true;
        } catch (error) {
            console.error('Error deleting workflow:', error);
            return false;
        }
    }

    // Event system
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            const index = listeners.indexOf(callback);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in workflow event listener for ${event}:`, error);
                }
            });
        }
    }

    // Get workflow by file name (for slash command integration)
    async getWorkflowByFileName(fileName) {
        const enabled = await this.getEnabledWorkflows();
        return enabled.find(workflow => workflow.fileName === fileName);
    }

    // Get workflow statistics
    getStats() {
        return {
            localWorkflows: this.workflowToggles.size,
            globalWorkflows: this.globalWorkflowToggles.size,
            activeWorkflows: this.activeWorkflows.size,
            historyEntries: this.workflowHistory.length
        };
    }
}

module.exports = WorkflowManager;