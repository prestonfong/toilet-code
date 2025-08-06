import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Plus,
  Settings,
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Search,
  Play,
  Pause,
  Trash2,
  Edit
} from 'lucide-react';
import {
  MCPServerStatus,
  MCPServerManagerState
} from '../types/mcpServer';
import { kiloClient } from '../utils/webClient';
import './MCPServerManager.css';

interface MCPServerManagerProps {
  onClose?: () => void;
}

const MCPServerManager: React.FC<MCPServerManagerProps> = ({ onClose }) => {
  const [state, setState] = useState<MCPServerManagerState>({
    servers: [],
    serverStatuses: {},
    serverHealth: {},
    tools: [],
    resources: [],
    isLoading: true,
    error: undefined
  });

  const [activeTab, setActiveTab] = useState<'overview' | 'servers' | 'tools' | 'resources' | 'health'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'connected' | 'disconnected' | 'error'>('all');

  // Initialize MCP data
  useEffect(() => {
    loadMCPData();
    
    // Set up WebSocket listeners for MCP events
    kiloClient.on('mcpServerAdded', handleServerAdded);
    kiloClient.on('mcpServerRemoved', handleServerRemoved);
    kiloClient.on('mcpServerStatusChanged', handleServerStatusChanged);
    kiloClient.on('mcpToolsUpdated', handleToolsUpdated);
    kiloClient.on('mcpResourcesUpdated', handleResourcesUpdated);
    kiloClient.on('mcpHealthUpdated', handleHealthUpdated);

    return () => {
      kiloClient.off('mcpServerAdded');
      kiloClient.off('mcpServerRemoved');
      kiloClient.off('mcpServerStatusChanged');
      kiloClient.off('mcpToolsUpdated');
      kiloClient.off('mcpResourcesUpdated');
      kiloClient.off('mcpHealthUpdated');
    };
  }, []);

  const loadMCPData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: undefined }));
    
    try {
      // Send requests for MCP data
      kiloClient.send({ type: 'mcpGetServers' });
      kiloClient.send({ type: 'mcpGetServerStatuses' });
      kiloClient.send({ type: 'mcpGetTools' });
      kiloClient.send({ type: 'mcpGetResources' });
      kiloClient.send({ type: 'mcpGetHealth' });
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Failed to load MCP data' 
      }));
    }
  }, []);

  // WebSocket event handlers
  const handleServerAdded = useCallback((data: any) => {
    setState(prev => ({
      ...prev,
      servers: [...prev.servers, data.server]
    }));
  }, []);

  const handleServerRemoved = useCallback((data: any) => {
    setState(prev => ({
      ...prev,
      servers: prev.servers.filter(s => s.id !== data.serverId)
    }));
  }, []);

  const handleServerStatusChanged = useCallback((data: any) => {
    setState(prev => ({
      ...prev,
      serverStatuses: {
        ...prev.serverStatuses,
        [data.serverId]: data.status
      }
    }));
  }, []);

  const handleToolsUpdated = useCallback((data: any) => {
    setState(prev => ({
      ...prev,
      tools: data.tools
    }));
  }, []);

  const handleResourcesUpdated = useCallback((data: any) => {
    setState(prev => ({
      ...prev,
      resources: data.resources
    }));
  }, []);

  const handleHealthUpdated = useCallback((data: any) => {
    setState(prev => ({
      ...prev,
      serverHealth: {
        ...prev.serverHealth,
        [data.serverId]: data.health
      }
    }));
  }, []);

  // Server actions
  const handleToggleServer = useCallback(async (serverId: string, enabled: boolean) => {
    try {
      kiloClient.send({
        type: 'mcpToggleServer',
        serverId,
        enabled
      });
    } catch (error) {
      console.error('Failed to toggle server:', error);
    }
  }, []);

  const handleDeleteServer = useCallback(async (serverId: string) => {
    if (!confirm('Are you sure you want to delete this MCP server? This action cannot be undone.')) {
      return;
    }

    try {
      kiloClient.send({
        type: 'mcpDeleteServer',
        serverId
      });
    } catch (error) {
      console.error('Failed to delete server:', error);
    }
  }, []);

  const handleTestConnection = useCallback(async (serverId: string) => {
    try {
      kiloClient.send({
        type: 'mcpTestConnection',
        serverId
      });
    } catch (error) {
      console.error('Failed to test connection:', error);
    }
  }, []);

  const handleRefreshData = useCallback(() => {
    loadMCPData();
  }, [loadMCPData]);

  // Filter servers based on search and status
  const filteredServers = state.servers.filter(server => {
    const matchesSearch = server.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         server.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    if (filterStatus === 'all') return true;
    
    const status = state.serverStatuses[server.id];
    return status?.status === filterStatus;
  });

  const getServerStatusIcon = (status?: MCPServerStatus) => {
    if (!status) return <XCircle className="w-4 h-4 text-gray-400" />;
    
    switch (status.status) {
      case 'connected':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'connecting':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <XCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getServerStatusText = (status?: MCPServerStatus) => {
    if (!status) return 'Unknown';
    return status.status.charAt(0).toUpperCase() + status.status.slice(1);
  };

  const renderOverview = () => {
    const connectedCount = Object.values(state.serverStatuses).filter(s => s.status === 'connected').length;
    const totalServers = state.servers.length;
    const totalTools = state.tools.length;
    const totalResources = state.resources.length;

    return (
      <div className="mcp-overview">
        <div className="mcp-stats-grid">
          <div className="mcp-stat-card">
            <div className="mcp-stat-icon">
              <Server className="w-6 h-6" />
            </div>
            <div className="mcp-stat-content">
              <div className="mcp-stat-number">{connectedCount}/{totalServers}</div>
              <div className="mcp-stat-label">Connected Servers</div>
            </div>
          </div>
          
          <div className="mcp-stat-card">
            <div className="mcp-stat-icon">
              <Settings className="w-6 h-6" />
            </div>
            <div className="mcp-stat-content">
              <div className="mcp-stat-number">{totalTools}</div>
              <div className="mcp-stat-label">Available Tools</div>
            </div>
          </div>
          
          <div className="mcp-stat-card">
            <div className="mcp-stat-icon">
              <Activity className="w-6 h-6" />
            </div>
            <div className="mcp-stat-content">
              <div className="mcp-stat-number">{totalResources}</div>
              <div className="mcp-stat-label">Resources</div>
            </div>
          </div>
        </div>

        <div className="mcp-recent-activity">
          <h3>Recent Server Activity</h3>
          <div className="mcp-activity-list">
            {state.servers.slice(0, 5).map(server => {
              const status = state.serverStatuses[server.id];
              return (
                <div key={server.id} className="mcp-activity-item">
                  <div className="mcp-activity-icon">
                    {getServerStatusIcon(status)}
                  </div>
                  <div className="mcp-activity-content">
                    <div className="mcp-activity-title">{server.name}</div>
                    <div className="mcp-activity-subtitle">
                      {getServerStatusText(status)}
                      {status?.lastPing && ` • Last seen ${new Date(status.lastPing).toLocaleTimeString()}`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderServers = () => (
    <div className="mcp-servers">
      <div className="mcp-servers-header">
        <div className="mcp-search-filter">
          <div className="mcp-search">
            <Search className="w-4 h-4" />
            <input
              type="text"
              placeholder="Search servers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select 
            className="mcp-filter"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
          >
            <option value="all">All Status</option>
            <option value="connected">Connected</option>
            <option value="disconnected">Disconnected</option>
            <option value="error">Error</option>
          </select>
        </div>
        
        <div className="mcp-servers-actions">
          <button className="mcp-btn mcp-btn-secondary" onClick={handleRefreshData}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button className="mcp-btn mcp-btn-primary" onClick={() => console.log('Add server')}>
            <Plus className="w-4 h-4" />
            Add Server
          </button>
        </div>
      </div>

      <div className="mcp-servers-list">
        {filteredServers.map(server => {
          const status = state.serverStatuses[server.id];
          const health = state.serverHealth[server.id];
          
          return (
            <div key={server.id} className="mcp-server-card">
              <div className="mcp-server-header">
                <div className="mcp-server-info">
                  <div className="mcp-server-name">
                    {server.name}
                    <span className="mcp-server-type">{server.type.toUpperCase()}</span>
                  </div>
                  <div className="mcp-server-description">{server.description}</div>
                </div>
                
                <div className="mcp-server-status">
                  {getServerStatusIcon(status)}
                  <span>{getServerStatusText(status)}</span>
                </div>
                
                <div className="mcp-server-actions">
                  <button
                    className="mcp-btn mcp-btn-icon"
                    onClick={() => handleToggleServer(server.id, !server.enabled)}
                    title={server.enabled ? 'Disable server' : 'Enable server'}
                  >
                    {server.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  
                  <button
                    className="mcp-btn mcp-btn-icon"
                    onClick={() => handleTestConnection(server.id)}
                    title="Test connection"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  
                  <button
                    className="mcp-btn mcp-btn-icon"
                    onClick={() => console.log('Edit server:', server.id)}
                    title="Edit server"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  
                  <button
                    className="mcp-btn mcp-btn-icon mcp-btn-danger"
                    onClick={() => handleDeleteServer(server.id)}
                    title="Delete server"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {status && (
                <div className="mcp-server-details">
                  <div className="mcp-server-metrics">
                    {status.uptime && (
                      <div className="mcp-metric">
                        <span>Uptime:</span>
                        <span>{Math.floor(status.uptime / 1000 / 60)} min</span>
                      </div>
                    )}
                    {status.responseTime && (
                      <div className="mcp-metric">
                        <span>Response:</span>
                        <span>{status.responseTime}ms</span>
                      </div>
                    )}
                    {health && (
                      <div className="mcp-metric">
                        <span>Health:</span>
                        <span className={health.healthy ? 'text-green' : 'text-red'}>
                          {health.healthy ? 'Healthy' : 'Unhealthy'}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {status.errorMessage && (
                    <div className="mcp-server-error">
                      <AlertCircle className="w-4 h-4" />
                      <span>{status.errorMessage}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderTools = () => (
    <div className="mcp-tools">
      <div className="mcp-tools-header">
        <h3>Available Tools ({state.tools.length})</h3>
        <button className="mcp-btn mcp-btn-secondary" onClick={handleRefreshData}>
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>
      
      <div className="mcp-tools-list">
        {state.tools.map(tool => {
          const server = state.servers.find(s => s.id === tool.serverId);
          return (
            <div key={`${tool.serverId}-${tool.name}`} className="mcp-tool-card">
              <div className="mcp-tool-header">
                <div className="mcp-tool-name">{tool.name}</div>
                <div className="mcp-tool-server">{server?.name}</div>
              </div>
              <div className="mcp-tool-description">{tool.description}</div>
              <div className="mcp-tool-schema">
                <details>
                  <summary>Input Schema</summary>
                  <pre>{JSON.stringify(tool.inputSchema, null, 2)}</pre>
                </details>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderResources = () => (
    <div className="mcp-resources">
      <div className="mcp-resources-header">
        <h3>Available Resources ({state.resources.length})</h3>
        <button className="mcp-btn mcp-btn-secondary" onClick={handleRefreshData}>
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>
      
      <div className="mcp-resources-list">
        {state.resources.map(resource => {
          const server = state.servers.find(s => s.id === resource.serverId);
          return (
            <div key={`${resource.serverId}-${resource.uri}`} className="mcp-resource-card">
              <div className="mcp-resource-header">
                <div className="mcp-resource-name">{resource.name || resource.uri}</div>
                <div className="mcp-resource-server">{server?.name}</div>
              </div>
              <div className="mcp-resource-uri">{resource.uri}</div>
              {resource.description && (
                <div className="mcp-resource-description">{resource.description}</div>
              )}
              {resource.mimeType && (
                <div className="mcp-resource-mime">{resource.mimeType}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderHealth = () => (
    <div className="mcp-health">
      <div className="mcp-health-header">
        <h3>Server Health Status</h3>
        <button className="mcp-btn mcp-btn-secondary" onClick={handleRefreshData}>
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>
      
      <div className="mcp-health-list">
        {state.servers.map(server => {
          const health = state.serverHealth[server.id];
          const status = state.serverStatuses[server.id];
          
          return (
            <div key={server.id} className="mcp-health-card">
              <div className="mcp-health-header">
                <div className="mcp-health-server">
                  <div className="mcp-health-name">{server.name}</div>
                  <div className="mcp-health-status">
                    {getServerStatusIcon(status)}
                    <span>{getServerStatusText(status)}</span>
                  </div>
                </div>
              </div>
              
              {health && (
                <div className="mcp-health-details">
                  <div className="mcp-health-checks">
                    <div className={`mcp-health-check ${health.checks.connection ? 'healthy' : 'unhealthy'}`}>
                      Connection: {health.checks.connection ? 'OK' : 'Failed'}
                    </div>
                    <div className={`mcp-health-check ${health.checks.tools ? 'healthy' : 'unhealthy'}`}>
                      Tools: {health.checks.tools ? 'OK' : 'Failed'}
                    </div>
                    <div className={`mcp-health-check ${health.checks.resources ? 'healthy' : 'unhealthy'}`}>
                      Resources: {health.checks.resources ? 'OK' : 'Failed'}
                    </div>
                  </div>
                  
                  <div className="mcp-health-metrics">
                    <div>Requests: {health.metrics.totalRequests}</div>
                    <div>Success Rate: {Math.round((health.metrics.successfulRequests / health.metrics.totalRequests) * 100)}%</div>
                    <div>Avg Response: {health.metrics.averageResponseTime}ms</div>
                  </div>
                  
                  {health.errors.length > 0 && (
                    <div className="mcp-health-errors">
                      <h4>Recent Errors:</h4>
                      {health.errors.slice(0, 3).map((error, index) => (
                        <div key={index} className="mcp-health-error">
                          <div className="mcp-error-type">{error.type}</div>
                          <div className="mcp-error-message">{error.message}</div>
                          <div className="mcp-error-time">{new Date(error.timestamp).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  if (state.isLoading) {
    return (
      <div className="mcp-manager">
        <div className="mcp-loading">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <span>Loading MCP servers...</span>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="mcp-manager">
        <div className="mcp-error">
          <AlertCircle className="w-6 h-6 text-red-500" />
          <span>{state.error}</span>
          <button className="mcp-btn mcp-btn-primary" onClick={handleRefreshData}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mcp-manager">
      <div className="mcp-header">
        <div className="mcp-title">
          <Server className="w-6 h-6" />
          <h2>MCP Server Management</h2>
        </div>
        {onClose && (
          <button className="mcp-btn mcp-btn-secondary" onClick={onClose}>
            Close
          </button>
        )}
      </div>

      <div className="mcp-tabs">
        <button
          className={`mcp-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`mcp-tab ${activeTab === 'servers' ? 'active' : ''}`}
          onClick={() => setActiveTab('servers')}
        >
          Servers ({state.servers.length})
        </button>
        <button
          className={`mcp-tab ${activeTab === 'tools' ? 'active' : ''}`}
          onClick={() => setActiveTab('tools')}
        >
          Tools ({state.tools.length})
        </button>
        <button
          className={`mcp-tab ${activeTab === 'resources' ? 'active' : ''}`}
          onClick={() => setActiveTab('resources')}
        >
          Resources ({state.resources.length})
        </button>
        <button
          className={`mcp-tab ${activeTab === 'health' ? 'active' : ''}`}
          onClick={() => setActiveTab('health')}
        >
          Health
        </button>
      </div>

      <div className="mcp-content">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'servers' && renderServers()}
        {activeTab === 'tools' && renderTools()}
        {activeTab === 'resources' && renderResources()}
        {activeTab === 'health' && renderHealth()}
      </div>
    </div>
  );
};

export default MCPServerManager;