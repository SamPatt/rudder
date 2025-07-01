# Android PWA Push Notification Troubleshooting Guide

This guide will help you troubleshoot why push notifications aren't working on your Android PWA.

## Quick Diagnostic Steps

### 1. Use the Built-in Debug Tool

1. Open your PWA on your Android device
2. Go to the **Tasks** page
3. Scroll down to the **Push Debug** section
4. Check all the status indicators:
   - ✅ HTTPS: Must be green
   - ✅ Android: Should be green on Android devices
   - ✅ Chrome: Should be green
   - ✅ PWA Mode: Should be green (indicates installed PWA)
   - ✅ Service Worker: All should be green
   - ✅ Notifications: All should be green

### 2. Run the Test Script

```bash
# Install dependencies if needed
npm install web-push @supabase/supabase-js dotenv

# Run the test script
node scripts/test-push-setup.js
```

This will test your entire push notification setup and provide detailed feedback.

## Common Issues and Solutions

### Issue 1: HTTPS/Origin Mismatch

**Symptoms:**
- Service worker fails to register
- Push notifications don't work
- Debug tool shows HTTPS: ❌

**Solutions:**
1. **Use Production URL**: Always test on your production Netlify URL (`https://ruddertasks.netlify.app`), not localhost
2. **Check Origin**: Ensure your PWA is loaded from the same origin where the service worker is registered
3. **Avoid HTTP**: Never use HTTP for push notifications (except localhost for development)

### Issue 2: Service Worker Not Active

**Symptoms:**
- Debug tool shows "Service Worker Active: ❌"
- Push notifications don't trigger

**Solutions:**
1. **Clear Browser Data**: Clear Chrome's site data for your PWA
2. **Reinstall PWA**: Uninstall and reinstall the PWA
3. **Check Scope**: Ensure service worker scope covers all paths (`/`)
4. **Force Refresh**: Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)

### Issue 3: Notification Permissions

**Symptoms:**
- Debug tool shows "Permission: denied" or "default"
- No notifications appear

**Solutions:**
1. **Check Android Settings**:
   - Go to **Settings → Apps → Chrome → Notifications**
   - Find your PWA in the "Sites" or "Installed apps" section
   - Ensure "Show notifications" is ON
   - Disable "Quiet notifications" if enabled

2. **Check PWA Settings**:
   - Open your PWA
   - Tap the three dots menu → Site settings
   - Ensure "Notifications" is set to "Allow"

3. **Request Permission Again**:
   - Use the "Register for Push Notifications" button in your PWA
   - Accept the permission prompt

### Issue 4: PWA Not in Standalone Mode

**Symptoms:**
- Debug tool shows "PWA Mode: ❌"
- Notifications may not work properly

**Solutions:**
1. **Install PWA**: Add to home screen from Chrome menu
2. **Launch from Home Screen**: Always open the PWA from the home screen icon
3. **Check Display Mode**: Ensure `display: standalone` in manifest.json

### Issue 5: VAPID Keys Issues

**Symptoms:**
- Debug tool shows "VAPID Key: ❌"
- Push registration fails

**Solutions:**
1. **Check Environment Variables**:
   - Ensure `VITE_VAPID_PUBLIC_KEY` is set in your build environment
   - Ensure `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` are set in Netlify

2. **Regenerate VAPID Keys**:
   ```bash
   npx web-push generate-vapid-keys
   ```

3. **Update Netlify Environment Variables**:
   - Go to Netlify Dashboard → Site Settings → Environment Variables
   - Add/update the VAPID keys

### Issue 6: Database Subscription Issues

**Symptoms:**
- Debug tool shows "Has Subscription: ❌"
- No subscriptions in database

**Solutions:**
1. **Re-register**: Use the "Register for Push Notifications" button
2. **Check Database**: Verify subscriptions exist in Supabase
3. **Clear Old Subscriptions**: Remove expired subscriptions from database

### Issue 7: Netlify Function Issues

**Symptoms:**
- Test script shows Netlify function errors
- Scheduled notifications don't work

**Solutions:**
1. **Check Function Deployment**: Ensure functions are deployed to Netlify
2. **Check Environment Variables**: Verify all required env vars are set in Netlify
3. **Check Function Logs**: View function logs in Netlify Dashboard

## Step-by-Step Testing Process

### Step 1: Environment Check
1. Open your PWA on Android
2. Go to Tasks → Push Debug
3. Verify all environment checks are green

### Step 2: Service Worker Test
1. In Push Debug, click "Test Direct Notification"
2. You should see a notification immediately
3. If not, service worker is not working

### Step 3: Push Notification Test
1. In Push Debug, click "Test Push Notification"
2. Check the result message
3. You should receive a notification on your device

### Step 4: Database Test
1. Run the test script: `node scripts/test-push-setup.js`
2. Check if subscriptions are found and tested
3. Verify no errors in the output

### Step 5: Production Test
1. Ensure you're using the production URL
2. Install PWA to home screen
3. Test notifications from the installed PWA

## Advanced Debugging

### Chrome DevTools Remote Debugging

1. **Enable USB Debugging** on your Android device
2. **Connect via USB** to your computer
3. **Open Chrome DevTools** on your computer
4. **Go to chrome://inspect** and find your device
5. **Inspect your PWA** and check the Console for errors
6. **Check Service Worker** tab for service worker status

### Check Service Worker Console

1. In Chrome DevTools, go to Application tab
2. Click on Service Workers in the left sidebar
3. Check for any errors or failed registrations
4. Look at the console logs for debugging information

### Monitor Network Requests

1. In Chrome DevTools, go to Network tab
2. Trigger a push notification
3. Look for requests to your Netlify function
4. Check for any failed requests or CORS errors

## Common Error Messages

### "Service Worker registration failed"
- Check HTTPS requirement
- Clear browser data
- Check for syntax errors in sw.js

### "Push subscription failed"
- Check VAPID keys
- Verify notification permissions
- Check service worker is active

### "No subscriptions found"
- Re-register for push notifications
- Check database connection
- Verify user authentication

### "Netlify function error"
- Check function deployment
- Verify environment variables
- Check function logs in Netlify Dashboard

## Prevention Tips

1. **Always test on production URL** for Android PWA
2. **Keep VAPID keys secure** and never expose private key
3. **Monitor function logs** regularly
4. **Test notifications** after any deployment
5. **Keep service worker simple** and avoid complex logic
6. **Use proper error handling** in all push-related code

## Getting Help

If you're still having issues after following this guide:

1. **Check the debug output** from the Push Debug component
2. **Run the test script** and share the output
3. **Check Chrome DevTools** for any console errors
4. **Verify all environment variables** are set correctly
5. **Test on a different Android device** to isolate device-specific issues

Remember: Android PWA push notifications require everything to be perfectly configured. Even small issues can prevent notifications from working. 