import {
  PendingLoginStatus,
  TwoFactorMethod,
} from '@/prisma/prisma-client';

export type TwoFactorLoginMethod = TwoFactorMethod;

export interface TwoFactorChallengeResponse {
  pendingLoginId: string;
  status: PendingLoginStatus;
  selectedMethod: TwoFactorLoginMethod | null;
  methods: TwoFactorLoginMethod[];
  expiresAt: string;
  emailHint: string | null;
  emailIsRecoveryFallback: boolean;
}

export interface TwoFactorVerificationResponse {
  verified: true;
}

export interface AuthMessageResponse {
  message: string;
}
