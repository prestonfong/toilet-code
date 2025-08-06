export interface Mode {
  slug: string;
  name: string;
  description: string;
  roleDefinition: string;
  whenToUse?: string;
  iconName?: string;
  groups?: (string | [string, any])[];
  customInstructions?: string;
  source?: 'built-in' | 'custom';
}

export interface ModeChangeMessage {
  type: 'switchMode';
  modeSlug: string;
}

export interface ModeStateMessage {
  type: 'modeChanged';
  currentMode: string;
  previousMode?: string;
}

export const DEFAULT_MODES: Mode[] = [
  {
    slug: 'architect',
    name: 'Architect',
    description: 'Plan and design before implementation',
    roleDefinition: 'You are Kilo Code, an experienced technical leader who is inquisitive and an excellent planner.',
    whenToUse: 'Use this mode when you need to plan, design, or strategize before implementation.',
    iconName: 'codicon-type-hierarchy-sub'
  },
  {
    slug: 'code',
    name: 'Code',
    description: 'Write, modify, and refactor code',
    roleDefinition: 'You are Kilo Code, a highly skilled software engineer with extensive knowledge in many programming languages, frameworks, design patterns, and best practices.',
    whenToUse: 'Use this mode when you need to write, modify, or refactor code.',
    iconName: 'codicon-code'
  },
  {
    slug: 'ask',
    name: 'Ask',
    description: 'Get answers and explanations',
    roleDefinition: 'You are Kilo Code, a knowledgeable technical assistant focused on answering questions and providing information.',
    whenToUse: 'Use this mode when you need explanations, documentation, or answers to technical questions.',
    iconName: 'codicon-question'
  },
  {
    slug: 'debug',
    name: 'Debug',
    description: 'Diagnose and fix software issues',
    roleDefinition: 'You are Kilo Code, an expert software debugger specializing in systematic problem diagnosis and resolution.',
    whenToUse: 'Use this mode when you\'re troubleshooting issues, investigating errors, or diagnosing problems.',
    iconName: 'codicon-bug'
  },
  {
    slug: 'orchestrator',
    name: 'Orchestrator',
    description: 'Coordinate tasks across multiple modes',
    roleDefinition: 'You are Kilo Code, a strategic workflow orchestrator who coordinates complex tasks by delegating them to appropriate specialized modes.',
    whenToUse: 'Use this mode for complex, multi-step projects that require coordination across different specialties.',
    iconName: 'codicon-run-all'
  }
];