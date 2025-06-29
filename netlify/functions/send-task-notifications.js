const webpush = require('web-push');
const fetch = require('node-fetch');

webpush.setVapidDetails(
  'git+rudder@sampatt.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

exports.handler = async function(event, context) {
  // 1. Fetch your push subscription(s) from Supabase
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  // Get all subscriptions (or filter by user_id if needed)
  const subRes = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    }
  });
  const subscriptions = await subRes.json();

  // 2. Query Supabase for tasks starting now
  const now = new Date();
  const nowDate = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const nowTime = now.toISOString().slice(11, 16); // HH:MM

  const taskRes = await fetch(`${supabaseUrl}/rest/v1/tasks?date=eq.${nowDate}&start_time=eq.${nowTime}`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    }
  });
  const tasks = await taskRes.json();

  // 3. Send a notification for each task to each subscription
  let sent = 0;
  for (const task of tasks) {
    const payload = JSON.stringify({
      title: `Task Started: ${task.title}`,
      body: `Your task "${task.title}" is scheduled for now.`,
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

  return {
    statusCode: 200,
    body: JSON.stringify({ sent, tasks: tasks.length, subscriptions: subscriptions.length })
  };
}; 