"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { mutate } from "swr";
import { ArrowLeft, ArrowRight, Lock, Mail } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useGlobal } from "@/context/GlobalContext";
import { api } from "@/lib/api";
import { PLATFORM_NAME } from "@/lib/constants";
import { getDeviceId, getDeviceInfo } from "@/lib/deviceUtils";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { TrustedDevicePrompt } from "@/components/TrustedDevicePrompt";
import { LoginBootstrapPayload, TrustedDevicePromptFlow } from "@/types";
import { CapVerification } from "@/components/ui/CapVerification";

type LoginStep = "email" | "password";

export default function LoginPage() {
  const { login, loading } = useAuth();
  const searchParams = useSearchParams();
  const { state, dispatch } = useGlobal();
  const [loginStep, setLoginStep] = useState<LoginStep>("email");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    general?: string;
  }>({});
  const [temporaryToken, setTemporaryToken] = useState<string | null>(null);
  const [loginPreparationId, setLoginPreparationId] = useState<string | null>(
    null,
  );
  const [requiresHumanVerification, setRequiresHumanVerification] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [verificationResetKey, setVerificationResetKey] = useState(0);
  const handleVerificationChange = useCallback((value: string | null) => setCaptchaToken(value), []);

  useEffect(() => {
    const hashParams =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.hash.replace(/^#/, ""))
        : null;
    const twoFactorToken = hashParams?.get("twoFactorToken");
    if (twoFactorToken) {
      setTemporaryToken(twoFactorToken);
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
      return;
    }

    const googleError = searchParams.get("googleError");
    if (googleError) {
      setErrors({ general: googleError });
      return;
    }

    if (searchParams.get("google") !== "success" || loading) return;

    dispatch({ type: "UI_START_PROCESSING", payload: "google-session" });
    login()
      .catch((error) => {
        const message =
          error instanceof Error ? error.message : "Google sign-in failed";
        setErrors({ general: message });
      })
      .finally(() => {
        dispatch({ type: "UI_STOP_PROCESSING", payload: "google-session" });
      });
  }, [dispatch, loading, login, searchParams]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});

    if (loginStep === "email") {
      if (state.ui.processing["login-prepare"]) return;
      dispatch({ type: "UI_START_PROCESSING", payload: "login-prepare" });
      try {
        const prepared = await api.auth.prepareLogin(formData.email);
        setFormData((current) => ({
          ...current,
          email: prepared.email,
          password: "",
        }));
        setLoginPreparationId(prepared.loginPreparationId ?? null);
        setRequiresHumanVerification(Boolean(prepared.requiresHumanVerification));
        setLoginStep("password");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to continue";
        setErrors({ email: message });
      } finally {
        dispatch({ type: "UI_STOP_PROCESSING", payload: "login-prepare" });
      }
      return;
    }

    if (state.ui.processing["login-submit"]) return;
    if (requiresHumanVerification && !captchaToken) {
      setErrors({ general: "Complete the human verification challenge" });
      return;
    }
    dispatch({ type: "UI_START_PROCESSING", payload: "login-submit" });

    try {
      const deviceId = getDeviceId();
      const deviceInfo = getDeviceInfo();
      const loginPayload = {
        ...formData,
        loginPreparationId,
        deviceId,
        deviceName: deviceInfo?.deviceName,
        deviceType: deviceInfo?.deviceType,
        browser: deviceInfo?.browser,
        os: deviceInfo?.os,
        ...(captchaToken ? { captchaToken } : {}),
      };
      const res = await api.auth.login(loginPayload);
      if (res.requiresTwoFactor && res.temporaryToken) {
        setTemporaryToken(res.temporaryToken);
        setLoginPreparationId(res.loginPreparationId ?? loginPreparationId);
        return;
      }
      await login(res.access_token);
      primeLoginBootstrap(res.access_token, res.bootstrap);
    } catch (error: unknown) {
      if (requiresHumanVerification) setVerificationResetKey((current) => current + 1);
      const message = error instanceof Error ? error.message : "Login failed";
      const msgStr = Array.isArray(message) ? message[0] : message;
      const nextErrors: typeof errors = {};

      if (msgStr.toLowerCase().includes("email")) {
        nextErrors.email = msgStr;
        setLoginStep("email");
      } else if (
        msgStr.toLowerCase().includes("password") ||
        msgStr.toLowerCase().includes("credentials")
      ) {
        nextErrors.password = msgStr;
      } else {
        nextErrors.general = msgStr;
      }
      setErrors(nextErrors);
    } finally {
      dispatch({ type: "UI_STOP_PROCESSING", payload: "login-submit" });
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleGoogleLogin = () => {
    if (state.ui.processing["google-session"]) return;
    const deviceId = getDeviceId();
    const deviceInfo = getDeviceInfo();
    window.location.href = api.auth.getGoogleLoginUrl({
      rememberMe: formData.rememberMe,
      deviceId,
      deviceName: deviceInfo?.deviceName,
      deviceType: deviceInfo?.deviceType,
      browser: deviceInfo?.browser,
      os: deviceInfo?.os,
      returnTo: "/login",
    });
  };

  const handleChangeEmail = () => {
    setLoginStep("email");
    setErrors({});
    setLoginPreparationId(null);
    setRequiresHumanVerification(false);
    setCaptchaToken(null);
    setFormData((current) => ({ ...current, password: "" }));
  };

  const finishTwoFactorLogin = async (
    accessToken: string,
    bootstrap?: LoginBootstrapPayload | null,
  ) => {
    await login(accessToken);
    primeLoginBootstrap(accessToken, bootstrap);
    setTemporaryToken(null);
    setLoginPreparationId(null);
  };

  if (temporaryToken) {
    return (
      <TrustedDevicePrompt
        flow={TrustedDevicePromptFlow.TWO_FACTOR}
        temporaryToken={temporaryToken}
        loginPreparationId={loginPreparationId}
        onComplete={finishTwoFactorLogin}
        onCancel={() => {
          void api.auth.cancelTwoFactorLogin(temporaryToken);
          setTemporaryToken(null);
          void api.auth.logout();
        }}
      />
    );
  }

  return (
    <div className="relative flex h-screen min-h-fit items-center justify-center overflow-hidden bg-background p-4 sm:p-6 lg:p-8">
      <div className="absolute inset-0 bg-background">
        <div className="absolute left-[-10%] top-[-10%] h-[50%] w-[50%] animate-pulse rounded-full bg-primary/10 blur-[120px]" />
        <div
          className="absolute bottom-[-10%] right-[-10%] h-[50%] w-[50%] animate-pulse rounded-full bg-primary/8 blur-[120px]"
          style={{ animationDelay: "2s" }}
        />
        <div
          className="absolute left-[30%] top-[40%] h-[30%] w-[30%] animate-pulse rounded-full bg-primary/6 blur-[80px]"
          style={{ animationDelay: "4s" }}
        />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-size-[64px_64px]" />

      <div className="relative z-10 w-full max-w-lg">
        <div className="glass-card animate-fade-in-up rounded-3xl p-8 shadow-2xl sm:p-10 lg:p-12">
          <div className="mb-10 text-center">
            <div className="mb-2 inline-flex h-16 w-16 items-center justify-center rounded-2xl">
              <Image
                src="/assets/eduverse-icon-192.png"
                alt="Eduverse Logo"
                className="object-cover"
                width={64}
                height={64}
              />
            </div>
            <h1 className="mb-3 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
              Welcome Back
            </h1>
            <p className="text-sm font-medium text-muted-foreground sm:text-base">
              Sign in to your {PLATFORM_NAME} portal
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            <div className="overflow-hidden">
              <div
                className="flex w-[200%] transition-transform duration-300 ease-out motion-reduce:transition-none"
                style={{
                  transform:
                    loginStep === "email"
                      ? "translateX(0)"
                      : "translateX(-50%)",
                }}
              >
                <div className="w-1/2 shrink-0 space-y-6 pr-1">
                  <div className="space-y-2">
                    <Label
                      htmlFor="email-address"
                      className="ml-1 text-xs font-bold uppercase tracking-wider text-muted-foreground"
                    >
                      Email
                    </Label>
                    <Input
                      id="email-address"
                      name="email"
                      type="email"
                      required
                      tabIndex={loginStep === "email" ? 1 : -1}
                      icon={Mail}
                      placeholder="admin@school.edu"
                      value={formData.email}
                      onChange={handleChange}
                      error={!!errors.email}
                      className="h-12 border-border/40 bg-background/60 font-medium backdrop-blur-sm transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                    />
                    {errors.email && (
                      <p className="ml-1 mt-1 text-xs font-semibold text-danger">
                        {errors.email}
                      </p>
                    )}
                    {errors.general && (
                      <p className="mt-2 text-center text-sm font-bold text-danger">
                        {errors.general}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    loadingId="login-prepare"
                    loadingText="Checking..."
                    icon={ArrowRight}
                    className="h-12 w-full text-base font-bold shadow-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]"
                  >
                    Continue
                  </Button>

                  <div className="relative py-1">
                    <div
                      className="absolute inset-0 flex items-center"
                      aria-hidden="true"
                    >
                      <div className="w-full border-t border-border/60" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-card px-3 text-xs font-black uppercase tracking-widest text-muted-foreground">
                        Or
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    icon={() => (
                      <Image
                        src="./assets/svgs/google.svg"
                        width={20}
                        height={20}
                        alt="Google Icon"
                        className="h-6 w-6"
                      />
                    )}
                    onClick={handleGoogleLogin}
                    loadingId="google-session"
                    loadingText="Continuing..."
                    className="h-12 w-full text-base font-bold"
                  >
                    Continue with Google
                  </Button>
                </div>

                <div className="w-1/2 shrink-0 space-y-6 pl-1">
                  <div className="rounded-xl border border-border/70 bg-background/55 px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                      Email
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-black text-foreground">
                        {formData.email}
                      </p>
                      <button
                        type="button"
                        onClick={handleChangeEmail}
                        className="inline-flex shrink-0 items-center gap-1 text-xs font-black text-primary hover:text-primary/80"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                        Change
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="ml-1 flex items-center justify-between">
                      <Label
                        htmlFor="password"
                        className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                      >
                        Password
                      </Label>
                      <Link
                        href="/forgot-password"
                        className="text-xs font-semibold text-primary transition-colors hover:text-primary/80"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      required
                      tabIndex={loginStep === "password" ? 1 : -1}
                      icon={Lock}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleChange}
                      error={!!errors.password}
                      className="h-12 border-border/40 bg-background/60 font-medium backdrop-blur-sm transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                    />
                    {errors.password && (
                      <p className="ml-1 mt-1 text-xs font-semibold text-danger">
                        {errors.password}
                      </p>
                    )}
                    {errors.general && (
                      <p className="mt-2 text-center text-sm font-bold text-danger">
                        {errors.general}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center">
                    <label className="group flex cursor-pointer select-none items-center">
                      <div className="relative">
                        <input
                          id="remember-me"
                          name="rememberMe"
                          type="checkbox"
                          className="peer sr-only"
                          checked={formData.rememberMe}
                          onChange={handleChange}
                        />
                        <div className="flex h-5 w-5 items-center justify-center rounded-lg border-2 border-border/40 bg-background/60 transition-all duration-200 group-hover:border-primary/30 peer-checked:border-primary peer-checked:bg-primary">
                          <svg
                            className={`h-3 w-3 text-white transition-opacity duration-200 ${formData.rememberMe ? "opacity-100" : "opacity-0"}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="3"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      </div>
                      <span className="ml-3 text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                        Remember me
                      </span>
                    </label>
                  </div>

                  {requiresHumanVerification && (
                    <CapVerification purpose="LOGIN" onChange={handleVerificationChange} resetKey={verificationResetKey} disabled={Boolean(state.ui.processing["login-submit"])} />
                  )}

                  <Button
                    type="submit"
                    loadingId="login-submit"
                    loadingText="Signing in..."
                    icon={ArrowRight}
                    className="h-12 w-full text-base font-bold shadow-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]"
                    disabled={requiresHumanVerification && !captchaToken}
                  >
                    Sign In
                  </Button>
                </div>
              </div>
            </div>

            <p className="text-center text-sm font-medium text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="font-bold text-primary transition-colors hover:text-primary/80"
              >
                Get started free
              </Link>
            </p>
          </form>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs font-medium text-muted-foreground/60">
            © {new Date().getFullYear()} {PLATFORM_NAME}. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

function primeLoginBootstrap(
  accessToken: string | undefined,
  bootstrap?: LoginBootstrapPayload | null,
) {
  if (!accessToken || !bootstrap) return;

  if (bootstrap.kind === "overview-insights") {
    void mutate(
      ["insights-shell", accessToken, bootstrap.range],
      bootstrap.data,
      false,
    );
  } else if (bootstrap.kind === "finance-insights") {
    void mutate(
      ["finance/insights-shell", accessToken, bootstrap.range],
      bootstrap.data,
      false,
    );
  } else if (bootstrap.kind === "teacher-insights") {
    void mutate(
      ["teacher-insights", accessToken, { range: bootstrap.range }],
      bootstrap.data,
      false,
    );
  } else if (bootstrap.kind === "student-insights") {
    void mutate(
      ["student-insights", accessToken, { range: bootstrap.range }],
      bootstrap.data,
      false,
    );
  }
}
