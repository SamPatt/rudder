const { createClient } = require('@supabase/supabase-js');

exports.handler = async function(event, context) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  
  const missingVars = [];
  if (!supabaseUrl) missingVars.push('VITE_SUPABASE_URL');
  if (!supabaseServiceKey) missingVars.push('SUPABASE_SERVICE_KEY');
  if (!vapidPublicKey) missingVars.push('VAPID_PUBLIC_KEY');
  if (!vapidPrivateKey) missingVars.push('VAPID_PRIVATE_KEY');
  
  if (missingVars.length > 0) {
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Missing environment variables',
        missing: missingVars
      })
    };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get all push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch subscriptions' })
      };
    }

    console.log(`Found ${subscriptions.length} subscriptions`);

    if (subscriptions.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No subscriptions found' })
      };
    }

    // Send a simple test notification to each subscription
    const results = [];
    for (const subscription of subscriptions) {
      try {
        // Use web-push library for consistent behavior
        const webpush = require('web-push');
        webpush.setVapidDetails(
          'mailto:git@sampatt.com',
          process.env.VAPID_PUBLIC_KEY,
          process.env.VAPID_PRIVATE_KEY
        );

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

        await webpush.sendNotification(subscription.subscription, payload);
        
        console.log(`Test notification sent to ${subscription.user_id}`);
        results.push({
          user_id: subscription.user_id,
          status: 'sent',
          message: 'Test notification sent successfully'
        });
      } catch (error) {
        console.error(`Error sending test notification to ${subscription.user_id}:`, error);
        results.push({
          user_id: subscription.user_id,
          status: 'error',
          error: error.message
        });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Sent test notifications to ${subscriptions.length} subscriptions`,
        results: results
      })
    };

  } catch (error) {
    console.error('Error in test-push function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}; 