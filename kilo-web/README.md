# Kilo Web

A web version of Kilo Code that runs on Node.js/Express, hosting a React UI for demonstration purposes.

## Features

### Core Infrastructure
- 🚀 Express.js web server on port 5000
- ⚛️ React UI with modern styling and interactivity
- 🔌 WebSocket real-time communication
- 🛠️ RESTful API endpoints
- 📊 Health monitoring and status display

### Advanced AI Mode Management
- 🎯 **Custom AI Modes** - Create specialized AI modes with custom tool groups and file restrictions
- 🔧 **Mode Configuration** - Visual mode editor with role definitions and validation
- 📝 **Mode Templates** - Built-in templates for common development tasks
- 🔄 **Mode Switching** - Seamless switching between different AI capabilities
- 📤 **Import/Export** - Share and backup custom mode configurations

### Enhanced Settings Management
- 👤 **Provider Profiles** - Multiple AI provider configurations (Anthropic, OpenAI, etc.)
- 🏢 **Workspace Overrides** - Project-specific settings and configurations
- 🔐 **Secure Configuration** - Safe storage and management of API keys
- 📋 **Settings Import/Export** - Backup and share complete configurations
- ⚙️ **Advanced Options** - Fine-grained control over AI behavior and permissions

### Workflow Automation System
- 🤖 **Automated Workflows** - Template-based workflow execution
- 📊 **Real-time Monitoring** - Live progress tracking and status updates
- 🎨 **Visual Builder** - Create complex workflows with drag-and-drop interface
- 🔄 **Workflow Templates** - Pre-built workflows for common development tasks
- 📈 **Analytics** - Execution metrics and performance insights

### Task History Management
- 🔍 **Advanced Search** - Find conversations by content, mode, date, and metadata
- 📊 **Analytics Dashboard** - Usage statistics and productivity insights
- 🗂️ **Smart Filtering** - Filter by mode, status, duration, and file activity
- 💾 **Export Options** - Export task history in multiple formats
- 🔄 **Batch Operations** - Manage multiple tasks simultaneously

### MCP Server Management
- 🖥️ **Visual Server Management** - Add, configure, and monitor MCP servers
- 📡 **Real-time Status** - Connection monitoring and health checks
- 🛠️ **Tool Discovery** - Automatic discovery of available tools and resources
- ⚡ **Performance Metrics** - Response times and usage statistics
- 🔧 **Advanced Configuration** - Environment variables and connection settings

## Quick Start

### 1. Install Dependencies

```bash
# Install server dependencies
npm install

# Install UI dependencies (runs automatically via postinstall)
# Or manually: cd ui && npm install
```

### 2. Build the UI

```bash
npm run build
```

### 3. Start the Server

```bash
npm start
```

The server will start on `http://localhost:5000`

## Development

### Start in Development Mode

```bash
# Start server with nodemon (auto-restart on changes)
npm run dev

# In another terminal, start UI development server
cd ui
npm run dev
```

The UI development server runs on `http://localhost:3000` and proxies API requests to the main server.

### Project Structure

```
kilo-web/
├── server.js              # Main Express server
├── src/
│   └── routes/
│       └── api.js         # API routes
├── ui/                    # React application
│   ├── src/
│   │   ├── App.tsx       # Main React component
│   │   └── utils/
│   │       └── webClient.ts  # Web client (replaces VS Code API)
│   └── dist/             # Built UI files (served by Express)
└── package.json
```

## API Endpoints

### Core Endpoints
- `GET /api/health` - Server health check with feature availability
- `GET /api/files` - List files with metadata and filtering
- `POST /api/files` - Create files with validation
- `PUT /api/files/:filename` - Update files with diff support
- `DELETE /api/files/:filename` - Delete files with confirmation
- `POST /api/execute` - Execute commands with output streaming

### Advanced Mode Management
- `GET /api/modes` - List all available AI modes
- `POST /api/modes` - Create custom AI modes
- `PUT /api/modes/:slug` - Update mode configurations
- `DELETE /api/modes/:slug` - Delete custom modes
- `POST /api/modes/import` - Import mode configurations
- `GET /api/modes/export` - Export mode configurations

