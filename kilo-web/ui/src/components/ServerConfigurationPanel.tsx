import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  TestTube,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  MCPServerConfig, 
  MCPServerFormData,
  MCPConnectionTestResult 
} from '../types/mcpServer';
import { kiloClient } from '../utils/webClient';

interface ServerConfigurationPanelProps {
  server?: MCPServerConfig;
  onSave: (config: MCPServerConfig) => void;
  onCancel: () => void;
  isVisible: boolean;
}

const ServerConfigurationPanel: React.FC<ServerConfigurationPanelProps> = ({
  server,
  onSave,
  onCancel,
  isVisible
}) => {
  const [formData, setFormData] = useState<MCPServerFormData>({
    name: '',
    type: 'stdio',
    description: '',
    command: '',
    args: '',
    env: '',
    cwd: '',
    url: '',
    headers: '',
    authType: 'none',
    authToken: '',
    authUsername: '',
    authPassword: '',
    authApiKey: '',
    authHeaderName: '',
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
    tags: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<MCPConnectionTestResult | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [activeStep, setActiveStep] = useState(1);

  // Initialize form data when server prop changes
  useEffect(() => {
    if (server) {
      setFormData({
        name: server.name,
        type: server.type,
        description: server.description || '',
        command: server.command || '',
        args: server.args?.join(' ') || '',
        env: server.env ? Object.entries(server.env).map(([k, v]) => `${k}=${v}`).join('\n') : '',
        cwd: server.cwd || '',
        url: server.url || '',
        headers: server.headers ? Object.entries(server.headers).map(([k, v]) => `${k}: ${v}`).join('\n') : '',
        authType: server.auth?.type || 'none',
        authToken: server.auth?.token || '',
        authUsername: server.auth?.username || '',
        authPassword: server.auth?.password || '',
        authApiKey: server.auth?.apiKey || '',
        authHeaderName: server.auth?.headerName || '',
        timeout: server.timeout || 30000,
        retryAttempts: server.retryAttempts || 3,
        retryDelay: server.retryDelay || 1000,
        tags: server.tags?.join(', ') || ''
      });
    } else {
      // Reset form for new server
      setFormData({
        name: '',
        type: 'stdio',
        description: '',
        command: '',
        args: '',
        env: '',
        cwd: '',
        url: '',
        headers: '',
        authType: 'none',
        authToken: '',
        authUsername: '',
        authPassword: '',
        authApiKey: '',
        authHeaderName: '',
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
        tags: ''
      });
    }
    setErrors({});
    setTestResult(null);
    setActiveStep(1);
  }, [server]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Server name is required';
    }

    if (formData.type === 'stdio') {
      if (!formData.command?.trim()) {
        newErrors.command = 'Command is required for stdio servers';
      }
    } else if (formData.type === 'sse') {
      if (!formData.url?.trim()) {
        newErrors.url = 'URL is required for SSE servers';
      } else {
        try {
          new URL(formData.url);
        } catch {
          newErrors.url = 'Invalid URL format';
        }
      }
    }

    // Validate auth fields based on auth type
    if (formData.authType === 'bearer' && !formData.authToken?.trim()) {
      newErrors.authToken = 'Bearer token is required';
    } else if (formData.authType === 'basic') {
      if (!formData.authUsername?.trim()) {
        newErrors.authUsername = 'Username is required for basic auth';
      }
      if (!formData.authPassword?.trim()) {
        newErrors.authPassword = 'Password is required for basic auth';
      }
    } else if (formData.authType === 'api-key') {
      if (!formData.authApiKey?.trim()) {
        newErrors.authApiKey = 'API key is required';
      }
      if (!formData.authHeaderName?.trim()) {
        newErrors.authHeaderName = 'Header name is required for API key auth';
      }
    }

    // Validate numeric fields
    if (formData.timeout && (formData.timeout < 1000 || formData.timeout > 300000)) {
      newErrors.timeout = 'Timeout must be between 1000ms and 300000ms';
    }

    if (formData.retryAttempts && (formData.retryAttempts < 0 || formData.retryAttempts > 10)) {
      newErrors.retryAttempts = 'Retry attempts must be between 0 and 10';
    }

    if (formData.retryDelay && (formData.retryDelay < 100 || formData.retryDelay > 60000)) {
      newErrors.retryDelay = 'Retry delay must be between 100ms and 60000ms';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof MCPServerFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const parseEnvironmentVariables = (envString: string): Record<string, string> => {
    const env: Record<string, string> = {};
    if (!envString.trim()) return env;

    envString.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        env[key.trim()] = valueParts.join('=').trim();
      }
    });

    return env;
  };

  const parseHeaders = (headersString: string): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (!headersString.trim()) return headers;

    headersString.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && trimmed.includes(':')) {
        const [key, ...valueParts] = trimmed.split(':');
        headers[key.trim()] = valueParts.join(':').trim();
      }
    });

    return headers;
  };

  const convertFormDataToConfig = (): MCPServerConfig => {
    const config: MCPServerConfig = {
      id: server?.id || `mcp-${Date.now()}`,
      name: formData.name.trim(),
      type: formData.type,
      enabled: server?.enabled ?? true,
      createdAt: server?.createdAt || new Date().toISOString(),
      description: formData.description?.trim() || undefined,
      timeout: formData.timeout,
      retryAttempts: formData.retryAttempts,
      retryDelay: formData.retryDelay,
      tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined
    };

    if (formData.type === 'stdio') {
      config.command = formData.command?.trim();
      config.args = formData.args ? formData.args.trim().split(/\s+/).filter(Boolean) : undefined;
      config.env = parseEnvironmentVariables(formData.env || '');
      config.cwd = formData.cwd?.trim() || undefined;
    } else {
      config.url = formData.url?.trim();
      config.headers = parseHeaders(formData.headers || '');
    }

    // Add authentication
    if (formData.authType !== 'none') {
      config.auth = {
        type: formData.authType,
        token: formData.authToken?.trim() || undefined,
        username: formData.authUsername?.trim() || undefined,
        password: formData.authPassword?.trim() || undefined,
        apiKey: formData.authApiKey?.trim() || undefined,
        headerName: formData.authHeaderName?.trim() || undefined
      };
    }

    return config;
  };

  const handleTestConnection = async () => {
    if (!validateForm()) {
      return;
    }

    setIsTestingConnection(true);
    setTestResult(null);

    try {
      const config = convertFormDataToConfig();
      
      // Send test request to backend
      kiloClient.send({
        type: 'mcpTestServerConfig',
        config
      });

      // Listen for test result
      const handleTestResult = (data: any) => {
        if (data.serverId === config.id || data.tempId === config.id) {
          setTestResult(data.result);
          setIsTestingConnection(false);
          kiloClient.off('mcpConnectionTestResult');
        }
      };

      kiloClient.on('mcpConnectionTestResult', handleTestResult);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (isTestingConnection) {
          setIsTestingConnection(false);
          setTestResult({
            serverId: config.id,
            success: false,
            error: 'Connection test timed out'
          });
          kiloClient.off('mcpConnectionTestResult');
        }
      }, 30000);
      
    } catch (error) {
      setIsTestingConnection(false);
      setTestResult({
        serverId: 'test',
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      });
    }
  };

  const handleSave = () => {
    if (!validateForm()) {
      return;
    }

    const config = convertFormDataToConfig();
    onSave(config);
  };

  const renderStepIndicator = () => (
    <div className="server-config-steps">
      <div className={`server-config-step ${activeStep >= 1 ? 'active' : ''}`}>
        <div className="step-number">1</div>
        <div className="step-label">Basic Info</div>
      </div>
      <div className={`server-config-step ${activeStep >= 2 ? 'active' : ''}`}>
        <div className="step-number">2</div>
        <div className="step-label">Connection</div>
      </div>
      <div className={`server-config-step ${activeStep >= 3 ? 'active' : ''}`}>
        <div className="step-number">3</div>
        <div className="step-label">Authentication</div>
      </div>
      <div className={`server-config-step ${activeStep >= 4 ? 'active' : ''}`}>
        <div className="step-number">4</div>
        <div className="step-label">Advanced</div>
      </div>
    </div>
  );

  const renderBasicInfo = () => (
    <div className="server-config-section">
      <h3>Basic Information</h3>
      
      <div className="form-group">
        <label htmlFor="server-name">
          Server Name *
          <span className="help-text">A unique name to identify this MCP server</span>
        </label>
        <input
          id="server-name"
          type="text"
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          placeholder="e.g., My MCP Server"
          className={errors.name ? 'error' : ''}
        />
        {errors.name && <div className="error-message">{errors.name}</div>}
      </div>

      <div className="form-group">
        <label htmlFor="server-type">
          Server Type *
          <span className="help-text">Choose the communication method for this server</span>
        </label>
        <select
          id="server-type"
          value={formData.type}
          onChange={(e) => handleInputChange('type', e.target.value as 'stdio' | 'sse')}
        >
          <option value="stdio">Stdio (Local Process)</option>
          <option value="sse">SSE (Server-Sent Events)</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="server-description">
          Description
          <span className="help-text">Optional description of what this server provides</span>
        </label>
        <textarea
          id="server-description"
          value={formData.description}
          onChange={(e) => handleInputChange('description', e.target.value)}
          placeholder="e.g., Provides file system tools and git integration"
          rows={3}
        />
      </div>

      <div className="form-group">
        <label htmlFor="server-tags">
          Tags
          <span className="help-text">Comma-separated tags for organization</span>
        </label>
        <input
          id="server-tags"
          type="text"
          value={formData.tags}
          onChange={(e) => handleInputChange('tags', e.target.value)}
          placeholder="e.g., filesystem, git, development"
        />
      </div>
    </div>
  );

  const renderConnectionConfig = () => (
    <div className="server-config-section">
      <h3>Connection Configuration</h3>
      
      {formData.type === 'stdio' ? (
        <>
          <div className="form-group">
            <label htmlFor="server-command">
              Command *
              <span className="help-text">The command to execute for this MCP server</span>
            </label>
            <input
              id="server-command"
              type="text"
              value={formData.command}
              onChange={(e) => handleInputChange('command', e.target.value)}
              placeholder="e.g., node, python, /path/to/executable"
              className={errors.command ? 'error' : ''}
            />
            {errors.command && <div className="error-message">{errors.command}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="server-args">
              Arguments
              <span className="help-text">Command line arguments (space-separated)</span>
            </label>
            <input
              id="server-args"
              type="text"
              value={formData.args}
              onChange={(e) => handleInputChange('args', e.target.value)}
              placeholder="e.g., server.js --port 3000"
            />
          </div>

          <div className="form-group">
            <label htmlFor="server-cwd">
              Working Directory
              <span className="help-text">Directory to run the command in</span>
            </label>
            <input
              id="server-cwd"
              type="text"
              value={formData.cwd}
              onChange={(e) => handleInputChange('cwd', e.target.value)}
              placeholder="e.g., /path/to/server/directory"
            />
          </div>

          <div className="form-group">
            <label htmlFor="server-env">
              Environment Variables
              <span className="help-text">One per line in KEY=value format</span>
            </label>
            <textarea
              id="server-env"
              value={formData.env}
              onChange={(e) => handleInputChange('env', e.target.value)}
              placeholder="API_KEY=your_key_here&#10;DEBUG=true&#10;PORT=3000"
              rows={4}
            />
          </div>
        </>
      ) : (
        <>
          <div className="form-group">
            <label htmlFor="server-url">
              Server URL *
              <span className="help-text">The HTTP/HTTPS URL of the MCP server</span>
            </label>
            <input
              id="server-url"
              type="url"
              value={formData.url}
              onChange={(e) => handleInputChange('url', e.target.value)}
              placeholder="https://your-mcp-server.com/mcp"
              className={errors.url ? 'error' : ''}
            />
            {errors.url && <div className="error-message">{errors.url}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="server-headers">
              Custom Headers
              <span className="help-text">One per line in Header: value format</span>
            </label>
            <textarea
              id="server-headers"
              value={formData.headers}
              onChange={(e) => handleInputChange('headers', e.target.value)}
              placeholder="User-Agent: My MCP Client&#10;X-Custom-Header: value"
              rows={4}
            />
          </div>
        </>
      )}
    </div>
  );

  const renderAuthentication = () => (
    <div className="server-config-section">
      <h3>Authentication</h3>
      
      <div className="form-group">
        <label htmlFor="auth-type">
          Authentication Type
          <span className="help-text">Choose how to authenticate with the server</span>
        </label>
        <select
          id="auth-type"
          value={formData.authType}
          onChange={(e) => handleInputChange('authType', e.target.value as any)}
        >
          <option value="none">No Authentication</option>
          <option value="bearer">Bearer Token</option>
          <option value="basic">Basic Authentication</option>
          <option value="api-key">API Key</option>
        </select>
      </div>

      {formData.authType === 'bearer' && (
        <div className="form-group">
          <label htmlFor="auth-token">
            Bearer Token *
            <span className="help-text">The bearer token for authentication</span>
          </label>
          <div className="password-input">
            <input
              id="auth-token"
              type={showPassword ? 'text' : 'password'}
              value={formData.authToken}
              onChange={(e) => handleInputChange('authToken', e.target.value)}
              placeholder="Enter bearer token"
              className={errors.authToken ? 'error' : ''}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.authToken && <div className="error-message">{errors.authToken}</div>}
        </div>
      )}

      {formData.authType === 'basic' && (
        <>
          <div className="form-group">
            <label htmlFor="auth-username">
              Username *
              <span className="help-text">Username for basic authentication</span>
            </label>
            <input
              id="auth-username"
              type="text"
              value={formData.authUsername}
              onChange={(e) => handleInputChange('authUsername', e.target.value)}
              placeholder="Enter username"
              className={errors.authUsername ? 'error' : ''}
            />
            {errors.authUsername && <div className="error-message">{errors.authUsername}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="auth-password">
              Password *
              <span className="help-text">Password for basic authentication</span>
            </label>
            <div className="password-input">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                value={formData.authPassword}
                onChange={(e) => handleInputChange('authPassword', e.target.value)}
                placeholder="Enter password"
                className={errors.authPassword ? 'error' : ''}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.authPassword && <div className="error-message">{errors.authPassword}</div>}
          </div>
        </>
      )}

      {formData.authType === 'api-key' && (
        <>
          <div className="form-group">
            <label htmlFor="auth-header-name">
              Header Name *
              <span className="help-text">The header name for the API key (e.g., X-API-Key)</span>
            </label>
            <input
              id="auth-header-name"
              type="text"
              value={formData.authHeaderName}
              onChange={(e) => handleInputChange('authHeaderName', e.target.value)}
              placeholder="X-API-Key"
              className={errors.authHeaderName ? 'error' : ''}
            />
            {errors.authHeaderName && <div className="error-message">{errors.authHeaderName}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="auth-api-key">
              API Key *
              <span className="help-text">The API key value</span>
            </label>
            <div className="password-input">
              <input
                id="auth-api-key"
                type={showPassword ? 'text' : 'password'}
                value={formData.authApiKey}
                onChange={(e) => handleInputChange('authApiKey', e.target.value)}
                placeholder="Enter API key"
                className={errors.authApiKey ? 'error' : ''}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.authApiKey && <div className="error-message">{errors.authApiKey}</div>}
          </div>
        </>
      )}
    </div>
  );

  const renderAdvancedSettings = () => (
    <div className="server-config-section">
      <h3>Advanced Settings</h3>
      
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="server-timeout">
            Timeout (ms)
            <span className="help-text">Connection timeout in milliseconds</span>
          </label>
          <input
            id="server-timeout"
            type="number"
            min="1000"
            max="300000"
            step="1000"
            value={formData.timeout}
            onChange={(e) => handleInputChange('timeout', parseInt(e.target.value))}
            className={errors.timeout ? 'error' : ''}
          />
          {errors.timeout && <div className="error-message">{errors.timeout}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="server-retry-attempts">
            Retry Attempts
            <span className="help-text">Number of retry attempts on failure</span>
          </label>
          <input
            id="server-retry-attempts"
            type="number"
            min="0"
            max="10"
            value={formData.retryAttempts}
            onChange={(e) => handleInputChange('retryAttempts', parseInt(e.target.value))}
            className={errors.retryAttempts ? 'error' : ''}
          />
          {errors.retryAttempts && <div className="error-message">{errors.retryAttempts}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="server-retry-delay">
            Retry Delay (ms)
            <span className="help-text">Delay between retry attempts</span>
          </label>
          <input
            id="server-retry-delay"
            type="number"
            min="100"
            max="60000"
            step="100"
            value={formData.retryDelay}
            onChange={(e) => handleInputChange('retryDelay', parseInt(e.target.value))}
            className={errors.retryDelay ? 'error' : ''}
          />
          {errors.retryDelay && <div className="error-message">{errors.retryDelay}</div>}
        </div>
      </div>
    </div>
  );

  const renderTestResults = () => {
    if (!testResult) return null;

    return (
      <div className={`server-config-test-result ${testResult.success ? 'success' : 'error'}`}>
        <div className="test-result-header">
          {testResult.success ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-500" />
          )}
          <span>
            {testResult.success ? 'Connection Successful' : 'Connection Failed'}
          </span>
        </div>
        
        {testResult.success ? (
          <div className="test-result-details">
            {testResult.responseTime && (
              <div>Response Time: {testResult.responseTime}ms</div>
            )}
            {testResult.capabilities && (
              <div>
                Capabilities: {Object.keys(testResult.capabilities).join(', ')}
              </div>
            )}
            {testResult.toolCount !== undefined && (
              <div>Available Tools: {testResult.toolCount}</div>
            )}
            {testResult.resourceCount !== undefined && (
              <div>Available Resources: {testResult.resourceCount}</div>
            )}
          </div>
        ) : (
          <div className="test-result-error">
            {testResult.error}
          </div>
        )}
      </div>
    );
  };

  if (!isVisible) return null;

  return (
    <div className="server-config-overlay">
      <div className="server-config-panel">
        <div className="server-config-header">
          <h2>{server ? 'Edit MCP Server' : 'Add MCP Server'}</h2>
          <button className="close-button" onClick={onCancel}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {renderStepIndicator()}

        <div className="server-config-content">
          {activeStep === 1 && renderBasicInfo()}
          {activeStep === 2 && renderConnectionConfig()}
          {activeStep === 3 && renderAuthentication()}
          {activeStep === 4 && renderAdvancedSettings()}
          
          {renderTestResults()}
        </div>

        <div className="server-config-actions">
          <div className="step-navigation">
            {activeStep > 1 && (
              <button
                className="nav-button prev"
                onClick={() => setActiveStep(activeStep - 1)}
              >
                Previous
              </button>
            )}
            
            {activeStep < 4 ? (
              <button
                className="nav-button next"
                onClick={() => setActiveStep(activeStep + 1)}
              >
                Next
              </button>
            ) : (
              <button
                className="test-button"
                onClick={handleTestConnection}
                disabled={isTestingConnection}
              >
                <TestTube className="w-4 h-4" />
                {isTestingConnection ? 'Testing...' : 'Test Connection'}
              </button>
            )}
          </div>

          <div className="action-buttons">
            <button className="cancel-button" onClick={onCancel}>
              Cancel
            </button>
            <button 
              className="save-button" 
              onClick={handleSave}
              disabled={isTestingConnection}
            >
              <Save className="w-4 h-4" />
              {server ? 'Update Server' : 'Add Server'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServerConfigurationPanel;