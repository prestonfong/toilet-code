import React, { useState, useEffect, useCallback, useRef } from 'react';
import './ComprehensiveSettings.css';
import {
  CheckCheck,
  SquareMousePointer,
  Webhook,
  GitBranch,
  Bell,
  Database,
  SquareTerminal,
  FlaskConical,
  Globe,
  Info,
  Server,
  MessageSquare,
  Monitor,
  X,
  ChevronRight,
  Settings
} from 'lucide-react';
import AdvancedModeManager from './AdvancedModeManager';
import MCPServerManager from './MCPServerManager';
import SettingsImportExport from './SettingsImportExport';
import PushNotificationManager from './PushNotificationManager';

// Types based on original kilo-code
interface ProviderSettings {
  provider?: string;
  model?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  baseUrl?: string;
  claudeCodePath?: string;
  claudeCodeMaxOutputTokens?: number;
}

interface ExtensionSettings {
  // Provider settings
  apiConfiguration?: ProviderSettings;
  currentApiConfigName?: string;
  
  // Auto-approve settings
  alwaysAllowReadOnly?: boolean;
  alwaysAllowReadOnlyOutsideWorkspace?: boolean;
  alwaysAllowWrite?: boolean;
  alwaysAllowWriteOutsideWorkspace?: boolean;
  alwaysAllowWriteProtected?: boolean;
  alwaysAllowExecute?: boolean;
  alwaysAllowBrowser?: boolean;
  alwaysAllowMcp?: boolean;
  alwaysAllowModeSwitch?: boolean;
  alwaysAllowSubtasks?: boolean;
  alwaysAllowFollowupQuestions?: boolean;
  alwaysAllowUpdateTodoList?: boolean;
  alwaysApproveResubmit?: boolean;
  allowedCommands?: string[];
  deniedCommands?: string[];
  allowedMaxRequests?: number;
  requestDelaySeconds?: number;
  followupAutoApproveTimeoutMs?: number;
  showAutoApproveMenu?: boolean;

  // Browser settings
  browserToolEnabled?: boolean;
  browserViewportSize?: string;
  screenshotQuality?: number;
  remoteBrowserHost?: string;
  remoteBrowserEnabled?: boolean;

  // Checkpoint settings
  enableCheckpoints?: boolean;
  diffEnabled?: boolean;

  // Display settings
  showTaskTimeline?: boolean;
  theme?: 'dark' | 'light' | 'auto';

  // Notification settings
  soundEnabled?: boolean;
  soundVolume?: number;
  ttsEnabled?: boolean;
  ttsSpeed?: number;
  systemNotificationsEnabled?: boolean;

  // Context management settings
  autoCondenseContext?: boolean;
  autoCondenseContextPercent?: number;
  maxOpenTabsContext?: number;
  maxWorkspaceFiles?: number;
  showRooIgnoredFiles?: boolean;
  maxReadFileLine?: number;
  maxConcurrentFileReads?: number;
  allowVeryLargeReads?: boolean;
  fuzzyMatchThreshold?: number;
  writeDelayMs?: number;
  includeDiagnosticMessages?: boolean;
  maxDiagnosticMessages?: number;

  // Terminal settings
  terminalOutputLineLimit?: number;
  terminalOutputCharacterLimit?: number;
  terminalCommandDelay?: number;
  terminalShellIntegrationTimeout?: number;
  terminalShellIntegrationDisabled?: boolean;
  terminalPowershellCounter?: boolean;
  terminalZshClearEolMark?: boolean;
  terminalZshOhMy?: boolean;
  terminalZshP10k?: boolean;
  terminalZdotdir?: boolean;
  terminalCompressProgressBar?: boolean;
  terminalCommandApiConfigId?: string;

  // Experimental settings
  experiments?: Record<string, boolean>;

  // Language settings
  language?: string;

  // MCP settings
  mcpEnabled?: boolean;

  // Custom prompts
  customSupportPrompts?: Record<string, string>;
  customCondensingPrompt?: string;
  condensingApiConfigId?: string;

  // Task Management settings
  taskHistoryEnabled?: boolean;
  taskAnalyticsEnabled?: boolean;
  maxTaskHistory?: number;
  taskArchiveDays?: number;
  workflowsEnabled?: boolean;
  autoWorkflowCreation?: boolean;
  workflowTimeout?: number;
  autoTaskCategorization?: boolean;
  autoTaskTagging?: boolean;
  anonymizeTaskData?: boolean;
  localTaskStorage?: boolean;
}

type SectionName =
  | 'providers'
  | 'autoApprove'
  | 'browser'
  | 'checkpoints'
  | 'display'
  | 'notifications'
  | 'contextManagement'
  | 'terminal'
  | 'prompts'
  | 'experimental'
  | 'language'
  | 'mcp'
  | 'advancedModes'
  | 'taskManagement'
  | 'importExport'
  | 'validation'
  | 'migration'
  | 'about';

interface ComprehensiveSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  targetSection?: string;
  webSocket?: WebSocket | null;
  isConnected?: boolean;
}

const ComprehensiveSettingsPanel: React.FC<ComprehensiveSettingsPanelProps> = ({
  isOpen,
  onClose,
  targetSection,
  webSocket,
  isConnected = false
}) => {
  // State management
  const [activeTab, setActiveTab] = useState<SectionName>(
    (targetSection && ['providers', 'autoApprove', 'browser', 'checkpoints', 'display', 'notifications', 'contextManagement', 'terminal', 'prompts', 'experimental', 'language', 'mcp', 'advancedModes', 'taskManagement', 'importExport', 'about'].includes(targetSection as SectionName))
      ? (targetSection as SectionName)
      : 'providers'
  );
  const [settings, setSettings] = useState<ExtensionSettings>({});
  const [isChangeDetected, setIsChangeDetected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [isCompactMode, setIsCompactMode] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const originalSettings = useRef<ExtensionSettings>({});

  // Section definitions with icons
  const sections = [
    { id: 'providers', icon: Webhook, label: 'Providers' },
    { id: 'autoApprove', icon: CheckCheck, label: 'Auto-Approve' },
    { id: 'browser', icon: SquareMousePointer, label: 'Browser' },
    { id: 'checkpoints', icon: GitBranch, label: 'Checkpoints' },
    { id: 'display', icon: Monitor, label: 'Display' },
    { id: 'notifications', icon: Bell, label: 'Notifications' },
    { id: 'contextManagement', icon: Database, label: 'Context Management' },
    { id: 'terminal', icon: SquareTerminal, label: 'Terminal' },
    { id: 'prompts', icon: MessageSquare, label: 'Prompts' },
    { id: 'experimental', icon: FlaskConical, label: 'Experimental' },
    { id: 'language', icon: Globe, label: 'Language' },
    { id: 'mcp', icon: Server, label: 'MCP' },
    { id: 'advancedModes', icon: Settings, label: 'Advanced Modes' },
    { id: 'taskManagement', icon: Database, label: 'Task Management' },
    { id: 'importExport', icon: Database, label: 'Import/Export' },
    { id: 'validation', icon: CheckCheck, label: 'Validation' },
    { id: 'migration', icon: GitBranch, label: 'Migration' },
    { id: 'about', icon: Info, label: 'About' }
  ] as const;

  // Load settings on mount
  useEffect(() => {
    if (isOpen) {
      loadAllSettings();
    }
  }, [isOpen]);

  // Set target section
  useEffect(() => {
    if (targetSection && sections.some(s => s.id === targetSection as SectionName)) {
      setActiveTab(targetSection as SectionName);
    }
  }, [targetSection]);

  // Detect changes
  useEffect(() => {
    setIsChangeDetected(JSON.stringify(settings) !== JSON.stringify(originalSettings.current));
  }, [settings]);

  // Setup resize observer for responsive design
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsCompactMode(entry.contentRect.width < 700);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const loadAllSettings = async () => {
    try {
      setLoading(true);
      
      // Load settings from backend API
      const response = await fetch('/api/settings/global');
      if (!response.ok) {
        throw new Error(`Failed to load settings: ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to load settings');
      }
      
      // Map backend settings to frontend format
      const backendSettings = data.settings || {};
      const mappedSettings: ExtensionSettings = {
        // Auto-approve settings
        alwaysAllowReadOnly: backendSettings.alwaysAllowReadOnly || false,
        alwaysAllowWrite: backendSettings.alwaysAllowWrite || false,
        alwaysAllowExecute: backendSettings.alwaysAllowExecute || false,
        alwaysAllowBrowser: backendSettings.alwaysAllowBrowser || false,
        alwaysAllowMcp: backendSettings.alwaysAllowMcp || false,
        alwaysAllowModeSwitch: backendSettings.alwaysAllowModeSwitch || false,
        alwaysAllowSubtasks: backendSettings.alwaysAllowSubtasks || false,
        alwaysAllowFollowupQuestions: backendSettings.alwaysAllowFollowupQuestions || false,
        alwaysAllowUpdateTodoList: backendSettings.alwaysAllowUpdateTodoList || false,
        alwaysApproveResubmit: backendSettings.alwaysApproveResubmit || false,
        allowedCommands: backendSettings.allowedCommands || [],
        deniedCommands: backendSettings.deniedCommands || [],
        allowedMaxRequests: backendSettings.allowedMaxRequests || 0,
        requestDelaySeconds: backendSettings.requestDelaySeconds || 0,
        followupAutoApproveTimeoutMs: backendSettings.followupAutoApproveTimeoutMs || 5000,
        showAutoApproveMenu: backendSettings.showAutoApproveMenu !== false,

        // Browser settings
        browserToolEnabled: backendSettings.browserToolEnabled !== false,
        browserViewportSize: backendSettings.browserViewportSize || '1280x720',
        screenshotQuality: backendSettings.screenshotQuality || 75,
        remoteBrowserHost: backendSettings.remoteBrowserHost || '',
        remoteBrowserEnabled: backendSettings.remoteBrowserEnabled || false,

        // Checkpoint settings
        enableCheckpoints: backendSettings.enableCheckpoints || false,
        diffEnabled: backendSettings.diffEnabled !== false,

        // Display settings
        showTaskTimeline: backendSettings.showTaskTimeline !== false,
        theme: backendSettings.theme || 'dark',

        // Notification settings
        soundEnabled: backendSettings.soundEnabled !== false,
        soundVolume: backendSettings.soundVolume || 0.5,
        ttsEnabled: backendSettings.ttsEnabled || false,
        ttsSpeed: backendSettings.ttsSpeed || 1.0,
        systemNotificationsEnabled: backendSettings.systemNotificationsEnabled !== false,

        // Context management settings
        autoCondenseContext: backendSettings.autoCondenseContext !== false,
        autoCondenseContextPercent: backendSettings.autoCondenseContextPercent || 50,
        maxOpenTabsContext: backendSettings.maxOpenTabsContext || 5,
        maxWorkspaceFiles: backendSettings.maxWorkspaceFiles || 200,
        showRooIgnoredFiles: backendSettings.showRooIgnoredFiles || false,
        maxReadFileLine: backendSettings.maxReadFileLine || 1000,
        maxConcurrentFileReads: backendSettings.maxConcurrentFileReads || 5,
        allowVeryLargeReads: backendSettings.allowVeryLargeReads || false,
        fuzzyMatchThreshold: backendSettings.fuzzyMatchThreshold || 1.0,
        writeDelayMs: backendSettings.writeDelayMs || 0,
        includeDiagnosticMessages: backendSettings.includeDiagnosticMessages !== false,
        maxDiagnosticMessages: backendSettings.maxDiagnosticMessages || 100,

        // Terminal settings
        terminalOutputLineLimit: backendSettings.terminalOutputLineLimit || 500,
        terminalOutputCharacterLimit: backendSettings.terminalOutputCharacterLimit || 50000,
        terminalCommandDelay: backendSettings.terminalCommandDelay || 0,
        terminalShellIntegrationTimeout: backendSettings.terminalShellIntegrationTimeout || 10000,
        terminalShellIntegrationDisabled: backendSettings.terminalShellIntegrationDisabled || false,
        terminalPowershellCounter: backendSettings.terminalPowershellCounter || false,
        terminalZshClearEolMark: backendSettings.terminalZshClearEolMark || false,
        terminalZshOhMy: backendSettings.terminalZshOhMy || false,
        terminalZshP10k: backendSettings.terminalZshP10k || false,
        terminalZdotdir: backendSettings.terminalZdotdir || false,
        terminalCompressProgressBar: backendSettings.terminalCompressProgressBar || false,
        terminalCommandApiConfigId: backendSettings.terminalCommandApiConfigId || '',

        // Experimental settings
        experiments: backendSettings.experiments || {},

        // Language settings
        language: backendSettings.language || 'en',

        // MCP settings
        mcpEnabled: backendSettings.mcpEnabled || false,

        // Custom prompts
        customSupportPrompts: backendSettings.customSupportPrompts || {},
        customCondensingPrompt: backendSettings.customCondensingPrompt || '',
        condensingApiConfigId: backendSettings.condensingApiConfigId || '',

        // Task Management settings
        taskHistoryEnabled: backendSettings.taskHistoryEnabled !== false,
        taskAnalyticsEnabled: backendSettings.taskAnalyticsEnabled !== false,
        maxTaskHistory: backendSettings.maxTaskHistory || 1000,
        taskArchiveDays: backendSettings.taskArchiveDays || 90,
        workflowsEnabled: backendSettings.workflowsEnabled !== false,
        autoWorkflowCreation: backendSettings.autoWorkflowCreation || false,
        workflowTimeout: backendSettings.workflowTimeout || 300,
        autoTaskCategorization: backendSettings.autoTaskCategorization !== false,
        autoTaskTagging: backendSettings.autoTaskTagging !== false,
        anonymizeTaskData: backendSettings.anonymizeTaskData || false,
        localTaskStorage: backendSettings.localTaskStorage !== false
      };
      
      setSettings(mappedSettings);
      originalSettings.current = { ...mappedSettings };
      
    } catch (error) {
      console.error('Error loading settings:', error);
      setMessage('Error loading settings from server');
      
      // Fallback to default settings if API fails
      const defaultSettings: ExtensionSettings = {
        alwaysAllowReadOnly: false,
        alwaysAllowWrite: false,
        alwaysAllowExecute: false,
        alwaysAllowBrowser: false,
        browserToolEnabled: true,
        browserViewportSize: '1280x720',
        screenshotQuality: 75,
        enableCheckpoints: false,
        diffEnabled: true,
        showTaskTimeline: true,
        soundEnabled: true,
        soundVolume: 0.5,
        ttsEnabled: false,
        ttsSpeed: 1.0,
        systemNotificationsEnabled: true,
        autoCondenseContext: true,
        autoCondenseContextPercent: 50,
        maxOpenTabsContext: 5,
        maxWorkspaceFiles: 200,
        maxReadFileLine: 1000,
        terminalOutputLineLimit: 500,
        terminalOutputCharacterLimit: 50000,
        language: 'en',
        mcpEnabled: false,
        experiments: {}
      };
      
      setSettings(defaultSettings);
      originalSettings.current = { ...defaultSettings };
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = useCallback(<K extends keyof ExtensionSettings>(
    key: K, 
    value: ExtensionSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSubmit = async () => {
    try {
      setSaving(true);
      
      // Save settings to backend API
      const response = await fetch('/api/settings/global', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          settings: settings
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save settings: ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to save settings');
      }
      
      originalSettings.current = { ...settings };
      setIsChangeDetected(false);
      setMessage('Settings saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage(`Error saving settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setSaving(false);
    }
  };

  const handleTabChange = (newTab: SectionName) => {
    if (isChangeDetected) {
      setShowDiscardDialog(true);
      // Store the target tab for after confirmation
      (window as any).pendingTabChange = newTab;
    } else {
      setActiveTab(newTab);
    }
  };

  const handleDiscardChanges = () => {
    setSettings({ ...originalSettings.current });
    setIsChangeDetected(false);
    setShowDiscardDialog(false);
    
    if ((window as any).pendingTabChange) {
      setActiveTab((window as any).pendingTabChange);
      (window as any).pendingTabChange = null;
    }
  };

  const handleCloseWithUnsavedCheck = () => {
    if (isChangeDetected) {
      setShowDiscardDialog(true);
      (window as any).pendingAction = 'close';
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="comprehensive-settings-overlay">
        <div ref={containerRef} className={`comprehensive-settings-modal ${isCompactMode ? 'compact' : ''}`}>
          {/* Header */}
          <div className="settings-header">
            <div className="header-content">
              <h2>Settings</h2>
            </div>
            <div className="header-actions">
              <button 
                className={`save-button ${!isChangeDetected || !isChangeDetected ? 'disabled' : ''}`}
                onClick={handleSubmit} 
                disabled={!isChangeDetected || saving}
                title={!isChangeDetected ? 'No changes to save' : 'Save changes'}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="close-button" onClick={handleCloseWithUnsavedCheck}>
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="settings-main">
            {/* Sidebar Navigation */}
            <div className={`settings-sidebar ${isCompactMode ? 'compact' : ''}`}>
              {sections.map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  className={`sidebar-tab ${activeTab === id ? 'active' : ''}`}
                  onClick={() => handleTabChange(id as SectionName)}
                  title={isCompactMode ? label : undefined}
                >
                  <Icon size={18} />
                  {!isCompactMode && <span className="tab-label">{label}</span>}
                  {!isCompactMode && <ChevronRight size={16} className="tab-arrow" />}
                </button>
              ))}
            </div>

            {/* Content Area */}
            <div className="settings-content-area">
              {loading ? (
                <div className="loading-state">Loading settings...</div>
              ) : (
                <>
                  {activeTab === 'providers' && (
                    <ProvidersSection settings={settings} updateSetting={updateSetting} />
                  )}
                  {activeTab === 'autoApprove' && (
                    <AutoApproveSection settings={settings} updateSetting={updateSetting} />
                  )}
                  {activeTab === 'browser' && (
                    <BrowserSection settings={settings} updateSetting={updateSetting} />
                  )}
                  {activeTab === 'checkpoints' && (
                    <CheckpointsSection settings={settings} updateSetting={updateSetting} />
                  )}
                  {activeTab === 'display' && (
                    <DisplaySection settings={settings} updateSetting={updateSetting} />
                  )}
                  {activeTab === 'notifications' && (
                    <NotificationsSection settings={settings} updateSetting={updateSetting} />
                  )}
                  {activeTab === 'contextManagement' && (
                    <ContextManagementSection settings={settings} updateSetting={updateSetting} />
                  )}
                  {activeTab === 'terminal' && (
                    <TerminalSection settings={settings} updateSetting={updateSetting} />
                  )}
                  {activeTab === 'prompts' && (
                    <PromptsSection settings={settings} updateSetting={updateSetting} />
                  )}
                  {activeTab === 'experimental' && (
                    <ExperimentalSection settings={settings} updateSetting={updateSetting} />
                  )}
                  {activeTab === 'language' && (
                    <LanguageSection settings={settings} updateSetting={updateSetting} />
                  )}
                  {activeTab === 'mcp' && (
                    <McpSection settings={settings} updateSetting={updateSetting} />
                  )}
                  {activeTab === 'advancedModes' && (
                    <AdvancedModeManager
                      webSocket={webSocket}
                      isConnected={isConnected}
                    />
                  )}
                  {activeTab === 'taskManagement' && (
                    <TaskManagementSection
                      settings={settings}
                      updateSetting={updateSetting}
                      webSocket={webSocket}
                      isConnected={isConnected}
                    />
                  )}
                  {activeTab === 'importExport' && (
                    <SettingsImportExport
                      webSocket={webSocket}
                      isConnected={isConnected}
                    />
                  )}
                  {activeTab === 'validation' && (
                    <ValidationSection
                      webSocket={webSocket}
                      isConnected={isConnected}
                    />
                  )}
                  {activeTab === 'migration' && (
                    <MigrationSection
                      webSocket={webSocket}
                      isConnected={isConnected}
                    />
                  )}
                  {activeTab === 'about' && (
                    <AboutSection />
                  )}
                </>
              )}
            </div>
          </div>

          {/* Footer */}
          {message && (
            <div className="settings-footer">
              <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
                {message}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Discard Changes Dialog */}
      {showDiscardDialog && (
        <div className="dialog-overlay">
          <div className="dialog-content">
            <h3>Unsaved Changes</h3>
            <p>You have unsaved changes. Do you want to discard them?</p>
            <div className="dialog-actions">
              <button onClick={() => setShowDiscardDialog(false)}>Cancel</button>
              <button onClick={handleDiscardChanges} className="danger">Discard</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Section Components (Basic implementations for now)
const SectionWrapper: React.FC<{ title: string; icon: React.ComponentType<any>; children: React.ReactNode }> = ({ 
  title, 
  icon: Icon, 
  children 
}) => (
  <div className="section-wrapper">
    <div className="section-header">
      <Icon size={20} />
      <h3>{title}</h3>
    </div>
    <div className="section-content">
      {children}
    </div>
  </div>
);

const ProvidersSection: React.FC<{ settings: ExtensionSettings; updateSetting: any }> = ({ settings, updateSetting }) => {
  const [exportData, setExportData] = React.useState<string>('');
  const [importData, setImportData] = React.useState<string>('');
  const [showExportDialog, setShowExportDialog] = React.useState(false);
  const [showImportDialog, setShowImportDialog] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [validationErrors, setValidationErrors] = React.useState<any[]>([]);
  const [validationWarnings, setValidationWarnings] = React.useState<any[]>([]);
  const [isValidating, setIsValidating] = React.useState(false);
  const [supportedProviders, setSupportedProviders] = React.useState<any[]>([]);
  const [modelSuggestions, setModelSuggestions] = React.useState<string[]>([]);
  const [isTestingConnection, setIsTestingConnection] = React.useState(false);

  // Load supported providers on mount
  React.useEffect(() => {
    loadSupportedProviders();
  }, []);

  // Validate configuration when provider or config changes
  React.useEffect(() => {
    if (settings.apiConfiguration?.provider && settings.apiConfiguration) {
      validateProviderConfig();
    }
  }, [settings.apiConfiguration]);

  // Load model suggestions when provider changes
  React.useEffect(() => {
    if (settings.apiConfiguration?.provider) {
      loadModelSuggestions();
    }
  }, [settings.apiConfiguration?.provider]);

  const loadSupportedProviders = async () => {
    try {
      const response = await fetch('/api/settings/providers/supported');
      if (response.ok) {
        const data = await response.json();
        setSupportedProviders(data.providers || []);
      }
    } catch (error) {
      console.error('Error loading supported providers:', error);
    }
  };

  const validateProviderConfig = async () => {
    if (!settings.apiConfiguration?.provider) return;

    try {
      setIsValidating(true);
      const response = await fetch('/api/settings/providers/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: settings.apiConfiguration.provider,
          config: settings.apiConfiguration
        })
      });

      if (response.ok) {
        const result = await response.json();
        setValidationErrors(result.validation.errors || []);
        setValidationWarnings(result.validation.warnings || []);
      }
    } catch (error) {
      console.error('Error validating provider config:', error);
    } finally {
      setIsValidating(false);
    }
  };

  const loadModelSuggestions = async () => {
    if (!settings.apiConfiguration?.provider) return;

    try {
      const response = await fetch(`/api/settings/providers/${settings.apiConfiguration.provider}/models/suggestions?useCase=general`);
      if (response.ok) {
        const data = await response.json();
        setModelSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error('Error loading model suggestions:', error);
    }
  };

  const handleProviderChange = async (newProvider: string) => {
    // Get autofill configuration for the new provider
    try {
      const response = await fetch('/api/settings/providers/autofill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: newProvider,
          existingConfig: settings.apiConfiguration || {},
          useCase: 'general'
        })
      });

      if (response.ok) {
        const data = await response.json();
        updateSetting('apiConfiguration', {
          ...data.config,
          provider: newProvider
        });
      } else {
        // Fallback: just update provider
        updateSetting('apiConfiguration', {
          ...settings.apiConfiguration,
          provider: newProvider
        });
      }
    } catch (error) {
      console.error('Error getting autofill config:', error);
      // Fallback: just update provider
      updateSetting('apiConfiguration', {
        ...settings.apiConfiguration,
        provider: newProvider
      });
    }
  };


  const testConnection = async () => {
    if (!settings.apiConfiguration?.provider || !settings.apiConfiguration) {
      setMessage('Please configure provider settings first');
      return;
    }

    try {
      setIsTestingConnection(true);
      const response = await fetch('/api/settings/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: settings.apiConfiguration.provider,
          config: settings.apiConfiguration
        })
      });

      const result = await response.json();
      if (result.success) {
        setMessage('✅ Connection test successful!');
      } else {
        setMessage(`❌ Connection test failed: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTestingConnection(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const handleExportSettings = async () => {
    try {
      const response = await fetch('/api/settings/providers/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error('Failed to export settings');
      }
      
      const result = await response.json();
      setExportData(JSON.stringify(result.exportData, null, 2));
      setShowExportDialog(true);
    } catch (error) {
      setMessage(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleImportSettings = async () => {
    try {
      if (!importData.trim()) {
        setMessage('Please enter import data');
        return;
      }

      const parsedData = JSON.parse(importData);
      const response = await fetch('/api/settings/providers/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importData: parsedData,
          options: { mergeMode: 'merge', skipApiKeys: true }
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to import settings');
      }
      
      setMessage('Settings imported successfully!');
      setShowImportDialog(false);
      setImportData('');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(exportData);
    setMessage('Copied to clipboard!');
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <SectionWrapper title="Providers" icon={Webhook}>
      <div className="setting-group">
        <label>Current API Configuration</label>
        <input
          type="text"
          value={settings.currentApiConfigName || ''}
          onChange={(e) => updateSetting('currentApiConfigName', e.target.value)}
          placeholder="Enter configuration name"
        />
      </div>
      <div className="setting-group">
        <label>Provider</label>
        <select
          value={settings.apiConfiguration?.provider || 'anthropic'}
          onChange={(e) => handleProviderChange(e.target.value)}
        >
          {supportedProviders.length > 0 ? (
            supportedProviders.map(provider => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))
          ) : (
            <>
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
              <option value="claude-code">Claude Code</option>
              <option value="virtual-quota-fallback">Virtual Quota Fallback</option>
              <option value="fireworks">Fireworks AI</option>
              <option value="cerebras">Cerebras</option>
              <option value="gemini-cli">Gemini CLI</option>
              <option value="xai">xAI (Grok)</option>
              <option value="groq">Groq</option>
              <option value="huggingface">Hugging Face</option>
            </>
          )}
        </select>
        {isValidating && <small>Validating configuration...</small>}
      </div>
      <div className="setting-group">
        <label>API Key</label>
        <input
          type="password"
          value={settings.apiConfiguration?.apiKey || ''}
          onChange={(e) => updateSetting('apiConfiguration', { ...settings.apiConfiguration, apiKey: e.target.value })}
          placeholder="Enter API key"
          className={validationErrors.some(e => e.field === 'apiKey') ? 'error' : ''}
        />
        {validationErrors.filter(e => e.field === 'apiKey').map((error, idx) => (
          <small key={idx} className="error-message">
            {error.message}
            {error.suggestion && <span className="suggestion"> - {error.suggestion}</span>}
          </small>
        ))}
        {validationWarnings.filter(e => e.field === 'apiKey').map((warning, idx) => (
          <small key={idx} className="warning-message">⚠️ {warning.message}</small>
        ))}
      </div>
      <div className="setting-group">
        <label>Model</label>
        <select
          value={settings.apiConfiguration?.model || ''}
          onChange={(e) => updateSetting('apiConfiguration', { ...settings.apiConfiguration, model: e.target.value })}
          className={validationErrors.some(e => e.field === 'model') ? 'error' : ''}
        >
          <option value="">Select model</option>
          {modelSuggestions.map(model => (
            <option key={model} value={model}>{model}</option>
          ))}
        </select>
        {validationErrors.filter(e => e.field === 'model').map((error, idx) => (
          <small key={idx} className="error-message">{error.message}</small>
        ))}
        {validationWarnings.filter(e => e.field === 'model').map((warning, idx) => (
          <small key={idx} className="warning-message">⚠️ {warning.message}</small>
        ))}
      </div>
      <div className="setting-group">
        <label>Temperature ({settings.apiConfiguration?.temperature || 0.7})</label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={settings.apiConfiguration?.temperature || 0.7}
          onChange={(e) => updateSetting('apiConfiguration', { ...settings.apiConfiguration, temperature: parseFloat(e.target.value) })}
          className={validationErrors.some(e => e.field === 'temperature') ? 'error' : ''}
        />
        {validationErrors.filter(e => e.field === 'temperature').map((error, idx) => (
          <small key={idx} className="error-message">{error.message}</small>
        ))}
        {validationWarnings.filter(e => e.field === 'temperature').map((warning, idx) => (
          <small key={idx} className="warning-message">⚠️ {warning.message}</small>
        ))}
      </div>
      
      <div className="setting-group">
        <label>Max Tokens</label>
        <input
          type="number"
          min="1"
          max="200000"
          value={settings.apiConfiguration?.maxTokens || 4096}
          onChange={(e) => updateSetting('apiConfiguration', { ...settings.apiConfiguration, maxTokens: parseInt(e.target.value) })}
          className={validationErrors.some(e => e.field === 'maxTokens') ? 'error' : ''}
        />
        {validationErrors.filter(e => e.field === 'maxTokens').map((error, idx) => (
          <small key={idx} className="error-message">{error.message}</small>
        ))}
        {validationWarnings.filter(e => e.field === 'maxTokens').map((warning, idx) => (
          <small key={idx} className="warning-message">⚠️ {warning.message}</small>
        ))}
      </div>

      {/* Connection Test */}
      <div className="setting-group">
        <button
          onClick={testConnection}
          disabled={isTestingConnection || !settings.apiConfiguration?.apiKey}
          className="secondary"
        >
          {isTestingConnection ? 'Testing...' : 'Test Connection'}
        </button>
      </div>

      {/* Validation Summary */}
      {(validationErrors.length > 0 || validationWarnings.length > 0) && (
        <div className="validation-summary">
          {validationErrors.length > 0 && (
            <div className="validation-errors">
              <h5>❌ Configuration Issues ({validationErrors.length})</h5>
              <ul>
                {validationErrors.map((error, idx) => (
                  <li key={idx}>{error.field}: {error.message}</li>
                ))}
              </ul>
            </div>
          )}
          {validationWarnings.length > 0 && (
            <div className="validation-warnings">
              <h5>⚠️ Warnings ({validationWarnings.length})</h5>
              <ul>
                {validationWarnings.map((warning, idx) => (
                  <li key={idx}>{warning.field}: {warning.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      
      {/* Claude Code specific settings */}
      {settings.apiConfiguration?.provider === 'claude-code' && (
        <>
          <div className="setting-group">
            <label>Claude CLI Path</label>
            <input
              type="text"
              value={settings.apiConfiguration?.claudeCodePath || ''}
              onChange={(e) => updateSetting('apiConfiguration', { ...settings.apiConfiguration, claudeCodePath: e.target.value })}
              placeholder="Path to Claude CLI executable"
            />
            <small>Path to the Claude CLI executable (e.g., /usr/local/bin/claude or C:\Program Files\Claude\claude.exe)</small>
          </div>
          <div className="setting-group">
            <label>Max Output Tokens</label>
            <input
              type="number"
              min="1"
              max="200000"
              value={settings.apiConfiguration?.claudeCodeMaxOutputTokens || 4096}
              onChange={(e) => updateSetting('apiConfiguration', { ...settings.apiConfiguration, claudeCodeMaxOutputTokens: parseInt(e.target.value) })}
              placeholder="Maximum output tokens"
            />
            <small>Maximum number of tokens for Claude Code output (1-200000)</small>
          </div>
        </>
      )}

      {/* Import/Export Section */}
      <div className="setting-group">
        <h4>Import/Export Provider Settings</h4>
        <div className="button-group">
          <button onClick={handleExportSettings} className="secondary">
            Export Settings
          </button>
          <button onClick={() => setShowImportDialog(true)} className="secondary">
            Import Settings
          </button>
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`message ${message.includes('failed') || message.includes('Import failed') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      {/* Export Dialog */}
      {showExportDialog && (
        <div className="dialog-overlay">
          <div className="dialog-content">
            <h3>Export Provider Settings</h3>
            <p>Copy the settings below and save them to a file:</p>
            <textarea
              value={exportData}
              readOnly
              rows={10}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: '12px' }}
            />
            <div className="dialog-actions">
              <button onClick={copyToClipboard}>Copy to Clipboard</button>
              <button onClick={() => setShowExportDialog(false)} className="primary">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Dialog */}
      {showImportDialog && (
        <div className="dialog-overlay">
          <div className="dialog-content">
            <h3>Import Provider Settings</h3>
            <p>Paste your exported settings JSON below:</p>
            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder="Paste exported settings JSON here..."
              rows={10}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: '12px' }}
            />
            <div className="dialog-actions">
              <button onClick={() => setShowImportDialog(false)}>Cancel</button>
              <button onClick={handleImportSettings} className="primary">Import</button>
            </div>
          </div>
        </div>
      )}
    </SectionWrapper>
  );
};

