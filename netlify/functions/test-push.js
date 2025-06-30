const webpush = require('web-push');

webpush.setVapidDetails(
  'mailto:git@sampatt.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

exports.handler = async function(event, context) {
  console.log('test-push function triggered');
  
  // Get subscription from your database
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  const subRes = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    }
  });
  
  const subscriptions = await subRes.json();
  console.log('Found subscriptions:', subscriptions.length);

  if (subscriptions.length === 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'No subscriptions found' })
    };
  }

  const subscription = subscriptions[0];
  console.log('Testing with subscription:', subscription.id);

  const payload = JSON.stringify({
    title: 'Test Notification',
    body: 'This is a test notification from your app!',
  });

  try {
    console.log('Sending test notification...');
    const result = await webpush.sendNotification(subscription.subscription, payload);
    console.log('Push result:', result);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message: 'Test notification sent successfully',
        subscriptionId: subscription.id
      })
    };
  } catch (err) {
    console.error('Push error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Push notification failed', 
        details: err.message 
      })
    };
  }
}; 