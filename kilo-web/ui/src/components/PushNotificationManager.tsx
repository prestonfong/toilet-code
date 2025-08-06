import React, { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, Smartphone, Monitor, AlertTriangle, Check, X, RefreshCw } from 'lucide-react';
import pushNotificationService, { NotificationPermissionStatus } from '../utils/pushNotificationService';
import './PushNotificationManager.css';

interface PushNotificationManagerProps {
  onClose?: () => void;
  isCompact?: boolean;
}

interface NotificationStats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  notificationsSent: number;
  successRate: number;
}

const PushNotificationManager: React.FC<PushNotificationManagerProps> = ({ 
  onClose, 
  isCompact = false 
}) => {
  const [status, setStatus] = useState<NotificationPermissionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  // Load initial status
  useEffect(() => {
    updateStatus();
    loadStats();
  }, []);

  // Set up event listeners
  useEffect(() => {
    const handlePermissionChange = () => updateStatus();
    const handleSubscriptionChange = () => {
      updateStatus();
      loadStats();
    };
    const handleError = (data: any) => {
      setMessage(`Error: ${data.error}`);
      setTimeout(() => setMessage(''), 5000);
    };

    pushNotificationService.on('permissionChanged', handlePermissionChange);
    pushNotificationService.on('subscriptionChanged', handleSubscriptionChange);
    pushNotificationService.on('error', handleError);

    return () => {
      pushNotificationService.off('permissionChanged', handlePermissionChange);
      pushNotificationService.off('subscriptionChanged', handleSubscriptionChange);
      pushNotificationService.off('error', handleError);
    };
  }, []);

  const updateStatus = useCallback(() => {
    const currentStatus = pushNotificationService.getPermissionStatus();
    setStatus(currentStatus);

    // Show iOS instructions if needed
    if (pushNotificationService.isIOSDevice() && !currentStatus.isIOSPWA && !currentStatus.subscribed) {
      setShowIOSInstructions(true);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const statistics = await pushNotificationService.getStatistics();
      setStats(statistics);
    } catch (error) {
      console.error('Failed to load push notification stats:', error);
    }
  }, []);

  const handleEnableNotifications = async () => {
    setIsLoading(true);
    setMessage('');

    try {
      // Check if iOS device and not PWA
      if (pushNotificationService.isIOSDevice() && !status?.isIOSPWA) {
        setShowIOSInstructions(true);
        setMessage('Please install the app to your home screen first to enable push notifications on iOS.');
        return;
      }

      await pushNotificationService.subscribe();
      setMessage('Push notifications enabled successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to enable notifications';
      setMessage(errorMessage);
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableNotifications = async () => {
    setIsLoading(true);
    setMessage('');

    try {
      await pushNotificationService.unsubscribe();
      setMessage('Push notifications disabled successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to disable notifications';
      setMessage(errorMessage);
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendTest = async () => {
    setIsLoading(true);
    setMessage('');

    try {
      await pushNotificationService.sendTestNotification({
        title: 'Kilo Code Test',
        body: 'This is a test notification to verify everything is working correctly!',
        type: 'system'
      });
      setMessage('Test notification sent! Check your notifications.');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send test notification';
      setMessage(errorMessage);
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshStats = () => {
    loadStats();
    updateStatus();
  };

  if (!status) {
    return (
      <div className={`push-notification-manager ${isCompact ? 'compact' : ''}`}>
        <div className="loading-state">
          <RefreshCw className="spin" size={20} />
          <span>Loading notification settings...</span>
        </div>
      </div>
    );
  }

  const getStatusIcon = () => {
    if (!status.supported) return <BellOff className="text-gray-400" size={24} />;
    if (status.subscribed) return <Bell className="text-green-500" size={24} />;
    if (status.permission === 'denied') return <BellOff className="text-red-500" size={24} />;
    return <Bell className="text-yellow-500" size={24} />;
  };

  const getStatusText = () => {
    if (!status.supported) return 'Not Supported';
    if (status.subscribed) return 'Enabled';
    if (status.permission === 'denied') return 'Blocked';
    if (status.permission === 'granted') return 'Available';
    return 'Available';
  };

  const getStatusColor = () => {
    if (!status.supported || status.permission === 'denied') return 'error';
    if (status.subscribed) return 'success';
    return 'warning';
  };

  return (
    <div className={`push-notification-manager ${isCompact ? 'compact' : ''}`}>
      {!isCompact && (
        <div className="header">
          <div className="header-content">
            <h3>Push Notifications</h3>
            {onClose && (
              <button className="close-button" onClick={onClose}>
                <X size={20} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Current Status */}
      <div className="status-section">
        <div className="status-header">
          {getStatusIcon()}
          <div className="status-info">
            <span className="status-title">Status: {getStatusText()}</span>
            <span className={`status-badge ${getStatusColor()}`}>
              {status.subscribed ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Device/Platform Info */}
        <div className="device-info">
          <div className="device-item">
            {status.isPWA ? <Smartphone size={16} /> : <Monitor size={16} />}
            <span>{status.isPWA ? 'PWA Mode' : 'Browser Mode'}</span>
          </div>
          {status.isIOSPWA && (
            <div className="device-item">
              <Check size={16} className="text-green-500" />
              <span>iOS PWA Compatible</span>
            </div>
          )}
        </div>
      </div>

      {/* iOS Instructions Modal */}
      {showIOSInstructions && (
        <div className="ios-instructions-overlay">
          <div className="ios-instructions-modal">
            <div className="modal-header">
              <h4>iOS Installation Required</h4>
              <button onClick={() => setShowIOSInstructions(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-content">
              <div className="ios-icon">
                <Smartphone size={48} />
              </div>
              <p>
                Push notifications on iOS require the app to be installed to your home screen first.
              </p>
              <div className="ios-steps">
                <div className="step">
                  <span className="step-number">1</span>
                  <span>Tap the Share button in Safari</span>
                </div>
                <div className="step">
                  <span className="step-number">2</span>
                  <span>Select "Add to Home Screen"</span>
                </div>
                <div className="step">
                  <span className="step-number">3</span>
                  <span>Open the app from your home screen</span>
                </div>
                <div className="step">
                  <span className="step-number">4</span>
                  <span>Enable push notifications</span>
                </div>
              </div>
              <div className="modal-actions">
                <button onClick={() => setShowIOSInstructions(false)} className="primary">
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="actions-section">
        {!status.supported ? (
          <div className="not-supported">
            <AlertTriangle size={20} />
            <span>Push notifications are not supported in this browser</span>
          </div>
        ) : status.permission === 'denied' ? (
          <div className="permission-denied">
            <AlertTriangle size={20} />
            <div>
              <p>Notifications are blocked. To enable:</p>
              <ol>
                <li>Click the lock icon in your browser's address bar</li>
                <li>Change notifications to "Allow"</li>
                <li>Refresh this page</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="action-buttons">
            {!status.subscribed ? (
              <button
                onClick={handleEnableNotifications}
                disabled={isLoading}
                className="primary enable-button"
              >
                {isLoading ? <RefreshCw className="spin" size={16} /> : <Bell size={16} />}
                Enable Notifications
              </button>
            ) : (
              <div className="enabled-actions">
                <button
                  onClick={handleSendTest}
                  disabled={isLoading}
                  className="secondary test-button"
                >
                  {isLoading ? <RefreshCw className="spin" size={16} /> : <Bell size={16} />}
                  Send Test
                </button>
                <button
                  onClick={handleDisableNotifications}
                  disabled={isLoading}
                  className="danger disable-button"
                >
                  {isLoading ? <RefreshCw className="spin" size={16} /> : <BellOff size={16} />}
                  Disable
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Statistics */}
      {stats && !isCompact && (
        <div className="stats-section">
          <div className="stats-header">
            <h4>Statistics</h4>
            <button onClick={handleRefreshStats} className="refresh-button">
              <RefreshCw size={16} />
            </button>
          </div>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-value">{stats.totalSubscriptions || 0}</span>
              <span className="stat-label">Total Subscriptions</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.activeSubscriptions || 0}</span>
              <span className="stat-label">Active</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.notificationsSent || 0}</span>
              <span className="stat-label">Sent</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{Math.round((stats.successRate || 0) * 100)}%</span>
              <span className="stat-label">Success Rate</span>
            </div>
          </div>
        </div>
      )}

      {/* Status Message */}
      {message && (
        <div className={`status-message ${message.includes('Error') || message.includes('Failed') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      {/* Technical Details (for debugging) */}
      {!isCompact && process.env.NODE_ENV === 'development' && (
        <details className="debug-section">
          <summary>Debug Information</summary>
          <div className="debug-info">
            <div><strong>Permission:</strong> {status.permission}</div>
            <div><strong>Supported:</strong> {status.supported ? 'Yes' : 'No'}</div>
            <div><strong>PWA Mode:</strong> {status.isPWA ? 'Yes' : 'No'}</div>
            <div><strong>iOS PWA:</strong> {status.isIOSPWA ? 'Yes' : 'No'}</div>
            <div><strong>iOS Device:</strong> {pushNotificationService.isIOSDevice() ? 'Yes' : 'No'}</div>
            <div><strong>Subscribed:</strong> {status.subscribed ? 'Yes' : 'No'}</div>
            {status.subscription && (
              <div><strong>Endpoint:</strong> {status.subscription.endpoint.slice(0, 50)}...</div>
            )}
          </div>
        </details>
      )}
    </div>
  );
};

export default PushNotificationManager;