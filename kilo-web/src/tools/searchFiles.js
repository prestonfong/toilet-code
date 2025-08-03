const fs = require('fs').promises;
const path = require('path');

/**
 * Search files tool - web-compatible version of kilocode's searchFilesTool
 * Supports regex search across files with file pattern filtering
 */
class SearchFilesTool {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.name = 'search_files';
        this.description = 'Request to perform a regex search across files in a specified directory';
        this.input_schema = {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'Directory path to search in (relative to workspace)'
                },
                regex: {
                    type: 'string',
                    description: 'Regular expression pattern to search for'
                },
                file_pattern: {
                    type: 'string',
                    description: 'Glob pattern to filter files (e.g., *.ts for TypeScript files)'
                }
            },
            required: ['path', 'regex']
        };
    }

    async execute(parameters, provider) {
        const { path: searchPath, regex, file_pattern } = parameters;

        try {
            if (!searchPath) {
                return {
                    success: false,
                    error: 'Missing required parameter: path'
                };
            }

            if (!regex) {
                return {
                    success: false,
                    error: 'Missing required parameter: regex'
                };
            }

            // Validate path
            const fullPath = this.validatePath(searchPath);
            
            // Check if directory exists
            const stats = await fs.stat(fullPath);
            if (!stats.isDirectory()) {
                return {
                    success: false,
                    error: `Path is not a directory: ${searchPath}`
                };
            }

            // Create regex pattern
            let regexPattern;
            try {
                regexPattern = new RegExp(regex, 'gm'); // global, multiline
            } catch (error) {
                return {
                    success: false,
                    error: `Invalid regex pattern: ${error.message}`
                };
            }

            // Search files
            const results = await this.searchInDirectory(
                fullPath, 
                searchPath, 
                regexPattern, 
                file_pattern
            );

            // Limit results to prevent overwhelming output
            const maxResults = 1000;
            const limitedResults = results.slice(0, maxResults);

            return {
                success: true,
                path: searchPath,
                regex: regex,
                file_pattern: file_pattern || '*',
                results: limitedResults,
                total_matches: results.length,
                displayed_matches: limitedResults.length,
                hit_limit: results.length > maxResults
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                path: searchPath
            };
        }
    }

    async searchInDirectory(fullPath, relativePath, regexPattern, filePattern) {
        const results = [];
        
        try {
            const entries = await fs.readdir(fullPath, { withFileTypes: true });

            for (const entry of entries) {
                const entryFullPath = path.join(fullPath, entry.name);
                const entryRelativePath = path.join(relativePath, entry.name);

                // Skip ignored directories and files
                if (this.shouldIgnore(entry.name)) {
                    continue;
                }

                if (entry.isDirectory()) {
                    // Recursively search subdirectories
                    const subResults = await this.searchInDirectory(
                        entryFullPath,
                        entryRelativePath,
                        regexPattern,
                        filePattern
                    );
                    results.push(...subResults);
                } else if (entry.isFile()) {
                    // Check if file matches pattern
                    if (!this.matchesFilePattern(entry.name, filePattern)) {
                        continue;
                    }

                    // Search within the file
                    const fileResults = await this.searchInFile(
                        entryFullPath,
                        entryRelativePath,
                        regexPattern
                    );
                    results.push(...fileResults);
                }
            }
        } catch (error) {
            // Skip directories we can't read
            console.warn(`Cannot read directory ${fullPath}:`, error.message);
        }

        return results;
    }

    async searchInFile(fullPath, relativePath, regexPattern) {
        const results = [];

        try {
            // Skip binary files and very large files
            const stats = await fs.stat(fullPath);
            const maxFileSize = 10 * 1024 * 1024; // 10MB limit
            
            if (stats.size > maxFileSize) {
                return results; // Skip very large files
            }

            // Check if file is likely binary
            if (this.isBinaryFile(relativePath)) {
                return results;
            }

            // Read file content
            const content = await fs.readFile(fullPath, 'utf8');
            const lines = content.split('\n');

            // Reset regex to start from beginning
            regexPattern.lastIndex = 0;

            // Search for matches
            let match;
            while ((match = regexPattern.exec(content)) !== null) {
                // Find which line this match is on
                const beforeMatch = content.substring(0, match.index);
                const lineNumber = beforeMatch.split('\n').length;
                const line = lines[lineNumber - 1] || '';

                // Get context lines
                const contextBefore = Math.max(0, lineNumber - 3);
                const contextAfter = Math.min(lines.length, lineNumber + 2);
                const contextLines = [];

                for (let i = contextBefore; i < contextAfter; i++) {
                    const isMatchLine = i === lineNumber - 1;
                    contextLines.push({
                        line_number: i + 1,
                        content: lines[i] || '',
                        is_match: isMatchLine
                    });
                }

                results.push({
                    file: relativePath.replace(/\\/g, '/'), // Normalize path separators
                    line_number: lineNumber,
                    column: match.index - beforeMatch.lastIndexOf('\n'),
                    match: match[0],
                    context: contextLines
                });

                // Prevent infinite loops with zero-length matches
                if (match[0].length === 0) {
                    regexPattern.lastIndex++;
                }

                // Limit matches per file
                if (results.length >= 50) {
                    break;
                }
            }

        } catch (error) {
            // Skip files we can't read (might be binary or locked)
            if (error.code !== 'EISDIR') {
                console.warn(`Cannot read file ${fullPath}:`, error.message);
            }
        }

        return results;
    }

    matchesFilePattern(fileName, filePattern) {
        if (!filePattern || filePattern === '*') {
            return true;
        }

        // Convert glob pattern to regex
        const regexPattern = filePattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');

        const regex = new RegExp(`^${regexPattern}$`, 'i');
        return regex.test(fileName);
    }

    isBinaryFile(filePath) {
        const binaryExtensions = [
            '.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.o',
            '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.svg',
            '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.wav',
            '.zip', '.tar', '.gz', '.rar', '.7z', '.bz2',
            '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
            '.sqlite', '.db', '.mdb'
        ];

        const ext = path.extname(filePath).toLowerCase();
        return binaryExtensions.includes(ext);
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
            /^\..+\.log$/,
            /.*\.log$/
        ];

        return ignorePatterns.some(pattern => pattern.test(fileName));
    }

    validatePath(searchPath) {
        const cleanPath = searchPath.replace(/^\/+/, '') || '.';
        const fullPath = path.resolve(this.workspaceRoot, cleanPath);
        
        if (!fullPath.startsWith(path.resolve(this.workspaceRoot))) {
            throw new Error(`Path is outside workspace: ${searchPath}`);
        }
        
        return fullPath;
    }
}

module.exports = SearchFilesTool;