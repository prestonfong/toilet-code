export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags?: string[];
  variables: Record<string, any>;
  steps: WorkflowStep[];
  metadata?: {
    created?: string;
    version?: string;
    estimatedTime?: string;
    complexity?: 'simple' | 'moderate' | 'complex';
  };
  custom?: boolean;
}

export interface WorkflowStep {
  type: 'tool' | 'command' | 'conditional' | 'loop' | 'parallel' | 'delay' | 'manual';
  name?: string;
  description?: string;
  tool?: string;
  command?: string;
  parameters?: Record<string, any>;
  conditions?: WorkflowCondition[];
  optional?: boolean;
  stopOnFailure?: boolean;
  outputs?: Record<string, string>;
  // Conditional step properties
  condition?: WorkflowCondition[];
  then?: WorkflowStep;
  else?: WorkflowStep;
  // Loop step properties
  items?: any[];
  maxIterations?: number;
  itemVariable?: string;
  indexVariable?: string;
  step?: WorkflowStep;
  // Parallel step properties
  steps?: WorkflowStep[];
  // Delay step properties
  delay?: number;
  // Manual step properties
  instructions?: string;
}

export interface WorkflowCondition {
  variable: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'exists' | 'not_exists' | '==' | '!=' | '>' | '<';
  value?: any;
}

export interface WorkflowExecution {
  id: string;
  workflowId?: string;
  workflowName: string;
  status: 'running' | 'completed' | 'failed' | 'error' | 'cancelled';
  startTime: number;
  endTime?: number;
  duration?: number;
  currentStep: number;
  totalSteps: number;
  progress?: number;
  variables: Record<string, any>;
  results?: any[];
  errors?: Array<{ step: number; error: string }>;
  result?: {
    success: boolean;
    results: any[];
    totalSteps: number;
    completedSteps: number;
    skippedSteps: number;
    failedSteps: number;
  };
  error?: string;
  stack?: string;
  metadata: {
    triggeredBy: string;
    userId?: string;
    mode: string;
    timeout: number;
  };
}

export interface WorkflowParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'file';
  description: string;
  required: boolean;
  defaultValue?: any;
  options?: string[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface WorkflowStats {
  totalTemplates: number;
  categories: number;
  customTemplates: number;
  builtInTemplates: number;
  averageSteps: number;
  activeExecutions: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  cancelledExecutions: number;
}

export interface WorkflowCategory {
  name: string;
  count: number;
  templates: WorkflowTemplate[];
}

export interface WorkflowManagerState {
  templates: WorkflowTemplate[];
  executions: WorkflowExecution[];
  categories: string[];
  tags: string[];
  stats: WorkflowStats | null;
  activeTab: 'browser' | 'executor' | 'monitor' | 'history';
  selectedTemplate: WorkflowTemplate | null;
  selectedExecution: WorkflowExecution | null;
  executionParameters: Record<string, any>;
  searchQuery: string;
  selectedCategory: string;
  selectedTags: string[];
  isLoading: boolean;
  error: string | null;
}

export interface WorkflowLog {
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  message: string;
  step?: string;
}

// API Response Types
export interface WorkflowApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  type?: string;
  steps: WorkflowStep[];
  variables?: Record<string, any>;
  triggers?: any[];
  conditions?: WorkflowCondition[];
  tags?: string[];
  isGlobal?: boolean;
}

export interface ExecuteWorkflowRequest {
  templateId?: string;
  workflowId?: string;
  parameters?: Record<string, any>;
  variables?: Record<string, any>;
  triggeredBy?: string;
  userId?: string;
  timeout?: number;
}

export interface WorkflowFromTemplateRequest {
  templateName: string;
  customVariables?: Record<string, any>;
  name?: string;
  description?: string;
}