const AutoApproveSection: React.FC<{ settings: ExtensionSettings; updateSetting: any }> = ({ settings, updateSetting }) => (
  <SectionWrapper title="Auto-Approve" icon={CheckCheck}>
    <div className="checkbox-group">
      <label>
        <input 
          type="checkbox" 
          checked={settings.alwaysAllowReadOnly || false} 
          onChange={(e) => updateSetting('alwaysAllowReadOnly', e.target.checked)}
        />
        Always allow read-only operations
      </label>
    </div>
    <div className="checkbox-group">
      <label>
        <input 
          type="checkbox" 
          checked={settings.alwaysAllowWrite || false} 
          onChange={(e) => updateSetting('alwaysAllowWrite', e.target.checked)}
        />
        Always allow write operations
      </label>
    </div>
    <div className="checkbox-group">
      <label>
        <input 
          type="checkbox" 
          checked={settings.alwaysAllowExecute || false} 
          onChange={(e) => updateSetting('alwaysAllowExecute', e.target.checked)}
        />
        Always allow command execution
      </label>
    </div>
    <div className="checkbox-group">
      <label>
        <input 
          type="checkbox" 
          checked={settings.alwaysAllowBrowser || false} 
          onChange={(e) => updateSetting('alwaysAllowBrowser', e.target.checked)}
        />
        Always allow browser operations
      </label>
    </div>
    <div className="setting-group">
      <label>Request Delay (seconds)</label>
      <input 
        type="number" 
        min="0" 
        max="10" 
        value={settings.requestDelaySeconds || 0} 
        onChange={(e) => updateSetting('requestDelaySeconds', parseInt(e.target.value))}
      />
    </div>
  </SectionWrapper>
);

const BrowserSection: React.FC<{ settings: ExtensionSettings; updateSetting: any }> = ({ settings, updateSetting }) => (
  <SectionWrapper title="Browser" icon={SquareMousePointer}>
    <div className="checkbox-group">
      <label>
        <input 
          type="checkbox" 
          checked={settings.browserToolEnabled || false} 
          onChange={(e) => updateSetting('browserToolEnabled', e.target.checked)}
        />
        Enable browser tool
      </label>
    </div>
    <div className="setting-group">
      <label>Viewport Size</label>
      <select 
        value={settings.browserViewportSize || '1280x720'} 
        onChange={(e) => updateSetting('browserViewportSize', e.target.value)}
      >
        <option value="1920x1080">1920x1080</option>
        <option value="1280x720">1280x720</option>
        <option value="1024x768">1024x768</option>
        <option value="800x600">800x600</option>
      </select>
    </div>
    <div className="setting-group">
      <label>Screenshot Quality ({settings.screenshotQuality || 75}%)</label>
      <input 
        type="range" 
        min="10" 
        max="100" 
        value={settings.screenshotQuality || 75} 
        onChange={(e) => updateSetting('screenshotQuality', parseInt(e.target.value))}
      />
    </div>
  </SectionWrapper>
);

const CheckpointsSection: React.FC<{ settings: ExtensionSettings; updateSetting: any }> = ({ settings, updateSetting }) => (
  <SectionWrapper title="Checkpoints" icon={GitBranch}>
    <div className="checkbox-group">
      <label>
        <input 
          type="checkbox" 
          checked={settings.enableCheckpoints || false} 
          onChange={(e) => updateSetting('enableCheckpoints', e.target.checked)}
        />
        Enable checkpoints
      </label>
    </div>
    <div className="checkbox-group">
      <label>
        <input 
          type="checkbox" 
          checked={settings.diffEnabled || false} 
          onChange={(e) => updateSetting('diffEnabled', e.target.checked)}
        />
        Enable diff display
      </label>
    </div>
  </SectionWrapper>
);

