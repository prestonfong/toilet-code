import React, { useState, useRef } from 'react';
import { 
  Download, 
  Upload, 
  FileText, 
  Check, 
  AlertTriangle, 
  X, 
  Info,
  Settings,
  Database,
  Shield,
  Eye,
  Lock,
  Archive,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { SettingsImportOptions } from '../types/settings';
import './SettingsImportExport.css';

interface SettingsImportExportProps {
  webSocket?: WebSocket | null;
  isConnected?: boolean;
}

interface ImportPreview {
  valid: boolean;
  version: string;
  exportDate: string;
  source: string;
  platform: string;
  categories: {
    [key: string]: {
      hasData: boolean;
      conflicts: string[];
      changes: {
        additions: string[];
        modifications: string[];
        deletions: string[];
      };
    };
  };
  conflicts: string[];
  warnings: string[];
  errors: string[];
}

interface ExportOptions {
  includeCategories: string[];
  encrypted: boolean;
  password: string;
  selective: boolean;
  metadata: any;
}

interface ImportResult {
  success: boolean;
  imported: { [key: string]: boolean };
  errors: string[];
  warnings: string[];
  backupCreated: boolean;
}

const SettingsImportExport: React.FC<SettingsImportExportProps> = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [importData, setImportData] = useState<any | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showImportOptions, setShowImportOptions] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [showImportResult, setShowImportResult] = useState(false);
  const [importOptions, setImportOptions] = useState<SettingsImportOptions>({
    overwriteExisting: false,
    mergeSettings: true,
    importProfiles: true,
    importWorkspaceSettings: true,
    importModeConfigs: true,
    validateBeforeImport: true
  });
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeCategories: ['all'],
    encrypted: false,
    password: '',
    selective: false,
    metadata: {}
  });
  const [importPassword, setImportPassword] = useState('');
  const [, setValidationResults] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      // Use HTTP API for comprehensive export
      const response = await fetch('/api/settings/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exportOptions)
      });

      if (!response.ok) {
        throw new Error('Export request failed');
      }

      const result = await response.json();
      if (result.success) {
        downloadExportData(result.exportData);
        setSuccess('Settings exported successfully!');
      } else {
        setError(result.error || 'Export failed');
      }
    } catch (err) {
      setError('Failed to export settings');
      console.error('Export error:', err);
    } finally {
      setLoading(false);
      setShowExportOptions(false);
    }
  };

  const handleExportWithOptions = () => {
    setShowExportOptions(true);
  };

  const downloadExportData = (data: any) => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `kilo-settings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        
        // Validate the structure
        if (!data.version || !data.categories) {
          throw new Error('Invalid settings file format');
        }

        setImportData(data);
        
        // Create comprehensive preview
        const preview = await createImportPreview(data);
        setImportPreview(preview);
        setShowImportOptions(true);
        setError('');
      } catch (err) {
        setError('Invalid settings file. Please select a valid Kilo settings export file.');
        console.error('Parse error:', err);
      }
    };

    reader.readAsText(file);
  };

  const createImportPreview = async (data: any): Promise<ImportPreview> => {
    try {
      const response = await fetch('/api/settings/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importData: data, password: importPassword })
      });

      if (response.ok) {
        const result = await response.json();
        return result.preview;
      } else {
        // Fallback to basic preview
        return createBasicPreview(data);
      }
    } catch (error) {
      console.error('Preview creation failed:', error);
      return createBasicPreview(data);
    }
  };

  const createBasicPreview = (data: any): ImportPreview => {
    const categories: { [key: string]: any } = {};
    
    for (const [category, categoryData] of Object.entries(data.categories || {})) {
      categories[category] = {
        hasData: !!categoryData && Object.keys(categoryData as any).length > 0,
        conflicts: [],
        changes: { additions: [], modifications: [], deletions: [] }
      };
    }

    return {
      valid: !!(data.version && data.categories),
      version: data.version || 'unknown',
      exportDate: data.exportDate || data.timestamp || 'unknown',
      source: data.source || 'unknown',
      platform: data.platform || data.metadata?.platform || 'unknown',
      categories,
      conflicts: [],
      warnings: [],
      errors: []
    };
  };

  const handleImport = async () => {
    if (!importData) return;

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      // Build comprehensive import options
      const fullImportOptions = {
        ...importOptions,
        mergeMode: importOptions.mergeSettings ? 'merge' : 'replace',
        validateBeforeImport: importOptions.validateBeforeImport,
        createBackup: true,
        rollbackOnError: true,
        password: importPassword || undefined
      };

      const response = await fetch('/api/settings/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importData: importData,
          options: fullImportOptions
        })
      });

      const result = await response.json();
      setImportResult(result);

      if (result.success) {
        setSuccess('Settings imported successfully!');
        setShowImportResult(true);
        resetImport();
      } else {
        setError(`Import failed: ${result.errors.join(', ')}`);
        setShowImportResult(true);
      }
    } catch (err) {
      setError('Failed to import settings');
      console.error('Import error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleValidateImport = async () => {
    if (!importData) return;

    try {
      setLoading(true);
      const response = await fetch('/api/settings/import/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importData: importData,
          password: importPassword || undefined
        })
      });

      const result = await response.json();
      setValidationResults(result);
    } catch (err) {
      setError('Validation failed');
      console.error('Validation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetImport = () => {
    setImportData(null);
    setImportPreview(null);
    setShowImportOptions(false);
    setImportPassword('');
    setValidationResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  return (
    <div className="settings-import-export">
      <div className="section-header">
        <Database size={20} />
        <h3>Settings Import & Export</h3>
      </div>

      <div className="section-description">
        <Info size={16} />
        <p>
          Export your current settings to a JSON file for backup or sharing, 
          or import settings from a previously exported file. Advanced options 
          include encryption, selective export, and comprehensive validation.
        </p>
      </div>

      {error && (
        <div className="message error">
          <AlertTriangle size={16} />
          <span>{error}</span>
          <button onClick={clearMessages} className="close-message">
            <X size={14} />
          </button>
        </div>
      )}

      {success && (
        <div className="message success">
          <Check size={16} />
          <span>{success}</span>
          <button onClick={clearMessages} className="close-message">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="export-section">
        <div className="section-card">
          <div className="card-header">
            <Download size={18} />
            <h4>Export Settings</h4>
          </div>
          <div className="card-content">
            <p>
              Create a comprehensive backup of your settings with advanced options 
              for selective export, encryption, and metadata.
            </p>
            <div className="button-group">
              <button 
                onClick={handleExport}
                disabled={loading}
                className="export-btn secondary"
              >
                {loading ? 'Exporting...' : 'Quick Export'}
              </button>
              <button 
                onClick={handleExportWithOptions}
                disabled={loading}
                className="export-btn primary"
              >
                <Settings size={16} />
                Advanced Export
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="import-section">
        <div className="section-card">
          <div className="card-header">
            <Upload size={18} />
            <h4>Import Settings</h4>
          </div>
          <div className="card-content">
            <p>
              Restore settings from a previously exported file with comprehensive 
              validation, conflict resolution, and rollback support.
            </p>
            
            <div className="file-input-container">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".json"
                className="file-input"
                id="settings-file-input"
              />
              <label htmlFor="settings-file-input" className="file-input-label">
                <FileText size={16} />
                Choose Settings File
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Export Options Modal */}
      {showExportOptions && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h4>Advanced Export Options</h4>
              <button onClick={() => setShowExportOptions(false)} className="close-btn">
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="export-options">
                <div className="option-group">
                  <h6>Export Categories</h6>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={exportOptions.includeCategories.includes('all')}
                      onChange={(e) => setExportOptions(prev => ({
                        ...prev,
                        includeCategories: e.target.checked ? ['all'] : []
                      }))}
                    />
                    Export All Categories
                  </label>
                  {!exportOptions.includeCategories.includes('all') && (
                    <>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={exportOptions.includeCategories.includes('providerSettings')}
                          onChange={(e) => {
                            const cats = exportOptions.includeCategories.filter(c => c !== 'providerSettings');
                            if (e.target.checked) cats.push('providerSettings');
                            setExportOptions(prev => ({ ...prev, includeCategories: cats }));
                          }}
                        />
                        Provider Settings
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={exportOptions.includeCategories.includes('globalSettings')}
                          onChange={(e) => {
                            const cats = exportOptions.includeCategories.filter(c => c !== 'globalSettings');
                            if (e.target.checked) cats.push('globalSettings');
                            setExportOptions(prev => ({ ...prev, includeCategories: cats }));
                          }}
                        />
                        Global Settings
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={exportOptions.includeCategories.includes('advancedSettings')}
                          onChange={(e) => {
                            const cats = exportOptions.includeCategories.filter(c => c !== 'advancedSettings');
                            if (e.target.checked) cats.push('advancedSettings');
                            setExportOptions(prev => ({ ...prev, includeCategories: cats }));
                          }}
                        />
                        Advanced Settings
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={exportOptions.includeCategories.includes('mcpServers')}
                          onChange={(e) => {
                            const cats = exportOptions.includeCategories.filter(c => c !== 'mcpServers');
                            if (e.target.checked) cats.push('mcpServers');
                            setExportOptions(prev => ({ ...prev, includeCategories: cats }));
                          }}
                        />
                        MCP Servers
                      </label>
                    </>
                  )}
                </div>

                <div className="option-group">
                  <h6>Security Options</h6>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={exportOptions.encrypted}
                      onChange={(e) => setExportOptions(prev => ({ 
                        ...prev, encrypted: e.target.checked 
                      }))}
                    />
                    <Shield size={16} />
                    Encrypt export with password
                  </label>
                  {exportOptions.encrypted && (
                    <div className="password-input">
                      <input
                        type="password"
                        placeholder="Enter encryption password"
                        value={exportOptions.password}
                        onChange={(e) => setExportOptions(prev => ({ 
                          ...prev, password: e.target.value 
                        }))}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setShowExportOptions(false)} disabled={loading}>
                Cancel
              </button>
              <button 
                onClick={handleExport} 
                className="primary"
                disabled={loading || (exportOptions.encrypted && !exportOptions.password)}
              >
                {loading ? 'Exporting...' : 'Export Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Import Preview and Options Modal */}
      {showImportOptions && importPreview && (
        <div className="modal-overlay">
          <div className="modal-content large">
            <div className="modal-header">
              <h4>Import Settings Preview</h4>
              <button onClick={resetImport} className="close-btn">
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="import-preview">
                {/* Validation Status */}
                {importPreview.valid ? (
                  <div className="validation-status success">
                    <Check size={16} />
                    <span>Import file is valid</span>
                  </div>
                ) : (
                  <div className="validation-status error">
                    <XCircle size={16} />
                    <span>Import file has validation errors</span>
                  </div>
                )}

                {/* Errors and Warnings */}
                {importPreview.errors.length > 0 && (
                  <div className="validation-messages error">
                    <h6>Errors:</h6>
                    <ul>
                      {importPreview.errors.map((error, idx) => (
                        <li key={idx}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {importPreview.warnings.length > 0 && (
                  <div className="validation-messages warning">
                    <h6>Warnings:</h6>
                    <ul>
                      {importPreview.warnings.map((warning, idx) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <h5>File Information</h5>
                <div className="preview-info">
                  <div className="info-row">
                    <span>Version:</span>
                    <span>{importPreview.version}</span>
                  </div>
                  <div className="info-row">
                    <span>Exported:</span>
                    <span>{formatDate(importPreview.exportDate)}</span>
                  </div>
                  <div className="info-row">
                    <span>Source:</span>
                    <span>{importPreview.source}</span>
                  </div>
                  <div className="info-row">
                    <span>Platform:</span>
                    <span>{importPreview.platform}</span>
                  </div>
                </div>

                <h5>Categories & Changes</h5>
                <div className="categories-preview">
                  {Object.entries(importPreview.categories).map(([category, info]) => (
                    <div key={category} className="category-item">
                      <div className="category-header">
                        <span className="category-name">{category}</span>
                        <span className={`category-status ${info.hasData ? 'has-data' : 'no-data'}`}>
                          {info.hasData ? <CheckCircle size={16} /> : <XCircle size={16} />}
                        </span>
                      </div>
                      {info.hasData && (
                        <div className="category-changes">
                          {info.changes.additions.length > 0 && (
                            <span className="changes additions">+{info.changes.additions.length}</span>
                          )}
                          {info.changes.modifications.length > 0 && (
                            <span className="changes modifications">~{info.changes.modifications.length}</span>
                          )}
                          {info.changes.deletions.length > 0 && (
                            <span className="changes deletions">-{info.changes.deletions.length}</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Conflicts */}
                {importPreview.conflicts.length > 0 && (
                  <div className="conflicts-section">
                    <h5>Conflicts Detected</h5>
                    <div className="conflicts-list">
                      {importPreview.conflicts.map((conflict, idx) => (
                        <div key={idx} className="conflict-item">
                          <AlertTriangle size={16} />
                          <span>{conflict}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Password for encrypted imports */}
                {importData?.encrypted && (
                  <div className="option-group">
                    <h6>Decryption</h6>
                    <div className="password-input">
                      <Lock size={16} />
                      <input
                        type="password"
                        placeholder="Enter decryption password"
                        value={importPassword}
                        onChange={(e) => setImportPassword(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <h5>Import Options</h5>
                <div className="import-options">
                  <div className="option-group">
                    <h6>Conflict Resolution</h6>
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="conflictResolution"
                        checked={importOptions.mergeSettings}
                        onChange={() => setImportOptions(prev => ({ 
                          ...prev, mergeSettings: true, overwriteExisting: false 
                        }))}
                      />
                      Merge with existing settings (recommended)
                    </label>
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="conflictResolution"
                        checked={importOptions.overwriteExisting}
                        onChange={() => setImportOptions(prev => ({ 
                          ...prev, mergeSettings: false, overwriteExisting: true 
                        }))}
                      />
                      Replace existing settings
                    </label>
                  </div>

                  <div className="option-group">
                    <h6>Safety Options</h6>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={importOptions.validateBeforeImport}
                        onChange={(e) => setImportOptions(prev => ({ 
                          ...prev, validateBeforeImport: e.target.checked 
                        }))}
                      />
                      Validate settings before import
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={resetImport} disabled={loading}>
                Cancel
              </button>
              <button 
                onClick={handleValidateImport}
                className="secondary"
                disabled={loading || (importData?.encrypted && !importPassword)}
              >
                <Eye size={16} />
                Validate
              </button>
              <button 
                onClick={handleImport} 
                className="primary"
                disabled={loading || !importPreview.valid || (importData?.encrypted && !importPassword)}
              >
                {loading ? 'Importing...' : 'Import Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Result Modal */}
      {showImportResult && importResult && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h4>Import Results</h4>
              <button onClick={() => setShowImportResult(false)} className="close-btn">
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="import-results">
                <div className={`result-status ${importResult.success ? 'success' : 'error'}`}>
                  {importResult.success ? (
                    <>
                      <CheckCircle size={24} />
                      <h5>Import Successful</h5>
                    </>
                  ) : (
                    <>
                      <XCircle size={24} />
                      <h5>Import Failed</h5>
                    </>
                  )}
                </div>

                {importResult.backupCreated && (
                  <div className="backup-notice">
                    <Archive size={16} />
                    <span>Backup created before import</span>
                  </div>
                )}

                {Object.keys(importResult.imported).length > 0 && (
                  <div className="imported-categories">
                    <h6>Successfully Imported:</h6>
                    <ul>
                      {Object.entries(importResult.imported).map(([category, success]) => (
                        <li key={category} className={success ? 'success' : 'error'}>
                          {success ? <Check size={16} /> : <X size={16} />}
                          {category}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {importResult.errors.length > 0 && (
                  <div className="result-errors">
                    <h6>Errors:</h6>
                    <ul>
                      {importResult.errors.map((error, idx) => (
                        <li key={idx}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {importResult.warnings.length > 0 && (
                  <div className="result-warnings">
                    <h6>Warnings:</h6>
                    <ul>
                      {importResult.warnings.map((warning, idx) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setShowImportResult(false)} className="primary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsImportExport;