"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { Cloud, Mail, Eye, EyeOff } from "lucide-react";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!acceptTerms) {
      setError("Please accept the terms and conditions");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;

      // If user is auto-confirmed (session exists), redirect to dashboard directly
      if (data.session) {
        router.push("/drive");
        return;
      }

      // Otherwise, show email verification message
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4">
        <div className="w-full max-w-sm text-center space-y-5 py-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 rounded-full">
            <Cloud className="h-7 w-7 text-green-600" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Check your email</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            We&apos;ve sent a verification link to{" "}
            <strong className="text-gray-800 break-all">{email}</strong>.
            Please verify your email to continue.
          </p>
          <Button className="w-full h-11" variant="outline" onClick={() => router.push("/auth/login")}>
            Back to Sign In
          </Button>
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
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="text-sm text-gray-500 mt-1">Free forever. No credit card required.</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-7 space-y-4">

          {/* Google first — primary action */}
          <GoogleAuthButton mode="signup" />

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase">
              <span className="bg-white px-3 text-gray-400 font-medium tracking-wide">or sign up with email</span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSignUp} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">Display Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="h-11 text-base sm:text-sm"
              />
            </div>

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

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
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

            <div className="flex items-start gap-2.5 pt-1">
              <Checkbox
                id="terms"
                checked={acceptTerms}
                onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                className="flex-shrink-0 mt-0.5"
              />
              <label
                htmlFor="terms"
                className="text-xs text-gray-500 leading-relaxed cursor-pointer select-none"
              >
                I agree to the{" "}
                <a href="#" className="text-blue-600 hover:text-blue-700 underline underline-offset-2 font-medium">Terms&nbsp;of&nbsp;Service</a>
                {" "}and{" "}
                <a href="#" className="text-blue-600 hover:text-blue-700 underline underline-offset-2 font-medium">Privacy&nbsp;Policy</a>
              </label>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-gray-900 hover:bg-gray-800 font-semibold text-sm mt-1"
              disabled={isLoading}
            >
              <Mail className="h-4 w-4 mr-2" />
              {isLoading ? "Creating account..." : "Create Account"}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-blue-600 hover:text-blue-700 font-semibold">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
