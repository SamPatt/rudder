import { supabase } from '../lib/supabase';

interface PushRegisterButtonProps {
  user: { id: string };
}

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export default function PushRegisterButton({ user }: PushRegisterButtonProps) {
  async function registerForPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Push notifications are not supported in this browser.');
      return;
    }
    const permission = await Notification.requestPermission();
    console.log('Notification permission:', permission);
    if (permission !== 'granted') {
      alert('Notifications not enabled!');
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
      console.log('Push subscription object:', sub);
      // Save to Supabase
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert([
          {
            user_id: user.id,
            subscription: sub
          }
        ], { onConflict: 'user_id' });
      if (error) {
        console.error('Supabase upsert error:', error);
        alert('Failed to save subscription to Supabase');
      } else {
        alert('Push subscription saved to Supabase!');
      }
    } catch (err) {
      console.error('Push registration error:', err);
      alert('Failed to register for push notifications. See console for details.');
    }
  }

  // Helper to convert VAPID key
  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
  }

  return (
    <button
      className="bg-blue-600 text-white px-4 py-2 rounded"
      onClick={registerForPush}
    >
      Enable Push Notifications
    </button>
  );
} 