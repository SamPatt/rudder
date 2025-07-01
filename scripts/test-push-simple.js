#!/usr/bin/env node

import webpush from 'web-push';

// Test subscription data (from your database)
const testSubscription = {
  "keys": {
    "auth": "lqyRmuyMRdzHTiyaKohgkg",
    "p256dh": "BJgeDzRjo5Bvnc8cM4oe_7isyhDGvsPNj6dfoy2DrSXtnwVBXmdY8jENjZvFOSG9Jin6BU0RGp8jySPHrc7hcZY"
  },
  "endpoint": "https://fcm.googleapis.com/fcm/send/d_x97F2pJ2o:APA91bEJQghRKd_9isNK2kM3VO2nS1aorGtLS1T1aFoSQMMEcbO95K1wyK03iqFPg8Zgllis0fhhSlgm03kfBGal7xRrkwrvdzmFBQHwLJoIonIq4Fl-DA88VycvQWc3YHuEB1qbiNVL",
  "expirationTime": null
};

console.log('🧪 Simple Push Notification Test\n');

// Check if VAPID keys are available
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (!vapidPublicKey || !vapidPrivateKey) {
  console.log('❌ VAPID keys not found in environment variables.');
  console.log('Please set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in your environment.');
  console.log('\nTo get your VAPID keys:');
  console.log('1. Go to your Netlify dashboard');
  console.log('2. Site Settings → Environment Variables');
  console.log('3. Copy VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY');
  console.log('\nOr run: npx web-push generate-vapid-keys');
  process.exit(1);
}

// Initialize web-push
webpush.setVapidDetails(
  'mailto:git@sampatt.com',
  vapidPublicKey,
  vapidPrivateKey
);

async function testPush() {
  try {
    console.log('📱 Testing push notification...');
    console.log(`Endpoint: ${testSubscription.endpoint.substring(0, 50)}...`);
    
    const payload = JSON.stringify({
      title: '🧪 Test Notification',
      body: `This is a test notification sent at ${new Date().toISOString()}`,
      icon: 'https://ruddertasks.netlify.app/icon-192.png',
      badge: 'https://ruddertasks.netlify.app/icon-72.png',
      tag: 'test-notification',
      requireInteraction: true,
      silent: false
    });

    console.log('📤 Sending push notification...');
    const result = await webpush.sendNotification(testSubscription, payload);
    
    if (result.statusCode === 200) {
      console.log('✅ Push notification sent successfully!');
      console.log('📱 Check your Android device for the notification.');
    } else {
      console.log(`⚠️  Push notification sent with status: ${result.statusCode}`);
    }
    
  } catch (error) {
    console.log(`❌ Error sending push notification: ${error.message}`);
    
    if (error.statusCode === 410) {
      console.log('💡 This subscription has expired and should be removed from the database');
    } else if (error.statusCode === 404) {
      console.log('💡 This subscription endpoint is not found');
    } else if (error.statusCode === 413) {
      console.log('💡 Payload too large');
    } else if (error.statusCode === 429) {
      console.log('💡 Too many requests');
    } else if (error.statusCode === 400) {
      console.log('💡 Bad request - check VAPID keys');
    }
  }
}

testPush(); 