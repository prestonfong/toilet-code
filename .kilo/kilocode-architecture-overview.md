# Kilo Code Architecture Overview & Development Guide

## Executive Summary

Kilo Code is a sophisticated VS Code AI agent extension built as a production-grade TypeScript monorepo with 2,068 files. It combines features from Roo Code and Cline to create a comprehensive AI-powered development assistant. The architecture demonstrates enterprise-level engineering with sophisticated patterns for state management, performance optimization, and VS Code platform integration.

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Extension Host                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                 Main Extension                              │
│                 src/extension.ts                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│               ClineProvider                                 │
│           (Central Orchestrator)                            │
│          src/core/webview/ClineProvider.ts                  │
└─────┬─────────┬─────────┬─────────┬─────────┬───────────────┘
      │         │         │         │         │
┌─────▼───┐ ┌─▼───┐ ┌────▼────┐ ┌─▼────┐ ┌─▼────────────┐
│  Core   │ │ API │ │Services │ │Integr│ │   Webview    │
│         │ │     │ │         │ │ations│ │     UI       │
│src/core/│ │src/ │ │src/     │ │src/  │ │ webview-ui/  │
│         │ │api/ │ │services/│ │integr│ │              │
└─────────┘ └─────┘ └─────────┘ └──────┘ └──────────────┘
                      │                         │
            ┌─────────▼─────────┐    ┌─────────▼─────────┐
            │     Packages      │    │   React Frontend  │
            │   packages/       │    │  100+ msg types   │
            │ - cloud           │    │  Advanced state   │
            │ - telemetry       │    │  VS Code themes   │
            │ - types           │    │  Tailwind CSS     │
            │ - evals           │    │  Vite build       │
            └───────────────────┘    └───────────────────┘
```

## 📂 Directory Structure & Responsibilities

### **Root Level**
- **`src/`** - Main VS Code extension code
- **`webview-ui/`** - React frontend application
- **`packages/`** - Shared libraries and utilities (7 packages)
- **`apps/`** - Testing, tooling, and web applications (7 apps)
- **`scripts/`** - Build and automation scripts

### **Core Extension (`src/`)**

| Directory | Purpose | Key Files | Use Cases |
|-----------|---------|-----------|-----------|
| **`core/`** | Central business logic & orchestration | `ClineProvider.ts`, `webviewMessageHandler.ts` | AI conversations, tool execution, state management |
| **`services/`** | Specialized reusable services | `McpHub.ts`, `BrowserSession.ts`, `CodeIndex/` | External integrations, background processing |
| **`integrations/`** | VS Code API abstractions | `DiffViewProvider.ts`, `terminal/`, `workspace/` | Editor manipulation, file operations |
| **`api/`** | AI provider integrations | `providers/`, `transform/`, `fetchers/` | Adding new AI models, API management |
| **`shared/`** | Common types & interfaces | `api.ts`, `ExtensionMessage.ts`, `tools.ts` | Type definitions, contracts |
| **`utils/`** | Pure utility functions | `fs.ts`, `git.ts`, `shell.ts`, `tiktoken.ts` | Helper functions, path manipulation |

### **Shared Packages (`packages/`)**

| Package | Purpose | Key Exports |
|---------|---------|-------------|
| **`@roo-code/cloud`** | Cloud services integration | Authentication, settings, telemetry, task sharing |
| **`@roo-code/telemetry`** | Analytics and usage tracking | TelemetryService, PostHog integration |
| **`@roo-code/types`** | Shared type definitions | Cloud types, telemetry events, message interfaces |
| **`@roo-code/ipc`** | Inter-process communication | Remote extension access, evaluation support |
| **`@roo-code/evals`** | Evaluation framework | Performance testing, database integration |
| **`@roo-code/config-eslint`** | Shared linting configuration | Base, React, Next.js configs |
| **`@roo-code/config-typescript`** | Shared TypeScript configuration | Strict typing, ES2022 target |

## 🔧 Feature Development Guide

### **Adding New AI Capabilities**

**Location**: `src/core/` and `src/api/`

1. **New AI Tools**: Add to `src/core/tools/` and update `src/shared/tools.ts`
2. **New AI Providers**: Implement `ApiHandler` interface in `src/api/providers/`
3. **Enhanced Prompts**: Modify `src/core/prompts/` and system prompt generation
4. **New Modes**: Extend mode system in `src/shared/modes.ts`

**Example**:
```typescript
// src/api/providers/my-new-provider.ts
export class MyNewProviderHandler implements ApiHandler {
  // Implement interface methods
}

// src/shared/api.ts - Add to ModelInfo
"my-new-model": { maxTokens: 8192, contextWindow: 32768 }
```

### **Adding VS Code Integrations**

**Location**: `src/activate/` and `src/integrations/`

1. **New Commands**: 
   - Add to `src/package.json` `contributes.commands`
   - Implement handler in `src/activate/registerCommands.ts`
2. **Code Actions**: Extend `src/activate/CodeActionProvider.ts`
3. **Editor Features**: Add to `src/integrations/editor/`
4. **Workspace Operations**: Extend `src/integrations/workspace/`

**Example**:
```typescript
// src/activate/registerCommands.ts
vscode.commands.registerCommand('kilo-code.myNewCommand', async () => {
  // Implementation
});
```

### **Extending the UI/Frontend**

**Location**: `webview-ui/`

1. **New Components**: Add to `webview-ui/src/components/`
2. **State Management**: Extend `ExtensionStateContext` with new setters
3. **Message Types**: Add to `src/shared/WebviewMessage.ts` and `ExtensionMessage.ts`
4. **Styling**: Use Tailwind classes with VS Code theme integration

**Example**:
```typescript
// Add new message type
export interface MyNewMessage {
  type: "myNewAction"
  data: MyNewData
}

