import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Download,
  Upload,
  Settings,
  Play,
  AlertCircle,
  CheckCircle,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  AdvancedMode,
  ModeStats,
  ValidationResult,
  validateAdvancedMode,
  getToolsForGroups
} from '../types/advancedModes';
import ModeCreator from './ModeCreator';
import './AdvancedModeManager.css';

interface AdvancedModeManagerProps {
  webSocket?: WebSocket | null;
  isConnected?: boolean;
}

interface ModeListItem extends AdvancedMode {
  isActive?: boolean;
  toolCount?: number;
}

const AdvancedModeManager: React.FC<AdvancedModeManagerProps> = ({ 
  webSocket, 
  isConnected = false 
}) => {
  const [modes, setModes] = useState<ModeListItem[]>([]);
  const [currentModeSlug, setCurrentModeSlug] = useState<string>('code');
  const [stats, setStats] = useState<ModeStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreator, setShowCreator] = useState(false);
  const [editingMode, setEditingMode] = useState<AdvancedMode | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSource, setFilterSource] = useState<'all' | 'built-in' | 'custom'>('all');
  const [showDetails, setShowDetails] = useState<Record<string, boolean>>({});
  const [validationResults, setValidationResults] = useState<Record<string, ValidationResult>>({});

  // Load modes on mount and when connected
  useEffect(() => {
    if (isConnected) {
      loadModes();
    }
  }, [isConnected]);

  // WebSocket message handler
  useEffect(() => {
    if (!webSocket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'modesAvailable':
            if (data.data && Array.isArray(data.data)) {
              const modesWithStats = data.data.map((mode: AdvancedMode) => ({
                ...mode,
                toolCount: mode.groups ? getToolsForGroups(mode.groups).length : 0,
                isActive: mode.slug === currentModeSlug
              }));
              setModes(modesWithStats);
              
              // Validate all custom modes
              const validations: Record<string, ValidationResult> = {};
              modesWithStats.forEach((mode: AdvancedMode) => {
                if (mode.source === 'custom') {
                  validations[mode.slug] = validateAdvancedMode(mode);
                }
              });
              setValidationResults(validations);
            }
            break;
            
          case 'modeChanged':
            if (data.data?.slug) {
              setCurrentModeSlug(data.data.slug);
              setModes(prev => prev.map(mode => ({
                ...mode,
                isActive: mode.slug === data.data.slug
              })));
            }
            break;
            
          case 'modeCreated':
          case 'modeUpdated':
          case 'modeDeleted':
            loadModes(); // Refresh the list
            break;
            
          case 'modeStats':
            if (data.data) {
              setStats(data.data);
            }
            break;
            
          case 'error':
            setError(data.message || 'An error occurred');
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    webSocket.addEventListener('message', handleMessage);
    return () => webSocket.removeEventListener('message', handleMessage);
  }, [webSocket, currentModeSlug]);

  const loadModes = useCallback(async () => {
    if (!webSocket || !isConnected) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Request modes and current mode
      webSocket.send(JSON.stringify({ type: 'getModes' }));
      webSocket.send(JSON.stringify({ type: 'getCurrentMode' }));
      
      // Request mode stats if available
      webSocket.send(JSON.stringify({ type: 'getModeStats' }));
    } catch (error) {
      setError('Failed to load modes');
      console.error('Error loading modes:', error);
    } finally {
      setLoading(false);
    }
  }, [webSocket, isConnected]);

  const handleCreateMode = () => {
    setEditingMode(null);
    setShowCreator(true);
  };

  const handleEditMode = (mode: AdvancedMode) => {
    setEditingMode(mode);
    setShowCreator(true);
  };

  const handleDeleteMode = async (modeSlug: string) => {
    const mode = modes.find(m => m.slug === modeSlug);
    if (!mode || mode.source === 'built-in') return;
    
    if (!confirm(`Are you sure you want to delete the "${mode.name}" mode? This action cannot be undone.`)) {
      return;
    }
    
    if (!webSocket || !isConnected) {
      setError('Not connected to server');
      return;
    }
    
    try {
      webSocket.send(JSON.stringify({ 
        type: 'deleteMode',
        modeSlug
      }));
    } catch (error) {
      setError('Failed to delete mode');
      console.error('Error deleting mode:', error);
    }
  };

  const handleSwitchMode = async (modeSlug: string) => {
    if (!webSocket || !isConnected) {
      setError('Not connected to server');
      return;
    }
    
    try {
      webSocket.send(JSON.stringify({ 
        type: 'switchMode',
        mode: modeSlug
      }));
    } catch (error) {
      setError('Failed to switch mode');
      console.error('Error switching mode:', error);
    }
  };

  const handleDuplicateMode = (mode: AdvancedMode) => {
    const duplicatedMode = {
      ...mode,
      slug: `${mode.slug}-copy`,
      name: `${mode.name} (Copy)`,
      source: 'custom' as const
    };
    setEditingMode(duplicatedMode);
    setShowCreator(true);
  };

  const handleExportModes = async () => {
    if (!webSocket || !isConnected) {
      setError('Not connected to server');
      return;
    }
    
    try {
      webSocket.send(JSON.stringify({ type: 'exportModes' }));
    } catch (error) {
      setError('Failed to export modes');
      console.error('Error exporting modes:', error);
    }
  };

  const handleImportModes = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const importData = JSON.parse(text);
        
        if (!webSocket || !isConnected) {
          setError('Not connected to server');
          return;
        }
        
        webSocket.send(JSON.stringify({ 
          type: 'importModes',
          data: importData
        }));
      } catch (error) {
        setError('Failed to import modes - invalid file format');
        console.error('Error importing modes:', error);
      }
    };
    input.click();
  };

  const toggleDetails = (modeSlug: string) => {
    setShowDetails(prev => ({
      ...prev,
      [modeSlug]: !prev[modeSlug]
    }));
  };

  const filteredModes = modes.filter(mode => {
    const matchesSearch = mode.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         mode.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         mode.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterSource === 'all' || mode.source === filterSource;
    
    return matchesSearch && matchesFilter;
  });

  const getValidationIcon = (modeSlug: string) => {
    const validation = validationResults[modeSlug];
    if (!validation) return null;
    
    if (!validation.valid) {
      return <AlertCircle size={16} className="validation-error" />;
    }
    
    if (validation.warnings && validation.warnings.length > 0) {
      return <AlertCircle size={16} className="validation-warning" />;
    }
    
    return <CheckCircle size={16} className="validation-success" />;
  };

  if (showCreator) {
    return (
      <ModeCreator
        webSocket={webSocket}
        isConnected={isConnected}
        editingMode={editingMode}
        onClose={() => {
          setShowCreator(false);
          setEditingMode(null);
        }}
        onSave={() => {
          setShowCreator(false);
          setEditingMode(null);
          loadModes();
        }}
      />
    );
  }

  return (
    <div className="advanced-mode-manager">
      <div className="mode-manager-header">
        <div className="header-title">
          <h3>Advanced Mode Management</h3>
          <p>Create and manage custom AI assistant modes with specialized tools and behaviors.</p>
        </div>
        
        <div className="header-actions">
          <button 
            className="btn-secondary"
            onClick={handleExportModes}
            disabled={!isConnected}
            title="Export all custom modes"
          >
            <Download size={16} />
            Export
          </button>
          <button 
            className="btn-secondary"
            onClick={handleImportModes}
            disabled={!isConnected}
            title="Import modes from file"
          >
            <Upload size={16} />
            Import
          </button>
          <button 
            className="btn-primary"
            onClick={handleCreateMode}
            disabled={!isConnected}
          >
            <Plus size={16} />
            Create Mode
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <AlertCircle size={16} />
          {error}
          <button onClick={() => setError(null)} className="error-dismiss">×</button>
        </div>
      )}

      <div className="mode-manager-controls">
        <div className="search-filter-group">
          <input
            type="text"
            placeholder="Search modes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value as any)}
            className="filter-select"
          >
            <option value="all">All Modes</option>
            <option value="built-in">Built-in</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {stats && (
          <div className="mode-stats">
            <div className="stat-item">
              <span className="stat-label">Total:</span>
              <span className="stat-value">{stats.totalModes}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Custom:</span>
              <span className="stat-value">{stats.customModes}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Current:</span>
              <span className="stat-value">{stats.currentMode}</span>
            </div>
          </div>
        )}
      </div>

      <div className="modes-list">
        {loading && (
          <div className="loading-state">
            <div className="loading-spinner" />
            Loading modes...
          </div>
        )}

        {!loading && filteredModes.length === 0 && (
          <div className="empty-state">
            <Settings size={48} className="empty-icon" />
            <h4>No modes found</h4>
            <p>
              {searchTerm || filterSource !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'Create your first custom mode to get started.'
              }
            </p>
            {!searchTerm && filterSource === 'all' && (
              <button className="btn-primary" onClick={handleCreateMode}>
                <Plus size={16} />
                Create Your First Mode
              </button>
            )}
          </div>
        )}

        {filteredModes.map((mode) => (
          <div 
            key={mode.slug} 
            className={`mode-card ${mode.isActive ? 'active' : ''} ${mode.source}`}
          >
            <div className="mode-card-header">
              <div className="mode-info">
                <div className="mode-title">
                  <h4>{mode.name}</h4>
                  <div className="mode-badges">
                    {mode.source === 'custom' && getValidationIcon(mode.slug)}
                    <span className={`source-badge ${mode.source}`}>
                      {mode.source}
                    </span>
                    {mode.isActive && (
                      <span className="active-badge">Current</span>
                    )}
                  </div>
                </div>
                <p className="mode-description">{mode.description}</p>
                <div className="mode-meta">
                  <span className="mode-slug">/{mode.slug}</span>
                  <span className="tool-count">{mode.toolCount} tools</span>
                  {mode.groups && (
                    <span className="group-count">{mode.groups.length} groups</span>
                  )}
                </div>
              </div>
              
              <div className="mode-actions">
                <button
                  className="btn-icon"
                  onClick={() => toggleDetails(mode.slug)}
                  title={showDetails[mode.slug] ? 'Hide details' : 'Show details'}
                >
                  {showDetails[mode.slug] ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                
                {!mode.isActive && (
                  <button
                    className="btn-icon"
                    onClick={() => handleSwitchMode(mode.slug)}
                    title="Switch to this mode"
                    disabled={!isConnected}
                  >
                    <Play size={16} />
                  </button>
                )}
                
                <button
                  className="btn-icon"
                  onClick={() => handleDuplicateMode(mode)}
                  title="Duplicate mode"
                  disabled={!isConnected}
                >
                  <Copy size={16} />
                </button>
                
                {mode.source === 'custom' && (
                  <>
                    <button
                      className="btn-icon"
                      onClick={() => handleEditMode(mode)}
                      title="Edit mode"
                      disabled={!isConnected}
                    >
                      <Edit size={16} />
                    </button>
                    
                    <button
                      className="btn-icon btn-danger"
                      onClick={() => handleDeleteMode(mode.slug)}
                      title="Delete mode"
                      disabled={!isConnected}
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {showDetails[mode.slug] && (
              <div className="mode-details">
                <div className="detail-section">
                  <h5>Role Definition</h5>
                  <p className="role-definition">{mode.roleDefinition}</p>
                </div>

                {mode.whenToUse && (
                  <div className="detail-section">
                    <h5>When to Use</h5>
                    <p>{mode.whenToUse}</p>
                  </div>
                )}

                {mode.groups && mode.groups.length > 0 && (
                  <div className="detail-section">
                    <h5>Tool Groups</h5>
                    <div className="tool-groups">
                      {mode.groups.map((group, index) => {
                        const groupName = typeof group === 'string' ? group : group[0];
                        const options = Array.isArray(group) ? group[1] : null;
                        
                        return (
                          <div key={index} className="tool-group-item">
                            <span className="group-name">{groupName}</span>
                            {options && (
                              <div className="group-options">
                                {Object.entries(options).map(([key, value]) => (
                                  <span key={key} className="option">
                                    {key}: {String(value)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {mode.customInstructions && (
                  <div className="detail-section">
                    <h5>Custom Instructions</h5>
                    <pre className="custom-instructions">{mode.customInstructions}</pre>
                  </div>
                )}

                {mode.source === 'custom' && validationResults[mode.slug] && (
                  <div className="detail-section">
                    <h5>Validation Status</h5>
                    <div className={`validation-status ${validationResults[mode.slug].valid ? 'valid' : 'invalid'}`}>
                      {validationResults[mode.slug].valid ? (
                        <div className="validation-success">
                          <CheckCircle size={16} />
                          Mode configuration is valid
                        </div>
                      ) : (
                        <div className="validation-errors">
                          <AlertCircle size={16} />
                          <ul>
                            {validationResults[mode.slug].errors.map((error, index) => (
                              <li key={index}>{error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {validationResults[mode.slug].warnings && validationResults[mode.slug].warnings!.length > 0 && (
                        <div className="validation-warnings">
                          <h6>Warnings:</h6>
                          <ul>
                            {validationResults[mode.slug].warnings!.map((warning, index) => (
                              <li key={index}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdvancedModeManager;