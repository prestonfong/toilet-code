const fs = require('fs').promises;
const path = require('path');

/**
 * Write to file tool - web-compatible version of kilocode's writeToFileTool
 * Supports file creation and modification with validation
 */
class WriteToFileTool {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.name = 'write_to_file';
        this.description = 'Request to write content to a file';
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
                },
                line_count: {
                    type: 'string', 
                    description: 'Expected number of lines in the content'
                }
            },
            required: ['path', 'content']
        };
    }

    async execute(parameters, provider) {
        const { path: filePath, content, line_count } = parameters;

        try {
            if (!filePath) {
                return {
                    success: false,
                    error: 'Missing required parameter: path'
                };
            }

            if (content === undefined) {
                return {
                    success: false,
                    error: 'Missing required parameter: content'
                };
            }

            // Validate path
            const fullPath = this.validatePath(filePath);
            
            // Check if file exists
            let fileExists = false;
            try {
                const stats = await fs.stat(fullPath);
                fileExists = stats.isFile();
            } catch (error) {
                // File doesn't exist, which is fine
                fileExists = false;
            }

            // Clean content (remove markdown code block markers if present)
            let cleanContent = content;
            if (cleanContent.startsWith('```')) {
                cleanContent = cleanContent.split('\n').slice(1).join('\n');
            }
            if (cleanContent.endsWith('```')) {
                cleanContent = cleanContent.split('\n').slice(0, -1).join('\n');
            }

            // Validate line count if provided
            if (line_count) {
                const expectedLines = parseInt(line_count, 10);
                const actualLines = cleanContent.split('\n').length;
                
                if (!isNaN(expectedLines) && actualLines !== expectedLines) {
                    return {
                        success: false,
                        error: `Line count mismatch: expected ${expectedLines} lines, got ${actualLines} lines. Please provide the complete file content without truncation.`
                    };
                }
            }

            // Detect potential code omissions
            if (this.detectCodeOmission(cleanContent)) {
                return {
                    success: false,
                    error: 'Content appears to contain omission comments (e.g., "// rest of code unchanged", "/* previous code */"). Please provide the complete file content without any omissions.'
                };
            }

            // Ensure directory exists
            const dirPath = path.dirname(fullPath);
            await fs.mkdir(dirPath, { recursive: true });

            // Write file
            await fs.writeFile(fullPath, cleanContent, 'utf8');
            
            // Get file stats
            const stats = await fs.stat(fullPath);
            const actualLineCount = cleanContent.split('\n').length;

            return {
                success: true,
                path: filePath,
                size: stats.size,
                lines: actualLineCount,
                operation: fileExists ? 'modified' : 'created',
                message: `File ${fileExists ? 'modified' : 'created'} successfully: ${filePath}`
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

    detectCodeOmission(content) {
        // Detect common patterns that indicate code omission
        const omissionPatterns = [
            /\/\/\s*rest\s+of\s+code/i,
            /\/\/\s*previous\s+code/i,
            /\/\*\s*rest\s+of\s+code/i,
            /\/\*\s*previous\s+code/i,
            /\/\/\s*\.\.\./,
            /\/\*\s*\.\.\./,
            /#\s*rest\s+of\s+code/i,
            /#\s*previous\s+code/i,
            /#\s*\.\.\./,
            /\/\/\s*other\s+code/i,
            /\/\*\s*other\s+code/i,
            /#\s*other\s+code/i,
            /\/\/\s*existing\s+code/i,
            /\/\*\s*existing\s+code/i,
            /#\s*existing\s+code/i
        ];

        return omissionPatterns.some(pattern => pattern.test(content));
    }
}

module.exports = WriteToFileTool;