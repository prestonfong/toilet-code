const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

// Load environment variables
require('dotenv').config();

// Import our compiled TypeScript services
const { ClineService } = require('./dist/services/ClineService');

// Import our tool system and mode system
const ModeAwareToolRegistry = require('./src/tools/ModeAwareToolRegistry');
const ModeManager = require('./src/modes/ModeManager');
const SwitchModeTool = require('./src/tools/switchMode');
const NewTaskTool = require('./src/tools/newTask');

// Import our enhanced chat management system
const ChatManager = require('./src/core/ChatManager');

// Import settings system
const SettingsService = require('./src/services/SettingsService');

// Import workflow automation system
const WorkflowManager = require('./src/automation/WorkflowManager');
const WorkflowEngine = require('./src/automation/WorkflowEngine');
const WorkflowTemplates = require('./src/automation/WorkflowTemplates');

// Configuration with environment variable support
const config = {
  port: process.env.PORT || 5000,
  host: process.env.HOST || 'localhost',
  nodeEnv: process.env.NODE_ENV || 'production',
  appName: process.env.APP_NAME || 'Kilo Code Web',
  appVersion: process.env.APP_VERSION || '1.0.0',
  maxUploadSize: parseInt(process.env.MAX_UPLOAD_SIZE) || 10,
  sessionSecret: process.env.SESSION_SECRET || 'default-secret-change-this',
  workspaceDir: process.env.WORKSPACE_DIR || './workspace',
  logLevel: process.env.LOG_LEVEL || 'info',
  enableCors: process.env.ENABLE_CORS === 'true',
  corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:5000'],
  developmentMode: process.env.DEVELOPMENT_MODE === 'true',
  debugMode: process.env.DEBUG_MODE === 'true'
};

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Initialize ClineService, ToolRegistry, ModeManager, ChatManager, SettingsService, and WorkflowSystem
let clineService;
let toolRegistry;
let modeManager;
let chatManager;
let settingsService;
let workflowManager;
let workflowEngine;
let workflowTemplates;

// Middleware
const corsOptions = config.enableCors ? {
  origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
  credentials: true
} : false;

if (corsOptions) {
  app.use(cors(corsOptions));
}

app.use(express.json({ limit: `${config.maxUploadSize}mb` }));
app.use(express.urlencoded({ extended: true, limit: `${config.maxUploadSize}mb` }));

