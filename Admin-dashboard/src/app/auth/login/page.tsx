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
import { Mail, Eye, EyeOff, Send, Cloud, Shield } from "lucide-react";
import NextImage from "next/image";

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
    <div className="min-h-dvh flex bg-background sm:bg-muted/40 text-foreground">
      {/* Left Column - Branding (Hidden on mobile) */}
<div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-10 xl:p-14 bg-[#09090b] text-white relative overflow-hidden border-r border-white/5">
        {/* Animated SVG & Abstract Background */}
        <div className="absolute inset-0 z-0 pointer-events-none select-none">
          {/* Subtle moving grid */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMSkiLz48L3N2Zz4=')] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_40%,#000_10%,transparent_100%)]" />
          
          {/* Animated Orbs */}
          <div className="absolute -top-[20%] -right-[10%] w-[500px] h-[500px] rounded-full bg-blue-600/20 blur-[120px] mix-blend-screen animate-[spin_20s_linear_infinite_reverse] origin-bottom-left" />
          <div className="absolute -bottom-[20%] -left-[10%] w-[600px] h-[600px] rounded-full bg-indigo-600/20 blur-[130px] mix-blend-screen animate-[spin_25s_linear_infinite] origin-top-right" />

          {/* Floating Geometric Lines SVG */}
          <svg className="absolute inset-0 w-full h-full opacity-40" xmlns="http://www.w3.org/2000/svg">
            <style>{`
              @keyframes line-dash { to { stroke-dashoffset: -1000; } }
              @keyframes float-up { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-20px); } }
              @keyframes float-down { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(20px); } }
              .animated-line { stroke-dasharray: 20 15; animation: line-dash 30s linear infinite; }
              .floating-group { animation: float-up 10s ease-in-out infinite; }
              .floating-group-delayed { animation: float-down 14s ease-in-out infinite; }
            `}</style>
            <g className="floating-group" stroke="rgba(255,255,255,0.1)" strokeWidth="1" fill="none">
              <path className="animated-line" d="M -100 200 C 300 100, 600 400, 1000 150" />
              <path className="animated-line" d="M -100 250 C 400 150, 500 500, 1100 200" stroke="rgba(99,102,241,0.2)" />
              <circle cx="300" cy="180" r="3" fill="rgba(99,102,241,0.5)" />
              <circle cx="700" cy="320" r="4" fill="rgba(59,130,246,0.5)" />
            </g>
            <g className="floating-group-delayed" stroke="rgba(255,255,255,0.07)" strokeWidth="1" fill="none">
              <path className="animated-line" d="M -100 800 C 400 900, 700 600, 1200 850" />
              <path className="animated-line" d="M -100 750 C 300 850, 800 550, 1100 750" stroke="rgba(59,130,246,0.2)" />
              <circle cx="450" cy="780" r="3" fill="rgba(59,130,246,0.5)" />
              <circle cx="850" cy="680" r="4" fill="rgba(99,102,241,0.5)" />
            </g>
            <g stroke="rgba(255,255,255,0.05)" strokeWidth="0.5">
              <line x1="300" y1="180" x2="450" y2="780" className="floating-group" />
              <line x1="700" y1="320" x2="850" y2="680" className="floating-group-delayed" />
            </g>
          </svg>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20 shadow-xl shadow-black/50">
            <NextImage src="/logo.webp" alt="NDrive" width={28} height={28} className="drop-shadow-md" />
          </div>
          <div>
            <span className="text-3xl font-bold tracking-tight block bg-gradient-to-br from-white to-white/70 bg-clip-text text-transparent">
              NDrive
            </span>
          </div>
        </div>

        <div className="relative z-10 flex-1 flex flex-col justify-center max-w-lg">
          <h2 className="text-5xl font-bold leading-[1.1] tracking-tight bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent mb-6">
            Next generation cloud storage over Telegram.
          </h2>
          <p className="text-gray-400 text-lg leading-relaxed font-light mb-10">
            Store unlimited files for free. Secure, fast, and easy to use. Powered by MTProto backend and React frontend.
          </p>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3 group cursor-default">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex flex-col items-center justify-center border border-white/10 transition-all duration-300 group-hover:bg-blue-500/10 group-hover:border-blue-500/30 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]">
                <Send className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-200 text-base mb-1">Telegram Storage</h3>
                <p className="text-sm text-gray-500 leading-relaxed">Files stored reliably in Telegram servers</p>
              </div>
            </div>
            <div className="space-y-3 group cursor-default">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex flex-col items-center justify-center border border-white/10 transition-all duration-300 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/30 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                <Shield className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-200 text-base mb-1">End-to-End Secure</h3>
                <p className="text-sm text-gray-500 leading-relaxed">Your files are private and encrypted</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-sm text-gray-500/80 font-medium">
          &copy; {new Date().getFullYear()} NDrive by <a href="https://ntechbd.app" target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-400 hover:text-blue-400 transition-colors underline decoration-transparent hover:decoration-blue-400/50 underline-offset-4">Ntechbd Solutions</a>. All rights reserved.
        </div>
      </div>

      {/* Right Column - Form */}
      <div className="flex-1 flex flex-col justify-center py-6 px-4 sm:py-8 sm:px-6 lg:px-10 xl:px-12 bg-background sm:bg-transparent lg:bg-background relative overflow-y-auto">
        <div className="mx-auto w-full max-w-sm sm:max-w-md lg:max-w-[520px] xl:max-w-[560px] space-y-6 sm:bg-card sm:shadow-xl sm:shadow-black/5 sm:border sm:border-border sm:rounded-[2rem] sm:p-8 lg:bg-transparent lg:shadow-none lg:border-0 lg:rounded-none lg:p-0 my-auto">
          
          {/* Mobile/Tablet Logo */}
          <div className="flex lg:hidden items-center justify-center gap-2 mb-2 sm:mb-6">
            <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center shadow-md">
              <NextImage src="/logo.webp" alt="NDrive" width={24} height={24} />
            </div>
          </div>

          <div className="space-y-2 text-center lg:text-left">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Welcome back
            </h1>
            <p className="text-sm text-muted-foreground">
              Your files are securely stored on your personal Telegram account
            </p>
          </div>

          <div className="space-y-6">
            <GoogleAuthButton mode="login" />

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-background px-4 text-muted-foreground text-xs uppercase tracking-wider font-medium">
                  Or continue with email
                </span>
              </div>
            </div>

            {error && (
              <div className={`p-3 rounded-xl text-sm border font-medium ${
                error.toLowerCase().includes("check")
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-red-50 border-red-200 text-red-600"
              }`}>
                {error}
              </div>
            )}

            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-foreground">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-11 px-4 shadow-sm border-input focus:border-ring focus:ring-ring transition-colors"
                />
              </div>

              {!isMagicLink && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium text-foreground">Password</Label>
                    <Link
                      href="/auth/forgot-password"
                      className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
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
                      className="h-11 px-4 pr-11 shadow-sm border-input focus:border-ring focus:ring-ring transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-accent transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-all shadow-sm active:scale-[0.98]"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : isMagicLink ? "Send Magic Link" : "Sign in"}
              </Button>
            </form>

            <div className="flex flex-col gap-3">
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground font-medium transition-colors"
                onClick={handleGuestMode}
              >
                Continue as Guest
              </Button>
            </div>
          </div>
          
          <p className="text-center text-sm text-muted-foreground mt-8">
            Don&apos;t have an account?{" "}
            <Link href="/auth/signup" className="font-semibold text-foreground hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
