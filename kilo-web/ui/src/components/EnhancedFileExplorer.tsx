import React, { useState, useEffect, useCallback, useRef } from 'react';
import { kiloClient } from '../utils/webClient';

interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
}

interface EnhancedFileExplorerProps {
  files: FileItem[];
  currentPath: string;
  onPathChange: (path: string) => void;
  onFileSelect?: (file: FileItem) => void;
  className?: string;
}

export const EnhancedFileExplorer: React.FC<EnhancedFileExplorerProps> = ({
  files,
  currentPath,
  onPathChange,
  onFileSelect,
  className = ''
}) => {
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: FileItem } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set up message handlers
  useEffect(() => {
    const handleFileContent = (data: { content: string; path: string }) => {
      setFileContent(data.content);
      setEditedContent(data.content);
      setIsLoading(false);
    };

    const handleFileWrite = (data: { success: boolean; path: string }) => {
      if (data.success) {
        setIsEditing(false);
        setFileContent(editedContent);
      }
      setIsLoading(false);
    };

    const handleFileCreate = (data: { success: boolean; path: string }) => {
      if (data.success) {
        // Refresh file list
        onPathChange(currentPath);
      }
    };

    const handleFileDelete = (data: { success: boolean; path: string }) => {
      if (data.success) {
        if (selectedFile?.path === data.path) {
          setSelectedFile(null);
          setFileContent('');
        }
        // Refresh file list
        onPathChange(currentPath);
      }
    };

    kiloClient.on('fileContent', handleFileContent);
    kiloClient.on('fileWritten', handleFileWrite);
    kiloClient.on('fileCreated', handleFileCreate);
    kiloClient.on('fileDeleted', handleFileDelete);

    return () => {
      kiloClient.off('fileContent');
      kiloClient.off('fileWritten');
      kiloClient.off('fileCreated');
      kiloClient.off('fileDeleted');
    };
  }, [currentPath, selectedFile, editedContent, onPathChange]);

  const handleFileClick = useCallback(async (file: FileItem) => {
    if (file.type === 'directory') {
      onPathChange(file.path);
    } else {
      setSelectedFile(file);
      setIsLoading(true);
      try {
        await kiloClient.readFile(file.path);
        onFileSelect?.(file);
      } catch (error) {
        console.error('Error reading file:', error);
        setIsLoading(false);
      }
    }
  }, [onPathChange, onFileSelect]);

  const handleContextMenu = useCallback((e: React.MouseEvent, file: FileItem) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  }, []);

  const handleSaveFile = useCallback(async () => {
    if (selectedFile && editedContent !== fileContent) {
      setIsLoading(true);
      try {
        await kiloClient.writeFile(selectedFile.path, editedContent);
      } catch (error) {
        console.error('Error saving file:', error);
        setIsLoading(false);
      }
    }
  }, [selectedFile, editedContent, fileContent]);

  const handleCreateFile = useCallback(async () => {
    const fileName = prompt('Enter file name:');
    if (fileName) {
      const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
      try {
        await kiloClient.createFile(filePath);
      } catch (error) {
        console.error('Error creating file:', error);
      }
    }
    setContextMenu(null);
  }, [currentPath]);

  const handleCreateDirectory = useCallback(async () => {
    const dirName = prompt('Enter directory name:');
    if (dirName) {
      const dirPath = currentPath ? `${currentPath}/${dirName}` : dirName;
      try {
        await kiloClient.createDirectory(dirPath);
      } catch (error) {
        console.error('Error creating directory:', error);
      }
    }
    setContextMenu(null);
  }, [currentPath]);

  const handleDeleteFile = useCallback(async (file: FileItem) => {
    if (confirm(`Delete ${file.name}?`)) {
      try {
        await kiloClient.deleteFile(file.path);
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    }
    setContextMenu(null);
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        await kiloClient.uploadFile(file, currentPath);
        onPathChange(currentPath); // Refresh file list
      } catch (error) {
        console.error('Error uploading file:', error);
      }
    }
  }, [currentPath, onPathChange]);

  const handleDownload = useCallback(async (file: FileItem) => {
    try {
      await kiloClient.downloadFile(file.path);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
    setContextMenu(null);
  }, []);

  const navigateUp = useCallback(() => {
    const parentPath = currentPath.includes('/') 
      ? currentPath.substring(0, currentPath.lastIndexOf('/'))
      : '';
    onPathChange(parentPath);
  }, [currentPath, onPathChange]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`enhanced-file-explorer ${className}`}>
      <div className="file-explorer-header">
        <h3>Files</h3>
        <div className="file-actions">
          <button onClick={() => onPathChange(currentPath)} title="Refresh">
            🔄
          </button>
          <button onClick={() => fileInputRef.current?.click()} title="Upload">
            📁
          </button>
          <button onClick={handleCreateFile} title="New File">
            📄
          </button>
          <button onClick={handleCreateDirectory} title="New Directory">
            📁
          </button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      <div className="current-path">
        <span>📁 {currentPath || 'Root'}</span>
        {currentPath && (
          <button onClick={navigateUp} className="nav-up">
            ⬆️
          </button>
        )}
      </div>

      <div className="file-explorer-content">
        <div className="file-list">
          {files.map((file, index) => (
            <div
              key={index}
              className={`file-item ${file.type} ${selectedFile?.path === file.path ? 'selected' : ''}`}
              onClick={() => handleFileClick(file)}
              onContextMenu={(e) => handleContextMenu(e, file)}
            >
              <span className="file-icon">
                {file.type === 'directory' ? '📁' : '📄'}
              </span>
              <span className="file-name">{file.name}</span>
              {file.size !== undefined && (
                <span className="file-size">{formatFileSize(file.size)}</span>
              )}
              {file.modified && (
                <span className="file-modified">
                  {new Date(file.modified).toLocaleDateString()}
                </span>
              )}
            </div>
          ))}
        </div>

        {selectedFile && (
          <div className="file-editor">
            <div className="editor-header">
              <span className="file-path">{selectedFile.path}</span>
              <div className="editor-actions">
                {isEditing ? (
                  <>
                    <button onClick={handleSaveFile} disabled={isLoading}>
                      💾 Save
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setEditedContent(fileContent);
                      }}
                    >
                      ❌ Cancel
                    </button>
                  </>
                ) : (
                  <button onClick={() => setIsEditing(true)}>
                    ✏️ Edit
                  </button>
                )}
              </div>
            </div>
            <div className="editor-content">
              {isLoading ? (
                <div className="loading">Loading...</div>
              ) : isEditing ? (
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="file-textarea"
                />
              ) : (
                <pre className="file-preview">{fileContent}</pre>
              )}
            </div>
          </div>
        )}
      </div>

      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={() => setContextMenu(null)}
        >
          <div onClick={handleCreateFile}>📄 New File</div>
          <div onClick={handleCreateDirectory}>📁 New Directory</div>
          {contextMenu.file.type === 'file' && (
            <div onClick={() => handleDownload(contextMenu.file)}>
              💾 Download
            </div>
          )}
          <div onClick={() => handleDeleteFile(contextMenu.file)}>
            🗑️ Delete
          </div>
        </div>
      )}
    </div>
  );
};