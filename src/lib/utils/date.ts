/**
 * Date utility functions for the Utopía social network
 * Uses date-fns for reliable date manipulation and formatting
 */

import { 
  formatDistanceToNow, 
  format, 
  isToday, 
  isYesterday, 
  isThisWeek,
  isThisYear,
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
  differenceInWeeks,
  differenceInMonths,
  differenceInYears
} from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Format a date as relative time (e.g., "2h ago", "3d ago")
 * @param date - The date to format
 * @param addSuffix - Whether to add "ago" suffix
 * @returns Formatted relative time string
 */
export function formatRelativeTime(date: Date | string, addSuffix: boolean = true): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const now = new Date();
  const diffMinutes = differenceInMinutes(now, dateObj);
  const diffHours = differenceInHours(now, dateObj);
  const diffDays = differenceInDays(now, dateObj);
  
  // Less than 1 minute
  if (diffMinutes < 1) {
    return 'Ahora mismo';
  }
  
  // Less than 1 hour
  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }
  
  // Less than 24 hours
  if (diffHours < 24) {
    return `${diffHours}h`;
  }
  
  // Less than 7 days
  if (diffDays < 7) {
    return `${diffDays}d`;
  }
  
  // Less than 4 weeks
  const diffWeeks = differenceInWeeks(now, dateObj);
  if (diffWeeks < 4) {
    return `${diffWeeks}sem`;
  }
  
  // Less than 12 months
  const diffMonths = differenceInMonths(now, dateObj);
  if (diffMonths < 12) {
    return `${diffMonths}mes`;
  }
  
  // More than 12 months
  const diffYears = differenceInYears(now, dateObj);
  return `${diffYears}a`;
}

/**
 * Format a date for display in posts and comments
 * @param date - The date to format
 * @returns Formatted date string
 */
export function formatPostDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isToday(dateObj)) {
    return format(dateObj, 'HH:mm');
  }
  
  if (isYesterday(dateObj)) {
    return `Ayer a las ${format(dateObj, 'HH:mm')}`;
  }
  
  if (isThisWeek(dateObj)) {
    return format(dateObj, "EEEE 'a las' HH:mm", { locale: es });
  }
  
  if (isThisYear(dateObj)) {
    return format(dateObj, "d 'de' MMMM 'a las' HH:mm", { locale: es });
  }
  
  return format(dateObj, "d 'de' MMMM 'de' yyyy", { locale: es });
}

/**
 * Format a date for the profile page
 * @param date - The date to format
 * @returns Formatted date string
 */
export function formatProfileDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, "MMMM 'de' yyyy", { locale: es });
}

/**
 * Format a date for notifications
 * @param date - The date to format
 * @returns Formatted date string
 */
export function formatNotificationDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const now = new Date();
  const diffMinutes = differenceInMinutes(now, dateObj);
  
  if (diffMinutes < 1) {
    return 'Ahora';
  }
  
  if (diffMinutes < 60) {
    return `Hace ${diffMinutes}m`;
  }
  
  const diffHours = differenceInHours(now, dateObj);
  if (diffHours < 24) {
    return `Hace ${diffHours}h`;
  }
  
  if (isYesterday(dateObj)) {
    return 'Ayer';
  }
  
  if (isThisWeek(dateObj)) {
    return format(dateObj, 'EEEE', { locale: es });
  }
  
  return format(dateObj, 'd/MM/yy');
}

/**
 * Format a date for messages
 * @param date - The date to format
 * @returns Formatted date string
 */
export function formatMessageDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isToday(dateObj)) {
    return format(dateObj, 'HH:mm');
  }
  
  if (isYesterday(dateObj)) {
    return 'Ayer';
  }
  
  if (isThisWeek(dateObj)) {
    return format(dateObj, 'EEEE', { locale: es });
  }
  
  return format(dateObj, 'd/MM/yy');
}

/**
 * Format last seen time
 * @param date - The last seen date
 * @returns Formatted last seen string
 */
export function formatLastSeen(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  
  const diffMinutes = differenceInMinutes(now, dateObj);
  
  if (diffMinutes < 5) {
    return 'En línea';
  }
  
  if (diffMinutes < 60) {
    return `Activo hace ${diffMinutes}m`;
  }
  
  const diffHours = differenceInHours(now, dateObj);
  if (diffHours < 24) {
    return `Activo hace ${diffHours}h`;
  }
  
  return `Activo ${formatRelativeTime(dateObj)}`;
}

/**
 * Check if a date is within a certain number of minutes from now
 * @param date - The date to check
 * @param minutes - Number of minutes threshold
 * @returns Boolean indicating if date is within threshold
 */
export function isWithinMinutes(date: Date | string, minutes: number): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  return differenceInMinutes(now, dateObj) <= minutes;
}

/**
 * Get a Date object from various input types
 * @param input - Date string, Date object, or timestamp
 * @returns Date object or null if invalid
 */
export function toDate(input: string | Date | number | null | undefined): Date | null {
  if (!input) return null;
  
  if (input instanceof Date) return input;
  
  if (typeof input === 'number') {
    return new Date(input);
  }
  
  const parsed = new Date(input);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Format date for input fields
 * @param date - The date to format
 * @returns Formatted date string for input
 */
export function formatInputDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'yyyy-MM-dd');
}

/**
 * Format time for input fields
 * @param date - The date to format
 * @returns Formatted time string for input
 */
export function formatInputTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'HH:mm');
}