### Settings Management
- `GET /api/settings` - Get current settings
- `PUT /api/settings` - Update settings
- `GET /api/settings/profiles` - List provider profiles
- `POST /api/settings/profiles` - Create provider profile
- `DELETE /api/settings/profiles/:name` - Delete provider profile
- `POST /api/settings/import` - Import settings configuration
- `GET /api/settings/export` - Export settings configuration

### Workflow Management
- `GET /api/workflows` - List workflow templates
- `POST /api/workflows/execute` - Execute workflow
- `GET /api/workflows/executions` - List workflow executions
- `DELETE /api/workflows/executions/:id` - Cancel workflow execution

### Task History
- `GET /api/tasks` - Get task history with filtering
- `GET /api/tasks/search` - Search tasks by content and metadata
- `GET /api/tasks/:id` - Get detailed task information
- `POST /api/tasks/export` - Export task history
- `DELETE /api/tasks/batch` - Batch delete tasks

### MCP Server Management
- `GET /api/mcp/servers` - List MCP servers
- `POST /api/mcp/servers` - Add MCP server
- `PUT /api/mcp/servers/:id` - Update MCP server
- `DELETE /api/mcp/servers/:id` - Remove MCP server
- `GET /api/mcp/tools` - List available MCP tools
- `GET /api/mcp/resources` - List available MCP resources

## WebSocket Communication

The server provides comprehensive WebSocket communication for real-time features:

### Core Messaging
- Request/response messaging with correlation IDs
- Broadcast messages for real-time updates
- Automatic reconnection with message queuing
- Error handling and status notifications

### Advanced Features
- **Mode Management** - Real-time mode switching and updates
- **Workflow Execution** - Live progress updates and status changes
- **Task History** - Real-time task creation and updates
- **Settings Sync** - Instant settings synchronization
- **MCP Integration** - Server status monitoring and tool discovery

## UI Features

The React UI provides a comprehensive web-based development environment:

### Core Interface
- **Modern Design** - Clean, responsive interface with dark/light theme support
- **Real-time Status** - Live connection monitoring and server health display
- **Chat Interface** - Intuitive conversation UI with syntax highlighting
- **File Operations** - Visual file management with diff views
- **Command Execution** - Integrated terminal with output streaming

### Advanced Mode Management
- **Mode Selector** - Quick switching between AI modes via dropdown
- **Mode Creator** - Visual editor for creating custom AI modes
- **Mode Manager** - Comprehensive mode management interface
- **Validation System** - Real-time validation of mode configurations

### Enhanced Settings Panel
- **Provider Profiles** - Manage multiple AI provider configurations
- **Workspace Settings** - Project-specific setting overrides
- **Import/Export Tools** - Backup and restore configurations
- **Security Options** - Fine-grained permission controls

### Workflow Management
- **Workflow Builder** - Visual workflow creation and editing
- **Execution Monitor** - Real-time workflow progress tracking
- **Template Library** - Browse and use pre-built workflow templates
- **Analytics Dashboard** - Workflow performance and usage metrics

### Task History Interface
- **Advanced Search** - Powerful search with multiple filter options
- **Task Details** - Comprehensive view of conversation history
- **Analytics Views** - Usage statistics and productivity insights
- **Export Options** - Multiple export formats (JSON, CSV, Markdown)

### MCP Server Management
- **Server Dashboard** - Visual MCP server management interface
- **Connection Testing** - One-click connection verification
- **Tool Explorer** - Browse available MCP tools and resources
- **Performance Monitoring** - Real-time server metrics and health status

## Documentation

Comprehensive documentation is available in the `.kilo` directory:

