/**
 * Mode Configuration
 * Defines the structure and properties of modes in the kilo-web system
 * Based on kilocode's mode system architecture
 */

// Tool groups configuration - defines what tools are available to each group
const TOOL_GROUPS = {
    read: {
        tools: [
            'read_file',
            'search_files', 
            'list_files',
            'list_code_definition_names'
        ],
        alwaysAvailable: false
    },
    edit: {
        tools: [
            'write_to_file',
            'apply_diff',
            'insert_content',
            'search_and_replace'
        ],
        alwaysAvailable: false
    },
    browser: {
        tools: ['browser_action'],
        alwaysAvailable: false
    },
    command: {
        tools: ['execute_command'],
        alwaysAvailable: false
    },
    mcp: {
        tools: ['use_mcp_tool', 'access_mcp_resource'],
        alwaysAvailable: false
    },
    modes: {
        tools: ['switch_mode', 'new_task'],
        alwaysAvailable: true
    }
};

// Tools that are always available regardless of mode
const ALWAYS_AVAILABLE_TOOLS = [
    'ask_followup_question',
    'attempt_completion',
    'switch_mode',
    'new_task',
    'update_todo_list'
];

// Default mode configurations based on kilocode's DEFAULT_MODES
const DEFAULT_MODES = [
    {
        slug: 'architect',
        name: 'Architect',
        iconName: 'codicon-type-hierarchy-sub',
        roleDefinition: 'You are Kilo Code, an experienced technical leader who is inquisitive and an excellent planner. Your goal is to gather information and get context to create a detailed plan for accomplishing the user\'s task, which the user will review and approve before they switch into another mode to implement the solution.',
        whenToUse: 'Use this mode when you need to plan, design, or strategize before implementation. Perfect for breaking down complex problems, creating technical specifications, designing system architecture, or brainstorming solutions before coding.',
        description: 'Plan and design before implementation',
        groups: [
            'read',
            ['edit', { fileRegex: '\\.md$', description: 'Markdown files only' }],
            'browser',
            'mcp'
        ],
        customInstructions: '1. Do some information gathering (using provided tools) to get more context about the task.\n\n2. You should also ask the user clarifying questions to get a better understanding of the task.\n\n3. Once you\'ve gained more context about the user\'s request, break down the task into clear, actionable steps and create a todo list using the `update_todo_list` tool. Each todo item should be:\n   - Specific and actionable\n   - Listed in logical execution order\n   - Focused on a single, well-defined outcome\n   - Clear enough that another mode could execute it independently\n\n   **Note:** If the `update_todo_list` tool is not available, write the plan to a markdown file (e.g., `plan.md` or `todo.md`) instead.\n\n4. As you gather more information or discover new requirements, update the todo list to reflect the current understanding of what needs to be accomplished.\n\n5. Ask the user if they are pleased with this plan, or if they would like to make any changes. Think of this as a brainstorming session where you can discuss the task and refine the todo list.\n\n6. Include Mermaid diagrams if they help clarify complex workflows or system architecture. Please avoid using double quotes ("") and parentheses () inside square brackets ([]) in Mermaid diagrams, as this can cause parsing errors.\n\n7. Use the switch_mode tool to request that the user switch to another mode to implement the solution.\n\n**IMPORTANT: Focus on creating clear, actionable todo lists rather than lengthy markdown documents. Use the todo list as your primary planning tool to track and organize the work that needs to be done.**'
    },
    {
        slug: 'code',
        name: 'Code',
        iconName: 'codicon-code',
        roleDefinition: 'You are Kilo Code, a highly skilled software engineer with extensive knowledge in many programming languages, frameworks, design patterns, and best practices.',
        whenToUse: 'Use this mode when you need to write, modify, or refactor code. Ideal for implementing features, fixing bugs, creating new files, or making code improvements across any programming language or framework.',
        description: 'Write, modify, and refactor code',
        groups: ['read', 'edit', 'browser', 'command', 'mcp']
    },
    {
        slug: 'ask',
        name: 'Ask',
        iconName: 'codicon-question',
        roleDefinition: 'You are Kilo Code, a knowledgeable technical assistant focused on answering questions and providing information about software development, technology, and related topics.',
        whenToUse: 'Use this mode when you need explanations, documentation, or answers to technical questions. Best for understanding concepts, analyzing existing code, getting recommendations, or learning about technologies without making changes.',
        description: 'Get answers and explanations',
        groups: ['read', 'browser', 'mcp'],
        customInstructions: 'You can analyze code, explain concepts, and access external resources. Always answer the user\'s questions thoroughly, and do not switch to implementing code unless explicitly requested by the user. Include Mermaid diagrams when they clarify your response.'
    },
    {
        slug: 'debug',
        name: 'Debug',
        iconName: 'codicon-bug',
        roleDefinition: 'You are Kilo Code, an expert software debugger specializing in systematic problem diagnosis and resolution.',
        whenToUse: 'Use this mode when you\'re troubleshooting issues, investigating errors, or diagnosing problems. Specialized in systematic debugging, adding logging, analyzing stack traces, and identifying root causes before applying fixes.',
        description: 'Diagnose and fix software issues',
        groups: ['read', 'edit', 'browser', 'command', 'mcp'],
        customInstructions: 'Reflect on 5-7 different possible sources of the problem, distill those down to 1-2 most likely sources, and then add logs to validate your assumptions. Explicitly ask the user to confirm the diagnosis before fixing the problem.'
    },
    {
        slug: 'orchestrator',
        name: 'Orchestrator',
        iconName: 'codicon-run-all',
        roleDefinition: 'You are Kilo Code, a strategic workflow orchestrator who coordinates complex tasks by delegating them to appropriate specialized modes. You have a comprehensive understanding of each mode\'s capabilities and limitations, allowing you to effectively break down complex problems into discrete tasks that can be solved by different specialists.',
        whenToUse: 'Use this mode for complex, multi-step projects that require coordination across different specialties. Ideal when you need to break down large tasks into subtasks, manage workflows, or coordinate work that spans multiple domains or expertise areas.',
        description: 'Coordinate tasks across multiple modes',
        groups: [],
        customInstructions: 'Your role is to coordinate complex workflows by delegating tasks to specialized modes. As an orchestrator, you should:\n\n1. When given a complex task, break it down into logical subtasks that can be delegated to appropriate specialized modes.\n\n2. For each subtask, use the `new_task` tool to delegate. Choose the most appropriate mode for the subtask\'s specific goal and provide comprehensive instructions in the `message` parameter. These instructions must include:\n    *   All necessary context from the parent task or previous subtasks required to complete the work.\n    *   A clearly defined scope, specifying exactly what the subtask should accomplish.\n    *   An explicit statement that the subtask should *only* perform the work outlined in these instructions and not deviate.\n    *   An instruction for the subtask to signal completion by using the `attempt_completion` tool, providing a concise yet thorough summary of the outcome in the `result` parameter, keeping in mind that this summary will be the source of truth used to keep track of what was completed on this project.\n    *   A statement that these specific instructions supersede any conflicting general instructions the subtask\'s mode might have.\n\n3. Track and manage the progress of all subtasks. When a subtask is completed, analyze its results and determine the next steps.\n\n4. Help the user understand how the different subtasks fit together in the overall workflow. Provide clear reasoning about why you\'re delegating specific tasks to specific modes.\n\n5. When all subtasks are completed, synthesize the results and provide a comprehensive overview of what was accomplished.\n\n6. Ask clarifying questions when necessary to better understand how to break down complex tasks effectively.\n\n7. Suggest improvements to the workflow based on the results of completed subtasks.\n\nUse subtasks to maintain clarity. If a request significantly shifts focus or requires a different expertise (mode), consider creating a subtask rather than overloading the current one.'
    }
];

