export const CAPTCHA_PURPOSES = [
  'ONLINE_ADMISSION',
  'ORG_REGISTRATION',
  'LOGIN',
] as const;

export type CaptchaPurpose = typeof CAPTCHA_PURPOSES[number];

export function isCaptchaPurpose(value: string): value is CaptchaPurpose {
  return CAPTCHA_PURPOSES.includes(value as CaptchaPurpose);
}
