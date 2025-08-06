import React, { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  X, 
  AlertCircle, 
  Info, 
  Plus, 
  Trash2,
  TestTube
} from 'lucide-react';
import { 
  AdvancedMode, 
  ValidationResult,
  validateAdvancedMode,
  validateFileRegex,
  AVAILABLE_TOOL_GROUPS,
  getToolsForGroups,
  createDefaultMode
} from '../types/advancedModes';
import './ModeCreator.css';

interface ModeCreatorProps {
  webSocket?: WebSocket | null;
  isConnected?: boolean;
  editingMode?: AdvancedMode | null;
  onClose: () => void;
  onSave: () => void;
}

interface Step {
  id: string;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    id: 'basic',
    title: 'Basic Information',
    description: 'Define the core identity of your mode'
  },
  {
    id: 'tools',
    title: 'Tool Groups',
    description: 'Select which tools your mode can use'
  },
  {
    id: 'restrictions',
    title: 'File Restrictions',
    description: 'Configure file access patterns (optional)'
  },
  {
    id: 'behavior',
    title: 'Behavior & Instructions',
    description: 'Customize the AI assistant behavior'
  },
  {
    id: 'review',
    title: 'Review & Save',
    description: 'Validate and save your mode'
  }
];

const ModeCreator: React.FC<ModeCreatorProps> = ({
  webSocket,
  isConnected = false,
  editingMode,
  onClose,
  onSave
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [mode, setMode] = useState<Partial<AdvancedMode>>(() => 
    editingMode || createDefaultMode()
  );
  const [validation, setValidation] = useState<ValidationResult>({ valid: true, errors: [] });
  const [saving, setSaving] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);

  // Validate the mode whenever it changes
  useEffect(() => {
    const result = validateAdvancedMode(mode);
    setValidation(result);
  }, [mode]);

  const updateMode = useCallback(<K extends keyof AdvancedMode>(
    key: K, 
    value: AdvancedMode[K]
  ) => {
    setMode(prev => ({ ...prev, [key]: value }));
  }, []);

  const canProceed = useCallback(() => {
    switch (currentStep) {
      case 0: // Basic Info
        return mode.slug && mode.name && mode.description && mode.roleDefinition;
      case 1: // Tools
        return mode.groups && mode.groups.length > 0;
      case 2: // Restrictions (optional step)
        return true;
      case 3: // Behavior
        return true;
      case 4: // Review
        return validation.valid;
      default:
        return false;
    }
  }, [currentStep, mode, validation.valid]);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1 && canProceed()) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSave = async () => {
    if (!validation.valid || !webSocket || !isConnected) return;
    
    setSaving(true);
    try {
      const modeToSave = {
        ...mode,
        source: 'custom' as const,
        modifiedAt: new Date().toISOString(),
        createdAt: editingMode?.createdAt || new Date().toISOString()
      };

      webSocket.send(JSON.stringify({
        type: editingMode ? 'updateMode' : 'createMode',
        data: modeToSave
      }));
      
      // Wait a moment for the operation to complete
      setTimeout(() => {
        setSaving(false);
        onSave();
      }, 1000);
      
    } catch (error) {
      console.error('Error saving mode:', error);
      setSaving(false);
    }
  };

  const addToolGroup = (groupName: string) => {
    const groups = mode.groups || [];
    if (!groups.find(g => (typeof g === 'string' ? g : g[0]) === groupName)) {
      updateMode('groups', [...groups, groupName]);
    }
  };

  const removeToolGroup = (index: number) => {
    const groups = mode.groups || [];
    updateMode('groups', groups.filter((_, i) => i !== index));
  };

  const updateToolGroupOptions = (index: number, options: any) => {
    const groups = mode.groups || [];
    const updatedGroups = [...groups];
    const group = updatedGroups[index];
    
    if (typeof group === 'string') {
      updatedGroups[index] = [group, options];
    } else {
      updatedGroups[index] = [group[0], options];
    }
    
    updateMode('groups', updatedGroups);
  };

  const addFileRestriction = () => {
    const restrictions = mode.fileRestrictions || [];
    updateMode('fileRestrictions', [...restrictions, { pattern: '', description: '' }]);
  };

  const updateFileRestriction = (index: number, field: 'pattern' | 'description', value: string) => {
    const restrictions = mode.fileRestrictions || [];
    const updated = [...restrictions];
    updated[index] = { ...updated[index], [field]: value };
    updateMode('fileRestrictions', updated);
  };

  const removeFileRestriction = (index: number) => {
    const restrictions = mode.fileRestrictions || [];
    updateMode('fileRestrictions', restrictions.filter((_, i) => i !== index));
  };

  const testFileRestriction = (pattern: string) => {
    try {
      const regex = new RegExp(pattern);
      const testFiles = [
        'src/components/App.tsx',
        'README.md',
        'package.json',
        'styles/main.css',
        'test/unit.test.js'
      ];
      
      const results = testFiles.map(file => ({
        file,
        matches: regex.test(file)
      }));
      
      setTestResults(results.map(r => `${r.file}: ${r.matches ? '✅' : '❌'}`));
    } catch (error) {
      setTestResults([`Error: ${error instanceof Error ? error.message : 'Invalid regex'}`]);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Basic Information
        return (
          <div className="step-content">
            <div className="form-group">
              <label htmlFor="mode-slug">
                Mode Slug *
                <span className="help-text">Unique identifier (lowercase, no spaces)</span>
              </label>
              <input
                id="mode-slug"
                type="text"
                value={mode.slug || ''}
                onChange={(e) => updateMode('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                placeholder="my-custom-mode"
                pattern="^[a-z][a-z0-9-_]*$"
              />
            </div>

            <div className="form-group">
              <label htmlFor="mode-name">
                Display Name *
              </label>
              <input
                id="mode-name"
                type="text"
                value={mode.name || ''}
                onChange={(e) => updateMode('name', e.target.value)}
                placeholder="My Custom Mode"
                maxLength={100}
              />
            </div>

            <div className="form-group">
              <label htmlFor="mode-description">
                Description *
                <span className="help-text">Brief description of what this mode does</span>
              </label>
              <textarea
                id="mode-description"
                value={mode.description || ''}
                onChange={(e) => updateMode('description', e.target.value)}
                placeholder="Specialized mode for..."
                maxLength={200}
                rows={3}
              />
              <div className="char-counter">
                {(mode.description || '').length}/200
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="role-definition">
                Role Definition *
                <span className="help-text">How the AI should introduce itself and behave</span>
              </label>
              <textarea
                id="role-definition"
                value={mode.roleDefinition || ''}
                onChange={(e) => updateMode('roleDefinition', e.target.value)}
                placeholder="You are Kilo Code, an AI assistant specialized in..."
                rows={4}
              />
            </div>

            <div className="form-group">
              <label htmlFor="when-to-use">
                When to Use (Optional)
                <span className="help-text">Help users understand when to choose this mode</span>
              </label>
              <textarea
                id="when-to-use"
                value={mode.whenToUse || ''}
                onChange={(e) => updateMode('whenToUse', e.target.value)}
                placeholder="Use this mode when you need to..."
                rows={3}
              />
            </div>
          </div>
        );

      case 1: // Tool Groups
        return (
          <div className="step-content">
            <div className="tool-groups-section">
              <div className="section-header">
                <h4>Available Tool Groups</h4>
                <p>Select which tool groups your mode should have access to:</p>
              </div>

              <div className="available-groups">
                {AVAILABLE_TOOL_GROUPS.map((group) => {
                  const isSelected = mode.groups?.some(g => 
                    (typeof g === 'string' ? g : g[0]) === group.name
                  );
                  
                  return (
                    <div key={group.name} className={`group-card ${isSelected ? 'selected' : ''}`}>
                      <div className="group-header">
                        <div className="group-info">
                          <h5>{group.name}</h5>
                          <div className="group-tools">
                            {group.tools.map(tool => (
                              <span key={tool} className="tool-tag">{tool}</span>
                            ))}
                          </div>
                        </div>
                        <button
                          className={`toggle-button ${isSelected ? 'selected' : ''}`}
                          onClick={() => isSelected 
                            ? removeToolGroup(mode.groups!.findIndex(g => 
                                (typeof g === 'string' ? g : g[0]) === group.name
                              ))
                            : addToolGroup(group.name)
                          }
                        >
                          {isSelected ? <Check size={16} /> : <Plus size={16} />}
                        </button>
                      </div>

                      {group.alwaysAvailable && (
                        <div className="group-note">
                          <Info size={14} />
                          This group is always available
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {mode.groups && mode.groups.length > 0 && (
                <div className="selected-groups">
                  <h4>Selected Groups</h4>
                  <div className="selected-groups-list">
                    {mode.groups.map((group, index) => {
                      const groupName = typeof group === 'string' ? group : group[0];
                      const groupOptions = Array.isArray(group) ? group[1] : null;
                      AVAILABLE_TOOL_GROUPS.find(g => g.name === groupName);
                      
                      return (
                        <div key={index} className="selected-group-item">
                          <div className="group-summary">
                            <span className="group-name">{groupName}</span>
                            <button
                              className="btn-icon btn-danger"
                              onClick={() => removeToolGroup(index)}
                              title="Remove group"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          {groupName === 'edit' && (
                            <div className="group-options">
                              <label>File Regex Pattern (Optional)</label>
                              <input
                                type="text"
                                value={groupOptions?.fileRegex || ''}
                                onChange={(e) => updateToolGroupOptions(index, {
                                  ...groupOptions,
                                  fileRegex: e.target.value
                                })}
                                placeholder="e.g., \.tsx?$ for TypeScript files only"
                              />
                              <input
                                type="text"
                                value={groupOptions?.description || ''}
                                onChange={(e) => updateToolGroupOptions(index, {
                                  ...groupOptions,
                                  description: e.target.value
                                })}
                                placeholder="Description of file restriction"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {mode.groups && (
                <div className="tools-preview">
                  <h4>Available Tools ({getToolsForGroups(mode.groups).length})</h4>
                  <div className="tools-list">
                    {getToolsForGroups(mode.groups).map(tool => (
                      <span key={tool} className="tool-preview-tag">{tool}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 2: // File Restrictions
        return (
          <div className="step-content">
            <div className="restrictions-section">
              <div className="section-header">
                <h4>File Restrictions (Optional)</h4>
                <p>Define additional file access patterns beyond tool group restrictions:</p>
              </div>

              <div className="restrictions-list">
                {(mode.fileRestrictions || []).map((restriction, index) => (
                  <div key={index} className="restriction-item">
                    <div className="restriction-inputs">
                      <div className="form-group">
                        <label>Regex Pattern</label>
                        <div className="input-with-test">
                          <input
                            type="text"
                            value={restriction.pattern}
                            onChange={(e) => updateFileRestriction(index, 'pattern', e.target.value)}
                            placeholder="e.g., \.md$ for markdown files only"
                          />
                          <button
                            className="test-button"
                            onClick={() => testFileRestriction(restriction.pattern)}
                            disabled={!restriction.pattern}
                            title="Test pattern"
                          >
                            <TestTube size={14} />
                          </button>
                        </div>
                        {restriction.pattern && (() => {
                          const regexValidation = validateFileRegex(restriction.pattern);
                          return !regexValidation.valid ? (
                            <div className="validation-error">
                              <AlertCircle size={14} />
                              {regexValidation.errors[0]}
                            </div>
                          ) : null;
                        })()}
                      </div>

                      <div className="form-group">
                        <label>Description</label>
                        <input
                          type="text"
                          value={restriction.description}
                          onChange={(e) => updateFileRestriction(index, 'description', e.target.value)}
                          placeholder="Description of this restriction"
                        />
                      </div>
                    </div>

                    <button
                      className="btn-icon btn-danger"
                      onClick={() => removeFileRestriction(index)}
                      title="Remove restriction"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}

                <button
                  className="btn-secondary"
                  onClick={addFileRestriction}
                >
                  <Plus size={16} />
                  Add File Restriction
                </button>

                {testResults.length > 0 && (
                  <div className="test-results">
                    <h5>Pattern Test Results:</h5>
                    <pre>{testResults.join('\n')}</pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 3: // Behavior & Instructions
        return (
          <div className="step-content">
            <div className="behavior-section">
              <div className="form-group">
                <label htmlFor="custom-instructions">
                  Custom Instructions (Optional)
                  <span className="help-text">Additional specific instructions for this mode</span>
                </label>
                <textarea
                  id="custom-instructions"
                  value={mode.customInstructions || ''}
                  onChange={(e) => updateMode('customInstructions', e.target.value)}
                  placeholder="Additional instructions for how this mode should behave..."
                  rows={8}
                />
              </div>

              <div className="form-group">
                <label htmlFor="icon-name">
                  Icon Name (Optional)
                  <span className="help-text">VS Code icon name (codicon-*)</span>
                </label>
                <input
                  id="icon-name"
                  type="text"
                  value={mode.iconName || ''}
                  onChange={(e) => updateMode('iconName', e.target.value)}
                  placeholder="codicon-gear"
                />
              </div>

              {mode.tags !== undefined && (
                <div className="form-group">
                  <label htmlFor="tags">
                    Tags (Optional)
                    <span className="help-text">Comma-separated tags for organization</span>
                  </label>
                  <input
                    id="tags"
                    type="text"
                    value={mode.tags?.join(', ') || ''}
                    onChange={(e) => updateMode('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                    placeholder="development, testing, automation"
                  />
                </div>
              )}
            </div>
          </div>
        );

      case 4: // Review & Save
        return (
          <div className="step-content">
            <div className="review-section">
              <div className="validation-status">
                {validation.valid ? (
                  <div className="validation-success">
                    <Check size={20} />
                    <span>Mode configuration is valid and ready to save!</span>
                  </div>
                ) : (
                  <div className="validation-errors">
                    <AlertCircle size={20} />
                    <div>
                      <strong>Please fix the following issues:</strong>
                      <ul>
                        {validation.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {validation.warnings && validation.warnings.length > 0 && (
                  <div className="validation-warnings">
                    <AlertCircle size={16} />
                    <div>
                      <strong>Warnings:</strong>
                      <ul>
                        {validation.warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              <div className="mode-summary">
                <h4>Mode Summary</h4>
                <div className="summary-grid">
                  <div className="summary-item">
                    <label>Name:</label>
                    <span>{mode.name}</span>
                  </div>
                  <div className="summary-item">
                    <label>Slug:</label>
                    <span>/{mode.slug}</span>
                  </div>
                  <div className="summary-item">
                    <label>Description:</label>
                    <span>{mode.description}</span>
                  </div>
                  <div className="summary-item">
                    <label>Tool Groups:</label>
                    <span>{mode.groups?.length || 0} groups</span>
                  </div>
                  <div className="summary-item">
                    <label>Available Tools:</label>
                    <span>{mode.groups ? getToolsForGroups(mode.groups).length : 0} tools</span>
                  </div>
                  <div className="summary-item">
                    <label>File Restrictions:</label>
                    <span>{mode.fileRestrictions?.length || 0} restrictions</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="mode-creator-overlay">
      <div className="mode-creator-modal">
        <div className="creator-header">
          <div className="header-content">
            <h2>{editingMode ? 'Edit Mode' : 'Create New Mode'}</h2>
            <p>{STEPS[currentStep].description}</p>
          </div>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="creator-progress">
          <div className="steps-indicator">
            {STEPS.map((step, index) => (
              <div 
                key={step.id} 
                className={`step-indicator ${
                  index === currentStep ? 'current' : 
                  index < currentStep ? 'completed' : 'pending'
                }`}
              >
                <div className="step-number">
                  {index < currentStep ? <Check size={14} /> : index + 1}
                </div>
                <span className="step-title">{step.title}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="creator-content">
          {renderStepContent()}
        </div>

        <div className="creator-footer">
          <div className="footer-left">
            {currentStep > 0 && (
              <button className="btn-secondary" onClick={handlePrevious}>
                <ArrowLeft size={16} />
                Previous
              </button>
            )}
          </div>

          <div className="footer-right">
            {currentStep < STEPS.length - 1 ? (
              <button 
                className="btn-primary" 
                onClick={handleNext}
                disabled={!canProceed()}
              >
                Next
                <ArrowRight size={16} />
              </button>
            ) : (
              <button 
                className="btn-primary" 
                onClick={handleSave}
                disabled={!validation.valid || saving || !isConnected}
              >
                {saving ? 'Saving...' : (editingMode ? 'Update Mode' : 'Create Mode')}
                <Check size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModeCreator;