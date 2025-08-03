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

// Initialize ClineService
let clineService;

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

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'ui/dist')));

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

// WebSocket handling
wss.on('connection', (ws) => {
  console.log('New WebSocket connection established');
  
  // Set up message sender for this connection
  const messageSender = (message) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  };
  
  // Register the sender with ClineService if available
  if (clineService) {
    clineService.setWebSocketSender(messageSender);
  }
  
  // Send initial status
  messageSender({
    type: 'connectionEstablished',
    timestamp: Date.now(),
    initialized: clineService ? clineService.isReady() : false
  });

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);
      console.log('Received WebSocket message:', message.type);
      
      if (!clineService) {
        messageSender({
          type: 'error',
          message: 'Service not initialized',
          timestamp: Date.now()
        });
        return;
      }
      
      // Handle streaming messages specially
      if (message.type === 'streamingMessage') {
        await clineService.sendMessage(message.text, { stream: true });
      } else if (message.type === 'clearTask') {
        await clineService.clearCurrentTask();
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