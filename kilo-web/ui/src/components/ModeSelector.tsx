import React, { useState, useEffect } from 'react';

interface Mode {
  slug: string;
  name: string;
  description: string;
  iconName?: string;
  whenToUse?: string;
}

interface ModeSelectorProps {
  currentMode: string;
  modes: Mode[];
  onModeChange: (modeSlug: string, reason?: string) => void;
  disabled?: boolean;
  showDescription?: boolean;
}

const ModeSelector: React.FC<ModeSelectorProps> = ({
  currentMode,
  modes,
  onModeChange,
  disabled = false,
  showDescription = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState(currentMode);
  const [switchReason, setSwitchReason] = useState('');
  const [showReasonInput, setShowReasonInput] = useState(false);

  useEffect(() => {
    setSelectedMode(currentMode);
  }, [currentMode]);

  const handleModeSelect = (modeSlug: string) => {
    if (modeSlug === currentMode) {
      setIsOpen(false);
      return;
    }

    setSelectedMode(modeSlug);
    setShowReasonInput(true);
  };

  const handleModeSwitch = () => {
    onModeChange(selectedMode, switchReason || undefined);
    setIsOpen(false);
    setShowReasonInput(false);
    setSwitchReason('');
  };

  const handleCancel = () => {
    setSelectedMode(currentMode);
    setShowReasonInput(false);
    setSwitchReason('');
    setIsOpen(false);
  };

  const getCurrentModeInfo = () => {
    return modes.find(mode => mode.slug === currentMode);
  };

  const getSelectedModeInfo = () => {
    return modes.find(mode => mode.slug === selectedMode);
  };

  const getModeIcon = (mode: Mode) => {
    switch (mode.slug) {
      case 'architect':
        return '🏗️';
      case 'code':
        return '💻';
      case 'ask':
        return '❓';
      case 'debug':
        return '🐛';
      case 'orchestrator':
        return '🎼';
      default:
        return '⚙️';
    }
  };

  const currentModeInfo = getCurrentModeInfo();
  const selectedModeInfo = getSelectedModeInfo();

  return (
    <div className="mode-selector">
      <style>{`
        .mode-selector {
          position: relative;
          display: inline-block;
        }

        .mode-selector-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #f5f5f5;
          border: 1px solid #ddd;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s ease;
          min-width: 120px;
        }

        .mode-selector-button:hover:not(:disabled) {
          background: #e9e9e9;
          border-color: #bbb;
        }

        .mode-selector-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .mode-selector-button.open {
          background: #e9e9e9;
          border-color: #007acc;
        }

        .mode-icon {
          font-size: 16px;
        }

        .mode-name {
          font-weight: 500;
          flex: 1;
        }

        .dropdown-arrow {
          font-size: 12px;
          color: #666;
          transition: transform 0.2s ease;
        }

        .dropdown-arrow.open {
          transform: rotate(180deg);
        }

        .mode-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          z-index: 1000;
          background: white;
          border: 1px solid #ddd;
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          margin-top: 4px;
          max-height: 400px;
          overflow-y: auto;
        }

        .mode-option {
          padding: 12px;
          cursor: pointer;
          border-bottom: 1px solid #f0f0f0;
          transition: background-color 0.2s ease;
        }

        .mode-option:last-child {
          border-bottom: none;
        }

        .mode-option:hover {
          background: #f8f9fa;
        }

        .mode-option.current {
          background: #e7f3ff;
          border-left: 3px solid #007acc;
        }

        .mode-option-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .mode-option-name {
          font-weight: 500;
          font-size: 14px;
        }

        .mode-option-description {
          font-size: 12px;
          color: #666;
          line-height: 1.3;
        }

        .mode-option-when-to-use {
          font-size: 11px;
          color: #888;
          margin-top: 4px;
          font-style: italic;
        }

        .reason-input-container {
          padding: 16px;
          border-top: 1px solid #f0f0f0;
          background: #f8f9fa;
        }

        .reason-input-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          font-size: 14px;
          font-weight: 500;
        }

        .reason-input {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 13px;
          margin-bottom: 12px;
          resize: vertical;
          min-height: 60px;
        }

        .reason-input:focus {
          outline: none;
          border-color: #007acc;
          box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
        }

        .reason-buttons {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }

        .reason-button {
          padding: 6px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s ease;
        }

        .reason-button.primary {
          background: #007acc;
          color: white;
          border-color: #007acc;
        }

        .reason-button:hover {
          opacity: 0.8;
        }

        .current-mode-indicator {
          font-size: 10px;
          color: #007acc;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
      `}</style>

      <button
        className={`mode-selector-button ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        title={currentModeInfo?.description || 'Select AI mode'}
      >
        <span className="mode-icon">{getModeIcon(currentModeInfo || { slug: 'code', name: 'Code', description: '' })}</span>
        <span className="mode-name">{currentModeInfo?.name || 'Code'}</span>
        <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="mode-dropdown">
          {modes.map((mode) => (
            <div
              key={mode.slug}
              className={`mode-option ${mode.slug === currentMode ? 'current' : ''}`}
              onClick={() => handleModeSelect(mode.slug)}
            >
              <div className="mode-option-header">
                <span className="mode-icon">{getModeIcon(mode)}</span>
                <span className="mode-option-name">{mode.name}</span>
                {mode.slug === currentMode && (
                  <span className="current-mode-indicator">Current</span>
                )}
              </div>
              {showDescription && mode.description && (
                <div className="mode-option-description">{mode.description}</div>
              )}
              {showDescription && mode.whenToUse && (
                <div className="mode-option-when-to-use">{mode.whenToUse}</div>
              )}
            </div>
          ))}

          {showReasonInput && selectedModeInfo && (
            <div className="reason-input-container">
              <div className="reason-input-header">
                <span className="mode-icon">{getModeIcon(selectedModeInfo)}</span>
                <span>Switch to {selectedModeInfo.name} mode</span>
              </div>
              <textarea
                className="reason-input"
                placeholder="Optional: Why are you switching to this mode?"
                value={switchReason}
                onChange={(e) => setSwitchReason(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    handleModeSwitch();
                  }
                }}
              />
              <div className="reason-buttons">
                <button className="reason-button" onClick={handleCancel}>
                  Cancel
                </button>
                <button className="reason-button primary" onClick={handleModeSwitch}>
                  Switch Mode
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ModeSelector;