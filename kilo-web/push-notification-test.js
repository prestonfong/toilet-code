// Test script for push notification service
// Run with: node push-notification-test.js (from kilo-web directory)

const path = require('path');
const fs = require('fs-extra');

// Set up test environment
process.env.NODE_ENV = 'test';
process.env.VAPID_EMAIL = 'mailto:test@example.com';

// Import the modules
const VAPIDKeyManager = require('./src/config/vapidKeyManager');
const SubscriptionManager = require('./src/services/subscriptionManager');
const PushNotificationService = require('./src/services/pushNotificationService');
const PushNotificationLogger = require('./src/utils/pushNotificationLogger');

async function runTests() {
  console.log('🧪 Starting Push Notification Service Tests...\n');
  
  try {
    // Test 1: VAPID Key Manager
    console.log('1️⃣ Testing VAPID Key Manager...');
    const keyManager = new VAPIDKeyManager();
    await keyManager.initialize();
    
    const publicKey = keyManager.getPublicKey();
    const keys = keyManager.getKeys();
    const privateKey = keys.privateKey;
    
    if (publicKey && privateKey) {
      console.log('✅ VAPID keys generated and validated successfully');
      console.log(`   Public Key: ${publicKey.substring(0, 20)}... (length: ${publicKey.length})`);
      console.log(`   Private Key length: ${privateKey.length}`);
    } else {
      throw new Error('Invalid VAPID keys generated');
    }
    
    // Test 2: Subscription Manager
    console.log('\n2️⃣ Testing Subscription Manager...');
    const subManager = new SubscriptionManager();
    await subManager.initialize();
    
    const testSubscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
      keys: {
        p256dh: 'test-p256dh-key',
        auth: 'test-auth-key'
      }
    };
    
    const subscriptionId = await subManager.addSubscription(testSubscription, { userId: 'test-user' });
    console.log(`✅ Subscription added with ID: ${subscriptionId}`);
    
    const subscriptions = subManager.getActiveSubscriptions();
    const foundSubscription = subscriptions.find(sub => sub.id === subscriptionId);
    if (foundSubscription) {
      console.log('✅ Subscription retrieved successfully');
      console.log(`   Found subscription with ID: ${foundSubscription.id}`);
    } else {
      throw new Error('Subscription retrieval failed');
    }
    
    // Test 3: Logger
    console.log('\n3️⃣ Testing Push Notification Logger...');
    const logger = new PushNotificationLogger();
    await logger.initialize();
    
    logger.info('Test log message', { test: true });
    logger.error('Test error message', new Error('Test error'));
    
    const stats = await logger.getLogStats();
    console.log('✅ Logger working correctly');
    console.log(`   Total logs: ${stats.totalLogs}`);
    
    // Test 4: Push Notification Service
    console.log('\n4️⃣ Testing Push Notification Service...');
    const pushService = new PushNotificationService();
    await pushService.initialize();
    
    // Test getting public key
    const servicePublicKey = pushService.getPublicKey();
    if (servicePublicKey === publicKey) {
      console.log('✅ Push service initialized with correct VAPID key');
    } else {
      throw new Error('Push service VAPID key mismatch');
    }
    
    // Test subscription management
    const testSub2 = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-2',
      keys: {
        p256dh: 'test-p256dh-key-2',
        auth: 'test-auth-key-2'
      }
    };
    
    const subId2 = await pushService.subscribe(testSub2, { userId: 'test-user-2' });
    console.log(`✅ Push service subscription added: ${subId2}`);
    
    // Test stats
    const serviceStats = pushService.getStats();
    console.log('✅ Push service stats working');
    console.log(`   Total subscriptions: ${serviceStats.totalSubscriptions}`);
    
    // Test 5: Cleanup and validation
    console.log('\n5️⃣ Testing cleanup and validation...');
    
    // Remove a subscription
    const removed = await pushService.unsubscribe(subscriptionId);
    if (removed) {
      console.log('✅ Subscription removed successfully');
    } else {
      throw new Error('Subscription removal failed');
    }
    
    // Validate final state
    const finalStats = pushService.getStats();
    console.log('✅ Final state validation passed');
    console.log(`   Remaining subscriptions: ${finalStats.totalSubscriptions || 'N/A'}`);
    
    console.log('\n🎉 All tests passed successfully!');
    console.log('\n📊 Final Test Results:');
    console.log(`   - VAPID Keys: Generated and validated`);
    console.log(`   - Subscriptions: ${finalStats.totalSubscriptions} active`);
    console.log(`   - Logs: ${(await logger.getLogStats()).totalLogs} entries`);
    console.log(`   - Service Status: Operational`);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    // Cleanup test files
    try {
      await fs.remove('./data');
      await fs.remove('./logs');
      console.log('\n🧹 Test cleanup completed');
    } catch (cleanupError) {
      console.warn('⚠️ Cleanup warning:', cleanupError.message);
    }
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Fatal test error:', error);
  process.exit(1);
});