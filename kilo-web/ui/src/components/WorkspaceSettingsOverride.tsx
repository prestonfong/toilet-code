import React, { useState, useEffect } from 'react';
import {
  Folder,
  Settings,
  Plus,
  Edit2,
  Trash2,
  X,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Copy
} from 'lucide-react';
import { WorkspaceSettings, ExtensionSettings } from '../types/settings';
import './WorkspaceSettingsOverride.css';

interface WorkspaceSettingsOverrideProps {
  webSocket?: WebSocket | null;
  isConnected?: boolean;
  globalSettings?: ExtensionSettings;
}

const WorkspaceSettingsOverride: React.FC<WorkspaceSettingsOverrideProps> = ({
  isConnected = false,
  globalSettings = {}
}) => {
  const [workspaces, setWorkspaces] = useState<WorkspaceSettings[]>([]);
  const [editingWorkspace, setEditingWorkspace] = useState<WorkspaceSettings | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState<Partial<WorkspaceSettings>>({
    workspaceId: '',
    workspaceName: '',
    inheritGlobal: true,
    overrides: {}
  });

  // Settings categories for organization
  const settingsCategories = [
    {
      id: 'autoApprove',
      label: 'Auto-Approve Settings',
      description: 'Override automatic approval settings for this workspace',
      fields: [
        { key: 'alwaysAllowReadOnly', label: 'Always Allow Read-Only', type: 'boolean' },
        { key: 'alwaysAllowWrite', label: 'Always Allow Write', type: 'boolean' },
        { key: 'alwaysAllowExecute', label: 'Always Allow Execute', type: 'boolean' },
        { key: 'requestDelaySeconds', label: 'Request Delay (seconds)', type: 'number', min: 0, max: 10 }
      ]
    },
    {
      id: 'browser',
      label: 'Browser Settings',
      description: 'Override browser tool settings for this workspace',
      fields: [
        { key: 'browserToolEnabled', label: 'Browser Tool Enabled', type: 'boolean' },
        { key: 'browserViewportSize', label: 'Viewport Size', type: 'select', options: ['1920x1080', '1280x720', '1024x768', '800x600'] },
        { key: 'screenshotQuality', label: 'Screenshot Quality', type: 'range', min: 10, max: 100 }
      ]
    },
    {
      id: 'contextManagement',
      label: 'Context Management',
      description: 'Override context and file handling settings',
      fields: [
        { key: 'maxOpenTabsContext', label: 'Max Open Tabs in Context', type: 'number', min: 1, max: 20 },
        { key: 'maxWorkspaceFiles', label: 'Max Workspace Files', type: 'number', min: 50, max: 1000 },
        { key: 'maxReadFileLine', label: 'Max Read File Lines', type: 'number', min: 100, max: 10000 }
      ]
    },
    {
      id: 'terminal',
      label: 'Terminal Settings',
      description: 'Override terminal behavior for this workspace',
      fields: [
        { key: 'terminalOutputLineLimit', label: 'Output Line Limit', type: 'number', min: 100, max: 5000 },
        { key: 'terminalOutputCharacterLimit', label: 'Output Character Limit', type: 'number', min: 1000, max: 200000 },
        { key: 'terminalCommandDelay', label: 'Command Delay (ms)', type: 'number', min: 0, max: 5000 }
      ]
    }
  ];

  useEffect(() => {
    loadWorkspaceSettings();
  }, []);

  const loadWorkspaceSettings = async () => {
    try {
      setLoading(true);
      setError('');
      
      // For now, use mock data since workspace settings aren't fully implemented in the backend
      const mockWorkspaces: WorkspaceSettings[] = [
        {
          workspaceId: 'project-alpha',
          workspaceName: 'Project Alpha',
          inheritGlobal: true,
          overrides: {
            alwaysAllowReadOnly: true,
            maxWorkspaceFiles: 500,
            terminalOutputLineLimit: 1000
          },
          created: new Date().toISOString(),
          modified: new Date().toISOString()
        },
        {
          workspaceId: 'project-beta',
          workspaceName: 'Project Beta',
          inheritGlobal: false,
          overrides: {
            alwaysAllowWrite: false,
            browserToolEnabled: false,
            maxOpenTabsContext: 3
          },
          created: new Date().toISOString(),
          modified: new Date().toISOString()
        }
      ];

      setWorkspaces(mockWorkspaces);
    } catch (err) {
      setError('Failed to load workspace settings');
      console.error('Error loading workspace settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWorkspace = async () => {
    if (!formData.workspaceId?.trim() || !formData.workspaceName?.trim()) {
      setError('Workspace ID and name are required');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const workspaceData: WorkspaceSettings = {
        workspaceId: formData.workspaceId!,
        workspaceName: formData.workspaceName!,
        inheritGlobal: formData.inheritGlobal || true,
        overrides: formData.overrides || {},
        created: editingWorkspace?.created || new Date().toISOString(),
        modified: new Date().toISOString()
      };

      // Update local state
      if (editingWorkspace) {
        setWorkspaces(prev => prev.map(w => 
          w.workspaceId === editingWorkspace.workspaceId ? workspaceData : w
        ));
      } else {
        setWorkspaces(prev => [...prev, workspaceData]);
      }

      // Reset form
      resetForm();
      
    } catch (err) {
      setError('Failed to save workspace settings');
      console.error('Error saving workspace:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWorkspace = async (workspace: WorkspaceSettings) => {
    if (!confirm(`Are you sure you want to delete workspace settings for "${workspace.workspaceName}"?`)) {
      return;
    }

    try {
      setError('');
      setWorkspaces(prev => prev.filter(w => w.workspaceId !== workspace.workspaceId));
    } catch (err) {
      setError('Failed to delete workspace settings');
      console.error('Error deleting workspace:', err);
    }
  };

  const handleEditWorkspace = (workspace: WorkspaceSettings) => {
    setEditingWorkspace(workspace);
    setFormData({
      workspaceId: workspace.workspaceId,
      workspaceName: workspace.workspaceName,
      inheritGlobal: workspace.inheritGlobal,
      overrides: { ...workspace.overrides }
    });
    setShowCreateForm(true);
  };

  const handleDuplicateWorkspace = (workspace: WorkspaceSettings) => {
    setEditingWorkspace(null);
    setFormData({
      workspaceId: `${workspace.workspaceId}-copy`,
      workspaceName: `${workspace.workspaceName} (Copy)`,
      inheritGlobal: workspace.inheritGlobal,
      overrides: { ...workspace.overrides }
    });
    setShowCreateForm(true);
  };

  const resetForm = () => {
    setFormData({
      workspaceId: '',
      workspaceName: '',
      inheritGlobal: true,
      overrides: {}
    });
    setEditingWorkspace(null);
    setShowCreateForm(false);
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const updateOverride = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      overrides: {
        ...prev.overrides,
        [key]: value
      }
    }));
  };

  const removeOverride = (key: string) => {
    setFormData(prev => {
      const overrides = prev.overrides || {};
      const newOverrides = { ...overrides };
      delete newOverrides[key as keyof ExtensionSettings];
      return {
        ...prev,
        overrides: newOverrides
      };
    });
  };

  const hasOverride = (key: string) => {
    return formData.overrides && key in formData.overrides;
  };

  const getGlobalValue = (key: string) => {
    return globalSettings[key as keyof ExtensionSettings];
  };


  const renderFieldInput = (field: any, value: any, onChange: (value: any) => void) => {
    switch (field.type) {
      case 'boolean':
        return (
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => onChange(e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        );
      
      case 'number':
        return (
          <input
            type="number"
            value={value || field.min || 0}
            onChange={(e) => onChange(parseInt(e.target.value))}
            min={field.min}
            max={field.max}
            className="number-input"
          />
        );
      
      case 'range':
        return (
          <div className="range-input-container">
            <input
              type="range"
              value={value || field.min || 0}
              onChange={(e) => onChange(parseInt(e.target.value))}
              min={field.min}
              max={field.max}
              className="range-input"
            />
            <span className="range-value">{value || field.min || 0}</span>
          </div>
        );
      
      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="select-input"
          >
            <option value="">Select...</option>
            {field.options?.map((option: string) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );
      
      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="text-input"
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="workspace-settings-override">
        <div className="loading-state">Loading workspace settings...</div>
      </div>
    );
  }

  return (
    <div className="workspace-settings-override">
      <div className="section-header">
        <Folder size={20} />
        <h3>Workspace Settings Override</h3>
        <button 
          className="create-workspace-btn"
          onClick={() => setShowCreateForm(true)}
          disabled={!isConnected}
        >
          <Plus size={16} />
          New Workspace Override
        </button>
      </div>

      <div className="section-description">
        <Settings size={16} />
        <p>
          Override global settings for specific workspaces. Workspace settings take precedence 
          over global settings, allowing you to customize behavior per project.
        </p>
      </div>

      {error && (
        <div className="error-message">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="workspaces-list">
        {workspaces.length === 0 ? (
          <div className="empty-state">
            <Folder size={48} />
            <h4>No Workspace Overrides</h4>
            <p>Create workspace-specific settings to override global configuration.</p>
          </div>
        ) : (
          workspaces.map((workspace) => (
            <div key={workspace.workspaceId} className="workspace-card">
              <div className="workspace-header">
                <div className="workspace-info">
                  <h4>{workspace.workspaceName}</h4>
                  <span className="workspace-id">{workspace.workspaceId}</span>
                  <div className="workspace-meta">
                    <span className={`inherit-badge ${workspace.inheritGlobal ? 'inherit' : 'standalone'}`}>
                      {workspace.inheritGlobal ? 'Inherits Global' : 'Standalone'}
                    </span>
                    <span className="override-count">
                      {Object.keys(workspace.overrides).length} override{Object.keys(workspace.overrides).length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <div className="workspace-actions">
                  <button 
                    onClick={() => handleEditWorkspace(workspace)}
                    title="Edit workspace"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button 
                    onClick={() => handleDuplicateWorkspace(workspace)}
                    title="Duplicate workspace"
                  >
                    <Copy size={14} />
                  </button>
                  <button 
                    onClick={() => handleDeleteWorkspace(workspace)}
                    className="delete-btn"
                    title="Delete workspace"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              
              {Object.keys(workspace.overrides).length > 0 && (
                <div className="workspace-overrides">
                  <h5>Active Overrides</h5>
                  <div className="overrides-grid">
                    {Object.entries(workspace.overrides).map(([key, value]) => (
                      <div key={key} className="override-item">
                        <span className="override-key">{key}</span>
                        <span className="override-value">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Workspace Form */}
      {showCreateForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h4>{editingWorkspace ? 'Edit Workspace Override' : 'Create Workspace Override'}</h4>
              <button onClick={resetForm} className="close-btn">
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-section">
                <h5>Workspace Information</h5>
                <div className="form-group">
                  <label>Workspace ID *</label>
                  <input
                    type="text"
                    value={formData.workspaceId || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, workspaceId: e.target.value }))}
                    placeholder="unique-workspace-id"
                    disabled={!!editingWorkspace}
                  />
                </div>

                <div className="form-group">
                  <label>Workspace Name *</label>
                  <input
                    type="text"
                    value={formData.workspaceName || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, workspaceName: e.target.value }))}
                    placeholder="User-friendly workspace name"
                  />
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.inheritGlobal || false}
                      onChange={(e) => setFormData(prev => ({ ...prev, inheritGlobal: e.target.checked }))}
                    />
                    Inherit global settings for non-overridden values
                  </label>
                </div>
              </div>

              <div className="form-section">
                <h5>Setting Overrides</h5>
                <p className="section-note">
                  Only add overrides for settings you want to customize for this workspace.
                </p>

                {settingsCategories.map((category) => (
                  <div key={category.id} className="settings-category">
                    <button
                      className="category-header"
                      onClick={() => toggleSection(category.id)}
                      type="button"
                    >
                      <span className="category-title">{category.label}</span>
                      <span className="category-description">{category.description}</span>
                      {expandedSections.has(category.id) ? (
                        <ToggleRight size={16} />
                      ) : (
                        <ToggleLeft size={16} />
                      )}
                    </button>

                    {expandedSections.has(category.id) && (
                      <div className="category-content">
                        {category.fields.map((field) => (
                          <div key={field.key} className="field-override">
                            <div className="field-header">
                              <span className="field-label">{field.label}</span>
                              <div className="field-controls">
                                {hasOverride(field.key) ? (
                                  <button
                                    onClick={() => removeOverride(field.key)}
                                    className="remove-override"
                                    type="button"
                                  >
                                    <X size={12} />
                                    Remove Override
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => updateOverride(field.key, getGlobalValue(field.key) || '')}
                                    className="add-override"
                                    type="button"
                                  >
                                    <Plus size={12} />
                                    Add Override
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="field-values">
                              <div className="global-value">
                                <span className="value-label">Global:</span>
                                <span className="value-display">
                                  {String(getGlobalValue(field.key) ?? 'Not set')}
                                </span>
                              </div>

                              {hasOverride(field.key) && (
                                <div className="override-value">
                                  <span className="value-label">Override:</span>
                                  <div className="value-input">
                                    {renderFieldInput(
                                      field,
                                      formData.overrides?.[field.key as keyof ExtensionSettings],
                                      (value) => updateOverride(field.key, value)
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={resetForm} disabled={saving}>
                Cancel
              </button>
              <button 
                onClick={handleSaveWorkspace} 
                className="primary"
                disabled={saving || !formData.workspaceId?.trim() || !formData.workspaceName?.trim()}
              >
                {saving ? 'Saving...' : (editingWorkspace ? 'Update Workspace' : 'Create Workspace')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceSettingsOverride;