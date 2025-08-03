const fs = require('fs').promises;
const path = require('path');

/**
 * File operations tool for web environment
 * Provides secure file read/write operations within workspace
 */
class FileTool {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.name = 'read_file';
        this.description = 'Read the contents of a file';
        this.input_schema = {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'Path to the file to read (relative to workspace)'
                }
            },
            required: ['path']
        };
    }

    /**
     * Execute the tool
     */
    async execute(parameters, provider) {
        const { path: filePath } = parameters;
        
        try {
            // Validate path is within workspace
            const fullPath = this.validatePath(filePath);
            
            // Check if file exists
            const stats = await fs.stat(fullPath);
            if (!stats.isFile()) {
                throw new Error(`Path is not a file: ${filePath}`);
            }

            // Read file content
            const content = await fs.readFile(fullPath, 'utf8');
            
            // Add line numbers for easier reference
            const lines = content.split('\n');
            const numberedContent = lines.map((line, index) => 
                `${(index + 1).toString().padStart(3)} | ${line}`
            ).join('\n');

            return {
                success: true,
                content: numberedContent,
                path: filePath,
                lines: lines.length
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                path: filePath
            };
        }
    }

    /**
     * Validate file path is within workspace and normalize it
     */
    validatePath(filePath) {
        // Remove any leading slashes and resolve relative paths
        const cleanPath = filePath.replace(/^\/+/, '');
        const fullPath = path.resolve(this.workspaceRoot, cleanPath);
        
        // Ensure the resolved path is within the workspace
        if (!fullPath.startsWith(path.resolve(this.workspaceRoot))) {
            throw new Error(`Path is outside workspace: ${filePath}`);
        }
        
        return fullPath;
    }
}

/**
 * Write file tool
 */
class WriteFileTool {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.name = 'write_to_file';
        this.description = 'Write content to a file';
        this.input_schema = {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'Path to the file to write (relative to workspace)'
                },
                content: {
                    type: 'string',
                    description: 'Content to write to the file'
                }
            },
            required: ['path', 'content']
        };
    }

    async execute(parameters, provider) {
        const { path: filePath, content } = parameters;
        
        try {
            // Validate path is within workspace
            const fullPath = this.validatePath(filePath);
            
            // Ensure directory exists
            const dirPath = path.dirname(fullPath);
            await fs.mkdir(dirPath, { recursive: true });
            
            // Write file content
            await fs.writeFile(fullPath, content, 'utf8');
            
            const stats = await fs.stat(fullPath);
            
            return {
                success: true,
                path: filePath,
                size: stats.size,
                message: `File written successfully: ${filePath}`
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                path: filePath
            };
        }
    }

    validatePath(filePath) {
        const cleanPath = filePath.replace(/^\/+/, '');
        const fullPath = path.resolve(this.workspaceRoot, cleanPath);
        
        if (!fullPath.startsWith(path.resolve(this.workspaceRoot))) {
            throw new Error(`Path is outside workspace: ${filePath}`);
        }
        
        return fullPath;
    }
}

/**
 * List files tool
 */
class ListFilesTool {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.name = 'list_files';
        this.description = 'List files and directories in a directory';
        this.input_schema = {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'Directory path to list (relative to workspace, defaults to root)'
                }
            },
            required: []
        };
    }

    async execute(parameters, provider) {
        const { path: dirPath = '' } = parameters;
        
        try {
            // Validate path is within workspace
            const fullPath = this.validatePath(dirPath);
            
            // Check if directory exists
            const stats = await fs.stat(fullPath);
            if (!stats.isDirectory()) {
                throw new Error(`Path is not a directory: ${dirPath}`);
            }

            // Read directory contents
            const entries = await fs.readdir(fullPath, { withFileTypes: true });
            
            const files = await Promise.all(entries.map(async (entry) => {
                const entryPath = path.join(fullPath, entry.name);
                const stats = await fs.stat(entryPath);
                
                return {
                    name: entry.name,
                    path: path.join(dirPath, entry.name),
                    type: entry.isDirectory() ? 'directory' : 'file',
                    size: stats.size,
                    modified: stats.mtime.toISOString()
                };
            }));
            
            return {
                success: true,
                path: dirPath || '.',
                files: files.sort((a, b) => {
                    // Directories first, then files, both alphabetically
                    if (a.type !== b.type) {
                        return a.type === 'directory' ? -1 : 1;
                    }
                    return a.name.localeCompare(b.name);
                })
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                path: dirPath
            };
        }
    }

    validatePath(dirPath) {
        const cleanPath = dirPath.replace(/^\/+/, '') || '.';
        const fullPath = path.resolve(this.workspaceRoot, cleanPath);
        
        if (!fullPath.startsWith(path.resolve(this.workspaceRoot))) {
            throw new Error(`Path is outside workspace: ${dirPath}`);
        }
        
        return fullPath;
    }
}

module.exports = {
    FileTool,
    WriteFileTool,
    ListFilesTool
};