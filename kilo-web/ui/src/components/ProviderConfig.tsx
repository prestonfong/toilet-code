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

interface ProviderConfigProps {
  className?: string;
  onProviderChange?: (provider: ProviderProfile | null) => void;
  showTitle?: boolean;
}

const ProviderConfig: React.FC<ProviderConfigProps> = ({ 
  className = '', 
  onProviderChange,
  showTitle = true 
}) => {
  // State management
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

  useEffect(() => {
    loadProviderSettings();
    loadAvailableProviders();
    setupWebSocketHandlers();
    
    return () => {
      // Cleanup WebSocket handlers
      kiloClient.off('settingsProviderProfileSaved');
      kiloClient.off('settingsProviderProfileDeleted');
      kiloClient.off('settingsProviderCurrentSet');
      kiloClient.off('providerChanged');
    };
  }, []);

  const setupWebSocketHandlers = () => {
    kiloClient.on('settingsProviderProfileSaved', () => {
      setMessage('Provider profile saved successfully!');
      clearMessageAfterDelay();
      loadProviderSettings();
      setSaving(false);
    });

    kiloClient.on('settingsProviderProfileDeleted', () => {
      setMessage('Provider profile deleted successfully!');
      clearMessageAfterDelay();
      loadProviderSettings();
      setSaving(false);
    });

    kiloClient.on('settingsProviderCurrentSet', (data) => {
      setCurrentProvider(data.profile?.name || '');
      setMessage('Provider changed successfully!');
      clearMessageAfterDelay();
      setSaving(false);
      
      // Notify parent component
      if (onProviderChange) {
        onProviderChange(data.profile);
      }
    });

    kiloClient.on('providerChanged', (data) => {
      setCurrentProvider(data.data?.name || '');
      loadProviderSettings();
      
      // Notify parent component
      if (onProviderChange) {
        onProviderChange(data.data);
      }
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

  const loadProviderSettings = async () => {
    try {
      setLoading(true);
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
        const currentProviderName = currentData.provider?.name || '';
        setCurrentProvider(currentProviderName);
        
        // Notify parent component
        if (onProviderChange) {
          onProviderChange(currentData.provider);
        }
      }
    } catch (error) {
      console.error('Error loading provider settings:', error);
      setMessage('Error loading provider settings');
    } finally {
      setLoading(false);
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
        
        // Set default model for new profile if available
        if (data.providers?.length > 0) {
          const defaultProvider = data.providers[0];
          const defaultModels = modelsMap[defaultProvider] || [];
          setNewProfile(prev => ({
            ...prev,
            provider: defaultProvider,
            model: defaultModels[0] || ''
          }));
        }
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
    } catch (error) {
      console.error('Error saving provider profile:', error);
      setMessage('Error saving provider profile');
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
    } catch (error) {
      console.error('Error deleting provider profile:', error);
      setMessage('Error deleting provider profile');
      setSaving(false);
    }
  };

  const handleSetCurrentProvider = async (name: string) => {
    try {
      setSaving(true);
      await kiloClient.setCurrentProvider(name);
    } catch (error) {
      console.error('Error setting current provider:', error);
      setMessage('Error setting current provider');
      setSaving(false);
    }
  };

  const handleProviderChange = (provider: string) => {
    const models = availableModels[provider] || [];
    setNewProfile(prev => ({ 
      ...prev, 
      provider,
      model: models[0] || ''
    }));
  };

  return (
    <div className={`provider-config ${className}`}>
      {showTitle && (
        <div className="settings-section">
          <h3>AI Provider Configuration</h3>
          <p>Manage your AI provider settings and API keys</p>
        </div>
      )}
      
      {loading ? (
        <div className="loading">Loading provider settings...</div>
      ) : (
        <>
          {/* Current Provider Status */}
          {currentProvider && (
            <div className="current-provider-status">
              <div className="status-info">
                <strong>Current Provider:</strong> {currentProvider}
              </div>
            </div>
          )}

          {/* Provider Profiles */}
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

          {/* Add New Profile Button */}
          <button onClick={() => setShowNewProfileForm(!showNewProfileForm)} className="add-profile-btn">
            {showNewProfileForm ? 'Cancel' : 'Add New Provider'}
          </button>

          {/* New Profile Form */}
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
                  onChange={(e) => handleProviderChange(e.target.value)}
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

              <div className="profile-form-actions">
                <button onClick={handleSaveNewProfile} disabled={saving} className="primary">
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
                <button onClick={() => setShowNewProfileForm(false)} disabled={saving}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Status Message */}
          {message && (
            <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
              {message}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProviderConfig;