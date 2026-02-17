/**
 * Security utilities for input sanitization and protection
 */

import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param html - HTML string to sanitize
 * @returns Sanitized HTML string
 */
export function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'span'],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
  }) as string;
}

/**
 * Sanitize plain text by removing HTML tags and special characters
 * @param text - Text to sanitize
 * @returns Sanitized text
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize user input for display
 * @param input - User input string
 * @returns Sanitized string safe for display
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';
  
  // Remove any HTML tags
  const stripped = input.replace(/<[^>]*>/g, '');
  
  // Trim whitespace
  return stripped.trim();
}

/**
 * Sanitize URL to prevent javascript: and other dangerous protocols
 * @param url - URL to sanitize
 * @returns Sanitized URL or empty string if dangerous
 */
export function sanitizeURL(url: string): string {
  if (!url) return '';
  
  const trimmed = url.trim().toLowerCase();
  
  // Block dangerous protocols
  const dangerousProtocols = [
    'javascript:',
    'data:',
    'vbscript:',
    'file:',
    'about:',
  ];
  
  for (const protocol of dangerousProtocols) {
    if (trimmed.startsWith(protocol)) {
      return '';
    }
  }
  
  // Only allow http, https, and relative URLs
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
    return url.trim();
  }
  
  // Default to https for URLs without protocol
  if (!trimmed.includes('://')) {
    return `https://${url.trim()}`;
  }
  
  return '';
}

/**
 * Escape special regex characters
 * @param string - String to escape
 * @returns Escaped string safe for regex
 */
export function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if a string contains potential SQL injection patterns
 * @param input - Input string to check
 * @returns True if suspicious patterns found
 */
export function hasSQLInjectionPatterns(input: string): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)\b)/i,
    /(--)|(\/\*)|(\*\/)/,
    /(\bOR\b|\bAND\b)\s*['"]?\d+['"]?\s*=\s*['"]?\d+/i,
    /UNION\s+SELECT/i,
    /'\s*OR\s*'/i,
  ];
  
  return sqlPatterns.some(pattern => pattern.test(input));
}

/**
 * Check if a string contains potential XSS patterns
 * @param input - Input string to check
 * @returns True if suspicious patterns found
 */
export function hasXSSPatterns(input: string): boolean {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /<form/gi,
    /expression\s*\(/gi,
  ];
  
  return xssPatterns.some(pattern => pattern.test(input));
}

/**
 * Validate and sanitize user content for posts and comments
 * @param content - User content to validate
 * @param maxLength - Maximum allowed length
 * @returns Sanitized content or null if invalid
 */
export function validateUserContent(content: string, maxLength: number = 5000): string | null {
  if (!content || typeof content !== 'string') {
    return null;
  }
  
  // Check length
  if (content.length > maxLength) {
    return null;
  }
  
  // Check for malicious patterns
  if (hasSQLInjectionPatterns(content) || hasXSSPatterns(content)) {
    return null;
  }
  
  // Sanitize HTML
  return sanitizeHTML(content);
}

/**
 * Generate a random token for CSRF protection
 * @param length - Token length in bytes
 * @returns Random token string
 */
export function generateCSRFToken(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Content Security Policy headers
 */
export const CSP_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "media-src 'self' https: blob:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-src 'self' https://accounts.google.com",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/**
 * Validate file type against allowed types
 * @param file - File to validate
 * @param allowedTypes - Array of allowed MIME types
 * @returns True if file type is allowed
 */
export function validateFileType(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.includes(file.type);
}

/**
 * Validate file size
 * @param file - File to validate
 * @param maxSizeMB - Maximum size in megabytes
 * @returns True if file size is within limit
 */
export function validateFileSize(file: File, maxSizeMB: number): boolean {
  const maxBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxBytes;
}

/**
 * Get file extension from filename
 * @param filename - Filename to extract extension from
 * @returns File extension in lowercase
 */
export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

/**
 * Allowed image types
 */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

/**
 * Allowed video types
 */
export const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
];

/**
 * Maximum file sizes
 */
export const MAX_FILE_SIZES = {
  image: 5, // 5MB
  video: 50, // 50MB
  avatar: 2, // 2MB
};