// Request logging middleware
app.use((req, res, next) => {
  if (config.debugMode) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// Serve static files from the React app with better cache control
app.use(express.static(path.join(__dirname, 'ui/dist'), {
  setHeaders: (res, path, stat) => {
    // For development, ensure no caching of JS/CSS files
    if (path.endsWith('.js') || path.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// API Routes
app.use('/api', require('./src/routes/api'));

// Enhanced health monitoring endpoint
app.get('/api/health', (req, res) => {
  const startTime = process.hrtime();
  
  // System information
  const systemInfo = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: config.nodeEnv,
    version: config.appVersion,
    node_version: process.version,
    platform: process.platform,
    architecture: process.arch,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
    },
    cpu_usage: process.cpuUsage(),
    pid: process.pid
  };

  // Service status
  const serviceStatus = {
    cline_service: {
      initialized: clineService ? clineService.isReady() : false,
      status: clineService ? 'running' : 'not_initialized'
    },
    websocket: {
      connections: wss.clients.size,
      status: 'running'
    },
    workspace: {
      directory: config.workspaceDir,
      exists: fs.existsSync(config.workspaceDir)
    }
  };

  // Calculate response time
  const [seconds, nanoseconds] = process.hrtime(startTime);
  const responseTime = Math.round((seconds * 1000) + (nanoseconds / 1000000));

  res.json({
    ...systemInfo,
    services: serviceStatus,
    response_time_ms: responseTime,
    config: {
      port: config.port,
      host: config.host,
      cors_enabled: config.enableCors,
      development_mode: config.developmentMode
    }
  });
});

// Legacy Kilo Code status endpoint for backward compatibility
app.get('/api/kilo/status', (req, res) => {
  res.json({
    status: 'ok',
    initialized: clineService ? clineService.isReady() : false,
    timestamp: new Date().toISOString(),
    version: config.appVersion,
    uptime: Math.floor(process.uptime())
  });
});

app.get('/api/kilo/state', async (req, res) => {
  try {
    if (!clineService) {
      return res.status(503).json({ success: false, error: 'Service not initialized' });
    }
    const state = await clineService.getCurrentState();
    res.json({ success: true, state });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/kilo/config', async (req, res) => {
  try {
    if (!clineService) {
      return res.status(503).json({ success: false, error: 'Service not initialized' });
    }
    await clineService.updateApiConfiguration(req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/kilo/config', (req, res) => {
  try {
    if (!clineService) {
      return res.status(503).json({ success: false, error: 'Service not initialized' });
    }
    const config = clineService.getApiConfiguration();
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// AI Provider configuration endpoints
app.get('/api/ai/config', (req, res) => {
  try {
    if (!clineService) {
      return res.status(503).json({ success: false, error: 'Service not initialized' });
    }
    const config = clineService.getProviderConfig();
    if (config) {
      // Don't send API key to client for security
      const safeConfig = {
        provider: config.provider,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens
      };
      res.json(safeConfig);
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error('Error getting AI config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/ai/config', async (req, res) => {
  try {
    if (!clineService) {
      return res.status(503).json({ success: false, error: 'Service not initialized' });
    }
    const { provider, apiKey, model, temperature, maxTokens } = req.body;
    
    if (!provider || !apiKey) {
      return res.status(400).json({ success: false, error: 'Provider and API key are required' });
    }

    const config = {
      provider,
      apiKey,
      model,
      temperature,
      maxTokens
    };

    await clineService.setProviderConfig(config);
    res.json({ success: true });
  } catch (error) {
    console.error('Error setting AI config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/ai/providers', (req, res) => {
  try {
    if (!clineService) {
      return res.status(503).json({ success: false, error: 'Service not initialized' });
    }
    const providers = clineService.getAvailableProviders();
    res.json(providers);
  } catch (error) {
    console.error('Error getting providers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/ai/models/:provider', (req, res) => {
  try {
    if (!clineService) {
      return res.status(503).json({ success: false, error: 'Service not initialized' });
    }
    const { provider } = req.params;
    const models = clineService.getAvailableModels(provider);
    res.json(models);
  } catch (error) {
    console.error('Error getting models:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Settings API endpoints
app.get('/api/settings', async (req, res) => {
  try {
    if (!settingsService) {
      return res.status(503).json({ success: false, error: 'Settings service not initialized' });
    }
    const settings = await settingsService.getAllSettings();
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error getting settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    if (!settingsService) {
      return res.status(503).json({ success: false, error: 'Settings service not initialized' });
    }
    await settingsService.updateSettings(req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/settings/providers', async (req, res) => {
  try {
    if (!settingsService) {
      return res.status(503).json({ success: false, error: 'Settings service not initialized' });
    }
    const profiles = await settingsService.getProviderProfiles();
    res.json({ success: true, profiles });
  } catch (error) {
    console.error('Error getting provider profiles:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/settings/providers', async (req, res) => {
  try {
    if (!settingsService) {
      return res.status(503).json({ success: false, error: 'Settings service not initialized' });
    }
    const { name, config } = req.body;
    if (!name || !config) {
      return res.status(400).json({ success: false, error: 'Name and config are required' });
    }
    const id = await settingsService.saveProviderProfile(name, config);
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error saving provider profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/settings/providers/:name', async (req, res) => {
  try {
    if (!settingsService) {
      return res.status(503).json({ success: false, error: 'Settings service not initialized' });
    }
    await settingsService.deleteProviderProfile(req.params.name);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting provider profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/settings/providers/current', async (req, res) => {
  try {
    if (!settingsService) {
      return res.status(503).json({ success: false, error: 'Settings service not initialized' });
    }
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Provider name is required' });
    }
    const profile = await settingsService.setCurrentProvider(name);
    res.json({ success: true, profile });
  } catch (error) {
    console.error('Error setting current provider:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/settings/providers/current', async (req, res) => {
  try {
    if (!settingsService) {
      return res.status(503).json({ success: false, error: 'Settings service not initialized' });
    }
    const provider = await settingsService.getCurrentProvider();
    res.json({ success: true, provider });
  } catch (error) {
    console.error('Error getting current provider:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/settings/providers/available', (req, res) => {
  try {
    if (!settingsService) {
      return res.status(503).json({ success: false, error: 'Settings service not initialized' });
    }
    const providers = settingsService.getAvailableProviders();
    res.json({ success: true, providers });
  } catch (error) {
    console.error('Error getting available providers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/settings/providers/:provider/models', (req, res) => {
  try {
    if (!settingsService) {
      return res.status(503).json({ success: false, error: 'Settings service not initialized' });
    }
    const models = settingsService.getAvailableModels(req.params.provider);
    res.json({ success: true, models });
  } catch (error) {
    console.error('Error getting available models:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/settings/global', async (req, res) => {
  try {
    if (!settingsService) {
      return res.status(503).json({ success: false, error: 'Settings service not initialized' });
    }
    const settings = await settingsService.getGlobalSettings();
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error getting global settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/settings/global', async (req, res) => {
  try {
    if (!settingsService) {
      return res.status(503).json({ success: false, error: 'Settings service not initialized' });
    }
    await settingsService.setGlobalSettings(req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('Error setting global settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/settings/global/:key', async (req, res) => {
  try {
    if (!settingsService) {
      return res.status(503).json({ success: false, error: 'Settings service not initialized' });
    }
    const { value } = req.body;
    await settingsService.updateGlobalSetting(req.params.key, value);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating global setting:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/settings/modes', async (req, res) => {
  try {
    if (!settingsService) {
      return res.status(503).json({ success: false, error: 'Settings service not initialized' });
    }
    const configs = await settingsService.getModeConfigs();
    res.json({ success: true, configs });
  } catch (error) {
    console.error('Error getting mode configs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/settings/modes', async (req, res) => {
  try {
    if (!settingsService) {
      return res.status(503).json({ success: false, error: 'Settings service not initialized' });
    }
    await settingsService.saveModeConfig(req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving mode config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/settings/modes/:slug', async (req, res) => {
  try {
    if (!settingsService) {
      return res.status(503).json({ success: false, error: 'Settings service not initialized' });
    }
    await settingsService.deleteModeConfig(req.params.slug);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting mode config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/settings/export', async (req, res) => {
  try {
    if (!settingsService) {
      return res.status(503).json({ success: false, error: 'Settings service not initialized' });
    }
    const exportData = await settingsService.exportSettings();
    res.json({ success: true, data: exportData });
  } catch (error) {
    console.error('Error exporting settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/settings/import', async (req, res) => {
  try {
    if (!settingsService) {
      return res.status(503).json({ success: false, error: 'Settings service not initialized' });
    }
    const { data, options = {} } = req.body;
    await settingsService.importSettings(data, options);
    res.json({ success: true });
  } catch (error) {
    console.error('Error importing settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/settings/reset', async (req, res) => {
  try {
    if (!settingsService) {
      return res.status(503).json({ success: false, error: 'Settings service not initialized' });
    }
    await settingsService.resetAllSettings();
    res.json({ success: true });
  } catch (error) {
    console.error('Error resetting settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/settings/health', async (req, res) => {
  try {
    if (!settingsService) {
      return res.status(503).json({ success: false, error: 'Settings service not initialized' });
    }
    const health = await settingsService.healthCheck();
    res.json({ success: true, health });
  } catch (error) {
    console.error('Error checking settings health:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/settings/info', (req, res) => {
  try {
    if (!settingsService) {
      return res.status(503).json({ success: false, error: 'Settings service not initialized' });
    }
    const info = settingsService.getSettingsInfo();
    res.json({ success: true, info });
  } catch (error) {
    console.error('Error getting settings info:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Workflow API endpoints
app.get('/api/workflows', async (req, res) => {
  try {
    if (!workflowManager) {
      return res.status(503).json({ success: false, error: 'Workflow manager not initialized' });
    }
    const workflows = await workflowManager.getEnabledWorkflows();
    res.json({ success: true, workflows });
  } catch (error) {
    console.error('Error getting workflows:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/workflows', async (req, res) => {
  try {
    if (!workflowManager) {
      return res.status(503).json({ success: false, error: 'Workflow manager not initialized' });
    }
    const workflow = await workflowManager.createWorkflow(req.body);
    res.json({ success: true, workflow });
  } catch (error) {
    console.error('Error creating workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/workflows/:id/execute', async (req, res) => {
  try {
    if (!workflowEngine || !workflowManager) {
      return res.status(503).json({ success: false, error: 'Workflow system not initialized' });
    }
    
    const workflowId = req.params.id;
    const options = req.body || {};
    
    // Find workflow by ID (simplified - in practice you'd load from file)
    const workflows = await workflowManager.getEnabledWorkflows();
    const workflow = workflows.find(w => w.id === workflowId);
    
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    
    const execution = await workflowEngine.executeWorkflow(workflow, options);
    res.json({ success: true, execution });
  } catch (error) {
    console.error('Error executing workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/workflows/templates', (req, res) => {
  try {
    if (!workflowTemplates) {
      return res.status(503).json({ success: false, error: 'Workflow templates not initialized' });
    }
    const templates = workflowTemplates.getAllTemplates();
    res.json({ success: true, templates });
  } catch (error) {
    console.error('Error getting workflow templates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/workflows/from-template', async (req, res) => {
  try {
    if (!workflowTemplates || !workflowManager) {
      return res.status(503).json({ success: false, error: 'Workflow system not initialized' });
    }
    
    const { templateName, variables, ...workflowConfig } = req.body;
    const workflowDef = workflowTemplates.createWorkflowFromTemplate(templateName, variables);
    const workflow = await workflowManager.createWorkflow({ ...workflowDef, ...workflowConfig });
    
    res.json({ success: true, workflow });
  } catch (error) {
    console.error('Error creating workflow from template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/workflows/executions', (req, res) => {
  try {
    if (!workflowEngine) {
      return res.status(503).json({ success: false, error: 'Workflow engine not initialized' });
    }
    const limit = parseInt(req.query.limit) || 50;
    const history = workflowEngine.getExecutionHistory(limit);
    const active = Array.from(workflowEngine.activeExecutions.values());
    
    res.json({
      success: true,
      executions: {
        active,
        history,
        stats: workflowEngine.getStats()
      }
    });
  } catch (error) {
    console.error('Error getting workflow executions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/workflows/executions/:id/cancel', async (req, res) => {
  try {
    if (!workflowEngine) {
      return res.status(503).json({ success: false, error: 'Workflow engine not initialized' });
    }
    const cancelled = await workflowEngine.cancelExecution(req.params.id);
    res.json({ success: cancelled });
  } catch (error) {
    console.error('Error cancelling workflow execution:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/workflows/:id/toggle', async (req, res) => {
  try {
    if (!workflowManager) {
      return res.status(503).json({ success: false, error: 'Workflow manager not initialized' });
    }
    
    const { enabled, isGlobal } = req.body;
    const filePath = req.params.id; // Simplified - normally you'd resolve ID to path
    
    await workflowManager.toggleWorkflow(filePath, enabled, isGlobal);
    res.json({ success: true });
  } catch (error) {
    console.error('Error toggling workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/workflows/:id', async (req, res) => {
  try {
    if (!workflowManager) {
      return res.status(503).json({ success: false, error: 'Workflow manager not initialized' });
    }
    
    const workflowId = req.params.id;
    const filePath = req.query.path; // Path should be provided in query
    
    if (!filePath) {
      return res.status(400).json({ success: false, error: 'File path required' });
    }
    
    const deleted = await workflowManager.deleteWorkflow(workflowId, filePath);
    res.json({ success: deleted });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/workflows/stats', (req, res) => {
  try {
    if (!workflowManager || !workflowEngine || !workflowTemplates) {
      return res.status(503).json({ success: false, error: 'Workflow system not initialized' });
    }
    
    const stats = {
      manager: workflowManager.getStats(),
      engine: workflowEngine.getStats(),
      templates: workflowTemplates.getStats()
    };
    
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error getting workflow stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/kilo/history', (req, res) => {
  try {
    if (!clineService) {
      return res.status(503).json({ success: false, error: 'Service not initialized' });
    }
    const history = clineService.getTaskHistory();
    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/kilo/task/new', async (req, res) => {
  try {
    if (!clineService) {
      return res.status(503).json({ success: false, error: 'Service not initialized' });
    }
    const { text, images } = req.body;
    await clineService.createNewTask(text, images);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/kilo/task/clear', async (req, res) => {
  try {
    if (!clineService) {
      return res.status(503).json({ success: false, error: 'Service not initialized' });
    }
    await clineService.clearCurrentTask();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/kilo/task/load/:taskId', async (req, res) => {
  try {
    if (!clineService) {
      return res.status(503).json({ success: false, error: 'Service not initialized' });
    }
    await clineService.loadTask(req.params.taskId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/kilo/task/:taskId', async (req, res) => {
  try {
    if (!clineService) {
      return res.status(503).json({ success: false, error: 'Service not initialized' });
    }
    await clineService.deleteTask(req.params.taskId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mode management endpoints
app.get('/api/modes', (req, res) => {
  try {
    if (!modeManager) {
      return res.status(503).json({ success: false, error: 'Mode manager not initialized' });
    }
    
    const modes = modeManager.getAllModes();
    const currentMode = modeManager.getCurrentModeSlug();
    const stats = modeManager.getStats();
    
    res.json({
      success: true,
      modes: modes,
      current_mode: currentMode,
      stats: stats
    });
  } catch (error) {
    console.error('Error getting modes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/modes/switch', async (req, res) => {
  try {
    if (!modeManager) {
      return res.status(503).json({ success: false, error: 'Mode manager not initialized' });
    }
    
    const { mode_slug, reason } = req.body;
    if (!mode_slug) {
      return res.status(400).json({ success: false, error: 'mode_slug is required' });
    }
    
    const result = await modeManager.switchMode(mode_slug, { reason });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error switching mode:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/modes/current', (req, res) => {
  try {
    if (!modeManager) {
      return res.status(503).json({ success: false, error: 'Mode manager not initialized' });
    }
    
    const currentMode = modeManager.getCurrentMode();
    const currentModeSlug = modeManager.getCurrentModeSlug();
    const availableTools = modeManager.getCurrentModeTools();
    
    res.json({
      success: true,
      mode: currentMode,
      mode_slug: currentModeSlug,
      available_tools: availableTools
    });
  } catch (error) {
    console.error('Error getting current mode:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/modes/tools', (req, res) => {
  try {
    if (!toolRegistry || !modeManager) {
      return res.status(503).json({ success: false, error: 'Services not initialized' });
    }
    
    const toolsInfo = toolRegistry.getAllModesToolInfo();
    const currentModeInfo = toolRegistry.getCurrentModeInfo();
    
    res.json({
      success: true,
      current_mode: currentModeInfo,
      modes_tools: toolsInfo
    });
  } catch (error) {
    console.error('Error getting mode tools info:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// WebSocket handling
wss.on('connection', (ws) => {
  console.log('New WebSocket connection established');
  
  // Set up message sender for this connection
  const messageSender = (message) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  };
  
  // Register the sender with ClineService and ChatManager if available
  if (clineService) {
    clineService.setWebSocketSender(messageSender);
  }
  if (chatManager) {
    chatManager.setWebSocketSender(messageSender);
  }
  
  // Send initial status and conversation state
  messageSender({
    type: 'connectionEstablished',
    timestamp: Date.now(),
    initialized: clineService ? clineService.isReady() : false
  });

  // Send current conversation state if available
  if (chatManager && chatManager.currentConversationId) {
    messageSender({
      type: 'state',
      state: {
        clineMessages: chatManager.messages,
        currentConversationId: chatManager.currentConversationId,
        contextFiles: chatManager.getContextFiles(),
        taskStack: chatManager.taskStack
      }
    });
  }

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);
      console.log('Received WebSocket message:', message.type);
      
      // Handle file operations via WebSocket -> HTTP API bridge
      if (message.type === 'listFiles') {
        try {
          const targetPath = message.dirPath || '.';
          console.log(`🔧 [FILE-OP] Listing files for path: ${targetPath}`);
          
          const fullPath = path.resolve(targetPath);
          if (!fullPath.startsWith(process.cwd())) {
            throw new Error('Access denied');
          }
          
          const items = [];
          const entries = await fs.promises.readdir(fullPath, { withFileTypes: true });
          
          for (const entry of entries) {
            const entryFullPath = path.join(fullPath, entry.name);
            const relativePath = path.relative(process.cwd(), entryFullPath);
            
            const item = {
              name: entry.name,
              path: relativePath,
              type: entry.isDirectory() ? 'directory' : 'file'
            };
            
            if (entry.isFile()) {
              try {
                const stats = await fs.promises.stat(entryFullPath);
                item.size = stats.size;
                item.modified = stats.mtime.toISOString();
              } catch (error) {
                // Continue without stats if we can't get them
              }
            }
            
            items.push(item);
          }
          
          const sortedFiles = items.sort((a, b) => {
            if (a.type !== b.type) {
              return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
          });
          
          messageSender({
            type: 'fileList',
            files: sortedFiles,
            path: targetPath,
            timestamp: Date.now()
          });
          
        } catch (error) {
          console.error('Error listing files:', error);
          messageSender({
            type: 'error',
            message: `Failed to list files: ${error.message}`,
            timestamp: Date.now()
          });
        }
        return;
      }
      
      if (message.type === 'readFile') {
        try {
          const filePath = message.filePath;
          const fullPath = path.resolve(filePath);
          
          if (!fullPath.startsWith(process.cwd())) {
            throw new Error('Access denied');
          }
          
          console.log(`🔧 [FILE-OP] Reading file: ${filePath}`);
          const content = await fs.promises.readFile(fullPath, 'utf8');
          
          messageSender({
            type: 'fileContent',
            content,
            path: filePath,
            timestamp: Date.now()
          });
          
        } catch (error) {
          console.error('Error reading file:', error);
          messageSender({
            type: 'error',
            message: `Failed to read file: ${error.message}`,
            timestamp: Date.now()
          });
        }
        return;
      }
      
      if (message.type === 'writeFile') {
        try {
          const { filePath, content } = message;
          const fullPath = path.resolve(filePath);
          
          if (!fullPath.startsWith(process.cwd())) {
            throw new Error('Access denied');
          }
          
          console.log(`🔧 [FILE-OP] Writing file: ${filePath}`);
          await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
          await fs.promises.writeFile(fullPath, content, 'utf8');
          
          messageSender({
            type: 'fileWritten',
            success: true,
            path: filePath,
            timestamp: Date.now()
          });
          
        } catch (error) {
          console.error('Error writing file:', error);
          messageSender({
            type: 'error',
            message: `Failed to write file: ${error.message}`,
            timestamp: Date.now()
          });
        }
        return;
      }
      
      if (message.type === 'createFile') {
        try {
          const { filePath, content = '' } = message;
          const fullPath = path.resolve(filePath);
          
          if (!fullPath.startsWith(process.cwd())) {
            throw new Error('Access denied');
          }
          
          console.log(`🔧 [FILE-OP] Creating file: ${filePath}`);
          await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
          await fs.promises.writeFile(fullPath, content, 'utf8');
          
          messageSender({
            type: 'fileCreated',
            success: true,
            path: filePath,
            timestamp: Date.now()
          });
          
        } catch (error) {
          console.error('Error creating file:', error);
          messageSender({
            type: 'error',
            message: `Failed to create file: ${error.message}`,
            timestamp: Date.now()
          });
        }
        return;
      }
      
      if (message.type === 'createDirectory') {
        try {
          const { dirPath } = message;
          const fullPath = path.resolve(dirPath);
          
          if (!fullPath.startsWith(process.cwd())) {
            throw new Error('Access denied');
          }
          
          console.log(`🔧 [FILE-OP] Creating directory: ${dirPath}`);
          await fs.promises.mkdir(fullPath, { recursive: true });
          
          messageSender({
            type: 'fileCreated',
            success: true,
            path: dirPath,
            type: 'directory',
            timestamp: Date.now()
          });
          
        } catch (error) {
          console.error('Error creating directory:', error);
          messageSender({
            type: 'error',
            message: `Failed to create directory: ${error.message}`,
            timestamp: Date.now()
          });
        }
        return;
      }
      
      if (message.type === 'deleteFile') {
        try {
          const { filePath } = message;
          const fullPath = path.resolve(filePath);
          
          if (!fullPath.startsWith(process.cwd())) {
            throw new Error('Access denied');
          }
          
          console.log(`🔧 [FILE-OP] Deleting: ${filePath}`);
          const stat = await fs.promises.stat(fullPath);
          if (stat.isDirectory()) {
            await fs.promises.rmdir(fullPath, { recursive: true });
          } else {
            await fs.promises.unlink(fullPath);
          }
          
          messageSender({
            type: 'fileDeleted',
            success: true,
            path: filePath,
            timestamp: Date.now()
          });
          
        } catch (error) {
          console.error('Error deleting file:', error);
          messageSender({
            type: 'error',
            message: `Failed to delete file: ${error.message}`,
            timestamp: Date.now()
          });
        }
        return;
      }
      
      // Handle tool execution
      if (message.type === 'executeTool') {
        try {
          if (!toolRegistry) {
            throw new Error('Tool registry not initialized');
          }
          
          const { tool, parameters } = message;
          console.log(`🔧 [WEBSOCKET] Executing tool: ${tool}`);
          
          const result = await toolRegistry.executeTool(tool, parameters);
          const formattedResult = toolRegistry.formatToolResult(result);
          
          messageSender({
            type: 'toolResult',
            result: formattedResult,
            raw_result: result,
            timestamp: Date.now()
          });
          
        } catch (error) {
          console.error('Error executing tool:', error);
          messageSender({
            type: 'error',
            message: `Failed to execute tool: ${error.message}`,
            timestamp: Date.now()
          });
        }
        return;
      }
      
      // Handle tool list request
      if (message.type === 'getAvailableTools') {
        try {
          if (!toolRegistry) {
            throw new Error('Tool registry not initialized');
          }
          
          const tools = toolRegistry.getAvailableTools();
          messageSender({
            type: 'availableTools',
            tools: tools,
            timestamp: Date.now()
          });
          
        } catch (error) {
          console.error('Error getting available tools:', error);
          messageSender({
            type: 'error',
            message: `Failed to get available tools: ${error.message}`,
            timestamp: Date.now()
          });
        }
        return;
      }
      
      // Handle non-file operations through ClineService
      if (!clineService) {
        messageSender({
          type: 'error',
          message: 'Service not initialized',
          timestamp: Date.now()
        });
        return;
      }
      
      // Handle enhanced chat operations
      if (message.type === 'streamingMessage') {
        if (chatManager) {
          // Create new conversation if needed
          if (!chatManager.currentConversationId) {
            await chatManager.createNewConversation(message.text, message.mode);
          } else {
            await chatManager.addMessage('user', message.text, { mode: message.mode });
          }
        }
        await clineService.sendMessage(message.text, { stream: true, mode: message.mode });
      } else if (message.type === 'newTask') {
        if (chatManager) {
          await chatManager.createNewConversation(message.text, message.mode);
        }
        await clineService.createNewTask(message.text);
      } else if (message.type === 'clearTask') {
        if (chatManager) {
          await chatManager.clearConversation();
        }
        await clineService.clearCurrentTask();
      } else if (message.type === 'editMessage') {
        if (chatManager) {
          await chatManager.editMessage(message.messageId, message.newText);
        }
      } else if (message.type === 'deleteMessage') {
        if (chatManager) {
          await chatManager.deleteMessage(message.messageId);
        }
      } else if (message.type === 'loadConversation') {
        if (chatManager) {
          await chatManager.loadConversation(message.conversationId);
        }
      } else if (message.type === 'getConversationHistory') {
        if (chatManager) {
          const history = await chatManager.getConversationHistory();
          messageSender({
            type: 'conversationHistory',
            data: history
          });
        }
      } else if (message.type === 'addContextFile') {
        if (chatManager) {
          chatManager.addContextFile(message.filePath);
        }
      } else if (message.type === 'removeContextFile') {
        if (chatManager) {
          chatManager.removeContextFile(message.filePath);
        }
      } else if (message.type === 'switchMode') {
        try {
          const result = await modeManager.switchMode(message.mode, { reason: message.reason });
          messageSender({
            type: 'modeChanged',
            data: {
              slug: result.currentMode,
              name: modeManager.getCurrentMode().name,
              description: modeManager.getCurrentMode().description,
              icon: modeManager.getCurrentMode().icon || '🤖'
            }
          });
        } catch (error) {
          messageSender({
            type: 'error',
            message: `Mode switch failed: ${error.message}`
          });
        }
      } else if (message.type === 'getModes') {
        const modes = modeManager.getAllModes().map(mode => ({
          slug: mode.slug,
          name: mode.name,
          description: mode.description,
          icon: mode.icon || '🤖'
        }));
        messageSender({
          type: 'modesAvailable',
          data: modes
        });
      } else if (message.type === 'getCurrentMode') {
        const currentMode = modeManager.getCurrentMode();
        messageSender({
          type: 'modeChanged',
          data: {
            slug: currentMode.slug,
            name: currentMode.name,
            description: currentMode.description,
            icon: currentMode.icon || '🤖'
          }
        });
      } else if (message.type === 'settingsGet') {
        // Handle settings operations via WebSocket
        try {
          if (!settingsService) {
            throw new Error('Settings service not initialized');
          }
          const settings = await settingsService.getAllSettings();
          messageSender({
            type: 'settingsData',
            data: settings,
            timestamp: Date.now()
          });
        } catch (error) {
          console.error('Error getting settings via WebSocket:', error);
          messageSender({
            type: 'error',
            message: `Failed to get settings: ${error.message}`,
            timestamp: Date.now()
          });
        }
      } else if (message.type === 'settingsUpdate') {
        try {
          if (!settingsService) {
            throw new Error('Settings service not initialized');
          }
          await settingsService.updateSettings(message.data);
          messageSender({
            type: 'settingsUpdated',
            success: true,
            timestamp: Date.now()
          });
          
          // Broadcast settings change to all connected clients
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'settingsChanged',
                data: message.data,
                timestamp: Date.now()
              }));
            }
          });
        } catch (error) {
          console.error('Error updating settings via WebSocket:', error);
          messageSender({
            type: 'error',
            message: `Failed to update settings: ${error.message}`,
            timestamp: Date.now()
          });
        }
      } else if (message.type === 'settingsProviderProfileSave') {
        try {
          if (!settingsService) {
            throw new Error('Settings service not initialized');
          }
          const { name, config } = message.data;
          const id = await settingsService.saveProviderProfile(name, config);
          messageSender({
            type: 'settingsProviderProfileSaved',
            success: true,
            id: id,
            timestamp: Date.now()
          });
        } catch (error) {
          console.error('Error saving provider profile via WebSocket:', error);
          messageSender({
            type: 'error',
            message: `Failed to save provider profile: ${error.message}`,
            timestamp: Date.now()
          });
        }
      } else if (message.type === 'settingsProviderProfileDelete') {
        try {
          if (!settingsService) {
            throw new Error('Settings service not initialized');
          }
          await settingsService.deleteProviderProfile(message.data.name);
          messageSender({
            type: 'settingsProviderProfileDeleted',
            success: true,
            timestamp: Date.now()
          });
        } catch (error) {
          console.error('Error deleting provider profile via WebSocket:', error);
          messageSender({
            type: 'error',
            message: `Failed to delete provider profile: ${error.message}`,
            timestamp: Date.now()
          });
        }
      } else if (message.type === 'settingsProviderSetCurrent') {
        try {
          if (!settingsService) {
            throw new Error('Settings service not initialized');
          }
          const profile = await settingsService.setCurrentProvider(message.data.name);
          messageSender({
            type: 'settingsProviderCurrentSet',
            success: true,
            profile: profile,
            timestamp: Date.now()
          });
          
          // Broadcast provider change to all connected clients
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'providerChanged',
                data: profile,
                timestamp: Date.now()
              }));
            }
          });
        } catch (error) {
          console.error('Error setting current provider via WebSocket:', error);
          messageSender({
            type: 'error',
            message: `Failed to set current provider: ${error.message}`,
            timestamp: Date.now()
          });
        }
      } else if (message.type === 'settingsGlobalUpdate') {
        try {
          if (!settingsService) {
            throw new Error('Settings service not initialized');
          }
          await settingsService.setGlobalSettings(message.data);
          messageSender({
            type: 'settingsGlobalUpdated',
            success: true,
            timestamp: Date.now()
          });
          
          // Broadcast global settings change to all connected clients
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'globalSettingsChanged',
                data: message.data,
                timestamp: Date.now()
              }));
            }
          });
        } catch (error) {
          console.error('Error updating global settings via WebSocket:', error);
          messageSender({
            type: 'error',
            message: `Failed to update global settings: ${error.message}`,
            timestamp: Date.now()
          });
        }
      } else if (message.type === 'settingsModeConfigSave') {
        try {
          if (!settingsService) {
            throw new Error('Settings service not initialized');
          }
          await settingsService.saveModeConfig(message.data);
          messageSender({
            type: 'settingsModeConfigSaved',
            success: true,
            timestamp: Date.now()
          });
        } catch (error) {
          console.error('Error saving mode config via WebSocket:', error);
          messageSender({
            type: 'error',
            message: `Failed to save mode config: ${error.message}`,
            timestamp: Date.now()
          });
        }
      } else if (message.type === 'settingsExport') {
        try {
          if (!settingsService) {
            throw new Error('Settings service not initialized');
          }
          const exportData = await settingsService.exportSettings();
          messageSender({
            type: 'settingsExported',
            success: true,
            data: exportData,
            timestamp: Date.now()
          });
        } catch (error) {
          console.error('Error exporting settings via WebSocket:', error);
          messageSender({
            type: 'error',
            message: `Failed to export settings: ${error.message}`,
            timestamp: Date.now()
          });
        }
      } else if (message.type === 'settingsImport') {
        try {
          if (!settingsService) {
            throw new Error('Settings service not initialized');
          }
          const { data, options = {} } = message.data;
          await settingsService.importSettings(data, options);
          messageSender({
            type: 'settingsImported',
            success: true,
            timestamp: Date.now()
          });
          
          // Broadcast settings import to all connected clients
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'settingsReloaded',
                timestamp: Date.now()
              }));
            }
          });
        } catch (error) {
          console.error('Error importing settings via WebSocket:', error);
          messageSender({
            type: 'error',
            message: `Failed to import settings: ${error.message}`,
            timestamp: Date.now()
          });
        }
      } else if (message.type === 'getState') {
        // Handle getState request
        try {
          const currentState = {
            taskId: null,
            currentTask: null,
            clineMessages: chatManager ? chatManager.messages : [],
            isConnected: true,
            hasApiProvider: clineService ? (clineService.getApiConfiguration() !== null && clineService.getApiConfiguration() !== undefined) : false,
            workspaceRoot: config.workspaceDir
          };
          
          messageSender({
            type: 'state',
            state: currentState,
            timestamp: Date.now()
          });
        } catch (error) {
          console.error('Error getting state:', error);
          messageSender({
            type: 'error',
            message: `Failed to get state: ${error.message}`,
            timestamp: Date.now()
          });
        }
      } else {
        // Handle other messages through ClineService
        await clineService.handleMessage(message);
      }
      
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      messageSender({
        type: 'error',
        message: error.message,
        timestamp: Date.now()
      });
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Catch all handler: send back React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'ui/dist/index.html'));
});

// Environment-aware startup configuration
const PORT = config.port;
const HOST = config.host;

// Ensure required directories exist
function ensureDirectories() {
  const dirs = [
    config.workspaceDir,
    './logs',
    './dist',
    './ui/dist'
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });
}

// Initialize ClineService and start server
async function startServer() {
  try {
    console.log(`🚀 Initializing ${config.appName} v${config.appVersion}...`);
    console.log(`📊 Environment: ${config.nodeEnv}`);
    console.log(`🌐 Host: ${HOST}:${PORT}`);
    
    // Ensure required directories exist
    ensureDirectories();
    
    // Initialize ModeManager
    modeManager = new ModeManager();
    console.log('✅ ModeManager initialized successfully');
    
    // Initialize ChatManager
    chatManager = new ChatManager(config.workspaceDir);
    console.log('✅ ChatManager initialized successfully');
    
    // Initialize SettingsService
    settingsService = new SettingsService(config.workspaceDir);
    await settingsService.initialize();
    console.log('✅ SettingsService initialized successfully');
    
    // Initialize ModeAwareToolRegistry
    toolRegistry = new ModeAwareToolRegistry(config.workspaceDir, modeManager);
    
    // Add mode switching tools
    const switchModeTool = new SwitchModeTool(config.workspaceDir, modeManager);
    const newTaskTool = new NewTaskTool(config.workspaceDir, modeManager);
    
    // Register mode tools
    toolRegistry.tools.set('switch_mode', switchModeTool);
    toolRegistry.tools.set('new_task', newTaskTool);
    
    console.log('✅ ModeAwareToolRegistry initialized successfully');
    
    // Initialize workflow system
    workflowTemplates = new WorkflowTemplates();
    workflowManager = new WorkflowManager(config.workspaceDir, toolRegistry, modeManager);
    workflowEngine = new WorkflowEngine(toolRegistry, modeManager, workflowManager);
    
    await workflowManager.initialize();
    console.log('✅ Workflow system initialized successfully');

    // Make all services available to API routes
    app.locals.toolRegistry = toolRegistry;
    app.locals.modeManager = modeManager;
    app.locals.chatManager = chatManager;
    app.locals.settingsService = settingsService;
    app.locals.workflowManager = workflowManager;
    app.locals.workflowEngine = workflowEngine;
    app.locals.workflowTemplates = workflowTemplates;
    
    // Initialize ClineService
    clineService = new ClineService(config.workspaceDir);
    await clineService.initialize();
    console.log('✅ ClineService initialized successfully');
    
    server.listen(PORT, HOST, () => {
      const serverUrl = `http://${HOST}:${PORT}`;
      console.log('🎉 Server started successfully!');
      console.log('================================');
      console.log(`✅ ${config.appName} running on ${serverUrl}`);
      console.log(`🚀 WebSocket server ready for real-time communication`);
      console.log(`📁 Workspace: ${config.workspaceDir}`);
      console.log(`🤖 AI functionality: Ready for integration`);
      console.log(`💬 Task management: Active`);
      console.log(`🔧 VS Code APIs: Replaced with web abstractions`);
      console.log('================================');
      console.log(`📊 Health endpoint: ${serverUrl}/api/health`);
      console.log(`🔗 WebSocket endpoint: ws://${HOST}:${PORT}`);
      console.log(`⚙️  Environment: ${config.nodeEnv}`);
      console.log(`🛡️  CORS enabled: ${config.enableCors}`);
      console.log('================================');
      
      if (config.developmentMode) {
        console.log('🔧 Development mode is enabled');
        console.log('🔧 Debug mode:', config.debugMode ? 'ON' : 'OFF');
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    if (config.debugMode) {
      console.error('Full error details:', error);
    }
    process.exit(1);
  }
}

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('📥 Received SIGTERM signal');
  gracefulShutdown('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('📥 Received SIGINT signal');
  gracefulShutdown('SIGINT');
});

function gracefulShutdown(signal) {
  console.log(`🛑 Gracefully shutting down from ${signal}...`);
  
  server.close(() => {
    console.log('✅ HTTP server closed');
    
    // Close WebSocket connections
    wss.clients.forEach((ws) => {
      ws.terminate();
    });
    console.log('✅ WebSocket connections closed');
    
    // Additional cleanup can be added here
    console.log('✅ Shutdown complete');
    process.exit(0);
  });
  
  // Force close after timeout
  setTimeout(() => {
    console.error('❌ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

startServer();