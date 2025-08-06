import React, { useState, useEffect, useCallback } from 'react';
import { 
  WorkflowTemplate, 
  WorkflowExecution, 
  WorkflowManagerState,
  WorkflowStats,
  ExecuteWorkflowRequest,
  WorkflowApiResponse
} from '../types/workflow';
import './WorkflowManager.css';

interface WorkflowManagerProps {
  webSocket?: WebSocket | null;
  isConnected?: boolean;
}

const WorkflowManager: React.FC<WorkflowManagerProps> = ({ webSocket, isConnected = false }) => {
  const [state, setState] = useState<WorkflowManagerState>({
    templates: [],
    executions: [],
    categories: [],
    tags: [],
    stats: null,
    activeTab: 'browser',
    selectedTemplate: null,
    selectedExecution: null,
    executionParameters: {},
    searchQuery: '',
    selectedCategory: '',
    selectedTags: [],
    isLoading: false,
    error: null
  });

  // Initialize data on component mount
  useEffect(() => {
    if (isConnected) {
      loadTemplates();
      loadExecutions();
      loadStats();
    }
  }, [isConnected]);

  // WebSocket event handling for real-time updates
  useEffect(() => {
    if (!webSocket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'workflow_execution_update') {
          updateExecutionStatus(data.execution);
        } else if (data.type === 'workflow_execution_started') {
          addNewExecution(data.execution);
        } else if (data.type === 'workflow_execution_completed') {
          updateExecutionStatus(data.execution);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    webSocket.addEventListener('message', handleMessage);
    return () => webSocket.removeEventListener('message', handleMessage);
  }, [webSocket]);

  const apiCall = useCallback(async <T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<WorkflowApiResponse<T>> => {
    try {
      const response = await fetch(`/workflows${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      
      return { success: true, data };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }, []);

  const loadTemplates = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    const result = await apiCall<WorkflowTemplate[]>('/templates');
    
    if (result.success && result.data) {
      const categories = [...new Set(result.data.map(t => t.category))];
      const tags = [...new Set(result.data.flatMap(t => t.tags || []))];
      
      setState(prev => ({
        ...prev,
        templates: result.data!,
        categories,
        tags,
        isLoading: false
      }));
    } else {
      setState(prev => ({
        ...prev,
        error: result.error || 'Failed to load templates',
        isLoading: false
      }));
    }
  };

  const loadExecutions = async () => {
    const result = await apiCall<WorkflowExecution[]>('/executions');
    
    if (result.success && result.data) {
      setState(prev => ({
        ...prev,
        executions: result.data!
      }));
    }
  };

  const loadStats = async () => {
    const result = await apiCall<WorkflowStats>('/stats');
    
    if (result.success && result.data) {
      setState(prev => ({
        ...prev,
        stats: result.data!
      }));
    }
  };

  const updateExecutionStatus = (updatedExecution: WorkflowExecution) => {
    setState(prev => ({
      ...prev,
      executions: prev.executions.map(exec => 
        exec.id === updatedExecution.id ? updatedExecution : exec
      )
    }));
  };

  const addNewExecution = (newExecution: WorkflowExecution) => {
    setState(prev => ({
      ...prev,
      executions: [newExecution, ...prev.executions]
    }));
  };

  const selectTemplate = (template: WorkflowTemplate) => {
    setState(prev => ({ 
      ...prev, 
      selectedTemplate: template, 
      activeTab: 'executor',
      executionParameters: { ...template.variables }
    }));
  };

  const executeWorkflow = async () => {
    if (!state.selectedTemplate) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    const request: ExecuteWorkflowRequest = {
      templateId: state.selectedTemplate.id,
      parameters: state.executionParameters,
      triggeredBy: 'manual'
    };

    const result = await apiCall<WorkflowExecution>('/executions', {
      method: 'POST',
      body: JSON.stringify(request)
    });

    if (result.success && result.data) {
      setState(prev => ({
        ...prev,
        executions: [result.data!, ...prev.executions],
        activeTab: 'monitor',
        isLoading: false
      }));
    } else {
      setState(prev => ({
        ...prev,
        error: result.error || 'Failed to execute workflow',
        isLoading: false
      }));
    }
  };

  const cancelExecution = async (executionId: string) => {
    const result = await apiCall(`/executions/${executionId}/cancel`, {
      method: 'POST'
    });

    if (result.success) {
      loadExecutions(); // Refresh executions
    }
  };

  const updateExecutionParameter = (name: string, value: any) => {
    setState(prev => ({
      ...prev,
      executionParameters: {
        ...prev.executionParameters,
        [name]: value
      }
    }));
  };

  const setActiveTab = (tab: WorkflowManagerState['activeTab']) => {
    setState(prev => ({ ...prev, activeTab: tab }));
  };

  const filteredTemplates = state.templates.filter(template => {
    const matchesSearch = !state.searchQuery || 
      template.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(state.searchQuery.toLowerCase());
    
    const matchesCategory = !state.selectedCategory || template.category === state.selectedCategory;
    
    const matchesTags = state.selectedTags.length === 0 || 
      state.selectedTags.some(tag => template.tags?.includes(tag));

    return matchesSearch && matchesCategory && matchesTags;
  });

  const activeExecutions = state.executions.filter(exec => 
    exec.status === 'running'
  );

  const completedExecutions = state.executions.filter(exec => 
    exec.status === 'completed' || exec.status === 'failed' || exec.status === 'error' || exec.status === 'cancelled'
  );

  const renderTemplatesBrowser = () => (
    <div className="workflow-section">
      <div className="workflow-header">
        <h3>Workflow Templates</h3>
        <div className="workflow-controls">
          <input
            type="text"
            placeholder="Search templates..."
            value={state.searchQuery}
            onChange={(e) => setState(prev => ({ ...prev, searchQuery: e.target.value }))}
            className="search-input"
          />
          <select
            value={state.selectedCategory}
            onChange={(e) => setState(prev => ({ ...prev, selectedCategory: e.target.value }))}
            className="category-select"
          >
            <option value="">All Categories</option>
            {state.categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <button onClick={loadTemplates} disabled={state.isLoading} className="refresh-btn">
            {state.isLoading ? '⏳' : '🔄'} Refresh
          </button>
        </div>
      </div>
      
      {state.isLoading ? (
        <div className="loading-state">Loading templates...</div>
      ) : (
        <div className="template-grid">
          {filteredTemplates.map(template => (
            <div 
              key={template.id} 
              className="template-card"
              onClick={() => selectTemplate(template)}
            >
              <div className="template-header">
                <h4>{template.name}</h4>
                <span className="template-category">{template.category}</span>
              </div>
              <p className="template-description">{template.description}</p>
              <div className="template-meta">
                <span className="template-steps">{template.steps.length} steps</span>
                {template.metadata?.estimatedTime && (
                  <span className="template-time">~{template.metadata.estimatedTime}</span>
                )}
              </div>
              {template.tags && template.tags.length > 0 && (
                <div className="template-tags">
                  {template.tags.map(tag => (
                    <span key={tag} className="template-tag">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderWorkflowExecutor = () => (
    <div className="workflow-section">
      {state.selectedTemplate ? (
        <>
          <div className="workflow-header">
            <h3>Execute: {state.selectedTemplate.name}</h3>
            <button 
              onClick={() => setActiveTab('browser')}
              className="back-btn"
            >
              ← Back to Templates
            </button>
          </div>
          
          <div className="template-info">
            <p>{state.selectedTemplate.description}</p>
            <div className="template-details">
              <span>Category: {state.selectedTemplate.category}</span>
              <span>Steps: {state.selectedTemplate.steps.length}</span>
            </div>
          </div>
          
          <div className="parameters-form">
            <h4>Parameters</h4>
            {Object.entries(state.selectedTemplate.variables).map(([key, defaultValue]) => (
              <div key={key} className="parameter-group">
                <label>{key}</label>
                <input
                  type={typeof defaultValue === 'number' ? 'number' : 'text'}
                  value={state.executionParameters[key] || defaultValue || ''}
                  onChange={(e) => updateExecutionParameter(
                    key, 
                    typeof defaultValue === 'number' ? Number(e.target.value) : e.target.value
                  )}
                />
              </div>
            ))}
          </div>
          
          <div className="executor-actions">
            <button 
              className="execute-btn"
              onClick={executeWorkflow}
              disabled={state.isLoading}
            >
              {state.isLoading ? 'Executing...' : 'Execute Workflow'}
            </button>
          </div>
        </>
      ) : (
        <div className="no-selection">
          <p>Select a template from the browser to configure and execute it.</p>
          <button onClick={() => setActiveTab('browser')}>Browse Templates</button>
        </div>
      )}
    </div>
  );

  const renderWorkflowMonitor = () => (
    <div className="workflow-section">
      <div className="workflow-header">
        <h3>Active Workflows ({activeExecutions.length})</h3>
        <button onClick={loadExecutions} className="refresh-btn">🔄 Refresh</button>
      </div>
      
      {activeExecutions.length === 0 ? (
        <div className="empty-state">
          <p>No active workflows</p>
        </div>
      ) : (
        <div className="execution-list">
          {activeExecutions.map(execution => (
            <div key={execution.id} className="execution-card active">
              <div className="execution-header">
                <h4>{execution.workflowName}</h4>
                <span className={`status ${execution.status}`}>{execution.status}</span>
              </div>
              
              <div className="execution-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${(execution.currentStep / execution.totalSteps) * 100}%` }}
                  />
                </div>
                <span>{execution.currentStep}/{execution.totalSteps} steps</span>
              </div>
              
              <div className="execution-meta">
                <span>Started: {new Date(execution.startTime).toLocaleString()}</span>
              </div>
              
              <div className="execution-actions">
                <button 
                  onClick={() => cancelExecution(execution.id)}
                  className="cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderWorkflowHistory = () => (
    <div className="workflow-section">
      <div className="workflow-header">
        <h3>Workflow History ({completedExecutions.length})</h3>
        <button onClick={loadExecutions} className="refresh-btn">🔄 Refresh</button>
      </div>
      
      {completedExecutions.length === 0 ? (
        <div className="empty-state">
          <p>No completed workflows</p>
        </div>
      ) : (
        <div className="execution-list">
          {completedExecutions.map(execution => (
            <div key={execution.id} className="execution-card completed">
              <div className="execution-header">
                <h4>{execution.workflowName}</h4>
                <span className={`status ${execution.status}`}>{execution.status}</span>
              </div>
              
              <div className="execution-meta">
                <span>Started: {new Date(execution.startTime).toLocaleString()}</span>
                {execution.endTime && (
                  <span>Ended: {new Date(execution.endTime).toLocaleString()}</span>
                )}
                {execution.duration && (
                  <span>Duration: {Math.round(execution.duration / 1000)}s</span>
                )}
              </div>
              
              {execution.error && (
                <div className="execution-error">
                  <strong>Error:</strong> {execution.error}
                </div>
              )}
              
              {execution.result && (
                <div className="execution-results">
                  <div className="result-summary">
                    Completed: {execution.result.completedSteps}/{execution.result.totalSteps} steps
                    {execution.result.failedSteps > 0 && (
                      <span className="failed-steps"> ({execution.result.failedSteps} failed)</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderActiveTab = () => {
    switch (state.activeTab) {
      case 'browser':
        return renderTemplatesBrowser();
      case 'executor':
        return renderWorkflowExecutor();
      case 'monitor':
        return renderWorkflowMonitor();
      case 'history':
        return renderWorkflowHistory();
      default:
        return renderTemplatesBrowser();
    }
  };

  return (
    <div className="workflow-manager">
      <div className="workflow-tabs">
        <button 
          className={state.activeTab === 'browser' ? 'active' : ''}
          onClick={() => setActiveTab('browser')}
        >
          📖 Templates
        </button>
        <button 
          className={state.activeTab === 'executor' ? 'active' : ''}
          onClick={() => setActiveTab('executor')}
        >
          ▶️ Execute
        </button>
        <button 
          className={state.activeTab === 'monitor' ? 'active' : ''}
          onClick={() => setActiveTab('monitor')}
        >
          📊 Monitor ({activeExecutions.length})
        </button>
        <button 
          className={state.activeTab === 'history' ? 'active' : ''}
          onClick={() => setActiveTab('history')}
        >
          📋 History
        </button>
      </div>
      
      <div className="workflow-content">
        {state.error && (
          <div className="workflow-error">
            {state.error}
            <button onClick={() => setState(prev => ({ ...prev, error: null }))}>
              ×
            </button>
          </div>
        )}
        
        {!isConnected && (
          <div className="workflow-warning">
            Not connected to server. Workflow functionality may be limited.
          </div>
        )}
        
        {renderActiveTab()}
      </div>
    </div>
  );
};

export default WorkflowManager;