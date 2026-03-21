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
import ShaderBackground from "@/components/auth/shader-background";
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
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-10 xl:p-16 bg-zinc-950 text-white relative overflow-hidden border-r border-white/5">
        {/* Professional Minimal Background */}
        <div className="absolute inset-0 z-0 pointer-events-none select-none opacity-80">
          <ShaderBackground />
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 bg-white/5 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/10 shadow-lg">
            <NextImage src="/logo.webp" alt="NDrive" width={28} height={28} className="drop-shadow-sm" />
          </div>
          <div>
            <span className="text-2xl font-bold tracking-tight text-white">
              NDrive
            </span>
          </div>
        </div>

        <div className="relative z-10 flex-1 flex flex-col justify-center max-w-xl">
          <h2 className="text-4xl xl:text-5xl font-semibold leading-[1.15] tracking-tight text-white mb-6">
            The next evolution of private cloud storage.
          </h2>
          <p className="text-zinc-400 text-lg leading-relaxed font-normal mb-12 max-w-md">
            Seamlessly sync, share, and backup your files with zero limits. Powered by MTProto architecture for robust end-to-end security.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4 group cursor-default">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 transition-colors group-hover:bg-blue-500/20 group-hover:border-blue-500/40">
                <Cloud className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="font-medium text-white text-base mb-1.5">Infinite Scale</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">Leverage Telegram's immense redundant infrastructure natively.</p>
              </div>
            </div>
            <div className="space-y-4 group cursor-default">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 transition-colors group-hover:bg-emerald-500/20 group-hover:border-emerald-500/40">
                <Shield className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-medium text-white text-base mb-1.5">Bank-grade Security</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">Your data workflow is fully encrypted and private to you.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-sm xl:text-base text-zinc-500 font-medium flex items-center gap-2">
          &copy; {new Date().getFullYear()} NDrive by 
          <a href="https://ntechbd.app" target="_blank" rel="noopener noreferrer" className="text-zinc-300 hover:text-white transition-colors underline decoration-transparent hover:decoration-white/50 underline-offset-4">
            Ntechbd Solutions
          </a>
        </div>
      </div>

      {/* Right Column - Form */}
        <div className="flex-1 flex flex-col justify-center py-4 px-4 sm:py-8 sm:px-6 lg:px-10 xl:px-12 bg-background sm:bg-background/95 relative overflow-y-auto before:absolute before:inset-0 before:-z-10 before:block before:bg-[radial-gradient(ellipse_at_top,var(--tw-colors-emerald-900)_0%,transparent_70%)] before:opacity-20 sm:before:opacity-10 dark:before:opacity-30 sm:dark:before:opacity-20">
          <div className="mx-auto w-full max-w-sm sm:max-w-md lg:max-w-[480px] xl:max-w-[500px] space-y-6 bg-card/60 sm:bg-card shadow-2xl shadow-emerald-900/5 sm:shadow-black/10 border border-border/50 sm:border-border/40 rounded-[2rem] p-6 sm:p-8 backdrop-blur-2xl sm:backdrop-blur-xl relative my-auto mt-4 sm:mt-auto">
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
