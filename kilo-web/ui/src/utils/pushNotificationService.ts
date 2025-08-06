/**
 * Push Notification Service for Kilo Code
 * 
 * Handles push notification subscription, permission management, 
 * iOS PWA detection, and service worker communication.
 * 
 * Features:
 * - Cross-platform push notification support
 * - iOS PWA detection and messaging
 * - Service worker registration and management
 * - Subscription management with server API
 * - Comprehensive error handling
 */

export interface PushSubscriptionWithMetadata {
  subscription: PushSubscription;
  metadata: {
    userId?: string;
    deviceType: string;
    userAgent: string;
    timestamp: number;
  };
}

export interface NotificationPermissionStatus {
  permission: NotificationPermission;
  supported: boolean;
  isPWA: boolean;
  isIOSPWA: boolean;
  canRequestPermission: boolean;
  subscribed: boolean;
  subscription: PushSubscription | null;
}

export interface PushNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: any;
  tag?: string;
  requireInteraction?: boolean;
  actions?: { action: string; title: string; icon?: string }[];
  type?: 'task_complete' | 'error' | 'system' | 'custom';
}

class PushNotificationService {
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;
  private vapidPublicKey: string | null = null;
  private isInitialized = false;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  /**
   * Initialize the push notification service
   */
  async initialize(): Promise<boolean> {
    try {
      // Check for service worker and push manager support
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('[PushService] Service workers or push notifications not supported');
        return false;
      }

      // Register service worker if not already registered
      await this.registerServiceWorker();
      
      // Get VAPID public key from server
      await this.fetchVapidPublicKey();
      
      // Check for existing subscription
      await this.checkExistingSubscription();
      
      // Set up service worker message listener
      this.setupServiceWorkerMessageListener();
      
      this.isInitialized = true;
      this.emit('initialized', { success: true });
      
      return true;
    } catch (error) {
      console.error('[PushService] Initialization failed:', error);
      this.emit('error', { error: 'Initialization failed', details: error });
      return false;
    }
  }

  /**
   * Register service worker for push notifications
   */
  private async registerServiceWorker(): Promise<void> {
    try {
      // Register service worker
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('[PushService] Service worker registered:', this.registration.scope);

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;

      // Handle service worker updates
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration!.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              this.emit('updateAvailable', { registration: this.registration });
            }
          });
        }
      });

    } catch (error) {
      console.error('[PushService] Service worker registration failed:', error);
      throw new Error(`Service worker registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch VAPID public key from server
   */
  private async fetchVapidPublicKey(): Promise<void> {
    try {
      const response = await fetch('/api/push/vapid-public-key');
      if (!response.ok) {
        throw new Error(`Failed to fetch VAPID key: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success || !data.publicKey) {
        throw new Error('Invalid VAPID key response');
      }

      this.vapidPublicKey = data.publicKey;
      console.log('[PushService] VAPID public key fetched successfully');
    } catch (error) {
      console.error('[PushService] Failed to fetch VAPID key:', error);
      throw error;
    }
  }

  /**
   * Check for existing push subscription
   */
  private async checkExistingSubscription(): Promise<void> {
    if (!this.registration) return;

    try {
      this.subscription = await this.registration.pushManager.getSubscription();
      if (this.subscription) {
        console.log('[PushService] Existing subscription found');
        this.emit('subscriptionChanged', { 
          subscribed: true, 
          subscription: this.subscription 
        });
      }
    } catch (error) {
      console.error('[PushService] Failed to check existing subscription:', error);
    }
  }

  /**
   * Set up service worker message listener
   */
  private setupServiceWorkerMessageListener(): void {
    navigator.serviceWorker.addEventListener('message', (event) => {
      const { type, payload } = event.data || {};
      
      switch (type) {
        case 'NOTIFICATION_EVENT':
          this.emit('notificationEvent', payload);
          break;
        default:
          console.log('[PushService] Unknown service worker message:', type, payload);
      }
    });
  }

  /**
   * Get current notification permission status with PWA detection
   */
  getPermissionStatus(): NotificationPermissionStatus {
    const isSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    const isPWA = this.isPWAMode();
    const isIOSPWA = this.isIOSPWAMode();
    
    return {
      permission: isSupported ? Notification.permission : 'denied',
      supported: isSupported,
      isPWA,
      isIOSPWA,
      canRequestPermission: isSupported && Notification.permission === 'default',
      subscribed: !!this.subscription,
      subscription: this.subscription
    };
  }

  /**
   * Check if running as PWA
   */
  isPWAMode(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone ||
           document.referrer.includes('android-app://');
  }

  /**
   * Check if running as iOS PWA
   */
  isIOSPWAMode(): boolean {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = (window.navigator as any).standalone;
    return isIOS && isStandalone;
  }

  /**
   * Detect iOS device (for installation prompts)
   */
  isIOSDevice(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      throw new Error('Notifications not supported');
    }

    if (Notification.permission !== 'default') {
      return Notification.permission;
    }

    try {
      const permission = await Notification.requestPermission();
      this.emit('permissionChanged', { permission });
      return permission;
    } catch (error) {
      console.error('[PushService] Permission request failed:', error);
      throw new Error('Permission request failed');
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe(userId?: string): Promise<PushSubscription> {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    if (!this.registration) {
      throw new Error('Service worker not registered');
    }

    if (!this.vapidPublicKey) {
      throw new Error('VAPID key not available');
    }

    if (Notification.permission !== 'granted') {
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }
    }

    try {
      // Subscribe to push notifications
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey) as BufferSource
      });

      // Prepare subscription data with metadata
      const subscriptionData: PushSubscriptionWithMetadata = {
        subscription,
        metadata: {
          userId,
          deviceType: this.getDeviceType(),
          userAgent: navigator.userAgent,
          timestamp: Date.now()
        }
      };

      // Send subscription to server
      await this.sendSubscriptionToServer(subscriptionData);

      this.subscription = subscription;
      this.emit('subscriptionChanged', { 
        subscribed: true, 
        subscription 
      });

      console.log('[PushService] Successfully subscribed to push notifications');
      return subscription;

    } catch (error) {
      console.error('[PushService] Subscription failed:', error);
      throw new Error(`Subscription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<boolean> {
    if (!this.subscription) {
      return true; // Already unsubscribed
    }

    try {
      // Unsubscribe from push manager
      const success = await this.subscription.unsubscribe();
      
      if (success) {
        // Notify server about unsubscription
        await this.sendUnsubscriptionToServer();
        
        this.subscription = null;
        this.emit('subscriptionChanged', { 
          subscribed: false, 
          subscription: null 
        });
        
        console.log('[PushService] Successfully unsubscribed from push notifications');
      }

      return success;
    } catch (error) {
      console.error('[PushService] Unsubscription failed:', error);
      throw new Error(`Unsubscription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send test notification
   */
  async sendTestNotification(options: Partial<PushNotificationOptions> = {}): Promise<boolean> {
    try {
      const testData = {
        title: 'Test Notification',
        body: 'This is a test notification from Kilo Code',
        type: 'system',
        ...options
      };

      const response = await fetch('/api/push/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testData)
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Test notification failed');
      }

      console.log('[PushService] Test notification sent successfully');
      return true;
    } catch (error) {
      console.error('[PushService] Test notification failed:', error);
      throw error;
    }
  }

  /**
   * Send subscription to server
   */
  private async sendSubscriptionToServer(subscriptionData: PushSubscriptionWithMetadata): Promise<void> {
    try {
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(subscriptionData)
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Server subscription failed');
      }

      console.log('[PushService] Subscription registered with server:', result.subscriptionId);
    } catch (error) {
      console.error('[PushService] Server subscription failed:', error);
      throw error;
    }
  }

  /**
   * Send unsubscription to server
   */
  private async sendUnsubscriptionToServer(): Promise<void> {
    if (!this.subscription) return;

    try {
      const response = await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          endpoint: this.subscription.endpoint
        })
      });

      if (!response.ok) {
        console.warn('[PushService] Server unsubscription failed, but local unsubscription succeeded');
      }
    } catch (error) {
      console.warn('[PushService] Server unsubscription request failed:', error);
    }
  }

  /**
   * Get device type for metadata
   */
  private getDeviceType(): string {
    const userAgent = navigator.userAgent;
    
    if (/iPad/.test(userAgent)) return 'iPad';
    if (/iPhone/.test(userAgent)) return 'iPhone';
    if (/iPod/.test(userAgent)) return 'iPod';
    if (/Android/.test(userAgent)) return 'Android';
    if (/Windows/.test(userAgent)) return 'Windows';
    if (/Mac/.test(userAgent)) return 'Mac';
    if (/Linux/.test(userAgent)) return 'Linux';
    
    return 'Unknown';
  }

  /**
   * Convert VAPID key from base64 to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Send message to service worker
   */
  async sendMessageToServiceWorker(message: any): Promise<any> {
    if (!this.registration || !this.registration.active) {
      throw new Error('Service worker not available');
    }

    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      
      channel.port1.onmessage = (event) => {
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data);
        }
      };

      this.registration!.active!.postMessage(message, [channel.port2]);
    });
  }

  /**
   * Update service worker
   */
  async updateServiceWorker(): Promise<void> {
    if (!this.registration) {
      throw new Error('Service worker not registered');
    }

    try {
      await this.registration.update();
      
      if (this.registration.waiting) {
        this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    } catch (error) {
      console.error('[PushService] Service worker update failed:', error);
      throw error;
    }
  }

  /**
   * Get push notification statistics
   */
  async getStatistics(): Promise<any> {
    try {
      const response = await fetch('/api/push/stats');
      if (!response.ok) {
        throw new Error(`Failed to fetch statistics: ${response.status}`);
      }

      const data = await response.json();
      return data.stats || {};
    } catch (error) {
      console.error('[PushService] Failed to fetch statistics:', error);
      return {};
    }
  }

  /**
   * Event emitter functionality
   */
  on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: (data: any) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
    }
  }

  private emit(event: string, data: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[PushService] Event listener error for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.listeners.clear();
    this.subscription = null;
    this.registration = null;
    this.vapidPublicKey = null;
    this.isInitialized = false;
  }
}

// Create singleton instance
export const pushNotificationService = new PushNotificationService();

// Export types and service
export default pushNotificationService;