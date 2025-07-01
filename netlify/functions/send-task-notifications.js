const webpush = require('web-push');
// No need to import node-fetch in Node 18+

webpush.setVapidDetails(
  'mailto:git@sampatt.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Helper function to get current date in user's timezone (assuming Detroit/EST)
function getCurrentLocalDate() {
  // Assume user is in Detroit timezone (EST/EDT)
  const now = new Date();
  const detroitTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Detroit"}));
  return detroitTime.toISOString().split('T')[0];
}

// Helper function to convert local time to UTC
function localTimeToUTC(date, time) {
  const localDateTime = `${date}T${time}`;
  const localDate = new Date(localDateTime);
  const utcDate = new Date(localDate.toLocaleString("en-US", {timeZone: "America/Detroit"}));
  return utcDate.toISOString();
}

exports.handler = async function(event, context) {
  console.log('=== send-task-notifications function triggered ===');
  console.log(`Function execution started at: ${new Date().toISOString()}`);

  // 1. Fetch push subscriptions
  console.log('Step 1: Fetching push subscriptions...');
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: Missing required environment variables (SUPABASE_URL or SUPABASE_SERVICE_KEY)');
    return { statusCode: 500, body: JSON.stringify({ error: 'Missing environment variables' }) };
  }

  const subRes = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    }
  });
  
  if (!subRes.ok) {
    console.error(`ERROR: Failed to fetch subscriptions. Status: ${subRes.status}, StatusText: ${subRes.statusText}`);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch subscriptions' }) };
  }
  
  const subscriptions = await subRes.json();
  console.log(`Found ${Array.isArray(subscriptions) ? subscriptions.length : 'invalid'} push subscriptions`);

  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    console.log('No subscriptions found - function complete');
    return { statusCode: 200, body: JSON.stringify({ sent: 0, tasks: 0, subscriptions: 0, message: 'No subscriptions found' }) };
  }

  // 2. Query for tasks in the next 16 minutes, starting 1 minute ago
  console.log('Step 2: Querying for tasks in notification window...');
  const now = new Date();
  const windowStart = new Date(now.getTime() - 1 * 60 * 1000); // now - 1 min
  const windowEnd = new Date(now.getTime() + 16 * 60 * 1000);  // now + 16 min

  // Use UTC for querying, but you may want to adjust for your app's timezone logic
  const windowStartUTC = windowStart.toISOString();
  const windowEndUTC = windowEnd.toISOString();
  const localDate = getCurrentLocalDate();

  console.log(`Query window: ${windowStartUTC} to ${windowEndUTC} (local date: ${localDate})`);

  // Query for all tasks in the window (adjust query as needed for your schema)
  const taskRes = await fetch(`${supabaseUrl}/rest/v1/tasks?date=eq.${localDate}&start_time=gte.${windowStartUTC}&start_time=lt.${windowEndUTC}&completed_at=is.null&order=start_time.asc`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    }
  });
  
  if (!taskRes.ok) {
    console.error(`ERROR: Failed to fetch tasks. Status: ${taskRes.status}, StatusText: ${taskRes.statusText}`);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch tasks' }) };
  }
  
  const tasks = await taskRes.json();
  console.log(`Found ${Array.isArray(tasks) ? tasks.length : 'invalid'} tasks in notification window`);

  if (Array.isArray(tasks) && tasks.length > 0) {
    console.log('Task details:');
    tasks.forEach((task, index) => {
      console.log(`  ${index + 1}. Task ID: ${task.id}, Title: "${task.title}", Start Time: ${task.start_time}`);
    });
  }

  let sent = 0;
  let errors = 0;
  
  if (Array.isArray(tasks) && tasks.length > 0) {
    console.log(`Step 3: Sending notifications for ${tasks.length} tasks to ${subscriptions.length} subscribers...`);
    
    for (const task of tasks) {
      console.log(`Processing task: "${task.title}" (ID: ${task.id})`);
      
      // Format time for user (local time, e.g. America/Detroit)
      const localTime = new Date(task.start_time).toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit', timeZone: "America/Detroit" });
      const payload = JSON.stringify({
        title: `📝 ${task.title}`,
        body: `Starts at ${localTime}`,
        icon: 'https://ruddertasks.netlify.app/icon-192.png',
        badge: 'https://ruddertasks.netlify.app/icon-72.png',
        tag: `task-${task.id}`,
        requireInteraction: true,
        silent: false,
        vibrate: [200, 100, 200]
      });

      console.log(`  Sending notification payload: ${payload}`);

      for (const sub of subscriptions) {
        try {
          console.log(`    Sending to subscription ${sub.id || 'unknown'}`);
          await webpush.sendNotification(sub.subscription, payload);
          sent++;
          console.log(`    ✓ Successfully sent notification`);
        } catch (err) {
          errors++;
          console.error(`    ✗ Push error for subscription ${sub.id || 'unknown'}:`, err.message);
          
          // Log more details for specific error types
          if (err.statusCode) {
            console.error(`      Status code: ${err.statusCode}`);
          }
          if (err.headers) {
            console.error(`      Headers:`, err.headers);
          }
        }
      }
    }
  } else {
    console.log('No tasks found in notification window - no notifications to send');
  }

  const result = {
    sent, 
    tasks: Array.isArray(tasks) ? tasks.length : 'n/a', 
    subscriptions: Array.isArray(subscriptions) ? subscriptions.length : 'n/a',
    errors,
    queryTime: `${windowStartUTC}-${windowEndUTC}`,
    queryDate: localDate
  };

  console.log('=== Function execution summary ===');
  console.log(`Notifications sent: ${sent}`);
  console.log(`Tasks found: ${result.tasks}`);
  console.log(`Subscriptions: ${result.subscriptions}`);
  console.log(`Errors: ${errors}`);
  console.log(`Query window: ${result.queryTime}`);
  console.log(`Local date: ${result.queryDate}`);
  console.log('=== Function execution complete ===');

  return {
    statusCode: 200,
    body: JSON.stringify(result)
  };
}; 