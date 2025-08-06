import React, { useState, useEffect, useCallback } from 'react';
import { 
  TaskHistoryItem, 
  TaskSearchFilters, 
  TaskStatistics, 
  TaskHistoryState,
  TaskBatchOperation 
} from '../types/taskHistory';
import TaskSearchPanel from './TaskSearchPanel';
import TaskDetailModal from './TaskDetailModal';
import './TaskHistoryManager.css';

interface TaskHistoryManagerProps {
  webSocket: WebSocket | null;
  isConnected: boolean;
  isOpen: boolean;
  onClose: () => void;
}

const TaskHistoryManager: React.FC<TaskHistoryManagerProps> = ({
  webSocket,
  isConnected,
  isOpen,
  onClose
}) => {
  const [state, setState] = useState<TaskHistoryState>({
    tasks: [],
    loading: false,
    searchFilters: {},
    selectedTasks: [],
    sortBy: 'lastModified',
    sortOrder: 'desc',
    viewMode: 'list',
    showArchived: false
  });

  const [statistics, setStatistics] = useState<TaskStatistics | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskHistoryItem | null>(null);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [showBatchActions, setShowBatchActions] = useState(false);

  // Load task history on mount
  useEffect(() => {
    if (isOpen && isConnected && webSocket) {
      loadTaskHistory();
      loadStatistics();
    }
  }, [isOpen, isConnected, webSocket]);

  // WebSocket message handler
  useEffect(() => {
    if (!webSocket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'taskHistoryData':
            if (data.success) {
              setState(prev => ({ ...prev, tasks: data.data, loading: false }));
            }
            break;
          
          case 'taskSearchResult':
            if (data.success) {
              setState(prev => ({ ...prev, tasks: data.data.tasks, loading: false }));
            }
            break;
            
          case 'taskStatsResult':
            if (data.success) {
              setStatistics(data.data);
            }
            break;
            
          case 'taskBatchResult':
            if (data.success) {
              loadTaskHistory(); // Refresh after batch operation
              setState(prev => ({ ...prev, selectedTasks: [] }));
            }
            break;
        }
      } catch (error) {
        console.error('Error parsing task history message:', error);
      }
    };

    webSocket.addEventListener('message', handleMessage);
    return () => webSocket.removeEventListener('message', handleMessage);
  }, [webSocket]);

  const loadTaskHistory = useCallback(() => {
    if (!webSocket || !isConnected) return;
    
    setState(prev => ({ ...prev, loading: true }));
    webSocket.send(JSON.stringify({
      type: 'taskHistory',
      action: 'list',
      data: {
        filters: state.searchFilters,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
        showArchived: state.showArchived
      }
    }));
  }, [webSocket, isConnected, state.searchFilters, state.sortBy, state.sortOrder, state.showArchived]);

  const loadStatistics = useCallback(() => {
    if (!webSocket || !isConnected) return;
    
    webSocket.send(JSON.stringify({
      type: 'taskStats',
      action: 'get'
    }));
  }, [webSocket, isConnected]);

  const handleSearch = useCallback((filters: TaskSearchFilters) => {
    setState(prev => ({ ...prev, searchFilters: filters, loading: true }));
    
    if (webSocket && isConnected) {
      webSocket.send(JSON.stringify({
        type: 'taskSearch',
        action: 'search',
        data: { filters }
      }));
    }
  }, [webSocket, isConnected]);

  const handleSort = useCallback((sortBy: TaskHistoryState['sortBy'], sortOrder: TaskHistoryState['sortOrder']) => {
    setState(prev => ({ ...prev, sortBy, sortOrder }));
    loadTaskHistory();
  }, [loadTaskHistory]);

  const handleTaskSelect = useCallback((taskId: string, selected: boolean) => {
    setState(prev => ({
      ...prev,
      selectedTasks: selected 
        ? [...prev.selectedTasks, taskId]
        : prev.selectedTasks.filter(id => id !== taskId)
    }));
  }, []);

  const handleSelectAll = useCallback(() => {
    const allTaskIds = state.tasks.map(task => task.id);
    setState(prev => ({ 
      ...prev, 
      selectedTasks: prev.selectedTasks.length === allTaskIds.length ? [] : allTaskIds 
    }));
  }, [state.tasks]);

  const handleBatchOperation = useCallback((operation: TaskBatchOperation) => {
    if (!webSocket || !isConnected || state.selectedTasks.length === 0) return;

    webSocket.send(JSON.stringify({
      type: 'taskBatch',
      action: 'execute',
      data: {
        ...operation,
        taskIds: state.selectedTasks
      }
    }));
  }, [webSocket, isConnected, state.selectedTasks]);

  const handleExport = useCallback((format: 'json' | 'csv' | 'markdown') => {
    if (!webSocket || !isConnected) return;

    const exportData = {
      format,
      taskIds: state.selectedTasks.length > 0 ? state.selectedTasks : undefined,
      filters: state.searchFilters
    };

    webSocket.send(JSON.stringify({
      type: 'taskExport',
      action: 'export',
      data: exportData
    }));
  }, [webSocket, isConnected, state.selectedTasks, state.searchFilters]);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
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

  if (!isOpen) return null;

  return (
    <div className="task-history-overlay">
      <div className="task-history-modal">
        {/* Header */}
        <div className="task-history-header">
          <div className="header-left">
            <h2>Task History</h2>
            {statistics && (
              <div className="stats-summary">
                <span>{statistics.total} tasks</span>
                <span>•</span>
                <span>{statistics.totalMessages} messages</span>
                {statistics.totalTokens > 0 && (
                  <>
                    <span>•</span>
                    <span>{statistics.totalTokens.toLocaleString()} tokens</span>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="header-actions">
            <button
              className="search-toggle-btn"
              onClick={() => setShowSearchPanel(!showSearchPanel)}
              title="Toggle search panel"
            >
              🔍
            </button>
            <button
              className="view-mode-btn"
              onClick={() => setState(prev => ({ 
                ...prev, 
                viewMode: prev.viewMode === 'list' ? 'grid' : 'list' 
              }))}
              title="Toggle view mode"
            >
              {state.viewMode === 'list' ? '⊞' : '☰'}
            </button>
            <button
              className="archive-toggle-btn"
              onClick={() => setState(prev => ({ ...prev, showArchived: !prev.showArchived }))}
              title="Toggle archived tasks"
            >
              {state.showArchived ? '📂' : '🗃️'}
            </button>
            <button className="close-btn" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {/* Search Panel */}
        {showSearchPanel && (
          <TaskSearchPanel
            filters={state.searchFilters}
            onSearch={handleSearch}
            onClose={() => setShowSearchPanel(false)}
            statistics={statistics}
          />
        )}

        {/* Toolbar */}
        <div className="task-history-toolbar">
          <div className="toolbar-left">
            <select
              value={`${state.sortBy}-${state.sortOrder}`}
              onChange={(e) => {
                const [sortBy, sortOrder] = e.target.value.split('-') as [TaskHistoryState['sortBy'], TaskHistoryState['sortOrder']];
                handleSort(sortBy, sortOrder);
              }}
            >
              <option value="lastModified-desc">Last Modified (Newest)</option>
              <option value="lastModified-asc">Last Modified (Oldest)</option>
              <option value="createdAt-desc">Created (Newest)</option>
              <option value="createdAt-asc">Created (Oldest)</option>
              <option value="duration-desc">Duration (Longest)</option>
              <option value="duration-asc">Duration (Shortest)</option>
              <option value="messages-desc">Messages (Most)</option>
              <option value="messages-asc">Messages (Least)</option>
            </select>
          </div>

          <div className="toolbar-right">
            {state.selectedTasks.length > 0 && (
              <>
                <span className="selection-count">
                  {state.selectedTasks.length} selected
                </span>
                <button
                  className="batch-actions-btn"
                  onClick={() => setShowBatchActions(!showBatchActions)}
                >
                  Actions ▼
                </button>
                {showBatchActions && (
                  <div className="batch-actions-menu">
                    <button onClick={() => handleBatchOperation({ type: 'archive', taskIds: state.selectedTasks })}>
                      Archive
                    </button>
                    <button onClick={() => handleBatchOperation({ type: 'delete', taskIds: state.selectedTasks })}>
                      Delete
                    </button>
                    <button onClick={() => handleExport('json')}>
                      Export JSON
                    </button>
                    <button onClick={() => handleExport('csv')}>
                      Export CSV
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Task List */}
        <div className="task-history-content">
          {state.loading ? (
            <div className="loading-state">
              <div className="loading-spinner" />
              <span>Loading tasks...</span>
            </div>
          ) : state.tasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📝</div>
              <h3>No tasks found</h3>
              <p>Start a conversation to create your first task</p>
            </div>
          ) : (
            <div className={`task-list ${state.viewMode}`}>
              <div className="task-list-header">
                <label className="select-all">
                  <input
                    type="checkbox"
                    checked={state.selectedTasks.length === state.tasks.length}
                    onChange={handleSelectAll}
                  />
                  Select All
                </label>
              </div>

              {state.tasks.map((task) => (
                <div
                  key={task.id}
                  className={`task-item ${state.selectedTasks.includes(task.id) ? 'selected' : ''}`}
                  onClick={() => setSelectedTask(task)}
                >
                  <div className="task-item-select" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={state.selectedTasks.includes(task.id)}
                      onChange={(e) => handleTaskSelect(task.id, e.target.checked)}
                    />
                  </div>

                  <div className="task-item-content">
                    <div className="task-item-header">
                      <h4 className="task-title">{task.title}</h4>
                      <div className="task-metadata">
                        <span 
                          className="task-status" 
                          style={{ color: getStatusColor(task.status) }}
                        >
                          {task.status}
                        </span>
                        <span className="task-mode">{task.mode}</span>
                        {task.duration && (
                          <span className="task-duration">
                            {formatDuration(task.duration)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="task-item-details">
                      <div className="task-stats">
                        <span>{task.metadata.totalMessages} messages</span>
                        {task.metadata.tokensUsed && (
                          <span>{task.metadata.tokensUsed.toLocaleString()} tokens</span>
                        )}
                        {task.metadata.filesModified && task.metadata.filesModified.length > 0 && (
                          <span>{task.metadata.filesModified.length} files</span>
                        )}
                      </div>
                      
                      <div className="task-dates">
                        <span className="task-date">
                          {new Date(task.lastModified).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {task.summary && (
                      <div className="task-summary">
                        {task.summary}
                      </div>
                    )}

                    {task.tags && task.tags.length > 0 && (
                      <div className="task-tags">
                        {task.tags.map(tag => (
                          <span key={tag} className="task-tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          webSocket={webSocket}
          isConnected={isConnected}
        />
      )}
    </div>
  );
};

export default TaskHistoryManager;