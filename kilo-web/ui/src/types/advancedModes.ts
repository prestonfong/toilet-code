// Advanced Mode Management Types
// Extends the basic Mode interface to include advanced configuration options

export interface ToolGroup {
  name: string;
  tools: string[];
  alwaysAvailable?: boolean;
}

export interface ToolGroupConfig {
  name: string;
  options?: {
    fileRegex?: string;
    description?: string;
    [key: string]: any;
  };
}

export interface FileRestriction {
  pattern: string;
  description: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface AdvancedMode {
  slug: string;
  name: string;
  description: string;
  roleDefinition: string;
  whenToUse?: string;
  iconName?: string;
  groups?: (string | [string, any])[];
  customInstructions?: string;
  source: 'built-in' | 'custom';
  
  // Advanced configuration
  fileRestrictions?: FileRestriction[];
  toolGroups?: ToolGroupConfig[];
  
  // Metadata
  createdAt?: string;
  modifiedAt?: string;
  version?: number;
  author?: string;
  tags?: string[];
}

export interface ModeStats {
  totalModes: number;
  builtInModes: number;
  customModes: number;
  currentMode: string;
  availableTools: number;
}

export interface ModeExportData {
  currentMode: string;
  customModes: AdvancedMode[];
  timestamp: string;
  version?: string;
}

export interface ModeImportOptions {
  overwriteExisting?: boolean;
  selectiveModes?: string[];
  setAsCurrent?: boolean;
}

// Tool Groups available in the backend
export const AVAILABLE_TOOL_GROUPS: ToolGroup[] = [
  {
    name: 'read',
    tools: ['read_file', 'search_files', 'list_files', 'list_code_definition_names'],
    alwaysAvailable: false
  },
  {
    name: 'edit',
    tools: ['write_to_file', 'apply_diff', 'insert_content', 'search_and_replace'],
    alwaysAvailable: false
  },
  {
    name: 'browser',
    tools: ['browser_action'],
    alwaysAvailable: false
  },
  {
    name: 'command',
    tools: ['execute_command'],
    alwaysAvailable: false
  },
  {
    name: 'mcp',
    tools: ['use_mcp_tool', 'access_mcp_resource'],
    alwaysAvailable: false
  },
  {
    name: 'modes',
    tools: ['switch_mode', 'new_task'],
    alwaysAvailable: true
  }
];

// Always available tools that cannot be restricted
export const ALWAYS_AVAILABLE_TOOLS = [
  'ask_followup_question',
  'attempt_completion',
  'switch_mode',
  'new_task',
  'update_todo_list'
];

// Validation functions
export function validateModeSlug(slug: string): ValidationResult {
  const errors: string[] = [];
  
  if (!slug) {
    errors.push('Mode slug is required');
  } else {
    if (!/^[a-z][a-z0-9-_]*$/.test(slug)) {
      errors.push('Mode slug must start with lowercase letter and contain only lowercase letters, numbers, hyphens, and underscores');
    }
    if (slug.length < 2) {
      errors.push('Mode slug must be at least 2 characters long');
    }
    if (slug.length > 50) {
      errors.push('Mode slug must be 50 characters or less');
    }
  }
  
  return { valid: errors.length === 0, errors };
}

export function validateModeName(name: string): ValidationResult {
  const errors: string[] = [];
  
  if (!name) {
    errors.push('Mode name is required');
  } else {
    if (name.length < 2) {
      errors.push('Mode name must be at least 2 characters long');
    }
    if (name.length > 100) {
      errors.push('Mode name must be 100 characters or less');
    }
  }
  
  return { valid: errors.length === 0, errors };
}

export function validateFileRegex(pattern: string): ValidationResult {
  const errors: string[] = [];
  
  if (!pattern) {
    errors.push('File regex pattern is required');
    return { valid: false, errors };
  }
  
  try {
    new RegExp(pattern);
  } catch (error) {
    errors.push(`Invalid regex pattern: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return { valid: errors.length === 0, errors };
}

export function validateAdvancedMode(mode: Partial<AdvancedMode>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required fields
  const slugValidation = validateModeSlug(mode.slug || '');
  if (!slugValidation.valid) {
    errors.push(...slugValidation.errors);
  }
  
  const nameValidation = validateModeName(mode.name || '');
  if (!nameValidation.valid) {
    errors.push(...nameValidation.errors);
  }
  
  if (!mode.description) {
    errors.push('Mode description is required');
  } else if (mode.description.length > 200) {
    errors.push('Mode description must be 200 characters or less');
  }
  
  if (!mode.roleDefinition) {
    errors.push('Role definition is required');
  } else if (mode.roleDefinition.length < 20) {
    warnings.push('Role definition should be at least 20 characters for clarity');
  }
  
  // Validate tool groups
  if (mode.groups) {
    for (const group of mode.groups) {
      const groupName = typeof group === 'string' ? group : group[0];
      const availableGroup = AVAILABLE_TOOL_GROUPS.find(g => g.name === groupName);
      
      if (!availableGroup) {
        errors.push(`Unknown tool group: ${groupName}`);
        continue;
      }
      
      // If it's an array with options, validate the options
      if (Array.isArray(group) && group[1]) {
        const options = group[1];
        if (groupName === 'edit' && options.fileRegex) {
          const regexValidation = validateFileRegex(options.fileRegex);
          if (!regexValidation.valid) {
            errors.push(`Invalid file regex in edit group: ${regexValidation.errors.join(', ')}`);
          }
        }
      }
    }
  } else {
    warnings.push('No tool groups specified - mode will have limited functionality');
  }
  
  // Validate file restrictions
  if (mode.fileRestrictions) {
    for (const restriction of mode.fileRestrictions) {
      const regexValidation = validateFileRegex(restriction.pattern);
      if (!regexValidation.valid) {
        errors.push(`Invalid file restriction pattern "${restriction.pattern}": ${regexValidation.errors.join(', ')}`);
      }
      
      if (!restriction.description) {
        warnings.push(`File restriction pattern "${restriction.pattern}" should have a description`);
      }
    }
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

// Helper functions for mode management
export function getToolsForGroups(groups: (string | [string, any])[]): string[] {
  const tools = new Set<string>();
  
  // Add always available tools
  ALWAYS_AVAILABLE_TOOLS.forEach(tool => tools.add(tool));
  
  // Add tools from each group
  groups.forEach(group => {
    const groupName = typeof group === 'string' ? group : group[0];
    const toolGroup = AVAILABLE_TOOL_GROUPS.find(g => g.name === groupName);
    
    if (toolGroup) {
      toolGroup.tools.forEach(tool => tools.add(tool));
    }
  });
  
  return Array.from(tools).sort();
}

export function createDefaultMode(): Partial<AdvancedMode> {
  return {
    slug: '',
    name: '',
    description: '',
    roleDefinition: 'You are Kilo Code, an AI assistant specialized in ',
    whenToUse: '',
    iconName: 'codicon-code',
    groups: ['read'],
    customInstructions: '',
    source: 'custom',
    fileRestrictions: [],
    toolGroups: [],
    tags: []
  };
}

// WebSocket message types for advanced mode management
export interface ModeManagementMessage {
  type: 'createMode' | 'updateMode' | 'deleteMode' | 'getModes' | 'exportModes' | 'importModes';
  data?: any;
}

export interface ModeResponse {
  success: boolean;
  data?: any;
  error?: string;
}