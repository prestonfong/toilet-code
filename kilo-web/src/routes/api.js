const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const ProviderSettingsManager = require('../core/ProviderSettingsManager');
const ProviderValidator = require('../core/ProviderValidator');
const ProviderAutofill = require('../core/ProviderAutofill');
const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Initialize provider settings manager and validation/autofill systems
let providerSettingsManager;
let providerValidator;
let providerAutofill;

// These will be initialized by the main server startup sequence
// and passed via app.locals - no async initialization here to avoid conflicts

// Middleware to ensure services are available
router.use((req, res, next) => {
  // Get services from app.locals if they haven't been set
  if (!providerSettingsManager && req.app.locals.providerSettingsManager) {
    providerSettingsManager = req.app.locals.providerSettingsManager;
  }
  if (!providerValidator && req.app.locals.providerValidator) {
    providerValidator = req.app.locals.providerValidator;
  }
  if (!providerAutofill && req.app.locals.providerAutofill) {
    providerAutofill = req.app.locals.providerAutofill;
  }
  next();
});

// Helper function to validate file paths (security)
const validatePath = (filePath) => {
  const resolved = path.resolve(filePath);
  const workingDir = process.cwd();
  return resolved.startsWith(workingDir);
};

// Helper function to list directory contents
const listDirectory = async (dirPath) => {
  const items = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(process.cwd(), fullPath);
    
    const item = {
      name: entry.name,
      path: relativePath,
      type: entry.isDirectory() ? 'directory' : 'file'
    };
    
    if (entry.isFile()) {
      try {
        const stats = await fs.stat(fullPath);
        item.size = stats.size;
        item.modified = stats.mtime.toISOString();
      } catch (error) {
        // Continue without stats if we can't get them
      }
    }
    
    items.push(item);
  }
  
  return items.sort((a, b) => {
    // Directories first, then files, both alphabetically
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
};

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    server: 'Kilo Web Server'
  });
});

// File listing endpoint
router.get('/files', async (req, res) => {
  try {
    const targetPath = req.query.path || '.';
    const fullPath = path.resolve(targetPath);
    
    if (!validatePath(fullPath)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const files = await listDirectory(fullPath);
    res.json({ files, path: targetPath });
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ error: error.message });
  }
});

// File read endpoint
router.get('/files/:path(*)', async (req, res) => {
  try {
    const filePath = req.params.path;
    const fullPath = path.resolve(filePath);
    
    if (!validatePath(fullPath)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const content = await fs.readFile(fullPath, 'utf8');
    res.json({ content, path: filePath });
  } catch (error) {
    console.error('Error reading file:', error);
    res.status(500).json({ error: error.message });
  }
});

// File write endpoint
router.put('/files/:path(*)', async (req, res) => {
  try {
    const filePath = req.params.path;
    const { content } = req.body;
    const fullPath = path.resolve(filePath);
    
    if (!validatePath(fullPath)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    
    await fs.writeFile(fullPath, content, 'utf8');
    res.json({ success: true, path: filePath });
  } catch (error) {
    console.error('Error writing file:', error);
    res.status(500).json({ error: error.message });
  }
});

// File creation endpoint
router.post('/files', async (req, res) => {
  try {
    const { path: filePath, content = '', type = 'file' } = req.body;
    const fullPath = path.resolve(filePath);
    
    if (!validatePath(fullPath)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (type === 'directory') {
      await fs.mkdir(fullPath, { recursive: true });
    } else {
      // Ensure directory exists
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf8');
    }
    
    res.json({ success: true, path: filePath, type });
  } catch (error) {
    console.error('Error creating file/directory:', error);
    res.status(500).json({ error: error.message });
  }
});

// File deletion endpoint
router.delete('/files/:path(*)', async (req, res) => {
  try {
    const filePath = req.params.path;
    const fullPath = path.resolve(filePath);
    
    if (!validatePath(fullPath)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) {
      await fs.rmdir(fullPath, { recursive: true });
    } else {
      await fs.unlink(fullPath);
    }
    
    res.json({ success: true, path: filePath });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: error.message });
  }
});

// File upload endpoint
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const targetPath = req.body.path || '.';
    const fileName = req.file.originalname;
    const tempPath = req.file.path;
    const finalPath = path.resolve(targetPath, fileName);
    
    if (!validatePath(finalPath)) {
      await fs.unlink(tempPath); // Clean up temp file
      return res.status(403).json({ error: 'Access denied' });
    }

    // Move file from temp location to final destination
    await fs.rename(tempPath, finalPath);
    
    res.json({ success: true, path: path.relative(process.cwd(), finalPath) });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: error.message });
  }
});

