'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useGlobal } from '@/context/GlobalContext';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { PLATFORM_NAME } from '@/lib/constants';
import { getDeviceId, getDeviceInfo } from '@/lib/deviceUtils';
import Image from 'next/image';

export default function LoginPage() {
  const { login } = useAuth();
  const { state, dispatch } = useGlobal();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (state.ui.processing['login-submit']) return;
    dispatch({ type: 'UI_START_PROCESSING', payload: 'login-submit' });

    try {
      const deviceId = getDeviceId();
      const deviceInfo = getDeviceInfo();
      const loginPayload = {
        ...formData,
        deviceId,
        deviceName: deviceInfo?.deviceName,
        deviceType: deviceInfo?.deviceType,
        browser: deviceInfo?.browser,
        os: deviceInfo?.os,
      };
      const res = await api.auth.login(loginPayload);
      await login(res.access_token);
    } catch (err: unknown) {
      const message = err instanceof Error ? err?.message : 'Login failed';
      const msgStr = Array.isArray(message) ? message[0] : message;
      const newErrors: typeof errors = {};

      if (msgStr.toLowerCase().includes('email')) {
        newErrors.email = msgStr;
      } else if (msgStr.toLowerCase().includes('password') || msgStr.toLowerCase().includes('credentials')) {
        newErrors.password = msgStr;
      } else {
        newErrors.general = msgStr;
      }
      setErrors(newErrors);
    } finally {
      dispatch({ type: 'UI_STOP_PROCESSING', payload: 'login-submit' });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  return (
    <div className="min-h-fit h-screen bg-background flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-background">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/8 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[40%] left-[30%] w-[30%] h-[30%] bg-primary/6 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '4s' }} />
      </div>

      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-size-[64px_64px]" />

      {/* Main card */}
      <div className="relative z-10 w-full max-w-lg">
        <div className="glass-card rounded-3xl p-8 sm:p-10 lg:p-12 shadow-2xl animate-fade-in-up">
          {/* Header */}
          <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-2">
                  <Image 
                      src={'/assets/eduverse-icon-192.png'}
                      alt='Eduverse Logo'
                      className="object-cover"
                      width={64}
                      height={64}
                  />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight mb-3">
              Welcome Back
            </h1>
            <p className="text-muted-foreground font-medium text-sm sm:text-base">
              Sign in to your {PLATFORM_NAME} portal
            </p>
          </div>

          {/* Form */}
          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email-address" className="text-xs font-bold tracking-wider text-muted-foreground uppercase ml-1">Email</Label>
                <Input
                  id="email-address"
                  name="email"
                  type="email"
                  required
                  tabIndex={1}
                  icon={Mail}
                  placeholder="admin@school.edu"
                  value={formData.email}
                  onChange={handleChange}
                  error={!!errors.email}
                  className="h-12 font-medium border-border/40 bg-background/60 backdrop-blur-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                />
                {errors.email && <p className="mt-1 text-xs text-danger font-semibold ml-1">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <Label htmlFor="password" className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Password</Label>
                  <Link href="/forgot-password" className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">Forgot password?</Link>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  tabIndex={2}
                  icon={Lock}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  error={!!errors.password}
                  className="h-12 font-medium border-border/40 bg-background/60 backdrop-blur-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                />
                {errors.password && <p className="mt-1 text-xs text-danger font-semibold ml-1">{errors.password}</p>}
                {errors.general && <p className="mt-2 text-sm text-danger font-bold text-center">{errors.general}</p>}
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center">
              <label className="flex items-center group cursor-pointer select-none">
                <div className="relative">
                  <input
                    id="remember-me"
                    name="rememberMe"
                    type="checkbox"
                    className="peer sr-only"
                    checked={formData.rememberMe}
                    onChange={handleChange}
                  />
                  <div className="w-5 h-5 bg-background/60 border-2 border-border/40 rounded-lg peer-checked:bg-primary peer-checked:border-primary transition-all duration-200 group-hover:border-primary/30 flex items-center justify-center">
                    <svg
                      className={`w-3 h-3 text-white transition-opacity duration-200 ${formData.rememberMe ? 'opacity-100' : 'opacity-0'}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <span className="ml-3 text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  Remember me
                </span>
              </label>
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              loadingId="login-submit"
              loadingText="Signing in..."
              icon={ArrowRight}
              className="w-full h-12 font-bold text-base shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              Sign In
            </Button>

            {/* Sign up link */}
            <p className="text-center text-sm text-muted-foreground font-medium">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-primary hover:text-primary/80 transition-colors font-bold">
                Get started free
              </Link>
            </p>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs text-muted-foreground/60 font-medium">
            © {new Date().getFullYear()} {PLATFORM_NAME}. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
