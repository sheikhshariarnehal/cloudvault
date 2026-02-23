"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getGuestSessionId } from "@/lib/guest-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { Cloud, Mail, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMagicLink, setIsMagicLink] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Show error if redirected back from OAuth callback failure
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error")) {
      setError("Sign-in failed. Please try again.");
    }
  }, []);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (isMagicLink) {
        const { error } = await supabase.auth.signInWithOtp({ email });
        if (error) throw error;
        setError("Check your email for the magic link!");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      router.push("/drive");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestMode = () => {
    getGuestSessionId();
    router.push("/drive");
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col justify-center py-8 px-4 sm:px-6">
      <div className="w-full max-w-sm mx-auto space-y-5">

        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-11 h-11 bg-blue-600 rounded-xl mb-3">
            <Cloud className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Welcome back</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your CloudVault account</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-7 space-y-4">

          {/* Google first */}
          <GoogleAuthButton mode="login" />

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase">
              <span className="bg-white px-3 text-gray-400 font-medium tracking-wide">or continue with email</span>
            </div>
          </div>

          {/* Error / info */}
          {error && (
            <div className={`p-3 rounded-lg text-sm border ${
              error.toLowerCase().includes("check")
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-red-50 border-red-200 text-red-600"
            }`}>
              {error}
            </div>
          )}

          <form onSubmit={handleEmailLogin} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-11 text-base sm:text-sm"
              />
            </div>

            {!isMagicLink && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
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
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-gray-900 hover:bg-gray-800 font-semibold text-sm"
              disabled={isLoading}
            >
              <Mail className="h-4 w-4 mr-2" />
              {isLoading ? "Signing in..." : isMagicLink ? "Send Magic Link" : "Sign In"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setIsMagicLink(!isMagicLink)}
            className="text-xs text-gray-400 hover:text-gray-600 w-full text-center py-1"
          >
            {isMagicLink ? "Use password instead" : "Use magic link instead"}
          </button>

          <Button
            type="button"
            variant="ghost"
            className="w-full h-10 text-sm text-gray-500 hover:text-gray-700"
            onClick={handleGuestMode}
          >
            Continue as Guest
          </Button>
        </div>

        <p className="text-center text-sm text-gray-500">
          Don&apos;t have an account?{" "}
          <Link href="/auth/signup" className="text-blue-600 hover:text-blue-700 font-semibold">
            Sign up free
          </Link>
        </p>
      </div>
    </div>
  );
}
