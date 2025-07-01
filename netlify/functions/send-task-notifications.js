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
  console.log('send-task-notifications function triggered');

  // 1. Fetch push subscriptions
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  const subRes = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    }
  });
  const subscriptions = await subRes.json();

  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    return { statusCode: 200, body: JSON.stringify({ sent: 0, tasks: 0, subscriptions: 0, message: 'No subscriptions found' }) };
  }

  // 2. Query for tasks in the next 16 minutes, starting 1 minute ago
  const now = new Date();
  const windowStart = new Date(now.getTime() - 1 * 60 * 1000); // now - 1 min
  const windowEnd = new Date(now.getTime() + 16 * 60 * 1000);  // now + 16 min

  // Use UTC for querying, but you may want to adjust for your app's timezone logic
  const windowStartUTC = windowStart.toISOString();
  const windowEndUTC = windowEnd.toISOString();
  const localDate = getCurrentLocalDate();

  // Query for all tasks in the window (adjust query as needed for your schema)
  const taskRes = await fetch(`${supabaseUrl}/rest/v1/tasks?date=eq.${localDate}&start_time=gte.${windowStartUTC}&start_time=lt.${windowEndUTC}&completed_at=is.null&order=start_time.asc`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    }
  });
  const tasks = await taskRes.json();

  let sent = 0;
  if (Array.isArray(tasks) && tasks.length > 0) {
    for (const task of tasks) {
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

      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(sub.subscription, payload);
          sent++;
        } catch (err) {
          console.error('Push error:', err);
        }
      }
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ 
      sent, 
      tasks: Array.isArray(tasks) ? tasks.length : 'n/a', 
      subscriptions: Array.isArray(subscriptions) ? subscriptions.length : 'n/a',
      queryTime: `${windowStartUTC}-${windowEndUTC}`,
      queryDate: localDate
    })
  };
}; 