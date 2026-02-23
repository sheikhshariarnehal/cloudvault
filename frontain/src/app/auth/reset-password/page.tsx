"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Cloud, Lock, Eye, EyeOff, CheckCircle } from "lucide-react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const router = useRouter();
  const supabase = createClient();

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
      setTimeout(() => router.push("/drive"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-dvh bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col justify-center py-8 px-4 sm:px-6">
        <div className="w-full max-w-sm mx-auto text-center space-y-5">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 rounded-full">
            <CheckCircle className="h-7 w-7 text-green-600" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Password updated!</h2>
          <p className="text-sm text-gray-500">Redirecting to your drive...</p>
        </div>
      </div>
    );
  }

  if (!isValidSession) {
    return (
      <div className="min-h-dvh bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col justify-center py-8 px-4 sm:px-6">
        <div className="w-full max-w-sm mx-auto text-center space-y-4">
          <div className="inline-flex items-center justify-center w-11 h-11 bg-blue-600 rounded-xl">
            <Cloud className="h-5 w-5 text-white" />
          </div>
          <p className="text-sm text-gray-500">Verifying your reset link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col justify-center py-8 px-4 sm:px-6">
      <div className="w-full max-w-sm mx-auto space-y-5">

        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-11 h-11 bg-blue-600 rounded-xl mb-3">
            <Cloud className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">New password</h1>
          <p className="text-sm text-gray-500 mt-1">Choose a strong password</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-7 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleResetPassword} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">New Password</Label>
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
                  className="h-11 pr-10 text-base sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="text-sm font-medium text-gray-700">Confirm Password</Label>
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="h-11 text-base sm:text-sm"
              />
            </div>

            {/* Password strength bar */}
            <div className="flex gap-1 pt-0.5">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    password.length === 0
                      ? "bg-gray-200"
                      : password.length < 6
                      ? i === 1 ? "bg-red-400" : "bg-gray-200"
                      : password.length < 8
                      ? i <= 2 ? "bg-yellow-400" : "bg-gray-200"
                      : password.length < 12
                      ? i <= 3 ? "bg-blue-400" : "bg-gray-200"
                      : "bg-green-400"
                  }`}
                />
              ))}
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-gray-900 hover:bg-gray-800 font-semibold text-sm mt-1"
              disabled={isLoading}
            >
              <Lock className="h-4 w-4 mr-2" />
              {isLoading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
