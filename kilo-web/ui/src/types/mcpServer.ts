export interface MCPServerConfig {
  id: string;
  name: string;
  type: 'stdio' | 'sse';
  enabled: boolean;
  createdAt: string;
  lastConnected?: string;
  
  // Stdio-based server configuration
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  
  // SSE-based server configuration
  url?: string;
  headers?: Record<string, string>;
  
  // Authentication
  auth?: {
    type: 'none' | 'bearer' | 'basic' | 'api-key';
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
    headerName?: string;
  };
  
  // Connection settings
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  
  // Metadata
  description?: string;
  tags?: string[];
  version?: string;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  };
  serverId: string;
  enabled: boolean;
}

export interface MCPResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
  serverId: string;
}

export interface MCPServerStatus {
  id: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  lastPing?: string;
  uptime?: number;
  responseTime?: number;
  errorMessage?: string;
  processId?: number;
  memoryUsage?: number;
  cpuUsage?: number;
}

export interface MCPServerHealth {
  serverId: string;
  healthy: boolean;
  lastCheck: string;
  checks: {
    connection: boolean;
    tools: boolean;
    resources: boolean;
  };
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
  };
  errors: MCPError[];
}

export interface MCPError {
  timestamp: string;
  type: 'connection' | 'tool' | 'resource' | 'auth' | 'timeout';
  message: string;
  details?: any;
  serverId: string;
}

export interface MCPServerCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  logging?: {
    level?: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';
  };
  prompts?: {
    listChanged?: boolean;
  };
}

export interface MCPConnectionTestResult {
  serverId: string;
  success: boolean;
  responseTime?: number;
  error?: string;
  capabilities?: MCPServerCapabilities;
  toolCount?: number;
  resourceCount?: number;
}

export interface MCPServerStats {
  totalServers: number;
  connectedServers: number;
  totalTools: number;
  totalResources: number;
  averageResponseTime: number;
  uptimePercentage: number;
}

export interface MCPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPNotification extends MCPMessage {
  method: string;
  params?: any;
}

export interface MCPRequest extends MCPMessage {
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse extends MCPMessage {
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPServerManagerState {
  servers: MCPServerConfig[];
  serverStatuses: Record<string, MCPServerStatus>;
  serverHealth: Record<string, MCPServerHealth>;
  tools: MCPTool[];
  resources: MCPResource[];
  selectedServerId?: string;
  isLoading: boolean;
  error?: string;
}

export interface MCPServerFormData {
  name: string;
  type: 'stdio' | 'sse';
  description?: string;
  
  // Stdio fields
  command?: string;
  args?: string;
  env?: string;
  cwd?: string;
  
  // SSE fields
  url?: string;
  headers?: string;
  
  // Auth fields
  authType: 'none' | 'bearer' | 'basic' | 'api-key';
  authToken?: string;
  authUsername?: string;
  authPassword?: string;
  authApiKey?: string;
  authHeaderName?: string;
  
  // Connection settings
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  
  tags?: string;
}

export type MCPServerEventType = 
  | 'server-added'
  | 'server-removed' 
  | 'server-updated'
  | 'server-connected'
  | 'server-disconnected'
  | 'server-error'
  | 'tools-updated'
  | 'resources-updated'
  | 'health-updated';

export interface MCPServerEvent {
  type: MCPServerEventType;
  serverId: string;
  data?: any;
  timestamp: string;
}