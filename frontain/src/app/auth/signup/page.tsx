"use client";

import { AuthBranding } from "@/components/auth/auth-branding";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { useAuthAction } from "@/components/auth/use-auth-action";
import { Eye, EyeOff } from "lucide-react";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [success, setSuccess] = useState(false);
  const { error, setError, isLoading, run } = useAuthAction("Sign up failed");
  const router = useRouter();
  const supabase = createClient();

  const handleSignUp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!acceptTerms) {
      setError("Please accept the terms and conditions");
      return;
    }

    await run(async () => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;

      if (data.session) {
        router.push("/drive");
        return;
      }

      setSuccess(true);
    });
  };

  if (success) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#161616] px-4 font-sans text-white">
        <div className="w-full max-w-[360px] text-center space-y-6 bg-[#242424] p-8 rounded-xl border border-zinc-800">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-900/30 rounded-full mx-auto border border-emerald-800/50">
            <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-[22px] font-semibold tracking-tight text-white">Check your email</h2>
          <p className="text-[13px] text-zinc-400 leading-relaxed">
            We've sent a verification link to <strong className="text-white break-all">{email}</strong>.
            Please verify your email to continue.
          </p>
          <Button className="w-full h-10 bg-[#2563eb] hover:bg-[#1d4ed8] text-white border-0" onClick={() => router.push("/auth/login")}>
            Back to Sign In
          </Button>
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
              Create an account
            </h1>
            <p className="text-[13px] text-zinc-400">
              Welcome! Please sign up to continue.
            </p>
          </div>

          <div className="space-y-6">
            <GoogleAuthButton 
              mode="signup" 
              className="bg-[#242424] hover:bg-[#2a2a2a] border-0 text-white rounded-md h-10 w-full" 
            />

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800/80"></div>
              </div>
              <div className="relative flex justify-center text-[11px]">
                <span className="bg-[#161616] px-3 text-zinc-500">
                  or
                </span>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-md text-xs border font-medium bg-red-950/20 border-red-900/30 text-red-500 text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-[13px] font-semibold text-zinc-200">Display Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  className="h-10 bg-[#242424] border-zinc-800/80 text-white placeholder:text-zinc-500 focus:border-[#2563eb] focus-visible:ring-1 focus-visible:ring-[#2563eb] rounded-md transition-colors text-[13px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-[13px] font-semibold text-zinc-200">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="hello@app.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-10 bg-[#242424] border-zinc-800/80 text-white placeholder:text-zinc-500 focus:border-[#2563eb] focus-visible:ring-1 focus-visible:ring-[#2563eb] rounded-md transition-colors text-[13px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-[13px] font-semibold text-zinc-200">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-10 pr-10 bg-[#242424] border-zinc-800/80 text-white placeholder:text-zinc-500 focus:border-[#2563eb] focus-visible:ring-1 focus-visible:ring-[#2563eb] rounded-md transition-colors text-[13px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1 pb-1">
                <Checkbox
                  id="terms"
                  checked={acceptTerms}
                  onCheckedChange={(checked) => setAcceptTerms(checked === true)}
                  className="border-zinc-600 data-[state=checked]:bg-[#2563eb] data-[state=checked]:border-[#2563eb]"
                />
                <Label htmlFor="terms" className="text-[12px] font-medium text-zinc-400 cursor-pointer">
                  I accept the <Link href="#" className="text-white hover:underline">Terms</Link> & <Link href="#" className="text-white hover:underline">Privacy Policy</Link>
                </Label>
              </div>

              <Button
                type="submit"
                className="w-full h-10 mt-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium rounded-md transition-colors text-[13px] border-0"
                disabled={isLoading}
              >
                {isLoading ? "Creating account..." : "Continue"}
              </Button>
            </form>

            <p className="text-center text-[13px] text-zinc-400 mt-4">
              Already have an account?{" "}
              <Link href="/auth/login" prefetch={false} className="text-white font-medium hover:underline">
                Sign in
              </Link>
            </p>

            <div className="pt-10">
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