- **[Feature Documentation](.kilo/FEATURE_DOCUMENTATION.md)** - Complete technical guide to all new features
- **[User Guide](.kilo/USER_GUIDE.md)** - Step-by-step instructions for using the web interface
- **[Developer Guide](.kilo/DEVELOPER_GUIDE.md)** - Technical implementation details for developers
- **[API Reference](.kilo/API_REFERENCE.md)** - Complete WebSocket and REST API documentation
- **[Migration Guide](.kilo/MIGRATION_GUIDE.md)** - Guide for migrating from kilocode CLI to kilo-web

## Feature Parity with Kilocode CLI

Kilo-web achieves complete feature parity with the original kilocode CLI while adding significant enhancements:

### ✅ Implemented Features
- **All Core AI Functionality** - Same powerful AI capabilities as CLI
- **Complete Tool Ecosystem** - All existing tools work identically
- **File Operations** - Full file reading, writing, and manipulation
- **API Provider Support** - Anthropic, OpenAI, and other providers
- **Mode System** - Enhanced version of CLI mode switching
- **Configuration Management** - Advanced settings with visual interface
- **MCP Integration** - Full Model Context Protocol support
- **Task History** - Enhanced version of CLI history tracking

### 🚀 New Enhancements
- **Visual Interface** - Modern web UI with real-time feedback
- **Advanced Mode Management** - Custom modes with visual editor
- **Provider Profiles** - Multiple AI provider configurations
- **Workflow Automation** - Template-based workflow execution
- **Enhanced Task History** - Advanced search and analytics
- **Workspace Overrides** - Project-specific configurations
- **Real-time Monitoring** - Live status updates and progress tracking
- **Import/Export Tools** - Configuration backup and sharing

## Architecture

### Technology Stack
- **Backend**: Node.js, Express.js, WebSocket
- **Frontend**: React, TypeScript, Modern CSS
- **Communication**: WebSocket for real-time, REST for operations
- **Storage**: JSON file-based configuration and history
- **AI Integration**: Multi-provider support (Anthropic, OpenAI, etc.)

### Key Components
- **Server Layer** - Express server with WebSocket support
- **API Layer** - RESTful endpoints and WebSocket handlers
- **UI Layer** - React components with TypeScript
- **State Management** - React hooks and context
- **Configuration System** - JSON-based settings and profiles
- **Workflow Engine** - Template-based automation system

## Contributing

### Development Setup
1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd kilo-web
   npm install
   ```

2. **Development Mode**
   ```bash
   # Terminal 1: Start server with hot reload
   npm run dev
   
   # Terminal 2: Start UI development server
   cd ui && npm run dev
   ```

3. **Making Changes**
   - **Server code**: Edit `server.js` or files in `src/`
   - **UI code**: Edit files in `ui/src/`
   - **Documentation**: Update files in `.kilo/`

4. **Testing**
   ```bash
   # Build UI
   npm run build
   
   # Test production build
   npm start
   ```

### Project Structure
```
kilo-web/
├── server.js                          # Express server with WebSocket
├── src/                               # Server-side code
│   ├── routes/                        # API route handlers
│   ├── websocket/                     # WebSocket message handlers
│   └── config/                        # Configuration management
├── ui/                                # React frontend application
│   ├── src/
│   │   ├── components/                # React components
│   │   │   ├── AdvancedModeManager.tsx
│   │   │   ├── WorkflowManager.tsx
│   │   │   ├── TaskHistoryManager.tsx
│   │   │   ├── MCPServerManager.tsx
│   │   │   └── ProviderProfileManager.tsx
│   │   ├── types/                     # TypeScript type definitions
│   │   ├── utils/                     # Utility functions
│   │   └── App.tsx                    # Main application component
│   └── dist/                          # Built UI files
├── .kilo/                             # Documentation directory
│   ├── FEATURE_DOCUMENTATION.md
│   ├── USER_GUIDE.md
│   ├── DEVELOPER_GUIDE.md
│   ├── API_REFERENCE.md
│   └── MIGRATION_GUIDE.md
└── package.json
```

### Code Style
- **TypeScript** for type safety
- **Modern React** with hooks and functional components
- **CSS Modules** for component styling
- **ESLint/Prettier** for code formatting
- **Comprehensive documentation** for all features

## License

MIT