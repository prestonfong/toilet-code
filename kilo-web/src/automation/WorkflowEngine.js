/**
 * WorkflowEngine - Workflow execution engine for kilo-web
 * Handles workflow execution, tool orchestration, error handling, and monitoring
 * Provides real-time execution feedback and supports conditional logic
 */

const EventEmitter = require('events');

class WorkflowEngine extends EventEmitter {
    constructor(toolRegistry, modeManager, workflowManager) {
        super();
        this.toolRegistry = toolRegistry;
        this.modeManager = modeManager;
        this.workflowManager = workflowManager;
        
        // Execution state
        this.activeExecutions = new Map();
        this.executionHistory = [];
        this.maxConcurrentExecutions = 5;
        
        // Execution options
        this.defaultTimeout = 300000; // 5 minutes
        this.retryAttempts = 3;
        this.retryDelay = 1000; // 1 second
        
        console.log('✅ WorkflowEngine initialized');
    }

    /**
     * Execute a workflow
     */
    async executeWorkflow(workflow, options = {}) {
        const executionId = this.generateExecutionId();
        const startTime = Date.now();

        // Check concurrent executions limit
        if (this.activeExecutions.size >= this.maxConcurrentExecutions) {
            throw new Error('Maximum concurrent workflow executions reached');
        }

        const execution = {
            id: executionId,
            workflowId: workflow.id,
            workflowName: workflow.name,
            status: 'running',
            startTime: startTime,
            currentStep: 0,
            totalSteps: workflow.steps.length,
            variables: { ...workflow.variables, ...options.variables },
            results: [],
            errors: [],
            metadata: {
                triggeredBy: options.triggeredBy || 'manual',
                userId: options.userId,
                mode: this.modeManager.getCurrentModeSlug(),
                timeout: options.timeout || this.defaultTimeout
            }
        };

        this.activeExecutions.set(executionId, execution);

        try {
            this.emit('executionStarted', execution);
            
            const result = await this.runWorkflowSteps(workflow, execution, options);
            
            execution.status = result.success ? 'completed' : 'failed';
            execution.endTime = Date.now();
            execution.duration = execution.endTime - execution.startTime;
            execution.result = result;

            this.emit('executionCompleted', execution);
            return execution;

        } catch (error) {
            execution.status = 'error';
            execution.endTime = Date.now();
            execution.duration = execution.endTime - execution.startTime;
            execution.error = error.message;
            execution.stack = error.stack;

            console.error(`Workflow execution ${executionId} failed:`, error);
            this.emit('executionFailed', execution);
            throw error;

        } finally {
            // Move to history and cleanup
            this.activeExecutions.delete(executionId);
            this.addToHistory(execution);
        }
    }

    /**
     * Run workflow steps sequentially
     */
    async runWorkflowSteps(workflow, execution, options) {
        const results = [];
        let shouldContinue = true;

        for (let i = 0; i < workflow.steps.length && shouldContinue; i++) {
            const step = workflow.steps[i];
            execution.currentStep = i + 1;

            this.emit('stepStarted', { execution, step, stepIndex: i });

            try {
                // Check execution timeout
                if (Date.now() - execution.startTime > execution.metadata.timeout) {
                    throw new Error(`Workflow execution timed out after ${execution.metadata.timeout}ms`);
                }

                // Evaluate step conditions
                if (step.conditions && !this.evaluateConditions(step.conditions, execution.variables)) {
                    console.log(`Step ${i + 1} skipped due to conditions`);
                    results.push({
                        stepIndex: i,
                        status: 'skipped',
                        reason: 'conditions not met'
                    });
                    continue;
                }

                // Execute step
                const stepResult = await this.executeStep(step, execution, options);
                results.push(stepResult);

                // Update execution variables with step outputs
                if (stepResult.outputs) {
                    Object.assign(execution.variables, stepResult.outputs);
                }

                this.emit('stepCompleted', { execution, step, stepResult, stepIndex: i });

                // Check if step failed and has stopOnFailure flag
                if (!stepResult.success && step.stopOnFailure !== false) {
                    shouldContinue = false;
                    console.warn(`Step ${i + 1} failed, stopping workflow execution`);
                }

            } catch (error) {
                const stepResult = {
                    stepIndex: i,
                    status: 'error',
                    error: error.message,
                    success: false
                };
                results.push(stepResult);
                execution.errors.push({ step: i + 1, error: error.message });

                this.emit('stepFailed', { execution, step, error, stepIndex: i });

                // Stop on error unless step is marked as optional
                if (!step.optional) {
                    shouldContinue = false;
                    console.error(`Step ${i + 1} failed:`, error.message);
                }
            }
        }

        return {
            success: results.every(r => r.success || r.status === 'skipped'),
            results: results,
            totalSteps: workflow.steps.length,
            completedSteps: results.filter(r => r.success).length,
            skippedSteps: results.filter(r => r.status === 'skipped').length,
            failedSteps: results.filter(r => !r.success && r.status !== 'skipped').length
        };
    }

    /**
     * Execute a single workflow step
     */
    async executeStep(step, execution, options) {
        const stepStartTime = Date.now();

        try {
            let result;

            switch (step.type) {
                case 'tool':
                    result = await this.executeToolStep(step, execution, options);
                    break;
                case 'command':
                    result = await this.executeCommandStep(step, execution, options);
                    break;
                case 'conditional':
                    result = await this.executeConditionalStep(step, execution, options);
                    break;
                case 'loop':
                    result = await this.executeLoopStep(step, execution, options);
                    break;
                case 'parallel':
                    result = await this.executeParallelStep(step, execution, options);
                    break;
                case 'delay':
                    result = await this.executeDelayStep(step, execution, options);
                    break;
                case 'manual':
                    result = await this.executeManualStep(step, execution, options);
                    break;
                default:
                    throw new Error(`Unknown step type: ${step.type}`);
            }

            return {
                ...result,
                stepIndex: execution.currentStep - 1,
                executionTime: Date.now() - stepStartTime,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            return {
                stepIndex: execution.currentStep - 1,
                status: 'error',
                success: false,
                error: error.message,
                executionTime: Date.now() - stepStartTime,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Execute a tool-based step
     */
    async executeToolStep(step, execution, options) {
        const toolName = step.tool;
        const toolParams = this.resolveVariables(step.parameters || {}, execution.variables);

        if (!this.toolRegistry.getTool(toolName)) {
            throw new Error(`Tool '${toolName}' not found`);
        }

        // Check if tool is allowed in current mode
        if (!this.modeManager.isToolAllowedForCurrentMode(toolName, toolParams)) {
            throw new Error(`Tool '${toolName}' not allowed in current mode`);
        }

        const result = await this.toolRegistry.executeTool(toolName, toolParams);

        return {
            status: result.success ? 'completed' : 'failed',
            success: result.success,
            tool: toolName,
            parameters: toolParams,
            result: result,
            outputs: this.extractOutputs(step.outputs, result)
        };
    }

    /**
     * Execute a command step
     */
    async executeCommandStep(step, execution, options) {
        const command = this.resolveVariables(step.command, execution.variables);
        const workingDir = step.workingDirectory ? 
            this.resolveVariables(step.workingDirectory, execution.variables) : 
            undefined;

        const result = await this.toolRegistry.executeTool('execute_command', {
            command: command,
            cwd: workingDir
        });

        return {
            status: result.success ? 'completed' : 'failed',
            success: result.success,
            command: command,
            result: result,
            outputs: this.extractOutputs(step.outputs, result)
        };
    }

    /**
     * Execute a conditional step
     */
    async executeConditionalStep(step, execution, options) {
        const conditionMet = this.evaluateConditions(step.condition, execution.variables);

        if (conditionMet && step.then) {
            const thenResult = await this.executeStep(step.then, execution, options);
            return {
                status: 'completed',
                success: true,
                conditionMet: true,
                branchTaken: 'then',
                result: thenResult
            };
        } else if (!conditionMet && step.else) {
            const elseResult = await this.executeStep(step.else, execution, options);
            return {
                status: 'completed',
                success: true,
                conditionMet: false,
                branchTaken: 'else',
                result: elseResult
            };
        }

        return {
            status: 'completed',
            success: true,
            conditionMet: conditionMet,
            branchTaken: 'none'
        };
    }

    /**
     * Execute a loop step
     */
    async executeLoopStep(step, execution, options) {
        const iterations = [];
        const items = this.resolveVariables(step.items, execution.variables);
        const maxIterations = step.maxIterations || 100;

        if (!Array.isArray(items)) {
            throw new Error('Loop step requires an array of items');
        }

        for (let i = 0; i < Math.min(items.length, maxIterations); i++) {
            const item = items[i];
            const iterationVars = {
                ...execution.variables,
                [step.itemVariable || 'item']: item,
                [step.indexVariable || 'index']: i
            };

            const tempExecution = { ...execution, variables: iterationVars };
            const iterationResult = await this.executeStep(step.step, tempExecution, options);
            
            iterations.push({
                index: i,
                item: item,
                result: iterationResult
            });

            // Stop on first failure if configured
            if (!iterationResult.success && step.stopOnFailure) {
                break;
            }
        }

        return {
            status: 'completed',
            success: iterations.every(iter => iter.result.success),
            iterations: iterations,
            totalIterations: iterations.length
        };
    }

    /**
     * Execute parallel steps
     */
    async executeParallelStep(step, execution, options) {
        const promises = step.steps.map(async (parallelStep, index) => {
            try {
                const result = await this.executeStep(parallelStep, execution, options);
                return { index, result, success: true };
            } catch (error) {
                return { index, error: error.message, success: false };
            }
        });

        const results = await Promise.all(promises);

        return {
            status: 'completed',
            success: results.every(r => r.success),
            results: results,
            parallelSteps: step.steps.length
        };
    }

    /**
     * Execute a delay step
     */
    async executeDelayStep(step, execution, options) {
        const delay = this.resolveVariables(step.delay, execution.variables);
        const delayMs = typeof delay === 'number' ? delay : parseInt(delay, 10);

        await new Promise(resolve => setTimeout(resolve, delayMs));

        return {
            status: 'completed',
            success: true,
            delay: delayMs
        };
    }

    /**
     * Execute a manual step (requires user intervention)
     */
    async executeManualStep(step, execution, options) {
        // Emit event for manual intervention
        this.emit('manualStepRequired', {
            execution,
            step,
            instructions: step.instructions || step.description
        });

        // For now, automatically mark as completed
        // In a real implementation, this would wait for user confirmation
        return {
            status: 'completed',
            success: true,
            manual: true,
            instructions: step.instructions || step.description
        };
    }

    /**
     * Resolve variables in strings and objects
     */
    resolveVariables(value, variables) {
        if (typeof value === 'string') {
            return value.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
                const trimmedVarName = varName.trim();
                return variables[trimmedVarName] !== undefined ? variables[trimmedVarName] : match;
            });
        } else if (Array.isArray(value)) {
            return value.map(item => this.resolveVariables(item, variables));
        } else if (typeof value === 'object' && value !== null) {
            const resolved = {};
            for (const [key, val] of Object.entries(value)) {
                resolved[key] = this.resolveVariables(val, variables);
            }
            return resolved;
        }
        return value;
    }

    /**
     * Evaluate conditions
     */
    evaluateConditions(conditions, variables) {
        if (!conditions || conditions.length === 0) {
            return true;
        }

        return conditions.every(condition => {
            const { variable, operator, value } = condition;
            const varValue = variables[variable];

            switch (operator) {
                case 'equals':
                case '==':
                    return varValue == value;
                case 'not_equals':
                case '!=':
                    return varValue != value;
                case 'greater_than':
                case '>':
                    return varValue > value;
                case 'less_than':
                case '<':
                    return varValue < value;
                case 'contains':
                    return String(varValue).includes(String(value));
                case 'exists':
                    return varValue !== undefined && varValue !== null;
                case 'not_exists':
                    return varValue === undefined || varValue === null;
                default:
                    console.warn(`Unknown condition operator: ${operator}`);
                    return true;
            }
        });
    }

    /**
     * Extract outputs from step results
     */
    extractOutputs(outputMappings, result) {
        if (!outputMappings || !result) {
            return {};
        }

        const outputs = {};
        for (const [outputName, path] of Object.entries(outputMappings)) {
            outputs[outputName] = this.getNestedValue(result, path);
        }
        return outputs;
    }

    /**
     * Get nested value from object using dot notation
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    /**
     * Generate unique execution ID
     */
    generateExecutionId() {
        return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Add execution to history
     */
    addToHistory(execution) {
        this.executionHistory.unshift(execution);
        
        // Keep only last 100 executions
        if (this.executionHistory.length > 100) {
            this.executionHistory = this.executionHistory.slice(0, 100);
        }
    }

    /**
     * Get execution status
     */
    getExecutionStatus(executionId) {
        return this.activeExecutions.get(executionId);
    }

    /**
     * Cancel workflow execution
     */
    async cancelExecution(executionId) {
        const execution = this.activeExecutions.get(executionId);
        if (execution) {
            execution.status = 'cancelled';
            execution.endTime = Date.now();
            execution.duration = execution.endTime - execution.startTime;
            
            this.activeExecutions.delete(executionId);
            this.addToHistory(execution);
            
            this.emit('executionCancelled', execution);
            return true;
        }
        return false;
    }

    /**
     * Get execution statistics
     */
    getStats() {
        return {
            activeExecutions: this.activeExecutions.size,
            totalExecutions: this.executionHistory.length,
            successfulExecutions: this.executionHistory.filter(e => e.status === 'completed').length,
            failedExecutions: this.executionHistory.filter(e => e.status === 'failed' || e.status === 'error').length,
            cancelledExecutions: this.executionHistory.filter(e => e.status === 'cancelled').length
        };
    }

    /**
     * Get execution history
     */
    getExecutionHistory(limit = 50) {
        return this.executionHistory.slice(0, limit);
    }

    /**
     * Clear execution history
     */
    clearHistory() {
        this.executionHistory = [];
    }
}

module.exports = WorkflowEngine;