const DisplaySection: React.FC<{ settings: ExtensionSettings; updateSetting: any }> = ({ settings, updateSetting }) => (
  <SectionWrapper title="Display" icon={Monitor}>
    <div className="checkbox-group">
      <label>
        <input 
          type="checkbox" 
          checked={settings.showTaskTimeline || false} 
          onChange={(e) => updateSetting('showTaskTimeline', e.target.checked)}
        />
        Show task timeline
      </label>
    </div>
    <div className="setting-group">
      <label>Theme</label>
      <select 
        value={settings.theme || 'dark'} 
        onChange={(e) => updateSetting('theme', e.target.value as 'dark' | 'light' | 'auto')}
      >
        <option value="dark">Dark</option>
        <option value="light">Light</option>
        <option value="auto">Auto</option>
      </select>
    </div>
  </SectionWrapper>
);

const NotificationsSection: React.FC<{ settings: ExtensionSettings; updateSetting: any }> = ({ settings, updateSetting }) => {
  const [showPushNotifications, setShowPushNotifications] = React.useState(false);

  return (
    <SectionWrapper title="Notifications" icon={Bell}>
      {/* Push Notifications */}
      <div className="setting-group">
        <h4>Push Notifications</h4>
        <p>Receive notifications when tasks complete or errors occur, even when the app is not active.</p>
        
        <div className="button-group">
          <button
            onClick={() => setShowPushNotifications(true)}
            className="secondary"
          >
            📱 Manage Push Notifications
          </button>
        </div>

        {showPushNotifications && (
          <div className="modal-overlay">
            <div className="modal-content push-notification-modal">
              <PushNotificationManager onClose={() => setShowPushNotifications(false)} />
            </div>
          </div>
        )}
      </div>

      {/* Sound Notifications */}
      <div className="setting-group">
        <h4>Sound & Audio</h4>
        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={settings.soundEnabled || false}
              onChange={(e) => updateSetting('soundEnabled', e.target.checked)}
            />
            Enable sound notifications
          </label>
        </div>
        <div className="setting-group">
          <label>Sound Volume ({Math.round((settings.soundVolume || 0.5) * 100)}%)</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={settings.soundVolume || 0.5}
            onChange={(e) => updateSetting('soundVolume', parseFloat(e.target.value))}
          />
        </div>
        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={settings.ttsEnabled || false}
              onChange={(e) => updateSetting('ttsEnabled', e.target.checked)}
            />
            Enable text-to-speech
          </label>
        </div>
        <div className="setting-group">
          <label>TTS Speed ({settings.ttsSpeed || 1.0}x)</label>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={settings.ttsSpeed || 1.0}
            onChange={(e) => updateSetting('ttsSpeed', parseFloat(e.target.value))}
          />
        </div>
      </div>

      {/* System Notifications */}
      <div className="setting-group">
        <h4>System Integration</h4>
        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={settings.systemNotificationsEnabled !== false}
              onChange={(e) => updateSetting('systemNotificationsEnabled', e.target.checked)}
            />
            Enable system notifications
          </label>
        </div>
        <small>Uses your operating system's notification system for alerts and updates.</small>
      </div>
    </SectionWrapper>
  );
};

const ContextManagementSection: React.FC<{ settings: ExtensionSettings; updateSetting: any }> = ({ settings, updateSetting }) => (
  <SectionWrapper title="Context Management" icon={Database}>
    <div className="checkbox-group">
      <label>
        <input 
          type="checkbox" 
          checked={settings.autoCondenseContext || false} 
          onChange={(e) => updateSetting('autoCondenseContext', e.target.checked)}
        />
        Auto-condense context
      </label>
    </div>
    <div className="setting-group">
      <label>Max Open Tabs in Context</label>
      <input 
        type="number" 
        min="1" 
        max="20" 
        value={settings.maxOpenTabsContext || 5} 
        onChange={(e) => updateSetting('maxOpenTabsContext', parseInt(e.target.value))}
      />
    </div>
    <div className="setting-group">
      <label>Max Workspace Files</label>
      <input 
        type="number" 
        min="50" 
        max="1000" 
        value={settings.maxWorkspaceFiles || 200} 
        onChange={(e) => updateSetting('maxWorkspaceFiles', parseInt(e.target.value))}
      />
    </div>
    <div className="setting-group">
      <label>Max Read File Lines</label>
      <input 
        type="number" 
        min="100" 
        max="10000" 
        value={settings.maxReadFileLine || 1000} 
        onChange={(e) => updateSetting('maxReadFileLine', parseInt(e.target.value))}
      />
    </div>
  </SectionWrapper>
);

const TerminalSection: React.FC<{ settings: ExtensionSettings; updateSetting: any }> = ({ settings, updateSetting }) => (
  <SectionWrapper title="Terminal" icon={SquareTerminal}>
    <div className="setting-group">
      <label>Output Line Limit</label>
      <input 
        type="number" 
        min="100" 
        max="5000" 
        value={settings.terminalOutputLineLimit || 500} 
        onChange={(e) => updateSetting('terminalOutputLineLimit', parseInt(e.target.value))}
      />
    </div>
    <div className="setting-group">
      <label>Output Character Limit</label>
      <input 
        type="number" 
        min="1000" 
        max="200000" 
        value={settings.terminalOutputCharacterLimit || 50000} 
        onChange={(e) => updateSetting('terminalOutputCharacterLimit', parseInt(e.target.value))}
      />
    </div>
    <div className="setting-group">
      <label>Command Delay (ms)</label>
      <input 
        type="number" 
        min="0" 
        max="5000" 
        value={settings.terminalCommandDelay || 0} 
        onChange={(e) => updateSetting('terminalCommandDelay', parseInt(e.target.value))}
      />
    </div>
  </SectionWrapper>
);

const PromptsSection: React.FC<{ settings: ExtensionSettings; updateSetting: any }> = ({ settings, updateSetting }) => (
  <SectionWrapper title="Prompts" icon={MessageSquare}>
    <div className="setting-group">
      <label>Custom Condensing Prompt</label>
      <textarea 
        value={settings.customCondensingPrompt || ''} 
        onChange={(e) => updateSetting('customCondensingPrompt', e.target.value)}
        placeholder="Enter custom condensing prompt..."
        rows={4}
      />
    </div>
    <p>Custom support prompts can be configured here for different scenarios.</p>
  </SectionWrapper>
);

