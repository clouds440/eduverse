'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Mail, Lock } from 'lucide-react';
import Link from 'next/link';
import { useGlobal } from '@/context/GlobalContext';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { PLATFORM_NAME } from '@/lib/constants';
import { Brand } from '@/components/ui/Brand';
import Image from 'next/image';
import { getDeviceId, getDeviceInfo } from '@/lib/deviceUtils';

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
      login(res.access_token || '');
      dispatch({ type: 'TOAST_ADD', payload: { message: 'Welcome back!', type: 'success' } });
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Login failed';
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
    <div className="flex min-h-fit h-screen bg-background overflow-hidden relative">
      {/* Left Column: Branding Assets (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center p-10 overflow-hidden bg-linear-to-br from-primary/5 via-background to-secondary/5">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/30 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-secondary/30 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-pulse delay-700"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/20 rounded-full mix-blend-screen filter blur-2xl opacity-10"></div>

        <div className="relative z-10 w-full max-w-lg text-center lg:text-left space-y-16 animate-in fade-in slide-in-from-left duration-1000">
          <div className="space-y-6">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
              <h1 className="relative text-4xl xl:text-5xl font-black text-foreground leading-tight tracking-tight">
                The <span className="text-primary animate-pulse group-hover:scale-110 transition-transform inline-block">Verse</span> <br />
                of Modern Education.
              </h1>
            </div>
            <p className="text-lg text-muted-foreground font-medium leading-relaxed max-w-md">
              Streamline your school&apos;s operations with the ultimate all-in-one management platform. Efficient, secure, and ready for the future.
            </p>
          </div>
          <div className="relative w-full aspect-square max-w-md mx-auto drop-shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
            <div className="absolute inset-0 bg-linear-to-br from-primary/10 to-secondary/10 rounded-3xl blur-3xl animate-pulse" />
            <Image
              src="/assets/eduverse.png"
              alt="Eduverse"
              fill
              className="object-contain dark:invert relative z-10"
              sizes="(max-width: 1024px) 0px, 28rem"
            />
          </div>
        </div>

        {/* Footer branding */}
        <div className="absolute bottom-8 left-12 z-10 flex items-center space-x-2 opacity-40 hover:opacity-100 transition-opacity duration-300">
          <p className="text-xs font-semibold text-muted-foreground tracking-wider">&copy; 2026 {PLATFORM_NAME} Global Inc.</p>
        </div>
      </div>

      {/* Right Column: Interaction Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-linear-to-br from-background via-background to-secondary/10 relative animate-in fade-in duration-700">
        {/* Decorative elements */}
        <div className="absolute top-20 right-20 w-64 h-64 bg-primary/10 rounded-full mix-blend-screen filter blur-3xl opacity-20"></div>
        <div className="absolute bottom-20 left-20 w-64 h-64 bg-secondary/10 rounded-full mix-blend-screen filter blur-3xl opacity-20"></div>

        <div className="w-full max-w-md space-y-8 md:space-y-12 relative z-10">
          {/* Mobile Header Branding (Visible only on mobile) */}
          <div className="lg:hidden text-center mb-8">
            <div className="relative mx-auto w-20 h-20 mt-10 flex items-center justify-center mb-4">
              <Image
                src="/assets/eduverse-icon.png"
                alt="Eduverse Logo"
                fill
                className="object-contain relative z-10"
              />
            </div>
            <Brand showLogo={false} size="lg" />
          </div>

          <div className="space-y-3">
            <p className="text-sm md:text-base text-muted-foreground font-medium tracking-tight">
              Sign in to your organization or student portal.
            </p>
          </div>

          <form className="space-y-6 md:space-y-8" onSubmit={handleSubmit} noValidate>
            <div className="space-y-5 md:space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email-address" className="text-xs font-semibold tracking-wider text-muted-foreground ml-1 opacity-70">Email</Label>
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
                  className="h-12 md:h-14 font-medium border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all bg-background/50 backdrop-blur-sm"
                />
                {errors.email && <p className="mt-1 text-xs text-danger font-semibold ml-1">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <Label htmlFor="password" className="text-xs font-semibold tracking-wider text-muted-foreground opacity-70">Password</Label>
                  <Link href="#" className="text-xs font-semibold tracking-wider text-primary hover:text-primary/80 transition-colors">Forgot?</Link>
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
                  className="h-12 md:h-14 font-medium border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all bg-background/50 backdrop-blur-sm"
                />
                {errors.password && <p className="mt-1 text-xs text-danger font-semibold ml-1">{errors.password}</p>}
                {errors.general && <p className="mt-2 text-sm text-danger font-bold text-center">{errors.general}</p>}
              </div>
            </div>

            <div className="flex items-center justify-between py-1">
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
                  <div className="w-5 h-5 bg-muted/50 border-2 border-border/50 rounded-md peer-checked:bg-primary peer-checked:border-primary transition-all duration-200 group-hover:border-primary/40 shadow-sm flex items-center justify-center">
                    <svg
                      className={`w-3.5 h-3.5 text-white transition-opacity duration-200 ${formData.rememberMe ? 'opacity-100' : 'opacity-0'}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="3.5"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <span className="ml-3 text-xs font-semibold tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
                  Remember Session
                </span>
              </label>
            </div>

            <div className="space-y-4 pt-4 mb-10 pb-30">
              <Button
                type="submit"
                loadingId="login-submit"
                loadingText="Logging In..."
                className="w-full h-12 md:h-14 font-semibold shadow-lg hover:shadow-xl transition-shadow"
              >
                Log In
              </Button>

              <p className="text-center text-xs md:text-sm text-muted-foreground font-medium tracking-tight">
                Don&apos;t have an account?{' '}
                <Link href="/register" className="text-primary hover:text-primary/80 transition-colors font-semibold underline underline-offset-4 decoration-2">
                  Create new organization
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
