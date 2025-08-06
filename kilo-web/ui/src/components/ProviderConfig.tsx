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
    apiKey: '',
    claudeCodePath: '',
    claudeCodeMaxOutputTokens: 4096
  });
  const [showNewProfileForm, setShowNewProfileForm] = useState(false);
  const [validationErrors, setValidationErrors] = useState<any[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<any[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [modelSuggestions, setModelSuggestions] = useState<string[]>([]);

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
        fetch('/api/settings/providers/profiles'),
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
    if (!newProfile.name.trim()) {
      setMessage('Profile name is required');
      return;
    }

    // Validate configuration before saving
    const profileConfig = {
      provider: newProfile.provider,
      apiKey: newProfile.apiKey,
      model: newProfile.model,
      temperature: newProfile.temperature,
      maxTokens: newProfile.maxTokens,
      ...(newProfile.provider === 'claude-code' && {
        claudeCodePath: newProfile.claudeCodePath,
        claudeCodeMaxOutputTokens: newProfile.claudeCodeMaxOutputTokens
      })
    };

    const isValid = await validateProfile(profileConfig);
    if (!isValid) {
      setMessage('Please fix validation errors before saving');
      return;
    }

    try {
      setSaving(true);

      const response = await fetch('/api/settings/providers/profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newProfile.name,
          config: profileConfig
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save provider profile');
      }

      await response.json();
      setMessage('Provider profile saved successfully!');
      clearMessageAfterDelay();
      
      setNewProfile({
        name: '',
        provider: 'anthropic',
        model: '',
        temperature: 0.7,
        maxTokens: 4096,
        apiKey: '',
        claudeCodePath: '',
        claudeCodeMaxOutputTokens: 4096
      });
      setShowNewProfileForm(false);
      setValidationErrors([]);
      setValidationWarnings([]);
      
      // Reload profiles
      await loadProviderSettings();
    } catch (error) {
      console.error('Error saving provider profile:', error);
      setMessage(`Error saving provider profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      
      const response = await fetch(`/api/settings/providers/profiles/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete provider profile');
      }

      setMessage('Provider profile deleted successfully!');
      clearMessageAfterDelay();
      
      // Reload profiles
      await loadProviderSettings();
    } catch (error) {
      console.error('Error deleting provider profile:', error);
      setMessage(`Error deleting provider profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSetCurrentProvider = async (name: string) => {
    try {
      setSaving(true);
      
      const response = await fetch(`/api/settings/providers/activate/${encodeURIComponent(name)}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to activate provider profile');
      }

      const result = await response.json();
      setMessage('Provider changed successfully!');
      clearMessageAfterDelay();
      
      // Update current provider
      setCurrentProvider(name);
      
      // Notify parent component
      if (onProviderChange) {
        onProviderChange(result.provider);
      }
      
      // Reload profiles to update metadata
      await loadProviderSettings();
    } catch (error) {
      console.error('Error setting current provider:', error);
      setMessage(`Error setting current provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleProviderChange = async (provider: string) => {
    try {
      // Get autofill configuration
      const response = await fetch('/api/settings/providers/autofill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          existingConfig: { ...newProfile, provider },
          useCase: 'general'
        })
      });

      if (response.ok) {
        const data = await response.json();
        setNewProfile(prev => ({
          ...prev,
          ...data.config,
          provider,
          name: prev.name // Keep the name
        }));
      } else {
        // Fallback
        const models = availableModels[provider] || [];
        setNewProfile(prev => ({
          ...prev,
          provider,
          model: models[0] || ''
        }));
      }

      // Load model suggestions
      await loadModelSuggestions(provider);
    } catch (error) {
      console.error('Error handling provider change:', error);
      // Fallback
      const models = availableModels[provider] || [];
      setNewProfile(prev => ({
        ...prev,
        provider,
        model: models[0] || ''
      }));
    }
  };

  const loadModelSuggestions = async (provider: string) => {
    try {
      const response = await fetch(`/api/settings/providers/${provider}/models/suggestions?useCase=general`);
      if (response.ok) {
        const data = await response.json();
        setModelSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error('Error loading model suggestions:', error);
    }
  };

  const validateProfile = async (config: any) => {
    try {
      setIsValidating(true);
      const response = await fetch('/api/settings/providers/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: config.provider,
          config
        })
      });

      if (response.ok) {
        const result = await response.json();
        setValidationErrors(result.validation.errors || []);
        setValidationWarnings(result.validation.warnings || []);
        return result.validation.isValid;
      }
    } catch (error) {
      console.error('Error validating profile:', error);
    } finally {
      setIsValidating(false);
    }
    return false;
  };

  const getProviderDisplayName = (provider: string) => {
    const displayNames: { [key: string]: string } = {
      'anthropic': 'Anthropic',
      'openai': 'OpenAI',
      'claude-code': 'Claude Code',
      'virtual-quota-fallback': 'Virtual Quota Fallback',
      'fireworks': 'Fireworks AI',
      'cerebras': 'Cerebras',
      'gemini-cli': 'Gemini CLI',
      'xai': 'xAI (Grok)',
      'groq': 'Groq',
      'huggingface': 'Hugging Face'
    };
    return displayNames[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
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
                  className={validationErrors.some(e => e.field === 'provider') ? 'error' : ''}
                >
                  {availableProviders.map(provider => (
                    <option key={provider} value={provider}>
                      {getProviderDisplayName(provider)}
                    </option>
                  ))}
                </select>
                {validationErrors.filter(e => e.field === 'provider').map((error, idx) => (
                  <small key={idx} className="error-message">{error.message}</small>
                ))}
              </div>

              <div className="setting-group">
                <label>API Key</label>
                <input
                  type="password"
                  value={newProfile.apiKey}
                  onChange={(e) => setNewProfile(prev => ({ ...prev, apiKey: e.target.value }))}
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
                  value={newProfile.model}
                  onChange={(e) => setNewProfile(prev => ({ ...prev, model: e.target.value }))}
                  className={validationErrors.some(e => e.field === 'model') ? 'error' : ''}
                >
                  <option value="">Select model</option>
                  {modelSuggestions.length > 0 ? (
                    modelSuggestions.map(model => (
                      <option key={model} value={model}>{model} ⭐</option>
                    ))
                  ) : (
                    (availableModels[newProfile.provider] || []).map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))
                  )}
                  {/* Show remaining models if we have suggestions */}
                  {modelSuggestions.length > 0 && (
                    (availableModels[newProfile.provider] || [])
                      .filter(model => !modelSuggestions.includes(model))
                      .map(model => (
                        <option key={model} value={model}>{model}</option>
                      ))
                  )}
                </select>
                {validationErrors.filter(e => e.field === 'model').map((error, idx) => (
                  <small key={idx} className="error-message">{error.message}</small>
                ))}
                {validationWarnings.filter(e => e.field === 'model').map((warning, idx) => (
                  <small key={idx} className="warning-message">⚠️ {warning.message}</small>
                ))}
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

              {/* Claude Code specific settings */}
              {newProfile.provider === 'claude-code' && (
                <>
                  <div className="setting-group">
                    <label>Claude CLI Path</label>
                    <input
                      type="text"
                      value={newProfile.claudeCodePath}
                      onChange={(e) => setNewProfile(prev => ({ ...prev, claudeCodePath: e.target.value }))}
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
                      value={newProfile.claudeCodeMaxOutputTokens}
                      onChange={(e) => setNewProfile(prev => ({ ...prev, claudeCodeMaxOutputTokens: parseInt(e.target.value) || 4096 }))}
                      placeholder="Maximum output tokens"
                    />
                    <small>Maximum number of tokens for Claude Code output (1-200000)</small>
                  </div>
                </>
              )}

              {/* Validation Summary for New Profile */}
              {(validationErrors.length > 0 || validationWarnings.length > 0) && (
                <div className="validation-summary">
                  {validationErrors.length > 0 && (
                    <div className="validation-errors">
                      <h5>❌ Issues to Fix ({validationErrors.length})</h5>
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

              <div className="profile-form-actions">
                <button
                  onClick={handleSaveNewProfile}
                  disabled={saving || isValidating || validationErrors.length > 0}
                  className="primary"
                >
                  {saving ? 'Saving...' : isValidating ? 'Validating...' : 'Save Profile'}
                </button>
                <button onClick={() => {
                  setShowNewProfileForm(false);
                  setValidationErrors([]);
                  setValidationWarnings([]);
                }} disabled={saving}>
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