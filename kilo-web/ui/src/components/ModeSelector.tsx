import React, { useState, useEffect } from 'react';
import { Mode, DEFAULT_MODES } from '../types/modes';
import './ModeSelector.css';

interface ModeSelectorProps {
  currentMode: Mode;
  onModeChange: (mode: Mode) => void;
  isConnected: boolean;
}

const ModeSelector: React.FC<ModeSelectorProps> = ({ 
  currentMode, 
  onModeChange, 
  isConnected 
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleModeSelect = (mode: Mode) => {
    if (mode.slug !== currentMode.slug && isConnected) {
      onModeChange(mode);
    }
    setIsDropdownOpen(false);
  };

  const toggleDropdown = () => {
    if (isConnected) {
      setIsDropdownOpen(!isDropdownOpen);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.mode-selector')) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className={`mode-selector ${!isConnected ? 'disabled' : ''}`}>
      <button
        className={`mode-selector-button ${isDropdownOpen ? 'open' : ''}`}
        onClick={toggleDropdown}
        disabled={!isConnected}
        title={isConnected ? `Current mode: ${currentMode.name}` : 'Disconnected'}
      >
        <div className="mode-info">
          <span className="mode-name">{currentMode.name}</span>
          <span className="mode-description">{currentMode.description}</span>
        </div>
        <svg 
          className={`dropdown-arrow ${isDropdownOpen ? 'rotated' : ''}`}
          width="12" 
          height="12" 
          viewBox="0 0 12 12"
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none"/>
        </svg>
      </button>

      {isDropdownOpen && (
        <div className="mode-dropdown">
          {DEFAULT_MODES.map((mode) => (
            <button
              key={mode.slug}
              className={`mode-option ${mode.slug === currentMode.slug ? 'active' : ''}`}
              onClick={() => handleModeSelect(mode)}
            >
              <div className="mode-option-info">
                <span className="mode-option-name">{mode.name}</span>
                <span className="mode-option-description">{mode.description}</span>
              </div>
              {mode.slug === currentMode.slug && (
                <svg className="check-icon" width="16" height="16" viewBox="0 0 16 16">
                  <path d="M13.5 3.5L6 11l-3.5-3.5" stroke="currentColor" strokeWidth="2" fill="none"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ModeSelector;