/**
 * WorkflowTemplates - Predefined workflow templates for common development tasks
 * Provides ready-to-use workflows for build, test, deploy, and other automation patterns
 */

class WorkflowTemplates {
    constructor() {
        this.templates = new Map();
        this.loadDefaultTemplates();
    }

    loadDefaultTemplates() {
        // Development workflow templates
        this.templates.set('build-test-deploy', this.createBuildTestDeployTemplate());
        this.templates.set('code-review-prep', this.createCodeReviewPrepTemplate());
        this.templates.set('project-setup', this.createProjectSetupTemplate());
        this.templates.set('release-workflow', this.createReleaseWorkflowTemplate());
        this.templates.set('database-migration', this.createDatabaseMigrationTemplate());
        this.templates.set('security-scan', this.createSecurityScanTemplate());
        this.templates.set('documentation-update', this.createDocumentationUpdateTemplate());
        this.templates.set('dependency-update', this.createDependencyUpdateTemplate());
        this.templates.set('backup-restore', this.createBackupRestoreTemplate());
        this.templates.set('performance-test', this.createPerformanceTestTemplate());

        console.log(`✅ Loaded ${this.templates.size} workflow templates`);
    }

    createBuildTestDeployTemplate() {
        return {
            name: 'Build, Test & Deploy',
            description: 'Complete CI/CD pipeline with build, test, and deployment steps',
            category: 'deployment',
            tags: ['ci-cd', 'build', 'test', 'deploy'],
            variables: {
                environment: 'staging',
                branch: 'main',
                testSuite: 'all',
                deployTarget: 'server'
            },
            steps: [
                {
                    type: 'tool',
                    name: 'Clean workspace',
                    tool: 'execute_command',
                    parameters: {
                        command: 'npm run clean'
                    },
                    optional: true
                },
                {
                    type: 'tool',
                    name: 'Install dependencies',
                    tool: 'execute_command',
                    parameters: {
                        command: 'npm ci'
                    },
                    outputs: {
                        installTime: 'execution_time_ms'
                    }
                },
                {
                    type: 'tool',
                    name: 'Run linting',
                    tool: 'execute_command',
                    parameters: {
                        command: 'npm run lint'
                    },
                    stopOnFailure: true
                },
                {
                    type: 'tool',
                    name: 'Build application',
                    tool: 'execute_command',
                    parameters: {
                        command: 'npm run build'
                    },
                    outputs: {
                        buildTime: 'execution_time_ms'
                    }
                },
                {
                    type: 'conditional',
                    name: 'Run tests if test suite specified',
                    condition: [
                        { variable: 'testSuite', operator: 'not_equals', value: 'none' }
                    ],
                    then: {
                        type: 'tool',
                        tool: 'execute_command',
                        parameters: {
                            command: 'npm run test:{{testSuite}}'
                        }
                    }
                },
                {
                    type: 'tool',
                    name: 'Deploy to {{environment}}',
                    tool: 'execute_command',
                    parameters: {
                        command: 'npm run deploy:{{environment}}'
                    },
                    conditions: [
                        { variable: 'environment', operator: 'exists' }
                    ]
                },
                {
                    type: 'tool',
                    name: 'Verify deployment',
                    tool: 'execute_command',
                    parameters: {
                        command: 'npm run verify:{{environment}}'
                    },
                    optional: true
                }
            ]
        };
    }

    createCodeReviewPrepTemplate() {
        return {
            name: 'Code Review Preparation',
            description: 'Prepare code for review with formatting, linting, and test validation',
            category: 'development',
            tags: ['code-review', 'formatting', 'linting', 'testing'],
            variables: {
                branch: 'current',
                fixFormatting: 'true',
                runTests: 'true'
            },
            steps: [
                {
                    type: 'tool',
                    name: 'Get current branch',
                    tool: 'execute_command',
                    parameters: {
                        command: 'git branch --show-current'
                    },
                    outputs: {
                        currentBranch: 'output'
                    }
                },
                {
                    type: 'conditional',
                    name: 'Auto-fix formatting',
                    condition: [
                        { variable: 'fixFormatting', operator: 'equals', value: 'true' }
                    ],
                    then: {
                        type: 'tool',
                        tool: 'execute_command',
                        parameters: {
                            command: 'npm run format:fix'
                        }
                    }
                },
                {
                    type: 'tool',
                    name: 'Run linting',
                    tool: 'execute_command',
                    parameters: {
                        command: 'npm run lint'
                    }
                },
                {
                    type: 'conditional',
                    name: 'Run tests if enabled',
                    condition: [
                        { variable: 'runTests', operator: 'equals', value: 'true' }
                    ],
                    then: {
                        type: 'tool',
                        tool: 'execute_command',
                        parameters: {
                            command: 'npm test'
                        }
                    }
                },
                {
                    type: 'tool',
                    name: 'Check for uncommitted changes',
                    tool: 'execute_command',
                    parameters: {
                        command: 'git status --porcelain'
                    },
                    outputs: {
                        hasChanges: 'output'
                    }
                },
                {
                    type: 'manual',
                    name: 'Review changes and commit',
                    instructions: 'Review the changes made by formatting and linting, then commit if needed.',
                    conditions: [
                        { variable: 'hasChanges', operator: 'exists' }
                    ]
                }
            ]
        };
    }

    createProjectSetupTemplate() {
        return {
            name: 'Project Setup',
            description: 'Initialize a new project with standard configuration and dependencies',
            category: 'setup',
            tags: ['initialization', 'setup', 'configuration'],
            variables: {
                projectName: 'my-project',
                projectType: 'nodejs',
                includeTests: 'true',
                includeLinting: 'true',
                packageManager: 'npm'
            },
            steps: [
                {
                    type: 'tool',
                    name: 'Create project directory',
                    tool: 'execute_command',
                    parameters: {
                        command: 'mkdir -p {{projectName}}'
                    }
                },
                {
                    type: 'tool',
                    name: 'Initialize package.json',
                    tool: 'execute_command',
                    parameters: {
                        command: '{{packageManager}} init -y',
                        cwd: '{{projectName}}'
                    }
                },
                {
                    type: 'conditional',
                    name: 'Setup linting if enabled',
                    condition: [
                        { variable: 'includeLinting', operator: 'equals', value: 'true' }
                    ],
                    then: {
                        type: 'parallel',
                        steps: [
                            {
                                type: 'tool',
                                tool: 'execute_command',
                                parameters: {
                                    command: '{{packageManager}} install --save-dev eslint',
                                    cwd: '{{projectName}}'
                                }
                            },
                            {
                                type: 'tool',
                                tool: 'write_to_file',
                                parameters: {
                                    path: '{{projectName}}/.eslintrc.json',
                                    content: '{"extends": ["eslint:recommended"], "env": {"node": true, "es6": true}}'
                                }
                            }
                        ]
                    }
                },
                {
                    type: 'conditional',
                    name: 'Setup testing if enabled',
                    condition: [
                        { variable: 'includeTests', operator: 'equals', value: 'true' }
                    ],
                    then: {
                        type: 'tool',
                        tool: 'execute_command',
                        parameters: {
                            command: '{{packageManager}} install --save-dev jest',
                            cwd: '{{projectName}}'
                        }
                    }
                },
                {
                    type: 'tool',
                    name: 'Create README.md',
                    tool: 'write_to_file',
                    parameters: {
                        path: '{{projectName}}/README.md',
                        content: '# {{projectName}}\n\nProject description here.\n\n## Installation\n\n```bash\n{{packageManager}} install\n```\n\n## Usage\n\nUsage instructions here.'
                    }
                },
                {
                    type: 'tool',
                    name: 'Create .gitignore',
                    tool: 'write_to_file',
                    parameters: {
                        path: '{{projectName}}/.gitignore',
                        content: 'node_modules/\n.env\n.DS_Store\ndist/\nbuild/\n*.log'
                    }
                }
            ]
        };
    }

    createReleaseWorkflowTemplate() {
        return {
            name: 'Release Workflow',
            description: 'Complete release process with version bumping, tagging, and publishing',
            category: 'release',
            tags: ['release', 'version', 'publish', 'git'],
            variables: {
                versionType: 'patch',
                createTag: 'true',
                publishPackage: 'false',
                updateChangelog: 'true'
            },
            steps: [
                {
                    type: 'tool',
                    name: 'Check working directory is clean',
                    tool: 'execute_command',
                    parameters: {
                        command: 'git status --porcelain'
                    },
                    outputs: {
                        hasChanges: 'output'
                    }
                },
                {
                    type: 'conditional',
                    name: 'Abort if working directory has changes',
                    condition: [
                        { variable: 'hasChanges', operator: 'exists' }
                    ],
                    then: {
                        type: 'manual',
                        instructions: 'Working directory has uncommitted changes. Please commit or stash them before proceeding with release.'
                    }
                },
                {
                    type: 'tool',
                    name: 'Run tests before release',
                    tool: 'execute_command',
                    parameters: {
                        command: 'npm test'
                    }
                },
                {
                    type: 'tool',
                    name: 'Bump version',
                    tool: 'execute_command',
                    parameters: {
                        command: 'npm version {{versionType}} --no-git-tag-version'
                    },
                    outputs: {
                        newVersion: 'output'
                    }
                },
                {
                    type: 'conditional',
                    name: 'Update changelog if enabled',
                    condition: [
                        { variable: 'updateChangelog', operator: 'equals', value: 'true' }
                    ],
                    then: {
                        type: 'manual',
                        instructions: 'Update CHANGELOG.md with new version {{newVersion}} and release notes.'
                    }
                },
                {
                    type: 'tool',
                    name: 'Commit version changes',
                    tool: 'execute_command',
                    parameters: {
                        command: 'git add -A && git commit -m "Release {{newVersion}}"'
                    }
                },
                {
                    type: 'conditional',
                    name: 'Create git tag if enabled',
                    condition: [
                        { variable: 'createTag', operator: 'equals', value: 'true' }
                    ],
                    then: {
                        type: 'tool',
                        tool: 'execute_command',
                        parameters: {
                            command: 'git tag v{{newVersion}}'
                        }
                    }
                },
                {
                    type: 'conditional',
                    name: 'Publish package if enabled',
                    condition: [
                        { variable: 'publishPackage', operator: 'equals', value: 'true' }
                    ],
                    then: {
                        type: 'tool',
                        tool: 'execute_command',
                        parameters: {
                            command: 'npm publish'
                        }
                    }
                },
                {
                    type: 'tool',
                    name: 'Push changes and tags',
                    tool: 'execute_command',
                    parameters: {
                        command: 'git push && git push --tags'
                    }
                }
            ]
        };
    }

    createDatabaseMigrationTemplate() {
        return {
            name: 'Database Migration',
            description: 'Run database migrations with backup and rollback capabilities',
            category: 'database',
            tags: ['database', 'migration', 'backup'],
            variables: {
                environment: 'development',
                createBackup: 'true',
                migrationDirection: 'up'
            },
            steps: [
                {
                    type: 'conditional',
                    name: 'Create database backup',
                    condition: [
                        { variable: 'createBackup', operator: 'equals', value: 'true' }
                    ],
                    then: {
                        type: 'tool',
                        tool: 'execute_command',
                        parameters: {
                            command: 'npm run db:backup:{{environment}}'
                        }
                    }
                },
                {
                    type: 'tool',
                    name: 'Check migration status',
                    tool: 'execute_command',
                    parameters: {
                        command: 'npm run migrate:status:{{environment}}'
                    },
                    outputs: {
                        migrationStatus: 'output'
                    }
                },
                {
                    type: 'tool',
                    name: 'Run migrations',
                    tool: 'execute_command',
                    parameters: {
                        command: 'npm run migrate:{{migrationDirection}}:{{environment}}'
                    }
                },
                {
                    type: 'tool',
                    name: 'Verify migration success',
                    tool: 'execute_command',
                    parameters: {
                        command: 'npm run migrate:verify:{{environment}}'
                    },
                    optional: true
                },
                {
                    type: 'manual',
                    name: 'Manual verification',
                    instructions: 'Verify that the database migration completed successfully and test critical functionality.'
                }
            ]
        };
    }

    createSecurityScanTemplate() {
        return {
            name: 'Security Scan',
            description: 'Comprehensive security scanning for vulnerabilities and compliance',
            category: 'security',
            tags: ['security', 'vulnerability', 'audit'],
            variables: {
                scanType: 'full',
                fixVulnerabilities: 'false',
                generateReport: 'true'
            },
            steps: [
                {
                    type: 'tool',
                    name: 'Dependency vulnerability scan',
                    tool: 'execute_command',
                    parameters: {
                        command: 'npm audit'
                    },
                    outputs: {
                        auditResults: 'output'
                    }
                },
                {
                    type: 'conditional',
                    name: 'Auto-fix vulnerabilities if enabled',
                    condition: [
                        { variable: 'fixVulnerabilities', operator: 'equals', value: 'true' }
                    ],
                    then: {
                        type: 'tool',
                        tool: 'execute_command',
                        parameters: {
                            command: 'npm audit fix'
                        }
                    }
                },
                {
                    type: 'conditional',
                    name: 'Run full security scan',
                    condition: [
                        { variable: 'scanType', operator: 'equals', value: 'full' }
                    ],
                    then: {
                        type: 'parallel',
                        steps: [
                            {
                                type: 'tool',
                                tool: 'execute_command',
                                parameters: {
                                    command: 'npm run security:scan'
                                }
                            },
                            {
                                type: 'tool',
                                tool: 'execute_command',
                                parameters: {
                                    command: 'npm run lint:security'
                                }
                            }
                        ]
                    }
                },
                {
                    type: 'conditional',
                    name: 'Generate security report',
                    condition: [
                        { variable: 'generateReport', operator: 'equals', value: 'true' }
                    ],
                    then: {
                        type: 'tool',
                        tool: 'execute_command',
                        parameters: {
                            command: 'npm run security:report'
                        }
                    }
                }
            ]
        };
    }

    createDocumentationUpdateTemplate() {
        return {
            name: 'Documentation Update',
            description: 'Generate and update project documentation automatically',
            category: 'documentation',
            tags: ['documentation', 'readme', 'api-docs'],
            variables: {
                generateApiDocs: 'true',
                updateReadme: 'true',
                includeExamples: 'true'
            },
            steps: [
                {
                    type: 'conditional',
                    name: 'Generate API documentation',
                    condition: [
                        { variable: 'generateApiDocs', operator: 'equals', value: 'true' }
                    ],
                    then: {
                        type: 'tool',
                        tool: 'execute_command',
                        parameters: {
                            command: 'npm run docs:generate'
                        }
                    }
                },
                {
                    type: 'conditional',
                    name: 'Update README.md',
                    condition: [
                        { variable: 'updateReadme', operator: 'equals', value: 'true' }
                    ],
                    then: {
                        type: 'tool',
                        tool: 'execute_command',
                        parameters: {
                            command: 'npm run readme:update'
                        }
                    }
                },
                {
                    type: 'conditional',
                    name: 'Generate examples',
                    condition: [
                        { variable: 'includeExamples', operator: 'equals', value: 'true' }
                    ],
                    then: {
                        type: 'tool',
                        tool: 'execute_command',
                        parameters: {
                            command: 'npm run examples:generate'
                        }
                    }
                },
                {
                    type: 'tool',
                    name: 'Commit documentation changes',
                    tool: 'execute_command',
                    parameters: {
                        command: 'git add docs/ README.md && git commit -m "Update documentation" || echo "No documentation changes to commit"'
                    }
                }
            ]
        };
    }

    createDependencyUpdateTemplate() {
        return {
            name: 'Dependency Update',
            description: 'Update project dependencies with testing and verification',
            category: 'maintenance',
            tags: ['dependencies', 'updates', 'maintenance'],
            variables: {
                updateType: 'minor',
                runTests: 'true',
                createPR: 'false'
            },
            steps: [
                {
                    type: 'tool',
                    name: 'Check for outdated packages',
                    tool: 'execute_command',
                    parameters: {
                        command: 'npm outdated'
                    },
                    outputs: {
                        outdatedPackages: 'output'
                    }
                },
                {
                    type: 'tool',
                    name: 'Update dependencies',
                    tool: 'execute_command',
                    parameters: {
                        command: 'npm update'
                    }
                },
                {
                    type: 'conditional',
                    name: 'Run tests after update',
                    condition: [
                        { variable: 'runTests', operator: 'equals', value: 'true' }
                    ],
                    then: {
                        type: 'tool',
                        tool: 'execute_command',
                        parameters: {
                            command: 'npm test'
                        }
                    }
                },
                {
                    type: 'tool',
                    name: 'Check for security vulnerabilities',
                    tool: 'execute_command',
                    parameters: {
                        command: 'npm audit'
                    }
                },
                {
                    type: 'conditional',
                    name: 'Create pull request',
                    condition: [
                        { variable: 'createPR', operator: 'equals', value: 'true' }
                    ],
                    then: {
                        type: 'manual',
                        instructions: 'Create a pull request with the dependency updates for review.'
                    }
                }
            ]
        };
    }

    createBackupRestoreTemplate() {
        return {
            name: 'Backup & Restore',
            description: 'Create backups and restore from previous backups',
            category: 'maintenance',
            tags: ['backup', 'restore', 'data'],
            variables: {
                operation: 'backup',
                target: 'database',
                environment: 'production'
            },
            steps: [
                {
                    type: 'conditional',
                    name: 'Create backup',
                    condition: [
                        { variable: 'operation', operator: 'equals', value: 'backup' }
                    ],
                    then: {
                        type: 'tool',
                        tool: 'execute_command',
                        parameters: {
                            command: 'npm run backup:{{target}}:{{environment}}'
                        }
                    }
                },
                {
                    type: 'conditional',
                    name: 'Restore from backup',
                    condition: [
                        { variable: 'operation', operator: 'equals', value: 'restore' }
                    ],
                    then: {
                        type: 'manual',
                        instructions: 'Select backup file to restore from and confirm the restore operation.'
                    }
                },
                {
                    type: 'tool',
                    name: 'Verify operation',
                    tool: 'execute_command',
                    parameters: {
                        command: 'npm run verify:{{target}}:{{environment}}'
                    },
                    optional: true
                }
            ]
        };
    }

    createPerformanceTestTemplate() {
        return {
            name: 'Performance Testing',
            description: 'Run performance tests and generate optimization reports',
            category: 'testing',
            tags: ['performance', 'testing', 'optimization'],
            variables: {
                testType: 'load',
                duration: '60',
                users: '100',
                generateReport: 'true'
            },
            steps: [
                {
                    type: 'tool',
                    name: 'Start application',
                    tool: 'execute_command',
                    parameters: {
                        command: 'npm run start:test'
                    },
                    outputs: {
                        appPid: 'output'
                    }
                },
                {
                    type: 'delay',
                    name: 'Wait for application startup',
                    delay: 5000
                },
                {
                    type: 'tool',
                    name: 'Run performance tests',
                    tool: 'execute_command',
                    parameters: {
                        command: 'npm run test:performance -- --type={{testType}} --duration={{duration}} --users={{users}}'
                    },
                    outputs: {
                        testResults: 'output'
                    }
                },
                {
                    type: 'conditional',
                    name: 'Generate performance report',
                    condition: [
                        { variable: 'generateReport', operator: 'equals', value: 'true' }
                    ],
                    then: {
                        type: 'tool',
                        tool: 'execute_command',
                        parameters: {
                            command: 'npm run perf:report'
                        }
                    }
                },
                {
                    type: 'tool',
                    name: 'Stop application',
                    tool: 'execute_command',
                    parameters: {
                        command: 'npm run stop:test'
                    },
                    optional: true
                }
            ]
        };
    }

    /**
     * Get all available templates
     */
    getAllTemplates() {
        return Array.from(this.templates.values());
    }

    /**
     * Get templates by category
     */
    getTemplatesByCategory(category) {
        return Array.from(this.templates.values()).filter(template => 
            template.category === category
        );
    }

    /**
     * Get templates by tag
     */
    getTemplatesByTag(tag) {
        return Array.from(this.templates.values()).filter(template => 
            template.tags && template.tags.includes(tag)
        );
    }

    /**
     * Get template by name
     */
    getTemplate(name) {
        return this.templates.get(name);
    }

    /**
     * Add custom template
     */
    addTemplate(name, template) {
        this.templates.set(name, {
            ...template,
            custom: true,
            created: new Date().toISOString()
        });
        return template;
    }

    /**
     * Remove template
     */
    removeTemplate(name) {
        return this.templates.delete(name);
    }

    /**
     * Get template categories
     */
    getCategories() {
        const categories = new Set();
        this.templates.forEach(template => {
            if (template.category) {
                categories.add(template.category);
            }
        });
        return Array.from(categories);
    }

    /**
     * Get all tags
     */
    getAllTags() {
        const tags = new Set();
        this.templates.forEach(template => {
            if (template.tags) {
                template.tags.forEach(tag => tags.add(tag));
            }
        });
        return Array.from(tags);
    }

    /**
     * Search templates
     */
    searchTemplates(query) {
        const searchTerm = query.toLowerCase();
        return Array.from(this.templates.values()).filter(template => 
            template.name.toLowerCase().includes(searchTerm) ||
            template.description.toLowerCase().includes(searchTerm) ||
            (template.tags && template.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
        );
    }

    /**
     * Create workflow from template
     */
    createWorkflowFromTemplate(templateName, customVariables = {}) {
        const template = this.templates.get(templateName);
        if (!template) {
            throw new Error(`Template '${templateName}' not found`);
        }

        return {
            name: template.name,
            description: template.description,
            type: 'automated',
            steps: template.steps,
            variables: { ...template.variables, ...customVariables },
            metadata: {
                template: templateName,
                category: template.category,
                tags: template.tags || [],
                created: new Date().toISOString(),
                version: '1.0.0'
            }
        };
    }

    /**
     * Get template statistics
     */
    getStats() {
        const templates = Array.from(this.templates.values());
        const categories = this.getCategories();
        
        return {
            totalTemplates: templates.length,
            categories: categories.length,
            customTemplates: templates.filter(t => t.custom).length,
            builtInTemplates: templates.filter(t => !t.custom).length,
            averageSteps: Math.round(
                templates.reduce((sum, t) => sum + (t.steps?.length || 0), 0) / templates.length
            )
        };
    }
}

module.exports = WorkflowTemplates;