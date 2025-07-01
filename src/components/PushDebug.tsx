import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function PushDebug() {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkCapabilities = async () => {
      const info: any = {
        userAgent: navigator.userAgent,
        isAndroid: /Android/.test(navigator.userAgent),
        isChrome: /Chrome/.test(navigator.userAgent),
        isPWA: window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone,
        serviceWorker: 'serviceWorker' in navigator,
        pushManager: 'PushManager' in window,
        notification: 'Notification' in window,
        permission: Notification.permission,
        https: location.protocol === 'https:',
        hostname: location.hostname,
        origin: location.origin,
        vapidKeyExists: !!import.meta.env.VITE_VAPID_PUBLIC_KEY,
        vapidKeyLength: import.meta.env.VITE_VAPID_PUBLIC_KEY?.length || 0,
        vapidKeyPreview: import.meta.env.VITE_VAPID_PUBLIC_KEY?.substring(0, 20) + '...',
      };

      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          info.serviceWorkerRegistered = !!registration;
          info.serviceWorkerActive = registration?.active?.state === 'activated';
          info.serviceWorkerScope = registration?.scope;
          info.serviceWorkerScriptURL = (registration as any)?.scriptURL;
          
          if (registration?.pushManager) {
            const subscription = await registration.pushManager.getSubscription();
            info.hasPushSubscription = !!subscription;
            if (subscription) {
              info.subscriptionEndpoint = subscription.endpoint;
              info.subscriptionKeys = subscription.toJSON().keys;
            }
          }
        } catch (error) {
          info.serviceWorkerError = error instanceof Error ? error.message : 'Unknown error';
        }
      }

      // Check for installed PWA
      if ('getInstalledRelatedApps' in navigator) {
        try {
          const relatedApps = await (navigator as any).getInstalledRelatedApps();
          info.installedRelatedApps = relatedApps;
        } catch (error) {
          info.installedRelatedAppsError = error instanceof Error ? error.message : 'Unknown error';
        }
      }

      setDebugInfo(info);
      setLoading(false);
    };

    const fetchSubscriptions = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase
            .from('push_subscriptions')
            .select('*')
            .eq('user_id', user.id);
          
          if (error) {
            console.error('Error fetching subscriptions:', error);
          } else {
            setSubscriptions(data || []);
          }
        }
      } catch (error) {
        console.error('Error fetching subscriptions:', error);
      }
    };

    checkCapabilities();
    fetchSubscriptions();
  }, []);

  const testDirectNotification = async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        alert('No service worker found');
        return;
      }

              await registration.showNotification('Direct Test Notification', {
          body: 'This is a direct test notification',
          icon: '/icon-192.png',
          badge: '/icon-72.png',
          tag: 'direct-test',
          requireInteraction: true,
          silent: false
        });
      
      alert('Direct notification sent! Check if you see it.');
    } catch (error) {
      alert(`Error sending direct notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const testPushNotification = async () => {
    try {
      const response = await fetch('/.netlify/functions/test-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ test: true })
      });
      
      const result = await response.json();
      alert(`Test push sent! Result: ${JSON.stringify(result)}`);
    } catch (error) {
      alert(`Test push failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (loading) {
    return <div className="bg-gray-100 p-4 rounded">Loading debug info...</div>;
  }

  return (
    <div className="bg-gray-100 p-4 rounded text-xs space-y-4">
      <h3 className="font-bold mb-2 text-gray-800">Push Notification Debug Info:</h3>
      
      {/* Environment Check */}
      <div className="bg-white p-3 rounded border">
        <h4 className="font-semibold text-gray-800 mb-2">Environment Check:</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>HTTPS: <span className={debugInfo.https ? 'text-green-600' : 'text-red-600'}>{debugInfo.https ? '✅' : '❌'}</span></div>
          <div>Android: <span className={debugInfo.isAndroid ? 'text-blue-600' : 'text-gray-600'}>{debugInfo.isAndroid ? '✅' : '❌'}</span></div>
          <div>Chrome: <span className={debugInfo.isChrome ? 'text-blue-600' : 'text-gray-600'}>{debugInfo.isChrome ? '✅' : '❌'}</span></div>
          <div>PWA Mode: <span className={debugInfo.isPWA ? 'text-green-600' : 'text-gray-600'}>{debugInfo.isPWA ? '✅' : '❌'}</span></div>
        </div>
      </div>

      {/* Service Worker Status */}
      <div className="bg-white p-3 rounded border">
        <h4 className="font-semibold text-gray-800 mb-2">Service Worker:</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>Supported: <span className={debugInfo.serviceWorker ? 'text-green-600' : 'text-red-600'}>{debugInfo.serviceWorker ? '✅' : '❌'}</span></div>
          <div>Registered: <span className={debugInfo.serviceWorkerRegistered ? 'text-green-600' : 'text-red-600'}>{debugInfo.serviceWorkerRegistered ? '✅' : '❌'}</span></div>
          <div>Active: <span className={debugInfo.serviceWorkerActive ? 'text-green-600' : 'text-red-600'}>{debugInfo.serviceWorkerActive ? '✅' : '❌'}</span></div>
          <div>Push Manager: <span className={debugInfo.pushManager ? 'text-green-600' : 'text-red-600'}>{debugInfo.pushManager ? '✅' : '❌'}</span></div>
        </div>
        {debugInfo.serviceWorkerScope && (
          <div className="mt-2 text-xs text-gray-600">Scope: {debugInfo.serviceWorkerScope}</div>
        )}
      </div>

      {/* Notification Status */}
      <div className="bg-white p-3 rounded border">
        <h4 className="font-semibold text-gray-800 mb-2">Notifications:</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>Supported: <span className={debugInfo.notification ? 'text-green-600' : 'text-red-600'}>{debugInfo.notification ? '✅' : '❌'}</span></div>
          <div>Permission: <span className={debugInfo.permission === 'granted' ? 'text-green-600' : debugInfo.permission === 'denied' ? 'text-red-600' : 'text-yellow-600'}>{debugInfo.permission}</span></div>
          <div>Has Subscription: <span className={debugInfo.hasPushSubscription ? 'text-green-600' : 'text-red-600'}>{debugInfo.hasPushSubscription ? '✅' : '❌'}</span></div>
          <div>VAPID Key: <span className={debugInfo.vapidKeyExists ? 'text-green-600' : 'text-red-600'}>{debugInfo.vapidKeyExists ? '✅' : '❌'}</span></div>
        </div>
        {debugInfo.vapidKeyPreview && (
          <div className="mt-2 text-xs text-gray-600">VAPID Key: {debugInfo.vapidKeyPreview}</div>
        )}
      </div>

      {/* Subscriptions */}
      <div className="bg-white p-3 rounded border">
        <h4 className="font-semibold text-gray-800 mb-2">Database Subscriptions ({subscriptions.length}):</h4>
        {subscriptions.length > 0 ? (
          subscriptions.map((sub, index) => (
            <div key={index} className="text-xs text-gray-600 mb-2 p-2 bg-gray-50 rounded">
              <div>User ID: {sub.user_id}</div>
              <div>Endpoint: {sub.subscription.endpoint.substring(0, 50)}...</div>
            </div>
          ))
        ) : (
          <div className="text-xs text-gray-500">No subscriptions found in database</div>
        )}
      </div>

      {/* Test Buttons */}
      <div className="bg-white p-3 rounded border">
        <h4 className="font-semibold text-gray-800 mb-2">Test Notifications:</h4>
        <div className="space-y-2">
          <button 
            onClick={testDirectNotification}
            className="w-full bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600"
          >
            Test Direct Notification
          </button>
          <button 
            onClick={testPushNotification}
            className="w-full bg-green-500 text-white px-3 py-1 rounded text-xs hover:bg-green-600"
          >
            Test Push Notification
          </button>
        </div>
      </div>

      {/* Raw Debug Info */}
      <details className="bg-white p-3 rounded border">
        <summary className="font-semibold text-gray-800 cursor-pointer">Raw Debug Info</summary>
        <pre className="whitespace-pre-wrap overflow-auto text-gray-800 mt-2 text-xs">
          {JSON.stringify(debugInfo, null, 2)}
        </pre>
      </details>
    </div>
  );
} 