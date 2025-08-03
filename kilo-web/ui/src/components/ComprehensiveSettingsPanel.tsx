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
  ChevronRight
} from 'lucide-react';

// Types based on original kilo-code
interface ProviderSettings {
  provider?: string;
  model?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  baseUrl?: string;
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
  | 'about';

interface ComprehensiveSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  targetSection?: string;
}

const ComprehensiveSettingsPanel: React.FC<ComprehensiveSettingsPanelProps> = ({ 
  isOpen, 
  onClose, 
  targetSection 
}) => {
  // State management
  const [activeTab, setActiveTab] = useState<SectionName>(
    (targetSection && ['providers', 'autoApprove', 'browser', 'checkpoints', 'display', 'notifications', 'contextManagement', 'terminal', 'prompts', 'experimental', 'language', 'mcp', 'about'].includes(targetSection as SectionName))
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
      // In a real implementation, this would load from API
      // For now, use default values
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
    } catch (error) {
      console.error('Error loading settings:', error);
      setMessage('Error loading settings');
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
      // In a real implementation, this would save to API
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      originalSettings.current = { ...settings };
      setIsChangeDetected(false);
      setMessage('Settings saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage('Error saving settings');
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

const ProvidersSection: React.FC<{ settings: ExtensionSettings; updateSetting: any }> = ({ settings, updateSetting }) => (
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
        onChange={(e) => updateSetting('apiConfiguration', { ...settings.apiConfiguration, provider: e.target.value })}
      >
        <option value="anthropic">Anthropic</option>
        <option value="openai">OpenAI</option>
        <option value="azure">Azure OpenAI</option>
        <option value="google">Google</option>
      </select>
    </div>
    <div className="setting-group">
      <label>API Key</label>
      <input 
        type="password" 
        value={settings.apiConfiguration?.apiKey || ''} 
        onChange={(e) => updateSetting('apiConfiguration', { ...settings.apiConfiguration, apiKey: e.target.value })}
        placeholder="Enter API key"
      />
    </div>
    <div className="setting-group">
      <label>Model</label>
      <input 
        type="text" 
        value={settings.apiConfiguration?.model || ''} 
        onChange={(e) => updateSetting('apiConfiguration', { ...settings.apiConfiguration, model: e.target.value })}
        placeholder="Enter model name"
      />
    </div>
    <div className="setting-group">
      <label>Temperature ({settings.apiConfiguration?.temperature || 0.7})</label>
      <input 
        type="range" 
        min="0" 
        max="1" 
        step="0.1" 
        value={settings.apiConfiguration?.temperature || 0.7} 
        onChange={(e) => updateSetting('apiConfiguration', { ...settings.apiConfiguration, temperature: parseFloat(e.target.value) })}
      />
    </div>
  </SectionWrapper>
);

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

const NotificationsSection: React.FC<{ settings: ExtensionSettings; updateSetting: any }> = ({ settings, updateSetting }) => (
  <SectionWrapper title="Notifications" icon={Bell}>
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
  </SectionWrapper>
);

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

const McpSection: React.FC<{ settings: ExtensionSettings; updateSetting: any }> = ({ settings, updateSetting }) => (
  <SectionWrapper title="MCP" icon={Server}>
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
    <p>Model Context Protocol allows integration with external services and tools.</p>
  </SectionWrapper>
);

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

export default ComprehensiveSettingsPanel;