const ExperimentalSection: React.FC<{ settings: ExtensionSettings; updateSetting: any }> = ({ settings, updateSetting }) => (
  <SectionWrapper title="Experimental" icon={FlaskConical}>
    <p>Experimental features are disabled by default and may be unstable.</p>
    <div className="checkbox-group">
      <label>
        <input 
          type="checkbox" 
          checked={settings.experiments?.['feature1'] || false} 
          onChange={(e) => updateSetting('experiments', { ...settings.experiments, feature1: e.target.checked })}
        />
        Example Feature 1
      </label>
    </div>
  </SectionWrapper>
);

const LanguageSection: React.FC<{ settings: ExtensionSettings; updateSetting: any }> = ({ settings, updateSetting }) => (
  <SectionWrapper title="Language" icon={Globe}>
    <div className="setting-group">
      <label>Interface Language</label>
      <select 
        value={settings.language || 'en'} 
        onChange={(e) => updateSetting('language', e.target.value)}
      >
        <option value="en">English</option>
        <option value="es">Spanish</option>
        <option value="fr">French</option>
        <option value="de">German</option>
        <option value="ja">Japanese</option>
        <option value="zh">Chinese</option>
      </select>
    </div>
  </SectionWrapper>
);

const McpSection: React.FC<{ settings: ExtensionSettings; updateSetting: any }> = ({ settings, updateSetting }) => {
  const [mcpStats, setMcpStats] = React.useState<any>({});
  const [mcpServers, setMcpServers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showMCPManager, setShowMCPManager] = React.useState(false);

  // Load MCP data on mount
  React.useEffect(() => {
    if (settings.mcpEnabled) {
      loadMCPData();
    }
  }, [settings.mcpEnabled]);

  const loadMCPData = async () => {
    try {
      setLoading(true);
      
      // Load stats and servers in parallel
      const [statsResponse, serversResponse] = await Promise.all([
        fetch('/api/mcp/stats'),
        fetch('/api/mcp/servers')
      ]);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setMcpStats(statsData.stats || {});
      }

      if (serversResponse.ok) {
        const serversData = await serversResponse.json();
        setMcpServers(serversData.servers || []);
      }
    } catch (error) {
      console.error('Error loading MCP data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openMCPManager = () => {
    setShowMCPManager(true);
  };

  return (
    <SectionWrapper title="MCP (Model Context Protocol)" icon={Server}>
      <div className="checkbox-group">
        <label>
          <input
            type="checkbox"
            checked={settings.mcpEnabled || false}
            onChange={(e) => updateSetting('mcpEnabled', e.target.checked)}
          />
          Enable Model Context Protocol
        </label>
      </div>
      
      <div className="setting-group">
        <p>Model Context Protocol allows integration with external services and tools through standardized server connections.</p>
      </div>

      {settings.mcpEnabled && (
        <>
          {/* MCP Status Overview */}
          <div className="setting-group">
            <h5>Server Status</h5>
            {loading ? (
              <div>Loading MCP data...</div>
            ) : (
              <div className="mcp-status-grid">
                <div className="mcp-status-item">
                  <strong>{mcpStats.connectedServers || 0}/{mcpStats.totalServers || 0}</strong>
                  <span>Connected Servers</span>
                </div>
                <div className="mcp-status-item">
                  <strong>{mcpStats.totalTools || 0}</strong>
                  <span>Available Tools</span>
                </div>
                <div className="mcp-status-item">
                  <strong>{mcpStats.totalResources || 0}</strong>
                  <span>Resources</span>
                </div>
                <div className="mcp-status-item">
                  <strong>{Math.round(mcpStats.averageResponseTime || 0)}ms</strong>
                  <span>Avg Response</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Server List */}
          {mcpServers.length > 0 && (
            <div className="setting-group">
              <h5>Configured Servers ({mcpServers.length})</h5>
              <div className="mcp-server-list">
                {mcpServers.slice(0, 5).map(server => (
                  <div key={server.id} className="mcp-server-item">
                    <div className="server-info">
                      <span className="server-name">{server.name}</span>
                      <span className={`server-status ${server.enabled ? 'enabled' : 'disabled'}`}>
                        {server.enabled ? '●' : '○'}
                      </span>
                    </div>
                    <span className="server-type">{server.type?.toUpperCase()}</span>
                  </div>
                ))}
                {mcpServers.length > 5 && (
                  <div className="mcp-server-item more">
                    <span>+{mcpServers.length - 5} more servers...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Built-in Server Suggestions */}
          <div className="setting-group">
            <h5>Popular MCP Servers</h5>
            <div className="mcp-builtin-servers">
              <div className="builtin-server">
                <strong>Weather Server</strong> - Weather data and forecasts
              </div>
              <div className="builtin-server">
                <strong>File System Server</strong> - File operations and management
              </div>
              <div className="builtin-server">
                <strong>Git Server</strong> - Version control operations
              </div>
              <div className="builtin-server">
                <strong>Web Search Server</strong> - Web content extraction
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="setting-group">
            <div className="button-group">
              <button
                onClick={openMCPManager}
                className="primary"
              >
                Manage MCP Servers
              </button>
              <button
                onClick={loadMCPData}
                className="secondary"
                disabled={loading}
              >
                {loading ? 'Refreshing...' : 'Refresh Status'}
              </button>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="setting-group">
            <h5>Advanced Settings</h5>
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={settings.alwaysAllowMcp || false}
                  onChange={(e) => updateSetting('alwaysAllowMcp', e.target.checked)}
                />
                Auto-approve MCP tool usage
              </label>
            </div>
          </div>
        </>
      )}

      {/* MCP Manager Modal */}
      {showMCPManager && (
        <div className="modal-overlay">
          <div className="modal-content mcp-manager-modal">
            <MCPServerManager onClose={() => setShowMCPManager(false)} />
          </div>
        </div>
      )}
    </SectionWrapper>
  );
};

const AboutSection: React.FC = () => (
  <SectionWrapper title="About" icon={Info}>
    <div className="about-content">
      <h4>Kilo Code</h4>
      <p>Version: 1.0.0</p>
      <p>A comprehensive AI-powered coding assistant.</p>
      
      <div className="setting-group">
        <h5>Telemetry</h5>
        <div className="checkbox-group">
          <label>
            <input type="checkbox" defaultChecked />
            Enable telemetry to help improve the product
          </label>
        </div>
      </div>
    </div>
  </SectionWrapper>
);

const TaskManagementSection: React.FC<{
  settings: ExtensionSettings;
  updateSetting: any;
  webSocket?: WebSocket | null;
  isConnected?: boolean;
}> = ({ settings, updateSetting }) => {
  const [taskStats, setTaskStats] = React.useState<any>({});
  const [workflowStats, setWorkflowStats] = React.useState<any>({});
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');

  // Load statistics on mount
  React.useEffect(() => {
    loadTaskStatistics();
    loadWorkflowStatistics();
  }, []);

  const loadTaskStatistics = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/task-history/statistics');
      if (response.ok) {
        const data = await response.json();
        setTaskStats(data.statistics || {});
      }
    } catch (error) {
      console.error('Error loading task statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWorkflowStatistics = async () => {
    try {
      const response = await fetch('/api/workflows/stats');
      if (response.ok) {
        const data = await response.json();
        setWorkflowStats(data.stats || {});
      }
    } catch (error) {
      console.error('Error loading workflow statistics:', error);
    }
  };

  const handleClearTaskHistory = async () => {
    if (!window.confirm('Are you sure you want to clear all task history? This action cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      // This would need to be implemented in the API
      setMessage('Task history clearing functionality not yet implemented');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Error clearing task history');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleExportTaskHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/task-history/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: 'json',
          filters: {}
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `task-history-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        setMessage('Task history exported successfully!');
      } else {
        throw new Error('Export failed');
      }
    } catch (error) {
      setMessage('Error exporting task history');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <SectionWrapper title="Task Management" icon={Database}>
      {/* Task History Settings */}
      <div className="setting-group">
        <h4>Task History & Analytics</h4>
        <p>Automatic tracking of AI assistant interactions and task execution.</p>
        
        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={settings.taskHistoryEnabled !== false}
              onChange={(e) => updateSetting('taskHistoryEnabled', e.target.checked)}
            />
            Enable automatic task history tracking
          </label>
        </div>

        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={settings.taskAnalyticsEnabled !== false}
              onChange={(e) => updateSetting('taskAnalyticsEnabled', e.target.checked)}
            />
            Enable task analytics and insights
          </label>
        </div>

        <div className="setting-group">
          <label>Maximum tasks to keep in history</label>
          <input
            type="number"
            min="100"
            max="10000"
            value={settings.maxTaskHistory || 1000}
            onChange={(e) => updateSetting('maxTaskHistory', parseInt(e.target.value))}
          />
          <small>Older tasks will be automatically archived</small>
        </div>

        <div className="setting-group">
          <label>Auto-archive tasks after (days)</label>
          <input
            type="number"
            min="7"
            max="365"
            value={settings.taskArchiveDays || 90}
            onChange={(e) => updateSetting('taskArchiveDays', parseInt(e.target.value))}
          />
        </div>
      </div>

      {/* Current Statistics */}
      <div className="setting-group">
        <h4>Current Statistics</h4>
        {loading ? (
          <p>Loading statistics...</p>
        ) : (
          <div className="task-stats-grid">
            <div className="stat-item">
              <strong>{taskStats.total || 0}</strong>
              <span>Total Tasks</span>
            </div>
            <div className="stat-item">
              <strong>{taskStats.totalMessages || 0}</strong>
              <span>Messages</span>
            </div>
            <div className="stat-item">
              <strong>{Math.round((taskStats.completionRate || 0) * 100)}%</strong>
              <span>Success Rate</span>
            </div>
            <div className="stat-item">
              <strong>{workflowStats.totalTemplates || 0}</strong>
              <span>Workflows</span>
            </div>
          </div>
        )}
      </div>

      {/* Workflow Management Settings */}
      <div className="setting-group">
        <h4>Workflow Management</h4>
        
        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={settings.workflowsEnabled !== false}
              onChange={(e) => updateSetting('workflowsEnabled', e.target.checked)}
            />
            Enable workflow templates and automation
          </label>
        </div>

        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={settings.autoWorkflowCreation || false}
              onChange={(e) => updateSetting('autoWorkflowCreation', e.target.checked)}
            />
            Automatically suggest workflows from successful task patterns
          </label>
        </div>

        <div className="setting-group">
          <label>Workflow execution timeout (seconds)</label>
          <input
            type="number"
            min="30"
            max="3600"
            value={settings.workflowTimeout || 300}
            onChange={(e) => updateSetting('workflowTimeout', parseInt(e.target.value))}
          />
        </div>
      </div>

      {/* Task Categories and Tags */}
      <div className="setting-group">
        <h4>Organization</h4>
        
        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={settings.autoTaskCategorization !== false}
              onChange={(e) => updateSetting('autoTaskCategorization', e.target.checked)}
            />
            Automatically categorize tasks based on content
          </label>
        </div>

        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={settings.autoTaskTagging !== false}
              onChange={(e) => updateSetting('autoTaskTagging', e.target.checked)}
            />
            Automatically tag tasks with relevant technologies and actions
          </label>
        </div>
      </div>

      {/* Privacy and Storage */}
      <div className="setting-group">
        <h4>Privacy & Storage</h4>
        
        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={settings.anonymizeTaskData || false}
              onChange={(e) => updateSetting('anonymizeTaskData', e.target.checked)}
            />
            Anonymize sensitive data in task history
          </label>
        </div>

        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={settings.localTaskStorage !== false}
              onChange={(e) => updateSetting('localTaskStorage', e.target.checked)}
            />
            Store task history locally (disable for cloud sync)
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="setting-group">
        <h4>Data Management</h4>
        <div className="button-group">
          <button
            onClick={handleExportTaskHistory}
            disabled={loading}
            className="secondary"
          >
            {loading ? 'Exporting...' : 'Export Task History'}
          </button>
          <button
            onClick={handleClearTaskHistory}
            disabled={loading}
            className="danger"
          >
            Clear All History
          </button>
          <button
            onClick={() => {
              loadTaskStatistics();
              loadWorkflowStatistics();
            }}
            disabled={loading}
            className="secondary"
          >
            {loading ? 'Refreshing...' : 'Refresh Statistics'}
          </button>
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`message ${message.includes('Error') || message.includes('not yet implemented') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}
    </SectionWrapper>
  );
};

// Validation Section Component
const ValidationSection: React.FC<{
  webSocket?: WebSocket | null;
  isConnected?: boolean;
}> = () => {
  const [healthStatus, setHealthStatus] = React.useState<any>({});
  const [validationResult, setValidationResult] = React.useState<any>({});
  const [loading, setLoading] = React.useState(false);
  const [validating, setValidating] = React.useState(false);
  const [message, setMessage] = React.useState('');

  // Load health status on mount
  React.useEffect(() => {
    loadHealthStatus();
  }, []);

  const loadHealthStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/settings/validation/health');
      if (response.ok) {
        const data = await response.json();
        setHealthStatus(data.health || {});
      }
    } catch (error) {
      console.error('Error loading health status:', error);
      setMessage('Error loading validation health status');
    } finally {
      setLoading(false);
    }
  };

  const runFullValidation = async () => {
    try {
      setValidating(true);
      const response = await fetch('/api/settings/validation/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeSettings: false })
      });

      if (response.ok) {
        const data = await response.json();
        setValidationResult(data.validation || {});
        setMessage(data.validation.isValid ? 'Validation completed successfully!' : 'Validation found issues');
      } else {
        throw new Error('Validation request failed');
      }
    } catch (error) {
      console.error('Error running validation:', error);
      setMessage('Error running validation');
    } finally {
      setValidating(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const analyzeSettings = async (category: string) => {
    try {
      setLoading(true);
      // This would need to load current settings first
      const settingsResponse = await fetch('/api/settings/validation/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeSettings: true })
      });

      if (!settingsResponse.ok) throw new Error('Failed to load settings');
      const settingsData = await settingsResponse.json();

      const response = await fetch('/api/settings/validation/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          data: settingsData.settings
        })
      });

      if (response.ok) {
        const data = await response.json();
        // Show analysis results in validation result
        setValidationResult({
          ...validationResult,
          analysis: data.analysis
        });
        setMessage(`${category} analysis completed`);
      } else {
        throw new Error('Analysis request failed');
      }
    } catch (error) {
      console.error(`Error analyzing ${category}:`, error);
      setMessage(`Error analyzing ${category}`);
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  return (
    <SectionWrapper title="Settings Validation" icon={CheckCheck}>
      {/* System Health Overview */}
      <div className="setting-group">
        <h4>System Health Status</h4>
        {loading && !healthStatus.system ? (
          <p>Loading health status...</p>
        ) : (
          <div className="health-status-grid">
            <div className={`health-item ${healthStatus.system?.healthy ? 'healthy' : 'unhealthy'}`}>
              <strong>{healthStatus.system?.healthy ? '✅' : '❌'} System</strong>
              <span>{healthStatus.system?.healthy ? 'Healthy' : 'Issues Detected'}</span>
            </div>
            <div className={`health-item ${healthStatus.validation?.isValid ? 'healthy' : 'unhealthy'}`}>
              <strong>{healthStatus.validation?.isValid ? '✅' : '❌'} Validation</strong>
              <span>
                {healthStatus.validation?.errorCount || 0} errors, {healthStatus.validation?.warningCount || 0} warnings
              </span>
            </div>
            <div className={`health-item ${!healthStatus.migration?.migrationNeeded ? 'healthy' : 'warning'}`}>
              <strong>{!healthStatus.migration?.migrationNeeded ? '✅' : '⚠️'} Migration</strong>
              <span>
                {healthStatus.migration?.migrationNeeded ? 'Migration Needed' : 'Up to Date'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Validation Actions */}
      <div className="setting-group">
        <h4>Validation Actions</h4>
        <div className="button-group">
          <button
            onClick={runFullValidation}
            disabled={validating}
            className="primary"
          >
            {validating ? 'Validating...' : 'Run Full Validation'}
          </button>
          <button
            onClick={loadHealthStatus}
            disabled={loading}
            className="secondary"
          >
            {loading ? 'Refreshing...' : 'Refresh Health'}
          </button>
        </div>
      </div>

      {/* Analysis Tools */}
      <div className="setting-group">
        <h4>Analysis Tools</h4>
        <div className="button-group">
          <button
            onClick={() => analyzeSettings('performance')}
            disabled={loading}
            className="secondary"
          >
            Performance Analysis
          </button>
          <button
            onClick={() => analyzeSettings('security')}
            disabled={loading}
            className="secondary"
          >
            Security Analysis
          </button>
          <button
            onClick={() => analyzeSettings('dependencies')}
            disabled={loading}
            className="secondary"
          >
            Dependency Analysis
          </button>
        </div>
      </div>

      {/* Validation Results */}
      {validationResult.summary && (
        <div className="setting-group">
          <h4>Validation Results</h4>
          <div className="validation-summary">
            <div className="summary-stats">
              <span className="stat">
                <strong>{validationResult.summary.total || 0}</strong> Total Checks
              </span>
              <span className="stat error">
                <strong>{validationResult.summary.errors || 0}</strong> Errors
              </span>
              <span className="stat warning">
                <strong>{validationResult.summary.warnings || 0}</strong> Warnings
              </span>
            </div>

            {validationResult.errors && validationResult.errors.length > 0 && (
              <div className="validation-errors">
                <h5>❌ Errors ({validationResult.errors.length})</h5>
                <ul>
                  {validationResult.errors.slice(0, 10).map((error: any, idx: number) => (
                    <li key={idx}>
                      <strong>{error.category}:</strong> {error.message}
                      {error.suggestion && <em> - {error.suggestion}</em>}
                    </li>
                  ))}
                  {validationResult.errors.length > 10 && (
                    <li><em>... and {validationResult.errors.length - 10} more errors</em></li>
                  )}
                </ul>
              </div>
            )}

            {validationResult.warnings && validationResult.warnings.length > 0 && (
              <div className="validation-warnings">
                <h5>⚠️ Warnings ({validationResult.warnings.length})</h5>
                <ul>
                  {validationResult.warnings.slice(0, 5).map((warning: any, idx: number) => (
                    <li key={idx}>
                      <strong>{warning.category}:</strong> {warning.message}
                    </li>
                  ))}
                  {validationResult.warnings.length > 5 && (
                    <li><em>... and {validationResult.warnings.length - 5} more warnings</em></li>
                  )}
                </ul>
              </div>
            )}

            {validationResult.analysis && (
              <div className="analysis-results">
                <h5>Analysis Results</h5>
                <pre style={{ fontSize: '12px', background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
                  {JSON.stringify(validationResult.analysis, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status Message */}
      {message && (
        <div className={`message ${message.includes('Error') ? 'error' : message.includes('issues') ? 'warning' : 'success'}`}>
          {message}
        </div>
      )}
    </SectionWrapper>
  );
};

// Migration Section Component
const MigrationSection: React.FC<{
  webSocket?: WebSocket | null;
  isConnected?: boolean;
}> = () => {
  const [migrationStatus, setMigrationStatus] = React.useState<any>({});
  const [rollbacks, setRollbacks] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [migrating, setMigrating] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [migrationProgress, setMigrationProgress] = React.useState<any[]>([]);

  // Load migration status on mount
  React.useEffect(() => {
    loadMigrationStatus();
    loadRollbacks();
  }, []);

  const loadMigrationStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/settings/migration/status');
      if (response.ok) {
        const data = await response.json();
        setMigrationStatus(data.migration || {});
      }
    } catch (error) {
      console.error('Error loading migration status:', error);
      setMessage('Error loading migration status');
    } finally {
      setLoading(false);
    }
  };

  const loadRollbacks = async () => {
    try {
      const response = await fetch('/api/settings/migration/rollbacks');
      if (response.ok) {
        const data = await response.json();
        setRollbacks(data.rollbacks || []);
      }
    } catch (error) {
      console.error('Error loading rollbacks:', error);
    }
  };

  const executeMigration = async () => {
    if (!window.confirm('Are you sure you want to execute the migration? A backup will be created automatically.')) {
      return;
    }

    try {
      setMigrating(true);
      setMigrationProgress([]);
      
      const response = await fetch('/api/settings/migration/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          createBackup: true,
          validateAfter: true
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMigrationProgress(data.progress || []);
        
        if (data.success) {
          setMessage('Migration completed successfully!');
          await loadMigrationStatus();
          await loadRollbacks();
        } else {
          setMessage(`Migration failed: ${data.migration.errors?.join(', ') || 'Unknown error'}`);
        }
      } else {
        throw new Error('Migration request failed');
      }
    } catch (error) {
      console.error('Error executing migration:', error);
      setMessage('Error executing migration');
    } finally {
      setMigrating(false);
      setTimeout(() => setMessage(''), 10000);
    }
  };

  const createBackup = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/settings/migration/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        setMessage(`Backup created successfully: ${data.backup.path}`);
        await loadRollbacks();
      } else {
        throw new Error('Backup creation failed');
      }
    } catch (error) {
      console.error('Error creating backup:', error);
      setMessage('Error creating backup');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const performRollback = async (backupPath: string) => {
    if (!window.confirm('Are you sure you want to rollback to this backup? This will overwrite your current settings.')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/settings/migration/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupPath })
      });

      if (response.ok) {
        setMessage('Rollback completed successfully!');
        await loadMigrationStatus();
      } else {
        throw new Error('Rollback failed');
      }
    } catch (error) {
      console.error('Error performing rollback:', error);
      setMessage('Error performing rollback');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  return (
    <SectionWrapper title="Settings Migration" icon={GitBranch}>
      {/* Migration Status */}
      <div className="setting-group">
        <h4>Current Version Status</h4>
        {loading && !migrationStatus.currentVersion ? (
          <p>Loading migration status...</p>
        ) : (
          <div className="migration-status">
            <div className="status-item">
              <strong>Current Version:</strong> {migrationStatus.currentVersion || 'Unknown'}
            </div>
            <div className="status-item">
              <strong>Target Version:</strong> {migrationStatus.targetVersion || 'Unknown'}
            </div>
            <div className="status-item">
              <strong>Migration Needed:</strong>{' '}
              <span className={migrationStatus.needed ? 'warning' : 'success'}>
                {migrationStatus.needed ? '⚠️ Yes' : '✅ No'}
              </span>
            </div>
            {migrationStatus.backupRecommended && (
              <div className="status-item warning">
                <strong>⚠️ Backup Recommended:</strong> This migration includes breaking changes
              </div>
            )}
          </div>
        )}
      </div>

      {/* Migration Actions */}
      {migrationStatus.needed && (
        <div className="setting-group">
          <h4>Migration Actions</h4>
          <div className="migration-plan">
            <h5>Migration Plan:</h5>
            {migrationStatus.migrationPlan && migrationStatus.migrationPlan.length > 0 ? (
              <ul>
                {migrationStatus.migrationPlan.map((step: any, idx: number) => (
                  <li key={idx}>
                    <strong>{step.id}:</strong> {step.description}
                    {step.breaking && <span className="breaking-badge">BREAKING</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No migration steps available</p>
            )}
          </div>
          
          <div className="button-group">
            <button
              onClick={executeMigration}
              disabled={migrating}
              className="primary"
            >
              {migrating ? 'Migrating...' : 'Execute Migration'}
            </button>
            <button
              onClick={createBackup}
              disabled={loading}
              className="secondary"
            >
              Create Backup First
            </button>
          </div>

          {migrationStatus.estimatedTime && (
            <small>Estimated time: {Math.round(migrationStatus.estimatedTime / 1000)}s</small>
          )}
        </div>
      )}

      {/* Migration Progress */}
      {migrationProgress.length > 0 && (
        <div className="setting-group">
          <h4>Migration Progress</h4>
          <div className="migration-progress">
            {migrationProgress.map((progress: any, idx: number) => (
              <div key={idx} className="progress-item">
                <span className="step">{progress.step}:</span>
                <span className="message">{progress.message}</span>
                {progress.progress && (
                  <span className="progress-bar">
                    <div style={{ width: `${progress.progress}%` }}></div>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Migration History */}
      {migrationStatus.history && migrationStatus.history.length > 0 && (
        <div className="setting-group">
          <h4>Migration History</h4>
          <div className="migration-history">
            {migrationStatus.history.slice(0, 5).map((entry: any, idx: number) => (
              <div key={idx} className="history-item">
                <div className="history-main">
                  <strong>{entry.fromVersion} → {entry.toVersion}</strong>
                  <span className={`status ${entry.success ? 'success' : 'error'}`}>
                    {entry.success ? '✅' : '❌'}
                  </span>
                </div>
                <div className="history-details">
                  <small>{new Date(entry.date).toLocaleString()}</small>
                  {entry.automatic && <span className="auto-badge">AUTO</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rollback Options */}
      <div className="setting-group">
        <h4>Rollback Options</h4>
        <div className="button-group">
          <button
            onClick={loadRollbacks}
            disabled={loading}
            className="secondary"
          >
            {loading ? 'Refreshing...' : 'Refresh Rollbacks'}
          </button>
        </div>

        {rollbacks.length > 0 ? (
          <div className="rollback-list">
            <h5>Available Rollback Points ({rollbacks.length})</h5>
            {rollbacks.slice(0, 5).map((rollback: any, idx: number) => (
              <div key={idx} className="rollback-item">
                <div className="rollback-info">
                  <strong>Version {rollback.version}</strong>
                  <span className="rollback-date">{new Date(rollback.date).toLocaleString()}</span>
                  <span className="rollback-size">{Math.round(rollback.size / 1024)}KB</span>
                </div>
                <button
                  onClick={() => performRollback(rollback.path)}
                  disabled={loading}
                  className="danger small"
                >
                  Rollback
                </button>
              </div>
            ))}
            {rollbacks.length > 5 && (
              <p><em>... and {rollbacks.length - 5} more rollback points</em></p>
            )}
          </div>
        ) : (
          <p>No rollback points available</p>
        )}
      </div>

      {/* Status Message */}
      {message && (
        <div className={`message ${message.includes('Error') || message.includes('failed') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}
    </SectionWrapper>
  );
};

export default ComprehensiveSettingsPanel;