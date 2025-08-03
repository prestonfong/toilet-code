import React, { useState, useEffect } from 'react';
import './Settings.css';

interface AIProviderConfig {
  provider: 'anthropic' | 'openai';
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<AIProviderConfig & { apiKey: string }>({
    provider: 'anthropic',
    apiKey: '',
    model: '',
    temperature: 0.7,
    maxTokens: 4096
  });
  const [providers, setProviders] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadSettings();
      loadProviders();
    }
  }, [isOpen]);

  useEffect(() => {
    if (config.provider) {
      loadModels(config.provider);
    }
  }, [config.provider]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/ai/config');
      if (response.ok) {
        const data = await response.json();
        if (data) {
          setConfig(prev => ({ ...prev, ...data }));
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setMessage('Error loading settings');
    } finally {
      setLoading(false);
    }
  };

  const loadProviders = async () => {
    try {
      const response = await fetch('/api/ai/providers');
      if (response.ok) {
        const data = await response.json();
        setProviders(data);
      }
    } catch (error) {
      console.error('Error loading providers:', error);
    }
  };

  const loadModels = async (provider: string) => {
    try {
      const response = await fetch(`/api/ai/models/${provider}`);
      if (response.ok) {
        const data = await response.json();
        setModels(data);
        if (data.length > 0 && !config.model) {
          setConfig(prev => ({ ...prev, model: data[0] }));
        }
      }
    } catch (error) {
      console.error('Error loading models:', error);
    }
  };

  const handleSave = async () => {
    if (!config.apiKey.trim()) {
      setMessage('API key is required');
      return;
    }

    try {
      setSaving(true);
      setMessage('');
      
      const response = await fetch('/api/ai/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });

      if (response.ok) {
        setMessage('Settings saved successfully!');
        setTimeout(() => {
          setMessage('');
          onClose();
        }, 1500);
      } else {
        const error = await response.json();
        setMessage(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const handleProviderChange = (provider: 'anthropic' | 'openai') => {
    setConfig(prev => ({ 
      ...prev, 
      provider,
      model: '' // Reset model when provider changes
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="settings-overlay">
      <div className="settings-modal">
        <div className="settings-header">
          <h2>AI Provider Settings</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="settings-content">
          {loading ? (
            <div className="loading">Loading settings...</div>
          ) : (
            <>
              <div className="setting-group">
                <label>Provider</label>
                <select 
                  value={config.provider} 
                  onChange={(e) => handleProviderChange(e.target.value as 'anthropic' | 'openai')}
                >
                  {providers.map(provider => (
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
                  value={config.apiKey}
                  onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="Enter your API key"
                />
              </div>

              <div className="setting-group">
                <label>Model</label>
                <select 
                  value={config.model} 
                  onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                >
                  {models.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>

              <div className="setting-group">
                <label>Temperature ({config.temperature})</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.temperature}
                  onChange={(e) => setConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                />
              </div>

              <div className="setting-group">
                <label>Max Tokens</label>
                <input
                  type="number"
                  min="100"
                  max="8192"
                  value={config.maxTokens}
                  onChange={(e) => setConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
                />
              </div>
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
            <button onClick={onClose} disabled={saving}>Cancel</button>
            <button 
              onClick={handleSave} 
              disabled={saving || loading}
              className="primary"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;