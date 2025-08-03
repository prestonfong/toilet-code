const fs = require('fs').promises;
const path = require('path');

/**
 * List files tool - web-compatible version of kilocode's listFilesTool
 * Supports recursive and non-recursive directory listing
 */
class ListFilesTool {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.name = 'list_files';
        this.description = 'Request to list files and directories within a specified directory';
        this.input_schema = {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'Directory path to list (relative to workspace, defaults to root)'
                },
                recursive: {
                    type: 'string',
                    description: 'Whether to list files recursively (true/false)'
                }
            },
            required: ['path']
        };
    }

    async execute(parameters, provider) {
        const { path: dirPath, recursive } = parameters;
        const isRecursive = recursive?.toLowerCase() === 'true';

        try {
            if (!dirPath) {
                return {
                    success: false,
                    error: 'Missing required parameter: path'
                };
            }

            // Validate path
            const fullPath = this.validatePath(dirPath);
            
            // Check if directory exists
            const stats = await fs.stat(fullPath);
            if (!stats.isDirectory()) {
                return {
                    success: false,
                    error: `Path is not a directory: ${dirPath}`
                };
            }

            // List files
            const files = isRecursive 
                ? await this.listFilesRecursive(fullPath, dirPath)
                : await this.listFilesTopLevel(fullPath, dirPath);

            // Apply file limit (similar to kilocode's 200 file limit)
            const fileLimit = 200;
            const didHitLimit = files.length > fileLimit;
            const limitedFiles = files.slice(0, fileLimit);

            return {
                success: true,
                path: dirPath,
                files: limitedFiles,
                total_count: files.length,
                displayed_count: limitedFiles.length,
                hit_limit: didHitLimit,
                recursive: isRecursive,
                message: didHitLimit 
                    ? `Showing first ${fileLimit} of ${files.length} files. Use a more specific path to see additional files.`
                    : `Found ${files.length} ${isRecursive ? 'files and directories' : 'items'}`
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                path: dirPath
            };
        }
    }

    async listFilesTopLevel(fullPath, relativePath) {
        const items = [];
        const entries = await fs.readdir(fullPath, { withFileTypes: true });

        for (const entry of entries) {
            const entryFullPath = path.join(fullPath, entry.name);
            const entryRelativePath = path.join(relativePath, entry.name);

            const item = {
                name: entry.name,
                path: entryRelativePath.replace(/\\/g, '/'), // Normalize path separators
                type: entry.isDirectory() ? 'directory' : 'file'
            };

            if (entry.isFile()) {
                try {
                    const stats = await fs.stat(entryFullPath);
                    item.size = stats.size;
                    item.modified = stats.mtime.toISOString();
                } catch (error) {
                    // Continue without stats if we can't get them
                }
            }

            items.push(item);
        }

        // Sort: directories first, then files, both alphabetically
        return items.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });
    }

    async listFilesRecursive(fullPath, relativePath, items = []) {
        try {
            const entries = await fs.readdir(fullPath, { withFileTypes: true });

            for (const entry of entries) {
                const entryFullPath = path.join(fullPath, entry.name);
                const entryRelativePath = path.join(relativePath, entry.name);

                // Skip common ignore patterns
                if (this.shouldIgnore(entry.name)) {
                    continue;
                }

                const item = {
                    name: entry.name,
                    path: entryRelativePath.replace(/\\/g, '/'), // Normalize path separators
                    type: entry.isDirectory() ? 'directory' : 'file'
                };

                if (entry.isFile()) {
                    try {
                        const stats = await fs.stat(entryFullPath);
                        item.size = stats.size;
                        item.modified = stats.mtime.toISOString();
                    } catch (error) {
                        // Continue without stats if we can't get them
                    }
                }

                items.push(item);

                // Recurse into directories
                if (entry.isDirectory()) {
                    await this.listFilesRecursive(entryFullPath, entryRelativePath, items);
                }
            }
        } catch (error) {
            // Skip directories we can't read
            console.warn(`Cannot read directory ${fullPath}:`, error.message);
        }

        // Sort at the end
        return items.sort((a, b) => {
            // First by directory depth, then by type, then by name
            const aDepth = a.path.split('/').length;
            const bDepth = b.path.split('/').length;
            
            if (aDepth !== bDepth) {
                return aDepth - bDepth;
            }
            
            if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
            }
            
            return a.path.localeCompare(b.path);
        });
    }

    shouldIgnore(fileName) {
        // Common patterns to ignore (similar to .gitignore)
        const ignorePatterns = [
            /^\.git$/,
            /^\.svn$/,
            /^\.hg$/,
            /^\.bzr$/,
            /^CVS$/,
            /^\.DS_Store$/,
            /^Thumbs\.db$/,
            /^desktop\.ini$/,
            /^node_modules$/,
            /^\.vscode$/,
            /^\.idea$/,
            /^__pycache__$/,
            /^\.pytest_cache$/,
            /^\.coverage$/,
            /^\.nyc_output$/,
            /^coverage$/,
            /^dist$/,
            /^build$/,
            /^out$/,
            /^target$/,
            /^bin$/,
            /^obj$/,
            /^\.next$/,
            /^\.nuxt$/,
            /^\.cache$/,
            /^\.tmp$/,
            /^\.temp$/,
            /^logs$/,
            /^\.log$/,
            /.*\.log$/
        ];

        return ignorePatterns.some(pattern => pattern.test(fileName));
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

module.exports = ListFilesTool;