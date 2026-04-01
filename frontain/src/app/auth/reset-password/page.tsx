"use client";

import { AuthBranding } from "@/components/auth/auth-branding";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";

function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const isChangePasswordFlow = searchParams.get("mode") === "change";

  useEffect(() => {
    // Listen for the PASSWORD_RECOVERY event from the URL hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY") {
          setIsValidSession(true);
        }
      }
    );

    // Also check if we already have a session (user clicked recovery link)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsValidSession(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => {
        router.push(isChangePasswordFlow ? "/drive/settings" : "/drive");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#161616] px-4 font-sans text-white">
        <div className="w-full max-w-[360px] text-center space-y-6 bg-[#242424] p-8 rounded-xl border border-zinc-800">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#10b981]/20 rounded-full mx-auto border border-[#10b981]/40">
            <svg className="w-6 h-6 text-[#10b981]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-[22px] font-semibold tracking-tight text-white">Password updated!</h2>
          <p className="text-[13px] text-zinc-400 leading-relaxed">
            Redirecting to {isChangePasswordFlow ? "settings" : "your drive"}...
          </p>
        </div>
      </div>
    );
  }

  if (!isValidSession) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#161616] px-4 font-sans text-white">
        <div className="w-full max-w-[360px] text-center space-y-4">
          <div className="relative flex items-center justify-center w-12 h-12 mx-auto mb-4">
            <div className="absolute top-1.5 left-1.5 w-[22px] h-[22px] rounded-[6px] border-[2px] border-[#0ea5e9]"></div>
            <div className="absolute bottom-1.5 right-1.5 w-[22px] h-[22px] rounded-[6px] bg-[#0ea5e9]"></div>
          </div>
          <p className="text-[13px] text-zinc-400">
            {isChangePasswordFlow ? "Checking your session..." : "Verifying your reset link..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex font-sans bg-[#161616]">
      <AuthBranding />

      {/* Right Column */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 bg-[#161616] text-white overflow-y-auto">
        <div className="mx-auto w-full max-w-[360px] space-y-7 pb-20 mt-10">
          <div className="text-center space-y-2">
            <h1 className="text-[26px] font-semibold tracking-tight text-white">
              {isChangePasswordFlow ? "Change password" : "New password"}
            </h1>
            <p className="text-[13px] text-zinc-400">
              {isChangePasswordFlow
                ? "Set a new password for your account"
                : "Choose a strong password"}
            </p>
          </div>

          <div className="space-y-6">
            {error && (
              <div className="p-3 rounded-md text-xs border font-medium bg-red-950/20 border-red-900/30 text-red-500 text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[13px] font-semibold text-zinc-200">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="h-10 pr-10 bg-[#242424] border-zinc-800/80 text-white placeholder:text-zinc-500 focus:border-[#2563eb] focus-visible:ring-1 focus-visible:ring-[#2563eb] rounded-md transition-colors text-[13px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-[13px] font-semibold text-zinc-200">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="h-10 bg-[#242424] border-zinc-800/80 text-white placeholder:text-zinc-500 focus:border-[#2563eb] focus-visible:ring-1 focus-visible:ring-[#2563eb] rounded-md transition-colors text-[13px]"
                />
              </div>

              {/* Password strength bar */}
              <div className="flex gap-1 pt-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      password.length === 0
                        ? "bg-zinc-800"
                        : password.length < 6
                        ? i === 1 ? "bg-red-500" : "bg-zinc-800"
                        : password.length < 8
                        ? i <= 2 ? "bg-yellow-500" : "bg-zinc-800"
                        : password.length < 12
                        ? i <= 3 ? "bg-blue-500" : "bg-zinc-800"
                        : "bg-[#10b981]"
                    }`}
                  />
                ))}
              </div>

              <Button
                type="submit"
                className="w-full h-10 mt-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium rounded-md transition-colors text-[13px] border-0"
                disabled={isLoading}
              >
                {isLoading ? "Updating..." : isChangePasswordFlow ? "Change Password" : "Update Password"}
              </Button>

              {isChangePasswordFlow && (
                <Link
                  href="/drive/settings"
                  className="flex items-center justify-center gap-1.5 text-[13px] text-zinc-400 hover:text-white transition-colors mt-6 font-medium"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Settings
                </Link>
              )}
            </form>
            
            <div className="pt-20">
              <p className="text-center text-[11px] text-zinc-600">
                © CloudVault · Privacy · Terms
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
