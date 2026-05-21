'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { useGlobal } from '@/context/GlobalContext';
import { PLATFORM_NAME } from '@/lib/constants';

type ForgotPasswordFormProps = {
  initialReasonMessage?: string;
};

export default function ForgotPasswordForm({ initialReasonMessage = '' }: ForgotPasswordFormProps) {
  const { state, dispatch } = useGlobal();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [reasonMessage, setReasonMessage] = useState(initialReasonMessage);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setReasonMessage('');
    if (state.ui.processing['forgot-password-submit']) return;

    dispatch({ type: 'UI_START_PROCESSING', payload: 'forgot-password-submit' });
    try {
      const response = await api.auth.forgotPassword(email);
      setMessage(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to request password reset.');
    } finally {
      dispatch({ type: 'UI_STOP_PROCESSING', payload: 'forgot-password-submit' });
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
            <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight mb-3">Reset Password</h1>
            <p className="text-muted-foreground font-medium text-sm sm:text-base">
              Enter your login email or verified contact email.
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="reset-email" className="text-xs font-bold tracking-wider text-muted-foreground uppercase ml-1">Login or Contact Email</Label>
              <Input
                id="reset-email"
                type="email"
                required
                icon={Mail}
                placeholder="admin@school.edu"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                error={!!error}
                className="h-12 font-medium border-border/40 bg-background/60 backdrop-blur-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
              />
              <p className="mt-1 text-xs text-muted-foreground font-semibold ml-1">
                If the account is eligible, a password reset link will be sent to the verified contact email.
              </p>
              {error && <p className="mt-1 text-xs text-danger font-semibold ml-1">{error}</p>}
            </div>

            {reasonMessage && (
              <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm font-semibold text-warning">
                <p>{reasonMessage}</p>
              </div>
            )}

            {message && (
              <div className="rounded-2xl border border-success/30 bg-success/10 p-4 text-sm font-semibold text-success">
                <p>{message}</p>
                <p className="mt-2 text-success/80">If you use a student or teacher account, please contact your organization administrator to reset your password.</p>
              </div>
            )}

            <Button type="submit" loadingId="forgot-password-submit" loadingText="Sending..." icon={ArrowRight} className="w-full h-12 font-bold text-base">
              Send Reset Link
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
