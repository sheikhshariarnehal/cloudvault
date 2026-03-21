"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getGuestSessionId } from "@/lib/guest-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { Eye, EyeOff } from "lucide-react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMagicLink, setIsMagicLink] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error")) {
      setError("Sign-in failed. Please try again.");
    }
  }, []);

  const handleEmailLogin = async (e: FormEvent<HTMLFormElement>) => {
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
    <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 bg-[#161616] text-white overflow-y-auto">
      <div className="mx-auto w-full max-w-[360px] space-y-7 pb-20 mt-10">
        <div className="text-center space-y-2">
          <h1 className="text-[26px] font-semibold tracking-tight text-white">
            Sign in
          </h1>
          <p className="text-[13px] text-zinc-400">
            Welcome back! Please sign in to continue.
          </p>
        </div>

        <div className="space-y-6">
          <GoogleAuthButton 
            mode="login" 
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

          <form onSubmit={handleEmailLogin} className="space-y-4">
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

            {!isMagicLink && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-[13px] font-semibold text-zinc-200">Password</Label>
                  <Link
                    href="/auth/forgot-password"
                    prefetch={false}
                    className="text-[12px] font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
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
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <Button
                type="submit"
                className="w-full h-10 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium rounded-md transition-colors text-[13px] border-0"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Continue"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full h-10 bg-transparent hover:bg-[#2a2a2a] text-zinc-300 border border-zinc-800/80 font-medium rounded-md transition-colors text-[13px]"
                onClick={handleGuestMode}
              >
                Continue as Guest
              </Button>
            </div>
          </form>

          <p className="text-center text-[13px] text-zinc-400 mt-4">
            Don\'t have an account?{" "}
            <Link href="/auth/signup" prefetch={false} className="text-white font-medium hover:underline">
              Sign up
            </Link>
          </p>

          <div className="pt-16">
            <p className="text-center text-[11px] text-zinc-600">
              © CloudVault · Privacy · Terms
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
