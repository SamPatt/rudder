// Timezone utilities for consistent time handling across the app

// Get the user's current timezone
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    // Fallback to Detroit timezone if detection fails
    return 'America/Detroit';
  }
}

// Convert a date to the user's local timezone
export function toLocalDate(date: Date): string {
  const timezone = getUserTimezone();
  const localDate = new Date(date.toLocaleString("en-US", {timeZone: timezone}));
  return localDate.toISOString().split('T')[0];
}

// Get current date in user's timezone
export function getCurrentLocalDate(): string {
  return toLocalDate(new Date());
}

// Convert local time to UTC for database storage
export function localTimeToUTC(date: string, time: string): string {
  const timezone = getUserTimezone();
  const localDateTime = `${date}T${time}`;
  const localDate = new Date(localDateTime);
  
  // Convert to UTC
  const utcDate = new Date(localDate.toLocaleString("en-US", {timeZone: timezone}));
  return utcDate.toISOString();
}

// Convert UTC time from database to local time for display
export function utcToLocalTime(utcTime: string): string {
  if (!utcTime) return '';
  
  const timezone = getUserTimezone();
  const utcDate = new Date(utcTime);
  
  return utcDate.toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit"
  });
}

// Convert UTC time from database to local time in 12-hour format for display
export function utcToLocalTime12Hour(utcTime: string): string {
  if (!utcTime) return '';
  
  const timezone = getUserTimezone();
  const utcDate = new Date(utcTime);
  
  return utcDate.toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour12: true,
    hour: "2-digit",
    minute: "2-digit"
  });
}

// Get current time in user's timezone
export function getCurrentLocalTime(): string {
  return new Date().toLocaleTimeString("en-US", {
    timeZone: getUserTimezone(),
    hour12: false,
    hour: "2-digit",
    minute: "2-digit"
  });
}

// Format a date for display in the user's timezone
export function formatLocalDate(date: Date): string {
  const timezone = getUserTimezone();
  return date.toLocaleDateString('en-US', { 
    timeZone: timezone,
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

// Check if a date is today in the user's timezone
export function isToday(date: Date): boolean {
  const today = new Date();
  const todayLocal = toLocalDate(today);
  const dateLocal = toLocalDate(date);
  return todayLocal === dateLocal;
}

// Convert local date and time to UTC date string for database queries
export function localDateTimeToUTCDate(localDate: string, localTime: string): string {
  const utcTime = localTimeToUTC(localDate, localTime);
  return new Date(utcTime).toISOString().split('T')[0];
}

// Get current UTC time
export function getCurrentUTCTime(): string {
  return new Date().toISOString();
}

// Get current UTC date
export function getCurrentUTCDate(): string {
  return new Date().toISOString().split('T')[0];
} 