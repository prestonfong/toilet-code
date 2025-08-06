import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  AlertCircle,
  Settings,
  Copy,
  Star,
  StarOff
} from 'lucide-react';
import { ProviderProfile } from '../types/settings';
import './ProviderProfileManager.css';

interface ProviderProfileManagerProps {
  webSocket?: WebSocket | null;
  isConnected?: boolean;
}

const ProviderProfileManager: React.FC<ProviderProfileManagerProps> = ({
  webSocket,
  isConnected = false
}) => {
  const [profiles, setProfiles] = useState<ProviderProfile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<ProviderProfile | null>(null);
  const [editingProfile, setEditingProfile] = useState<ProviderProfile | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<Partial<ProviderProfile>>({
    name: '',
    displayName: '',
    provider: 'anthropic',
    description: '',
    config: {
      provider: 'anthropic',
      model: '',
      apiKey: '',
      temperature: 0.7,
      maxTokens: 4096,
      baseUrl: ''
    }
  });

  const availableProviders = [
    { value: 'anthropic', label: 'Anthropic Claude', models: ['claude-3-sonnet-20240229', 'claude-3-haiku-20240307', 'claude-3-opus-20240229'] },
    { value: 'openai', label: 'OpenAI', models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
    { value: 'azure', label: 'Azure OpenAI', models: ['gpt-4', 'gpt-35-turbo'] },
    { value: 'google', label: 'Google', models: ['gemini-pro', 'gemini-pro-vision'] },
    { value: 'local', label: 'Local/Custom', models: [] }
  ];

  // Load profiles on mount
  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (webSocket && webSocket.readyState === WebSocket.OPEN) {
        // Send request via WebSocket
        webSocket.send(JSON.stringify({ type: 'settingsGet' }));
        
        // Listen for response
        const handleMessage = (event: MessageEvent) => {
          const message = JSON.parse(event.data);
          if (message.type === 'settingsData') {
            // Extract provider profiles from settings data
            // For now, simulate with mock data
            setProfiles(getMockProfiles());
            setCurrentProfile(getMockProfiles()[0]);
          }
        };
        
        webSocket.addEventListener('message', handleMessage);
        
        // Cleanup listener
        setTimeout(() => {
          webSocket.removeEventListener('message', handleMessage);
        }, 5000);
      } else {
        // Fallback to mock data for development
        setProfiles(getMockProfiles());
        setCurrentProfile(getMockProfiles()[0]);
      }
    } catch (err) {
      setError('Failed to load provider profiles');
      console.error('Error loading profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  const getMockProfiles = (): ProviderProfile[] => [
    {
      id: '1',
      name: 'default-anthropic',
      displayName: 'Default Anthropic',
      provider: 'anthropic',
      config: {
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
        apiKey: '*********************',
        temperature: 0.7,
        maxTokens: 4096
      },
      isDefault: true,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      description: 'Default Anthropic configuration'
    },
    {
      id: '2',
      name: 'openai-gpt4',
      displayName: 'OpenAI GPT-4',
      provider: 'openai',
      config: {
        provider: 'openai',
        model: 'gpt-4',
        apiKey: '*********************',
        temperature: 0.5,
        maxTokens: 2048
      },
      isDefault: false,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      description: 'OpenAI GPT-4 configuration for complex tasks'
    }
  ];

  const validateForm = (data: Partial<ProviderProfile>): boolean => {
    const errors: Record<string, string> = {};

    if (!data.name?.trim()) {
      errors.name = 'Profile name is required';
    } else if (profiles.some(p => p.name === data.name && p.id !== editingProfile?.id)) {
      errors.name = 'Profile name already exists';
    }

    if (!data.displayName?.trim()) {
      errors.displayName = 'Display name is required';
    }

    if (!data.provider) {
      errors.provider = 'Provider is required';
    }

    if (!data.config?.apiKey?.trim()) {
      errors.apiKey = 'API key is required';
    }

    if (!data.config?.model?.trim()) {
      errors.model = 'Model is required';
    }

    if (data.config?.temperature !== undefined && (data.config.temperature < 0 || data.config.temperature > 2)) {
      errors.temperature = 'Temperature must be between 0 and 2';
    }

    if (data.config?.maxTokens !== undefined && (data.config.maxTokens < 1 || data.config.maxTokens > 32000)) {
      errors.maxTokens = 'Max tokens must be between 1 and 32000';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveProfile = async () => {
    if (!validateForm(formData)) {
      return;
    }

    try {
      setSaving(true);
      setError('');

      const profileData: ProviderProfile = {
        id: editingProfile?.id || generateId(),
        name: formData.name!,
        displayName: formData.displayName!,
        provider: formData.provider!,
        config: formData.config!,
        description: formData.description,
        isDefault: formData.isDefault || false,
        created: editingProfile?.created || new Date().toISOString(),
        modified: new Date().toISOString()
      };

      if (webSocket && webSocket.readyState === WebSocket.OPEN) {
        webSocket.send(JSON.stringify({
          type: 'settingsProviderProfileSave',
          data: {
            name: profileData.name,
            config: profileData.config
          }
        }));
      }

      // Update local state
      if (editingProfile) {
        setProfiles(prev => prev.map(p => p.id === editingProfile.id ? profileData : p));
      } else {
        setProfiles(prev => [...prev, profileData]);
      }

      // Reset form
      resetForm();
      
    } catch (err) {
      setError('Failed to save profile');
      console.error('Error saving profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProfile = async (profile: ProviderProfile) => {
    if (!confirm(`Are you sure you want to delete the profile "${profile.displayName}"?`)) {
      return;
    }

    try {
      setError('');
      
      if (webSocket && webSocket.readyState === WebSocket.OPEN) {
        webSocket.send(JSON.stringify({
          type: 'settingsProviderProfileDelete',
          data: { name: profile.name }
        }));
      }

      setProfiles(prev => prev.filter(p => p.id !== profile.id));
      
      if (currentProfile?.id === profile.id) {
        setCurrentProfile(profiles.find(p => p.id !== profile.id) || null);
      }
    } catch (err) {
      setError('Failed to delete profile');
      console.error('Error deleting profile:', err);
    }
  };

  const handleSetCurrentProfile = async (profile: ProviderProfile) => {
    try {
      setError('');
      
      if (webSocket && webSocket.readyState === WebSocket.OPEN) {
        webSocket.send(JSON.stringify({
          type: 'settingsProviderSetCurrent',
          data: { name: profile.name }
        }));
      }

      setCurrentProfile(profile);
    } catch (err) {
      setError('Failed to set current profile');
      console.error('Error setting current profile:', err);
    }
  };

  const handleEditProfile = (profile: ProviderProfile) => {
    setEditingProfile(profile);
    setFormData({
      name: profile.name,
      displayName: profile.displayName,
      provider: profile.provider,
      description: profile.description,
      config: { ...profile.config }
    });
    setShowCreateForm(true);
  };

  const handleDuplicateProfile = (profile: ProviderProfile) => {
    setEditingProfile(null);
    setFormData({
      name: `${profile.name}-copy`,
      displayName: `${profile.displayName} (Copy)`,
      provider: profile.provider,
      description: profile.description,
      config: { ...profile.config }
    });
    setShowCreateForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      displayName: '',
      provider: 'anthropic',
      description: '',
      config: {
        provider: 'anthropic',
        model: '',
        apiKey: '',
        temperature: 0.7,
        maxTokens: 4096,
        baseUrl: ''
      }
    });
    setEditingProfile(null);
    setShowCreateForm(false);
    setValidationErrors({});
  };

  const generateId = () => Date.now().toString();

  const getProviderLabel = (providerValue: string) => {
    return availableProviders.find(p => p.value === providerValue)?.label || providerValue;
  };

  const getProviderModels = (providerValue: string) => {
    return availableProviders.find(p => p.value === providerValue)?.models || [];
  };

  if (loading) {
    return (
      <div className="provider-profile-manager">
        <div className="loading-state">Loading provider profiles...</div>
      </div>
    );
  }

  return (
    <div className="provider-profile-manager">
      <div className="section-header">
        <Settings size={20} />
        <h3>Provider Profile Manager</h3>
        <button 
          className="create-profile-btn"
          onClick={() => setShowCreateForm(true)}
          disabled={!isConnected}
        >
          <Plus size={16} />
          New Profile
        </button>
      </div>

      {error && (
        <div className="error-message">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="profiles-grid">
        {profiles.map((profile) => (
          <div 
            key={profile.id} 
            className={`profile-card ${currentProfile?.id === profile.id ? 'current' : ''}`}
          >
            <div className="profile-header">
              <div className="profile-info">
                <h4>{profile.displayName}</h4>
                <span className="profile-provider">{getProviderLabel(profile.provider)}</span>
                {currentProfile?.id === profile.id && (
                  <span className="current-badge">Current</span>
                )}
              </div>
              <div className="profile-actions">
                <button 
                  onClick={() => handleSetCurrentProfile(profile)}
                  disabled={currentProfile?.id === profile.id}
                  title="Set as current"
                >
                  {currentProfile?.id === profile.id ? <Star size={14} /> : <StarOff size={14} />}
                </button>
                <button 
                  onClick={() => handleEditProfile(profile)}
                  title="Edit profile"
                >
                  <Edit2 size={14} />
                </button>
                <button 
                  onClick={() => handleDuplicateProfile(profile)}
                  title="Duplicate profile"
                >
                  <Copy size={14} />
                </button>
                <button 
                  onClick={() => handleDeleteProfile(profile)}
                  className="delete-btn"
                  disabled={profiles.length <= 1}
                  title="Delete profile"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            
            <div className="profile-details">
              <div className="detail-row">
                <span>Model:</span>
                <span>{profile.config.model}</span>
              </div>
              <div className="detail-row">
                <span>Temperature:</span>
                <span>{profile.config.temperature}</span>
              </div>
              <div className="detail-row">
                <span>Max Tokens:</span>
                <span>{profile.config.maxTokens}</span>
              </div>
              {profile.description && (
                <div className="profile-description">{profile.description}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Profile Form */}
      {showCreateForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h4>{editingProfile ? 'Edit Profile' : 'Create New Profile'}</h4>
              <button onClick={resetForm} className="close-btn">
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Profile Name *</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="unique-profile-name"
                  className={validationErrors.name ? 'error' : ''}
                />
                {validationErrors.name && (
                  <span className="error-text">{validationErrors.name}</span>
                )}
              </div>

              <div className="form-group">
                <label>Display Name *</label>
                <input
                  type="text"
                  value={formData.displayName || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                  placeholder="User-friendly display name"
                  className={validationErrors.displayName ? 'error' : ''}
                />
                {validationErrors.displayName && (
                  <span className="error-text">{validationErrors.displayName}</span>
                )}
              </div>

              <div className="form-group">
                <label>Provider *</label>
                <select
                  value={formData.provider || 'anthropic'}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    provider: e.target.value,
                    config: { ...prev.config, provider: e.target.value, model: '' }
                  }))}
                  className={validationErrors.provider ? 'error' : ''}
                >
                  {availableProviders.map(provider => (
                    <option key={provider.value} value={provider.value}>
                      {provider.label}
                    </option>
                  ))}
                </select>
                {validationErrors.provider && (
                  <span className="error-text">{validationErrors.provider}</span>
                )}
              </div>

              <div className="form-group">
                <label>Model *</label>
                {getProviderModels(formData.provider || '').length > 0 ? (
                  <select
                    value={formData.config?.model || ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      config: { ...prev.config, model: e.target.value }
                    }))}
                    className={validationErrors.model ? 'error' : ''}
                  >
                    <option value="">Select a model</option>
                    {getProviderModels(formData.provider || '').map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.config?.model || ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      config: { ...prev.config, model: e.target.value }
                    }))}
                    placeholder="Enter model name"
                    className={validationErrors.model ? 'error' : ''}
                  />
                )}
                {validationErrors.model && (
                  <span className="error-text">{validationErrors.model}</span>
                )}
              </div>

              <div className="form-group">
                <label>API Key *</label>
                <input
                  type="password"
                  value={formData.config?.apiKey || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    config: { ...prev.config, apiKey: e.target.value }
                  }))}
                  placeholder="Enter API key"
                  className={validationErrors.apiKey ? 'error' : ''}
                />
                {validationErrors.apiKey && (
                  <span className="error-text">{validationErrors.apiKey}</span>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Temperature ({formData.config?.temperature || 0.7})</label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={formData.config?.temperature || 0.7}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      config: { ...prev.config, temperature: parseFloat(e.target.value) }
                    }))}
                    className={validationErrors.temperature ? 'error' : ''}
                  />
                  {validationErrors.temperature && (
                    <span className="error-text">{validationErrors.temperature}</span>
                  )}
                </div>

                <div className="form-group">
                  <label>Max Tokens</label>
                  <input
                    type="number"
                    min="1"
                    max="32000"
                    value={formData.config?.maxTokens || 4096}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      config: { ...prev.config, maxTokens: parseInt(e.target.value) }
                    }))}
                    className={validationErrors.maxTokens ? 'error' : ''}
                  />
                  {validationErrors.maxTokens && (
                    <span className="error-text">{validationErrors.maxTokens}</span>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>Base URL (Optional)</label>
                <input
                  type="url"
                  value={formData.config?.baseUrl || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    config: { ...prev.config, baseUrl: e.target.value }
                  }))}
                  placeholder="https://api.example.com"
                />
              </div>

              <div className="form-group">
                <label>Description (Optional)</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of this profile..."
                  rows={3}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={resetForm} disabled={saving}>
                Cancel
              </button>
              <button 
                onClick={handleSaveProfile} 
                className="primary"
                disabled={saving}
              >
                {saving ? 'Saving...' : (editingProfile ? 'Update Profile' : 'Create Profile')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderProfileManager;