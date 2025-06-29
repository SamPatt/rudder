import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface PushRegisterButtonProps {
  user: { id: string };
}

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export default function PushRegisterButton({ user }: PushRegisterButtonProps) {
  const [status, setStatus] = useState<string>('');

  async function registerForPush() {
    setStatus('Checking browser support...');
    
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('Error: Push notifications are not supported in this browser.');
      return;
    }

    setStatus('Requesting notification permission...');
    const permission = await Notification.requestPermission();
    console.log('Notification permission:', permission);
    
    if (permission !== 'granted') {
      setStatus('Error: Notifications not enabled! Please allow notifications and try again.');
      return;
    }

    setStatus('Getting service worker...');
    try {
      const reg = await navigator.serviceWorker.ready;
      setStatus('Creating push subscription...');
      
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
      
      console.log('Push subscription object:', sub);
      setStatus('Saving subscription to database...');
      
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
        setStatus(`Error: Failed to save subscription to database: ${error.message}`);
      } else {
        setStatus('Success! Push notifications are now enabled.');
        setTimeout(() => setStatus(''), 3000); // Clear success message after 3 seconds
      }
    } catch (err) {
      console.error('Push registration error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setStatus(`Error: Failed to register for push notifications: ${errorMessage}`);
    }
  }

  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
  }

  return (
    <div className="space-y-2">
      <button
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        onClick={registerForPush}
        disabled={status.includes('Checking') || status.includes('Requesting') || status.includes('Creating') || status.includes('Saving')}
      >
        Enable Push Notifications
      </button>
      {status && (
        <div className={`text-sm p-2 rounded ${
          status.includes('Error') ? 'bg-red-100 text-red-700' : 
          status.includes('Success') ? 'bg-green-100 text-green-700' : 
          'bg-blue-100 text-blue-700'
        }`}>
          {status}
        </div>
      )}
    </div>
  );
} 