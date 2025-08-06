import React, { useState, useEffect } from 'react';
import './IOSPWADetector.css';

interface IOSPWADetectorProps {
  onClose?: () => void;
}

const IOSPWADetector: React.FC<IOSPWADetectorProps> = ({ onClose }) => {
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if we're on iOS Safari
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome|CriOS|FxiOS/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        (window.navigator as any).standalone === true;
    
    // Check if user has previously dismissed the banner
    const wasDismissed = localStorage.getItem('ios-pwa-banner-dismissed') === 'true';
    setDismissed(wasDismissed);
    
    // Show banner if on iOS Safari, not PWA, and not previously dismissed
    if (isIOS && isSafari && !isStandalone && !wasDismissed) {
      setShowBanner(true);
    }
  }, []);

  const handleDismiss = () => {
    setShowBanner(false);
    setDismissed(true);
    localStorage.setItem('ios-pwa-banner-dismissed', 'true');
    if (onClose) onClose();
  };

  const handleInstallInstructions = () => {
    // This will be handled by the PushNotificationManager modal
    const event = new CustomEvent('show-ios-install-instructions');
    window.dispatchEvent(event);
  };

  if (!showBanner || dismissed) {
    return null;
  }

  return (
    <div className="ios-pwa-banner">
      <div className="ios-pwa-content">
        <div className="ios-pwa-icon">📱</div>
        <div className="ios-pwa-text">
          <h4>Install as App for Best Experience</h4>
          <p>Get push notifications and faster access by installing this app on your home screen.</p>
        </div>
        <div className="ios-pwa-actions">
          <button onClick={handleInstallInstructions} className="install-btn">
            Install
          </button>
          <button onClick={handleDismiss} className="dismiss-btn">
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

export default IOSPWADetector;