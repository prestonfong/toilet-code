const fs = require('fs').promises;
const path = require('path');

/**
 * Read file tool - web-compatible version of kilocode's readFileTool
 * Supports single and multiple file reading with line ranges
 */
class ReadFileTool {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.name = 'read_file';
        this.description = 'Request to read the contents of one or more files';
        this.input_schema = {
            type: 'object',
            properties: {
                args: {
                    type: 'string',
                    description: 'XML containing file entries with paths and optional line ranges'
                },
                path: {
                    type: 'string',
                    description: 'Legacy: Single file path (use args instead)'
                },
                start_line: {
                    type: 'string',
                    description: 'Legacy: Starting line number (use args instead)'
                },
                end_line: {
                    type: 'string',
                    description: 'Legacy: Ending line number (use args instead)'
                }
            },
            required: []
        };
    }

    async execute(parameters, provider) {
        const { args, path: legacyPath, start_line, end_line } = parameters;
        const fileEntries = [];

        try {
            // Parse file entries from XML or legacy parameters
            if (args) {
                const parsed = this.parseXML(args);
                const files = Array.isArray(parsed.file) ? parsed.file : [parsed.file].filter(Boolean);
                
                for (const file of files) {
                    if (!file.path) continue;
                    
                    const fileEntry = {
                        path: file.path,
                        lineRanges: []
                    };
                    
                    if (file.line_range) {
                        const ranges = Array.isArray(file.line_range) ? file.line_range : [file.line_range];
                        for (const range of ranges) {
                            const match = String(range).match(/(\d+)-(\d+)/);
                            if (match) {
                                const [, start, end] = match.map(Number);
                                if (!isNaN(start) && !isNaN(end)) {
                                    fileEntry.lineRanges.push({ start, end });
                                }
                            }
                        }
                    }
                    fileEntries.push(fileEntry);
                }
            } else if (legacyPath) {
                const fileEntry = { path: legacyPath, lineRanges: [] };
                
                if (start_line && end_line) {
                    const start = parseInt(start_line, 10);
                    const end = parseInt(end_line, 10);
                    if (!isNaN(start) && !isNaN(end) && start > 0 && end > 0) {
                        fileEntry.lineRanges.push({ start, end });
                    }
                }
                fileEntries.push(fileEntry);
            }

            if (fileEntries.length === 0) {
                return {
                    success: false,
                    error: 'No valid file paths provided in args or path parameter'
                };
            }

            // Process each file
            const results = [];
            for (const fileEntry of fileEntries) {
                try {
                    const fullPath = this.validatePath(fileEntry.path);
                    const stats = await fs.stat(fullPath);
                    
                    if (!stats.isFile()) {
                        results.push({
                            path: fileEntry.path,
                            success: false,
                            error: `Path is not a file: ${fileEntry.path}`
                        });
                        continue;
                    }

                    let content;
                    
                    // Handle line ranges
                    if (fileEntry.lineRanges && fileEntry.lineRanges.length > 0) {
                        const allLines = (await fs.readFile(fullPath, 'utf8')).split('\n');
                        const rangeContents = [];
                        
                        for (const range of fileEntry.lineRanges) {
                            if (range.start > range.end) {
                                results.push({
                                    path: fileEntry.path,
                                    success: false,
                                    error: 'Invalid line range: end line cannot be less than start line'
                                });
                                continue;
                            }
                            
                            const startIdx = Math.max(0, range.start - 1);
                            const endIdx = Math.min(allLines.length, range.end);
                            const rangeLines = allLines.slice(startIdx, endIdx);
                            
                            const numberedLines = rangeLines.map((line, idx) => 
                                `${(startIdx + idx + 1).toString().padStart(3)} | ${line}`
                            ).join('\n');
                            
                            rangeContents.push({
                                range: `${range.start}-${range.end}`,
                                content: numberedLines
                            });
                        }
                        
                        results.push({
                            path: fileEntry.path,
                            success: true,
                            ranges: rangeContents,
                            totalLines: allLines.length
                        });
                    } else {
                        // Read full file
                        content = await fs.readFile(fullPath, 'utf8');
                        const lines = content.split('\n');
                        const numberedContent = lines.map((line, index) => 
                            `${(index + 1).toString().padStart(3)} | ${line}`
                        ).join('\n');

                        results.push({
                            path: fileEntry.path,
                            success: true,
                            content: numberedContent,
                            lines: lines.length
                        });
                    }
                } catch (error) {
                    results.push({
                        path: fileEntry.path,
                        success: false,
                        error: error.message
                    });
                }
            }

            return {
                success: true,
                files: results
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
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

    parseXML(xmlString) {
        // Simple XML parser for file args
        const fileRegex = /<file>([\s\S]*?)<\/file>/g;
        const pathRegex = /<path>(.*?)<\/path>/;
        const rangeRegex = /<line_range>(.*?)<\/line_range>/g;
        
        const files = [];
        let fileMatch;
        
        while ((fileMatch = fileRegex.exec(xmlString)) !== null) {
            const fileContent = fileMatch[1];
            const pathMatch = pathRegex.exec(fileContent);
            
            if (pathMatch) {
                const file = { path: pathMatch[1] };
                
                const ranges = [];
                let rangeMatch;
                while ((rangeMatch = rangeRegex.exec(fileContent)) !== null) {
                    ranges.push(rangeMatch[1]);
                }
                
                if (ranges.length > 0) {
                    file.line_range = ranges;
                }
                
                files.push(file);
            }
        }
        
        return { file: files };
    }
}

module.exports = ReadFileTool;