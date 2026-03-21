"use client";

import { AuthBranding } from "@/components/auth/auth-branding";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) throw error;
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset email");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#161616] px-4 font-sans text-white">
        <div className="w-full max-w-[360px] text-center space-y-6 bg-[#242424] p-8 rounded-xl border border-zinc-800">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#0ea5e9]/20 rounded-full mx-auto border border-[#0ea5e9]/40">
            <svg className="w-6 h-6 text-[#0ea5e9]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-[22px] font-semibold tracking-tight text-white">Check your email</h2>
          <p className="text-[13px] text-zinc-400 leading-relaxed">
            We've sent a reset link to <strong className="text-white break-all">{email}</strong>.
            Check your inbox and follow the link.
          </p>
          <Link href="/auth/login" prefetch={false} className="block outline-none mt-2">
            <Button className="w-full h-10 bg-[#2563eb] hover:bg-[#1d4ed8] text-white border-0 transition-colors text-[13px] font-medium">
              Back to Sign In
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex font-sans bg-[#161616]">
      <AuthBranding />

      {/* Right Column - Authentication Form */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 bg-[#161616] text-white overflow-y-auto">
        <div className="mx-auto w-full max-w-[360px] space-y-7 pb-20 mt-10">
          <div className="text-center space-y-2">
            <h1 className="text-[26px] font-semibold tracking-tight text-white">
              Reset password
            </h1>
            <p className="text-[13px] text-zinc-400">
              We'll send a recovery link to your email.
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
                <Label htmlFor="email" className="text-[13px] font-semibold text-zinc-200">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="hello@app.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-10 bg-[#242424] border-zinc-800/80 text-white placeholder:text-zinc-500 focus:border-[#2563eb] focus-visible:ring-1 focus-visible:ring-[#2563eb] rounded-md transition-colors text-[13px]"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-10 mt-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium rounded-md transition-colors text-[13px] border-0"
                disabled={isLoading}
              >
                {isLoading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>

            <Link
              href="/auth/login"
              prefetch={false}
              className="flex items-center justify-center gap-1.5 text-[13px] text-zinc-400 hover:text-white transition-colors mt-6 font-medium"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Sign In
            </Link>

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
