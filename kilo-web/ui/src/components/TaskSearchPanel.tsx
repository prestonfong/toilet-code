import React, { useState, useEffect, useCallback } from 'react';
import { TaskSearchFilters, TaskStatistics, TaskCategory, TaskTag } from '../types/taskHistory';
import './TaskSearchPanel.css';

interface TaskSearchPanelProps {
  filters: TaskSearchFilters;
  onSearch: (filters: TaskSearchFilters) => void;
  onClose: () => void;
  statistics: TaskStatistics | null;
}

const TaskSearchPanel: React.FC<TaskSearchPanelProps> = ({
  filters,
  onSearch,
  onClose,
  statistics
}) => {
  const [localFilters, setLocalFilters] = useState<TaskSearchFilters>(filters);
  const [isExpanded, setIsExpanded] = useState(false);
  const [categories] = useState<TaskCategory[]>([
    { id: 'development', name: 'Development', color: '#3b82f6', taskCount: 25 },
    { id: 'debugging', name: 'Debugging', color: '#ef4444', taskCount: 12 },
    { id: 'documentation', name: 'Documentation', color: '#10b981', taskCount: 8 },
    { id: 'testing', name: 'Testing', color: '#f59e0b', taskCount: 15 },
    { id: 'refactoring', name: 'Refactoring', color: '#8b5cf6', taskCount: 6 }
  ]);

  const [availableTags] = useState<TaskTag[]>([
    { name: 'urgent', color: '#ef4444', taskCount: 5 },
    { name: 'bug-fix', color: '#f59e0b', taskCount: 12 },
    { name: 'feature', color: '#3b82f6', taskCount: 18 },
    { name: 'enhancement', color: '#10b981', taskCount: 8 },
    { name: 'optimization', color: '#8b5cf6', taskCount: 4 }
  ]);

  // Update local filters when props change
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleFilterChange = useCallback((key: keyof TaskSearchFilters, value: any) => {
    setLocalFilters(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const handleArrayFilterChange = useCallback((key: keyof TaskSearchFilters, value: string, checked: boolean) => {
    setLocalFilters(prev => {
      const currentArray = (prev[key] as string[]) || [];
      const newArray = checked
        ? [...currentArray, value]
        : currentArray.filter(item => item !== value);
      
      return {
        ...prev,
        [key]: newArray.length > 0 ? newArray : undefined
      };
    });
  }, []);

  const handleDateRangeChange = useCallback((type: 'start' | 'end', value: string) => {
    const timestamp = value ? new Date(value).getTime() : undefined;
    setLocalFilters(prev => ({
      ...prev,
      dateRange: {
        start: type === 'start' ? (timestamp || 0) : (prev.dateRange?.start || 0),
        end: type === 'end' ? (timestamp || Date.now()) : (prev.dateRange?.end || Date.now())
      }
    }));
  }, []);

  const handleSearch = useCallback(() => {
    onSearch(localFilters);
  }, [localFilters, onSearch]);

  const handleReset = useCallback(() => {
    const emptyFilters: TaskSearchFilters = {};
    setLocalFilters(emptyFilters);
    onSearch(emptyFilters);
  }, [onSearch]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toISOString().split('T')[0];
  };

  const modes = ['architect', 'code', 'ask', 'debug', 'orchestrator'];
  const statuses = ['completed', 'in-progress', 'cancelled', 'failed'];
  const workspaces = statistics?.byWorkspace ? Object.keys(statistics.byWorkspace) : [];

  return (
    <div className="task-search-panel">
      <div className="search-panel-header">
        <h3>Search & Filter Tasks</h3>
        <div className="search-panel-actions">
          <button
            className="expand-toggle-btn"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse' : 'Expand all filters'}
          >
            {isExpanded ? '▲' : '▼'}
          </button>
          <button className="close-panel-btn" onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      <div className="search-panel-content">
        {/* Basic Search */}
        <div className="filter-group">
          <label>Search Query</label>
          <input
            type="text"
            placeholder="Search in task titles and content..."
            value={localFilters.query || ''}
            onChange={(e) => handleFilterChange('query', e.target.value)}
          />
        </div>

        {/* Quick Filters */}
        <div className="filter-group">
          <label>Quick Filters</label>
          <div className="quick-filters">
            <button
              className={`quick-filter ${localFilters.hasFiles ? 'active' : ''}`}
              onClick={() => handleFilterChange('hasFiles', !localFilters.hasFiles)}
            >
              📁 Has Files
            </button>
            <button
              className={`quick-filter ${localFilters.hasErrors ? 'active' : ''}`}
              onClick={() => handleFilterChange('hasErrors', !localFilters.hasErrors)}
            >
              ⚠️ Has Errors
            </button>
          </div>
        </div>

        {/* Mode Filter */}
        <div className="filter-group">
          <label>Modes</label>
          <div className="checkbox-group">
            {modes.map(mode => (
              <label key={mode} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={localFilters.mode?.includes(mode) || false}
                  onChange={(e) => handleArrayFilterChange('mode', mode, e.target.checked)}
                />
                <span className="mode-label">{mode}</span>
                {statistics?.byMode[mode] && (
                  <span className="count">({statistics.byMode[mode]})</span>
                )}
              </label>
            ))}
          </div>
        </div>

        {/* Status Filter */}
        <div className="filter-group">
          <label>Status</label>
          <div className="checkbox-group">
            {statuses.map(status => (
              <label key={status} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={localFilters.status?.includes(status) || false}
                  onChange={(e) => handleArrayFilterChange('status', status, e.target.checked)}
                />
                <span className={`status-label status-${status}`}>{status}</span>
                {statistics?.byStatus[status] && (
                  <span className="count">({statistics.byStatus[status]})</span>
                )}
              </label>
            ))}
          </div>
        </div>

        {/* Expanded Filters */}
        {isExpanded && (
          <>
            {/* Date Range */}
            <div className="filter-group">
              <label>Date Range</label>
              <div className="date-range">
                <div className="date-input">
                  <label>From</label>
                  <input
                    type="date"
                    value={localFilters.dateRange?.start ? formatDate(localFilters.dateRange.start) : ''}
                    onChange={(e) => handleDateRangeChange('start', e.target.value)}
                  />
                </div>
                <div className="date-input">
                  <label>To</label>
                  <input
                    type="date"
                    value={localFilters.dateRange?.end ? formatDate(localFilters.dateRange.end) : ''}
                    onChange={(e) => handleDateRangeChange('end', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Workspace Filter */}
            {workspaces.length > 0 && (
              <div className="filter-group">
                <label>Workspaces</label>
                <div className="checkbox-group">
                  {workspaces.map(workspace => (
                    <label key={workspace} className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={localFilters.workspace?.includes(workspace) || false}
                        onChange={(e) => handleArrayFilterChange('workspace', workspace, e.target.checked)}
                      />
                      <span className="workspace-label">{workspace}</span>
                      <span className="count">({statistics?.byWorkspace[workspace]})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Categories */}
            <div className="filter-group">
              <label>Categories</label>
              <div className="checkbox-group">
                {categories.map(category => (
                  <label key={category.id} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={localFilters.category?.includes(category.id) || false}
                      onChange={(e) => handleArrayFilterChange('category', category.id, e.target.checked)}
                    />
                    <span 
                      className="category-label"
                      style={{ borderLeft: `3px solid ${category.color}` }}
                    >
                      {category.name}
                    </span>
                    <span className="count">({category.taskCount})</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className="filter-group">
              <label>Tags</label>
              <div className="tag-list">
                {availableTags.map(tag => (
                  <button
                    key={tag.name}
                    className={`tag-filter ${localFilters.tags?.includes(tag.name) ? 'active' : ''}`}
                    style={{ backgroundColor: localFilters.tags?.includes(tag.name) ? tag.color : undefined }}
                    onClick={() => {
                      const isActive = localFilters.tags?.includes(tag.name) || false;
                      handleArrayFilterChange('tags', tag.name, !isActive);
                    }}
                  >
                    {tag.name} ({tag.taskCount})
                  </button>
                ))}
              </div>
            </div>

            {/* Duration Range */}
            <div className="filter-group">
              <label>Duration Range</label>
              <div className="range-inputs">
                <div className="range-input">
                  <label>Min (minutes)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={localFilters.minDuration ? Math.floor(localFilters.minDuration / 60000) : ''}
                    onChange={(e) => handleFilterChange('minDuration', e.target.value ? parseInt(e.target.value) * 60000 : undefined)}
                  />
                </div>
                <div className="range-input">
                  <label>Max (minutes)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="∞"
                    value={localFilters.maxDuration ? Math.floor(localFilters.maxDuration / 60000) : ''}
                    onChange={(e) => handleFilterChange('maxDuration', e.target.value ? parseInt(e.target.value) * 60000 : undefined)}
                  />
                </div>
              </div>
            </div>

            {/* Message Count Range */}
            <div className="filter-group">
              <label>Message Count Range</label>
              <div className="range-inputs">
                <div className="range-input">
                  <label>Min Messages</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="1"
                    value={localFilters.minMessages || ''}
                    onChange={(e) => handleFilterChange('minMessages', e.target.value ? parseInt(e.target.value) : undefined)}
                  />
                </div>
                <div className="range-input">
                  <label>Max Messages</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="∞"
                    value={localFilters.maxMessages || ''}
                    onChange={(e) => handleFilterChange('maxMessages', e.target.value ? parseInt(e.target.value) : undefined)}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="search-panel-actions">
          <button className="search-btn primary" onClick={handleSearch}>
            🔍 Search
          </button>
          <button className="reset-btn" onClick={handleReset}>
            🔄 Reset
          </button>
        </div>

        {/* Active Filters Summary */}
        {Object.keys(localFilters).length > 0 && (
          <div className="active-filters">
            <h4>Active Filters:</h4>
            <div className="filter-tags">
              {localFilters.query && (
                <span className="filter-tag">
                  Query: "{localFilters.query}"
                  <button onClick={() => handleFilterChange('query', undefined)}>✕</button>
                </span>
              )}
              {localFilters.mode?.map(mode => (
                <span key={mode} className="filter-tag">
                  Mode: {mode}
                  <button onClick={() => handleArrayFilterChange('mode', mode, false)}>✕</button>
                </span>
              ))}
              {localFilters.status?.map(status => (
                <span key={status} className="filter-tag">
                  Status: {status}
                  <button onClick={() => handleArrayFilterChange('status', status, false)}>✕</button>
                </span>
              ))}
              {localFilters.hasFiles && (
                <span className="filter-tag">
                  Has Files
                  <button onClick={() => handleFilterChange('hasFiles', false)}>✕</button>
                </span>
              )}
              {localFilters.hasErrors && (
                <span className="filter-tag">
                  Has Errors
                  <button onClick={() => handleFilterChange('hasErrors', false)}>✕</button>
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskSearchPanel;