export interface TaskHistoryItem {
  id: string;
  title: string;
  mode: string;
  status: 'completed' | 'in-progress' | 'cancelled' | 'failed';
  createdAt: number;
  lastModified: number;
  duration?: number;
  workspace?: string;
  category?: string;
  tags?: string[];
  metadata: {
    totalMessages: number;
    userMessages: number;
    assistantMessages: number;
    tokensUsed?: number;
    toolsUsed?: string[];
    filesModified?: string[];
    commandsExecuted?: number;
    errorCount?: number;
  };
  messages: TaskMessage[];
  summary?: string;
  archived?: boolean;
}

export interface TaskMessage {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  mode?: string;
  metadata?: {
    tokensEstimate?: number;
    tool?: string;
    toolArgs?: any;
    toolResult?: any;
    important?: boolean;
    edited?: boolean;
  };
}

export interface TaskSearchFilters {
  query?: string;
  mode?: string[];
  status?: string[];
  dateRange?: {
    start: number;
    end: number;
  };
  workspace?: string[];
  category?: string[];
  tags?: string[];
  hasFiles?: boolean;
  hasErrors?: boolean;
  minDuration?: number;
  maxDuration?: number;
  minMessages?: number;
  maxMessages?: number;
}

export interface TaskStatistics {
  total: number;
  byStatus: Record<string, number>;
  byMode: Record<string, number>;
  byWorkspace: Record<string, number>;
  totalMessages: number;
  totalTokens: number;
  totalDuration: number;
  averageDuration: number;
  mostUsedTools: Array<{
    tool: string;
    count: number;
  }>;
  recentActivity: Array<{
    date: string;
    count: number;
  }>;
  completionRate: number;
}

export interface TaskBatchOperation {
  type: 'delete' | 'archive' | 'unarchive' | 'export' | 'tag' | 'categorize';
  taskIds: string[];
  params?: {
    tags?: string[];
    category?: string;
    exportFormat?: 'json' | 'csv' | 'markdown';
  };
}

export interface TaskExportData {
  version: string;
  exportedAt: number;
  tasks: TaskHistoryItem[];
  metadata: {
    totalTasks: number;
    dateRange: {
      start: number;
      end: number;
    };
    filters?: TaskSearchFilters;
  };
}

export interface TaskHistoryState {
  tasks: TaskHistoryItem[];
  loading: boolean;
  searchFilters: TaskSearchFilters;
  selectedTasks: string[];
  sortBy: 'createdAt' | 'lastModified' | 'duration' | 'messages' | 'status';
  sortOrder: 'asc' | 'desc';
  viewMode: 'list' | 'grid' | 'timeline';
  showArchived: boolean;
}

// Search and filter utilities
export interface TaskSearchResult {
  tasks: TaskHistoryItem[];
  totalCount: number;
  hasMore: boolean;
  searchTime: number;
}

export interface TaskCategory {
  id: string;
  name: string;
  color: string;
  description?: string;
  taskCount: number;
}

export interface TaskTag {
  name: string;
  color: string;
  taskCount: number;
}

// WebSocket message types for task history operations
export interface TaskHistoryMessage {
  type: 'taskHistory' | 'taskSearch' | 'taskBatch' | 'taskExport' | 'taskStats';
  action: string;
  data?: any;
}

export interface TaskHistoryResponse {
  type: 'taskHistoryData' | 'taskSearchResult' | 'taskBatchResult' | 'taskExportResult' | 'taskStatsResult';
  success: boolean;
  data?: any;
  error?: string;
}