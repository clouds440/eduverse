'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import PasswordStrength from '@/components/ui/PasswordStrength';
import { useGlobal } from '@/context/GlobalContext';
import { PLATFORM_NAME } from '@/lib/constants';

type ResetPasswordFormProps = {
  token: string;
};

export default function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const { state, dispatch } = useGlobal();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const resetSucceeded = redirectCountdown !== null;

  useEffect(() => {
    if (redirectCountdown === null) return;
    if (redirectCountdown <= 0) {
      router.replace('/login');
      return;
    }

    const timeout = window.setTimeout(() => {
      setRedirectCountdown((current) => current === null ? null : current - 1);
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [redirectCountdown, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (resetSucceeded) return;
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (state.ui.processing['reset-password-submit']) return;

    dispatch({ type: 'UI_START_PROCESSING', payload: 'reset-password-submit' });
    try {
      const response = await api.auth.resetPassword(token, password);
      setMessage(response.message);
      setPassword('');
      setConfirmPassword('');
      setRedirectCountdown(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password.');
    } finally {
      dispatch({ type: 'UI_STOP_PROCESSING', payload: 'reset-password-submit' });
    }
  };

  return (
    <div className="min-h-fit h-screen bg-background flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-background">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/8 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-size-[64px_64px]" />

      <div className="relative z-10 w-full max-w-lg">
        <div className="glass-card rounded-3xl p-8 sm:p-10 lg:p-12 shadow-2xl animate-fade-in-up">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-2">
              <Image src="/assets/eduverse-icon-192.png" alt="Eduverse Logo" className="object-cover" width={64} height={64} />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight mb-3">Set New Password</h1>
            <p className="text-muted-foreground font-medium text-sm sm:text-base">Choose a new password for your organization admin account.</p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-xs font-bold tracking-wider text-muted-foreground uppercase ml-1">New Password</Label>
              <Input
                id="new-password"
                type="password"
                icon={Lock}
                placeholder="********"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={resetSucceeded}
                error={!!error}
                className="h-12 font-medium border-border/40 bg-background/60 backdrop-blur-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
              />
              <PasswordStrength password={password} className="mt-2 px-1" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-xs font-bold tracking-wider text-muted-foreground uppercase ml-1">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                icon={Lock}
                placeholder="********"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={resetSucceeded}
                error={!!error}
                className="h-12 font-medium border-border/40 bg-background/60 backdrop-blur-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
              />
              {error && <p className="mt-1 text-xs text-danger font-semibold ml-1">{error}</p>}
            </div>

            {message && (
              <div className="rounded-2xl border border-success/30 bg-success/10 p-4 text-sm font-semibold text-success">
                <p>{message}</p>
                {redirectCountdown !== null && (
                  <p className="mt-2 text-success/80">
                    Redirecting to login in {redirectCountdown}...
                  </p>
                )}
              </div>
            )}

            <Button type="submit" loadingId="reset-password-submit" loadingText="Updating..." icon={ArrowRight} className="w-full h-12 font-bold text-base" disabled={resetSucceeded}>
              {resetSucceeded ? 'Redirecting...' : 'Reset Password'}
            </Button>

            <Link href="/login" className="flex items-center justify-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </form>
        </div>

        <div className="text-center mt-8">
          <p className="text-xs text-muted-foreground/60 font-medium">
            &copy; {new Date().getFullYear()} {PLATFORM_NAME}. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
