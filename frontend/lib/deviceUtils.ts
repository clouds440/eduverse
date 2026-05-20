/**
 * Device utilities for session management
 */

const DEVICE_ID_KEY = 'device_id';
const DEVICE_ID_COOKIE = 'device_id';
const COOKIE_EXPIRY_DAYS = 365;
const DEVICE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Set a cookie with expiration
 */
function setCookie(name: string, value: string, days: number) {
  if (typeof document === 'undefined') return;
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  const secure = window.location.protocol === 'https:' ? ';Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax${secure}`;
}

/**
 * Get a cookie value
 */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const nameEQ = `${name}=`;
  const cookies = document.cookie.split(';');
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim();
    if (cookie.indexOf(nameEQ) === 0) {
      try {
        return decodeURIComponent(cookie.substring(nameEQ.length));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function isValidDeviceId(value: string | null): value is string {
  return !!value && DEVICE_ID_PATTERN.test(value);
}

function generateDeviceId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
    return [
      hex.slice(0, 4).join(''),
      hex.slice(4, 6).join(''),
      hex.slice(6, 8).join(''),
      hex.slice(8, 10).join(''),
      hex.slice(10, 16).join(''),
    ].join('-');
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

/**
 * Get or generate a unique device ID for this browser/device
 * This ID persists across sessions using localStorage and cookie fallback
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return '';

  // Check localStorage first
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);

  // Fallback to cookie if localStorage is empty
  if (!isValidDeviceId(deviceId)) {
    deviceId = getCookie(DEVICE_ID_COOKIE);
  }

  // Generate new ID if neither exists
  if (!isValidDeviceId(deviceId)) {
    deviceId = generateDeviceId();
    // Store in both localStorage and cookie
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    setCookie(DEVICE_ID_COOKIE, deviceId, COOKIE_EXPIRY_DAYS);
  } else {
    // Sync: if only cookie exists, also store in localStorage
    if (localStorage.getItem(DEVICE_ID_KEY) !== deviceId) {
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    // Sync: if only localStorage exists, also store in cookie
    if (!getCookie(DEVICE_ID_COOKIE)) {
      setCookie(DEVICE_ID_COOKIE, deviceId, COOKIE_EXPIRY_DAYS);
    }
  }

  return deviceId;
}

/**
 * Get device information from user agent
 */
export function getDeviceInfo() {
  if (typeof window === 'undefined') return null;
  
  const userAgent = navigator.userAgent;
  
  // Detect browser
  let browser = 'Unknown';
  if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Safari')) browser = 'Safari';
  else if (userAgent.includes('Edge')) browser = 'Edge';
  
  // Detect OS
  let os = 'Unknown';
  if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac')) os = 'macOS';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iOS')) os = 'iOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  
  // Detect device type
  let deviceType = 'desktop';
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
    deviceType = 'mobile';
  } else if (/iPad/i.test(userAgent)) {
    deviceType = 'tablet';
  }
  
  return {
    browser,
    os,
    deviceType,
    deviceName: `${browser} on ${os}`
  };
}
