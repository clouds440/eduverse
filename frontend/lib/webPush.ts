import { api, type WebPushSubscriptionPayload } from '@/lib/api';

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

const arrayBufferToBase64Url = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const getSubscriptionKey = (subscription: PushSubscription, keyName: PushEncryptionKeyName) => {
  const key = subscription.getKey(keyName);
  return key ? arrayBufferToBase64Url(key) : '';
};

export const serializeSubscription = (subscription: PushSubscription): WebPushSubscriptionPayload => {
  const json = subscription.toJSON();
  const endpoint = json.endpoint || subscription.endpoint;
  const p256dh = json.keys?.p256dh || getSubscriptionKey(subscription, 'p256dh');
  const auth = json.keys?.auth || getSubscriptionKey(subscription, 'auth');

  if (!endpoint || !p256dh || !auth) {
    throw new Error('Browser returned an incomplete push subscription.');
  }

  return {
    endpoint,
    expirationTime: json.expirationTime ?? subscription.expirationTime,
    keys: { p256dh, auth },
  };
};

const isIOS = () => /ipad|iphone|ipod/.test(navigator.userAgent.toLowerCase());
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const supportsWebPush = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window &&
  !(isIOS() && !isStandalone());

async function getPublicVapidKey(authToken: string) {
  const bundledKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (bundledKey) return bundledKey;

  const config = await api.notifications.getPushConfig(authToken);
  if (config.publicKey) return config.publicKey;

  throw new Error('Push notifications are not configured.');
}

async function getPushSubscription(registration: ServiceWorkerRegistration, publicVapidKey: string) {
  if (!publicVapidKey) {
    throw new Error('Push notifications are not configured.');
  }

  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    const existingKey = existing.options.applicationServerKey;
    if (existingKey && arrayBufferToBase64Url(existingKey) !== publicVapidKey) {
      await existing.unsubscribe();
    } else {
      return existing;
    }
  }

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
  });
}

export async function syncWebPushSubscription(authToken: string) {
  if (!supportsWebPush()) {
    throw new Error('Push notifications are not supported on this device.');
  }
  if (Notification.permission !== 'granted') {
    throw new Error('Push notification permission has not been granted.');
  }

  const registration = await navigator.serviceWorker.ready;
  const publicVapidKey = await getPublicVapidKey(authToken);
  const subscription = await getPushSubscription(registration, publicVapidKey);
  const payload = serializeSubscription(subscription);
  await api.notifications.subscribeToPush(payload, authToken);
  return payload;
}

export async function unsubscribeCurrentWebPushSubscription(authToken: string) {
  if (!supportsWebPush()) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await api.notifications.unsubscribeFromPush(endpoint, authToken);
}
