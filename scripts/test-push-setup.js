#!/usr/bin/env node

const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

console.log('🔍 Push Notification Setup Test\n');

// Check environment variables
console.log('📋 Environment Variables Check:');
console.log(`  Supabase URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}`);
console.log(`  Supabase Service Key: ${supabaseServiceKey ? '✅ Set' : '❌ Missing'}`);
console.log(`  VAPID Public Key: ${vapidPublicKey ? '✅ Set' : '❌ Missing'}`);
console.log(`  VAPID Private Key: ${vapidPrivateKey ? '✅ Set' : '❌ Missing'}`);

if (!supabaseUrl || !supabaseServiceKey || !vapidPublicKey || !vapidPrivateKey) {
  console.log('\n❌ Missing required environment variables. Please check your .env file.');
  process.exit(1);
}

// Initialize Supabase
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize web-push
webpush.setVapidDetails(
  'mailto:git@sampatt.com',
  vapidPublicKey,
  vapidPrivateKey
);

async function testPushSetup() {
  try {
    console.log('\n🔍 Fetching push subscriptions from database...');
    
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (subError) {
      console.error('❌ Error fetching subscriptions:', subError);
      return;
    }

    console.log(`✅ Found ${subscriptions.length} subscription(s) in database`);

    if (subscriptions.length === 0) {
      console.log('\n⚠️  No subscriptions found. Please register for push notifications in your PWA first.');
      return;
    }

    // Test each subscription
    console.log('\n🧪 Testing each subscription...');
    
    for (let i = 0; i < subscriptions.length; i++) {
      const subscription = subscriptions[i];
      console.log(`\n📱 Testing subscription ${i + 1}/${subscriptions.length}:`);
      console.log(`  User ID: ${subscription.user_id}`);
      console.log(`  Endpoint: ${subscription.subscription.endpoint.substring(0, 50)}...`);

      try {
        const payload = JSON.stringify({
          title: '🧪 Test Notification',
          body: `This is a test notification sent at ${new Date().toISOString()}`,
          icon: 'https://ruddertasks.netlify.app/icon-192.png',
          badge: 'https://ruddertasks.netlify.app/icon-72.png',
          tag: 'test-notification',
          requireInteraction: true,
          silent: false,
          vibrate: [200, 100, 200]
        });

        const result = await webpush.sendNotification(subscription.subscription, payload);
        
        if (result.statusCode === 200) {
          console.log('  ✅ Push notification sent successfully');
        } else {
          console.log(`  ⚠️  Push notification sent with status: ${result.statusCode}`);
        }
      } catch (error) {
        console.log(`  ❌ Error sending push notification: ${error.message}`);
        
        // Check for specific error types
        if (error.statusCode === 410) {
          console.log('  💡 This subscription has expired and should be removed from the database');
        } else if (error.statusCode === 404) {
          console.log('  💡 This subscription endpoint is not found');
        } else if (error.statusCode === 413) {
          console.log('  💡 Payload too large');
        } else if (error.statusCode === 429) {
          console.log('  💡 Too many requests');
        }
      }
    }

    // Test Netlify function
    console.log('\n🌐 Testing Netlify function...');
    try {
      const response = await fetch('https://ruddertasks.netlify.app/.netlify/functions/test-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ test: true })
      });
      
      const result = await response.json();
      console.log('✅ Netlify function response:', result);
    } catch (error) {
      console.log('❌ Netlify function error:', error.message);
    }

    console.log('\n📋 Summary:');
    console.log('1. Check if you received the test notifications on your Android device');
    console.log('2. If not, check the debug info in your PWA (Tasks page > Push Debug section)');
    console.log('3. Ensure your PWA is installed and running in standalone mode');
    console.log('4. Check Android notification settings for your PWA');
    console.log('5. Verify you\'re using the production HTTPS URL, not localhost');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testPushSetup(); 