// Handle in ClineProvider
case "myNewAction":
  // Backend handling
```

### **Adding New Services**

**Location**: `src/services/`

1. Create service class following existing patterns
2. Initialize in `src/extension.ts` activation
3. Register with `ClineProvider` constructor
4. Add types to `@roo-code/types` if shared

**Example**:
```typescript
// src/services/my-service/MyService.ts
export class MyService {
  constructor(private context: vscode.ExtensionContext) {}
  
  async initialize() {
    // Service initialization
  }
}
```

## 🚀 Development Workflows

### **Getting Started**
1. **Prerequisites**: Node.js 20.19.2, pnpm 10.8.1, VS Code
2. **Clone & Install**: 
   ```bash
   git clone https://github.com/Kilo-Org/kilocode.git
   cd kilocode
   pnpm install  # Runs bootstrap automatically
   ```
3. **Development**: Press F5 in VS Code for debug mode
4. **Building**: `pnpm build` creates production `.vsix` file

### **Common Development Tasks**

| Task | Location | Command |
|------|----------|---------|
| Add new command | `src/package.json` + `src/activate/registerCommands.ts` | Register in both files |
| Add AI provider | `src/api/providers/` | Implement `ApiHandler` interface |
| Add UI component | `webview-ui/src/components/` | Create React component |
| Add shared type | `packages/types/src/` | Export from package |
| Add test | `__tests__/` or `apps/` | Follow existing patterns |
| Add service | `src/services/` | Initialize in extension.ts |

### **Testing Strategy**

| Test Type | Location | Framework | Purpose |
|-----------|----------|-----------|---------|
| **Unit Tests** | `src/__tests__/` | Jest/Vitest | Core logic testing |
| **Component Tests** | `apps/storybook/` | Storybook | UI component isolation |
| **E2E Tests** | `apps/playwright-e2e/` | Playwright | Browser automation |
| **Extension Tests** | `apps/vscode-e2e/` | VS Code Test Runner | Extension integration |
| **Visual Tests** | Chromatic integration | Visual regression | UI consistency |

### **Build & Deployment**

1. **Development**: `pnpm dev` - Hot reloading enabled
2. **Testing**: `pnpm test` - Run all test suites
3. **Linting**: `pnpm lint` - Code quality checks
4. **Type Checking**: `pnpm check-types` - TypeScript validation
5. **Production Build**: `pnpm build` - Creates distributable VSIX
6. **Nightly Builds**: Automated via `apps/vscode-nightly/`

## 🔌 Extension Points & Patterns

### **Provider Pattern**
Used for AI models, authentication, and external services:
```typescript
interface ApiHandler {
  createMessage(systemPrompt: string, messages: any[]): Promise<any>
}
```

### **Service Composition**
Services are injected and orchestrated through `ClineProvider`:
```typescript
constructor(
  private cloudService: CloudService,
  private telemetryService: TelemetryService,
  // ... other services
) {}
```

### **Event-Driven Architecture**
Comprehensive event system for loose coupling:
```typescript
// Emit events
this.context.postMessage({ type: "eventName", data })

// Handle events
case "eventName": // Handle in webviewMessageHandler
```

### **Message Passing**
100+ typed message types for frontend-backend communication:
```typescript
// Frontend to Backend
vscode.postMessage({ type: "actionType", data })

// Backend to Frontend  
this.webview.postMessage({ type: "responseType", data })
```

## 🎯 Quick Reference

### **Where to Look for Common Changes**

| Change Type | Primary Location | Secondary Location |
|-------------|------------------|-------------------|
| **New AI Model** | `src/api/providers/` | `src/shared/api.ts` |
| **New Command** | `src/activate/registerCommands.ts` | `src/package.json` |
| **New Tool** | `src/core/tools/` | `src/shared/tools.ts` |
| **UI Changes** | `webview-ui/src/components/` | `src/shared/WebviewMessage.ts` |
| **Backend Logic** | `src/core/` | `src/services/` |
| **VS Code Integration** | `src/integrations/` | `src/activate/` |
| **Shared Types** | `packages/types/src/` | Import in relevant files |
| **Configuration** | `src/package.json` | `packages/config-*/` |

### **Key Entry Points**

- **Extension Activation**: `src/extension.ts:activate()`
- **Central Orchestrator**: `src/core/webview/ClineProvider.ts`
- **Message Handling**: `src/core/webview/webviewMessageHandler.ts`
- **UI Root**: `webview-ui/src/App.tsx`
- **Commands**: `src/activate/registerCommands.ts`

This architecture enables Kilo Code to be a robust, extensible AI agent platform that can evolve with new AI providers, tools, and VS Code capabilities while maintaining stability and performance.