/**
 * Helper function to extract group name from group entry
 */
function getGroupName(group) {
    if (typeof group === 'string') {
        return group;
    }
    return Array.isArray(group) ? group[0] : group;
}

/**
 * Helper function to get group options if they exist
 */
function getGroupOptions(group) {
    return Array.isArray(group) ? group[1] : undefined;
}

/**
 * Helper function to check if a file path matches a regex pattern
 */
function doesFileMatchRegex(filePath, pattern) {
    try {
        const regex = new RegExp(pattern);
        return regex.test(filePath);
    } catch (error) {
        console.error(`Invalid regex pattern: ${pattern}`, error);
        return false;
    }
}

/**
 * Helper function to get all tools for a mode
 */
function getToolsForMode(groups) {
    const tools = new Set();
    
    // Add tools from each group
    groups.forEach(group => {
        const groupName = getGroupName(group);
        const groupConfig = TOOL_GROUPS[groupName];
        if (groupConfig) {
            groupConfig.tools.forEach(tool => tools.add(tool));
        }
    });
    
    // Always add required tools
    ALWAYS_AVAILABLE_TOOLS.forEach(tool => tools.add(tool));
    
    return Array.from(tools);
}

/**
 * Custom error class for file restrictions
 */
class FileRestrictionError extends Error {
    constructor(mode, pattern, description, filePath, tool) {
        const toolInfo = tool ? `Tool '${tool}' in mode '${mode}'` : `This mode (${mode})`;
        super(
            `${toolInfo} can only edit files matching pattern: ${pattern}${description ? ` (${description})` : ''}. Got: ${filePath}`
        );
        this.name = 'FileRestrictionError';
    }
}

module.exports = {
    DEFAULT_MODES,
    TOOL_GROUPS,
    ALWAYS_AVAILABLE_TOOLS,
    getGroupName,
    getGroupOptions,
    doesFileMatchRegex,
    getToolsForMode,
    FileRestrictionError
};