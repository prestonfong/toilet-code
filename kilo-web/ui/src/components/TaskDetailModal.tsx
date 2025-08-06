import React, { useState, useCallback, useRef, useEffect } from 'react';
import { TaskHistoryItem } from '../types/taskHistory';
import './TaskDetailModal.css';

interface TaskDetailModalProps {
  task: TaskHistoryItem;
  onClose: () => void;
  webSocket: WebSocket | null;
  isConnected: boolean;
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  onClose,
  webSocket,
  isConnected
}) => {
  const [activeTab, setActiveTab] = useState<'messages' | 'metadata' | 'files' | 'analytics'>('messages');
  const [expandedMessage, setExpandedMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRawData, setShowRawData] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeTab === 'messages') {
      scrollToBottom();
    }
  }, [activeTab]);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#22c55e';
      case 'in-progress': return '#3b82f6';
      case 'cancelled': return '#f59e0b';
      case 'failed': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getMessageTypeColor = (type: string) => {
    switch (type) {
      case 'user': return '#3b82f6';
      case 'assistant': return '#10b981';
      case 'system': return '#6b7280';
      case 'tool': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const filteredMessages = task.messages.filter(message => 
    !searchQuery || 
    message.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    message.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExportTask = useCallback((format: 'json' | 'markdown' | 'txt') => {
    if (!webSocket || !isConnected) return;

    webSocket.send(JSON.stringify({
      type: 'taskExport',
      action: 'exportSingle',
      data: {
        taskId: task.id,
        format
      }
    }));
  }, [webSocket, isConnected, task.id]);

  const handleRerunTask = useCallback(() => {
    if (!webSocket || !isConnected) return;

    const firstUserMessage = task.messages.find(msg => msg.type === 'user');
    if (firstUserMessage) {
      webSocket.send(JSON.stringify({
        type: 'newTask',
        text: firstUserMessage.content,
        mode: task.mode
      }));
      onClose();
    }
  }, [webSocket, isConnected, task, onClose]);

  const handleArchiveTask = useCallback(() => {
    if (!webSocket || !isConnected) return;

    webSocket.send(JSON.stringify({
      type: 'taskBatch',
      action: 'execute',
      data: {
        type: task.archived ? 'unarchive' : 'archive',
        taskIds: [task.id]
      }
    }));
  }, [webSocket, isConnected, task]);

  return (
    <div className="task-detail-overlay" onClick={onClose}>
      <div className="task-detail-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="task-detail-header">
          <div className="header-left">
            <h2>{task.title}</h2>
            <div className="task-detail-meta">
              <span 
                className="task-status-badge" 
                style={{ backgroundColor: getStatusColor(task.status) }}
              >
                {task.status}
              </span>
              <span className="task-mode-badge">{task.mode}</span>
              {task.duration && (
                <span className="task-duration-badge">
                  {formatDuration(task.duration)}
                </span>
              )}
              <span className="task-date">
                {formatTimestamp(task.createdAt)}
              </span>
            </div>
          </div>
          
          <div className="header-actions">
            <button
              className="action-btn"
              onClick={handleRerunTask}
              title="Re-run this task"
            >
              🔄
            </button>
            <button
              className="action-btn"
              onClick={handleArchiveTask}
              title={task.archived ? 'Unarchive task' : 'Archive task'}
            >
              {task.archived ? '📂' : '🗃️'}
            </button>
            <button
              className="action-btn"
              onClick={() => setShowRawData(!showRawData)}
              title="Toggle raw data view"
            >
              🔍
            </button>
            <div className="export-dropdown">
              <button className="action-btn" title="Export task">
                📥 ▼
              </button>
              <div className="export-menu">
                <button onClick={() => handleExportTask('json')}>Export as JSON</button>
                <button onClick={() => handleExportTask('markdown')}>Export as Markdown</button>
                <button onClick={() => handleExportTask('txt')}>Export as Text</button>
              </div>
            </div>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="task-detail-tabs">
          <button
            className={`tab ${activeTab === 'messages' ? 'active' : ''}`}
            onClick={() => setActiveTab('messages')}
          >
            Messages ({task.messages.length})
          </button>
          <button
            className={`tab ${activeTab === 'metadata' ? 'active' : ''}`}
            onClick={() => setActiveTab('metadata')}
          >
            Metadata
          </button>
          <button
            className={`tab ${activeTab === 'files' ? 'active' : ''}`}
            onClick={() => setActiveTab('files')}
          >
            Files ({task.metadata.filesModified?.length || 0})
          </button>
          <button
            className={`tab ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            Analytics
          </button>
        </div>

        {/* Content */}
        <div className="task-detail-content">
          {activeTab === 'messages' && (
            <div className="messages-tab">
              <div className="messages-toolbar">
                <input
                  type="text"
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="message-search"
                />
                <span className="message-count">
                  {filteredMessages.length} of {task.messages.length} messages
                </span>
              </div>

              <div className="messages-list">
                {filteredMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`message-item ${message.type}`}
                  >
                    <div className="message-header">
                      <span 
                        className="message-type"
                        style={{ color: getMessageTypeColor(message.type) }}
                      >
                        {message.type}
                      </span>
                      <span className="message-timestamp">
                        {formatTimestamp(message.timestamp)}
                      </span>
                      {message.metadata?.tool && (
                        <span className="tool-badge">
                          🔧 {message.metadata.tool}
                        </span>
                      )}
                      {message.metadata?.important && (
                        <span className="important-badge">
                          ⭐ Important
                        </span>
                      )}
                      {message.metadata?.edited && (
                        <span className="edited-badge">
                          ✏️ Edited
                        </span>
                      )}
                    </div>

                    <div className="message-content">
                      <div 
                        className={`content-text ${expandedMessage === message.id ? 'expanded' : ''}`}
                        onClick={() => setExpandedMessage(
                          expandedMessage === message.id ? null : message.id
                        )}
                      >
                        {message.content}
                      </div>

                      {message.metadata?.toolArgs && (
                        <div className="tool-details">
                          <h5>Tool Arguments:</h5>
                          <pre>{JSON.stringify(message.metadata.toolArgs, null, 2)}</pre>
                        </div>
                      )}

                      {message.metadata?.toolResult && (
                        <div className="tool-details">
                          <h5>Tool Result:</h5>
                          <pre>{JSON.stringify(message.metadata.toolResult, null, 2)}</pre>
                        </div>
                      )}

                      {message.metadata?.tokensEstimate && (
                        <div className="message-stats">
                          <span>~{message.metadata.tokensEstimate} tokens</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}

          {activeTab === 'metadata' && (
            <div className="metadata-tab">
              <div className="metadata-grid">
                <div className="metadata-section">
                  <h3>Basic Information</h3>
                  <div className="metadata-item">
                    <label>Task ID:</label>
                    <span>{task.id}</span>
                  </div>
                  <div className="metadata-item">
                    <label>Title:</label>
                    <span>{task.title}</span>
                  </div>
                  <div className="metadata-item">
                    <label>Mode:</label>
                    <span>{task.mode}</span>
                  </div>
                  <div className="metadata-item">
                    <label>Status:</label>
                    <span style={{ color: getStatusColor(task.status) }}>{task.status}</span>
                  </div>
                  <div className="metadata-item">
                    <label>Workspace:</label>
                    <span>{task.workspace || 'Unknown'}</span>
                  </div>
                  <div className="metadata-item">
                    <label>Category:</label>
                    <span>{task.category || 'Uncategorized'}</span>
                  </div>
                </div>

                <div className="metadata-section">
                  <h3>Timing</h3>
                  <div className="metadata-item">
                    <label>Created:</label>
                    <span>{formatTimestamp(task.createdAt)}</span>
                  </div>
                  <div className="metadata-item">
                    <label>Last Modified:</label>
                    <span>{formatTimestamp(task.lastModified)}</span>
                  </div>
                  {task.duration && (
                    <div className="metadata-item">
                      <label>Duration:</label>
                      <span>{formatDuration(task.duration)}</span>
                    </div>
                  )}
                </div>

                <div className="metadata-section">
                  <h3>Statistics</h3>
                  <div className="metadata-item">
                    <label>Total Messages:</label>
                    <span>{task.metadata.totalMessages}</span>
                  </div>
                  <div className="metadata-item">
                    <label>User Messages:</label>
                    <span>{task.metadata.userMessages}</span>
                  </div>
                  <div className="metadata-item">
                    <label>Assistant Messages:</label>
                    <span>{task.metadata.assistantMessages}</span>
                  </div>
                  {task.metadata.tokensUsed && (
                    <div className="metadata-item">
                      <label>Tokens Used:</label>
                      <span>{task.metadata.tokensUsed.toLocaleString()}</span>
                    </div>
                  )}
                  {task.metadata.commandsExecuted && (
                    <div className="metadata-item">
                      <label>Commands Executed:</label>
                      <span>{task.metadata.commandsExecuted}</span>
                    </div>
                  )}
                  {task.metadata.errorCount && (
                    <div className="metadata-item">
                      <label>Errors:</label>
                      <span style={{ color: '#ef4444' }}>{task.metadata.errorCount}</span>
                    </div>
                  )}
                </div>

                {task.tags && task.tags.length > 0 && (
                  <div className="metadata-section">
                    <h3>Tags</h3>
                    <div className="tag-list">
                      {task.tags.map(tag => (
                        <span key={tag} className="tag-item">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}

                {task.metadata.toolsUsed && task.metadata.toolsUsed.length > 0 && (
                  <div className="metadata-section">
                    <h3>Tools Used</h3>
                    <div className="tool-list">
                      {task.metadata.toolsUsed.map(tool => (
                        <span key={tool} className="tool-item">🔧 {tool}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {showRawData && (
                <div className="raw-data-section">
                  <h3>Raw Task Data</h3>
                  <pre className="raw-data">
                    {JSON.stringify(task, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {activeTab === 'files' && (
            <div className="files-tab">
              {task.metadata.filesModified && task.metadata.filesModified.length > 0 ? (
                <div className="files-list">
                  <h3>Modified Files ({task.metadata.filesModified.length})</h3>
                  {task.metadata.filesModified.map((file, index) => (
                    <div key={index} className="file-item">
                      <span className="file-icon">📄</span>
                      <span className="file-path">{file}</span>
                      <button
                        className="view-file-btn"
                        onClick={() => {
                          // In a real implementation, this would open the file
                          console.log('View file:', file);
                        }}
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">📁</div>
                  <h3>No Files Modified</h3>
                  <p>This task didn't modify any files</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="analytics-tab">
              <div className="analytics-grid">
                <div className="analytics-card">
                  <h3>Message Distribution</h3>
                  <div className="chart-placeholder">
                    <div className="bar-chart">
                      <div className="bar user" style={{ height: `${(task.metadata.userMessages / task.metadata.totalMessages) * 100}%` }}>
                        <span>{task.metadata.userMessages}</span>
                      </div>
                      <div className="bar assistant" style={{ height: `${(task.metadata.assistantMessages / task.metadata.totalMessages) * 100}%` }}>
                        <span>{task.metadata.assistantMessages}</span>
                      </div>
                    </div>
                    <div className="chart-labels">
                      <span>User</span>
                      <span>Assistant</span>
                    </div>
                  </div>
                </div>

                <div className="analytics-card">
                  <h3>Task Performance</h3>
                  <div className="performance-metrics">
                    <div className="metric">
                      <label>Efficiency Score:</label>
                      <div className="score-bar">
                        <div 
                          className="score-fill" 
                          style={{ width: `${Math.min(100, (task.metadata.totalMessages / (task.duration || 1)) * 1000)}%` }}
                        />
                      </div>
                    </div>
                    <div className="metric">
                      <label>Completion Rate:</label>
                      <span>{task.status === 'completed' ? '100%' : task.status === 'failed' ? '0%' : '50%'}</span>
                    </div>
                    <div className="metric">
                      <label>Error Rate:</label>
                      <span>{task.metadata.errorCount ? `${((task.metadata.errorCount / task.metadata.totalMessages) * 100).toFixed(1)}%` : '0%'}</span>
                    </div>
                  </div>
                </div>

                {task.metadata.tokensUsed && (
                  <div className="analytics-card">
                    <h3>Token Usage</h3>
                    <div className="token-stats">
                      <div className="token-stat">
                        <label>Total Tokens:</label>
                        <span>{task.metadata.tokensUsed.toLocaleString()}</span>
                      </div>
                      <div className="token-stat">
                        <label>Avg per Message:</label>
                        <span>{Math.round(task.metadata.tokensUsed / task.metadata.totalMessages).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskDetailModal;