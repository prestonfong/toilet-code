import React, { useState, useEffect } from 'react';
import './Settings.css';
import { kiloClient } from '../utils/webClient';

interface ProviderProfile {
  id: string;
  name: string;
  provider: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  created: string;
  lastUsed?: string;
}

interface GlobalSettings {
  theme?: 'dark' | 'light' | 'auto';
  language?: string;
  autoSave?: boolean;
  notifications?: boolean;
  debugMode?: boolean;
}

interface ModeConfig {
  slug: string;
  name: string;
  description?: string;
  systemPrompt?: string;
  customInstructions?: string;
  enabled: boolean;
}

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  // State management
  const [activeTab, setActiveTab] = useState<'providers' | 'global' | 'modes' | 'import-export'>('providers');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  
  // Provider settings state
  const [providerProfiles, setProviderProfiles] = useState<ProviderProfile[]>([]);
  const [currentProvider, setCurrentProvider] = useState<string>('');
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<{ [provider: string]: string[] }>({});
  const [newProfile, setNewProfile] = useState({
    name: '',
    provider: 'anthropic',
    model: '',
    temperature: 0.7,
    maxTokens: 4096,
    apiKey: ''
  });
  const [showNewProfileForm, setShowNewProfileForm] = useState(false);
  
  // Global settings state
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
    theme: 'dark',
    language: 'en',
    autoSave: true,
    notifications: true,
    debugMode: false
  });
  
  // Mode settings state
  const [modeConfigs, setModeConfigs] = useState<ModeConfig[]>([]);
  const [, setEditingMode] = useState<string | null>(null);
  
  // Import/Export state
  const [exportData, setExportData] = useState<string>('');
  const [importData, setImportData] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      loadAllSettings();
      setupWebSocketHandlers();
    }
    
    return () => {
      // Cleanup WebSocket handlers
      kiloClient.off('settingsData');
      kiloClient.off('settingsUpdated');
      kiloClient.off('settingsChanged');
      kiloClient.off('providerChanged');
      kiloClient.off('globalSettingsChanged');
    };
  }, [isOpen]);

  const setupWebSocketHandlers = () => {
    kiloClient.on('settingsData', (data) => {
      if (data.data?.providers) {
        setProviderProfiles(data.data.providers.profiles || []);
        setCurrentProvider(data.data.providers.current || '');
      }
      if (data.data?.global) {
        setGlobalSettings(data.data.global);
      }
      if (data.data?.modes) {
        setModeConfigs(data.data.modes || []);
      }
    });

    kiloClient.on('settingsUpdated', () => {
      setMessage('Settings updated successfully!');
      clearMessageAfterDelay();
    });

    kiloClient.on('settingsChanged', () => {
      loadAllSettings();
    });

    kiloClient.on('providerChanged', (data) => {
      setCurrentProvider(data.data?.name || '');
      setMessage('Provider changed successfully!');
      clearMessageAfterDelay();
    });

    kiloClient.on('globalSettingsChanged', () => {
      loadGlobalSettings();
    });

    kiloClient.on('settingsExported', (data) => {
      setExportData(JSON.stringify(data.data, null, 2));
      setMessage('Settings exported successfully!');
      clearMessageAfterDelay();
      setLoading(false);
    });

    kiloClient.on('settingsImported', () => {
      setMessage('Settings imported successfully!');
      clearMessageAfterDelay();
      setSaving(false);
    });

    kiloClient.on('error', (data) => {
      setMessage(`Error: ${data.message}`);
      setSaving(false);
      setLoading(false);
    });
  };

  const clearMessageAfterDelay = () => {
    setTimeout(() => setMessage(''), 3000);
  };

  const loadAllSettings = async () => {
    try {
      setLoading(true);
      await loadProviderSettings();
      await loadGlobalSettings();
      await loadModeSettings();
      await loadAvailableProviders();
    } catch (error) {
      console.error('Error loading settings:', error);
      setMessage('Error loading settings');
    } finally {
      setLoading(false);
    }
  };

  const loadProviderSettings = async () => {
    try {
      const [profilesRes, currentRes] = await Promise.all([
        fetch('/api/settings/providers'),
        fetch('/api/settings/providers/current')
      ]);
      
      if (profilesRes.ok) {
        const profilesData = await profilesRes.json();
        setProviderProfiles(profilesData.profiles || []);
      }
      
      if (currentRes.ok) {
        const currentData = await currentRes.json();
        setCurrentProvider(currentData.provider?.name || '');
      }
    } catch (error) {
      console.error('Error loading provider settings:', error);
    }
  };

  const loadGlobalSettings = async () => {
    try {
      const response = await fetch('/api/settings/global');
      if (response.ok) {
        const data = await response.json();
        setGlobalSettings(data.settings || {});
      }
    } catch (error) {
      console.error('Error loading global settings:', error);
    }
  };

  const loadModeSettings = async () => {
    try {
      const response = await fetch('/api/settings/modes');
      if (response.ok) {
        const data = await response.json();
        setModeConfigs(data.configs || []);
      }
    } catch (error) {
      console.error('Error loading mode settings:', error);
    }
  };

  const loadAvailableProviders = async () => {
    try {
      const response = await fetch('/api/settings/providers/available');
      if (response.ok) {
        const data = await response.json();
        setAvailableProviders(data.providers || []);
        
        // Load models for each provider
        const modelsMap: { [provider: string]: string[] } = {};
        for (const provider of data.providers || []) {
          try {
            const modelsRes = await fetch(`/api/settings/providers/${provider}/models`);
            if (modelsRes.ok) {
              const modelsData = await modelsRes.json();
              modelsMap[provider] = modelsData.models || [];
            }
          } catch (error) {
            console.error(`Error loading models for ${provider}:`, error);
          }
        }
        setAvailableModels(modelsMap);
      }
    } catch (error) {
      console.error('Error loading available providers:', error);
    }
  };

  const handleSaveNewProfile = async () => {
    if (!newProfile.name.trim() || !newProfile.apiKey.trim()) {
      setMessage('Profile name and API key are required');
      return;
    }

    try {
      setSaving(true);
      await kiloClient.saveProviderProfile(newProfile.name, {
        provider: newProfile.provider,
        apiKey: newProfile.apiKey,
        model: newProfile.model,
        temperature: newProfile.temperature,
        maxTokens: newProfile.maxTokens
      });
      
      setNewProfile({
        name: '',
        provider: 'anthropic',
        model: '',
        temperature: 0.7,
        maxTokens: 4096,
        apiKey: ''
      });
      setShowNewProfileForm(false);
      await loadProviderSettings();
      setMessage('Provider profile saved successfully!');
      clearMessageAfterDelay();
    } catch (error) {
      console.error('Error saving provider profile:', error);
      setMessage('Error saving provider profile');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProfile = async (name: string) => {
    if (!confirm(`Are you sure you want to delete the profile "${name}"?`)) {
      return;
    }

    try {
      setSaving(true);
      await kiloClient.deleteProviderProfile(name);
      await loadProviderSettings();
      setMessage('Provider profile deleted successfully!');
      clearMessageAfterDelay();
    } catch (error) {
      console.error('Error deleting provider profile:', error);
      setMessage('Error deleting provider profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSetCurrentProvider = async (name: string) => {
    try {
      setSaving(true);
      await kiloClient.setCurrentProvider(name);
      await loadProviderSettings();
    } catch (error) {
      console.error('Error setting current provider:', error);
      setMessage('Error setting current provider');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGlobalSettings = async () => {
    try {
      setSaving(true);
      await kiloClient.updateGlobalSettings(globalSettings);
      setMessage('Global settings saved successfully!');
      clearMessageAfterDelay();
    } catch (error) {
      console.error('Error saving global settings:', error);
      setMessage('Error saving global settings');
    } finally {
      setSaving(false);
    }
  };

  const handleExportSettings = async () => {
    try {
      setLoading(true);
      await kiloClient.exportSettings();
    } catch (error) {
      console.error('Error exporting settings:', error);
      setMessage('Error exporting settings');
    } finally {
      setLoading(false);
    }
  };

  const handleImportSettings = async () => {
    if (!importData.trim()) {
      setMessage('Please paste settings data to import');
      return;
    }

    try {
      setSaving(true);
      const data = JSON.parse(importData);
      await kiloClient.importSettings(data);
      setImportData('');
      await loadAllSettings();
      setMessage('Settings imported successfully!');
      clearMessageAfterDelay();
    } catch (error) {
      console.error('Error importing settings:', error);
      setMessage('Error importing settings - please check the format');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const renderProviderSettings = () => (
    <div className="settings-tab-content">
      <div className="settings-section">
        <h3>Provider Profiles</h3>
        <p>Manage your AI provider configurations</p>
        
        {providerProfiles.length > 0 && (
          <div className="provider-profiles">
            {providerProfiles.map((profile) => (
              <div key={profile.id} className={`provider-profile ${profile.name === currentProvider ? 'active' : ''}`}>
                <div className="profile-info">
                  <h4>{profile.name}</h4>
                  <p>{profile.provider} - {profile.model}</p>
                  {profile.name === currentProvider && <span className="current-badge">Current</span>}
                </div>
                <div className="profile-actions">
                  {profile.name !== currentProvider && (
                    <button onClick={() => handleSetCurrentProvider(profile.name)} disabled={saving}>
                      Use
                    </button>
                  )}
                  <button onClick={() => handleDeleteProfile(profile.name)} disabled={saving} className="danger">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button onClick={() => setShowNewProfileForm(!showNewProfileForm)} className="add-profile-btn">
          {showNewProfileForm ? 'Cancel' : 'Add New Profile'}
        </button>

        {showNewProfileForm && (
          <div className="new-profile-form">
            <div className="setting-group">
              <label>Profile Name</label>
              <input
                type="text"
                value={newProfile.name}
                onChange={(e) => setNewProfile(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter profile name"
              />
            </div>

            <div className="setting-group">
              <label>Provider</label>
              <select
                value={newProfile.provider}
                onChange={(e) => setNewProfile(prev => ({ ...prev, provider: e.target.value, model: '' }))}
              >
                {availableProviders.map(provider => (
                  <option key={provider} value={provider}>
                    {provider.charAt(0).toUpperCase() + provider.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="setting-group">
              <label>API Key</label>
              <input
                type="password"
                value={newProfile.apiKey}
                onChange={(e) => setNewProfile(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="Enter API key"
              />
            </div>

            <div className="setting-group">
              <label>Model</label>
              <select
                value={newProfile.model}
                onChange={(e) => setNewProfile(prev => ({ ...prev, model: e.target.value }))}
              >
                <option value="">Select model</option>
                {(availableModels[newProfile.provider] || []).map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>

            <div className="setting-group">
              <label>Temperature ({newProfile.temperature})</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={newProfile.temperature}
                onChange={(e) => setNewProfile(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
              />
            </div>

            <div className="setting-group">
              <label>Max Tokens</label>
              <input
                type="number"
                min="100"
                max="8192"
                value={newProfile.maxTokens}
                onChange={(e) => setNewProfile(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
              />
            </div>

            <button onClick={handleSaveNewProfile} disabled={saving} className="primary">
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderGlobalSettings = () => (
    <div className="settings-tab-content">
      <div className="settings-section">
        <h3>Global Settings</h3>
        <p>Configure global application preferences</p>

        <div className="setting-group">
          <label>Theme</label>
          <select
            value={globalSettings.theme || 'dark'}
            onChange={(e) => setGlobalSettings(prev => ({ ...prev, theme: e.target.value as 'dark' | 'light' | 'auto' }))}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="auto">Auto</option>
          </select>
        </div>

        <div className="setting-group">
          <label>Language</label>
          <select
            value={globalSettings.language || 'en'}
            onChange={(e) => setGlobalSettings(prev => ({ ...prev, language: e.target.value }))}
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
          </select>
        </div>

        <div className="setting-group checkbox">
          <label>
            <input
              type="checkbox"
              checked={globalSettings.autoSave || false}
              onChange={(e) => setGlobalSettings(prev => ({ ...prev, autoSave: e.target.checked }))}
            />
            Auto Save
          </label>
        </div>

        <div className="setting-group checkbox">
          <label>
            <input
              type="checkbox"
              checked={globalSettings.notifications || false}
              onChange={(e) => setGlobalSettings(prev => ({ ...prev, notifications: e.target.checked }))}
            />
            Enable Notifications
          </label>
        </div>

        <div className="setting-group checkbox">
          <label>
            <input
              type="checkbox"
              checked={globalSettings.debugMode || false}
              onChange={(e) => setGlobalSettings(prev => ({ ...prev, debugMode: e.target.checked }))}
            />
            Debug Mode
          </label>
        </div>

        <button onClick={handleSaveGlobalSettings} disabled={saving} className="primary">
          {saving ? 'Saving...' : 'Save Global Settings'}
        </button>
      </div>
    </div>
  );

  const renderModeSettings = () => (
    <div className="settings-tab-content">
      <div className="settings-section">
        <h3>Mode Configuration</h3>
        <p>Manage custom mode settings and prompts</p>
        
        {modeConfigs.length > 0 ? (
          <div className="mode-configs">
            {modeConfigs.map((mode) => (
              <div key={mode.slug} className="mode-config">
                <div className="mode-info">
                  <h4>{mode.name}</h4>
                  <p>{mode.description}</p>
                </div>
                <div className="mode-actions">
                  <button onClick={() => setEditingMode(mode.slug)}>Edit</button>
                  <button 
                    onClick={() => setModeConfigs(prev => 
                      prev.map(m => m.slug === mode.slug ? {...m, enabled: !m.enabled} : m)
                    )}
                    className={mode.enabled ? 'primary' : 'secondary'}
                  >
                    {mode.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>No custom modes configured</p>
        )}
      </div>
    </div>
  );

  const renderImportExportSettings = () => (
    <div className="settings-tab-content">
      <div className="settings-section">
        <h3>Import / Export Settings</h3>
        <p>Backup and restore your configuration</p>

        <div className="setting-group">
          <label>Export Settings</label>
          <button onClick={handleExportSettings} disabled={loading} className="primary">
            {loading ? 'Exporting...' : 'Export All Settings'}
          </button>
          {exportData && (
            <textarea
              value={exportData}
              readOnly
              rows={10}
              placeholder="Exported settings will appear here"
            />
          )}
        </div>

        <div className="setting-group">
          <label>Import Settings</label>
          <textarea
            value={importData}
            onChange={(e) => setImportData(e.target.value)}
            rows={10}
            placeholder="Paste exported settings data here"
          />
          <button onClick={handleImportSettings} disabled={saving || !importData.trim()} className="primary">
            {saving ? 'Importing...' : 'Import Settings'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="settings-overlay">
      <div className="settings-modal large">
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="settings-tabs">
          <button 
            className={activeTab === 'providers' ? 'active' : ''}
            onClick={() => setActiveTab('providers')}
          >
            Providers
          </button>
          <button 
            className={activeTab === 'global' ? 'active' : ''}
            onClick={() => setActiveTab('global')}
          >
            Global
          </button>
          <button 
            className={activeTab === 'modes' ? 'active' : ''}
            onClick={() => setActiveTab('modes')}
          >
            Modes
          </button>
          <button 
            className={activeTab === 'import-export' ? 'active' : ''}
            onClick={() => setActiveTab('import-export')}
          >
            Import/Export
          </button>
        </div>

        <div className="settings-content">
          {loading ? (
            <div className="loading">Loading settings...</div>
          ) : (
            <>
              {activeTab === 'providers' && renderProviderSettings()}
              {activeTab === 'global' && renderGlobalSettings()}
              {activeTab === 'modes' && renderModeSettings()}
              {activeTab === 'import-export' && renderImportExportSettings()}
            </>
          )}
        </div>

        <div className="settings-footer">
          {message && (
            <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
              {message}
            </div>
          )}
          <div className="settings-actions">
            <button onClick={onClose} disabled={saving}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;