/**
 * Web-compatible abstraction layer for VS Code workspace APIs
 * Provides file system operations and workspace management
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';

export interface WebWorkspaceFolder {
  uri: { fsPath: string };
  name: string;
  index: number;
}

export interface WebTextDocument {
  uri: { fsPath: string };
  fileName: string;
  languageId: string;
  getText(): string;
  lineCount: number;
}

export interface WebFileSystemWatcher extends EventEmitter {
  dispose(): void;
}

export class WebWorkspace extends EventEmitter {
  private _workspaceFolders: WebWorkspaceFolder[] = [];
  private _rootPath: string;

  constructor(rootPath: string) {
    super();
    this._rootPath = rootPath;
    this._workspaceFolders = [{
      uri: { fsPath: rootPath },
      name: path.basename(rootPath),
      index: 0
    }];
  }

  get workspaceFolders(): WebWorkspaceFolder[] | undefined {
    return this._workspaceFolders.length > 0 ? this._workspaceFolders : undefined;
  }

  get rootPath(): string | undefined {
    return this._rootPath;
  }

  async openTextDocument(uri: string | { fsPath: string }): Promise<WebTextDocument> {
    const filePath = typeof uri === 'string' ? uri : uri.fsPath;
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    return {
      uri: { fsPath: filePath },
      fileName: filePath,
      languageId: this.getLanguageId(filePath),
      getText: () => content,
      lineCount: lines.length
    };
  }

  private getLanguageId(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: { [key: string]: string } = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescriptreact',
      '.jsx': 'javascriptreact',
      '.py': 'python',
      '.java': 'java',
      '.c': 'c',
      '.cpp': 'cpp',
      '.h': 'c',
      '.hpp': 'cpp',
      '.cs': 'csharp',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.sh': 'shellscript',
      '.bash': 'shellscript',
      '.zsh': 'shellscript',
      '.fish': 'shellscript',
      '.ps1': 'powershell',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.less': 'less',
      '.json': 'json',
      '.xml': 'xml',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.md': 'markdown',
      '.sql': 'sql',
      '.dockerfile': 'dockerfile'
    };
    
    return languageMap[ext] || 'plaintext';
  }

  createFileSystemWatcher(globPattern: string): WebFileSystemWatcher {
    const watcher = new EventEmitter() as WebFileSystemWatcher;
    
    // Basic file system watching implementation
    // In a full implementation, you might use chokidar or similar
    watcher.dispose = () => {
      watcher.removeAllListeners();
    };
    
    return watcher;
  }

  async findFiles(include: string, exclude?: string): Promise<{ fsPath: string }[]> {
    const results: { fsPath: string }[] = [];
    
    const searchInDirectory = async (dir: string) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            // Skip node_modules and other common ignore patterns
            if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
              await searchInDirectory(fullPath);
            }
          } else if (entry.isFile()) {
            // Simple pattern matching (in a full implementation, use minimatch)
            if (include === '**/*' || fullPath.includes(include.replace('**/*', ''))) {
              if (!exclude || !fullPath.includes(exclude)) {
                results.push({ fsPath: fullPath });
              }
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };
    
    await searchInDirectory(this._rootPath);
    return results;
  }

  // File system operations
  get fs() {
    return {
      readFile: async (uri: { fsPath: string }): Promise<Uint8Array> => {
        const buffer = await fs.readFile(uri.fsPath);
        return new Uint8Array(buffer);
      },
      
      writeFile: async (uri: { fsPath: string }, content: Uint8Array): Promise<void> => {
        await fs.writeFile(uri.fsPath, Buffer.from(content));
      },
      
      delete: async (uri: { fsPath: string }): Promise<void> => {
        await fs.unlink(uri.fsPath);
      },
      
      createDirectory: async (uri: { fsPath: string }): Promise<void> => {
        await fs.mkdir(uri.fsPath, { recursive: true });
      },
      
      stat: async (uri: { fsPath: string }) => {
        const stats = await fs.stat(uri.fsPath);
        return {
          type: stats.isFile() ? 1 : stats.isDirectory() ? 2 : 0,
          size: stats.size,
          mtime: stats.mtime.getTime(),
          ctime: stats.ctime.getTime()
        };
      }
    };
  }

  getWorkspaceFolder(uri: { fsPath: string }): WebWorkspaceFolder | undefined {
    return this._workspaceFolders.find(folder => 
      uri.fsPath.startsWith(folder.uri.fsPath)
    );
  }

  asRelativePath(pathOrUri: string | { fsPath: string }): string {
    const filePath = typeof pathOrUri === 'string' ? pathOrUri : pathOrUri.fsPath;
    return path.relative(this._rootPath, filePath);
  }
}