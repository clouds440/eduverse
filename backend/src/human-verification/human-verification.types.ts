export const HUMAN_VERIFICATION_PURPOSES = [
  'ONLINE_ADMISSION',
  'ORG_REGISTRATION',
  'LOGIN',
] as const;

export type HumanVerificationPurpose = typeof HUMAN_VERIFICATION_PURPOSES[number];

export type HumanVerificationAnswer = {
  challengeId?: string;
  challengeAnswer?: string;
};