// File download endpoint
router.get('/download/:path(*)', async (req, res) => {
  try {
    const filePath = req.params.path;
    const fullPath = path.resolve(filePath);
    
    if (!validatePath(fullPath)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) {
      return res.status(400).json({ error: 'Path is not a file' });
    }

    res.download(fullPath, path.basename(fullPath));
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Tool execution endpoints
router.get('/tools', (req, res) => {
  try {
    // Get toolRegistry from app locals (set by server.js)
    const toolRegistry = req.app.locals.toolRegistry;
    if (!toolRegistry) {
      return res.status(503).json({ error: 'Tool registry not initialized' });
    }
    
    const tools = toolRegistry.getAvailableTools();
    res.json({ success: true, tools });
  } catch (error) {
    console.error('Error getting tools:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/tools/execute', async (req, res) => {
  try {
    const toolRegistry = req.app.locals.toolRegistry;
    if (!toolRegistry) {
      return res.status(503).json({ error: 'Tool registry not initialized' });
    }
    
    const { tool, parameters } = req.body;
    if (!tool) {
      return res.status(400).json({ error: 'Missing tool name' });
    }
    
    if (!parameters) {
      return res.status(400).json({ error: 'Missing tool parameters' });
    }
    
    const result = await toolRegistry.executeTool(tool, parameters);
    const formattedResult = toolRegistry.formatToolResult(result);
    
    res.json({
      success: true,
      result: formattedResult,
      raw_result: result
    });
    
  } catch (error) {
    console.error('Error executing tool:', error);
    res.status(500).json({ error: error.message });
  }
});

// Terminal/command execution through tools
router.post('/execute', async (req, res) => {
  try {
    const toolRegistry = req.app.locals.toolRegistry;
    if (!toolRegistry) {
      return res.status(503).json({ error: 'Tool registry not initialized' });
    }
    
    const { command, cwd } = req.body;
    if (!command) {
      return res.status(400).json({ error: 'Missing command' });
    }
    
    const result = await toolRegistry.executeTool('execute_command', { command, cwd });
    res.json(result);
    
  } catch (error) {
    console.error('Error executing command:', error);
    res.status(500).json({ error: error.message });
  }
});

// Provider Settings API Endpoints

// GET /settings/providers/profiles - List all provider profiles
router.get('/settings/providers/profiles', async (req, res) => {
  try {
    if (!providerSettingsManager) {
      return res.status(503).json({ error: 'Provider settings manager not initialized' });
    }

    const profiles = await providerSettingsManager.listProfiles();
    res.json({ success: true, profiles });
  } catch (error) {
    console.error('Error listing provider profiles:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /settings/providers/profiles - Save provider profile
router.post('/settings/providers/profiles', async (req, res) => {
  try {
    if (!providerSettingsManager) {
      return res.status(503).json({ error: 'Provider settings manager not initialized' });
    }

    const { name, config } = req.body;
    if (!name || !config) {
      return res.status(400).json({ error: 'Profile name and config are required' });
    }

    const id = await providerSettingsManager.saveProfile(name, config);
    res.json({ success: true, id, message: 'Provider profile saved successfully' });
  } catch (error) {
    console.error('Error saving provider profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/settings/providers/profiles/:name - Delete provider profile
router.delete('/api/settings/providers/profiles/:name', async (req, res) => {
  try {
    if (!providerSettingsManager) {
      return res.status(503).json({ error: 'Provider settings manager not initialized' });
    }

    const { name } = req.params;
    await providerSettingsManager.deleteProfile(name);
    res.json({ success: true, message: 'Provider profile deleted successfully' });
  } catch (error) {
    console.error('Error deleting provider profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/settings/providers/current - Get current active profile
router.get('/api/settings/providers/current', async (req, res) => {
  try {
    if (!providerSettingsManager) {
      return res.status(503).json({ error: 'Provider settings manager not initialized' });
    }

    const provider = await providerSettingsManager.getCurrentProvider();
    res.json({ success: true, provider });
  } catch (error) {
    console.error('Error getting current provider:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/settings/providers/activate/:name - Activate provider profile
router.post('/api/settings/providers/activate/:name', async (req, res) => {
  try {
    if (!providerSettingsManager) {
      return res.status(503).json({ error: 'Provider settings manager not initialized' });
    }

    const { name } = req.params;
    const provider = await providerSettingsManager.activateProfile({ name });
    res.json({ success: true, provider, message: 'Provider profile activated successfully' });
  } catch (error) {
    console.error('Error activating provider profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/settings/providers/available - Get available providers
router.get('/api/settings/providers/available', async (req, res) => {
  try {
    if (!providerSettingsManager) {
      return res.status(503).json({ error: 'Provider settings manager not initialized' });
    }

    const providers = providerSettingsManager.getAvailableProviders();
    res.json({
      success: true,
      providers: providers.map(p => p.id)
    });
  } catch (error) {
    console.error('Error getting available providers:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /settings/providers/:provider/models - Get available models for provider
router.get('/settings/providers/:provider/models', async (req, res) => {
  try {
    console.log('DEBUG: API route hit for provider models:', req.params.provider);
    
    // Set proper JSON content type
    res.setHeader('Content-Type', 'application/json');
    
    // For claude-code provider, return hardcoded models regardless of manager status
    if (req.params.provider === 'claude-code') {
      console.log('DEBUG: Returning hardcoded Claude Code models');
      const models = [
        'claude-sonnet-4-20250514',
        'claude-opus-4-20241223',
        'claude-3-7-sonnet-20241030',
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022'
      ];
      return res.json({ success: true, models, debug: 'hardcoded-response' });
    }
    
    if (!providerSettingsManager) {
      console.log('DEBUG: Provider settings manager not initialized');
      return res.status(503).json({ error: 'Provider settings manager not initialized' });
    }

    const { provider } = req.params;
    console.log('DEBUG: Getting models for provider:', provider);
    const models = providerSettingsManager.getAvailableModels(provider);
    
    // Ensure we always return a JSON response with proper structure
    if (!models || !Array.isArray(models)) {
      console.log('DEBUG: No models found, returning empty array');
      return res.json({ success: true, models: [] });
    }
    
    console.log('DEBUG: Returning models:', models);
    res.json({ success: true, models });
  } catch (error) {
    console.error('Error getting available models:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/settings/providers/profile/:name - Get specific provider profile
router.get('/api/settings/providers/profile/:name', async (req, res) => {
  try {
    if (!providerSettingsManager) {
      return res.status(503).json({ error: 'Provider settings manager not initialized' });
    }

    const { name } = req.params;
    const profile = await providerSettingsManager.getProfile({ name });
    res.json({ success: true, profile });
  } catch (error) {
    console.error('Error getting provider profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/settings/providers/export - Export provider settings
router.post('/api/settings/providers/export', async (req, res) => {
  try {
    if (!providerSettingsManager) {
      return res.status(503).json({ error: 'Provider settings manager not initialized' });
    }

    const exportData = await providerSettingsManager.export();
    res.json({ success: true, exportData });
  } catch (error) {
    console.error('Error exporting provider settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/settings/providers/import - Import provider settings
router.post('/api/settings/providers/import', async (req, res) => {
  try {
    if (!providerSettingsManager) {
      return res.status(503).json({ error: 'Provider settings manager not initialized' });
    }

    const { importData, options = {} } = req.body;
    if (!importData) {
      return res.status(400).json({ error: 'Import data is required' });
    }

    await providerSettingsManager.import(importData, options);
    res.json({ success: true, message: 'Provider settings imported successfully' });
  } catch (error) {
    console.error('Error importing provider settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/settings/providers/reset - Reset all provider settings
router.post('/api/settings/providers/reset', async (req, res) => {
  try {
    if (!providerSettingsManager) {
      return res.status(503).json({ error: 'Provider settings manager not initialized' });
    }

    await providerSettingsManager.resetAllProfiles();
    res.json({ success: true, message: 'All provider settings reset to defaults' });
  } catch (error) {
    console.error('Error resetting provider settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/settings/providers/modes/:mode - Set provider for specific mode
router.post('/api/settings/providers/modes/:mode', async (req, res) => {
  try {
    if (!providerSettingsManager) {
      return res.status(503).json({ error: 'Provider settings manager not initialized' });
    }

    const { mode } = req.params;
    const { configId } = req.body;
    
    if (!configId) {
      return res.status(400).json({ error: 'Config ID is required' });
    }

    await providerSettingsManager.setModeConfig(mode, configId);
    res.json({ success: true, message: `Mode '${mode}' configuration updated` });
  } catch (error) {
    console.error('Error setting mode configuration:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/settings/providers/modes/:mode - Get provider for specific mode
router.get('/api/settings/providers/modes/:mode', async (req, res) => {
  try {
    if (!providerSettingsManager) {
      return res.status(503).json({ error: 'Provider settings manager not initialized' });
    }

    const { mode } = req.params;
    const configId = await providerSettingsManager.getModeConfigId(mode);
    res.json({ success: true, configId });
  } catch (error) {
    console.error('Error getting mode configuration:', error);
    res.status(500).json({ error: error.message });
  }
});

// Provider Validation API Endpoints

// POST /api/settings/providers/validate - Validate provider configuration
router.post('/api/settings/providers/validate', async (req, res) => {
  try {
    if (!providerValidator) {
      return res.status(503).json({ error: 'Provider validator not initialized' });
    }

    const { provider, config } = req.body;
    if (!provider || !config) {
      return res.status(400).json({ error: 'Provider and config are required' });
    }

    const validation = providerValidator.validateProviderConfig(provider, config);
    const summary = providerValidator.getValidationSummary(provider, config);

    res.json({
      success: true,
      validation,
      summary
    });
  } catch (error) {
    console.error('Error validating provider config:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/settings/providers/validate/field - Validate specific field
router.post('/api/settings/providers/validate/field', async (req, res) => {
  try {
    if (!providerValidator) {
      return res.status(503).json({ error: 'Provider validator not initialized' });
    }

    const { provider, field, value } = req.body;
    if (!provider || !field) {
      return res.status(400).json({ error: 'Provider and field are required' });
    }

    const errors = providerValidator.validateFieldRealtime(provider, field, value);
    
    res.json({
      success: true,
      errors,
      isValid: errors.length === 0
    });
  } catch (error) {
    console.error('Error validating field:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/settings/providers/:provider/schema - Get provider validation schema
router.get('/api/settings/providers/:provider/schema', async (req, res) => {
  try {
    if (!providerValidator) {
      return res.status(503).json({ error: 'Provider validator not initialized' });
    }

    const { provider } = req.params;
    const schema = providerValidator.getProviderSchema(provider);
    
    if (!schema) {
      return res.status(404).json({ error: 'Provider schema not found' });
    }

    res.json({
      success: true,
      schema
    });
  } catch (error) {
    console.error('Error getting provider schema:', error);
    res.status(500).json({ error: error.message });
  }
});

// Provider Autofill API Endpoints

// POST /api/settings/providers/autofill - Get autofilled configuration
router.post('/api/settings/providers/autofill', async (req, res) => {
  try {
    if (!providerAutofill) {
      return res.status(503).json({ error: 'Provider autofill not initialized' });
    }

    const { provider, existingConfig = {}, useCase = 'general' } = req.body;
    if (!provider) {
      return res.status(400).json({ error: 'Provider is required' });
    }

    const autofilledConfig = providerAutofill.getAutofillConfig(provider, existingConfig);
    const recommendedSettings = providerAutofill.getRecommendedSettings(provider, useCase);

    res.json({
      success: true,
      config: autofilledConfig,
      recommended: recommendedSettings
    });
  } catch (error) {
    console.error('Error getting autofill config:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/settings/providers/:provider/models/suggestions - Get model suggestions
router.get('/api/settings/providers/:provider/models/suggestions', async (req, res) => {
  try {
    // Set proper JSON content type
    res.setHeader('Content-Type', 'application/json');
    
    if (!providerAutofill) {
      return res.status(503).json({ error: 'Provider autofill not initialized' });
    }

    const { provider } = req.params;
    const { useCase = 'general' } = req.query;
    
    const suggestions = providerAutofill.getModelSuggestions(provider, useCase);
    
    // Ensure we always return a JSON response with proper structure
    if (!suggestions || !Array.isArray(suggestions)) {
      return res.json({ success: true, suggestions: [], useCase });
    }
    
    res.json({
      success: true,
      suggestions,
      useCase
    });
  } catch (error) {
    console.error('Error getting model suggestions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/settings/providers/completions - Get field completions
router.post('/api/settings/providers/completions', async (req, res) => {
  try {
    if (!providerAutofill) {
      return res.status(503).json({ error: 'Provider autofill not initialized' });
    }

    const { provider, field, currentValue = '', context = {} } = req.body;
    if (!provider || !field) {
      return res.status(400).json({ error: 'Provider and field are required' });
    }

    const completions = providerAutofill.getFieldCompletions(provider, field, currentValue, context);
    
    res.json({
      success: true,
      completions
    });
  } catch (error) {
    console.error('Error getting field completions:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/settings/providers/:provider/field/:field/help - Get field help information
router.get('/api/settings/providers/:provider/field/:field/help', async (req, res) => {
  try {
    if (!providerAutofill) {
      return res.status(503).json({ error: 'Provider autofill not initialized' });
    }

    const { provider, field } = req.params;
    const help = providerAutofill.getFieldHelp(provider, field);
    
    if (!help) {
      return res.status(404).json({ error: 'Field help not found' });
    }

    res.json({
      success: true,
      help
    });
  } catch (error) {
    console.error('Error getting field help:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/settings/providers/test - Test provider connection
router.post('/api/settings/providers/test', async (req, res) => {
  try {
    const { provider, config } = req.body;
    if (!provider || !config) {
      return res.status(400).json({ error: 'Provider and config are required' });
    }

    // First validate the configuration
    if (providerValidator) {
      const validation = providerValidator.validateProviderConfig(provider, config);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Configuration validation failed',
          validation
        });
      }
    }

    // Load the provider implementation and test it
    const providers = require('../api/providers');
    const ProviderClass = providers[provider];
    
    if (!ProviderClass) {
      return res.status(400).json({
        success: false,
        error: `Provider ${provider} not found`
      });
    }

    let testResult;
    if (typeof ProviderClass.prototype.test === 'function') {
      // Use provider's built-in test method
      const providerInstance = new ProviderClass(config);
      testResult = await providerInstance.test(config.apiKey);
    } else {
      // Fallback: try a simple completion
      const providerInstance = new ProviderClass(config);
      try {
        await providerInstance.complete({
          messages: [{ role: 'user', content: 'Hello' }],
          maxTokens: 10
        });
        testResult = { success: true, message: 'Provider connection successful' };
      } catch (error) {
        testResult = { success: false, error: error.message };
      }
    }

    res.json({
      success: testResult.success,
      message: testResult.message,
      error: testResult.error
    });
  } catch (error) {
    console.error('Error testing provider:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/settings/providers/supported - Get all supported providers with metadata
router.get('/api/settings/providers/supported', async (req, res) => {
  try {
    if (!providerValidator || !providerAutofill) {
      return res.status(503).json({ error: 'Provider systems not initialized' });
    }

    const supportedProviders = providerValidator.getSupportedProviders();
    const providersWithMetadata = supportedProviders.map(provider => {
      const schema = providerValidator.getProviderSchema(provider);
      const defaults = providerAutofill.getAutofillConfig(provider);
      
      return {
        id: provider,
        name: schema.name,
        requiredFields: schema.requiredFields,
        optionalFields: schema.optionalFields,
        supportedModels: schema.models || [],
        defaultConfig: defaults
      };
    });

    res.json({
      success: true,
      providers: providersWithMetadata
    });
  } catch (error) {
    console.error('Error getting supported providers:', error);
    res.status(500).json({ error: error.message });
  }
});

// MCP Server Management API Endpoints

// GET /api/mcp/servers - List all MCP servers
router.get('/api/mcp/servers', async (req, res) => {
  try {
    const settingsManager = req.app.locals.settingsManager;
    if (!settingsManager) {
      return res.status(503).json({ error: 'Settings manager not initialized' });
    }

    const mcpManager = settingsManager.getMCPServerManager();
    const servers = await mcpManager.getAllServers();
    
    res.json({ success: true, servers });
  } catch (error) {
    console.error('Error listing MCP servers:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/mcp/servers - Add new MCP server
router.post('/api/mcp/servers', async (req, res) => {
  try {
    const settingsManager = req.app.locals.settingsManager;
    if (!settingsManager) {
      return res.status(503).json({ error: 'Settings manager not initialized' });
    }

    const mcpManager = settingsManager.getMCPServerManager();
    const serverId = await mcpManager.addServer(req.body);
    
    res.json({ success: true, serverId, message: 'MCP server added successfully' });
  } catch (error) {
    console.error('Error adding MCP server:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/mcp/servers/:serverId - Remove MCP server
router.delete('/api/mcp/servers/:serverId', async (req, res) => {
  try {
    const settingsManager = req.app.locals.settingsManager;
    if (!settingsManager) {
      return res.status(503).json({ error: 'Settings manager not initialized' });
    }

    const { serverId } = req.params;
    const mcpManager = settingsManager.getMCPServerManager();
    await mcpManager.removeServer(serverId);
    
    res.json({ success: true, message: 'MCP server removed successfully' });
  } catch (error) {
    console.error('Error removing MCP server:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/mcp/servers/:serverId/toggle - Toggle server enabled state
router.post('/api/mcp/servers/:serverId/toggle', async (req, res) => {
  try {
    const settingsManager = req.app.locals.settingsManager;
    if (!settingsManager) {
      return res.status(503).json({ error: 'Settings manager not initialized' });
    }

    const { serverId } = req.params;
    const { enabled } = req.body;
    const mcpManager = settingsManager.getMCPServerManager();
    
    await mcpManager.toggleServer(serverId, enabled);
    
    res.json({
      success: true,
      message: `MCP server ${enabled ? 'enabled' : 'disabled'} successfully`
    });
  } catch (error) {
    console.error('Error toggling MCP server:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/mcp/servers/:serverId/test - Test server connection
router.post('/api/mcp/servers/:serverId/test', async (req, res) => {
  try {
    const settingsManager = req.app.locals.settingsManager;
    if (!settingsManager) {
      return res.status(503).json({ error: 'Settings manager not initialized' });
    }

    const { serverId } = req.params;
    const mcpManager = settingsManager.getMCPServerManager();
    const result = await mcpManager.testConnection(serverId);
    
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error testing MCP server connection:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/mcp/servers/status - Get status of all servers
router.get('/api/mcp/servers/status', async (req, res) => {
  try {
    const settingsManager = req.app.locals.settingsManager;
    if (!settingsManager) {
      return res.status(503).json({ error: 'Settings manager not initialized' });
    }

    const mcpManager = settingsManager.getMCPServerManager();
    const statuses = Object.fromEntries(mcpManager.serverStatuses);
    
    res.json({ success: true, statuses });
  } catch (error) {
    console.error('Error getting MCP server statuses:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/mcp/servers/health - Get health information for all servers
router.get('/api/mcp/servers/health', async (req, res) => {
  try {
    const settingsManager = req.app.locals.settingsManager;
    if (!settingsManager) {
      return res.status(503).json({ error: 'Settings manager not initialized' });
    }

    const mcpManager = settingsManager.getMCPServerManager();
    const health = Object.fromEntries(mcpManager.serverHealth);
    
    res.json({ success: true, health });
  } catch (error) {
    console.error('Error getting MCP server health:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/mcp/tools - Get all available tools from MCP servers
router.get('/api/mcp/tools', async (req, res) => {
  try {
    const settingsManager = req.app.locals.settingsManager;
    if (!settingsManager) {
      return res.status(503).json({ error: 'Settings manager not initialized' });
    }

    const mcpManager = settingsManager.getMCPServerManager();
    const tools = Array.from(mcpManager.tools.values());
    
    res.json({ success: true, tools });
  } catch (error) {
    console.error('Error getting MCP tools:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/mcp/resources - Get all available resources from MCP servers
router.get('/api/mcp/resources', async (req, res) => {
  try {
    const settingsManager = req.app.locals.settingsManager;
    if (!settingsManager) {
      return res.status(503).json({ error: 'Settings manager not initialized' });
    }

    const mcpManager = settingsManager.getMCPServerManager();
    const resources = Array.from(mcpManager.resources.values());
    
    res.json({ success: true, resources });
  } catch (error) {
    console.error('Error getting MCP resources:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/mcp/stats - Get MCP server statistics
router.get('/api/mcp/stats', async (req, res) => {
  try {
    const settingsManager = req.app.locals.settingsManager;
    if (!settingsManager) {
      return res.status(503).json({ error: 'Settings manager not initialized' });
    }

    const mcpManager = settingsManager.getMCPServerManager();
    const stats = mcpManager.getServerStats();
    
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error getting MCP server stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/mcp/tools/:toolName/invoke - Invoke an MCP tool
router.post('/api/mcp/tools/:toolName/invoke', async (req, res) => {
  try {
    const settingsManager = req.app.locals.settingsManager;
    if (!settingsManager) {
      return res.status(503).json({ error: 'Settings manager not initialized' });
    }

    const { toolName } = req.params;
    const { parameters = {} } = req.body;
    
    const mcpManager = settingsManager.getMCPServerManager();
    
    // Find the tool
    const tool = Array.from(mcpManager.tools.values()).find(t => t.name === toolName);
    if (!tool) {
      return res.status(404).json({ error: `Tool '${toolName}' not found` });
    }
    
    // For now, return a placeholder response
    // Full implementation would send the tool invocation to the MCP server
    res.json({
      success: true,
      message: 'Tool invocation not yet implemented',
      tool: tool.name,
      serverId: tool.serverId
    });
    
  } catch (error) {
    console.error('Error invoking MCP tool:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/mcp/resources/:resourceUri - Access an MCP resource
router.get('/api/mcp/resources/:resourceUri(*)', async (req, res) => {
  try {
    const settingsManager = req.app.locals.settingsManager;
    if (!settingsManager) {
      return res.status(503).json({ error: 'Settings manager not initialized' });
    }

    const resourceUri = req.params.resourceUri;
    const mcpManager = settingsManager.getMCPServerManager();
    
    // Find the resource
    const resource = Array.from(mcpManager.resources.values()).find(r => r.uri === resourceUri);
    if (!resource) {
      return res.status(404).json({ error: `Resource '${resourceUri}' not found` });
    }
    
    // For now, return resource metadata
    // Full implementation would fetch the actual resource content from the MCP server
    res.json({
      success: true,
      message: 'Resource access not yet implemented',
      resource: resource
    });
    
  } catch (error) {
    console.error('Error accessing MCP resource:', error);
    res.status(500).json({ error: error.message });
  }
});

// Comprehensive Settings Import/Export API Endpoints

// POST /api/settings/export - Export all settings with options
router.post('/api/settings/export', async (req, res) => {
  try {
    const settingsManager = req.app.locals.settingsManager;
    if (!settingsManager) {
      return res.status(503).json({ error: 'Settings manager not initialized' });
    }

    const SettingsImportExport = require('../core/SettingsImportExport');
    const importExport = new SettingsImportExport(settingsManager);
    
    const options = req.body || {};
    const exportData = await importExport.exportSettings(options);
    
    res.json({ success: true, exportData });
  } catch (error) {
    console.error('Settings export failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/settings/import - Import settings with comprehensive options
router.post('/api/settings/import', async (req, res) => {
  try {
    const settingsManager = req.app.locals.settingsManager;
    if (!settingsManager) {
      return res.status(503).json({ error: 'Settings manager not initialized' });
    }

    const { importData, options = {} } = req.body;
    if (!importData) {
      return res.status(400).json({ error: 'Import data is required' });
    }

    const SettingsImportExport = require('../core/SettingsImportExport');
    const importExport = new SettingsImportExport(settingsManager);
    
    const result = await importExport.importSettings(importData, options);
    res.json(result);
  } catch (error) {
    console.error('Settings import failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/settings/import/preview - Create import preview
router.post('/api/settings/import/preview', async (req, res) => {
  try {
    const settingsManager = req.app.locals.settingsManager;
    if (!settingsManager) {
      return res.status(503).json({ error: 'Settings manager not initialized' });
    }

    const { importData, password } = req.body;
    if (!importData) {
      return res.status(400).json({ error: 'Import data is required' });
    }

    const SettingsImportExport = require('../core/SettingsImportExport');
    const importExport = new SettingsImportExport(settingsManager);
    
    // Temporarily set password if provided
    if (password && importData.encrypted) {
      importData._tempPassword = password;
    }
    
    const preview = await importExport.createImportPreview(importData);
    res.json({ success: true, preview });
  } catch (error) {
    console.error('Import preview failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/settings/import/validate - Validate import data
router.post('/api/settings/import/validate', async (req, res) => {
  try {
    const settingsManager = req.app.locals.settingsManager;
    if (!settingsManager) {
      return res.status(503).json({ error: 'Settings manager not initialized' });
    }

    const { importData, password } = req.body;
    if (!importData) {
      return res.status(400).json({ error: 'Import data is required' });
    }

    const SettingsImportExport = require('../core/SettingsImportExport');
    const importExport = new SettingsImportExport(settingsManager);
    
    // Basic validation
    const structureValidation = importExport.validateImportData(importData);
    
    // Decrypt and validate content if needed
    let contentValidation = { errors: [], warnings: [] };
    if (structureValidation.isValid) {
      let categories = importData.categories;
      if (importData.encrypted && password) {
        try {
          categories = importExport.decryptData(categories, password);
        } catch (error) {
          structureValidation.errors.push('Failed to decrypt data with provided password');
        }
      }
      
      if (!importData.encrypted || password) {
        contentValidation = await importExport.validateSettingsData(categories);
      }
    }
    
    res.json({
      success: true,
      validation: {
        structure: structureValidation,
        content: contentValidation,
        isValid: structureValidation.isValid && contentValidation.errors.length === 0
      }
    });
  } catch (error) {
    console.error('Import validation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/settings/backup - Create settings backup
router.post('/api/settings/backup', async (req, res) => {
  try {
    const settingsManager = req.app.locals.settingsManager;
    if (!settingsManager) {
      return res.status(503).json({ error: 'Settings manager not initialized' });
    }

    const SettingsImportExport = require('../core/SettingsImportExport');
    const importExport = new SettingsImportExport(settingsManager);
    
    const backupData = await importExport.createBackup();
    res.json({ success: true, backup: backupData });
  } catch (error) {
    console.error('Settings backup failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/settings/restore - Restore from backup
router.post('/api/settings/restore', async (req, res) => {
  try {
    const settingsManager = req.app.locals.settingsManager;
    if (!settingsManager) {
      return res.status(503).json({ error: 'Settings manager not initialized' });
    }

    const { backupData } = req.body;
    if (!backupData) {
      return res.status(400).json({ error: 'Backup data is required' });
    }

    const SettingsImportExport = require('../core/SettingsImportExport');
    const importExport = new SettingsImportExport(settingsManager);
    
    await importExport.restoreFromBackup(backupData);
    res.json({ success: true, message: 'Settings restored from backup' });
  } catch (error) {
    console.error('Settings restore failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/settings/export/formats - Get available export formats
router.get('/api/settings/export/formats', (req, res) => {
  res.json({
    success: true,
    formats: [
      {
        id: 'json',
        name: 'JSON',
        description: 'Standard JSON format',
        encrypted: false
      },
      {
        id: 'encrypted-json',
        name: 'Encrypted JSON',
        description: 'Password-protected JSON format',
        encrypted: true
      }
    ]
  });
});

// GET /api/settings/categories - Get available settings categories
router.get('/api/settings/categories', (req, res) => {
  res.json({
    success: true,
    categories: [
      {
        id: 'providerSettings',
        name: 'Provider Settings',
        description: 'API provider configurations and profiles'
      },
      {
        id: 'globalSettings',
        name: 'Global Settings',
        description: 'Application-wide preferences and configurations'
      },
      {
        id: 'advancedSettings',
        name: 'Advanced Settings',
        description: 'Advanced features like auto-approve, browser tools, etc.'
      },
      {
        id: 'mcpServers',
        name: 'MCP Servers',
        description: 'Model Context Protocol server configurations'
      },
      {
        id: 'modeConfigs',
        name: 'Mode Configurations',
        description: 'Custom mode definitions and settings'
      },
      {
        id: 'workspaceSettings',
        name: 'Workspace Settings',
        description: 'Workspace-specific overrides and preferences'
      }
    ]
  });
});

// Task History Management API Endpoints

// POST /api/task-history - Start new task or add message to existing task
router.post('/api/task-history', async (req, res) => {
  try {
    const taskHistoryManager = req.app.locals.taskHistoryManager;
    if (!taskHistoryManager) {
      return res.status(503).json({ error: 'Task history manager not initialized' });
    }

    const { action, message, mode, metadata } = req.body;
    
    if (action === 'start') {
      const taskId = await taskHistoryManager.startTask(message, mode, metadata);
      res.json({ success: true, taskId });
    } else {
      res.status(400).json({ error: 'Invalid action. Use "start" to create a new task' });
    }
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/task-history/:taskId/messages - Add message to task
router.post('/api/task-history/:taskId/messages', async (req, res) => {
  try {
    const taskHistoryManager = req.app.locals.taskHistoryManager;
    if (!taskHistoryManager) {
      return res.status(503).json({ error: 'Task history manager not initialized' });
    }

    const { taskId } = req.params;
    const message = req.body;
    
    const messageId = await taskHistoryManager.addMessage(taskId, message);
    res.json({ success: true, messageId });
  } catch (error) {
    console.error('Error adding message to task:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/task-history/:taskId - Update task (complete, fail, etc.)
router.put('/api/task-history/:taskId', async (req, res) => {
  try {
    const taskHistoryManager = req.app.locals.taskHistoryManager;
    if (!taskHistoryManager) {
      return res.status(503).json({ error: 'Task history manager not initialized' });
    }

    const { taskId } = req.params;
    const { action, summary, error: taskError } = req.body;
    
    let task;
    switch (action) {
      case 'complete':
        task = await taskHistoryManager.completeTask(taskId, summary);
        break;
      case 'fail':
        task = await taskHistoryManager.failTask(taskId, taskError);
        break;
      case 'cancel':
        task = await taskHistoryManager.cancelTask(taskId);
        break;
      default:
        return res.status(400).json({ error: 'Invalid action. Use "complete", "fail", or "cancel"' });
    }
    
    res.json({ success: true, task });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/task-history - Get task history with filtering and pagination
router.get('/task-history', async (req, res) => {
  try {
    const taskHistoryManager = req.app.locals.taskHistoryManager;
    if (!taskHistoryManager) {
      return res.status(503).json({ error: 'Task history manager not initialized' });
    }

    const filters = {
      query: req.query.query,
      mode: req.query.mode ? req.query.mode.split(',') : [],
      status: req.query.status ? req.query.status.split(',') : [],
      workspace: req.query.workspace ? req.query.workspace.split(',') : [],
      category: req.query.category ? req.query.category.split(',') : [],
      tags: req.query.tags ? req.query.tags.split(',') : [],
      hasFiles: req.query.hasFiles ? req.query.hasFiles === 'true' : null,
      hasErrors: req.query.hasErrors ? req.query.hasErrors === 'true' : null,
      minDuration: req.query.minDuration ? parseInt(req.query.minDuration) : null,
      maxDuration: req.query.maxDuration ? parseInt(req.query.maxDuration) : null,
      minMessages: req.query.minMessages ? parseInt(req.query.minMessages) : null,
      maxMessages: req.query.maxMessages ? parseInt(req.query.maxMessages) : null
    };

    if (req.query.dateStart && req.query.dateEnd) {
      filters.dateRange = {
        start: parseInt(req.query.dateStart),
        end: parseInt(req.query.dateEnd)
      };
    }

    const options = {
      sortBy: req.query.sortBy || 'lastModified',
      sortOrder: req.query.sortOrder || 'desc',
      limit: parseInt(req.query.limit) || 100,
      offset: parseInt(req.query.offset) || 0
    };

    const result = await taskHistoryManager.searchTasks(filters, options);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error getting task history:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/task-history/:taskId - Get specific task details
router.get('/task-history/:taskId', async (req, res) => {
  try {
    const taskHistoryManager = req.app.locals.taskHistoryManager;
    if (!taskHistoryManager) {
      return res.status(503).json({ error: 'Task history manager not initialized' });
    }

    const { taskId } = req.params;
    const task = await taskHistoryManager.getTaskById(taskId);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ success: true, task });
  } catch (error) {
    console.error('Error getting task details:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/task-history/:taskId/archive - Archive/unarchive task
router.post('/task-history/:taskId/archive', async (req, res) => {
  try {
    const taskHistoryManager = req.app.locals.taskHistoryManager;
    if (!taskHistoryManager) {
      return res.status(503).json({ error: 'Task history manager not initialized' });
    }

    const { taskId } = req.params;
    const { archived } = req.body;
    
    const task = await taskHistoryManager.archiveTask(taskId, archived);
    res.json({ success: true, task });
  } catch (error) {
    console.error('Error archiving task:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/task-history/:taskId - Delete task
router.delete('/task-history/:taskId', async (req, res) => {
  try {
    const taskHistoryManager = req.app.locals.taskHistoryManager;
    if (!taskHistoryManager) {
      return res.status(503).json({ error: 'Task history manager not initialized' });
    }

    const { taskId } = req.params;
    const success = await taskHistoryManager.deleteTask(taskId);
    
    if (!success) {
      return res.status(404).json({ error: 'Task not found or could not be deleted' });
    }

    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/task-history/batch - Execute batch operations on tasks
router.post('/task-history/batch', async (req, res) => {
  try {
    const taskHistoryManager = req.app.locals.taskHistoryManager;
    if (!taskHistoryManager) {
      return res.status(503).json({ error: 'Task history manager not initialized' });
    }

    const operation = req.body;
    if (!operation.type || !operation.taskIds || !Array.isArray(operation.taskIds)) {
      return res.status(400).json({ error: 'Invalid batch operation format' });
    }

    const results = await taskHistoryManager.executeBatchOperation(operation);
    res.json({ success: true, results });
  } catch (error) {
    console.error('Error executing batch operation:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/task-history/statistics - Get task history statistics and analytics
router.get('/task-history/statistics', async (req, res) => {
  try {
    const taskHistoryManager = req.app.locals.taskHistoryManager;
    if (!taskHistoryManager) {
      return res.status(503).json({ error: 'Task history manager not initialized' });
    }

    const statistics = await taskHistoryManager.generateStatistics();
    res.json({ success: true, statistics });
  } catch (error) {
    console.error('Error getting task statistics:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/task-history/export - Export task history
router.post('/task-history/export', async (req, res) => {
  try {
    const taskHistoryManager = req.app.locals.taskHistoryManager;
    if (!taskHistoryManager) {
      return res.status(503).json({ error: 'Task history manager not initialized' });
    }

    const options = req.body || {};
    const exportData = await taskHistoryManager.exportTasks(options);
    
    const filename = `task-history-${new Date().toISOString().split('T')[0]}.${options.format || 'json'}`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', options.format === 'csv' ? 'text/csv' :
                  options.format === 'markdown' ? 'text/markdown' : 'application/json');
    
    res.send(exportData);
  } catch (error) {
    console.error('Error exporting task history:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/task-history/:taskId/tags - Add tags to task
router.post('/task-history/:taskId/tags', async (req, res) => {
  try {
    const taskHistoryManager = req.app.locals.taskHistoryManager;
    if (!taskHistoryManager) {
      return res.status(503).json({ error: 'Task history manager not initialized' });
    }

    const { taskId } = req.params;
    const { tags } = req.body;
    
    if (!Array.isArray(tags)) {
      return res.status(400).json({ error: 'Tags must be an array' });
    }

    const task = await taskHistoryManager.tagTask(taskId, tags);
    res.json({ success: true, task });
  } catch (error) {
    console.error('Error adding tags to task:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/task-history/:taskId/category - Update task category
router.put('/task-history/:taskId/category', async (req, res) => {
  try {
    const taskHistoryManager = req.app.locals.taskHistoryManager;
    if (!taskHistoryManager) {
      return res.status(503).json({ error: 'Task history manager not initialized' });
    }

    const { taskId } = req.params;
    const { category } = req.body;
    
    if (!category) {
      return res.status(400).json({ error: 'Category is required' });
    }

    const task = await taskHistoryManager.categorizeTask(taskId, category);
    res.json({ success: true, task });
  } catch (error) {
    console.error('Error updating task category:', error);
    res.status(500).json({ error: error.message });
  }
});

// Workflow Management API Endpoints

// GET /api/workflows/templates - Get all workflow templates
router.get('/api/workflows/templates', async (req, res) => {
  try {
    const workflowTemplates = req.app.locals.workflowTemplates;
    console.log('DEBUG: workflowTemplates available:', !!workflowTemplates);
    
    if (!workflowTemplates) {
      console.log('DEBUG: Available app.locals keys:', Object.keys(req.app.locals));
      return res.status(503).json({ error: 'Workflow templates not initialized' });
    }

    console.log('DEBUG: Calling getAllTemplates()');
    const templates = workflowTemplates.getAllTemplates();
    console.log('DEBUG: Templates received:', templates?.length || 0);
    
    res.json({ success: true, templates });
  } catch (error) {
    console.error('Error getting workflow templates:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/workflows/templates - Create new workflow template
router.post('/api/workflows/templates', async (req, res) => {
  try {
    const workflowManager = req.app.locals.workflowManager;
    if (!workflowManager) {
      return res.status(503).json({ error: 'Workflow manager not initialized' });
    }

    const config = req.body;
    if (!config.name || !config.steps) {
      return res.status(400).json({ error: 'Workflow name and steps are required' });
    }

    const workflow = await workflowManager.createWorkflow(config);
    res.json({ success: true, workflow });
  } catch (error) {
    console.error('Error creating workflow template:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/workflows/templates/:templateId - Get specific workflow template
router.get('/api/workflows/templates/:templateId', async (req, res) => {
  try {
    const workflowManager = req.app.locals.workflowManager;
    if (!workflowManager) {
      return res.status(503).json({ error: 'Workflow manager not initialized' });
    }

    const { templateId } = req.params;
    const templates = await workflowManager.getEnabledWorkflows();
    const template = templates.find(t => t.id === templateId);
    
    if (!template) {
      return res.status(404).json({ error: 'Workflow template not found' });
    }

    res.json({ success: true, template });
  } catch (error) {
    console.error('Error getting workflow template:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/workflows/templates/:templateId - Delete workflow template
router.delete('/api/workflows/templates/:templateId', async (req, res) => {
  try {
    const workflowManager = req.app.locals.workflowManager;
    if (!workflowManager) {
      return res.status(503).json({ error: 'Workflow manager not initialized' });
    }

    const { templateId } = req.params;
    const templates = await workflowManager.getEnabledWorkflows();
    const template = templates.find(t => t.id === templateId);
    
    if (!template) {
      return res.status(404).json({ error: 'Workflow template not found' });
    }

    const success = await workflowManager.deleteWorkflow(templateId, template.filePath);
    
    if (!success) {
      return res.status(500).json({ error: 'Failed to delete workflow template' });
    }

    res.json({ success: true, message: 'Workflow template deleted successfully' });
  } catch (error) {
    console.error('Error deleting workflow template:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/workflows/executions - Execute workflow
router.post('/api/workflows/executions', async (req, res) => {
  try {
    const workflowManager = req.app.locals.workflowManager;
    if (!workflowManager) {
      return res.status(503).json({ error: 'Workflow manager not initialized' });
    }

    const request = req.body;
    if (!request.templateId) {
      return res.status(400).json({ error: 'Template ID is required' });
    }

    // In a full implementation, this would create and track workflow execution
    // For now, return a mock execution object
    const execution = {
      id: crypto.randomUUID(),
      workflowId: request.templateId,
      workflowName: `Workflow ${request.templateId}`,
      status: 'running',
      startTime: Date.now(),
      currentStep: 1,
      totalSteps: 5,
      progress: 20,
      variables: request.parameters || {},
      metadata: {
        triggeredBy: request.triggeredBy || 'manual',
        userId: request.userId,
        mode: 'workflow',
        timeout: request.timeout || 300000
      }
    };

    res.json({ success: true, execution });
  } catch (error) {
    console.error('Error executing workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/workflows/executions - Get workflow executions
router.get('/api/workflows/executions', async (req, res) => {
  try {
    const workflowManager = req.app.locals.workflowManager;
    if (!workflowManager) {
      return res.status(503).json({ error: 'Workflow manager not initialized' });
    }

    // In a full implementation, this would return actual executions
    // For now, return empty array
    const executions = [];

    res.json({ success: true, executions });
  } catch (error) {
    console.error('Error getting workflow executions:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/workflows/executions/:executionId/cancel - Cancel workflow execution
router.post('/api/workflows/executions/:executionId/cancel', async (req, res) => {
  try {
    const workflowManager = req.app.locals.workflowManager;
    if (!workflowManager) {
      return res.status(503).json({ error: 'Workflow manager not initialized' });
    }

    const { executionId } = req.params;
    
    // In a full implementation, this would cancel the actual execution
    // For now, return success
    res.json({ success: true, message: 'Workflow execution cancelled' });
  } catch (error) {
    console.error('Error cancelling workflow execution:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/workflows/stats - Get workflow statistics
router.get('/api/workflows/stats', async (req, res) => {
  try {
    const workflowManager = req.app.locals.workflowManager;
    if (!workflowManager) {
      return res.status(503).json({ error: 'Workflow manager not initialized' });
    }

    const stats = workflowManager.getStats();
    
    // Enhanced stats for web interface
    const enhancedStats = {
      totalTemplates: stats.localWorkflows + stats.globalWorkflows,
      categories: 5, // Mock data
      customTemplates: stats.localWorkflows,
      builtInTemplates: stats.globalWorkflows,
      averageSteps: 4.2, // Mock data
      activeExecutions: stats.activeWorkflows,
      totalExecutions: stats.historyEntries,
      successfulExecutions: Math.floor(stats.historyEntries * 0.85), // Mock data
      failedExecutions: Math.floor(stats.historyEntries * 0.1), // Mock data
      cancelledExecutions: Math.floor(stats.historyEntries * 0.05) // Mock data
    };

    res.json({ success: true, stats: enhancedStats });
  } catch (error) {
    console.error('Error getting workflow stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/workflows/templates/:templateId/toggle - Toggle workflow template enabled state
router.post('/api/workflows/templates/:templateId/toggle', async (req, res) => {
  try {
    const workflowManager = req.app.locals.workflowManager;
    if (!workflowManager) {
      return res.status(503).json({ error: 'Workflow manager not initialized' });
    }

    const { templateId } = req.params;
    const { enabled } = req.body;
    
    const templates = await workflowManager.getEnabledWorkflows();
    const template = templates.find(t => t.id === templateId);
    
    if (!template) {
      return res.status(404).json({ error: 'Workflow template not found' });
    }

    await workflowManager.toggleWorkflow(template.filePath, enabled, template.isGlobal);
    
    res.json({
      success: true,
      message: `Workflow template ${enabled ? 'enabled' : 'disabled'} successfully`
    });
  } catch (error) {
    console.error('Error toggling workflow template:', error);
    res.status(500).json({ error: error.message });
  }
});

// Direct workflow routes for frontend compatibility (without /api prefix)
// These routes mirror the /api/workflows/* routes above for frontend that expects /workflows/*

// GET /workflows/templates - Get all workflow templates (frontend compatibility)
router.get('/workflows/templates', async (req, res) => {
  try {
    const workflowTemplates = req.app.locals.workflowTemplates;
    console.log('DEBUG: workflowTemplates available:', !!workflowTemplates);
    
    if (!workflowTemplates) {
      console.log('DEBUG: Available app.locals keys:', Object.keys(req.app.locals));
      return res.status(503).json({ error: 'Workflow templates not initialized' });
    }

    console.log('DEBUG: Calling getAllTemplates()');
    const templates = workflowTemplates.getAllTemplates();
    console.log('DEBUG: Templates received:', templates?.length || 0);
    
    res.json({ success: true, templates });
  } catch (error) {
    console.error('Error getting workflow templates:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /workflows/executions - Get workflow executions (frontend compatibility)
router.get('/workflows/executions', async (req, res) => {
  try {
    const workflowManager = req.app.locals.workflowManager;
    if (!workflowManager) {
      return res.status(503).json({ error: 'Workflow manager not initialized' });
    }

    // In a full implementation, this would return actual executions
    // For now, return empty array
    const executions = [];

    res.json({ success: true, executions });
  } catch (error) {
    console.error('Error getting workflow executions:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /workflows/stats - Get workflow statistics (frontend compatibility)
router.get('/workflows/stats', async (req, res) => {
  try {
    const workflowManager = req.app.locals.workflowManager;
    if (!workflowManager) {
      return res.status(503).json({ error: 'Workflow manager not initialized' });
    }

    const stats = workflowManager.getStats();
    
    // Enhanced stats for web interface
    const enhancedStats = {
      totalTemplates: stats.localWorkflows + stats.globalWorkflows,
      categories: 5, // Mock data
      customTemplates: stats.localWorkflows,
      builtInTemplates: stats.globalWorkflows,
      averageSteps: 4.2, // Mock data
      activeExecutions: stats.activeWorkflows,
      totalExecutions: stats.historyEntries,
      successfulExecutions: Math.floor(stats.historyEntries * 0.85), // Mock data
      failedExecutions: Math.floor(stats.historyEntries * 0.1), // Mock data
      cancelledExecutions: Math.floor(stats.historyEntries * 0.05) // Mock data
    };

    res.json({ success: true, stats: enhancedStats });
  } catch (error) {
    console.error('Error getting workflow stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Settings Validation and Migration API Endpoints

// GET /api/settings/validation/health - Get comprehensive settings health status
router.get('/api/settings/validation/health', async (req, res) => {
  try {
    const settingsManager = req.app.locals.settingsManager;
    if (!settingsManager) {
      return res.status(503).json({ error: 'Settings manager not initialized' });
    }

    const healthStatus = await settingsManager.getSystemHealth();
    res.json({ success: true, health: healthStatus });
  } catch (error) {
    console.error('Error getting settings health:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/settings/validation/validate - Validate all settings
router.post('/api/settings/validation/validate', async (req, res) => {
  try {
    const settingsManager = req.app.locals.settingsManager;
    if (!settingsManager) {
      return res.status(503).json({ error: 'Settings manager not initialized' });
    }

    const options = req.body || {};
    const allSettings = await settingsManager.loadAllSettings();
    const validationResult = await settingsManager.validateSettings(allSettings, options);
    
    res.json({
      success: true,
      validation: validationResult,
      settings: options.includeSettings ? allSettings : undefined
    });
  } catch (error) {
    console.error('Error validating settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/settings/validation/validate/:section - Validate specific settings section
router.post('/api/settings/validation/validate/:section', async (req, res) => {
  try {
    const settingsManager = req.app.locals.settingsManager;
    if (!settingsManager) {
      return res.status(503).json({ error: 'Settings manager not initialized' });
    }

    const { section } = req.params;
    const { data, options = {} } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'Settings data is required for validation' });
    }

    const validationResult = await settingsManager.validateSettingsSection(section, data, options);
    res.json({ success: true, validation: validationResult });
  } catch (error) {
    console.error(`Error validating ${req.params.section} settings:`, error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/settings/migration/status - Get migration status and information
router.get('/api/settings/migration/status', async (req, res) => {
  try {
    const settingsManager = req.app.locals.settingsManager;
    if (!settingsManager) {
      return res.status(503).json({ error: 'Settings manager not initialized' });
    }

    const settingsMigrator = settingsManager.getSettingsMigrator();
    const allSettings = await settingsManager.loadAllSettings();
    const migrationCheck = await settingsMigrator.checkMigrationNeeded(allSettings);
    const migrationHistory = await settingsMigrator.getMigrationHistory(allSettings);
    
    res.json({
      success: true,
      migration: {
        ...migrationCheck,
        history: migrationHistory
      }
    });
  } catch (error) {
    console.error('Error getting migration status:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/settings/migration/execute - Execute settings migration
router.post('/api/settings/migration/execute', async (req, res) => {
  try {
    const settingsManager = req.app.locals.settingsManager;
    if (!settingsManager) {
      return res.status(503).json({ error: 'Settings manager not initialized' });
    }

    const options = req.body || {};
    const settingsMigrator = settingsManager.getSettingsMigrator();
    const allSettings = await settingsManager.loadAllSettings();
    
    // Execute migration with progress callback
    let progressData = [];
    const migrationResult = await settingsMigrator.executeMigration(allSettings, {
      ...options,
      progressCallback: (progress) => {
        progressData.push(progress);
      }
    });
    
    if (migrationResult.success) {
      // Save migrated settings
      await settingsManager.saveAllSettings(migrationResult.migratedData);
    }
    
    res.json({
      success: migrationResult.success,
      migration: migrationResult,
      progress: progressData
    });
  } catch (error) {
    console.error('Error executing migration:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/settings/migration/rollbacks - Get available rollback points
router.get('/api/settings/migration/rollbacks', async (req, res) => {
  try {
    const settingsManager = req.app.locals.settingsManager;
    if (!settingsManager) {
      return res.status(503).json({ error: 'Settings manager not initialized' });
    }

    const settingsMigrator = settingsManager.getSettingsMigrator();
    const rollbacks = await settingsMigrator.getAvailableRollbacks();
    
    res.json({ success: true, rollbacks });
  } catch (error) {
    console.error('Error getting available rollbacks:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/settings/migration/rollback - Rollback to a previous version
router.post('/api/settings/migration/rollback', async (req, res) => {
  try {
    const settingsManager = req.app.locals.settingsManager;
    if (!settingsManager) {
      return res.status(503).json({ error: 'Settings manager not initialized' });
    }

    const { backupPath } = req.body;
    if (!backupPath) {
      return res.status(400).json({ error: 'Backup path is required for rollback' });
    }

    const settingsMigrator = settingsManager.getSettingsMigrator();
    const rolledBackSettings = await settingsMigrator.rollbackMigration(backupPath);
    
    // Save rolled back settings
    await settingsManager.saveAllSettings(rolledBackSettings);
    
    res.json({ success: true, message: 'Settings rolled back successfully' });
  } catch (error) {
    console.error('Error executing rollback:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/settings/migration/backup - Create migration backup
router.post('/api/settings/migration/backup', async (req, res) => {
  try {
    const settingsManager = req.app.locals.settingsManager;
    if (!settingsManager) {
      return res.status(503).json({ error: 'Settings manager not initialized' });
    }

    const settingsMigrator = settingsManager.getSettingsMigrator();
    const allSettings = await settingsManager.loadAllSettings();
    const backupResult = await settingsMigrator.createMigrationBackup(allSettings);
    
    res.json({ success: true, backup: backupResult });
  } catch (error) {
    console.error('Error creating migration backup:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/settings/validation/schemas - Get validation schemas for all settings categories
router.get('/api/settings/validation/schemas', async (req, res) => {
  try {
    const settingsManager = req.app.locals.settingsManager;
    if (!settingsManager) {
      return res.status(503).json({ error: 'Settings manager not initialized' });
    }

    const settingsValidator = settingsManager.getSettingsValidator();
    const schemas = {
      provider: settingsValidator.validationRules.provider,
      global: settingsValidator.validationRules.global,
      advanced: settingsValidator.validationRules.advanced,
      mode: settingsValidator.validationRules.mode,
      mcp: settingsValidator.validationRules.mcp
    };
    
    res.json({ success: true, schemas });
  } catch (error) {
    console.error('Error getting validation schemas:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/settings/validation/analyze - Analyze settings for performance and security issues
router.post('/api/settings/validation/analyze', async (req, res) => {
  try {
    const settingsManager = req.app.locals.settingsManager;
    if (!settingsManager) {
      return res.status(503).json({ error: 'Settings manager not initialized' });
    }

    const { category, data } = req.body;
    if (!category || !data) {
      return res.status(400).json({ error: 'Category and data are required for analysis' });
    }

    const settingsValidator = settingsManager.getSettingsValidator();
    let analysisResult;
    
    switch (category) {
      case 'performance':
        analysisResult = settingsValidator.analyzePerformanceImpact(data);
        break;
      case 'security':
        analysisResult = settingsValidator.analyzeSecurityIssues(data);
        break;
      case 'dependencies':
        analysisResult = await settingsValidator.validateCrossCategoryDependencies(data);
        break;
      default:
        return res.status(400).json({ error: 'Invalid analysis category. Use: performance, security, or dependencies' });
    }
    
    res.json({ success: true, analysis: analysisResult });
  } catch (error) {
    console.error('Error analyzing settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/settings/validation/rules - Get all validation rules
router.get('/api/settings/validation/rules', async (req, res) => {
  try {
    const settingsManager = req.app.locals.settingsManager;
    if (!settingsManager) {
      return res.status(503).json({ error: 'Settings manager not initialized' });
    }

    const settingsValidator = settingsManager.getSettingsValidator();
    const rules = settingsValidator.validationRules;
    
    res.json({ success: true, rules });
  } catch (error) {
    console.error('Error getting validation rules:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/settings/validation/realtime - Perform real-time validation
router.post('/api/settings/validation/realtime', async (req, res) => {
  try {
    const settingsManager = req.app.locals.settingsManager;
    if (!settingsManager) {
      return res.status(503).json({ error: 'Settings manager not initialized' });
    }

    const { category, field, value, context = {} } = req.body;
    if (!category || !field) {
      return res.status(400).json({ error: 'Category and field are required for real-time validation' });
    }

    const settingsValidator = settingsManager.getSettingsValidator();
    const validationResult = await settingsValidator.validateField(category, field, value, context);
    
    res.json({ success: true, validation: validationResult });
  } catch (error) {
    console.error('Error performing real-time validation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Provider-specific validation endpoints
// GET /api/providers/:provider/validate - Validate specific provider configuration
router.get('/api/providers/:provider/validate', async (req, res) => {
  try {
    const { provider } = req.params;
    
    // Set proper JSON content type
    res.setHeader('Content-Type', 'application/json');
    
    // For claude-code provider
    if (provider === 'claude-code') {
      return res.json({
        success: true,
        valid: true,
        provider: 'claude-code',
        message: 'Claude Code provider configuration is valid',
        requirements: {
          claudeCodePath: 'Path to Claude Code CLI executable',
          apiKey: 'Anthropic API key (optional for validation)'
        },
        capabilities: {
          streaming: true,
          tools: true,
          images: true
        }
      });
    }
    
    // For virtual-quota-fallback provider
    if (provider === 'virtual-quota-fallback') {
      return res.json({
        success: true,
        valid: true,
        provider: 'virtual-quota-fallback',
        message: 'Virtual Quota Fallback provider configuration is valid',
        requirements: {
          profiles: 'Array of fallback provider profiles'
        },
        capabilities: {
          streaming: true,
          tools: true,
          fallback: true
        }
      });
    }
    
    // For any other provider, use the existing validation system
    if (!providerValidator) {
      return res.status(503).json({ error: 'Provider validator not initialized' });
    }

    const schema = providerValidator.getProviderSchema(provider);
    if (!schema) {
      return res.status(404).json({
        success: false,
        error: 'Provider not found',
        provider: provider
      });
    }

    res.json({
      success: true,
      valid: true,
      provider: provider,
      message: `${provider} provider configuration is valid`,
      schema: schema
    });
  } catch (error) {
    console.error(`Error validating provider ${req.params.provider}:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      provider: req.params.provider
    });
  }
});

// POST /api/providers/:provider/validate - Validate provider configuration with data
router.post('/api/providers/:provider/validate', async (req, res) => {
  try {
    const { provider } = req.params;
    const { config } = req.body;
    
    // Set proper JSON content type
    res.setHeader('Content-Type', 'application/json');
    
    // For claude-code provider
    if (provider === 'claude-code') {
      const validation = {
        isValid: true,
        errors: [],
        warnings: []
      };
      
      if (config) {
        if (!config.claudeCodePath || config.claudeCodePath.trim() === '') {
          validation.errors.push('Claude Code CLI path is required');
          validation.isValid = false;
        }
      }
      
      return res.json({
        success: true,
        validation: validation,
        provider: 'claude-code',
        message: validation.isValid ? 'Configuration is valid' : 'Configuration has errors'
      });
    }
    
    // For virtual-quota-fallback provider
    if (provider === 'virtual-quota-fallback') {
      const validation = {
        isValid: true,
        errors: [],
        warnings: []
      };
      
      if (config) {
        if (!config.profiles || !Array.isArray(config.profiles) || config.profiles.length === 0) {
          validation.errors.push('At least one fallback profile is required');
          validation.isValid = false;
        }
      }
      
      return res.json({
        success: true,
        validation: validation,
        provider: 'virtual-quota-fallback',
        message: validation.isValid ? 'Configuration is valid' : 'Configuration has errors'
      });
    }
    
    // For any other provider, use the existing validation system
    if (!providerValidator) {
      return res.status(503).json({ error: 'Provider validator not initialized' });
    }

    if (!config) {
      return res.status(400).json({ error: 'Provider configuration is required' });
    }

    const validation = providerValidator.validateProviderConfig(provider, config);
    const summary = providerValidator.getValidationSummary(provider, config);

    res.json({
      success: true,
      validation,
      summary,
      provider: provider
    });
  } catch (error) {
    console.error(`Error validating provider ${req.params.provider} config:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      provider: req.params.provider
    });
  }
});

// Push Notification API Endpoints

// Get VAPID public key for client subscription
router.get('/push/vapid-public-key', (req, res) => {
  try {
    const pushService = req.app.locals.pushService;
    if (!pushService) {
      return res.status(503).json({ error: 'Push service not available' });
    }
    
    const publicKey = pushService.getPublicKey();
    res.json({ success: true, publicKey });
  } catch (error) {
    console.error('Error getting VAPID public key:', error);
    res.status(500).json({ error: 'Failed to get VAPID public key' });
  }
});

// Subscribe to push notifications
router.post('/push/subscribe', (req, res) => {
  try {
    const pushService = req.app.locals.pushService;
    if (!pushService) {
      return res.status(503).json({ error: 'Push service not available' });
    }

    const { subscription, metadata = {} } = req.body;
    
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription data' });
    }

    // Add user agent and IP address to metadata
    metadata.userAgent = req.get('User-Agent');
    metadata.ipAddress = req.ip;
    metadata.subscribedAt = new Date().toISOString();

    pushService.subscribe(subscription, metadata)
      .then(subscriptionId => {
        res.json({
          success: true,
          subscriptionId,
          message: 'Successfully subscribed to push notifications'
        });
      })
      .catch(error => {
        console.error('Error subscribing to push notifications:', error);
        res.status(500).json({ error: 'Failed to subscribe to push notifications' });
      });
  } catch (error) {
    console.error('Error in push subscription endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unsubscribe from push notifications
router.post('/push/unsubscribe', (req, res) => {
  try {
    const pushService = req.app.locals.pushService;
    if (!pushService) {
      return res.status(503).json({ error: 'Push service not available' });
    }

    const { subscriptionId } = req.body;
    
    if (!subscriptionId) {
      return res.status(400).json({ error: 'Subscription ID is required' });
    }

    pushService.unsubscribe(subscriptionId)
      .then(success => {
        if (success) {
          res.json({
            success: true,
            message: 'Successfully unsubscribed from push notifications'
          });
        } else {
          res.status(404).json({ error: 'Subscription not found' });
        }
      })
      .catch(error => {
        console.error('Error unsubscribing from push notifications:', error);
        res.status(500).json({ error: 'Failed to unsubscribe from push notifications' });
      });
  } catch (error) {
    console.error('Error in push unsubscription endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send test notification (for development/testing)
router.post('/push/test', (req, res) => {
  try {
    const pushService = req.app.locals.pushService;
    if (!pushService) {
      return res.status(503).json({ error: 'Push service not available' });
    }

    const { title = 'Test Notification', body = 'This is a test notification from Kilo Web', userId } = req.body;
    
    const notification = {
      title,
      body,
      icon: '/icon-192x192.png',
      data: {
        type: 'test',
        timestamp: Date.now()
      }
    };

    const sendPromise = userId
      ? pushService.sendToUser(userId, notification)
      : pushService.broadcast(notification);

    sendPromise
      .then(results => {
        const successCount = results.filter(r => r.success).length;
        res.json({
          success: true,
          message: `Test notification sent to ${successCount} subscriptions`,
          results
        });
      })
      .catch(error => {
        console.error('Error sending test notification:', error);
        res.status(500).json({ error: 'Failed to send test notification' });
      });
  } catch (error) {
    console.error('Error in test notification endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get push notification service statistics
router.get('/push/stats', async (req, res) => {
  try {
    const pushService = req.app.locals.pushService;
    if (!pushService) {
      return res.status(503).json({ error: 'Push service not available' });
    }

    const stats = pushService.getStats();
    
    // Add log statistics if available
    if (pushService.logger) {
      try {
        const logStats = await pushService.logger.getLogStats();
        stats.logs = logStats;
      } catch (error) {
        console.error('Error getting log stats:', error);
      }
    }

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error getting push service stats:', error);
    res.status(500).json({ error: 'Failed to get push service statistics' });
  }
});

// Get recent push notification logs (for debugging)
router.get('/push/logs', async (req, res) => {
  try {
    const pushService = req.app.locals.pushService;
    if (!pushService || !pushService.logger) {
      return res.status(503).json({ error: 'Push service or logger not available' });
    }

    const lines = parseInt(req.query.lines) || 100;
    const logs = await pushService.logger.getRecentLogs(lines);
    
    res.json({
      success: true,
      logs,
      count: logs.length,
      requested: lines
    });
  } catch (error) {
    console.error('Error getting push notification logs:', error);
    res.status(500).json({ error: 'Failed to get push notification logs' });
  }
});

module.exports = router;